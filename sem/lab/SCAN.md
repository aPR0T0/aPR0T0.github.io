# Scan programming and detector acquisition

The default pairs the **DAC80502 dual 16-bit X/Y scan DAC** with the **LMC662 / ADS1115 specimen-current detector**. They are separate PCB assemblies: the DAC commands the external scan amplifiers, while the ADC measures the conditioned detector signal. The ESP32 controls beam position and reads a fresh differential ADC conversion at each pixel. The browser remains a procedural preview and code editor; it does not connect to the ESP32. Saved MCP4922 configurations and the original `/base/` version retain their 12-bit hardware assumptions.

## Trajectory API

`scan.js` is dependency-free with no DOM requirement:

- `PRESETS`: raster, serpentine, spiral and Lissajous definitions.
- `scanPoint(index, resolution, mode)`: normalized `{x, y, blank}`; indices wrap after resolution² samples.
- `DEFAULT_PROGRAM`: JavaScript body with `i`, `n`, and `t = i/(n*n−1)`, returning `{x,y,blank}`.
- `compileProgram(source, {resolution=128, timeout=1200})`: validated packed x/y/blank points from a disposable worker. Source, numeric bounds and resolution are checked; a timeout stops long loops without blocking animation.
- `generateFirmware` and `parseFirmwareConfig`: the ESP32 ADC1 acquisition sketch and its explicit numeric configuration parser. New sketches use DAC80502; MCP4922 is also supported.
- `CONFIG_HINTS`: component documentation and configuration explanations.

`current-firmware.js` adds `CURRENT_FIRMWARE_DEFAULTS`, `generateCurrentFirmware` and `parseCurrentFirmwareConfig`. The parser accepts current or legacy sketches without executing C++. A changed C++ algorithm is not executed by the browser: only supported constants update the preview. Port custom JavaScript to `pointAt()` and build/review the actual sketch separately.

## Scan module configuration and connections

| C++ constant | Default | Meaning |
| --- | --- | --- |
| `DAC_MODEL` | 80502 | Selected SPI protocol; legacy MCP4922 is 4922 |
| `DAC_BITS` | 16 | DAC80502 code width; independent of detector ADC width |
| `DAC_VREF_V` | 2.5 | Configured DAC output full scale, not its supply voltage |
| `AMPLIFIER_GAIN` | 100 | Assumed external differential plate-amplifier gain; must match hardware |
| `SPI_HZ` | 1000000 | 1 MHz for the module's 1 kΩ series resistors and short leads |
| `PIN_SCK` / `PIN_MOSI` / `PIN_CS` | 18 / 23 / 27 | Clock, data and DAC SYNC/chip select |
| `PIN_BLANK` | 25 | Active-high request to the external blanking interface |

There is **no physical LDAC connection** on DAC80502. GPIO26 is unused in the default sketch. Do not reuse the MCP4922 wiring or change only `DAC_BITS`: regenerate the sketch for the selected model and fit the corresponding circuit. The DAC80502 configuration requires `DAC_BITS=16` and `DAC_VREF_V=2.5`; incompatible values are rejected.

The new [scan module design](../scan-dac-pcb/README.md) uses these connectors:

| Module connector | Pin connections |
| --- | --- |
| J1 — power / ESP32 | 1 clean +3.3 V input; 2 ground; 3 GPIO18/SCLK; 4 GPIO23/MOSI; 5 GPIO27/SYNC; 6 GPIO25/BLANK |
| J2 — external scan amplifiers | 1 X output; 2 X return/ground; 3 Y output; 4 Y return/ground; 5 buffered 1.25 V center; 6 center return/ground |
| J3 — external blanker | 1 active-high BLANK; 2 ground |

