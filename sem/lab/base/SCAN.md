# Scan programming

`scan.js` is dependency-free and has no DOM dependencies. Its public API is:

- `PRESETS`: `{id, label, description}` objects for `raster`, `serpentine`, `spiral`, and `lissajous`.
- `scanPoint(index, resolution, mode)`: `{x, y, blank}` in normalized −1…1 coordinates. Indices wrap around a resolution² frame. Every built-in point is acquired; blanking during repositioning occurs between samples in firmware.
- `DEFAULT_PROGRAM`: an editable JavaScript function body. Its arguments are `i` (sample index), `n` (resolution), and `t = i/(n*n−1)`. Return `{x,y,blank}`; `blank:true` means an intentionally unexposed sample.
- `compileProgram(source, {resolution=128, timeout=1200})`: a promise resolving to `{points: Float32Array, count}`. The packed buffer contains x, y, blank triplets. Compilation runs in a new worker; loops are stopped after the deadline and never run on the animation thread. Source length, resolution, output types, and bounds are checked. The worker is for responsiveness; the editor is intended for the user's own local code, not a hostile-code security boundary.
- `generateFirmware(config)`: an Arduino sketch targeting the classic ESP32 and an external MCP4922 DAC. `FIRMWARE_DEFAULTS` contains all supported keys.
- `parseFirmwareConfig(source)`: `{config,errors,warnings}`. It reads only explicit numeric `constexpr` assignments and never evaluates C++. Edited algorithm or I/O logic triggers a warning that those edits are outside the preview. JavaScript custom paths are separate from the downloadable C++; translate `pointAt` and compile it with the Arduino toolchain to deploy a custom path.
- `CONFIG_HINTS`: `{title,body,url}` sourced hardware guidance.

Configuration uses resolution (samples per side), dwell (minimum beam-on wait, µs), scanAmplitude (peak **differential** plate voltage, V), scanMode (preset ID), settle/retrace (µs), dacReference (V), amplifierGain (V/V), dacBits, adcBits, spiHz, mosi, sck, cs, ldac, adc, and blankPin. Geometry and physics remain the calling app's responsibility. The adapter should apply settings only when `errors.length === 0` and show warnings.

The external amplifier's transfer model is `Vplate = amplifierGain × (Vdac − dacReference/2)`. MCP4922 internal gain is 1 and the exact ideal transfer is `Vdac = dacReference × code / 4096`; generated codes are rounded and clamped to 0…4095. Thus the largest symmetric ideal command is `dacReference × amplifierGain × (0.5−1/4096)`. Rail headroom, offsets, amplifier bandwidth, and the actual differential plate wiring need bench calibration. The firmware never generates the accelerating voltage, filament heating power, or PMT bias.

The sketch blanks during all updates, waits for settling, unblanks, waits the configured dwell, samples the conditioned detector ADC, and blanks again. Raster flyback and frame wrap receive extra retrace time. The dwell helper uses elapsed microseconds after any scheduler yield so a long wait cannot undershoot solely because of RTOS tick alignment. Actual pixel timing includes SPI, GPIO, ADC, and task scheduling overhead; actual frame timing also includes serial pauses. Detector output is sampled once per pixel; a detector integrator or averaging stage would need its own implementation.

For an acquisition-only browser model, use `N² × (dwell + settle) + R × retrace`, in microseconds, where `R = N` for raster and `R = 1` for the other presets (frame wrap). A custom JavaScript path can use `R = 1` plus its explicit blank samples; it has no implied raster-line retrace. This is an **ideal acquisition minimum**, excluding controller and transport costs. The displayed formula and animation must use the same timing model. Preserve `settle` and `retrace` when applying firmware configuration; a UI using names `settleTime` and `flyback` needs to map those names both ways. The default model should use the sketch's 8 µs settle and 80 µs retrace if it claims agreement with the sketch.

Known additional sketch costs per acquired frame are `N² × (32/SPI_HZ + 1 µs)` for two 16-bit DAC words and the LDAC pulse, plus one extra DAC pair/pulse when parking the beam at frame end. UART output uses `N × (16 + 2N)` bytes at nominal 921600 baud, 8N1, so its wire time is `N × (16 + 2N) × 10 / 921600` seconds. The blanked yield after each chunk adds scheduler-dependent time; GPIO calls, ADC conversion, firmware execution, interrupt latency, and USB-host behavior need measurement. Do not label these estimates as measured frame rate. `N² × dwell` alone excludes even programmed settling and retrace.

The scan API accepts integer resolutions 2…512. A UI may choose a narrower slider, but it must either accept valid parsed values in its number control or explicitly reject unsupported UI values before applying the sketch. It must not silently clamp the preview while retaining different firmware constants. When a custom JavaScript path is active, keep firmware export visibly identified as a separate preset sketch or require an explicit port to C++ `pointAt()`; never silently substitute raster for the custom path.

Firmware starts disarmed and accepts `s` to start and `x` to stop through serial. Each blanked transmission chunk contains four little-endian uint32 values (magic `0x314D4553`, frame number, first sample index, sample count), followed by that many uint16 ADC samples. `0xFFFF` denotes an intentionally blanked sample. Reconstruction uses the matching scan configuration to place each sample at its coordinate. The initial `READY` line is text; the receiver can synchronize on the binary magic after starting. Only one row/chunk is buffered, so a 512² scan does not allocate a full frame on the ESP32.

Sources checked 2026-09-11:

- [Microchip MCP4922 datasheet](https://ww1.microchip.com/downloads/en/DeviceDoc/22250A.pdf), equation 4-1, register 5-1, and timing/settling specifications.
- [Espressif Arduino SPI API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/spi.html), bus and pin routing.
- [Espressif Arduino ADC API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html), input attenuation and resolution.
- [ESP32 datasheet](https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf), pin capabilities and restrictions.

Run the software checks with `node --test simulator/scan.test.mjs`. These tests validate path geometry, worker failure recovery, timeout responsiveness, and firmware/preview configuration agreement. They are not an ESP32 firmware build or hardware validation.
