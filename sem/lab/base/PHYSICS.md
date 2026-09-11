# Educational SEM model

The simulation targets the repository’s 1–5 kV tungsten cathode architecture. It is a fast, deterministic teaching model with a synthetic specimen, not a finite-element electron-optics solver or a prediction of the unbuilt instrument’s performance. Numeric changes recompute algebraic expressions plus two small scalar root solves; no per-electron integration is required.

## API and units

`physics.js` exports `DEFAULTS`, `CONSTANTS`, `normalize`, `calculate`, `updatePressure` and `EQUATIONS`. It has no external runtime dependency. `calculate(partialParams)` merges defaults, normalizes inputs and returns derived values without modifying its argument.

| Parameter | Unit |
| --- | --- |
| voltage | kV, positive cathode-to-ground acceleration magnitude |
| heaterPower | W |
| aperture | µm, circular aperture diameter |
| wehnelt | V relative to cathode, negative |
| lensCurrent | A |
| plateVoltage / scanAmplitude | V differential between opposing plates; amplitude is peak |
| plateGap / plateLength | mm, gap between plates / effective axial length of plate assembly |
| workingDistance | mm, drift from plate exit to specimen (UI: Post-plate drift) |
| chamberVolume | L |
| pumpSpeed / conductance | L/s |
| gasLoad | mbar·L/s |
| pressure | mbar; 1 mbar = 100 Pa |
| dwell / settleTime / flyback | µs |
| resolution | square-frame pixels per side |
| pmtVoltage / collectionBias | V; independent supplies |

| Derived value | Unit / meaning |
| --- | --- |
| speed / wavelength | m/s / pm; relativistic electron speed and de Broglie wavelength |
| temperature / emission / beamCurrent | K / µA emitted / nA transmitted to specimen |
| field | V/m, signed plate voltage divided by gap; physical Eₓ has the opposite sign |
| deflection / scanFieldWidth | mm, signed static displacement / full ±amplitude width |
| magneticField | mT, signed ideal lens-coil axial field |
| focalLength / backFocalLength | mm, effective focal length / focal distance from coil exit |
| lensDriftDistance | mm, coil-exit-to-specimen distance = plateLength + workingDistance |
| focusCurrent | A, first-focus branch that places the focal plane at lensDriftDistance |
| spotSize | nm, approximate probe-diameter quadrature; not image resolution |
| meanFreePath / electronMeanFreePath | m, neutral gas / assumed electron-gas collision mean free path |
| survival | dimensionless unscattered electron probability |
| equilibriumPressure | mbar, turbo base plus gas load / available effective speed |
| pumpTimeConstant | s, chamberVolume / effectiveSpeed |
| frameTime | s, minimum modeled dwell + settling + retrace budget; excludes SPI, ADC, software and transport |
| electronCount / detectedElectrons | primary electrons / PMT photoelectrons per pixel |
| pmtGain / snr | multiplier / dimensionless signal-to-RMS-noise ratio |
| dose | primary e⁻/µm² per uniform square frame; null at zero field width |
| pmtAnodeCurrent | µA, unsaturated illustrative output current |

Each `EQUATIONS` record includes a display formula, live numerical substitution and result, a derivation, assumptions and direct source links. Its `id` generally matches a derived output. `pressure` covers equilibrium pressure and dynamics; `collection` covers photoelectron count. Formula callbacks accept a full parameter object and the result of `calculate`.

`calculate` describes the beam and pixel exposure available from the configured parameters. It does not receive the application’s manual beam-blank state. The application must gate actual displayed probe current, image acquisition and detector activity when blanked, and identify equation outputs as prospective values during blanking. A Wehnelt cutoff gives exactly zero accepted beam current even with a hot filament.

## Field and trajectory assumptions

The **scan plates generate an electric field**. The **lens coil generates the magnetic field**. A negative electron accelerates toward the positive plate. Define differential voltage as `V(+x plate) − V(−x plate)`; positive differential voltage gives positive x displacement. The small-angle displacement includes travel inside the plates and the following field-free drift.

The solenoid model solves the paraxial radial equation in the Larmor frame using a constant axial field and sharp effective boundaries. The displayed effective focal length differs from the distance between the coil exit and its focal plane. Its first-focus solution is used by `focusCurrent`. This avoids applying the weak thin-lens approximation at the default lens phase near 0.69 radians. The 452-turn ideal coil is followed immediately by the effective 20 mm scan-plate assembly and a 15 mm post-plate drift, so the default specimen is 35 mm from the coil exit. Changing either plate length or post-plate drift changes the required focus. The model omits real pole-piece geometry and finite-coil fields; assumed aberration coefficients are independent of this ideal field model.

The aperture is circular. A slit would need its width and shape in the transverse transmission and diffraction expressions. The 2D Gaussian aperture integral and assumed source demagnification explain the aperture/current trend. The Wehnelt extraction curve is a labeled surrogate, not an electrostatic solution. No claim is made about heater ratings, field emission, space-charge-limited current, real gun alignment, astigmatism, or measured attainable resolution.

## Pump and detector assumptions

`updatePressure(pressureMbar, dtSeconds, {roughing, turbo, ...overrides})` integrates the constant-coefficient chamber gas balance exactly during each step. The simulation clock supplied by the caller is the physical time in this expression. Turbo pumping requires roughing/backing enabled and pressure below the assumed 0.1 mbar crossover. Roughing-only pumping has an assumed 0.01 mbar base. With all pumps off, constant gas load raises pressure. Turbo base is assumed 10⁻⁷ mbar. Long steps that cross regimes should be subdivided by the caller. Real pump curves, valves, contamination and pressure-dependent outgassing are absent, so modeled pump-down can be much faster than an instrument.

