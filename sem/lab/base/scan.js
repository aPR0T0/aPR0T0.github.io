/** Scan trajectories, bounded browser programming, and an ESP32 firmware sketch. */
export const PRESETS = Object.freeze([
  { id: 'raster', label: 'Raster', description: 'Left to right rows; blanked horizontal retrace in hardware.' },
  { id: 'serpentine', label: 'Serpentine', description: 'Alternate row direction to reduce horizontal flyback.' },
  { id: 'spiral', label: 'Spiral', description: 'Center outward, equal-area radial schedule; covers a disk.' },
  { id: 'lissajous', label: 'Lissajous', description: 'A smooth 7:8 sine trajectory; repeated crossings leave unsampled gaps.' },
]);

const MAX_RESOLUTION = 512;
const TWO_PI = 2 * Math.PI;
const MODES = PRESETS.map((preset) => preset.id);

function checkResolution(resolution) {
  if (!Number.isInteger(resolution) || resolution < 2 || resolution > MAX_RESOLUTION) {
    throw new RangeError(`Resolution must be an integer from 2 to ${MAX_RESOLUTION}.`);
  }
  return resolution;
}

/** All built-in points are acquired; blanked transport occurs between points. */
export function scanPoint(index, resolution = 128, mode = 'raster') {
  const n = checkResolution(resolution);
  if (!Number.isFinite(index)) throw new TypeError('Scan index must be finite.');
  const count = n * n;
  const i = ((Math.floor(index) % count) + count) % count;
  const row = Math.floor(i / n);
  const column = i % n;
  const t = i / (count - 1);
  if (mode === 'raster' || mode === 'serpentine') {
    const xIndex = mode === 'serpentine' && row % 2 ? n - 1 - column : column;
    return { x: 2 * xIndex / (n - 1) - 1, y: 2 * row / (n - 1) - 1, blank: false };
  }
  if (mode === 'spiral') {
    const radius = Math.sqrt(t);
    const angle = TWO_PI * Math.max(2, n / 4) * t;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle), blank: false };
  }
  if (mode === 'lissajous') {
    return { x: Math.sin(TWO_PI * 7 * t), y: Math.sin(TWO_PI * 8 * t + Math.PI / 2), blank: false };
  }
  throw new RangeError(`Unknown scan mode “${mode}”. Use ${MODES.join(', ')} or compile a custom program.`);
}

export const DEFAULT_PROGRAM = `// i: sample index; n: pixels per side; t: i / (n*n - 1)
// Return normalized coordinates in [-1, 1]. blank:true skips exposure.
// This function is evaluated once per point in a time-limited worker.
const row = Math.floor(i / n);
const col = i % n;
const x = row % 2 ? n - 1 - col : col;
return {
  x: 2 * x / (n - 1) - 1,
  y: 2 * row / (n - 1) - 1,
  blank: false
};`;

/** Compile the whole path outside the UI thread, and transfer a packed buffer. */
export async function compileProgram(source, { resolution = 128, timeout = 1200 } = {}) {
  checkResolution(resolution);
  if (typeof source !== 'string' || !source.trim()) throw new TypeError('Enter a scan function body.');
  if (source.length > 24000) throw new RangeError('Keep the scan program below 24,000 characters.');
  if (!Number.isFinite(timeout) || timeout < 50 || timeout > 10000) {
    throw new RangeError('Worker timeout must be between 50 and 10,000 ms.');
  }
  if (typeof Worker === 'undefined') throw new Error('Custom programs require a browser with Web Worker support.');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./scan-worker.js', import.meta.url), { type: 'module' });
    let done = false;
    const finish = (error, result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      if (error) reject(error);
      else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error(`Scan program exceeded ${timeout} ms and was stopped. Check for an infinite loop or reduce complexity.`)), timeout);
    worker.onmessage = ({ data }) => {
      if (data?.error) return finish(new Error(data.error));
      const count = resolution * resolution;
      if (!(data?.points instanceof Float32Array) || data.count !== count || data.points.length !== count * 3) {
        return finish(new Error('Scan worker returned an invalid path.'));
      }
      // Validate after transfer as well; user code runs in the worker global scope.
      for (let j = 0; j < data.points.length; j += 3) {
        const x = data.points[j], y = data.points[j + 1], blank = data.points[j + 2];
        if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1 || Math.abs(y) > 1 || (blank !== 0 && blank !== 1)) {
          return finish(new Error(`Invalid coordinates at sample ${j / 3}.`));
        }
      }
      finish(null, { points: data.points, count });
    };
    worker.onerror = (event) => finish(new Error(event.message || 'Could not run the scan worker.'));
    worker.postMessage({ source, resolution });
  });
}

export const FIRMWARE_DEFAULTS = Object.freeze({
  resolution: 128, dwell: 40, scanAmplitude: 20, scanMode: 'raster',
  settle: 8, retrace: 80, dacReference: 3.3, amplifierGain: 100,
  dacBits: 12, adcBits: 12, spiHz: 8000000,
  mosi: 23, sck: 18, cs: 27, ldac: 26, adc: 34, blankPin: 25,
});

