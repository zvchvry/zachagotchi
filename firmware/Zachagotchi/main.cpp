#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <esp_timer.h>
#include <esp_sntp.h>
#include <time.h>
#include "board.h"
#include "care.h"
#include "avatar.h"
#include "avatar-art.h"
#include "sound.h"

// Explicit declarations keep this ordinary C++, independent of Arduino prototype generation.
void render();
void drawEditor();
void editorTap(const TouchPoint &point);
void startPortal();
void closePortal();
void startConnection();

Adafruit_ILI9341 lcd(&SPI,LCD_DC,LCD_CS,-1);
GFXcanvas1 frame(240,320); // Only 9.6 KB for the entire monochrome screen.
Preferences saves;
WebServer portalServer(80);
CareState zach;
AvatarStore avatarStore;
Avatar avatar, draft;
bool editing=false;
int editorPage=0;
const char *editorError="";
uint64_t sequence=0;
int saveSlot=-1, batteryPercent=-1;
bool storageReady=false, saveFailed=false, displayOff=false, dirty=true;
bool touchReady=false, touchDown=false, longPressUsed=false, firstWakeTap=false;
volatile bool syncNotified=false;
bool portalActive=false, clockConfigured=false, connectionPending=false;
TouchPoint pressPoint, lastPoint, wakePoint;
uint32_t lastActivity=0,lastCheckpoint=0,lastBatteryRead=0,lastMinute=0,lastBob=0;
uint32_t pressedAt=0,wakeTapAt=0,networkStarted=0,lastNetworkTry=0,portalStarted=0;
uint64_t lastCareMicros=0;
uint8_t bob=0;
String networkName, networkPassword, timezoneRule="EST5EDT,M3.2.0,M11.1.0";
String setupName, setupPassword, setupToken;
const char *speech="you're my favorite person <3";
uint32_t speechAt=0;

bool hasWallClock() { return time(nullptr)>1704067200; }
void updateCare() {
  const uint64_t now=esp_timer_get_time();
  if(!lastCareMicros) { lastCareMicros=now;return; }
  const double delta=(now-lastCareMicros)/1000000.0;
  lastCareMicros=now;
  advanceCare(zach,delta);
  zach.pendingSeconds+=delta;
  if(hasWallClock() && time(nullptr)>=zach.lastEpoch) {
    const int64_t epoch=time(nullptr);
    if(zach.lastEpoch>0) {
      const double gap=epoch-zach.lastEpoch-zach.pendingSeconds;
      if(gap>1) advanceCare(zach,gap); // Apply unpowered/offline time once.
    }
    zach.lastEpoch=epoch;
    zach.pendingSeconds=0;
  }
}

bool readSlot(const char *key,SaveRecord &record) {
  return saves.getBytesLength(key)==sizeof(record) && saves.getBytes(key,&record,sizeof(record))==sizeof(record) && validRecord(record);
}
void loadProgress() {
  storageReady=saves.begin("zachagotchi",false);
  if(!storageReady) { saveFailed=true;return; }
  SaveRecord a{},b{};
  const bool goodA=readSlot("saveA",a),goodB=readSlot("saveB",b);
  if(goodA || goodB) {
    const bool useB=goodB && (!goodA || b.sequence>a.sequence);
    const SaveRecord &r=useB?b:a;
    zach=r.state;sequence=r.sequence;saveSlot=useB?1:0;
  }
}
bool saveProgress() {
  updateCare();
  if(!storageReady) {saveFailed=true;dirty=true;return false;}
  SaveRecord record{};record.sequence=sequence+1;record.state=zach;record.checksum=recordHash(record);
  const int next=saveSlot==0?1:0;
  const char *key=next?"saveB":"saveA";
  SaveRecord verify{};
  const bool ok=saves.putBytes(key,&record,sizeof(record))==sizeof(record)
    && readSlot(key,verify) && memcmp(&record,&verify,sizeof(record))==0;
  if(ok) { sequence=record.sequence;saveSlot=next;lastCheckpoint=millis(); }
  saveFailed=!ok;dirty=true;
  return ok;
}

