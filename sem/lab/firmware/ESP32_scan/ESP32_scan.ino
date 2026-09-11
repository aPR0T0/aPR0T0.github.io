// Simple electron microscope | low-voltage scan controller prototype
// Target: classic ESP32 / Arduino-ESP32, external DAC80502 16-bit dual SPI DAC.
// Browser applies supported constexpr values only. It does not compile C++.
// DAC80502: VDD 3.3 V, SPI2C LOW, RSTSEL LOW, internal reference enabled.
// Bypass VREFIO to AGND with at least 150 nF; do not drive VREFIO externally.
// DAC_VREF_V is the configured OUTPUT full scale, not the 3.3 V supply.
// REF_DIV=1 and both buffer gains=2 produce a 2.5 V output span at 3.3 V VDD.
// SYNC pin is PIN_CS; there is NO physical LDAC signal or GPIO26 connection.
// Both DACs update together using the software LDAC register trigger.
// Power-on defaults may have a reference alarm until GAIN is configured.
// Keep the beam physically blanked through power-up, initialization and settling.
// DAC A -> external X bipolar amplifier, DAC B -> external Y amplifier.
// Each amplifier must implement DIFFERENTIAL plate voltage:
// Vplate = AMPLIFIER_GAIN * (Vdac - DAC_VREF_V/2).
// The low-voltage DAC is not a plate, gun, filament, or PMT power supply.
// PIN_BLANK HIGH requests blanking through an external beam blanker.
// Use a hardware pull-up / independent interlock to remain blank during reset.
// PIN_ADC receives a buffered, conditioned detector signal (about 0.15..3.1 V).
// S11141-10 BSE: diode -> compensated TIA -> buffer/filter/protection -> PIN_ADC.
// Never connect a raw diode or a detector high-voltage node to the ESP32 ADC.
// Measure TIA settling and dark baseline; browser Rf/Cf does not configure hardware.
// Sources: https://www.ti.com/lit/ds/symlink/dac80502.pdf (sections 8.5, 8.6, 9.5)
// https://docs.espressif.com/projects/arduino-esp32/en/latest/api/spi.html
// https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html

#include <Arduino.h>
#include <SPI.h>
#include <math.h>
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error This pin map targets the classic ESP32; select its board profile.
#endif

// EDIT THESE CONFIG VALUES; preview understands simple numeric literals.
// SCAN_MODE: 0 raster, 1 serpentine, 2 spiral, 3 lissajous.
// DWELL_US is minimum beam-on wait before ADC; actual period is longer.
constexpr uint16_t RESOLUTION = 128;
constexpr uint32_t DWELL_US = 500;
constexpr double SCAN_AMPLITUDE_V = 20;
constexpr uint8_t SCAN_MODE = 0;
constexpr uint32_t SETTLE_US = 8;
constexpr uint32_t RETRACE_US = 80;
constexpr double DAC_VREF_V = 2.5;
constexpr double AMPLIFIER_GAIN = 100;
constexpr uint32_t DAC_MODEL = 80502;
constexpr uint8_t DAC_BITS = 16;
constexpr uint8_t ADC_BITS = 12;
constexpr uint32_t SPI_HZ = 1000000;
constexpr uint8_t PIN_MOSI = 23;
constexpr uint8_t PIN_SCK = 18;
constexpr uint8_t PIN_CS = 27;
constexpr uint8_t PIN_ADC = 34;
constexpr uint8_t PIN_BLANK = 25;

static_assert(RESOLUTION >= 2 && RESOLUTION <= 512, "Resolution 2..512");
static_assert(DAC_MODEL == 80502, "Regenerate firmware when changing DAC model/protocol");
static_assert(DAC_BITS == 16, "DAC resolution must match the selected protocol");
static_assert(DAC_VREF_V == 2.5f, "DAC80502 configured output span is 2.5 V");
constexpr uint32_t DAC_LEVELS = 1UL << DAC_BITS;
static_assert(ADC_BITS >= 9 && ADC_BITS <= 12, "ESP32 ADC is 9..12 bits");
static_assert(DWELL_US >= 20 && SETTLE_US >= 5, "Increase dwell/settling");
static_assert(SCAN_MODE <= 3, "Choose a supported scan mode");
static_assert(SCAN_AMPLITUDE_V >= 0 && SCAN_AMPLITUDE_V <=
  DAC_VREF_V * AMPLIFIER_GAIN * (0.5f - 1.0f/DAC_LEVELS), "DAC range exceeded");

