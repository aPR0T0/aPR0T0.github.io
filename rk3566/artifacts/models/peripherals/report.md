# Peripheral manufacturer-model studies

The saved package executes **14 experiments across three studies** using two original TI SN74LVC1G125 model revisions and an explicitly identified TI LSF0102 proxy for the PCA9306 external circuit. The newer buffer model fails one reference screen; the older revision passes its two bounded reference screens. These outcomes are retained together. They do not establish complete IC power, startup, thermal, EMI/EMC or board readiness. The retained professional readiness score remains **2.5/10**.

All hardware remains frozen at PCB SHA256 `3ba4da7036173e31941ea22b041d1a2a3433c2bcdedccf1a75b1f52b31ce2807`. The original engine SHA256 remains `e8981c307ede683836aa755d9e1bb3d182be0e42a5bc07f471682becbed18c2c`. All 36 original source hashes and 24 prior analysis-input hashes were checked unchanged. This work adds files only under `simulation/model-expansion/peripherals/`.

## Exact native identities and model availability

[Native identity and pin mapping](native-identity.json), [acquisition manifest](acquisition-manifest.json), [additional acquisition manifest](extra-acquisition-manifest.json), and [bounded availability review](availability-notes.json) retain the evidence. Original downloaded files and archive contents retain their notices and individual SHA256 hashes. Eight model artifacts were acquired; downloading a model is distinct from executing or qualifying it.

