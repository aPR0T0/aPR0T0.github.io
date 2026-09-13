// Integrated collector12 host: classic ESP32-WROOM-32 (noPSRAM).
// Detector J3: 1 PGND, 2 HOST_VIO input from ESP32 3.3V, 3 GPIO17 TX, 4 GPIO16 RX,
// 5 GPIO32 HV_ENABLE, 6 GPIO33 PGM_RELEASE, 7 GPIO34 HV_FAULT_N, 8 PGND.
// Scan GPIO18/23/27; blank GPIO25. FAULT_N requires board pull-up to HOST_VIO.
// LocalATmega ownsADS1115I2C; noI2C/copperbypass acrossFCOMboundary.
// b=enablebiaswithbeamblanked; z=darkzeroatsettledbias; s=start; x=abort/biasoff.
// Set theboardtrimmer onlywhilebeamblanked; measureFCOMwithratedequipment.
// Allfaults/abortremovebiaspower andclampcommand0. Thisisnotcertifiedinterlock.
// Fixed100M/10pF,±0.256V,128SPS. Onboard optocoupler UART adds ~7.3ms per request/reply pair.
// Idle/startup PING every500ms; missing reply after100ms removes bias and zero validity.
// This running-software watchdog cannot detect a hung ESP32 or replace a hardware interlock.
#include <Arduino.h>
#include <SPI.h>
#include "CollectorLink.h"
#include <math.h>
#include <limits.h>
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error Select the classic ESP32 board profile and verify its pins.
#endif

constexpr uint16_t RESOLUTION = 32;
constexpr uint32_t DWELL_US = 20000;
constexpr double SCAN_AMPLITUDE_V = 20;
constexpr uint8_t SCAN_MODE = 0;
constexpr uint32_t SETTLE_US = 5000;
constexpr uint32_t RETRACE_US = 80;
constexpr double DAC_VREF_V = 2.5;
constexpr double AMPLIFIER_GAIN = 100;
constexpr uint32_t DAC_MODEL = 80502;
constexpr uint8_t DAC_BITS = 16;
constexpr uint8_t ADC_BITS = 16;
constexpr uint32_t SPI_HZ = 1000000;
constexpr uint8_t PIN_MOSI = 23;
constexpr uint8_t PIN_SCK = 18;
constexpr uint8_t PIN_CS = 27;
constexpr uint8_t PIN_BLANK = 25;
constexpr uint8_t CURRENT_DETECTOR = 1;
constexpr float CURRENT_RF_MOHM = 100.000000f;
constexpr float CURRENT_CF_PF = 10.000000f;
constexpr uint16_t ADS_RATE_SPS = 128;
constexpr float ADS_RANGE_V = 0.256000f;
constexpr uint8_t ADC_SAMPLES = 1;
constexpr float CURRENT_GAIN_CORRECTION = 1.000000f;
constexpr uint8_t PIN_LINK_RX = 16;
constexpr uint8_t PIN_LINK_TX = 17;
constexpr uint8_t PIN_HV_ENABLE = 32;
constexpr uint8_t PIN_PGM_RELEASE = 33;
constexpr uint8_t PIN_HV_FAULT_N = 34; // Input-only pin; external 10k pull-up, no internal pull-up.
#if defined(BOARD_HAS_PSRAM)
#error Use an ESP32-WROOM target withoutPSRAM; GPIO16/17are opticalUART.
#endif
static_assert(ADS_RATE_SPS==128 && ADS_RANGE_V==.256f,"Localcollector firmware fixed128SPS/±0.256V");

static_assert(ADC_BITS == 16 && DAC_BITS == 16, "ADS1115 / selected DAC resolution");
static_assert(DAC_MODEL == 80502, "Regenerate firmware when changing DAC model/protocol");
static_assert(DAC_VREF_V == 2.5f, "DAC80502 configured output span is 2.5 V");
constexpr uint32_t DAC_LEVELS = 1UL << DAC_BITS;
static_assert(RESOLUTION >= 2 && RESOLUTION <= 512, "Resolution 2..512");
static_assert(SCAN_MODE <= 3, "Choose a supported scan mode");
static_assert(SCAN_AMPLITUDE_V >= 0 && SCAN_AMPLITUDE_V <=
  DAC_VREF_V * AMPLIFIER_GAIN * (0.5f - 1.0f/DAC_LEVELS), "DAC range exceeded");