const CONFIG_FIELDS = [
  ['RESOLUTION', 'resolution', 'uint16_t'], ['DWELL_US', 'dwell', 'uint32_t'],
  ['SCAN_AMPLITUDE_V', 'scanAmplitude', 'float'], ['SCAN_MODE', 'scanMode', 'uint8_t'],
  ['SETTLE_US', 'settle', 'uint32_t'], ['RETRACE_US', 'retrace', 'uint32_t'],
  ['DAC_VREF_V', 'dacReference', 'float'], ['AMPLIFIER_GAIN', 'amplifierGain', 'float'],
  ['DAC_BITS', 'dacBits', 'uint8_t'], ['ADC_BITS', 'adcBits', 'uint8_t'],
  ['SPI_HZ', 'spiHz', 'uint32_t'], ['PIN_MOSI', 'mosi', 'uint8_t'],
  ['PIN_SCK', 'sck', 'uint8_t'], ['PIN_CS', 'cs', 'uint8_t'],
  ['PIN_LDAC', 'ldac', 'uint8_t'], ['PIN_ADC', 'adc', 'uint8_t'],
  ['PIN_BLANK', 'blankPin', 'uint8_t'],
];

function validateConfig(config) {
  const errors = [], warnings = [];
  const range = (key, lo, hi, integral = false) => {
    if (!Number.isFinite(config[key]) || config[key] < lo || config[key] > hi || (integral && !Number.isInteger(config[key]))) {
      errors.push(`${CONFIG_FIELDS.find((field) => field[1] === key)?.[0] || key} must be ${integral ? 'an integer ' : ''}from ${lo} to ${hi}.`);
    }
  };
  range('resolution', 2, MAX_RESOLUTION, true);
  range('dwell', 20, 100000, true);
  range('settle', 5, 10000, true);
  range('retrace', 0, 100000, true);
  range('scanAmplitude', 0, 1000);
  range('dacReference', 0.1, 3.3);
  range('amplifierGain', 1, 1000);
  range('spiHz', 100000, 20000000, true);
  range('adcBits', 9, 12, true);
  if (config.dacBits !== 12) errors.push('DAC_BITS must be 12 for the MCP4922 protocol.');
  if (!MODES.includes(config.scanMode)) errors.push('SCAN_MODE must be 0 raster, 1 serpentine, 2 spiral, or 3 lissajous. Custom JavaScript is preview-only; port its trajectory to C++ separately.');
  const outputPins = ['mosi', 'sck', 'cs', 'ldac', 'blankPin'];
  const availableOutputs = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33];
  for (const pin of outputPins) if (!availableOutputs.includes(config[pin])) errors.push(`${pin} must be an output-capable classic ESP32 GPIO, excluding flash pins.`);
  if (![32, 33, 34, 35, 36, 39].includes(config.adc)) errors.push('PIN_ADC must be an exposed ADC1 pin: 32, 33, 34, 35, 36, or 39.');
  const pins = [...outputPins.map((key) => config[key]), config.adc];
  if (new Set(pins).size !== pins.length) errors.push('Pin assignments overlap; give each signal a separate GPIO.');
  if (pins.some((pin) => [0, 2, 5, 12, 15].includes(pin))) warnings.push('A selected GPIO is a boot strapping pin. Its external level must preserve the board boot configuration.');
  if (pins.some((pin) => [1, 3].includes(pin))) errors.push('GPIO1 and GPIO3 are reserved for the serial image transport in this sketch.');
  if (pins.some((pin) => [16, 17].includes(pin))) warnings.push('GPIO16/17 can be occupied by PSRAM on ESP32-WROVER boards. Check your module.');
  const maxAmplitude = config.dacReference * config.amplifierGain * (0.5 - 1 / 4096);
  if (config.scanAmplitude > maxAmplitude) errors.push(`SCAN_AMPLITUDE_V exceeds ±${maxAmplitude.toFixed(2)} V for this DAC reference and amplifier gain.`);
  else if (config.scanAmplitude > (config.dacReference / 2 - 0.05) * config.amplifierGain) warnings.push('DAC output approaches a supply rail. Leave headroom and verify amplifier clipping on the actual circuit.');
  if (config.dwell < 40) warnings.push('Dwell is only the minimum beam-on interval. SPI, ADC conversion, settling and transport add time; measure timing on hardware.');
  if (config.settle < 8) warnings.push('The DAC typical settling specification is 4.5 µs under its stated test conditions. Amplifiers and cables may need longer.');
  return { errors, warnings };
}

