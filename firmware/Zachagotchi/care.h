#pragma once
#include <stdint.h>
#include <stddef.h>
#include <math.h>
#include <string.h>
struct CareState {
  double ageSeconds=0;
  double pendingSeconds=0; // Powered elapsed time since the last known wall clock.
  int64_t lastEpoch=0;
  double food=80, love=90, energy=75;
  uint32_t plays=0;
  uint8_t sleeping=0;
};
struct SaveRecord {
  uint32_t magic=0x5a414348;
  uint32_t version=1;
  uint64_t sequence=0;
  CareState state;
  uint32_t checksum=0;
};
inline uint32_t recordHash(const SaveRecord &record) {
  const uint8_t *data=reinterpret_cast<const uint8_t *>(&record);
  uint32_t hash=2166136261u;
  for(size_t i=0;i<offsetof(SaveRecord,checksum);i++) hash=(hash^data[i])*16777619u;
  return hash;
}
inline bool validRecord(const SaveRecord &r) {
  const CareState &s=r.state;
  return r.magic==0x5a414348 && r.version==1 && r.sequence>0 && r.checksum==recordHash(r)
    && isfinite(s.ageSeconds) && s.ageSeconds>=0 && isfinite(s.pendingSeconds) && s.pendingSeconds>=0
    && s.lastEpoch>=0 && s.sleeping<=1
    && isfinite(s.food) && s.food>=15 && s.food<=100
    && isfinite(s.love) && s.love>=20 && s.love<=100
    && isfinite(s.energy) && s.energy>=15 && s.energy<=100;
}
inline void advanceCare(CareState &s,double seconds) {
  if(!isfinite(seconds) || seconds<=0) return;
  const double hours=seconds/3600.0;
  s.ageSeconds+=seconds;
  s.food=fmax(15,s.food-hours*3);
  s.love=fmax(20,s.love-hours*2);
  s.energy=fmax(15,fmin(100,s.energy+hours*(s.sleeping?18:-2)));
}
inline void careAction(CareState &s,int action) {
  if(action==3) { s.sleeping=!s.sleeping; return; }
  if(s.sleeping) return;
  if(action==0) s.food=fmin(100,s.food+20);
  if(action==1) s.love=fmin(100,s.love+15);
  if(action==2) { s.love=fmin(100,s.love+10);s.energy=fmax(15,s.energy-8);s.plays++; }
  if(action==4) s.energy=fmin(100,s.energy+20);
}