constexpr bool uniqueSignalPins() {
  const uint8_t p[] = {PIN_MOSI,PIN_SCK,PIN_CS,PIN_BLANK,PIN_LINK_RX,PIN_LINK_TX,PIN_HV_ENABLE,PIN_PGM_RELEASE,PIN_HV_FAULT_N};
  for (uint8_t i=0;i<sizeof(p);++i) for (uint8_t j=i+1;j<sizeof(p);++j) if(p[i]==p[j]) return false;
  return true;
}
static_assert(uniqueSignalPins(), "OpticalUART/DAC/blanker/control pin collision");
static_assert(ADC_SAMPLES >= 1 && ADC_SAMPLES <= 64, "ADC samples 1..64");
static_assert(ADS_RATE_SPS==8 || ADS_RATE_SPS==16 || ADS_RATE_SPS==32 || ADS_RATE_SPS==64 ||
              ADS_RATE_SPS==128 || ADS_RATE_SPS==250 || ADS_RATE_SPS==475 || ADS_RATE_SPS==860,
              "Unsupported ADS1115 conversion rate");
static_assert(ADS_RANGE_V==.256f || ADS_RANGE_V==.512f || ADS_RANGE_V==1.024f ||
              ADS_RANGE_V==2.048f || ADS_RANGE_V==4.096f || ADS_RANGE_V==6.144f,
              "Unsupported ADS1115 PGA range");
static_assert(CURRENT_RF_MOHM>=1 && CURRENT_RF_MOHM<=1000 && CURRENT_CF_PF>=1 && CURRENT_CF_PF<=1000,
              "Rf/Cf constants must match fitted prototype components");
static_assert(CURRENT_GAIN_CORRECTION>=.5f && CURRENT_GAIN_CORRECTION<=2.0f,
              "Check measured gain correction");
constexpr uint8_t ADS_ADDRESS = 0x48;
constexpr int32_t BLANK_SAMPLE = INT32_MIN;
constexpr double TAU = 6.28318530717958647692;
SPIClass scanSPI(VSPI);
int32_t samples[RESOLUTION];
uint32_t frameNumber = 0;
bool armed = false, calibrated = false, stopRequested = false;
bool zeroRequested = false, calibrating = false;
float zeroCode = 0;
HardwareSerial collectorSerial(2);
CollectorLink::Parser linkParser;
CollectorLink::BiasSequence bias;
uint32_t nextRequestId=0;
constexpr uint32_t LINK_TIMEOUT_MS=100;
constexpr uint32_t IDLE_PING_INTERVAL_MS=500;
uint32_t lastLinkReplyMs=0;
bool faultInputReady=false,hvFaultLatched=false,hvFaultResetting=false;
bool biasRequested=false;
void applyBiasPins(){digitalWrite(PIN_PGM_RELEASE,bias.release?HIGH:LOW);digitalWrite(PIN_HV_ENABLE,bias.power?HIGH:LOW);}
void biasOff(){bias.stop();applyBiasPins();biasRequested=false;calibrated=false;}
bool checkHvFault();


struct ScanPoint { float x; float y; bool blank; };
ScanPoint pointAt(uint32_t i); // explicit prototype for Arduino preprocessing

// Programmable trajectory. C++ edits here require a real firmware build;
// for immediate browser feedback, use the separate JavaScript path editor.
ScanPoint pointAt(uint32_t i) {
  const uint32_t count = uint32_t(RESOLUTION) * RESOLUTION;
  const uint16_t row = i / RESOLUTION;
  const uint16_t col = i % RESOLUTION;
  const double t = double(i) / (count - 1);
  if (SCAN_MODE == 2) {
    const double r = sqrt(t);
    const double turns = fmax(2.0, RESOLUTION / 4.0);
    return {float(r * cos(TAU * turns * t)), float(r * sin(TAU * turns * t)), false};
  }
  if (SCAN_MODE == 3) {
    return {float(sin(TAU * 7 * t)), float(sin(TAU * 8 * t + TAU / 4)), false};
  }
  const uint16_t x = (SCAN_MODE == 1 && (row & 1)) ? RESOLUTION - 1 - col : col;
  return {float(2.0 * x / (RESOLUTION - 1) - 1),
          float(2.0 * row / (RESOLUTION - 1) - 1), false};
}