DAC80502 package pins are 1 VDD, 2 VOUTA/X, 3 RSTSEL grounded, 4 AGND, 5 SPI2C grounded for SPI, 6 SCLK, 7 SYNC, 8 SDIN, 9 VOUTB/Y, and 10 VREFIO. The internal reference is enabled; VREFIO is bypassed and must not be driven by an external source. The DRX package has no central exposed pad. RSTSEL grounded gives zero-code reset, so the beam must remain blanked until configuration and centering finish. [TI DAC80502 pin functions and startup configuration](https://www.ti.com/lit/ds/symlink/dac80502.pdf#page=3).

Power the scan module and ESP32 logic from the appropriate common 3.3 V domain; do not use the LMC662 board's REF3V3 reference output as their supply or drive SPI into an unpowered module. J2 drives high-impedance external amplifier inputs, not the scanning plates directly. The external amplifiers must subtract the provided **1.25 V** center, replacing any old 1.65 V center, and their gain/offset/loading must be measured.

The generated startup keeps BLANK asserted, allows 100 ms for supply startup, then writes these separate 24-bit, MSB-first SPI mode-1 frames:

| Register | Value | Effect |
| --- | --- | --- |
| GAIN `0x04` | `0x0103` | Divide the internal reference by two; set both output buffers to gain two |
| CONFIG `0x03` | `0x0000` | Enable internal reference and both outputs |
| SYNC `0x02` | `0x0003` | Hold both output updates for software LDAC; disable unused broadcasts |
| DAC-A `0x08`, DAC-B `0x09` | `0x8000` each | Load the two midpoint codes |
| TRIGGER `0x05` | `0x0010` | Update both outputs together |

It then waits **another 100 ms while blanked** for the buffered center reference and external circuitry to stabilize before accepting scan commands. The center divider/filter has a nominal 2.5 ms time constant. This startup allowance does not replace measured pixel settling. At 3.3 V, the reset reference-divider setting can produce a reference alarm and zero output; do not infer centered beam position from reset state. SPI is write-only, so the sketch cannot confirm register readback or actual output voltage. [TI register map and initialization example](https://www.ti.com/lit/ds/symlink/dac80502.pdf#page=30).

## Current-detector configuration

| C++ constant | Default | Meaning |
| --- | --- | --- |
| `CURRENT_DETECTOR` | 1 | LMC662 / ADS1115 sketch identifier |
| `CURRENT_RF_MOHM` / `CURRENT_CF_PF` | 100 / 10 | Fitted feedback components; not electronic gain switching |
| `ADS_RANGE_V` | 0.256 | Positive magnitude of differential PGA full scale |
| `ADS_RATE_SPS` | 128 | ADC conversions per second |
| `ADC_SAMPLES` | 1 | Fresh conversions averaged for each pixel |
| `CURRENT_GAIN_CORRECTION` | 1 | Measured correction to nominal current conversion |
| `PIN_SDA` / `PIN_SCL` | 21 / 22 | I²C to the detector PCB |
| `ADC_BITS` | 16 | ADS1115 conversion width |
| `PIN_ADC` | 34 | Retained for legacy configuration compatibility; unused in current mode |
| `DWELL_US` / `SETTLE_US` | 10000 / 5000 | Acquisition window after analog settling / settling wait |

The current preset in the simulator starts with 32 × 32 pixels. PGA choices are ±0.256, ±0.512, ±1.024, ±2.048, ±4.096 and ±6.144 V, with 8, 16, 32, 64, 128, 250, 475 or 860 SPS. A wide PGA range does **not** permit either analog pin to exceed its 3.3 V supply. More averaging is a firmware operation; the model does not promise square-root noise improvement without a measured spectrum.

The ADS1115 is at I²C address `0x48`, measuring A0 minus A1. **Detector PCB** J3 pin 1 connects to ESP32 ground; pin 3 SDA to GPIO21; pin 4 SCL to GPIO22. This is separate from scan-module J3. **Leave detector J3 pin 5 ALERT/RDY unconnected:** default GPIO27 is already DAC80502 SYNC/chip select. The sketch polls the ADS1115 OS-ready bit over I²C. Detector J3 pin 2 REF3V3 is a low-current reference output, not the ESP32 supply; power the ESP32 separately through USB. I²C pull-ups use detector 3.3 V.

The current parser validates discrete ADC ranges/rates, sample counts, gain correction and GPIO uniqueness. It warns when settling is shorter than the ideal 1% RfCf estimate or when conversion time extends requested acquisition. These checks do not establish hardware stability.

## Exposure, conversion and fault handling

For each point, firmware blanks the beam, writes the two DAC commands and applies any retrace delay. It then unblanks and waits `SETTLE_US` so the exposed specimen signal can settle. Fresh single-shot conversions run **inside** the following `DWELL_US` acquisition window; there is no extra dwell delay before starting conversion. It waits for each conversion's ready bit and blanks again before transport or repositioning.

The current model uses:

```text
tpixel = tsettle + max(tdwell, Nsamples/(0.9 × SPS))
Tframe = N² tpixel + Nretrace tretrace
```

Convert units consistently; UI dwell/settling/retrace are µs. The 0.9 factor allows a 10% slow ADC clock. Raster has one retrace per row and the other paths one per frame. The default 128 SPS conversion takes approximately 7.8 ms nominally; 5 ms settling plus a 10 ms acquisition window gives a 15 ms initial pixel budget. SPI, I²C, scheduler and serial transport overhead extend real frames. A custom path includes its explicit blank points; it does not imply raster retraces.

Serial commands:

- **`z`**: disarm, assert blanking and measure 32 conversions for the zero baseline.
- **`s`**: start only after a valid zero calibration.
- **`x`**: abort and blank.

ADC I²C failures, readiness timeout or clipping abort acquisition, blank the beam and invalidate calibration. A partially acquired row is discarded. The initial pin state, external blanker pull-up and hardware interlock must be checked on the real instrument; software is not an HV safety system. Gain calibration still requires a known input current; a zero command alone does not calibrate the resistor/attenuator ratio.

## Current-mode binary stream

Current mode uses a distinct **CUR1** packet:

| Field | Type | Meaning |
| --- | --- | --- |
| Magic | little-endian uint32 | `0x31525543` |
| Frame / first sample / sample count | three little-endian uint32 | Frame index and chunk placement |
| Samples | sample-count × little-endian int32 | Q8 baseline-corrected ADC counts |

Each sample is `round((averageRaw − zeroCode) × 256)`. Negative values are valid signal. `INT32_MIN` is the intentionally blanked sentinel. Recover input current with:

```text
pA = −(Q8 / 256) × (ADS_RANGE_V / 32768) × 10^6
     / [(10 / 40.2) × CURRENT_RF_MOHM × CURRENT_GAIN_CORRECTION]
```

The minus sign accounts for U1B inversion. The Q8 format preserves fractional results after averaging/zero subtraction; it does not create additional physical ADC resolution. Nominal 0.314 pA/code is quantization scale, not calibrated accuracy. The receiver must use the matching scan configuration to place pixels. Status lines beginning with `#` are text; synchronize on binary magic for frames. Only one row/chunk is buffered.

## Shared scan-DAC transfer

The external amplifier transfer is `Vplate = amplifierGain × (Vdac − dacReference/2)`. DAC80502 uses `Vdac = 2.5 × code/65536`, with commands rounded/clamped to 0…65535. Code 32768 is exactly 1.25 V in the nominal model; the maximum code is 2.49996185 V. At the assumed external gain of 100, each DAC code changes the differential plate command by 3.8147 mV. The largest symmetric ideal command is `dacReference × amplifierGain × (0.5 − 1/2^dacBits)`; real amplifier limits can be much tighter. Scan amplitude is peak differential plate voltage, not a DAC pin voltage.

`scan-hardware.js` applies nominal code quantization to the browser path. The firmware computes built-in trajectory coordinates in double precision and casts once to the float path representation, then uses double intermediates for code scaling to avoid extra rounding near a half-code boundary. Duplicate positions at small scan ranges remain duplicate commands; increasing pixel count does not create physical positions between DAC codes. These numerical increments do not establish beam spot size, analog positioning accuracy or spatial resolution.

Each move loads DAC-A and DAC-B buffers and sends one software LDAC trigger: **three 24-bit SPI frames**, or 72 µs of clocking at 1 MHz. The sketch leaves at least 1 µs between packets. This transfer time, GPIO overhead, interrupts and transport extend the acquisition model and require actual timing measurement. Plate wiring, gain/offset, headroom and settling need bench calibration. The ESP32 sketch does not generate gun acceleration, filament heat or detector supply rails. The scan API accepts integer resolutions 2…512; the UI must not silently change a valid parsed resolution or an applied custom path while retaining different firmware constants.

## Preserved MCP4922 scan hardware

`DAC_MODEL=4922` selects the earlier 12-bit MCP4922 protocol. Its default external reference is 3.3 V, midpoint code is 2048, and nominal transfer is `Vdac = dacReference × code/4096`. It uses SPI mode 0, two 16-bit words per position, and a physical LDAC pulse on GPIO26 to update both outputs. Its amplifier center is `dacReference/2`—normally 1.65 V.

Old sketches that lack `DAC_MODEL` are inferred as MCP4922 **only when `DAC_BITS=12`**. Old snapshots retain their 12-bit settings and existing source bytes. A missing model in a new 16-bit sketch is rejected instead of silently selecting a different protocol. The model identifier, code width and reference are independent of whether the detector uses ADS1115 or ESP32 ADC1.

## Preserved legacy BSE / ET acquisition

The earlier sketch retains single `analogRead` acquisition at conditioned ESP32 ADC1 GPIO34. Its fixed configured dwell/settle/retrace model does not include ADS1115 conversion time and its detector model's ideal averaging is not implemented by one endpoint read.

Legacy packets use **SEM1**, magic `0x314D4553`, the same four-uint32 header, then **uint16** samples, with `0xFFFF` as the blanked sentinel. Do not decode CUR1's signed int32 Q8 payload with this legacy format. Legacy firmware starts disarmed with `s`/`x` controls; previous saved sketches preserve that behavior.

## References and verification

- [TI LMC662 datasheet](https://www.ti.com/lit/ds/symlink/lmc662.pdf): front-end circuit and guarding.
- [TI ADS1115 datasheet](https://www.ti.com/lit/ds/symlink/ads1115.pdf): differential PGA, data rate, OS bit, single-shot conversion and signed codes.
- [TI DAC80502 datasheet](https://www.ti.com/lit/ds/symlink/dac80502.pdf): DAC transfer, 3.3 V reference division, mode-1 register frames and synchronous update.
- [Microchip MCP4922 datasheet](https://ww1.microchip.com/downloads/en/DeviceDoc/22250A.pdf): DAC transfer, register and timing.
- [Espressif Arduino I²C](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/i2c.html), [SPI](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/spi.html), and [legacy ADC](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html) APIs.
- [ESP32 datasheet](https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf): GPIO capabilities and restrictions.

Run `npm test --prefix simulator` for geometry, timeout handling, current model, configuration parsing, pin conflicts and timing checks. The host C++ tests exercise SPI register framing, simultaneous X/Y updates, startup blanking, MCP4922 compatibility and exact browser/firmware code parity across representative trajectories and scan ranges. Separate ADS1115 tests exercise fresh conversions and fault handling. These checks are not an actual Arduino-ESP32 target build or hardware measurement; validate the selected board toolchain, signal levels, readiness, calibration and pixel timing before operating the instrument.
