#pragma once
#include <stdint.h>
#include <stddef.h>
namespace CollectorLink {
constexpr size_t FRAME_SIZE=14;
constexpr uint32_t BAUD=38400;
enum Type:uint8_t { REQUEST=1, REPLY=2, PING=3, PONG=4 };
enum Status:uint8_t { OK=0, I2C_ERROR=1, ADC_TIMEOUT=2, CLIPPED=4 };
struct Frame { uint8_t type; uint32_t id; int16_t value; uint8_t status; };
inline uint16_t crc16(const uint8_t *p,size_t n) {
  uint16_t crc=0xffff;
  while(n--) { crc^=uint16_t(*p++)<<8;for(uint8_t bit=0;bit<8;bit++)crc=uint16_t((crc&0x8000)?(crc<<1)^0x1021:crc<<1); }
  return crc;
}
inline void encode(const Frame &f,uint8_t out[FRAME_SIZE]) {
  out[0]=0xa5;out[1]=0x5a;out[2]=1;out[3]=f.type;
  for(uint8_t i=0;i<4;i++)out[4+i]=uint8_t(f.id>>(8*i));
  out[8]=uint8_t(f.value);out[9]=uint8_t(uint16_t(f.value)>>8);
  out[10]=f.status;out[11]=0;
  const uint16_t c=crc16(out,12);out[12]=uint8_t(c);out[13]=uint8_t(c>>8);
}
inline bool decode(const uint8_t in[FRAME_SIZE],Frame &f) {
  if(in[0]!=0xa5||in[1]!=0x5a||in[2]!=1||in[11]!=0||in[3]<REQUEST||in[3]>PONG) return false;
  if(crc16(in,12)!=(uint16_t(in[12])|(uint16_t(in[13])<<8)))return false;
  f.type=in[3];f.id=0;for(uint8_t i=0;i<4;i++)f.id|=uint32_t(in[4+i])<<(8*i);
  f.value=int16_t(uint16_t(in[8])|(uint16_t(in[9])<<8));f.status=in[10];return true;
}
inline bool matches(const Frame &f,uint8_t type,uint32_t id) {return f.type==type&&f.id==id&&f.status==OK;}
class Parser {
  uint8_t bytes[FRAME_SIZE]{};size_t count=0;
public:
  void reset(){count=0;}
  bool push(uint8_t b,Frame &f){
    bytes[count++]=b;if(count<FRAME_SIZE)return false;
    if(decode(bytes,f)){count=0;return true;}
    for(size_t i=1;i<FRAME_SIZE;i++)bytes[i-1]=bytes[i];
    count=FRAME_SIZE-1;return false;
  }
};
// Times are unsigned elapsed durations, including millisecond-counter rollover.
class BiasSequence {
  enum Phase:uint8_t { OFF, POWER_WAIT, SETTLING, READY } phase=OFF;
  uint32_t since=0;
public:
  bool power=false,release=false;
  void start(uint32_t now){power=true;release=false;phase=POWER_WAIT;since=now;}
  void stop(){power=false;release=false;phase=OFF;}
  bool ready()const{return phase==READY;}
  void tick(uint32_t now){
    if(phase==POWER_WAIT&&uint32_t(now-since)>=100){release=true;phase=SETTLING;since=now;}
    // Initial commissioning policy, not measured settling performance. The
    // hardware qualifier/ramp and real collector capacitance must be checked.
    else if(phase==SETTLING&&uint32_t(now-since)>=10000)phase=READY;
  }
};
}
