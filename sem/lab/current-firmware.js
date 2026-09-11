import { FIRMWARE_DEFAULTS, generateFirmware, parseFirmwareConfig, normalizeFirmwareValues } from './scan.js';

export const CURRENT_FIRMWARE_DEFAULTS = Object.freeze({
  ...FIRMWARE_DEFAULTS, dwell: 10000, settle: 5000, adcBits: 16,
  currentRf: 100, currentCf: 10, currentADCRate: 128, currentADCRange: .256,
  currentSamples: 1, currentGainCorrection: 1, sda: 21, scl: 22,
});
const EXTRA_FIELDS = [
  ['CURRENT_DETECTOR', 'currentDetector', 'uint8_t'],
  ['CURRENT_RF_MOHM', 'currentRf', 'float'], ['CURRENT_CF_PF', 'currentCf', 'float'],
  ['ADS_RATE_SPS', 'currentADCRate', 'uint16_t'], ['ADS_RANGE_V', 'currentADCRange', 'float'],
  ['ADC_SAMPLES', 'currentSamples', 'uint8_t'], ['CURRENT_GAIN_CORRECTION', 'currentGainCorrection', 'float'],
  ['PIN_SDA', 'sda', 'uint8_t'], ['PIN_SCL', 'scl', 'uint8_t'],
];
const cleanSource = (source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const literal = /^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:f|u|ul|ull|l|ll)?|0x[\da-f]+(?:u|ul|ull|l|ll)?)$/i;
const number = (value) => /^[-+]?0x/i.test(value) ? parseInt(value.replace(/[uUlL]+$/, ''), 16) : Number(value.replace(/[fFuUlL]+$/, ''));
const legacyCompatible = (config) => ({ ...config, adcBits: 12 });

function currentValidation(config) {
  const errors = [], warnings = [];
  if (config.currentDetector !== 1) errors.push('CURRENT_DETECTOR must be 1 for the LMC662/ADS1115 sketch.');
  if (config.adcBits !== 16) errors.push('ADC_BITS must be 16 for the ADS1115. PIN_ADC remains an unused legacy compatibility constant.');
  for (const [key, min, max, integer] of [['currentRf', 1, 1000], ['currentCf', 1, 1000], ['currentSamples', 1, 64, true], ['currentGainCorrection', .5, 2]]) {
    if (!Number.isFinite(config[key]) || config[key] < min || config[key] > max || (integer && !Number.isInteger(config[key]))) errors.push(`${key} must be ${integer ? 'an integer ' : ''}from ${min} to ${max}.`);
  }
  if (![8,16,32,64,128,250,475,860].includes(config.currentADCRate)) errors.push('ADS_RATE_SPS must be 8, 16, 32, 64, 128, 250, 475, or 860.');
  if (![.256,.512,1.024,2.048,4.096,6.144].includes(config.currentADCRange)) errors.push('ADS_RANGE_V must be .256, .512, 1.024, 2.048, 4.096, or 6.144.');
  const outputs = [0,2,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33];
  if (!outputs.includes(config.sda) || !outputs.includes(config.scl)) errors.push('I²C SDA/SCL require output-capable classic ESP32 GPIOs, excluding flash and serial pins.');
  const pins = [config.mosi,config.sck,config.cs,...(config.dacModel === 4922 ? [config.ldac] : []),config.blankPin,config.sda,config.scl];
  if (new Set(pins).size !== pins.length) errors.push('I²C, DAC and blanker GPIO assignments overlap. In particular, default GPIO27 belongs to DAC CS; do not connect ADS ALERT there.');
  const settle = -Math.log(.01) * config.currentRf * config.currentCf;
  if (config.settle < settle) warnings.push(`SETTLE_US is below the ideal 1% TIA step settling time (${Math.ceil(settle)} µs). Measure the actual chain and increase it.`);
  const acquisition = Math.ceil(config.currentSamples * 1e6 / (.9 * config.currentADCRate));
  if (config.dwell < acquisition) warnings.push(`Fresh ADC conversions require at least ${acquisition} µs including slow-clock allowance; firmware extends the acquisition window.`);
  warnings.push('ADS1115 ALERT/RDY is unconnected in the default scan rig; firmware polls the OS ready bit over I²C.');
  warnings.push('Rf/Cf constants describe fitted components. They do not switch physical resistors or capacitors. Zero and gain calibration do not guarantee pA sensitivity.');
  return { errors, warnings };
}