void label(int x,int y,const char *value,uint8_t size=1) {
  frame.setTextSize(size);frame.setTextColor(1);frame.setCursor(x,y);frame.print(value);
}
void centered(int y,const char *value) { label((240-strlen(value)*6)/2,y,value); }
void heart(int x,int y,int scale=1) {
  const uint8_t rows[]={0x36,0x7f,0x7f,0x3e,0x1c,0x08};
  for(int row=0;row<6;row++) for(int col=0;col<7;col++) if(rows[row]&(1<<(6-col))) frame.fillRect(x+col*scale,y+row*scale,scale,scale,1);
}
void drawZach(int x,int y,const Avatar &p,bool sleeping=false) {
  const uint8_t *head=avatarHeads[((p.hair*5+p.beard)*2)+(sleeping?1:0)];
  const uint8_t *body=avatarBodies[p.shirt*4+p.pants];
  const uint8_t *hat=avatarHats[p.hat?1:0];
  for(int py=0;py<32;py++)for(int px=0;px<32;px++){
    int bit=py*32+px;if((head[bit/8]|body[bit/8]|hat[bit/8])&(0x80>>(bit%8)))frame.fillRect(x+px*3,y+py*3,3,3,1);
  }
}
void editorButton(int x,int y,int w,int h,const char *title) {
  frame.drawRect(x,y,w,h,1);label(x+(w-strlen(title)*6)/2,y+(h-8)/2,title);
}
void drawEditor() {
  frame.fillScreen(0);centered(10,"MAKE YOUR LITTLE HUMAN");frame.drawFastHLine(8,29,224,1);
  if(editorPage==2){
    editorButton(8,36,224,30,draft.name);centered(70,"12 letters - tap to type");
    const char *keys="abcdefghijklmnopqrstuvwxyz'- ";
    for(int i=0;i<30;i++){char key[2]={i<29?keys[i]:' ',0};editorButton(8+(i%6)*38,83+(i/6)*32,34,29,i==28?"SP":i==29?"DEL":key);}
    editorButton(8,244,224,26,"BACK TO LOOK");
  }else{
    drawZach(72,30,draft);
    char name[28];snprintf(name,sizeof(name),"tiny %s [EDIT]",draft.name);
    editorButton(8,126,224,28,name);
    editorButton(8,158,110,27,editorPage==0?"[LOOK]":"LOOK");editorButton(122,158,110,27,editorPage==1?"[OUTFIT]":"OUTFIT");
    const char *hair[]={"Bald","Crop","Side part","Curls","Long","Mohawk"};
    const char *beard[]={"Full beard","Clean","Stubble","Mustache","Goatee"};
    const char *shirt[]={"Dark tee","Light tee","Stripes","Overalls"};
    const char *pants[]={"Dark","Light","Jeans","Shorts"};
    const char *titles[]={editorPage?"SHIRT":"HAIR",editorPage?"PANTS":"FACE","SOUND"};
    const char *values[]={editorPage?shirt[draft.shirt]:hair[draft.hair],editorPage?pants[draft.pants]:beard[draft.beard],draft.sound?"ON":"OFF"};
    for(int i=0;i<(editorPage?3:2);i++){int h=editorPage?26:40,y=188+i*(editorPage?28:42);editorButton(8,y,34,h,"<");editorButton(198,y,34,h,">");char text[28];snprintf(text,sizeof(text),"%s: %s",titles[i],values[i]);centered(y+(h-8)/2,text);}
  }
  centered(272,editorError);editorButton(8,282,109,30,"CANCEL");editorButton(123,282,109,30,"SAVE");
}
void editorTap(const TouchPoint &point){
  lastActivity=millis();editorError="";
  if(point.y>=282 && point.y<312){
    if(point.x>=123){
      String name=draft.name;name.trim();strlcpy(draft.name,name.c_str(),sizeof(draft.name));
      if(!validAvatar(draft)){editorError="Please add a name";dirty=true;return;}
      if(!avatarStore.save(draft)){editorError="Save failed. Try again";dirty=true;return;}
      avatar=draft;soundStop();soundPlay(5,avatar.sound);
    }
    editing=false;dirty=true;return;
  }
  if(editorPage==2){
    if(point.y>=244&&point.y<270){editorPage=0;dirty=true;return;}
    if(point.y>=83&&point.y<240&&point.x>=8&&point.x<232){
      int col=(point.x-8)/38,row=(point.y-83)/32;
      if(col<6&&row<5&&(point.x-8)%38<34&&(point.y-83)%32<29){
        int key=row*6+col;size_t n=strlen(draft.name);const char *keys="abcdefghijklmnopqrstuvwxyz'- ";
        if(key==29){if(n)draft.name[n-1]=0;}else if(n<12){draft.name[n]=keys[key];draft.name[n+1]=0;}
      }
    }
  }else if(point.y>=126&&point.y<154)editorPage=2;
  else if(point.y>=158&&point.y<185)editorPage=point.x<120?0:1;
  else if(point.y>=188&&point.y<270&&(point.x<42||point.x>=198)){
    const int step=editorPage?28:42,row=(point.y-188)/step,delta=point.x<42?-1:1;
    if((point.y-188)%step>=(editorPage?26:40))return;
    if(editorPage==0){uint8_t *value=row==0?&draft.hair:&draft.beard;int count=row==0?6:5;*value=(*value+delta+count)%count;}
    else {uint8_t *value=row==0?&draft.shirt:row==1?&draft.pants:&draft.sound;int count=row==2?2:4;*value=(*value+delta+count)%count;}
    soundStop();soundPlay(6,draft.sound);
  }
  dirty=true;
}

