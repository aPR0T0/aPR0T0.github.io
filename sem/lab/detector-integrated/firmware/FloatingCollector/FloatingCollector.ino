// Collector12 local acquisition controller, ATmega328P-PU, 3.3V / external8MHz.
// Arduino AVR core>=1.8.6; select an8MHz ATmega328P target (MiniCore or equivalent).
// PCB physicalpins2/3 RX/TX;27/28 SDA/SCL;8/22 FCOM. No USB/programmer whenbiased.
// Uses the adjacent CollectorLink.h; the package export copies the sharedheader here.
#include <Arduino.h>
#include <Wire.h>
#include "CollectorLink.h"
#if !defined(__AVR_ATmega328P__) || F_CPU != 8000000UL
#error Select ATmega328P with external8MHz clock. Verify fuses and3.3V target supply.
#endif
using namespace CollectorLink;
constexpr uint8_t ADC_ADDRESS=0x48;
constexpr uint16_t ADC_CONFIG=0x8b83; // OS1,A0-A1,PGA±0.256,one-shot,128SPS,comparatoroff.
Parser parser;
void send(const Frame &f){uint8_t b[FRAME_SIZE];encode(f,b);Serial.write(b,FRAME_SIZE);}
bool writeRegister(uint8_t reg,uint16_t value){
  Wire.clearWireTimeoutFlag();Wire.beginTransmission(ADC_ADDRESS);
  Wire.write(reg);Wire.write(uint8_t(value>>8));Wire.write(uint8_t(value));
  return Wire.endTransmission()==0&&!Wire.getWireTimeoutFlag();
}
bool readRegister(uint8_t reg,uint16_t &value){
  Wire.clearWireTimeoutFlag();Wire.beginTransmission(ADC_ADDRESS);Wire.write(reg);
  if(Wire.endTransmission(false)!=0||Wire.getWireTimeoutFlag())return false;
  if(Wire.requestFrom(ADC_ADDRESS,uint8_t(2))!=2||Wire.getWireTimeoutFlag())return false;
  value=(uint16_t(Wire.read())<<8)|uint16_t(Wire.read());return true;
}
uint8_t waitReady(){
  const uint32_t start=millis();
  for(;;){
    uint16_t config;
    if(!readRegister(1,config))return I2C_ERROR;
    if(config&0x8000)return OK;
    if(uint32_t(millis()-start)>=25)return ADC_TIMEOUT;
    delay(1);
  }
}
uint8_t acquire(int16_t &value){
  // Finish/discard any interrupted conversion before launching the requested one.
  uint8_t status=waitReady();if(status!=OK)return status;
  if(!writeRegister(1,ADC_CONFIG))return I2C_ERROR;
  status=waitReady();if(status!=OK)return status;
  uint16_t raw;if(!readRegister(0,raw))return I2C_ERROR;
  value=int16_t(raw);return(value<=-32760||value>=32760)?CLIPPED:OK;
}
void setup(){Serial.begin(BAUD);Wire.begin();Wire.setClock(100000);Wire.setWireTimeout(25000,true);delay(200);}
void loop(){
  Frame request;
  while(Serial.available())if(parser.push(uint8_t(Serial.read()),request)){
    if(request.status!=OK||request.value!=0)continue;
    if(request.type==PING){send({PONG,request.id,0,OK});continue;}
    if(request.type!=REQUEST)continue;
    int16_t raw=0;const uint8_t status=acquire(raw);send({REPLY,request.id,raw,status});
  }
}
