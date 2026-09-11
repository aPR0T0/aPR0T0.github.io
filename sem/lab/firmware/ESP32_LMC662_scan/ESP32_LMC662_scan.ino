// LMC662 specimen-current detector | CURRENT_DETECTOR firmware prototype
// Classic ESP32, DAC80502 16-bit scan DAC, ADS1115 at 3.3 V / address 0x48.
// DAC80502: VDD 3.3 V, SPI2C LOW, RSTSEL LOW, internal 2.5 V reference.
// VREFIO needs >=150 nF bypass, not an external voltage source.
// REF_DIV=1 and buffer gains=2 give a 2.5 V output span; center = 1.25 V.
// Vplate = AMPLIFIER_GAIN * (Vdac - 1.25 V), using an external scan amplifier.
// SYNC pin is CS GPIO27; software LDAC replaces the old GPIO26 wire.
// Power-on default gain may trigger a reference alarm. Keep beam blanked
// until initialization and measured settling are complete; SPI has no readback.
// Electrode -> guarded LMC662 TIA (±5 V) -> attenuating conditioner -> ADS A0.
// ADS A1 = 1.65 V; A0 = 1.648358 - (10/40.2)*VTIA. Neither input may be negative.
// Specimen is near chamber ground. Never connect the gun HV to this board.
// SDA/SCL pullups use detector 3.3 V. Share ground; do not power ESP32 from REF3V3.
// ADS ALERT/RDY is UNCONNECTED here: GPIO27 already serves the scan DAC CS.
// Keep an external pullup and independent interlock on the physical beam blanker.
// PIN_ADC is retained for old configuration files but is UNUSED by this sketch.
// DWELL_US is the minimum acquisition window AFTER analog settling, not a wait
// added before conversion. Fresh single-shot conversions run inside that window.
// Rf/Cf constants document fitted components, not electronic gain switching.
// Sources: https://www.ti.com/lit/ds/symlink/lmc662.pdf
// https://www.ti.com/lit/ds/symlink/ads1115.pdf
// https://www.ti.com/lit/ds/symlink/dac80502.pdf (sections 8.5, 8.6, 9.5)
// https://docs.espressif.com/projects/arduino-esp32/en/latest/api/i2c.html

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <math.h>
#include <limits.h>
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error Select the classic ESP32 board profile and verify its pins.
#endif

constexpr uint16_t RESOLUTION = 32;
constexpr uint32_t DWELL_US = 10000;
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
constexpr uint8_t PIN_ADC = 34;
constexpr uint8_t PIN_BLANK = 25;
constexpr uint8_t CURRENT_DETECTOR = 1;
constexpr float CURRENT_RF_MOHM = 100.000000f;
constexpr float CURRENT_CF_PF = 10.000000f;
constexpr uint16_t ADS_RATE_SPS = 128;
constexpr float ADS_RANGE_V = 0.256000f;
constexpr uint8_t ADC_SAMPLES = 1;
constexpr float CURRENT_GAIN_CORRECTION = 1.000000f;
constexpr uint8_t PIN_SDA = 21;
constexpr uint8_t PIN_SCL = 22;

static_assert(ADC_BITS == 16 && DAC_BITS == 16, "ADS1115 / selected DAC resolution");
static_assert(DAC_MODEL == 80502, "Regenerate firmware when changing DAC model/protocol");
static_assert(DAC_VREF_V == 2.5f, "DAC80502 configured output span is 2.5 V");
constexpr uint32_t DAC_LEVELS = 1UL << DAC_BITS;
static_assert(RESOLUTION >= 2 && RESOLUTION <= 512, "Resolution 2..512");
static_assert(SCAN_MODE <= 3, "Choose a supported scan mode");
static_assert(SCAN_AMPLITUDE_V >= 0 && SCAN_AMPLITUDE_V <=
  DAC_VREF_V * AMPLIFIER_GAIN * (0.5f - 1.0f/DAC_LEVELS), "DAC range exceeded");