uint16_t toDac(float normalized) {
  if (!isfinite(normalized)) normalized = 0;
  normalized = fmaxf(-1.0f, fminf(1.0f, normalized));
  const double dacVolts = DAC_VREF_V / 2 + double(normalized) * SCAN_AMPLITUDE_V / AMPLIFIER_GAIN;
  // Vout = configured full-scale voltage * code / 2^DAC_BITS.
  // Exact zero deflection is code 32768 (DAC80502) or 2048 (MCP4922).
  // Double intermediates avoid extra float rounding near a half-code boundary.
  const long code = lround(dacVolts / DAC_VREF_V * DAC_LEVELS);
  return uint16_t(constrain(code, 0L, long(DAC_LEVELS - 1)));
}

void writeDacRegister(uint8_t reg, uint16_t value) {
  // TI section 8.5: 24-bit packet, address first, data MSB first; sample falling edges.
  digitalWrite(PIN_CS, LOW);
  scanSPI.transfer(reg & 0x0F);
  scanSPI.transfer(uint8_t(value >> 8));
  scanSPI.transfer(uint8_t(value));
  digitalWrite(PIN_CS, HIGH);
  delayMicroseconds(1); // SYNC-high margin between separate register packets.
}

void writeXY(float x, float y) {
  scanSPI.beginTransaction(SPISettings(SPI_HZ, MSBFIRST, SPI_MODE1));
  writeDacRegister(0x08, toDac(x)); // A buffer: X, output held.
  writeDacRegister(0x09, toDac(y)); // B buffer: Y, output held.
  writeDacRegister(0x05, 0x0010); // Software LDAC: update both outputs together.
  scanSPI.endTransaction();
}

void initializeScanDac() {
  // Beam must remain blanked. SPI has no readback, so verify voltages on bench.
  scanSPI.beginTransaction(SPISettings(SPI_HZ, MSBFIRST, SPI_MODE1));
  writeDacRegister(0x04, 0x0103); // REF_DIV=1, BUFF_A/B_GAIN=1 (2x each).
  writeDacRegister(0x03, 0x0000); // Internal reference enabled; outputs powered.
  writeDacRegister(0x02, 0x0003); // A/B synchronous; broadcast updates disabled.
  scanSPI.endTransaction();
  writeXY(0, 0); // Both outputs = 1.25 V nominal after software LDAC.
  delay(100); // Blanked startup: reference, 1.25 V center RC and scan amplifiers.
}


void readCommands() {
  checkHvFault();
  while (Serial.available()) {
    const char command = char(Serial.read());
    if (command == 'x') {
      biasOff();
      stopRequested = true; armed = false; zeroRequested = false;
      digitalWrite(PIN_BLANK, HIGH);
    } else if (command == 'b') {
      biasOff();biasRequested=true;stopRequested=true;armed=false;zeroRequested=false;digitalWrite(PIN_BLANK,HIGH);
    } else if (command == 'z') {
      if(!bias.ready()){Serial.println("# Enable/settle bias with b before z.");continue;}
      stopRequested = true; armed = false; zeroRequested = true;
      digitalWrite(PIN_BLANK, HIGH);
    } else if (command == 's') {
      if (bias.ready() && calibrated && !calibrating && !zeroRequested) {
        stopRequested = false; armed = true;
      } else Serial.println("# ZERO REQUIRED: blank beam, then send z before s.");
    }
  }
}

bool waitResponsive(uint32_t duration) {
  const uint32_t start = micros();
  while (uint32_t(micros() - start) < duration) {
    readCommands();
    if (stopRequested) return false;
    delayMicroseconds(100);
    if (duration > 2000) yield();
  }
  return true;
}

bool detectorFailure(const char *message) {
  biasOff();
  digitalWrite(PIN_BLANK, HIGH);
  armed = false; calibrated = false; stopRequested = true; zeroRequested = false;
  Serial.print("# DETECTOR ERROR: "); Serial.println(message);
  return false;
}

bool checkHvFault() {
  if(!faultInputReady||hvFaultResetting||digitalRead(PIN_HV_FAULT_N)!=LOW)return false;
  if(!hvFaultLatched)detectorFailure("HV power fault latched (overcurrent/reverse/thermal); correct cause, then b to reset and rearm.");
  else {digitalWrite(PIN_BLANK,HIGH);biasOff();armed=false;stopRequested=true;zeroRequested=false;}
  hvFaultLatched=true;
  return true;
}

