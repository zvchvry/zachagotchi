#pragma once
#include <Preferences.h>
#include <stddef.h>
#include <string.h>
// head is a reserved compatibility byte; all rendering uses Classic.
struct Avatar { char name[13]="zach";uint8_t hair=0,beard=0,head=1,shirt=0,pants=0,hat=0,sound=1; };
struct AvatarRecord {uint32_t magic=0x41564154,version=1;uint64_t sequence=0;Avatar value;uint32_t checksum=0;};
inline bool validAvatar(const Avatar &p){
 const size_t n=strnlen(p.name,13);if(n==0||n>12||p.name[0]==' '||p.name[n-1]==' ')return false;
 for(size_t i=0;i<n;i++){char c=p.name[i];if(!((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c==' '||c=='\''||c=='-'))return false;}
 return p.hair<6&&p.beard<5&&p.head<3&&p.shirt<4&&p.pants<4&&p.hat<=1&&p.sound<=1;
}
inline uint32_t avatarHash(const AvatarRecord &r){const uint8_t *p=(const uint8_t*)&r;uint32_t h=2166136261u;for(size_t i=0;i<offsetof(AvatarRecord,checksum);i++)h=(h^p[i])*16777619u;return h;}
class AvatarStore {
 Preferences prefs;uint64_t sequence=0;int slot=-1;bool ready=false;
 bool read(const char *key,AvatarRecord &r){return prefs.getBytesLength(key)==sizeof(r)&&prefs.getBytes(key,&r,sizeof(r))==sizeof(r)&&r.magic==0x41564154&&r.version==1&&r.sequence>0&&validAvatar(r.value)&&r.checksum==avatarHash(r);}
 public:
 Avatar load(){ready=prefs.begin("zachavatar",false);AvatarRecord a{},b{};bool goodA=ready&&read("a",a),goodB=ready&&read("b",b);if(goodA||goodB){slot=goodB&&(!goodA||b.sequence>a.sequence)?1:0;auto &r=slot?b:a;sequence=r.sequence;Avatar loaded=r.value;loaded.head=1;return loaded;}return Avatar{};}
 bool save(const Avatar &p){if(!ready||!validAvatar(p))return false;AvatarRecord r{},verify{};r.sequence=sequence+1;r.value=p;r.value.head=1;r.checksum=avatarHash(r);int next=slot==0?1:0;const char *key=next?"b":"a";if(prefs.putBytes(key,&r,sizeof(r))!=sizeof(r)||!read(key,verify)||memcmp(&r,&verify,sizeof(r)))return false;sequence=r.sequence;slot=next;return true;}
};
