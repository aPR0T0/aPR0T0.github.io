# Biased metal electron collector — connections proposal

13 September 2026. A separate option from the near-ground specimen-current detector.

**Status: functional wiring proposal, not a construction-ready or voltage-qualified assembly.** No new PCB, rated feedthrough, optical firmware, measured noise floor or micrograph is supplied. The current Rev A specimen-current PCB must not simply be connected to collector bias: enclosure, insulation, connectors, guards, protection and readout need redesign and qualification.

## Purpose and references

A separate positively biased metal collector receives some secondary and backscattered electrons leaving the specimen. The amplifier measures net deposited-electron equivalent current at the collector; electrons escaping the collector reduce that current. Chamber-generated electrons may contribute. Geometry and bias affect collection, but this metal collector provides no intrinsic charge multiplication or clean SE/BSE separation. An uncoated insulating specimen can still charge.

- **SUM:** sensitive collector current input, approximately FCOM while powered feedback is within range.
- **FCOM:** floating local common and inner guard, at positive bias +Vc relative to chamber.
- **PE / chamber 0 V:** grounded chamber, stage and accessible outer enclosure.

The vacuum boundary and electrical insulation boundary are different. The collector is inside vacuum. Amplifier, ADC, local controller, battery supplies and optical transceivers stay outside vacuum in an inaccessible floating section within a grounded enclosure.

## Functional connections

```text
Inside vacuum                     Outside vacuum / floating section

Metal collector -- guarded ------ SUM --> LMC662 U1A -IN (pin 2)
                   feedthrough                 ^
                                               | 100 MΩ || 10 pF
                                         OUT (pin 1)
                                               |
                                         conditioner --> ADC --> local MCU
                                                                     ||
                                            fibre request + data channels
                                                                     ||
                                                         grounded scan ESP32

Collector bias + ------ FCOM --> U1A +IN (pin 3), battery midpoint,
                               ADC/local MCU common, inaccessible inner guard

Collector bias return -- chamber reference / PE (per supply specification)
Chamber, stage, accessible outer enclosure ---------------------------- PE
Conductive specimen contact -------------------------------- grounded stage
```

Bias connects to **FCOM, never directly to SUM**. Collector-to-bias and collector-to-ground wires would bypass or compromise the measurement. The collector reaches approximately FCOM through the powered amplifier's feedback loop, not by a direct short.

| From | To | Requirement |
|---|---|---|
| Metal collector | Guarded, insulated vacuum feedthrough centre → U1A pin 2 | Short sensitive lead; no second DC connection |
| U1A pin 1 | 100 MΩ in parallel with 10 pF → U1A pin 2 | Existing reference values, not a verified compensation choice for this collector |
| Bias-supply positive output | FCOM | Quiet, filtered, current-limited source with inhibit/discharge arrangement; maximum bias and transients determine ratings |
| FCOM | U1A pin 3, battery midpoint, ADC/local-controller common | No direct protective-earth bond |
| Floating +5 V regulator / −5 V regulator | LMC662 pins 8 / 4 | Voltages measured relative to FCOM; decouple locally |
| Local ADC supply | 3.3 V above FCOM | Keep both analog inputs within local supply limits |
| U1B conditioner output / local 1.65 V reference | ADS1115 A0 / A1 | Existing differential readout concept; measure dark zero and gain |
| ADS1115 SDA / SCL | Local floating MCU with 3.3 V local pull-ups | Direct grounded-ESP32 I²C is incompatible |
| Local MCU and optical transmitter/receiver | Grounded scan controller via two fibre channels | Inward request/pixel ID; outward fresh ADC code, pixel ID and status |
| FCOM guard connection | Input guards, rated inner cable shield, guarded supports and inaccessible inner shield | Low impedance guard current path separate from SUM; guard must not obstruct collector opening |
| Protective earth | Chamber, mechanical stage and accessible outer enclosure/outer shield | Dedicated PE bond; never substitute FCOM guard for PE |
| Bias-supply return | Designated chamber reference per supply documentation | The supply intentionally references FCOM to earth; the floating section is not isolated from its bias source |
| Conductive specimen | Grounded stage contact | For this collector-only arrangement; no specimen connection to SUM |

The diagram does not select physical spacing, connector types, collector placement or a working bias range. A grounded BNC shell is not a floating inner guard. Use an appropriately rated guarded feedthrough or suitable triax arrangement with independently routed centre signal, FCOM guard and PE outer shield. Qualify insulation and leakage over the actual pressure, humidity, temperature and transient environment.

## Existing-board connector reference

This table is a mapping for a future floating revision, not a retrofit instruction for the existing board.

| Existing reference | Proposed floating function | Difference from the current guide |
|---|---|---|
| J1.1 / SUM | Collector signal | Collector replaces specimen-current lead; new interface must be qualified |
| J1.2 / AGND | FCOM inner guard | Original chamber/grounded-shell connection is incompatible; PE requires a separate outer path |
| J2.1 / J2.2 / J2.3 | +5F / FCOM / −5F | All rails float at +Vc; no attached grounded supply or charger |
| J3.1 | Local floating MCU common | Not the existing grounded scan ESP32 common |
| J3.3 / J3.4 | Local SDA / SCL | Choose local MCU pins and implement a separate driver/protocol |
| J3.2 | 3.3 V local reference output | Do not power MCU/optics from it; use a separate filtered local regulator |
| J3.5 | Optional ALERT/RDY | Leave unconnected in initial polling design |