bool linkExchange(uint8_t type,uint8_t expected,int16_t &raw) {
  if(checkHvFault())return false;
  // Clear any complete oldbytes; IDs still reject a delayed oldresponse.
  while(collectorSerial.available())collectorSerial.read();
  linkParser.reset();const uint32_t id=++nextRequestId;
  uint8_t packet[CollectorLink::FRAME_SIZE];
  CollectorLink::encode({type,id,0,CollectorLink::OK},packet);
  collectorSerial.write(packet,sizeof(packet));
  const uint32_t start=millis();
  while(uint32_t(millis()-start)<LINK_TIMEOUT_MS){
    readCommands();if(stopRequested)return false;
    CollectorLink::Frame reply;
    while(collectorSerial.available())if(linkParser.push(uint8_t(collectorSerial.read()),reply)){
      if(reply.type!=expected||reply.id!=id)continue;
      if(reply.status!=CollectorLink::OK)return detectorFailure("Local ADC fault/clipping");
      lastLinkReplyMs=millis();raw=reply.value;return true;
    }
    delay(1);yield();
  }
  return detectorFailure("Optical UART timeout/invalid or stale packet");
}
bool readFreshAdc(int16_t &sample){return linkExchange(CollectorLink::REQUEST,CollectorLink::REPLY,sample);}
void startBias(){
  biasOff();armed=false;stopRequested=false;digitalWrite(PIN_BLANK,HIGH);
  // Explicit b is the only rearm. Keep EN low and clamp active for >=20ms:
  // TPS2553-1 fault deassertion is deglitched; do not reject the reset interval.
  hvFaultResetting=true;
  const bool resetComplete=waitResponsive(20000);
  hvFaultResetting=false;
  if(!resetComplete)return;
  if(checkHvFault()){Serial.println("# HV fault remains after 20ms reset; bias remains off.");return;}
  hvFaultLatched=false;
  int16_t probe=0;if(!linkExchange(CollectorLink::PING,CollectorLink::PONG,probe))return;
  bias.start(millis());applyBiasPins();
  while(!bias.ready()){
    readCommands();if(stopRequested){biasOff();return;}
    // Keep link-loss shutdown responsive during the 10s settling policy.
    // No sample exchange runs concurrently with this sequential startup loop.
    if(uint32_t(millis()-lastLinkReplyMs)>=IDLE_PING_INTERVAL_MS &&
       !linkExchange(CollectorLink::PING,CollectorLink::PONG,probe))return;
    bias.tick(millis());applyBiasPins();delay(1);yield();
  }
  // Verify the local island still responds after applying common-modebias.
  if(!linkExchange(CollectorLink::PING,CollectorLink::PONG,probe))return;
  Serial.println("# Bias enabled; 10s settling policy complete (unmeasured). Measure FCOM/settling; keep trimmer fixed; z=blank/dark zero.");
}

bool acquirePixel(int32_t &result) {
  const uint32_t start = micros();
  int32_t sum = 0;
  for (uint8_t i = 0; i < ADC_SAMPLES; ++i) {
    int16_t raw;
    if (!readFreshAdc(raw)) return false;
    if (raw <= -32760 || raw >= 32760) return detectorFailure("ADC clipped: widen range or reduce beam/current gain");
    if (fabsf((raw - zeroCode) * (ADS_RANGE_V / 32768.0f) / (10.0f / 40.2f)) >= 4.0f)
      return detectorFailure("TIA working range exceeded: reduce beam or Rf");
    sum += raw;
  }
  const uint32_t slowClockWindow = uint32_t(ceilf(ADC_SAMPLES * 1000000.0f / (.9f * ADS_RATE_SPS)));
  const uint32_t window = DWELL_US > slowClockWindow ? DWELL_US : slowClockWindow;
  const uint32_t elapsed = uint32_t(micros() - start);
  if (elapsed < window && !waitResponsive(window - elapsed)) return false;
  // Q8 corrected ADC counts retain fractional-count averages in signed int32.
  // BLANK_SAMPLE is distinct from every possible measurement, including negatives.
  result = int32_t(lroundf((float(sum) / ADC_SAMPLES - zeroCode) * 256.0f));
  return true;
}

float sampleCurrentPA(int32_t q8) {
  if (q8 == BLANK_SAMPLE) return NAN;
  const float lsb = ADS_RANGE_V / 32768.0f;
  return -(float(q8) / 256.0f) * lsb * 1e6f /
         ((10.0f / 40.2f) * CURRENT_RF_MOHM * CURRENT_GAIN_CORRECTION);
}

