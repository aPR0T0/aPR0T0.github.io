// Simple electron microscope | low-voltage scan controller prototype
// Target: classic ESP32 / Arduino-ESP32, external MCP4922 dual SPI DAC.
// Browser applies supported constexpr values only. It does not compile C++.
// Supply MCP4922 at 3.3 V; VREFA/VREFB use DAC_VREF_V; keep SHDN high.
// DAC A -> external X bipolar amplifier, DAC B -> external Y amplifier.
// Each amplifier must implement DIFFERENTIAL plate voltage:
// Vplate = AMPLIFIER_GAIN * (Vdac - DAC_VREF_V/2).
// The low-voltage DAC is not a plate, gun, filament, or PMT power supply.
// PIN_BLANK HIGH requests blanking through an external beam blanker.
// Use a hardware pull-up / independent interlock to remain blank during reset.
// PIN_ADC receives a buffered, conditioned detector signal (about 0.15..3.1 V).
// Never connect the PMT high-voltage node to the ESP32 ADC.
// Sources: https://ww1.microchip.com/downloads/en/DeviceDoc/22250A.pdf
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
constexpr uint32_t DWELL_US = 20;
constexpr float SCAN_AMPLITUDE_V = 20.000000f;
constexpr uint8_t SCAN_MODE = 0;
constexpr uint32_t SETTLE_US = 8;
constexpr uint32_t RETRACE_US = 80;
constexpr float DAC_VREF_V = 3.300000f;
constexpr float AMPLIFIER_GAIN = 100.000000f;
constexpr uint8_t DAC_BITS = 12;
constexpr uint8_t ADC_BITS = 12;
constexpr uint32_t SPI_HZ = 8000000;
constexpr uint8_t PIN_MOSI = 23;
constexpr uint8_t PIN_SCK = 18;
constexpr uint8_t PIN_CS = 27;
constexpr uint8_t PIN_LDAC = 26;
constexpr uint8_t PIN_ADC = 34;
constexpr uint8_t PIN_BLANK = 25;

static_assert(RESOLUTION >= 2 && RESOLUTION <= 512, "Resolution 2..512");
static_assert(DAC_BITS == 12, "MCP4922 has 12-bit data");
static_assert(ADC_BITS >= 9 && ADC_BITS <= 12, "ESP32 ADC is 9..12 bits");
static_assert(DWELL_US >= 20 && SETTLE_US >= 5, "Increase dwell/settling");
static_assert(SCAN_MODE <= 3, "Choose a supported scan mode");
static_assert(SCAN_AMPLITUDE_V >= 0 && SCAN_AMPLITUDE_V <=
  DAC_VREF_V * AMPLIFIER_GAIN * (0.5f - 1.0f/4096.0f), "DAC range exceeded");

SPIClass scanSPI(VSPI);
uint16_t samples[RESOLUTION]; // One scan chunk; no full-frame RAM required.
uint32_t frameNumber = 0;
bool armed = false;
constexpr float TAU = 6.28318530718f;

struct ScanPoint { float x; float y; bool blank; };

// Programmable trajectory. C++ edits here require a real firmware build;
// for immediate browser feedback, use the separate JavaScript path editor.
ScanPoint pointAt(uint32_t i) {
  const uint32_t count = uint32_t(RESOLUTION) * RESOLUTION;
  const uint16_t row = i / RESOLUTION;
  const uint16_t col = i % RESOLUTION;
  const float t = float(i) / (count - 1);
  if (SCAN_MODE == 2) {
    const float r = sqrtf(t);
    const float turns = fmaxf(2.0f, RESOLUTION / 4.0f);
    return {r * cosf(TAU * turns * t), r * sinf(TAU * turns * t), false};
  }
  if (SCAN_MODE == 3) {
    return {sinf(TAU * 7 * t), sinf(TAU * 8 * t + TAU / 4), false};
  }
  const uint16_t x = (SCAN_MODE == 1 && (row & 1)) ? RESOLUTION - 1 - col : col;
  return {2.0f * x / (RESOLUTION - 1) - 1,
          2.0f * row / (RESOLUTION - 1) - 1, false};
}

uint16_t toDac(float normalized) {
  if (!isfinite(normalized)) normalized = 0;
  normalized = fmaxf(-1.0f, fminf(1.0f, normalized));
  const float dacVolts = DAC_VREF_V / 2 + normalized * SCAN_AMPLITUDE_V / AMPLIFIER_GAIN;
  // MCP4922 Eq. 4-1: Vout = Vref * code / 4096 at internal gain 1x.
  const long code = lroundf(4096.0f * dacVolts / DAC_VREF_V);
  return uint16_t(constrain(code, 0L, 4095L));
}

void writeDac(uint8_t channel, uint16_t code) {
  // bit15 A/B; bit14 BUF=0; bit13 GA=1 (1x); bit12 SHDN=1 (active).
  const uint16_t word = (channel ? 0x8000 : 0) | 0x3000 | (code & 0x0FFF);
  digitalWrite(PIN_CS, LOW);
  scanSPI.transfer16(word);
  digitalWrite(PIN_CS, HIGH);
}

void writeXY(float x, float y) {
  scanSPI.beginTransaction(SPISettings(SPI_HZ, MSBFIRST, SPI_MODE0));
  // LDAC stays high while BOTH input registers are loaded.
  writeDac(0, toDac(x));
  writeDac(1, toDac(y));
  scanSPI.endTransaction();
  digitalWrite(PIN_LDAC, LOW); // Simultaneously update both output registers.
  delayMicroseconds(1);        // Datasheet minimum LDAC low pulse: 100 ns.
  digitalWrite(PIN_LDAC, HIGH);
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
  digitalWrite(PIN_LDAC, HIGH);
  pinMode(PIN_LDAC, OUTPUT);
  Serial.begin(921600);
  scanSPI.begin(PIN_SCK, -1, PIN_MOSI, PIN_CS);
  analogReadResolution(ADC_BITS);
  analogSetPinAttenuation(PIN_ADC, ADC_11db);
  pinMode(PIN_ADC, INPUT);
  writeXY(0, 0);
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