/** Editable prototype; shares scan trajectories and the selected DAC protocol. */
export function generateCurrentFirmware(values = {}) {
  const config = { ...CURRENT_FIRMWARE_DEFAULTS, ...normalizeFirmwareValues(values), currentDetector: 1, adcBits: 16 };
  const validation = currentValidation(config);
  if (validation.errors.length) throw new Error(validation.errors.join('\n'));
  const base = generateFirmware(legacyCompatible(config));
  const constants = base.slice(base.indexOf('constexpr uint16_t RESOLUTION'), base.indexOf('\n\nstatic_assert'))
    .replace(/(constexpr uint8_t ADC_BITS = )12;/, '$116;');
  const extra = EXTRA_FIELDS.map(([symbol,key,type]) => `constexpr ${type} ${symbol} = ${type === 'float' ? `${Number(config[key]).toFixed(6)}f` : config[key]};`).join('\n');
  const trajectoryAndDac = base.slice(base.indexOf('struct ScanPoint'), base.indexOf('\nvoid delayUs'))
    .replace('struct ScanPoint { float x; float y; bool blank; };', 'struct ScanPoint { float x; float y; bool blank; };\nScanPoint pointAt(uint32_t i); // explicit prototype for Arduino preprocessing');
  return `// LMC662 specimen-current detector | CURRENT_DETECTOR firmware prototype
// Classic ESP32, ${config.dacModel === 80502 ? 'DAC80502 16-bit' : 'MCP4922 12-bit'} scan DAC, ADS1115 at 3.3 V / address 0x48.
${config.dacModel === 80502 ? `// DAC80502: VDD 3.3 V, SPI2C LOW, RSTSEL LOW, internal 2.5 V reference.
// VREFIO needs >=150 nF bypass, not an external voltage source.
// REF_DIV=1 and buffer gains=2 give a 2.5 V output span; center = 1.25 V.
// Vplate = AMPLIFIER_GAIN * (Vdac - 1.25 V), using an external scan amplifier.
// SYNC pin is CS GPIO27; software LDAC replaces the old GPIO26 wire.
// Power-on default gain may trigger a reference alarm. Keep beam blanked
// until initialization and measured settling are complete; SPI has no readback.` : `// MCP4922 uses external DAC_VREF_V and physical LDAC GPIO26.
// Vplate = AMPLIFIER_GAIN * (Vdac - DAC_VREF_V/2).`}
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
// ${config.dacModel === 80502 ? 'https://www.ti.com/lit/ds/symlink/dac80502.pdf (sections 8.5, 8.6, 9.5)' : 'https://ww1.microchip.com/downloads/en/DeviceDoc/22250A.pdf'}
// https://docs.espressif.com/projects/arduino-esp32/en/latest/api/i2c.html

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <math.h>
#include <limits.h>
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error Select the classic ESP32 board profile and verify its pins.
#endif

${constants}
${extra}

static_assert(ADC_BITS == 16 && DAC_BITS == ${config.dacBits}, "ADS1115 / selected DAC resolution");
static_assert(DAC_MODEL == ${config.dacModel}, "Regenerate firmware when changing DAC model/protocol");
${config.dacModel === 80502 ? 'static_assert(DAC_VREF_V == 2.5f, "DAC80502 configured output span is 2.5 V");' : ''}
constexpr uint32_t DAC_LEVELS = 1UL << DAC_BITS;
static_assert(RESOLUTION >= 2 && RESOLUTION <= 512, "Resolution 2..512");
static_assert(SCAN_MODE <= 3, "Choose a supported scan mode");
static_assert(SCAN_AMPLITUDE_V >= 0 && SCAN_AMPLITUDE_V <=
  DAC_VREF_V * AMPLIFIER_GAIN * (0.5f - 1.0f/DAC_LEVELS), "DAC range exceeded");
constexpr bool uniqueSignalPins() {
  const uint8_t p[] = {PIN_MOSI,PIN_SCK,PIN_CS,${config.dacModel === 4922 ? 'PIN_LDAC,' : ''}PIN_BLANK,PIN_SDA,PIN_SCL};
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

${trajectoryAndDac}

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
${config.dacModel === 4922 ? '  digitalWrite(PIN_LDAC, HIGH); pinMode(PIN_LDAC, OUTPUT);' : '  // No physical LDAC signal for DAC80502; GPIO26 is unused.'}
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
`;
}

/** Parses current or legacy firmware; never executes C++ from the editor. */
export function parseCurrentFirmwareConfig(source) {
  if (typeof source !== 'string' || !/\bCURRENT_DETECTOR\b/.test(cleanSource(source))) return parseFirmwareConfig(source);
  if (source.length > 200000) return { config: {...CURRENT_FIRMWARE_DEFAULTS}, errors: ['Enter a firmware sketch below 200,000 characters.'], warnings: [] };
  const clean = cleanSource(source);
  // Preserve all of the established legacy field/pin/range checks. ADC_BITS is
  // validated separately because this architecture uses a different ADC.
  const adapted = source.replace(/(\bconstexpr\s+\w+\s+ADC_BITS\s*=\s*)[^;]+;/g, '$112;');
  const result = parseFirmwareConfig(adapted);
  result.warnings = result.warnings.filter((warning) => !warning.startsWith('C++ logic or structure has changed.'));
  const adc = [...clean.matchAll(/\bconstexpr\s+\w+\s+ADC_BITS\s*=\s*([^;]+);/g)];
  result.config.adcBits = adc.length === 1 && literal.test(adc[0][1].trim()) ? number(adc[0][1].trim()) : NaN;
  for (const [symbol,key] of EXTRA_FIELDS) {
    const assignments = [...clean.matchAll(new RegExp(`\\bconstexpr\\s+\\w+\\s+${symbol}\\s*=\\s*([^;]+);`, 'g'))];
    if (assignments.length !== 1) { result.errors.push(`${symbol} must have exactly one supported constexpr assignment.`); continue; }
    const value = assignments[0][1].trim();
    if (!literal.test(value)) { result.errors.push(`${symbol} must use a simple numeric literal; expressions are not evaluated.`); continue; }
    result.config[key] = number(value);
  }
  const checks = currentValidation(result.config);
  result.errors.push(...checks.errors); result.warnings.push(...checks.warnings);
  if (!result.errors.length) {
    const legacyNames = ['RESOLUTION','DWELL_US','SCAN_AMPLITUDE_V','SCAN_MODE','SETTLE_US','RETRACE_US','DAC_VREF_V','AMPLIFIER_GAIN','DAC_MODEL','DAC_BITS','ADC_BITS','SPI_HZ','PIN_MOSI','PIN_SCK','PIN_CS','PIN_LDAC','PIN_ADC','PIN_BLANK'];
    const supportedNames = [...legacyNames, ...EXTRA_FIELDS.map(([name]) => name)].join('|');
    const normalize = (text) => cleanSource(text).replace(new RegExp(`(\\bconstexpr\\s+\\w+\\s+(?:${supportedNames})\\s*=)[^;]+;`, 'g'), '$1VALUE;').replace(/\s+/g, '');
    if (normalize(source) !== normalize(generateCurrentFirmware(result.config))) result.warnings.push('C++ logic changed. Preview applies configuration constants only; build and review the real firmware before use.');
  }
  return result;
}
