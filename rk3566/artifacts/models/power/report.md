# Exact ferrite models and native reset RC study

Prepared 14 September 2026 for the frozen RK3566 revision 4. Three original Murata SPICE subcircuits were downloaded and executed using ngspice 42. A separate native reset-network study uses explicit substitute controls. The PCB, original rail engine and all previous simulation runs are unchanged.

## Models actually obtained and used

| Exact electrical part | Installed references | Manufacturer model | Executed scope |
|---|---|---|---|
| BLM18AG601SN1 | FB120, FB130 | Original unencrypted RLC subcircuit | 1 MHz–3 GHz impedance; settled 5, 100 and 500 MHz waveforms |
| BLM18PG121SN1 | FB202 | Original unencrypted RLC subcircuit | Same |
| BLM21PG601SN1 | FB140–FB143 | Original unencrypted RLC subcircuit | Same |

The final `D` in the board ordering codes is a packaging suffix. Each downloaded electrical family matches the native MPN stem; actual production qualification and approval-sheet revision remain separate. The original subcircuits and archives retain their notices and bytes. Download URL, time, archive SHA-256 and every archive-member hash are preserved in `vendor/`. Sources: [Murata ferrite-bead SPICE library](https://www.murata.com/en-us/tool/data/spicedata/netlist-ferritebead), [BLM18 archive](https://www.murata.com/-/media/webrenewal/tool/netlist/ferritebeads/v22/blm18-n-v22.ashx?cvid=20260805040259000000&la=en), [BLM21 archive](https://www.murata.com/-/media/webrenewal/tool/netlist/ferritebeads/v22/blm21-n-v22.ashx?cvid=20260805040318000000&la=en).

All three original headers specify **25 °C, zero DC bias and small signals**. Their frequency range is **1 MHz–3 GHz**. The webpage's generic 20 °C note differs; these experiments use the per-file 25 °C condition. The 50 Ω source, 50 Ω load and 10 mV peak excitation are an explicit reference fixture. They do not reproduce the board's biased supply, speaker, cable or capacitor impedances. Current shown is fixture branch current, not IC current.

## Results and implications

| Model | Computed impedance at 100 MHz | Nominal label |
|---|---:|---:|
| BLM18AG601SN1 | 617.085 Ω | 600 Ω |
| BLM18PG121SN1 | 122.954 Ω | 120 Ω |
| BLM21PG601SN1 | 620.812 Ω | 600 Ω |

The models now establish a reproducible frequency-dependent terminal response instead of using one constant resistance for RF behavior. The web plots also show the frequency-dependent insertion response in the 50 Ω fixture, and voltage/current phase and magnitude over the final five cycles of each sinusoidal experiment. Insertion response is normalized to the direct 50 Ω fixture's 5 mV output. It is not whole-board attenuation, shielding performance or an emissions result.

Each AC sweep is checked against an independent complex nodal solver built from the same original RLC coefficients. Maximum relative complex error is required below 1e-7. Nine settled sine experiments agree with AC-predicted output amplitude within 0.2%; observed maximum disagreement is below 0.05%. These verify implementation and numerical consistency, not the accuracy of the vendor fit against this board's actual operating conditions. Original transient turn-on is retained in raw files but the reported assessment is limited to settled sinusoidal response.

**Do not use these RF fits for DC or thermal conclusions.** In particular, the BLM21PG601SN1 model extrapolates to a 0.17 Ω series DC term, while the separately retained catalog maximum is 0.14 Ω. This does not demonstrate a defective component or contradict the model within its stated RF scope. Keep the published DCR/rating corners and bias-dependent impedance characterization separate. Camera/codec maximum-DCR and speaker-rating findings in the earlier whole-board review remain open.

## RESETn: actual components, explicit substitute behavior

The new analog deck contains native **R221 = 10 kΩ, C240 = 100 nF and C82 = 100 nF**. Its pull-up source ramps to 3.3 V in 1 ms. An assumed open-drain switch (10 Ω asserted, 1 TΩ released) opens at 40 ms. This switch is not an RK809-5 model, OTP program or validated sink characteristic. The illustrative receiving threshold is 70% of 3.3 V; no new RK3566 threshold is asserted.

| Effective capacitance | Assumed leakage | RC time constant | Delay after command to 70% |
|---|---:|---:|---:|
| 200 nF | 0 µA | 2.0 ms | 2.405947 ms |
| 140 nF | 0 µA | 1.4 ms | 1.684163 ms |
| 80 nF | 0 µA | 0.8 ms | 0.962379 ms |
| 200 nF | 10 µA sink | 2.0 ms | 2.557371 ms |

With the assumed 10 µA sink leakage, the asymptotic high level becomes 3.2 V. Capacitance factors and leakage are sensitivity cases, not qualified MLCC, PMIC or SoC corners. A finite asserted resistance leaves a small initial node voltage; this accounts for the small difference from the ideal zero-start 2.407946 ms result. Each simulated crossing is checked against the corresponding closed-form RC solution within 1 µs.

The conclusion is that a command release time and a receiving-pin threshold crossing must be represented separately. It is not a reason to remove either capacitor. Exact PMIC sink/release behavior, SoC thresholds/edge requirements, reset assertions and real power order are still required before approving a change or claiming boot.

## Searches that did not produce an executable exact model

- **TPS566242:** the [official TI product page](https://www.ti.com/product/TPS566242) still lists SLUM811. Its original model was previously acquired and is encrypted for PSpice; the different TPS564242 archive is not a substitute. No controller execution is claimed here.
- **RK809-5 / TCS4525:** bounded official-domain searches did not produce an executable public model. Exact PMIC OTP and [TCS4525](https://www.tctek.cn/product/tcs4525/) silicon/revision remain unresolved. Absence in these searches does not imply that private supplier models do not exist.
- **XAL6030-222MEC:** its [official product page](https://www.coilcraft.com/en-us/products/power/shielded-inductors/molded-inductor/xal/xal60xx/xal6030-222/) links a SPICE resource. That download page returned HTTP 403 to the available client. No model was acquired or run, and no alternative website identity was used to bypass the response.

## Reproduction and next work

From `simulation/`, run `python3 model-expansion/power/run.py`. It checks the frozen hardware identity and native selected-part values. It writes this study's own 16 cases and results; it does not update the original engine/campaign. Generated decks contain resolved paths to local original models; rerunning the generator resolves paths after relocation. `runs/` retains netlists, complete raw samples and ngspice logs. [result.json](result.json) records all conditions, checks, source identities and file hashes.

Next, acquire bias/current-dependent bead measurements or authorized operating-condition models, qualify actual decoupling/parasitics and source/load impedances, and obtain exact power-controller/PMIC behavior. Use the resulting networks to assess the installed branches and correlate with measurements. Obtain mounted-board losses and heat paths before predicting temperature. The public web downloads expose result data and reports; original Murata model files are kept local because the source restricts redistribution. Preserve vendor notices and obtain models from the linked manufacturer when transferring the workflow.