void calibrateZero() {
  zeroRequested = false; stopRequested = false; armed = false;
  calibrated = false; calibrating = true;
  digitalWrite(PIN_BLANK, HIGH);
  // z asserts the blanker; verify the external blanker actually removes beam.
  if (!waitResponsive(SETTLE_US + 50000UL)) { calibrating = false; return; }
  int32_t sum = 0;
  for (uint8_t i = 0; i < 32; ++i) {
    int16_t raw;
    if (!readFreshAdc(raw)) { calibrating = false; return; }
    if (raw <= -32760 || raw >= 32760) {
      detectorFailure("Zero is clipped; check wiring/range"); calibrating = false; return;
    }
    sum += raw;
  }
  zeroCode = float(sum) / 32.0f;
  calibrated = true; calibrating = false;
  Serial.print("# ZERO ADC counts: "); Serial.println(zeroCode, 6);
  Serial.println("# READY: s=start, x=abort, z=blank and recalibrate.");
}

void setup() {
  digitalWrite(PIN_PGM_RELEASE,LOW);pinMode(PIN_PGM_RELEASE,OUTPUT);
  digitalWrite(PIN_HV_ENABLE,LOW);pinMode(PIN_HV_ENABLE,OUTPUT);
  biasOff();
  digitalWrite(PIN_BLANK, HIGH); pinMode(PIN_BLANK, OUTPUT);
  digitalWrite(PIN_CS, HIGH); pinMode(PIN_CS, OUTPUT);
  // No physical LDAC signal for DAC80502; GPIO26 is unused.
  Serial.begin(921600);
  pinMode(PIN_HV_FAULT_N,INPUT);faultInputReady=true;checkHvFault();
  scanSPI.begin(PIN_SCK, -1, PIN_MOSI, PIN_CS);
  collectorSerial.begin(CollectorLink::BAUD,SERIAL_8N1,PIN_LINK_RX,PIN_LINK_TX);
  delay(100); // Allow supply/reference startup while the beam remains blank.
  initializeScanDac();
  checkHvFault();
  Serial.println("# COLLECTOR: b=bias on blanked; z=zero; s=start after zero; x=abort/bias OFF.");
  Serial.println("# CUR1 packets: uint32 magic, frame, first, count; then int32 Q8 corrected ADC counts.");
}

void loop() {
  readCommands();
  if (biasRequested) { startBias(); return; }
  if (zeroRequested) { calibrateZero(); return; }
  if (!armed) {
    digitalWrite(PIN_BLANK, HIGH);
    // Only issue an idle probe here, outside acquisition/calibration exchanges.
    // Every successful exchange refreshes the deadline. An invalid/absent PONG
    // takes the same fault path as a missing sample and invalidates dark zero.
    if (bias.ready() && uint32_t(millis()-lastLinkReplyMs)>=IDLE_PING_INTERVAL_MS) {
      int16_t probe=0;
      linkExchange(CollectorLink::PING,CollectorLink::PONG,probe);
    }
    delay(5); return;
  }
  const uint32_t count = uint32_t(RESOLUTION) * RESOLUTION;
  for (uint32_t first = 0; first < count && armed; first += RESOLUTION) {
    for (uint16_t j = 0; j < RESOLUTION && armed; ++j) {
      readCommands(); if (!armed) break;
      const ScanPoint point = pointAt(first + j);
      digitalWrite(PIN_BLANK, HIGH); writeXY(point.x, point.y);
      if (first + j == 0 || (SCAN_MODE == 0 && j == 0)) {
        if (!waitResponsive(RETRACE_US)) break;
      }
      if (point.blank || !isfinite(point.x) || !isfinite(point.y) || fabsf(point.x)>1 || fabsf(point.y)>1) {
        samples[j] = BLANK_SAMPLE; continue;
      }
      digitalWrite(PIN_BLANK, LOW);
      // The TIA must settle after exposure begins, not only during blanking.
      if (!waitResponsive(SETTLE_US) || !acquirePixel(samples[j])) break;
      digitalWrite(PIN_BLANK, HIGH);
    }
    digitalWrite(PIN_BLANK, HIGH);
    if (!armed) break; // discard a partial row after abort/fault
    const uint32_t header[4] = {0x31525543, frameNumber, first, RESOLUTION}; // CUR1
    Serial.write(reinterpret_cast<const uint8_t*>(header), sizeof(header));
    Serial.write(reinterpret_cast<const uint8_t*>(samples), sizeof(samples));
    Serial.flush(); delay(1); // transport overhead is blanked
  }
  digitalWrite(PIN_BLANK, HIGH); writeXY(0, 0); ++frameNumber;
}