| Native references / exact MPN | Public manufacturer evidence | Executed scope and remaining gap |
|---|---|---|
| U100, U121–U123 / SN74LVC1G125DPWR | [SCEM639 v2](https://www.ti.com/lit/zip/scem639), [SCEM579 v1](https://www.ti.com/lit/zip/scem579), [SCEM270 IBIS](https://www.ti.com/lit/ibs/scem270) | Both original readable macro revisions executed. V2 reference output screen fails; v1 passes the same bounded output and delay screens. Downloaded IBIS omits native DPW package data. |
| U120 / PCA9306DQER | [SCEJ212 HSPICE](https://www.ti.com/lit/zip/scej212); [TI support supplies an LSF0102 proxy](https://e2e.ti.com/administrators1/f/1/t/1388289) | Exact HSPICE is encrypted and supplied with TSSOP package data; not executed. Public PCA9306 IBIS link returned 404. Original public LSF0102 macro executed only as an other-part proxy. |
| U130 / TLV320AIC3104IRHBR | [SLIM118 IBIS](https://www.ti.com/lit/zip/slim118) | Acquired but not executed. Digital IO data is not a codec analog-processing, total-power, startup or thermal model. |
| U140 / TPA2012D2RTJR | [SLOM162 PSpice](https://www.ti.com/lit/zip/slom162), [SLOM159 TINA](https://www.ti.com/lit/zip/slom159) | Both implementations are encrypted; not executed in ngspice. No decryption attempted. This board uses TPA2012D2, not TPA2016D2. |
| U110 / VL53L5CXV0GC/1 | [Official ST product resources](https://www.st.com/en/imaging-and-photonics-solutions/vl53l5cx.html) | No public electrical SPICE/IBIS or internal ranging-current/thermal model located in reviewed resources. Drivers, optical tools and mechanical CAD do not supply those quantities. Direct downloads timed out. |
| U6 / AW-CM256SM | Retained board AzureWave reference and [official datasheet URL](https://www.azurewave.com/img/wireless-modules/AW_CM256SM_DS_Rev15_CYW.pdf) | No public electrical/RF functional model located in reviewed material; the direct URL returned 404. Internal Wi-Fi/BT activity, TX current and temperature remain unknown. |
| U150 / TPD2EUSB30DRTR | [Exact TI product](https://www.ti.com/product/TPD2EUSB30), [different TPD2EUSB30A variant](https://www.ti.com/product/TPD2EUSB30A) | No electrical model listed on the reviewed exact product page. The A variant has IBIS but different working/breakdown voltage; it was not substituted. Part-level ESD ratings do not establish system immunity. |

Availability statements are bounded to the reviewed official resources on 2026-09-14. They do not imply that manufacturer support cannot provide further models. The PCA9306 HSPICE header restricts redistribution without TI permission: retain it locally and preserve its notices. Original vendor archives are not a public web download bundle.

## Executable method and numerical controls

`run_studies.py` loads the installed **ngspice 42 shared library**, then matching XSPICE code models extracted locally from the [official Ubuntu 42+ds-3build1 package](https://archive.ubuntu.com/ubuntu/pool/universe/n/ngspice/ngspice_42+ds-3build1_amd64.deb). Package SHA256 is `466c4c06418107ceaa9c9457065b3bb71a9d9dc5ec6fef186d7de9d5208ce8db`, checked against the distribution metadata. The [runtime manifest](runtime-manifest.json) records all six library hashes. No system installation was made. The existing `simulation/spice_check.py` ctypes wrapper was reused without modification.

The simulator uses its PSpice compatibility mode for the original TI TABLE/VSWITCH constructs. **No vendor equations or model files were edited.** The final decks set `.temp 25` explicitly; solver logs confirm 25 °C, with ngspice default nominal device temperature 27 °C. This is one declared operating temperature, not a temperature sweep or a claim that every model includes adequate temperature physics. Initial runtime diagnostics outside `cases/` are not evidence for the published results. Earlier temporary syntax-port experiments are unused.

Every published case preserves its request, exact deck, solver log, execution hashes and complete adaptive samples in `cases/<id>/{request.json,circuit.cir,solver.log,execution.json,raw.json,raw.csv}`. `result.json` contains display traces with a declared sample stride, axis units and raw sample count; metrics use full samples. It records code, native-input, model, runtime and raw-output hashes for stale-data rejection. Display thinning is not used for calculating delay, means or charge balance.

All 14 final experiments completed. Nine of ten result checks pass. The retained failure is the SCEM639 undamped-reference output screen; software tests explicitly require it to remain visible. The separate `test_peripherals.py` verifies provenance, native pin mapping, logged temperature, external capacitor charge balance, step sensitivity, actual display samples, proxy labeling and unknown quantities. Passing numerical checks does not turn a failed model reference or an assumed boundary condition into hardware validation.

## Study 1 — newer TI SCEM639 and native U123/R125

The native U123 supply is `CAM_1V8`; input is `OSC_25MHZ`; output passes from `CAM_MCLK_BUF` through **R125 = 33 Ω** to `CAM_MCLK`. Its OE and ground are both tied to ground. Physical pins 1/2/3/4/5 are explicitly mapped to macro ports OEZ/A/AGND/Y/VCC; the macro declaration itself uses Y/A/OEZ/VCC/AGND. Native C126 = 100 nF is included on an ideal VDD source.

SCEM639 identifies itself as an automated family-derived macro for the exact part, intended for typical behavior at 25 °C and tested in TINA-TI. The [current part datasheet](https://www.ti.com/lit/ds/symlink/sn74lvc1g125.pdf) supplies the operating and timing references. This does not supply exact DPW package parasitics, real oscillator waveform, camera IO model, flex impedance or process corners.

The comparative reference benches use 1.8/3.3 V supply and matching input amplitude, 25 MHz input with 2 ns edges, 15 pF external load, 120 ns duration, and a 1 µΩ numerical connection representing no board series resistor. The latter half is used for reported extrema and edge metrics. These are controlled comparisons between model revisions, **not reproductions of the complete datasheet fixture**: SCES223U Figure 6-1 specifies a repetition rate up to 10 MHz and a 50 Ω generator; at 3.3 V VCC it uses 3 V input and a 1.5 V crossing, whereas these benches use 3.3 V input and a 1.65 V crossing. Timing checks therefore screen against the catalog range under different fixture conditions. The figure's output resistor branch is open for propagation-delay measurement.

| V2 reference VCC | Output minimum / maximum | Mean 50% delay | Output screening |
|---|---:|---:|---|
| 1.8 V | −0.821512 / 3.516945 V | 4.061797 ns | Failed |
| 3.3 V | −0.837649 / 6.145674 V | 2.193408 ns | Failed |

The declared screening envelope is −0.3 V to VCC + 0.3 V. It is a reference-model sanity criterion, **not** a datasheet output-tolerance requirement. Delays fall within the cited 15 pF timing range under the different fixture just described; this indicative comparison cannot qualify the output behavior. The macro has a 0.1 nH output element in parallel with its behavioral output conductance; this structure warrants a vendor/simulator cross-check. The stored ringing is a model-response finding, not evidence that the physical PCB produces these excursions. Reference rise times are left unknown because repeated ringing crossings do not define a simple monotonic edge.

The native-R125 benches use ideal 1.8 V VDD, 3.3 V input, the same 25 MHz/2 ns stimulus, and **assumed** 10/30/100 pF receiver-plus-interconnect capacitance. Duration is 400 ns; these are fixed-supply clock experiments, not startup. A 1.65 V operating-edge case and a maximum-step halving case are retained separately.

| Declared native-load case | Loaded output min / max | Mean input-to-output delay | Output 10–90% rise |
|---|---:|---:|---:|
| 10 pF, 1.8 V | approximately 0 / 1.8000 V | 4.252778 ns | 0.718385 ns |
| 30 pF, 1.8 V | approximately 0 / 1.8000 V | 4.711071 ns | 2.168392 ns |
| 100 pF, 1.8 V | 0.005609 / 1.796910 V | 6.301658 ns | 7.245818 ns |
| 30 pF, 1.65 V | approximately 0 / 1.6500 V | 4.741845 ns | 2.168470 ns |

Halving the maximum step from 0.1 to 0.05 ns changes the 10 pF mean delay by **0.047757%**. External R–C integrated charge balance is checked independently. Those checks support the numerical response of the declared circuit. Native 33 Ω damping does not repair or qualify the separate vendor reference. All these plots carry a model-qualification warning. Their macro VDD-port currents are labeled estimates and cannot be placed into a hardware power budget; no internal currents or temperatures are inferred.

Native U100/U121/U122 use the same exact part, but these camera-clock experiments are not their individual switching-current simulations. OE tied low also means the normal operating model cannot establish power-up tristate behavior. VCC below the specified 1.65 V operating minimum and startup through zero require a separate qualified study; SCEM639 includes formulas dividing by VCC. Ioff specified at zero supply does not characterize the whole intermediate ramp.

## Study 2 — native PCA9306 external network with LSF0102 proxy

The [original TI LSF0102 model](https://e2e.ti.com/cfs-file/__key/communityserver-discussions-components-files/151/LSF0102.cir) is retained unchanged. TI support suggested it in a PCA9306-Q1 simulation discussion. Its three generic MOSFETs use KP = 22 mA/V² and VTO = 0.7 V. These parameters are **not exact PCA9306DQER characterization**.

The board-side connectivity is exact: U120 VREF2 and EN share `CAM_I2C_BIAS`; R120 = 200 kΩ connects that node to `3V3_PER`. Both SCL and SDA have 2.2 kΩ pull-ups on each side, R110/R111 to `3V3_PER` and R121/R122 to `CAM_1V8`. Proxy pin mapping is recorded explicitly. The powered cases assume 50 pF on each low-side line, 100 pF on each high-side line, and a 10 Ω ideal open-drain sink. Both channels remain present; only SCL is pulsed at 400 kHz for 15 µs.

| Active sink location | Asserted SCL low-side minimum | Asserted SCL high-side minimum | Low / high 30–70% release rise |
|---|---:|---:|---:|
| Camera/low side | 0.022805 V | 0.060081 V | 74.014 / 210.370 ns |
| Host/high side | 0.043004 V | 0.022882 V | 74.014 / 210.369 ns |

These values illustrate conditional bidirectional port behavior. They do not establish maximum I2C speed, transaction success, receiver thresholds or actual PCA9306 Ron/leakage corners.

The partial-power cases remove the ideal camera-rail source, release both bus drivers, ramp the external 3.3 V source over 1 ms, and retain **5 µF nominal local bypass** from native C121 + C124 + C125 + C126. The assumed residual rail loads are sensitivities, not proposed new resistors or measured off-state impedance.

| Assumed CAM_1V8 residual load | Low-domain rail after 5 s | R120 bias current at 5 s |
|---|---:|---:|
| 1 GΩ | 2.597494 V | 0.001097 µA |
| 1 MΩ | 2.389773 V | 0.994137 µA |
| 100 kΩ | 1.288144 V | 6.429565 µA |

These are **end-of-experiment values**, not guaranteed steady states or physical rail predictions. Bias and bus pull-up paths can both supply the low domain; R120 current alone is not the total rail injection. The result demonstrates why unpowered-domain loading matters. The [PCA9306 datasheet, §8.1.7](https://www.ti.com/lit/ds/symlink/pca9306.pdf) separately discusses its bias-current mechanism. Actual regulator sink behavior, discharge paths, camera IO clamps, leakage and sequencing must be known before selecting isolation or bleed changes. No resistor value is prescribed from this proxy.

## Study 3 — older official SCEM579 v1 reference comparison

The distinct original v1 macro uses physical-order ports OE/A/GND/Y/VCC. It was run with the **same** supplies, stimulus, 15 pF external load, temperature, 120 ns duration and reference connection as v2. Its own 30 pF output capacitor remains untouched.

| V1 reference VCC | Output min / max | Mean 50% delay | Output 10–90% rise | Bounded screens |
|---|---:|---:|---:|---|
| 1.8 V | 0.022484 / 1.777432 V | 3.112726 ns | 10.058373 ns | Output and delay pass |
| 3.3 V | 0.001175 / 3.298827 V | 1.746937 ns | 5.533443 ns | Output and delay pass |

This comparison prevents a v2 outcome being attributed to every manufacturer model for the part. It also exposes a separate v1 limitation: its behavioral output source does not draw complete output energy through VCC. **No v1 supply-current plot, total-current estimate or thermal prediction is published.** Two passing reference screens do not qualify the native package, temperature/process corners, actual load, startup or OE timing. V1 has not silently replaced the saved v2 native-clock experiments.

## Decisions for the next validation task

| ID | Concrete next work | Completion evidence |
|---|---|---|
| PER-M01 | Cross-check both original buffer revisions in the vendor-supported simulator; request a vendor-confirmed model or explanation of v2 undamped output behavior. Keep the current failure and successful v1 reference results. | Same stimulus/load comparison, logged solver/version, reference waveforms, and a documented model-validity decision. Do not edit equations merely to obtain a pass. |
| PER-M02 | Obtain native DPW package and actual camera/Y120/connector/receiver models; extract the real `CAM_MCLK_BUF`/R125/`CAM_MCLK` route and load. Use a qualified model for U100/U121/U122 activity separately. | Receiver threshold/timing and waveform margins across relevant conditions; extracted geometry, model licenses and hashes. No whole-net current assigned to every IC. |
| PER-M03 | Resolve actual CAM_1V8 off-state source impedance, discharge, sensor clamps and power sequencing around U120/J121 before considering bleed or isolation changes. | Source-qualified partial-power circuit and measurements at VREF1/VREF2/SCL/SDA, with limits for all affected devices. Preserve the proxy cases as hypotheses. |
| PER-M04 | Execute the original TPA2012D2 encrypted model in a licensed compatible environment and map the exact RTJ pins, gain/enable state, output filters and measured speaker impedance. | Reproducible vendor-compatible audio/startup outputs and a separately qualified power/thermal method; no ngspice decryption workaround. |
| PER-M05 | Validate the codec IBIS pin/voltage selection against U130 native wiring and supply suitable SoC endpoint/interconnect models. Request complete codec power/startup evidence separately. | Digital-interface qualification plus independent register/configuration and analog-power evidence. IBIS alone does not close codec operation. |
| PER-M06 | Request exact U150 model or characterize its own variant; obtain bounded ST/AzureWave activity/current evidence for U110/U6. | Correct exact-part model identity or measured/qualified substitutes, explicit limitations, and retained unknowns. No ESD/EMC or temperature claim from a generic model. |

## Reproduction and artifact contract

From the `rk3566-sbc-rev4` project directory, with the retained local runtime and matching installed ngspice 42 library:

```sh
python3 simulation/model-expansion/peripherals/run_studies.py
python3 simulation/model-expansion/peripherals/test_peripherals.py
```

To rebuild metadata/display summaries from existing raw results without changing numerical outputs, the following validates saved deck and output hashes first; missing cases are executed:

```sh
python3 simulation/model-expansion/peripherals/run_studies.py --summarize
```

`result.json` is the web integration contract: five native clock cases in `exact-buffer`, five proxy cases in `translator-proxy`, and four v1/v2 comparative cases in `buffer-revision-comparison`. It includes typed metrics and traces, mixed reference outcomes, limitations, model registry, acquisition evidence and `analysis_input_hashes`. The original raw model artifacts remain local. The older broad statement that every IC model was unavailable described the earlier evidence snapshot; this new package records exact port-model acquisitions and executions without rewriting historical results or claiming full internal IC coverage.
