#include <Arduino.h>
#include <Wire.h>
#include <ESP_I2S.h>
#include <atomic>
#include "src/codec/es8311.h"
#include "sound.h"
#include "sound-notes.h"
// Freenove FNK0104AB official music wiring; amplifier is active LOW.
static I2SClass output;
static QueueHandle_t queue=nullptr;
static std::atomic<uint32_t> generation{0};
static bool ready=false;
struct Effect { int id; uint32_t generation; };
static void soundTask(void *) {
  Effect effect; int16_t pcm[256*2];
  for(;;){
    if(xQueueReceive(queue,&effect,portMAX_DELAY)!=pdTRUE)continue;
    digitalWrite(1,LOW);
    for(int note=0;note<4 && soundNotes[effect.id][note];note++) {
      const int hz=soundNotes[effect.id][note];
      for(int base=0;base<1440 && generation.load()==effect.generation;base+=256){
        const int count=min(256,1440-base);
        for(int i=0;i<count;i++){
          const int n=base+i,env=min(80,min(n, max(0,1280-n)));
          const int16_t sample=(((2*n*hz/16000)&1)?1:-1)*4000*env/80;
          pcm[2*i]=pcm[2*i+1]=sample;
        }
        size_t written=0;
        if(i2s_channel_write(output.txChan(),pcm,count*4,&written,100)!=ESP_OK){generation.fetch_add(1);break;}
      }
    }
    memset(pcm,0,sizeof(pcm));size_t written=0;i2s_channel_write(output.txChan(),pcm,sizeof(pcm),&written,100);
    vTaskDelay(pdMS_TO_TICKS(30));digitalWrite(1,HIGH);
  }
}
void soundBegin(){
  pinMode(1,OUTPUT);digitalWrite(1,HIGH);
  Wire.beginTransmission(0x18);if(Wire.endTransmission()!=0)return;
  output.setPins(5,7,8,6,4);
  if(!output.begin(I2S_MODE_STD,16000,I2S_DATA_BIT_WIDTH_16BIT,I2S_SLOT_MODE_STEREO))return;
  es8311_handle_t codec=es8311_create(I2C_NUM_0,ES8311_ADDRESS_0);
  if(!codec){output.end();return;}
  const es8311_clock_config_t clock={false,false,true,16000*256,16000};
  const bool ok=es8311_init(codec,&clock,ES8311_RESOLUTION_16,ES8311_RESOLUTION_16)==ESP_OK && es8311_voice_volume_set(codec,85,nullptr)==ESP_OK;
  es8311_delete(codec);
  if(!ok){output.end();return;}
  queue=xQueueCreate(1,sizeof(Effect));
  if(!queue){output.end();return;}
  if(xTaskCreate(soundTask,"zach-sound",3072,nullptr,1,nullptr)!=pdPASS){vQueueDelete(queue);queue=nullptr;output.end();return;}
  ready=true;
}
void soundPlay(int effect,bool enabled){
  if(!ready||!enabled||effect<0||effect>7)return;
  Effect command{effect,generation.fetch_add(1)+1};xQueueOverwrite(queue,&command);
}
void soundStop(){generation.fetch_add(1);if(queue)xQueueReset(queue);}
bool soundAvailable(){return ready;}
