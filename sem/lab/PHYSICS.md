# Educational SEM model — LMC662 current detector and legacy BSE / ET

The simulation targets the repository's tungsten cathode architecture with an LMC662 specimen-current detector as its default. Current and BSE controls start at 3 kV, following the selected operating constraint; earlier ET runs retain their original settings. It is a fast, deterministic teaching model with a synthetic specimen, not a finite-element electron-optics solver or a prediction of the unbuilt instrument's performance. Numeric changes recompute algebraic expressions plus two small scalar root solves; no per-electron integration is required.

## API and units

`physics.js` exports `DEFAULTS`, `CONSTANTS`, `normalize`, `calculate`, `updatePressure` and `EQUATIONS`. It has no external runtime dependency. `calculate(partialParams)` merges defaults, normalizes inputs and returns derived values without modifying its argument.

`current.js` exports `CURRENT_DEFAULTS`, `CURRENT_PARAMETER_SCHEMA`, `normalizeCurrent`, `calculateCurrent`, ADC ranges/rates, and `CURRENT_EQUATIONS`. `calculateCurrent(params, {beamCurrentnA, beamOn})` accepts incident current in nA and returns the charge balance, analog readout, ADC and timing estimates. `current` carries this result; the electrical layer gates it when the beam is blanked.

`bse.js` exports `BSE_DEFAULTS`, `BSE_PARAMETER_SCHEMA`, `normalizeBSE`, `detectorSolidAngle`, `calculateBSE`, `BSE_EQUATIONS` and source records. `calculateBSE(params, {beamCurrentnA, beamOn})` accepts incident specimen beam current in nA. `calculate` always retains the legacy ET fields and adds `bse`; `snr` selects the active detector while `etSnr` retains the ET result. The application combines the general, electrical and active detector formula cards. Older saved runs without `detectorMode` are restored explicitly as `et`, while new defaults use `current`.

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
| detectorMode | `current`, `bse` or `et`; active detector architecture |
| detectorDistance | mm; axial specimen-to-silicon-face gap |
| detectorBias | V; positive reverse-bias magnitude, 0–5 V explored |
| bseYield | assumed fraction of incident specimen electrons returning as BSE |
| bseEnergyFraction | assumed mean BSE energy / primary beam energy |
| bseAcceptance | assumed unobstructed fraction after geometric collection |
| tiaResistance / tiaCapacitance | MΩ / pF; proposed feedback components |
| tiaInputNoise / tiaVoltageNoise | pA/√Hz / nV/√Hz; assumed amplifier noise densities |
| adcFullScale | V; simulated conditioned-readout ceiling, initially 3.1 V |
| pmtVoltage / collectionBias | V; independent legacy ET supplies |
| currentRf / currentCf | MΩ / pF; LMC662 feedback values, default 100 / 10 |
| currentADCRange / currentADCRate | V positive differential full-scale / samples per second |
| currentSamples | Number of fresh ADC conversions per pixel |
| currentBseYield / secondaryYield | Assumed escaped BSE / SE fraction per incident electron |
| currentNoiseFloor | pA RMS additional noise allowance; default 5, not a measured specification |

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
| frameTime | s, active architecture timing; current mode includes ADC conversion allowance, legacy modes retain configured dwell/settle/retrace |
| electronCount / detectedElectrons | primary electrons / PMT photoelectrons per pixel |
| pmtGain / etSnr | legacy ET multiplier / signal-to-RMS-noise ratio |
| snr | active detector's dimensionless linear signal-to-RMS-noise estimate |
| dose | primary e⁻/µm² per uniform square frame; null at zero field width |
| pmtAnodeCurrent | µA, unsaturated illustrative output current |
| current.netCurrentnA | Net absorbed electron-current equivalent, nA; may be negative |
| current.idealOutputV / outputV | Ideal TIA demand / output bounded at ±4 V |
| current.adcVoltageV / adcDifferentialV | A0 / A0 − A1 in volts |
| current.adcCode / inputLSBpA | Signed conversion code / pA per code after attenuation |
| current.rmsNoisepA / snr | Illustrative RMS input current noise / absolute net-current SNR |
| current.settlingTimeUs / frameTimeS | Ideal 1% feedback response / frame timing including ADC allowance |
| current.clipped / notes | Range warning / model limitations |
| bse.meanEnergykeV / energySupported | mean-energy surrogate / whether it lies in 1–30 keV |
| bse.solidAngleSr / collectionFraction | sr / fraction of upward BSEs collected after assumed obstructions |
| bse.incidentCurrentnA / generatedCurrentnA | nA arriving as BSE / nA charge signal after silicon conversion |
| bse.darkCurrentnA / detectorCapacitancepF | nA / pF; interpolated typical bias-dependent anchors |
| bse.signalVoltageV / darkOffsetV / rawOutputV | V; ideal signal, dark offset and total TIA output demand |
| bse.adcInputV / adcOutputV | V; TIA demand plus 0.15 V / result clipped to the selected readout ceiling |
| bse.headroomV / saturated | V remaining after conditioning / whether the ceiling is reached |
| bse.timeConstantUs / settlingTimeUs / bandwidthHz | µs / µs to 1% step error / ideal RfCf −3 dB frequency |
| bse.noiseRmsnA / snr | input-referred nA RMS / ideal averaged linear SNR |
| bse.settled / readoutValid | dwell meets the ideal 1% estimate / mean energy, settling and clipping checks pass |