/** Generate an editable bench prototype, never connect a GPIO/DAC directly to HV. */
export function generateFirmware(values = {}) {
  const config = { ...FIRMWARE_DEFAULTS, ...values };
  if (typeof config.scanMode === 'number') config.scanMode = MODES[config.scanMode];
  const { errors } = validateConfig(config);
  if (errors.length) throw new Error(errors.join('\n'));
  const constants = CONFIG_FIELDS.map(([symbol, key, type]) => {
    const value = key === 'scanMode' ? MODES.indexOf(config[key]) : config[key];
    const literal = type === 'float' ? `${Number(value).toFixed(6)}f` : String(value);
    return `constexpr ${type} ${symbol} = ${literal};`;
  }).join('\n');
  return `// Simple electron microscope | low-voltage scan controller prototype
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
${constants}

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
`;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function normalizedStructure(source) {
  let result = stripComments(source);
  for (const [symbol] of CONFIG_FIELDS) {
    result = result.replace(new RegExp(`(\\bconstexpr\\s+(?:uint(?:8|16|32)_t|int|unsigned(?:\\s+int)?|float|double|auto)\\s+${symbol}\\s*=\\s*)[^;]+;`, 'g'), '$1VALUE;');
  }
  return result.replace(/\s+/g, '');
}

/** Parse literals without eval; arbitrary C++ is never executed in the browser. */
export function parseFirmwareConfig(source) {
  const config = { ...FIRMWARE_DEFAULTS };
  const errors = [], warnings = [];
  if (typeof source !== 'string' || source.length > 200000) {
    return { config, errors: ['Enter a firmware sketch below 200,000 characters.'], warnings };
  }
  const clean = stripComments(source);
  for (const [symbol, key] of CONFIG_FIELDS) {
    const declarations = [...clean.matchAll(new RegExp(`\\bconstexpr\\s+(?:uint(?:8|16|32)_t|int|unsigned(?:\\s+int)?|float|double|auto)\\s+${symbol}\\s*=\\s*([^;]+);`, 'g'))];
    if (!declarations.length) { errors.push(`Missing supported constexpr assignment for ${symbol}.`); continue; }
    if (declarations.length > 1) { errors.push(`${symbol} is defined more than once.`); continue; }
    const literal = declarations[0][1].trim();
    const namedMode = literal.toLowerCase().replace(/^["']|["']$/g, '');
    if (key === 'scanMode' && MODES.includes(namedMode)) {
      errors.push('SCAN_MODE must be a numeric literal: 0 raster, 1 serpentine, 2 spiral, 3 lissajous.');
      continue;
    }
    if (!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:f|u|ul|ull|l|ll)?|0x[\da-f]+(?:u|ul|ull|l|ll)?)$/i.test(literal)) {
      errors.push(`${symbol} must use a simple numeric literal; expressions and function calls are not evaluated.`);
      continue;
    }
    const number = /^[-+]?0x/i.test(literal) ? Number.parseInt(literal.replace(/[uUlL]+$/, ''), 16) : Number(literal.replace(/[fFuUlL]+$/, ''));
    config[key] = key === 'scanMode' ? MODES[number] : number;
  }
  const validation = validateConfig(config);
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);
  if (!errors.length) {
    if (normalizedStructure(source) !== normalizedStructure(generateFirmware(config))) {
      warnings.push('C++ logic or structure has changed. The browser applies the listed configuration values only; algorithm and I/O edits require a firmware build and are not simulated.');
    }
  }
  warnings.push('Preview reads configuration constants only; this page does not compile, flash, or connect to an ESP32.');
  return { config, errors, warnings };
}

export const CONFIG_HINTS = Object.freeze([
  {
    title: 'ESP32 pin map',
    body: 'Classic ESP32: SPI clock 18, MOSI 23; this sketch uses CS 27 and LDAC 26. Other ESP32 variants need a different board profile and verified pins.',
    url: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/api/spi.html',
  },
  {
    title: 'Dual DAC and plate voltage',
    body: 'MCP4922 is 12 bit. At gain 1, VDAC = Vref × code / 4096. The external amplifier model subtracts Vref/2, then multiplies by its differential gain. Both channels latch together through LDAC.',
    url: 'https://ww1.microchip.com/downloads/en/DeviceDoc/22250A.pdf#page=19',
  },
  {
    title: 'Timing and dwell',
    body: 'MCP4922 typical settling is 4.5 µs for the datasheet step and load. SETTLE_US must include amplifier response. Dwell is a minimum beam-on wait; ADC, retrace and serial transport make the real frame longer than N² × dwell.',
    url: 'https://ww1.microchip.com/downloads/en/DeviceDoc/22250A.pdf#page=4',
  },
  {
    title: 'Condition the detector signal',
    body: 'GPIO34 is ADC1 input. Use a buffered detector output with the correct bias and range. ESP32 at 11 dB attenuation measures approximately 0.15–3.1 V; analogRead gives uncalibrated codes, and nominal 12-bit resolution is not 12-bit accuracy.',
    url: 'https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html',
  },
  {
    title: 'Blanking and module selection',
    body: 'GPIO25 requests an external beam blanker. Keep blanking asserted during boot and flyback. GPIO34–39 are input only; GPIO6–11 are normally used for flash. Check module pin restrictions before rewiring.',
    url: 'https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf',
  },
]);