SPIClass scanSPI(VSPI);
uint16_t samples[RESOLUTION]; // One scan chunk; no full-frame RAM required.
uint32_t frameNumber = 0;
bool armed = false;
constexpr double TAU = 6.28318530717958647692;

struct ScanPoint { float x; float y; bool blank; };

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

void delayUs(uint32_t us) {
  // delay() alone is tick-aligned and can wait LESS than the requested time.
  // Yield for long intervals, then enforce the minimum using the micros clock.
  const uint32_t started = micros();
  if (us >= 2000) delay(us / 1000 - 1);
  while (true) {
    const uint32_t elapsed = uint32_t(micros() - started); // Wrap-safe.
    if (elapsed >= us) break;
    delayMicroseconds(us - elapsed);
  }
}

void readCommands() {
  while (Serial.available()) {
    const char command = char(Serial.read());
    if (command == 's') armed = true; // Start only after bench setup is verified.
    if (command == 'x') { armed = false; digitalWrite(PIN_BLANK, HIGH); }
  }
}

void setup() {
  digitalWrite(PIN_BLANK, HIGH);
  pinMode(PIN_BLANK, OUTPUT);
  digitalWrite(PIN_CS, HIGH);
  pinMode(PIN_CS, OUTPUT);
  // DAC80502 has software LDAC; GPIO26 is unused.
  Serial.begin(921600);
  scanSPI.begin(PIN_SCK, -1, PIN_MOSI, PIN_CS);
  analogReadResolution(ADC_BITS);
  analogSetPinAttenuation(PIN_ADC, ADC_11db);
  pinMode(PIN_ADC, INPUT);
  delay(100); // Allow supply and reference startup while the beam stays blank.
  initializeScanDac();
  Serial.println("READY: s=start, x=stop. Detector data follows as binary chunks.");
}

void loop() {
  readCommands();
  if (!armed) { digitalWrite(PIN_BLANK, HIGH); delay(5); return; }
  const uint32_t count = uint32_t(RESOLUTION) * RESOLUTION;
  for (uint32_t first = 0; first < count && armed; first += RESOLUTION) {
    for (uint16_t j = 0; j < RESOLUTION; ++j) {
      readCommands();
      if (!armed) break;
      const uint32_t i = first + j;
      const ScanPoint point = pointAt(i);
      digitalWrite(PIN_BLANK, HIGH);
      writeXY(point.x, point.y);
      delayUs(SETTLE_US); // DAC + amplifier settling; measure your complete chain.
      if (i == 0 || (SCAN_MODE == 0 && j == 0)) delayUs(RETRACE_US);
      if (!point.blank && isfinite(point.x) && isfinite(point.y)) {
        digitalWrite(PIN_BLANK, LOW);
        delayUs(DWELL_US);
        samples[j] = analogRead(PIN_ADC); // Point sample after detector response.
        digitalWrite(PIN_BLANK, HIGH);
      } else { samples[j] = 0xFFFF; }
    }
    digitalWrite(PIN_BLANK, HIGH);
    if (!armed) break;
    // Little-endian stream: 4 x uint32 header, then RESOLUTION x uint16 samples.
    // Header = magic 0x314D4553 ('SEM1'), frame, first sample index, count.
    // Coordinates are reconstructed with pointAt; 0xFFFF marks a blank sample.
    const uint32_t header[4] = {0x314D4553, frameNumber, first, RESOLUTION};
    Serial.write(reinterpret_cast<const uint8_t*>(header), sizeof(header));
    Serial.write(reinterpret_cast<const uint8_t*>(samples), sizeof(samples));
    Serial.flush(); // Transport pause is blanked; it adds to frame duration.
    delay(1);       // Yield between chunks; scheduler-dependent overhead.
  }
  digitalWrite(PIN_BLANK, HIGH);
  writeXY(0, 0);
  ++frameNumber;
}