void room() {
  frame.fillRect(0,69,240,126,0);
  frame.drawRect(21,81,35,39,1);frame.drawRect(22,82,33,37,1);
  frame.drawFastVLine(38,88,7,1);frame.drawFastHLine(35,91,7,1);
  frame.fillRect(34,109,9,2,1);frame.fillRect(37,107,4,2,1);
  frame.drawLine(209,180,209,165,1);frame.drawCircle(205,169,3,1);frame.drawCircle(213,169,3,1);frame.drawCircle(209,164,3,1);
  frame.fillRect(204,183,10,4,1);
  drawZach(72,80-(zach.sleeping?0:bob*3),avatar,zach.sleeping);
  if(zach.sleeping) label(159,88,"z z");
  else if(millis()-speechAt<1800) heart(154,82);
}
void drawBattery() {
  frame.drawRect(178,11,15,9,1);frame.fillRect(193,13,2,4,1);
  char text[8];
  if(batteryPercent<0) {label(182,12,"?");strcpy(text,"--%");}
  else {frame.fillRect(180,13,11*batteryPercent/100,5,1);snprintf(text,sizeof(text),"%d%%",batteryPercent);}
  label(199,12,text);
}
void drawGame() {
  frame.fillScreen(0);
  char shownName[11];snprintf(shownName,sizeof(shownName),"%.10s",avatar.name);
  label(10,10,"tiny");label(34,10,shownName);label(10,20,"[edit]");
  char age[20];snprintf(age,sizeof(age),"DAY %lu",(unsigned long)(zach.ageSeconds/86400)+1);label(103,12,age);
  drawBattery();
  const char *names[]={"FOOD","LOVE","ENERGY"};float values[]={zach.food,zach.love,zach.energy};
  for(int i=0;i<3;i++) {
    int x=10+i*77;label(x,35,names[i]);frame.drawRect(x,48,67,7,1);
    for(int p=0;p<(int)(values[i]*0.65f);p++) if(p%4!=3)frame.drawFastVLine(x+1+p,49,5,1);
  }
  room();frame.drawRect(10,200,220,27,1);centered(210,speech);
  const char *titles[]={"FEED","LOVE","PLAY",zach.sleeping?"WAKE":"SLEEP","COFFEE"};
  for(int i=0;i<5;i++) {
    int x=5+i*47;frame.drawRect(x,237,42,49,1);frame.fillRect(x,284,42,2,1);label(x+(42-strlen(titles[i])*6)/2,271,titles[i]);
    if(i==0) {frame.drawRect(x+18,245,13,13,1);for(int k=1;k<12;k+=3){frame.drawFastVLine(x+18+k,245,13,1);frame.drawFastHLine(x+18,245+k,13,1);}}
    if(i==1) heart(x+14,246,2);
    if(i==2) {frame.drawFastVLine(x+21,245,14,1);frame.drawFastHLine(x+15,251,13,1);frame.drawLine(x+17,247,x+25,255,1);frame.drawLine(x+25,247,x+17,255,1);}
    if(i==3) {frame.fillCircle(x+21,251,7,1);if(!zach.sleeping)frame.fillCircle(x+24,248,6,0);}
    if(i==4) {frame.drawRect(x+16,247,11,9,1);frame.drawLine(x+27,249,x+31,249,1);frame.drawLine(x+31,249,x+31,254,1);frame.drawFastHLine(x+14,258,15,1);}
  }
  const char *mood=zach.sleeping?"dreaming of you":zach.food<35?"a little hungry":zach.energy<30?"ready for a nap":"feeling loved";
  heart(10,298);label(22,298,mood);
  char clockText[8]="--:--";
  if(hasWallClock()) {time_t now=time(nullptr);struct tm local;localtime_r(&now,&local);strftime(clockText,sizeof(clockText),"%H:%M",&local);}
  label(199,298,clockText);
  if(!touchReady) {frame.fillRect(0,309,240,11,1);frame.setTextColor(0);frame.setCursor(21,311);frame.print("Touch not found - check board");}
  if(saveFailed) {frame.fillRect(0,308,240,12,1);frame.setTextColor(0);frame.setCursor(30,310);frame.print("Save failed. Keep powered.");}
}
void drawPortal() {
  frame.fillScreen(0);centered(15,"A little setup");heart(113,35,2);
  centered(69,"Set the clock with Wi-Fi");
  centered(98,"1. On your phone, join:");centered(117,setupName.c_str());
  centered(145,"Password:");centered(162,setupPassword.c_str());
  centered(194,"2. Open your browser:");centered(212,"http://192.168.4.1");
  centered(242,connectionPending?"Connecting...":"Then enter your home Wi-Fi");
  frame.drawRect(40,275,160,30,1);centered(286,"SKIP FOR NOW");
}
// Expand one row at a time; no 150 KB color framebuffer and no per-pixel SPI transactions.
void flush(int x=0,int y=0,int w=240,int h=320) {
  if(displayOff)return;
  uint16_t row[240];const uint8_t *bits=frame.getBuffer();
  lcd.startWrite();lcd.setAddrWindow(x,y,w,h);
  for(int py=y;py<y+h;py++) {
    for(int px=0;px<w;px++) {int bit=py*240+x+px;row[px]=(bits[bit/8]&(0x80>>(bit%8)))?LCD_INK:LCD_PAPER;}
    lcd.writePixels(row,w);
  }
  lcd.endWrite();
}
void render() {
  if(displayOff)return;
  if(editing)drawEditor();else if(portalActive) drawPortal();else drawGame();
  flush();dirty=false;
}

