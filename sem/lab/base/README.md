# Beam Lab — interactive electron microscope

A dependency-free local web simulator for the repository’s 1–5 kV tungsten-source microscope concept.

## Run

Node.js 20 or newer is sufficient. No installation or build step is needed.

```sh
cd simulator
npm start
```

Open **http://localhost:4173**. The server binds to `127.0.0.1`, so it is only accessible on this computer. Set `PORT=4174 npm start` to use another local port.

Alternatively, from the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory simulator
```

The page loads no external fonts, packages, analytics, or images. Sources open separately when selected. Custom trajectories run in a disposable Web Worker with a 1.2-second timeout. The browser preview does not connect to an ESP32 or instrument.

## Explore

- **Microscope:** an animated column cutaway, source/optics/vacuum/detector controls, synthetic specimen acquisition, detector signal, and live equations. Numeric values and sliders are both editable.
- **Components:** select a part, use its chip, or double-click it to zoom. Drag to pan, use the wheel to zoom around the pointer, or use the labeled zoom controls. “Fit whole microscope” restores the column. Fields shows electrostatic **E** at the plates and magnetic **B** at the lens.
- **Scan program:** four preset trajectories or an editable JavaScript point function; apply it to update both the path preview and microscope scan. The separate editable ESP32 sketch has validated configuration constants, external dual-DAC control, blanking, settling, ADC sampling, and a binary serial stream. Custom JavaScript needs a manual port to `pointAt()` in C++.
- **Operating guide:** eight interactive steps from a cold chamber through roughing, turbo pumping, heating, acceleration, focusing, scanning, and detection. Pump-down runs at 20× simulated time above the model vacuum-permit threshold.
- **Physics & sources:** every one of the 19 model equations has a live substitution, derivation, assumptions, and direct primary citations. Hover, keyboard focus, or click/tap opens the note. Escape closes it.
- **Export setup:** download current parameters and edited programs as JSON. The editor also downloads JavaScript or Arduino C++. Editing persists while navigating within the page; reloading resets the lab.

## Model scope

The initial imaging preset establishes high vacuum and a warm filament. Cold start loads atmospheric pressure with heater, beam, and pumps off. The model requires backing and crossover before enabling turbo pumping, and inhibits beam acquisition above 10⁻⁴ mbar or when emission is cut off. This is a model permit, not hardware safety logic.

The main controls include acceleration, heater power, Wehnelt bias, circular aperture diameter, coil current, post-plate drift, plate offset/gap/length, scan amplitude, pump speed, chamber volume, line conductance, gas load, PMT voltage, collector bias, sample count, and dwell. The scintillator’s representative +10 kV supply is explicitly fixed and distinct from the primary-beam and PMT supplies.

The lens-to-specimen optical drift is the scan-plate length plus the post-plate drift. Motion and component geometry are schematic; electron motion is slowed. Image contrast is a generated reference pattern, not Monte Carlo material physics. The displayed probe diameter is an illustrative optical budget, not a claimed achievable image resolution. The signal trace samples normalized synthetic image brightness. PMT output is an unsaturated estimate, with a visible model-limit note at high current.

The frame minimum includes dwell, configured settling, and retrace. SPI/GPIO, ADC, code execution, blanked serial transmission, and scheduler delays add time on an actual ESP32. Image playback uses this same minimum-time budget, distributed over the samples; individual subpixel blanking and hardware timing are not emulated.

The repository’s existing acceleration-controller PCB is unchanged. ESP32 scanning, scan amplifiers, lenses, vacuum hardware, and ET detection are proposed additional systems.

## Validation and references

```sh
npm test
```

- [Physics model and cited assumptions](PHYSICS.md)
- [Scan algorithms, firmware mapping and protocol](SCAN.md)
- [Generated default Arduino sketch](firmware/ESP32_scan/ESP32_scan.ino)
- [Screenshot review and browser checks](REVIEW.md)

The test suite checks independent speed/wavelength values, thermal balance, optical scaling/polarity, gas dynamics, focus, PMT noise, raster coverage, custom trajectory validation, loop timeout, firmware round-trips, pin conflicts, and DAC bounds. The generated C++ has been syntax-checked against minimal Arduino/SPI stubs; an actual Arduino-ESP32 toolchain build and hardware timing/voltage validation remain necessary before using it on hardware.
