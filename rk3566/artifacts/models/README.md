# RK3566 Rev4: acquired models, executed studies and conclusions

The model search produced executable manufacturer data for three installed Murata ferrites, ISSI DDR3L input behavior and two official revisions of the SN74LVC1G125 logic macro. A TI LSF0102 model is used as an explicitly different-part proxy for the PCA9306 network. These studies add source-based device behavior to the earlier analysis, with suitable assumptions written beside each case. They do not establish complete-board startup, temperature, electromagnetic fields or EMC compliance.

Open the local [Model studies workspace](http://127.0.0.1:8766/#models) to select saved cases, overlay voltage/current responses, inspect actual saved samples, switch frequency-axis scaling, zoom to a numerical window and review assumptions, checks and downloadable results. The main behavioral sliders do not rerun these independent experiments. The existing [board and section review](http://127.0.0.1:8766/#sections) retains its native placement and all-section accounting.

The published package contains **8 studies and 55 executed cases**, including failures. Original models, downloads, source hashes, solver decks, logs and full waveforms are retained locally. Twelve acquired model artifacts appear in the register; acquiring an archive is not the same as running or qualifying it. Additional convergence executions remain in the corresponding raw directories.

The PCB, schematic, original behavioral engine and original saved runs remain unchanged. The new data records PCB SHA-256 `3ba4da7036173e31941ea22b041d1a2a3433c2bcdedccf1a75b1f52b31ce2807`, verifies all 36 frozen hardware inputs, and records the model, study-code, extraction and raw-result hashes needed for this analysis. The webapp checks those identities and warns if its saved results become historical.

## What was used and what it shows

| Study | Executed basis and explicit assumptions | Result and practical limit |
|---|---|---|
| Three ferrites, 12 cases | Original Murata RLC models; 25 °C, zero DC bias, small signal, 1 MHz–3 GHz. The fixture has 50 Ω source/load impedances and a 10 mV peak source perturbation. | Impedance and fixture insertion response plus settled 5/100/500 MHz voltage/current histories. This is not installed-board attenuation, DC loss or current-rating validation. |
| Native RESETn, 4 cases | Actual R221 = 10 kΩ and C240 + C82 = 200 nF nominal; assumed 3.3 V source ramp, 10 Ω asserted sink, release command at 40 ms, and an illustrative 70% threshold. | Release-to-threshold delay is about 2.406 ms at nominal capacitance, 1.684/0.962 ms at 70%/40% capacitance, and 2.557 ms with an assumed 10 µA leakage at nominal capacitance. This is RC sensitivity, not RK809/RK3566 reset qualification. |
| Four DDR DM routes, 25 cases | ISSI input/ODT/package data translated into a limited ngspice adapter; native route lengths; assumed Rockchip drive, line impedance and propagation speed. | Voltage and one input-path current versus time, with drive/edge/ODT/channel/model-corner comparisons. No complete DDR eye, DQS margin, training or DRAM supply-current claim. |
| TI buffer native loading, 5 cases | Unmodified official SCEM639 v2 macro, native U123/R125 = 33 Ω, valid fixed supply, and assumed camera loading. | Conditional clock/load curves are retained with the failed-reference warning. Damping in the board case does not qualify the macro. No cold-start or real camera-load qualification. |
| TI buffer revision comparison, 4 cases | Unmodified SCEM639 v2 and SCEM579 v1 under identical external reference conditions at 1.8/3.3 V. | V2 fails the output screening envelope; v1 passes the same bounded output and delay screens. The discrepancy remains open. V1 lacks complete supply-energy accounting, so it supplies no current budget or thermal prediction. |
| Translator proxy, 5 cases | TI's public LSF0102 three-MOSFET model with the native PCA9306 external resistor topology; assumed bus capacitance, sink and off-state loads. | Bus direction/loading and absent-source back-bias sensitivities. The model belongs to another part and does not predict exact PCA9306 limits or prescribe a bleed resistor. |

The primary model sources are [Murata's ferrite SPICE library](https://www.murata.com/en-us/tool/data/spicedata/netlist-ferritebead), [ISSI's DDR3 model catalog](https://issi.com.cn/US/product-dram-ddr3.shtml), [TI's SN74LVC1G125 product/model page](https://www.ti.com/product/SN74LVC1G125), and [TI's PCA9306-Q1 proxy discussion](https://e2e.ti.com/administrators1/f/1/t/1388289). Exact URLs, original versions and hashes are recorded in the three study reports and local acquisition manifests.

## Findings that affect the next decision

**The buffer model revision matters.** In the 1.8 V undamped reference, SCEM639 v2 produces approximately −0.822 to 3.517 V; its 3.3 V reference reaches approximately −0.838 to 6.146 V. These fail the declared output screen. Under the same external conditions, the older SCEM579 v1 gives 0.0225–1.7774 V and 0.00117–3.29883 V, with mean propagation delays of 3.113 ns and 1.747 ns. Both versions remain visible. This is a simulator/model-applicability discrepancy to resolve before making a hardware change; it is not evidence that the installed TI part physically produces those failed-reference excursions.

These are comparative screening fixtures with declared 25 MHz, same-amplitude ideal drive and a 15 pF external load. They differ from the datasheet timing fixture, including its generator impedance, repetition rate and 3.3 V test stimulus. A comparison with a published delay range is therefore a screening observation, not a datasheet-compliant timing qualification.

**DDR drive and termination assumptions materially change the waveform.** In the declared typical DM1 experiment, ODT off produces about −0.263 to 1.613 V; the 60 Ω ODT case produces approximately 0.204 to 1.143 V. The reported current is for the modeled input path. DM1 and DM3 native route lengths are 39.336 mm and 15.250 mm; their reference crossing times differ by about 144.5 ps under the assumed channel. That difference is not a setup/hold violation without the associated DQS and full channel. The IBIS min/max labels include 110 °C and 1.45 V characterization inputs; these are not authorized board operating conditions or calculated temperatures.

**The translator's absent-source voltage depends on what is connected to the rail.** With the assumed 1 ms external 3.3 V ramp and actual nominal 5 µF CAM_1V8 bypass, the LSF0102 proxy gives approximately 2.597, 2.390 and 1.288 V at 5 seconds for assumed 1 GΩ, 1 MΩ and 100 kΩ residual loads. The conclusion is that the real CAM_1V8 regulator discharge/sink behavior and attached off-state loads must be established. The numerical values are proxy sensitivities, not exact PCA9306 voltage predictions.

**An RF fit must stay within its intended use.** The BLM21PG601SN1 RF model extrapolates to 0.17 Ω at DC, whereas the retained catalog maximum DCR is 0.14 Ω. The file is specified from 1 MHz, so this discrepancy does not establish a defective part or justify substituting the fit into thermal losses. All three ferrite fits agree with an independent complex nodal calculation, and their settled sine responses agree with their AC results within 0.2%; those are numerical checks within the stated fit.

**Reset capacitance is only one part of startup.** Both native reset capacitors are included. Real PMIC output behavior, actual input thresholds, leakage, rail sequence and boot activity remain unresolved. None of the new nanosecond logic cases is a cold-boot simulation.

## Model applicability register: all 16 IC references

| Native reference | Fitted part | Current evidence and remaining restriction |
|---|---|---|
| U1 | RK3566 | No exact executable driver, SoC power/activity or boot model located in the bounded public search. DDR source is declared assumed. |
| U2 | RK809-5 | No executable exact PMIC model located. OTP, rail defaults and reset behavior still require authoritative evidence. |
| U3 | TCS4525 | No executable exact model located; the fitted revision/suffix conflict must be resolved before controller/DVS modeling. |
| U4, U5 | IS43TR16512BL-125KBLI | Original ISSI exact-family IBIS acquired. Input/ODT/package subset executed on four DM routes; full DRAM and complete channel behavior remain absent. |
| U6 | AW-CM256SM | No public electrical/RF functional model located in reviewed AzureWave resources. The attempted official datasheet URL returned 404; this is a bounded search result. |
| U7 | TPS566242 | Original exact PSpice archive already acquired; encryption prevents execution in the local open solver. Prepared WEBENCH work remains unexecuted. |
| U100, U121, U122, U123 | SN74LVC1G125DPWR | Official v2 and v1 macros executed as described above. Native loading cases cover U123; reference benches do not validate all four instances. Downloaded IBIS lacks DPW package data. |
| U110 | VL53L5CXV0GC/1 | No public electrical SPICE/IBIS model located in reviewed ST resources. Functional optical operation and mode-dependent load remain unmodeled. |
| U120 | PCA9306DQER | Encrypted exact HSPICE acquired, not executed; supplied package differs from DQE. Public LSF0102 model executed only as an explicit different-part proxy. |
| U130 | TLV320AIC3104IRHBR | Official IBIS acquired, not executed. Digital IO data cannot supply codec signal processing, startup or whole-chip power/thermal behavior. |
| U140 | TPA2012D2RTJR | Official PSpice and TINA archives acquired; both encrypted, neither executed here. |
| U150 | TPD2EUSB30DRTR | No exact public electrical model listed on the reviewed TI page. The TPD2EUSB30A model belongs to a different voltage variant and was not silently substituted. |

Critical passive models cover FB120/FB130 (BLM18AG601SN1), FB202 (BLM18PG121SN1), and FB140–FB143 (BLM21PG601SN1). The exact [Coilcraft XAL6030-222 model link](https://www.coilcraft.com/en-us/models/spice/?partNumber=XAL6030-222&seriesName=XAL60xx) was found, but the download returned HTTP 403; no model was acquired or executed. Exact boot-memory/crystal identities, bias-dependent capacitors, interconnect/return extraction and mounted-board thermal parameters are still required. A failed search or download does not prove a model does not exist.

## Verification and professional assessment

Each report distinguishes numerical consistency, a bounded reference screen, and physical correlation. Power uses independent RLC/RC solutions; the DDR adapter checks original table/sign fidelity, a matched-line analytical reference, time-step convergence, Kirchhoff current balance and domain limits. Peripheral checks preserve the failed v2 output screen, compare the old revision, and exercise time-step/loading/back-bias sensitivity. Successful solver completion never changes a failed reference into a pass.

The final package has 31 passing result checks and one retained failed model screen. The 51 relevant software tests pass. [Live browser verification](browser-validation.json) records plot/probe/overlay, warning, search, source-replacement and preserved-section checks; [HTTP verification](http-validation.json) confirms report/raw-result byte identity and rejection of unpublished files. A JSON-download serialization issue found during this check was fixed and regression-tested.

My assessment of this **bounded analysis package is 8/10**: 2/2 for traceable inputs, 2/2 for explicit assumptions and applicability, 2/2 for reproducible numerical checks and retained failures, 2/2 for inspectable results and a concrete handoff, and 0/2 for independent vendor-simulator/laboratory correlation. This is a transparent self-assessment of the delivered work, not a board approval score.

The separate **complete-board PRV-1 readiness baseline remains 2.5/10**. Exact main power-controller behavior, full-channel signal integrity, physical thermal evidence, executed boot and EMC qualification remain open. Repeating these scoped cases or changing assumptions to force a higher result cannot supply that evidence. The requested 8/10 whole-board target has not been reached.

## Reproduce and continue

Read the detailed [power report](power/report.md), [digital report](digital/report.md) and [peripheral report](peripherals/report.md) for their execution commands, source provenance, valid ranges and complete checks. The aggregate is [results.json](results.json); frontend controls and API behavior are documented in [WEB_MODEL_STUDIES.md](WEB_MODEL_STUDIES.md).

After all study input hashes match, run from `simulation/`:

```sh
python3 model_studies.py
python3 -m unittest test_model_studies test_service -v
python3 server.py --port 8766 --resume
```

Use [NEXT_MODEL_TASK.md](NEXT_MODEL_TASK.md) as the new agent's model-validation brief, together with the retained [94-finding PCB revision brief](../NEXT_PCB_REVISION_TASK.md). It specifies which model gaps and reference failures must be closed before proposing component, firmware or copper changes. No new task was launched and no PCB edits were made in this model acquisition pass.

Original manufacturer files remain local inputs with their notices preserved. The web export allowlist excludes original model code, archives and extracted solver runtime; Murata restricts redistribution. Reports and generated numerical results can be inspected through the app. A receiving agent should acquire restricted originals directly from the recorded manufacturer source and verify the original hash.