Each `EQUATIONS` record includes a display formula, live numerical substitution and result, a derivation, assumptions and direct source links. Its `id` generally matches a derived output. `pressure` covers equilibrium pressure and dynamics; `collection` covers photoelectron count. Formula callbacks accept a full parameter object and the result of `calculate`.

`calculate` describes the beam and pixel exposure available from the configured parameters. It does not receive the application's manual beam-blank state. `calculateElectrical` recomputes a BSE result using the gated specimen current and supplies it as `electrical.bse`; live electrical readouts and detector formula cards use that result. Blanking removes the BSE-generated signal but retains the biased detector's dark offset and electronics noise. A Wehnelt cutoff gives exactly zero accepted beam current even with a hot filament. Unsupported mean energies produce `null` illuminated gain/current/voltage/noise estimates, not a claimed measured zero; a beam-off zero signal remains known even when its hypothetical incident energy is unsupported.

## Field and trajectory assumptions

The **scan plates generate an electric field**. The **lens coil generates the magnetic field**. A negative electron accelerates toward the positive plate. Define differential voltage as `V(+x plate) − V(−x plate)`; positive differential voltage gives positive x displacement. The small-angle displacement includes travel inside the plates and the following field-free drift.

The solenoid model solves the paraxial radial equation in the Larmor frame using a constant axial field and sharp effective boundaries. The displayed effective focal length differs from the distance between the coil exit and its focal plane. Its first-focus solution is used by `focusCurrent`. This avoids applying the weak thin-lens approximation at the default lens phase near 0.69 radians. The 452-turn ideal coil is followed immediately by the effective 20 mm scan-plate assembly and a 15 mm post-plate drift, so the default specimen is 35 mm from the coil exit. Changing either plate length or post-plate drift changes the required focus. The model omits real pole-piece geometry and finite-coil fields; assumed aberration coefficients are independent of this ideal field model.

The aperture is circular. A slit would need its width and shape in the transverse transmission and diffraction expressions. The 2D Gaussian aperture integral and assumed source demagnification explain the aperture/current trend. The Wehnelt extraction curve is a labeled surrogate, not an electrostatic solution. No claim is made about heater ratings, field emission, space-charge-limited current, real gun alignment, astigmatism, or measured attainable resolution.

## Pump assumptions

`updatePressure(pressureMbar, dtSeconds, {roughing, turbo, ...overrides})` integrates the constant-coefficient chamber gas balance exactly during each step. The simulation clock supplied by the caller is the physical time in this expression. Turbo pumping requires roughing/backing enabled and pressure below the assumed 0.1 mbar crossover. Roughing-only pumping has an assumed 0.01 mbar base. With all pumps off, constant gas load raises pressure. Turbo base is assumed 10⁻⁷ mbar. Long steps that cross regimes should be subdivided by the caller. Real pump curves, valves, contamination and pressure-dependent outgassing are absent, so modeled pump-down can be much faster than an instrument.