LMC662AIMX/NOPB SOIC-8 reference: U1A -IN 2, +IN 3, OUT 1; supplies 8 and 4. U1B pin 5 is local 1.32 V; pin 6 receives 40.2 kΩ from U1A output and 10 kΩ feedback from pin 7. Pin 7 drives protected/filtered ADC A0; A1 is local 1.65 V. Check the actual package/top-view drawing before wiring.

## Power, isolation and timing

Start with batteries and quiet local regulators to avoid introducing an isolated power converter's switching noise during the initial measurement. Battery power alone does not make a board voltage-qualified. Grounded USB, charger, programmer, scope ground and trigger wires must not bridge the floating boundary while biased. Accessible metal remains earthed; the FCOM inner shield remains inaccessible.

The bias source connects to FCOM. Any designed bias bleeder belongs on FCOM-to-PE, not on SUM. Collector transients and discharge into the input require a coordinated protection design; an ordinary clamp diode on SUM can introduce unacceptable leakage. Optical isolation does not protect the input from an in-vacuum discharge.

The old direct-I²C scan firmware cannot operate this optical link unchanged. Proposed handshake:

1. Grounded ESP32 places the beam and waits for scan/analog settling.
2. It sends a pixel-ID acquisition request via fibre.
3. Floating MCU starts fresh ADS1115 conversions and returns raw code, pixel ID and status.
4. Grounded ESP32 accepts only the matching completed reading before advancing.
5. Timeout, stale ID, clipping or detector power loss aborts acquisition and requests beam blanking. Hardware safety interlocks remain independent.

Select timing from actual settling, ADC rate and optical latency. The reference 100 MΩ / 10 pF time constant is 1 ms; a 128 SPS conversion alone is approximately 7.8 ms. Neither establishes the complete system's pixel rate or stability.

## Reference calculations

At an illustrative +200 V bias, FCOM = +200 V, +5F = +205 V and −5F = +195 V relative to chamber. The amplifier sees 10 V between its rails, with ±5 V relative to its local reference. +200 V is an example, not a qualified operating point.

For positive net deposited-electron equivalent current:

```text
V_TIA − FCOM = I_net Rf
10 pA × 100 MΩ = +1 mV
ΔV_ADC,diff = −(10 / 40.2) × I_net Rf = −248.756 µV
```

The sign for conventional current entering SUM is opposite. The nominal uncalibrated ADC offset is about −1.642 mV. At PGA ±0.256 V, the nominal scale is about 0.314 pA/code; this is quantization, not sensitivity. Resistor ratios, reference errors, offsets and leakage require calibration. The calculator flags modeled ADC or amplifier clipping, but does not simulate recovery.

```text
Residual SUM-to-chamber leakage magnitude = Vc / Rleak
200 V / 100 TΩ = 2 pA DC

Sine-wave displacement current peak = 2π f C Vripple,peak
2π × 50 Hz × 10 pF × 1 mV = 3.142 pA peak
```

The capacitance is residual SUM-to-chamber coupling; the ripple current is before amplifier/ADC filtering. This is distinct from input-to-guard capacitance. Do not add a DC offset and a sine-wave peak as if they were independent RMS noise sources. A same-potential guard diverts leakage from the input, but the exposed collector retains capacitance to the specimen/chamber. Vibration changing capacitance can also create current.

Holding bias steady during a scan, shielding/guarding the input, limiting digital interference and allowing settling after bias changes help reduce errors. Subtracting a dark baseline removes only a sufficiently stable offset.

## Verification sequence

1. After assembly qualification, commission at zero bias with the beam blanked. Verify local rails, references, optical communication and fault handling.
2. Calibrate with a quiet voltage source and independently measured resistor wholly within the floating section. For example, +1 V relative to FCOM through 100 MΩ injects +10 nA conventional current, equivalent to negative deposited-electron current, and drives TIA negative. Check both polarities, small-current linearity, noise and clipping. Remove calibration before collection.
3. Repeat the known-current measurement at zero and intended bias. Account for bias-ramp displacement current and measured settling. Compare gain, offset and drift.
4. Attach the actual feedthrough/collector, beam blanked. Measure current, noise, capacitance and drift with pumps, heater, scans and digital/optical circuits active. Check analog stability and overload recovery.
5. Run the raster blanked and with electrons intercepted upstream while electronics stay active. Look for false scan-correlated patterns.
6. Use a grounded conductive specimen, repeat beam-on/off cycles and scans, and vary separately measured beam current at constant energy. Vary bias only between measurements with settling.
7. Record raw codes, zero/gain calibration, bias, timing, beam current and fault status. Establish background contributions before interpreting the output as specimen-secondary-electron contrast.

An example target for 10 pA useful contrast is ≤1 pA RMS input-referred noise at the chosen pixel timing, with drift and systematic errors separately bounded. This is a proposed acceptance target, not measured hardware capability. Collector geometry may disturb the primary beam; neither optical isolation nor bias resolves specimen charging.

## Sources

- [TI LMC662 datasheet](https://www.ti.com/lit/ds/symlink/lmc662.pdf): pinout, feedback and same-potential input guarding.
- [TI ADS1115 datasheet](https://www.ti.com/lit/ds/symlink/ads1115.pdf): differential inputs, local supply limits and conversion timing.
- [Keithley Low Level Measurements Handbook](https://www.tek.com/de/documents/product-article/keithley-low-level-measurements-handbook---7th-edition): floating measurements, guarding, leakage and generated currents.
- [JEOL secondary electron detector](https://www.jeol.com/words/semterms/20121024.070858.php): electron collection fields and the separate multiplication in an ET detector.

The sources support physical/electrical principles, not this proposed assembly's performance or qualification.