void readBattery() {
  uint32_t total=0;
  for(int i=0;i<12;i++){total+=analogReadMilliVolts(BATTERY_ADC);delay(1);}
  const float voltage=total/12.0f*2.0f/1000.0f;
  // Voltage-derived estimate, not a fuel gauge. Impossible readings remain unknown.
  const float volts[]={3.3,3.6,3.7,3.75,3.85,4.0,4.2};
  const int percents[]={0,10,20,40,60,80,100};
  if(voltage<2.5 || voltage>4.45) batteryPercent=-1;
  else if(voltage<=volts[0]) batteryPercent=0;
  else if(voltage>=volts[6]) batteryPercent=100;
  else for(int i=1;i<7;i++) if(voltage<=volts[i]) {batteryPercent=roundf(percents[i-1]+(voltage-volts[i-1])/(volts[i]-volts[i-1])*(percents[i]-percents[i-1]));break;}
  lastBatteryRead=millis();dirty=true;
}
bool readTouch(TouchPoint &point) {
  if(!touchReady)return false;
  Wire.beginTransmission(TOUCH_ADDRESS);Wire.write(0x02);
  if(Wire.endTransmission(false)!=0 || Wire.requestFrom(TOUCH_ADDRESS,(uint8_t)5)!=(uint8_t)5)return false;
  const int count=Wire.read()&0x0f;
  const int xh=Wire.read(),xl=Wire.read(),yh=Wire.read(),yl=Wire.read();
  if(count<1 || count>2 || (xh>>6)==1)return false;
  point.x=((xh&0x0f)<<8)|xl;point.y=((yh&0x0f)<<8)|yl;
  return point.x>=0 && point.x<240 && point.y>=0 && point.y<320;
}
void screenSleep() {
  if(displayOff || portalActive || editing)return;
  soundStop();
  if(!saveProgress()){lastActivity=millis();return;}
  displayOff=true;firstWakeTap=false;digitalWrite(LCD_BL,LOW);
}
void screenWake() {
  updateCare();displayOff=false;firstWakeTap=false;dirty=true;lastActivity=millis();
  render();digitalWrite(LCD_BL,HIGH);
}
void act(int action) {
  updateCare();
  if(zach.sleeping && action!=3) {speech="shh... dreaming of you <3";dirty=true;return;}
  careAction(zach,action);
  int effect=action==3?(zach.sleeping?3:4):action==4?7:action;
  soundPlay(effect,avatar.sound);
  if(action==0)speech="full tummy, happy me <3";
  if(action==1)speech="more head pats, please <3";
  if(action==2)speech="you caught my heart! <3";
  if(action==3)speech=zach.sleeping?"goodnight, favorite person <3":"hey you. missed your face <3";
  if(action==4)speech="warm coffee, warm heart <3";
  speechAt=millis();saveProgress();dirty=true;
}