constexpr bool uniqueSignalPins() {
  const uint8_t p[] = {PIN_MOSI,PIN_SCK,PIN_CS,PIN_BLANK,PIN_SDA,PIN_SCL};
  for (uint8_t i=0;i<sizeof(p);++i) for (uint8_t j=i+1;j<sizeof(p);++j) if(p[i]==p[j]) return false;
  return true;
}
static_assert(uniqueSignalPins(), "I2C/DAC/blanker pin collision");
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
  while (Serial.available()) {
    const char command = char(Serial.read());
    if (command == 'x') {
      stopRequested = true; armed = false; zeroRequested = false;
      digitalWrite(PIN_BLANK, HIGH);
    } else if (command == 'z') {
      stopRequested = true; armed = false; zeroRequested = true;
      digitalWrite(PIN_BLANK, HIGH);
    } else if (command == 's') {
      if (calibrated && !calibrating && !zeroRequested) {
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
  digitalWrite(PIN_BLANK, HIGH);
  armed = false; calibrated = false; stopRequested = true;
  Serial.print("# DETECTOR ERROR: "); Serial.println(message);
  return false;
}

bool writeAdsRegister(uint8_t reg, uint16_t value) {
  Wire.beginTransmission(ADS_ADDRESS);
  Wire.write(reg); Wire.write(uint8_t(value >> 8)); Wire.write(uint8_t(value));
  if (Wire.endTransmission() != 0) return detectorFailure("I2C write NACK");
  return true;
}

bool readAdsRegister(uint8_t reg, uint16_t &value) {
  Wire.beginTransmission(ADS_ADDRESS); Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return detectorFailure("I2C register NACK");
  if (Wire.requestFrom(ADS_ADDRESS, uint8_t(2)) != 2) return detectorFailure("I2C short read");
  value = (uint16_t(Wire.read()) << 8) | uint16_t(Wire.read());
  return true;
}

uint16_t adsConfigWord() {
  uint16_t pga = ADS_RANGE_V > 5 ? 0 : ADS_RANGE_V > 3 ? 1 :
                 ADS_RANGE_V > 1.5 ? 2 : ADS_RANGE_V > .75 ? 3 :
                 ADS_RANGE_V > .3 ? 4 : 5;
  uint16_t rate = ADS_RATE_SPS == 8 ? 0 : ADS_RATE_SPS == 16 ? 1 :
                  ADS_RATE_SPS == 32 ? 2 : ADS_RATE_SPS == 64 ? 3 :
                  ADS_RATE_SPS == 128 ? 4 : ADS_RATE_SPS == 250 ? 5 :
                  ADS_RATE_SPS == 475 ? 6 : 7;
  // OS=1 starts NEW conversion; MUX=000 is differential A0-A1;
  // MODE=1 is single-shot; comparator disabled. No continuous stale samples.
  return 0x8000 | (pga << 9) | 0x0100 | (rate << 5) | 0x0003;
}

bool waitAdcReady() {
  const uint32_t start = micros();
  const uint32_t timeout = 3000UL + 2000000UL / ADS_RATE_SPS;
  while (true) {
    readCommands();
    if (stopRequested) return false;
    uint16_t status;
    if (!readAdsRegister(1, status)) return false;
    if (status & 0x8000) break;
    if (uint32_t(micros() - start) > timeout) return detectorFailure("ADC ready timeout");
    delayMicroseconds(100); yield();
  }
  return true;
}

bool readFreshAdc(int16_t &sample) {
  // An abort may leave a previous single-shot conversion running. Wait for it
  // to end and discard its result BEFORE requesting this pixel's conversion.
  if (!waitAdcReady()) return false;
  if (!writeAdsRegister(1, adsConfigWord())) return false;
  if (!waitAdcReady()) return false;
  uint16_t raw;
  if (!readAdsRegister(0, raw)) return false;
  sample = int16_t(raw); // preserve negative differential voltage
  return true;
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
  digitalWrite(PIN_BLANK, HIGH); pinMode(PIN_BLANK, OUTPUT);
  digitalWrite(PIN_CS, HIGH); pinMode(PIN_CS, OUTPUT);
  // No physical LDAC signal for DAC80502; GPIO26 is unused.
  Serial.begin(921600);
  scanSPI.begin(PIN_SCK, -1, PIN_MOSI, PIN_CS);
  Wire.begin(PIN_SDA, PIN_SCL); Wire.setClock(100000); Wire.setTimeOut(20);
  delay(100); // Allow supply/reference startup while the beam remains blank.
  initializeScanDac();
  Serial.println("# CURRENT DETECTOR: z=blank/zero; s=start after zero; x=abort.");
  Serial.println("# CUR1 packets: uint32 magic, frame, first, count; then int32 Q8 corrected ADC counts.");
}

void loop() {
  readCommands();
  if (zeroRequested) { calibrateZero(); return; }
  if (!armed) { digitalWrite(PIN_BLANK, HIGH); delay(5); return; }
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
