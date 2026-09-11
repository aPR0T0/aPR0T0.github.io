# Scintillator and PMT — researched connection plan

Researched 11 September 2026. **Proposed design, not selected or purchased hardware.** The current `bom/simulation_parts.csv` detector row is generic and explicitly says no scintillator, PMT or gain calibration is selected. Consequently, the low-voltage connections below are exact for the named H10722 series, while a construction-ready high-voltage pinout requires the remaining assembly and supply selections. The original microscope run and BOM are preserved.

## Recommended starting architecture

Use a **conductively coated YAP:Ce scintillator in an ET detector assembly**, an insulating light guide and sealed optical boundary, and a **Hamamatsu H10722-110 module outside the vacuum**. This recommendation is an engineering inference from compatible spectral ranges and the module's integrated electronics, not a manufacturer-qualified combination.

An Everhart–Thornley detector uses a positively biased collection cage to gather secondary electrons, followed by a more positive scintillator surface that accelerates them into a light-producing material. JEOL's example is a collector at several hundred volts and an aluminum-coated scintillator at +10 kV. Those are separate electrode potentials relative to chamber reference. The PMT receives the emitted light through a light guide. [JEOL](https://www.jeol.com/words/semterms/20121024.070858.php)

YAP:Ce has a listed emission maximum of 370 nm and decay constant of 25 ns. It falls within the candidate PMT's spectral range. Specify an electron-detection coating and actual HV contact; a generic scintillation crystal or a gamma-ray detector assembly is not automatically a suitable ET detector. Crytur supplies conductive coatings and custom microscopy detector assemblies; obtain a matched assembly drawing rather than inventing coating thickness, adhesive, standoff or vacuum-seal dimensions. [Crytur material data](https://www.crytur.com/materials/yap-ce/), [coating options](https://www.crytur-usa.com/products/scintillation-screens/), [microscopy assemblies](https://www.crytur-usa.com/products/detection-units-for-electron-microscopy/)