void closePortal() {
  portalServer.stop();portalActive=false;WiFi.softAPdisconnect(true);
  if(connectionPending)WiFi.mode(WIFI_STA);else WiFi.mode(WIFI_OFF);
  lastActivity=millis();dirty=true;
}
void startConnection() {
  if(networkName.isEmpty())return;
  WiFi.mode(portalActive?WIFI_AP_STA:WIFI_STA);
  WiFi.begin(networkName.c_str(),networkPassword.c_str());
  connectionPending=true;clockConfigured=false;syncNotified=false;networkStarted=millis();lastNetworkTry=networkStarted;
}
void startPortal() {
  if(portalActive)return;
  if(displayOff)screenWake();
  const uint32_t random=esp_random();
  char suffix[5],password[10],token[17];
  snprintf(suffix,sizeof(suffix),"%04X",(uint16_t)ESP.getEfuseMac());
  snprintf(password,sizeof(password),"%08lu",(unsigned long)(random%100000000));
  snprintf(token,sizeof(token),"%08lx%08lx",(unsigned long)random,(unsigned long)esp_random());
  setupName=String("Zachagotchi-")+suffix;setupPassword=password;setupToken=token;
  WiFi.mode(WIFI_AP_STA);WiFi.softAP(setupName.c_str(),setupPassword.c_str());
  portalActive=true;portalStarted=millis();
  portalServer.on("/",HTTP_GET,[](){
    const String html=String("<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Zachagotchi setup</title><style>body{font:16px monospace;background:#dce6c0;color:#263829;max-width:420px;margin:32px auto;padding:20px}input,select,button{box-sizing:border-box;width:100%;padding:12px;margin:8px 0 18px;font:inherit}button{background:#263829;color:#dce6c0}label{display:block}</style><h1>Hi, favorite person.</h1><p>Connect tiny Zach to 2.4 GHz Wi-Fi so he can set his clock after charging.</p><form method='post' action='/save'><input type='hidden' name='token' value='")+setupToken+"'><label>Wi-Fi name<input name='ssid' maxlength='32' required></label><label>Wi-Fi password<input type='password' name='password' maxlength='63'></label><label>Time zone<select name='zone'><option value='EST5EDT,M3.2.0,M11.1.0'>US Eastern</option><option value='CST6CDT,M3.2.0,M11.1.0'>US Central</option><option value='MST7MDT,M3.2.0,M11.1.0'>US Mountain</option><option value='PST8PDT,M3.2.0,M11.1.0'>US Pacific</option><option value='UTC0'>UTC</option></select></label><button>Save and connect</button></form><p>Saved only on this device.</p>";
    portalServer.sendHeader("Cache-Control","no-store");portalServer.send(200,"text/html",html);
  });
  portalServer.on("/save",HTTP_POST,[](){
    if(portalServer.arg("token")!=setupToken){portalServer.send(403,"text/plain","Reopen the setup page and try again.");return;}
    String ssid=portalServer.arg("ssid"),pass=portalServer.arg("password"),zone=portalServer.arg("zone");
    const bool goodZone=zone=="EST5EDT,M3.2.0,M11.1.0"||zone=="CST6CDT,M3.2.0,M11.1.0"||zone=="MST7MDT,M3.2.0,M11.1.0"||zone=="PST8PDT,M3.2.0,M11.1.0"||zone=="UTC0";
    if(ssid.indexOf('\n')>=0||pass.indexOf('\n')>=0||ssid.isEmpty()||ssid.length()>32||pass.length()>63||(!pass.isEmpty()&&pass.length()<8)||!goodZone){portalServer.send(400,"text/plain","Check the Wi-Fi name, password and time zone.");return;}
    Preferences net;
    if(!net.begin("zachnet",false)){portalServer.send(500,"text/plain","Could not save settings. Try again.");return;}
    // One JSON-free binary-free string record prevents partial credential field updates.
    String settings=ssid+'\n'+pass+'\n'+zone;
    if(net.putString("settings",settings)==0 || net.getString("settings")!=settings){net.end();portalServer.send(500,"text/plain","Could not save settings. Try again.");return;}
    net.end();networkName=ssid;networkPassword=pass;timezoneRule=zone;
    portalServer.send(200,"text/html","<meta name='viewport' content='width=device-width,initial-scale=1'><p>Saved. Zach is connecting now. If the setup screen stays open, check your password and try again.</p>");
    startConnection();dirty=true;
  });
  portalServer.begin();dirty=true;
}
void loadNetwork() {
  Preferences net;
  if(net.begin("zachnet",true)) {
    const String settings=net.getString("settings");net.end();
    const int first=settings.indexOf('\n'),second=settings.indexOf('\n',first+1);
    if(first>0&&second>first){networkName=settings.substring(0,first);networkPassword=settings.substring(first+1,second);timezoneRule=settings.substring(second+1);}
  }
  setenv("TZ",timezoneRule.c_str(),1);tzset();
}
void networkTick() {
  if(portalActive)portalServer.handleClient();
  if(connectionPending) {
    if(WiFi.status()==WL_CONNECTED && !clockConfigured) {
      configTzTime(timezoneRule.c_str(),"pool.ntp.org","time.nist.gov");clockConfigured=true;
    }
    if(clockConfigured && syncNotified && hasWallClock()) {
      updateCare();saveProgress();connectionPending=false;
      if(portalActive)closePortal();
      WiFi.disconnect(false);WiFi.mode(WIFI_OFF);dirty=true;
    } else if(millis()-networkStarted>45000) {
      connectionPending=false;
      if(portalActive){WiFi.disconnect(false);WiFi.mode(WIFI_AP);dirty=true;}
      else WiFi.mode(WIFI_OFF);
    }
  } else if(!portalActive && !networkName.isEmpty() && millis()-lastNetworkTry>(hasWallClock()?21600000u:300000u)) startConnection();
  if(portalActive && millis()-portalStarted>600000)closePortal();
}