Neutral-gas mean free path and electron transmission are separate expressions. The latter uses a fixed illustrative electron-gas cross section of 10⁻²⁰ m². The NIST citation documents the existence and energy dependence of real elastic cross-section data; it **does not provide or validate this assumed cross section** or total gas mixture attenuation.

The detector is an Everhart–Thornley chain: collection cage → scintillator → light guide → photocathode → PMT dynodes → anode. The cage’s positive collection bias, scintillator acceleration bias and PMT supply are different quantities. A traditional detector uses a scintillator acceleration supply around +10 kV independent of the 1–5 kV primary beam. The UI must label that distinct stage; `photonYield` is a fixed assumed scintillator response, not a simulation of its HV circuit.

The PMT gain is normalized to 10⁵ at 800 V with exponent 7. The noise estimate includes Poisson secondary generation, Poisson photoelectron yield, PMT excess noise, dark counts and amplifier noise. Larger PMT gain can overcome read noise; it cannot remove counting noise. Current above 100 µA is flagged illustratively but saturation is not calculated. All yields, gains and dark/read-noise values require actual hardware calibration.

Frame timing uses 8 µs settling and 80 µs retrace by default. Raster counts one retrace per row; other paths count one per frame. The numerical result is a minimum timing budget, not measured controller throughput: SPI transfers, ADC conversion, software and serial transport add time. Custom trajectories retain N² timing slots, including blanked points; their dose distribution need not be uniform.

## Primary source map

Sources were checked on 2026-09-11. Equations and descriptive derivations are written for this project; they are not copied source passages.

| Equations / claims | Primary reference and relevant location |
| --- | --- |
| Kinetic energy and speed | [OpenStax University Physics III §5.9](https://openstax.org/books/university-physics-volume-3/pages/5-9-relativistic-energy), kinetic energy derivation and Eq. 5.8 |
| Electron wavelength and 1 kV check | [JEOL wavelength of electron](https://www.jeol.com/words/emterms/20121023.071258.php), equations and Table 1 |
| Thermal radiation and support conduction | [OpenStax University Physics II §1.6](https://openstax.org/books/university-physics-volume-2/pages/1-6-mechanisms-of-heat-transfer), conduction and radiation |
| Richardson–Dushman tungsten emission | [Vacuum 77 (2004), 19–26](https://doi.org/10.1016/j.vacuum.2004.07.066), thermionic hairpin cathode; equation and tungsten parameters in section snippets |
| Tungsten source and Wehnelt role | [JEOL thermionic-emission gun](https://www.jeol.com/words/semterms/20121024.071558.php), cathode, bias and crossover |
| Plate voltage, field and work | [OpenStax University Physics II §7.2](https://openstax.org/books/university-physics-volume-2/pages/7-2-electric-potential-and-potential-difference), potential difference and uniform field |
| Coil field | [OpenStax University Physics II §12.6](https://openstax.org/books/university-physics-volume-2/pages/12-6-solenoids-and-toroids), long-solenoid field |
| Solenoid focusing | [Baartman, CERN CAS 2018](https://e-publishing.cern.ch/index.php/CYRSP/article/download/640/668/3747#page=4), §2.1 Eq. 7; the constant-field transfer is derived here from this equation |
| Probe quadrature | [JEOL electron-probe diameter](https://www.jeol.com/words/semterms/20121024.063858.php), diffraction, source, spherical and chromatic contributions |
| Effective pumping speed | [Pfeiffer Leak Detection Compendium](https://www.pfeiffer-vacuum.com/media/documents/leak-detection-know-how/leak-detection-compendium-pfeiffer-vacuum.pdf#page=13), §2.3.3 Formula 2-2 |
| Throughput and pump balance | [Pfeiffer vacuum fundamentals](https://www.pfeiffervacuum.com/global/en/knowledge/vacuum-technology/knowledge-book/1-introduction/1_2_fundamentals/), §1.2.7 Formula 1-16; chamber ODE is conservation of gas inventory |
| Neutral-gas mean free path | [OpenStax University Physics II §2.2](https://openstax.org/books/university-physics-volume-2/pages/2-2-pressure-temperature-and-rms-speed), mean free path and ideal gas law |
| Electron cross-section limitations | [NIST SRD 64](https://www.nist.gov/publications/nist-electron-elastic-scattering-cross-section-database-version-40), electron elastic-scattering data; no numerical database fit is used |
| Detector chain | [JEOL ET detector](https://www.jeol.com/words/semterms/20121024.070858.php), independent collector, scintillator and PMT stages |
| PMT gain | [Hamamatsu PMT catalog](https://hub.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/etd/PMT_TPMZ1036E.pdf), gain and voltage dependence |
| Photon, dark and amplifier noise | [Hamamatsu detector selection guide](https://hub.hamamatsu.com/us/en/technical-notes/detector-selection/guide-to-detector-selection.html), “The noise problem”, Eq. 4 and PMT excess noise |

Timing, Gaussian aperture integration, geometric defocus, fluence, and the explicit empirical collection/Wehnelt curves are derived or defined in this repository. Their source links supply the physical context, not an assertion that a manufacturer published the simulator’s transfer curves.

## Verification

Run `node --test simulator/physics.test.mjs` from the repository root. Checks include the independently published JEOL 1 kV values, energy-balance residual, plate polarity and classical limit, solenoid reversal and focusing, separate pressure scaling of neutral/electron collisions, analytical vacuum decay and pump permits, timing/fluence scaling, and PMT gain/noise limits.