Neutral-gas mean free path and electron transmission are separate expressions. The latter uses a fixed illustrative electron-gas cross section of 10⁻²⁰ m². The NIST citation documents the existence and energy dependence of real elastic cross-section data; it **does not provide or validate this assumed cross section** or total gas mixture attenuation.

## LMC662 specimen-current detector assumptions

The conductive specimen holder is insulated from the earthed mechanical stage and connected through a sealed electrical feedthrough to U1A's inverting input. Feedback holds it near AGND. The amplifier and ADC stay outside vacuum. There is no separate collecting head or intrinsic multiplication gain.

Using positive electron-current magnitudes, `Iabs = Ib − ISE − IBSE = Ib(1 − δ − η)`. Positive net electron absorption makes conventional current leave the summing node toward the holder, so `Vtia = Iabs Rf`. For 100 MΩ, 1 pA produces 100 µV. This steady-state charge balance omits charging, transmitted electrons and leakage. δ and η are adjustable assumptions; beam energy alone cannot predict wing contrast or feature depth. [Charge conservation](https://openstax.org/books/university-physics-volume-2/pages/10-3-kirchhoffs-rules)

U1A uses 100 MΩ ∥ 10 pF by default. `τ = RfCf = 1 ms`, `f−3dB = 1/(2πτ) ≈ 159 Hz`, and `t1% = −ln(0.01)τ ≈ 4.605 ms`. The model bounds its output at ±4 V on ±5 V rails. The feedback pole does not prove loop stability; lead capacitance, op-amp gain bandwidth and parasitics require analysis and measurement. [LMC662 datasheet](https://www.ti.com/lit/ds/symlink/lmc662.pdf), [TI transimpedance-design note](https://www.ti.com/lit/an/snoa515a/snoa515a.pdf)

U1B uses 40.2 kΩ input and 10 kΩ feedback with a 1.32 V noninverting reference. KCL gives `A0 = (1 + 10/40.2)1.32 − (10/40.2)Vtia`. A1 is nominally 1.65 V, giving `A0 − A1 = −1.641791 mV − 0.248756 Vtia`. The ADS1115 default ±0.256 V range gives `LSB = 0.256/32768 = 7.8125 µV`, or **0.3140625 pA/code** at 100 MΩ after attenuation. This is quantization, not noise or accuracy. Measure zero and gain; the nominal divider offset is not zero. Either ADC pin must stay within its 3.3 V supply limits. [ADS1115 datasheet](https://www.ti.com/lit/ds/symlink/ads1115.pdf)

The illustrative one-sided equivalent noise bandwidth is `B = 1/(4RfCf)`. The model adds variances from `4kTB/Rf` resistor thermal noise, `2eIb(1 + δ + η)B` as an explicitly simplified independent-Poisson arrival/escape benchmark, quantization variance, and a **5 pA RMS additional noise assumption**. That additional floor is editable, not an LMC662 specification or an established detector sensitivity. Electron yield correlations, op-amp voltage noise through cable capacitance, detailed ADC filtering, flicker noise, drift and charging are not solved. Additional pixel averaging is not credited with a guaranteed square-root improvement. [TI TIA noise and stability context](https://www.ti.com/lit/an/snoa515a/snoa515a.pdf)

Current mode's synthetic image illustrates assumed current contrast, clipping and lag; it is not a simulated butterfly wing. Displayed spot size is an optical estimate, not a demonstrated image resolution. The circuit needs blanked-input noise, leakage, gain, polarity and step-response measurements before its usable sensitivity can be claimed. [PCB and commissioning reference](current.html)

## Legacy silicon BSE detector assumptions

In BSE comparison mode, the detector is modeled as a 10 × 10 mm square with a centered 2 mm diameter hole, placed above an on-axis point specimen. Its solid angle is the exact centered-square result minus the on-axis circular-hole result:

`Ω = 4 atan[a² / (d√(d² + 2a²))] − 2π[1 − d/√(d² + r²)]`, with `a = 5 mm`, `r = 1 mm`.

The model multiplies `Ω/(2π)` by `bseAcceptance` and the assumed BSE yield to obtain collected electron current. The upper-hemisphere normalization assumes isotropic emission. Real BSE angular distributions, specimen tilt, scan offsets, chamber obstructions and lens shadowing are not solved. The visual tracks represent returning electrons; their displayed count is not the computed electron flux. Geometry changes are schematic and do not certify mounting clearance. The fixed detector hole is distinct from the independently adjustable beam aperture.

Mean returning energy is `bseEnergyFraction × primary energy`. The **3 kV primary-beam floor does not ensure that every BSE has at least 1 keV**. Real BSE energies form a spectrum, including electrons below the detector's characterized range. Only the chosen mean is checked against 1–30 keV; passing this check does not characterize the whole spectrum. Outside that range the model leaves charge gain and illuminated signal unknown rather than extrapolating them.

The charge gain approximation is `G = 0.72 × E(eV)/3.62`. The 3.62 eV pair-creation energy and the approximately 300 charge-gain / 72% efficiency anchor at 1.5 keV come from the manufacturer. Holding 72% constant across energy is a project assumption; the real efficiency curve is energy dependent. Multiplying collected electron current by G gives the generated current. Neither this gain nor the collection fraction is a promise of measured system sensitivity.

Bias is the reverse difference `VR = VK − VA`. The proposed positive-output circuit holds K at the TIA virtual 0 V input and drives A to −VR. The simulator linearly interpolates typical capacitance between 1700 pF at 0 V and 450 pF at 5 V. Dark current interpolates between 0.5 nA at 10 mV and 5 nA at 5 V, with a linear approach to zero below 10 mV. These are 25°C estimates, not a fitted diode model; the specified 5 V dark-current maximum is 60 nA. Zero mean external leakage at zero bias does not remove thermal noise.

The proposed chain is **S11141-10 → TIA → conditioner → ESP32 ADC1 GPIO34**. For the shown polarity, `Vraw = +(Isignal + Idark)Rf`. The separate conditioner is modeled as unity signal gain plus a fixed +0.15 V reference: `VADC,in = Vraw + 0.15 V`. Clipping uses the selected `adcFullScale`, initially 3.1 V; therefore the initial allowable TIA demand is 2.95 V, including its dark offset. `rawOutputV` can exceed achievable hardware rails: it is an ideal demand, not a measured voltage. The candidate amplifier, offset source, filter, buffer and protection components are not validated hardware, and changing the ceiling does not configure a physical ADC. See [the circuit guide](bse.html) and [electrical connection proposal](BSE_CONNECTIONS.md).

Rf in parallel with Cf gives ideal feedback impedance `Rf/(1+sRfCf)`, so `τ = RfCf`, `f−3dB = 1/(2πτ)` and `t1% = ln(100)τ`. The initial 10 MΩ and 5 pF give τ = 50 µs and t1% ≈ 230 µs; the BSE imaging preset uses 500 µs dwell. The main image shows a first-order scan-direction lag and approximate clipping. Neither that animation nor the feedback product establishes amplifier stability. Detector/input capacitance, op-amp gain bandwidth, extra poles and scan-driver settling require circuit analysis and measurement. The detector's 2.5 MHz specification is an optical test into 50 Ω, not a usable pixel-rate claim for this TIA.

### BSE noise and the firmware boundary

The noise estimate treats each arriving BSE as a Poisson event producing a correlated packet of G carriers. Its current-noise density therefore includes `2e G² Iincident`; using `2e Isignal` would incorrectly treat those carriers as independent events. The model adds dark-current shot noise, feedback and estimated shunt-resistance thermal noise, amplifier current noise and a capacitance-dependent voltage-noise contribution in variance. Rsh ≈ 20 MΩ is inferred from the 10 mV / 0.5 nA anchor and held constant as an explicit assumption.

The integration uses an approximate rectangular noise bandwidth `B = min[1/(4RfCf), 1/(2tdwell)]`, representing **ideal pixel averaging** combined approximately with the analog bandwidth. It omits detailed filter shape, actual amplifier cutoff, cable capacitance, excess charge variance from the BSE spectrum, 1/f noise, bias/offset-source noise, ADC quantization and aliasing. This is a limited noise estimate; it is not a calibrated noise budget.

The preserved legacy ADC mode performs one `analogRead` per pixel. It does **not** implement the ideal averaging used for the displayed SNR. Longer dwell helps analog settling, but a single endpoint read does not automatically enjoy a `1/√tdwell` noise reduction. A real implementation would need an appropriate sampling/averaging strategy, analog filtering, calibrated ADC transfer and measured timing. The image noise and normalized scope preview illustrate the model's trends rather than reproduce a bit-accurate firmware acquisition.

`snr` remains the linear estimate even when the output clips or dwell is too short. Check `saturated`, `settled` and `readoutValid` separately. Passing these modeled checks does not establish real amplifier stability, valid vacuum mounting or achievable image quality.

## Legacy ET detector assumptions

The earlier detector remains available as an Everhart–Thornley chain: collection cage → scintillator → light guide → photocathode → PMT dynodes → anode. The cage's positive collection bias, scintillator acceleration bias and PMT supply are different quantities. A traditional detector uses a scintillator acceleration supply around +10 kV independent of the primary beam. The UI labels that separate stage; `photonYield` is a fixed assumed scintillator response, not a simulation of its HV circuit. This detector supply is absent from the BSE architecture; the primary electron gun still requires its accelerating supply.

The PMT gain is normalized to 10⁵ at 800 V with exponent 7. The noise estimate includes Poisson secondary generation, Poisson photoelectron yield, PMT excess noise, dark counts and amplifier noise. Larger PMT gain can overcome read noise; it cannot remove counting noise. Current above 100 µA is flagged illustratively but saturation is not calculated. All yields, gains and dark/read-noise values require actual hardware calibration.

## Frame timing

Current mode uses `settleTime + max(dwell, currentSamples/(0.9 × currentADCRate))` per pixel, with consistent units, plus configured retrace. Its default is 5 ms settling and 10 ms acquisition at 128 SPS for 32 × 32 pixels. The ADC clock allowance is included; SPI, I²C, software and serial overhead are additional. The firmware starts fresh single-shot conversions after the settling interval and waits for completion.

Legacy BSE / ET frame timing retains its configured intervals, historically 8 µs scan settling and 80 µs retrace. Detector RfCf settling is a separate calculation and does not silently replace those configured intervals; the user must select adequate dwell. Raster counts one retrace per row; other paths count one per frame. The numerical result is a minimum timing budget, not measured controller throughput: SPI transfers, ADC conversion, software and serial transport add time. Custom trajectories retain N² timing slots, including blanked points; their dose distribution need not be uniform.

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
| S11141-10 geometry, energy range, charge conversion and electrical anchors | [Hamamatsu S11141-10 datasheet](https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/s11141-10_s11142-10_kspd1083e.pdf), pp. 1–4 |
| Centered rectangular solid angle | [Crawford, UCRL-1753 (1953)](https://escholarship.org/content/qt58m1f8rr/qt58m1f8rr.pdf), corner-rectangle integral, combined here into four quadrants with the hole subtracted |
| Photodiode noise, TIA feedback and stability | [Hamamatsu Si photodiode technical note](https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/si_pd_kspd9001e.pdf), noise §2-4 and op-amp connections §3-1 |
| BSE collection geometry | [JEOL BSE detector](https://www.jeol.com/words/semterms/20121023.083357.php), placement and collection |
| Legacy ET detector chain | [JEOL ET detector](https://www.jeol.com/words/semterms/20121024.070858.php), independent collector, scintillator and PMT stages |
| PMT gain | [Hamamatsu PMT catalog](https://hub.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/etd/PMT_TPMZ1036E.pdf), gain and voltage dependence |
| Photon, dark and amplifier noise | [Hamamatsu detector selection guide](https://hub.hamamatsu.com/us/en/technical-notes/detector-selection/guide-to-detector-selection.html), “The noise problem”, Eq. 4 and PMT excess noise |

Timing, Gaussian aperture integration, geometric defocus, fluence, and the explicit empirical collection/Wehnelt curves are derived or defined in this repository. Their source links supply the physical context, not an assertion that a manufacturer published the simulator’s transfer curves.

## Verification

Run `npm test --prefix simulator` from the repository root. Checks include the independently published JEOL 1 kV values, energy-balance residual, plate polarity and classical limit, solenoid reversal and focusing, separate pressure scaling of neutral/electron collisions, analytical vacuum decay and pump permits, timing/fluence scaling and legacy PMT gain/noise limits. BSE checks cover solid-angle limits, separate current/gain factors, unsupported energies, bias anchors, zero-bias thermal noise, units, conditioning headroom, correlated-event noise, settling and blanking. See [the BSE review](REVIEW_BSE.md) for screenshot-based usability checks; these software checks do not certify physical performance.

## Legacy BSE adjustable side-mount geometry

The preserved BSE imaging preset uses `detectorOffset = 16 mm`, `detectorDistance = 14 mm` (vertical centre height) and `detectorTilt = 48.8°` from horizontal. Older snapshots lacking offset/tilt restore at zero, retaining the centred arrangement. `detectorMargin` defaults to 2 mm around an assumed 25×11×1 mm package envelope; `detectorBeamAllowance` defaults to 0.25 mm around the scanned beam-centre envelope. These are editable assumptions, not measured tolerances.

`detector-geometry.js` implements the projected-area solid-angle integral for a rotated rectangle minus a circular hole. The rectangle integral is analytic; a 512-point equal-area disk quadrature removes the off-axis hole. The centred result remains analytic. Side-mode collection readouts evaluate the source at the X scan centre; a 9×9 cached field map supplies relative image brightness across the scan. A face crossing the specimen plane is invalid and gives no modeled collection.

The sufficient X-clearance estimate includes the projected package, mounting allowance, maximum final-drift beam-centre X and beam/alignment allowance. Specimen-plane overlap is checked separately. Neither check traces beam interception or triggers blanking; the warning remains visible while the educational animation runs. Chamber, lens and cable collisions, angular BSE emission and topographic shading remain unmodeled. See [the mounting derivation and sources](MOUNTING.md). These side-mode definitions supersede the earlier centred-only collection description above.

Current-mode `exposureTimeUs` includes both the beam-on settling interval and the ADC-limited acquisition window. Electron count and uniform-raster dose use this full exposure, while legacy BSE/ET modes retain dwell-only exposure. Software/transport overhead is blanked in the generated current firmware.

## Scan-DAC quantization

`scan-hardware.js` models the chosen finite DAC codes. For selected output range VFS and N bits, ΔVDAC=VFS/2^N. An external differential driver with gain A referenced to VFS/2 gives ΔVplates=AΔVDAC; multiplication by the relativistic paraxial plate sensitivity gives the nominal displacement increment. DAC80502 defaults are16bits,2.5V and gain100. The 3.3V-powered module uses reference divide2 and buffer gain2 (GAIN register0x0103).

The raster includes both endpoints, so adjacent requested positions are separated by fieldWidth/(Npixels−1). The older pixelPitch=fieldWidth/Npixels remains an image-area/dose convention. Unique raster codes count the actual quantized set. The browser samples synthetic material at quantized beam positions and places samples at their requested image indices; repeated codes yield repeated positions. Custom paths are quantized too. DAC voltage noise, nonlinearities, midpoint drift, driver response and scan-coil/plate cross-coupling remain unmodeled. Quantization is not spatial resolution.

Reference: [TI DAC80502, transfer equation and reference configuration](https://www.ti.com/lit/ds/symlink/dac80502.pdf), sections8.3 and8.6. Prior MCP4922 uses [Microchip Equation4-1](https://ww1.microchip.com/downloads/en/DeviceDoc/22250A.pdf). The synthetic image blur uses a bounded linear-cost approximation rather than the previous8texture-pixel cap; the image buffers grow to512×512 for a512×512 raster. The larger grid samples the synthetic pattern more finely without changing the beam-size model.


### Detailed butterfly preset and playback

The 512×512 butterfly preset spans140µm with a20ms acquisition window,5ms settling, and two ADS1115 conversions per pixel at128SPS. The existing worst-clock allowance gives2/(0.9×128)=17.361ms, fitting within20ms; 512²×25ms plus512×80µs retraces gives6553.64096s. Nominal endpoint-inclusive spacing is140µm/511≈273.97nm. The DAC80502 still has512 distinct commanded positions per axis in this field.

Browser playback may multiply the rate at which already-modeled pixels appear. It does not divide hardware acquisition time or change the dwell, ADC settings, dose, beam size or noise calculation. Two readings are exported to the firmware; the current model conservatively retains its extra noise floor rather than asserting that averaging removes drift or correlated noise. Synthetic specimen geometry remains independent of measured material yields or depth.