void released(const TouchPoint &point,uint32_t duration) {
  if(longPressUsed)return;
  if(displayOff) {
    if(duration>350){firstWakeTap=false;return;}
    const int dx=point.x-wakePoint.x,dy=point.y-wakePoint.y;
    if(firstWakeTap && millis()-wakeTapAt<=DOUBLE_TAP_MS && dx*dx+dy*dy<=1600)screenWake();
    else {firstWakeTap=true;wakeTapAt=millis();wakePoint=point;}
    return;
  }
  lastActivity=millis();
  if(editing){editorTap(point);return;}
  if(portalActive){if(point.y>=275)closePortal();return;}
  if(point.y<30&&point.x<100){draft=avatar;editing=true;editorPage=0;editorError="";dirty=true;return;}
  if(point.y>=288 && point.x>=180){screenSleep();return;}
  if(point.y>=237 && point.y<286) {
    for(int action=0;action<5;action++){int x=5+action*47;if(point.x>=x&&point.x<x+42){act(action);return;}}
  }
  if(point.y>=75&&point.y<195&&point.x>=65&&point.x<175){
    // Tap the top of Zach's head to toggle his hat; the rest of him is a love tap.
    if(point.y<122&&point.x>=84&&point.x<156){
      const uint8_t previousHat=avatar.hat;avatar.hat=avatar.hat?0:1;
      if(!avatarStore.save(avatar)){avatar.hat=previousHat;saveFailed=true;}
      soundPlay(6,avatar.sound);speech=avatar.hat?"hat on. very dashing <3":"hat off. still handsome <3";speechAt=millis();dirty=true;return;
    }
    act(1);
  }
}
void setup() {
  Serial.begin(115200);
  pinMode(LCD_BL,OUTPUT);digitalWrite(LCD_BL,LOW);
  SPI.begin(LCD_SCLK,LCD_MISO,LCD_MOSI,LCD_CS);lcd.begin(40000000);lcd.setRotation(0);lcd.invertDisplay(true);
  frame.setTextWrap(false);
  pinMode(TOUCH_RST,OUTPUT);digitalWrite(TOUCH_RST,LOW);delay(10);digitalWrite(TOUCH_RST,HIGH);delay(200);
  pinMode(TOUCH_INT,INPUT_PULLUP);Wire.begin(TOUCH_SDA,TOUCH_SCL,400000);Wire.setTimeOut(20);
  Wire.beginTransmission(TOUCH_ADDRESS);touchReady=Wire.endTransmission()==0;
  pinMode(BATTERY_ADC,INPUT);analogReadResolution(12);analogSetPinAttenuation(BATTERY_ADC,ADC_11db);
  sntp_set_time_sync_notification_cb([](struct timeval *){syncNotified=true;});
  avatar=avatarStore.load();soundBegin();
  loadProgress();lastCareMicros=esp_timer_get_time();saveProgress();readBattery();loadNetwork();
  lastActivity=millis();lastMinute=lastActivity;
  if(networkName.isEmpty())startPortal();else startConnection();
  render();digitalWrite(LCD_BL,HIGH);
  Serial.println("Zachagotchi 0.3.0 / FNK0104B");
}
void loop() {
  updateCare();networkTick();
  TouchPoint point;
  if(readTouch(point)) {
    lastPoint=point;
    if(!touchDown){touchDown=true;pressedAt=millis();pressPoint=point;longPressUsed=false;}
    if(!displayOff)lastActivity=millis();
    if(!displayOff&&!portalActive&&!editing&&!longPressUsed&&pressPoint.y<28&&pressPoint.x<160&&millis()-pressedAt>3000){longPressUsed=true;startPortal();}
  } else if(touchDown) {touchDown=false;released(lastPoint,millis()-pressedAt);}
  const uint32_t now=millis();
  if(!displayOff&&!portalActive&&now-lastActivity>=IDLE_MS)screenSleep();
  if(now-lastCheckpoint>=300000) {saveProgress();lastCheckpoint=now;}
  if(!displayOff && now-lastBatteryRead>=30000)readBattery();
  if(!displayOff && now-lastMinute>=60000){lastMinute=now;dirty=true;}
  if(dirty)render();
  else if(!displayOff&&!portalActive&&!editing&&!zach.sleeping&&now-lastBob>=900){lastBob=now;bob^=1;room();flush(0,69,240,126);}
  delay(displayOff?20:15);
}