The H10722-110 includes the tube, internal HV generator and transimpedance amplifier. It is therefore a simpler starting point than a bare PMT requiring a socket, dynode divider and separate HV supply. Its output bandwidth is DC–20 kHz. This is a deliberate tradeoff for simple wiring and slow initial scanning, not a fast-SEM readout recommendation. [Hamamatsu product specifications](https://www.hamamatsu.com/eu/en/product/optical-sensors/pmt/pmt-module/voltage-output-type/H10722-110.html)

## Exact module lead connections

Applies to **H10722**, verified against **TPMO1063E03, July 2026, Figures 3, 4 and 8**. Confirm the revision supplied with the actual module. The related H10721 is a current-output module and does not have this same complete lead/power arrangement.

| Module lead | Connect to | Meaning |
| --- | --- | --- |
| RED | Regulated +5 V | Positive power rail, relative to BLACK |
| GREEN | Regulated −5 V | Negative power rail, relative to BLACK; not ground |
| BLACK | Supply midpoint / low-voltage common | Reference for both rails and control voltage |
| WHITE | Stable +0.5 to +1.1 V, referenced to BLACK | Gain-control input; start at +0.5 V |
| BLUE | Insulated, unconnected when using an external control source | +1.2 V reference **output**, not a supply input |
| RG-174/U coax center | High-impedance, DC-coupled scope/DAQ signal input | Amplified voltage signal |
| Coax shield | Instrument signal return | Not a scintillator-HV or protective-earth conductor |

The manufacturer's alternative uses a 10 kΩ potentiometer driven from the module reference. Its wiper goes to WHITE; monitor WHITE-to-BLACK and keep it at or below +1.1 V. Full travel toward a +1.2 V reference can exceed the allowed control input. For first bench tests, use a verified bounded external control source and insulate BLUE. Do not directly drive WHITE from a 3.3 V GPIO or raw PWM.

**No external 1.1 kV PMT supply and no +10 kV connection goes to this module.** It must not operate in vacuum or reduced pressure. Follow the manufacturer's light-exposure and operating instructions. [Hamamatsu datasheet](https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/etd/H10722_TPMO1063E.pdf)

## Scintillator, collector and grounding connections

These are electrical nets, not guessed connector pin numbers:

| From | To |
| --- | --- |
| Scintillator supply positive HV output | Approved HV cable → rated vacuum feedthrough → manufacturer's specified conductive coating contact |
| Scintillator supply HV return | Defined chamber-reference point, per supply documentation |
| Collector supply positive output | Separate insulated feedthrough → collector cage |
| Collector supply return | Defined chamber-reference point |
| Chamber and exposed conductive enclosure | Dedicated protective-earth bond |
| Scintillator optical exit | Insulating light guide → sealed optical boundary → light-tight PMT coupling in air |
| PMT signal return | Low-voltage acquisition reference, with the reference-to-chassis arrangement intentionally defined |

Do not short the cage to the scintillator coating. Do not use the light guide or signal coax as an HV return. A shared voltage reference does not justify routing HV discharge current through a small signal ground. Keep protective earth, HV return and measurement return identifiable in the wiring drawing.

Choose an enclosed, regulated **positive** scintillator supply with the assembly-approved range, current limiting, remote inhibit, voltage monitoring and specified discharge behavior. Determine the current rating from all loads, leakage and any discharge/bleeder network; the modeled secondary-electron current is not the total supply load. Separate supply *outputs* can share one commercial enclosure: Spellman's EBM-TEG is evidence of independent scintillator, collector and PMT channels, not a recommendation to replace your existing gun controller with that much larger system. [Spellman example](https://www.spellmanhv.com/-/media/en/Products/EBM-TEG.pdf)

Select feedthroughs and mating HV cables for the actual voltage, pressure, flange and environmental conditions. A connector that looks like BNC does not establish a 10 kV rating. Do not infer insulation spacing or energization pressure from the drawing. [Lesker selection guides](https://www.lesker.com/feedthroughs-viewports.cfm?section=feedthrough-selection-guides)

## Signal limits and the existing simulator

The standard module's conversion is approximately **1 V/µA**, and its specified maximum signal output is **+4 V at a 10 kΩ load**. Use a 1 MΩ scope input initially; a 50 Ω termination is not interchangeable with this condition. The existing generic run's approximately **21.7 µA** mean PMT current would demand approximately **21.7 V**, exceeding this module's nominal output capability. That is a compatibility failure, not a predicted 21.7 V output. Reduce light/current or PMT sensitivity, or choose a readout with lower transimpedance. A practical initial measured target around 0.2–2 V gives headroom; that target is an engineering starting point. [H10722 specifications](https://www.hamamatsu.com/eu/en/product/optical-sensors/pmt/pmt-module/voltage-output-type/H10722-110.html)

The existing simulation's `PMT voltage = 1100 V` is **not** `Vcont = 1.1 V`. Its generic gain law cannot calibrate this module. Measure tube/module sensitivity versus Vcont; optical collection, actual scintillator light yield and gain remain uncalibrated. The new web page makes an output-headroom check using an explicitly assumed anode current; it does not silently substitute H10722 gain into the microscope.

For the scintillator, an electron starting near ground gains `ΔK = eΔV`, so +10 kV gives about 10 keV landing energy. The intermediate +250 V collector does not make the endpoint energy 10.25 keV. This endpoint calculation does not specify light yield. [OpenStax](https://openstax.org/books/university-physics-volume-2/pages/7-2-electric-potential-and-potential-difference)

At 20 kHz, a single-pole approximation gives `τ = 1/(2πf) = 7.96 µs` and `t1% = −ln(0.01)τ = 36.65 µs`. This is an estimate of signal step settling, not a measured H10722 specification. Begin around **100 µs or longer per pixel**, then measure scan-to-signal settling. The module's gain-control settling specification is a separate, much slower effect. Adequate ADC sampling and antialias filtering remain necessary even when pixel dwell is long. [Settling principles](https://www.analog.com/jp/resources/interactive-design-tools/settle-multiplexers.html), [sampling principles](https://www.analog.com/media/en/training-seminars/tutorials/MT-002.pdf)

For faster operation, a separate current-output module such as H10721-110 plus a lower-transimpedance amplifier is an alternative. Hamamatsu's C7319 offers 0.1, 1 or 10 V/µA and selectable bandwidth. This route adds power and amplifier wiring and must be designed separately. [H10721 datasheet](https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/etd/H10720_H10721_TPMO1062E.pdf), [C7319](https://www.hamamatsu.com/jp/en/product/optical-sensors/pmt/accessory-for-pmt/amplifier-unit_amplifier-module/C7319.html)

## Scope first; ESP32 acquisition afterward

Do not connect the unconditioned module output directly to the ESP32's current ADC input. The existing firmware expects a buffered approximately 0.15–3.1 V signal, whereas this module can output about 4 V and has offset and overload behavior to accommodate.

An **ADS8681-based acquisition board** is a candidate: it supports a ±5.12 V input range, at least 1 MΩ input resistance, a 5 V analog supply and a separate 3.3 V digital supply. At the functional interface, coax signal goes to AIN_P, signal return to AIN_GND, and its SPI interface connects to the controller with the correct logic supply. This does not define a complete PCB: decoupling, reset/reference connections, input protection, connector mapping, layout and driver timing must follow TI's implementation guidance. The existing sketch is **not an ADS8681 driver**; no firmware change or automatic pin assignment has been claimed. First characterize the detector using the scope, then implement and validate the acquisition board/driver. [TI product](https://www.ti.com/product/ADS8681), [TI datasheet, pin table and §8](https://www.ti.com/lit/ds/symlink/ads8681.pdf)

## Work sequence

1. **Obtain the assembly drawing and supply specifications.** Specify the coating contact, optical throughput, vacuum seal, flange, permitted electrode potentials and operating pressure. Verify PMT spectral/area matching and the mechanical interface.
2. **Bench-test the PMT module with scintillator HV disconnected.** Cover the window, verify both LV rails and Vcont, connect the high-impedance scope, then check dark baseline. Do not expose a powered high-gain PMT to bright room light.
3. **Characterize with a very weak, controlled light source.** Record dark offset, response versus Vcont and output clipping. Allow gain-control changes to settle. Keep headroom and keep the optical assembly light-tight.
4. **Integrate the vacuum and HV system.** Have a qualified vacuum/HV engineer check bonding, returns, feedthrough ratings, insulation, inhibit and discharge arrangements. Keep HV inhibited while pumping/venting; use actual equipment limits.
5. **Commission at the specified vacuum.** Follow the detector/supply ramp procedure with the beam blanked, inspect dark response, then introduce a low-current beam. Adjust collection and PMT gain separately while watching saturation and HV behavior.
6. **Calibrate acquisition and scan.** Start slowly, measure response, subtract the dark baseline, and verify the ADC path before increasing speed. For shutdown, blank the beam, inhibit HV, verify discharge and follow the equipment's pump/vent sequence.

No universal current limit, HV ramp rate, electrode spacing or discharge delay can be assigned until the missing hardware is identified. That is the remaining work required to turn this connection plan into an energizable instrument drawing.

## Procurement brief you can send to a detector supplier

> Please propose a secondary-electron Everhart–Thornley scintillator/collector assembly for a grounded specimen chamber and a 1–5 keV primary electron microscope. Candidate material is conductively coated YAP:Ce with an electrically identified coating contact, an insulating light guide and a vacuum-sealed optical exit suitable for coupling to an 8 mm air-side PMT window. Please provide assembly/flange drawings, coating/contact details, the required scintillator and collector bias ranges and polarities, permitted pressure and temperature, insulation/feedthrough requirements, cable interfaces, optical output/throughput data near 370 nm, and commissioning/discharge instructions. An example +10 kV scintillator and +250 V collector has been used for planning only; please specify your actual required ratings.

This is a draft brief, not a message sent or an order placed.
