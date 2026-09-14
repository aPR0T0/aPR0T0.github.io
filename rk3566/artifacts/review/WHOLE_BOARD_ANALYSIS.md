# RK3566 Rev4 — complete PCB section analysis

**Review scope: all 26 native functional sections, 422 electrical references, 1,890 unique physical pins and four mechanical mounting holes.** The review contains 94 section-specific observations, concerns and evidence gaps; these are not 94 proved component failures.

The review is complete at the level of native circuit/layout inspection, retained behavioral results, fresh targeted geometry calculations, and source-based engineering analysis. It does **not** establish full-board electromagnetic fields, every IC’s dynamic current, mounted temperatures or successful RK3566 execution. Missing quantities stay unknown. Full-board physical-validation readiness remains **2.5/10** under the existing fixed rubric.

Open [All PCB sections](http://127.0.0.1:8766/#sections) for the board map, section selection, voltage/current waveforms, complete component values, pin tables and findings. The [next PCB task](NEXT_PCB_REVISION_TASK.md) turns the conclusions into implementation work and acceptance checks. The original [handoff](NEXT_AGENT_HANDOFF.md) and its retained fault cases remain applicable.

## Frozen sources and interpretation

- PCB SHA-256: `3ba4da7036173e31941ea22b041d1a2a3433c2bcdedccf1a75b1f52b31ce2807`.
- Engine SHA-256: `e8981c307ede683836aa755d9e1bb3d182be0e42a5bc07f471682becbed18c2c`.
- Native primary sheet ownership accounts for all 422 components once: 405 populated and 17 DNP. Shared U1/U2/DRAM units are also reviewed on every sheet where their pins appear. All 1,890 physical pins are mapped; 1,662 are connected endpoints. The remaining pins are explicit no-connects, not missing wires.
- Selected snapshot: **run-0027**, 4.75 V input, 120 mΩ source resistance, load scale 1.0, 25 °C ambient, 0.7 capacitance factor, 1.39 ms assumed ramp parameter, requested reset 40 ms, 5 µs integration step and 160 ms duration.
- Nominal comparison: **run-0004**, 5 V input. Campaign envelope: **run-0004 through run-0016**, 13 separate scenarios. All retain matching PCB and engine identities. The low-input/high-load/resistance/capacitance/temperature combined case and intentionally adverse reset/brownout cases remain visible.
- Recorded component startup maxima end at the **requested** reset time: 40 ms for the selected and nominal runs, 5 ms for the deliberately early-reset case. They can omit later physical startup or delayed model release; they are not complete cold-start envelopes. Steady metrics use the final 20%, 128–160 ms for the selected run. Rail `peak_current_a` spans the full experiment. Extrema from different scenarios are not simultaneous operating points.
- The selected behavioral run provides startup current estimates for **186 populated references: 178 ideal capacitors, seven averaged inductors and R227**. **219 populated references lack individual startup current results**, including all 16 ICs. Capacitor zero steady average/ideal real loss does not mean zero switching RMS, leakage or ESR heating. Only L219/C382–C385 have the separate resolved local U7 branch histories. Only L219 has a separate illustrative thermal node.
- Values such as named supply potential, branch voltage, rail demand, branch current, dissipated power, field magnitude and temperature have different meanings. This report preserves the component model’s scalar voltage definition and includes full per-pin evidence in the JSON. No rail current is distributed arbitrarily among ICs.
- Native routing totals cover whole associated nets, including branches; they are not point-to-point channel lengths or delays. Shared-net/DRC associations are non-additive. Ground-only DRC associations are consolidated in section 11. Fresh DDR/eMMC/clock point-to-point measurements are explicitly distinguished in the digital review.

Evidence: [complete machine-readable ledger](data/section-analysis.json), [power review](section-review/power-review.md), [digital review](section-review/digital-review.md), [peripheral review](section-review/peripheral-review.md), and [fresh digital geometry evidence](section-review/digital-evidence.json).

## Conclusions that determine the next revision

| Priority | Conclusion | Required disposition |
|---|---|---|
| P0 · source/model | Speaker beads FB140–FB143 are annotated 2 A, while their exact BLM21PG601SN1 catalog entry is 1.4 A with 0.14 Ω maximum DCR. FB120/FB130 BLM18AG601SN1 have 0.38 Ω maximum DCR, while the behavioral branches assume 0.1 Ω. | Correct the qualified rating metadata and distinguish nominal versus maximum model corners. Check actual speaker/AF/audio demand before selecting a replacement. Findings s24-bead-rating, s22-rail-af-envelope, s23-bead-dcr. |
| P0 · loads/limits | The ToF’s combined active-ranging maximum is comparable to the entire 130 mA non-codec 3V3_PER budget. Generic rail windows also permit 3.63 V for a sensor whose stated operating maximum is 3.6 V, and 1.35–1.65 V for a camera core whose brief specifies 1.425–1.575 V. | Establish non-overlapping device/activity budgets and per-device limits before relying on green rail checks. These are model inadequacies, not observed overload or overvoltage. Findings s21-current-budget, s21-voltage-window, s22-rail-af-envelope. |
| P0 · startup | J121’s enable handshake and externally generated rails are not implemented by the assumed t=0 external ramps. PCA9306 low-side back-bias and codec/camera/host power-off behavior need explicit treatment. | Establish boundary sources, shutdown order, off-state injection and actual enable timing. Add isolation/enable/discharge changes only when a quantified requirement demonstrates the need. Findings s20-rail-ownership, s20-io-off-state, s22-translator-backbias, s23-codec-sequence. |
| P0 · reset | C240 and C82 together load RESETn by 200 nF. With R221 = 10 kΩ, the ideal nominal time constant is 2 ms and 10–90% rise approximately 4.394 ms. The current reset waveform is digital. | Include PMIC sink/release behavior, leakage and receiver thresholds. Decide any R/C change against actual reset requirements; do not remove a capacitor merely to improve the simulated score. Findings P07-02, DG17-03. |
| P0 · regulator configuration | Exact RK809-5 OTP/control data, TCS4525 revision/application approval, L201–L206 identities, R227 rating and effective MLCC models remain open. The BUCK3 external-divider calculation is 1.346667 V nominal, conditional on the exact mode. | Qualify variants, operating limits, saturation/current/loss and feedback models. Preserve post-shunt CPU sensing. Findings P03-01 through P06-03. |
| P1 · DDR/eMMC channels | DQS1 paths have three versus eight via objects despite small length mismatch; byte 3 has 17.786 mm data/mask path spread. Fresh eMMC host DQ paths span 7.441 mm, with distinct longer CMD/strobe channels. | Select actual speeds/drive/ODT/package/module models and a qualified stack, then improve the limiting channels. Length matching alone does not establish an eye/timing pass. Findings DG13–DG18. |
| P1 · RF/audio/USB/EMC | Wi-Fi supply and startup timing, oscillator identities, class-D output/cable filtering, USB non-data-pin protection and return transitions require section-specific closure. | Use the actual antenna, speaker/cables, host power policy, connector parts and operating modes. Simulate/extract and measure the relevant sources/ports. Findings s19, s24, s25 and each section’s EMC paragraph. |
| P1 · thermal/boot | Conditional nine-LDO losses are 0.484703 W nominal and 0.629665 W in the combined case; these omit other PMIC losses. The DRAM’s thermal/refresh requirements and all IC mounted temperatures remain unverified. | Build a complete loss/thermal model with ambient, cooling, stack and enclosure boundaries; qualify refresh/DVFS/boot configuration and correlate on hardware. A board temperature map cannot be filled with invented values. |

## Shared PCB constraints

These constraints apply across the 26 functional sections and to the mechanical assembly:

- **Stack consistency:** the proposed copper/dielectric entries sum to 1.580 mm while nominal thickness is 1.600 mm. The 3D viewer’s 0.020 mm central display gap is a visualization convention. Obtain the fabricator-approved stack and align all files/calculations; do not silently add dielectric or change field spacing to hide the discrepancy.
- **Revision metadata:** all 26 native child title blocks still read `REV3 DRAFT` while the physical project is Revision 4. Synchronize revision/source metadata in the next task without claiming that relabeling qualifies the board. Keep fabrication and power-up holds until their evidence gates close.
- **Native checks:** 0 unconnected items; 61 differential-gap, eight uncoupled-length, two skew and 176 co-located-hole findings. The existing source-matching readiness report records zero native ERC findings, endpoint parity and zero stacked-interface geometry exceptions. Neither ignored checks nor co-located microvia interfaces should be deleted merely to reduce a count.
- **Ground/EM coverage:** all 187 U1 ground balls are connected; 152 have a same-surface GND-via center inside the pad. Connectivity is not a return-impedance or heat-spreading result. Include all supply commutation loops (U7, U3, U2 channels and U6 internal-regulator interface), DDR/eMMC/USB/CSI clocks/data, class-D outputs, antenna and harness return paths in the appropriate model. The existing local U7 E/B calculation cannot be tiled over the board as a field solution.
- **Mechanical coverage:** H1–H4 remain the four PCB-only mounting holes. Final standoffs, enclosure clearances, grounding/isolation, installed eMMC/cables/heatsink and probe access need the actual mechanical assembly. Copper-zone fills and qualified package heights are not supplied by the workbench’s display proxies.
- **Analysis-window correction:** candidate activity and component startup metrics follow the requested reset parameter, not executed boot. Future source/model revisions must label actual event windows and preserve frozen historical results. Extending the plotted time alone adds no silicon/boot evidence.

## Section index

| Native section | Unique inventory owner count | Involved references | Unit-pin endpoints | Findings |
|---|---:|---:|---:|---:|
| 02 · Input connector and 3.3 V preregulator | 16 | 16 | 36 | 4 |
| 03 · CPU buck supply and Kelvin feedback | 18 | 18 | 54 | 3 |
| 04 · RK809-5 buck channels 1–4 | 34 | 34 | 79 | 3 |
| 05 · RK809-5 buck channel 5 / 1.8 V | 6 | 7 | 15 | 2 |
| 06 · RK809-5 LDO and switched outputs | 19 | 20 | 53 | 3 |
| 07 · PMIC supervision, I2C, reset and 32 kHz | 22 | 23 | 67 | 4 |
| 08 · Unused PMIC codec bias and supply support | 9 | 10 | 38 | 2 |
| 09 · RK3566 core rails and decoupling | 25 | 26 | 98 | 3 |
| 10 · RK3566 IO and PHY supply domains | 32 | 33 | 83 | 3 |
| 11 · RK3566 physical ground-ball inventory | 0 | 1 | 187 | 3 |
| 12 · RK3566 unused pins and explicit no-connect inventory | 0 | 1 | 150 | 3 |
| 13 · DDR3L address, command and clock | 4 | 5 | 90 | 4 |
| 14 · DDR3L byte lanes 0 and 1 / U4 | 0 | 2 | 44 | 3 |
| 15 · DDR3L byte lanes 2 and 3 / U5 | 0 | 2 | 44 | 3 |
| 16 · DDR3L supply, VREF and ZQ networks | 45 | 48 | 197 | 5 |
| 17 · 24 MHz clock, reset and boot straps | 8 | 9 | 24 | 4 |
| 18 · Removable 8 / 16 GB eMMC module | 18 | 19 | 107 | 4 |
| 19 · SDIO Wi-Fi, Bluetooth, clocks and antenna | 21 | 22 | 101 | 5 |
| 20 · MCU harness, console and SPI display | 9 | 10 | 54 | 4 |
| 21 · VL53L5CX ToF and shared I²C bus | 9 | 10 | 37 | 4 |
| 22 · Two-lane camera, SCCB translation and 25 MHz clock | 21 | 22 | 89 | 6 |
| 23 · Stereo codec, I²S and microphone front end | 30 | 31 | 97 | 4 |
| 24 · Stereo bridge-tied speaker amplifier | 16 | 17 | 52 | 4 |
| 25 · USB recovery data port and operator buttons | 13 | 14 | 47 | 4 |
| 26 · Bring-up testpoints and rail observability — group 1 | 40 | 40 | 40 | 4 |
| 27 · Bring-up testpoints and rail observability — group 2 | 7 | 7 | 7 | 3 |

Finding labels: high: 40, info: 9, medium: 19, warning: 26. Informational observations are included; severity is a review priority, not a measured failure probability.

## 02 — Input connector and 3.3 V preregulator

Confirmed: J120 supplies 5V_SOC; U7 TPS566242 and L219 generate VCC_3V3_SBC. C100/C101 add 44 µF nominal input bulk, C380/C381 provide 22 µF + 100 nF input bypass, and C382–C385 provide 88 µF nominal output capacitance. C102 is on downstream switched VCC_3V3, not the U7 output.

Native source: [hardware/02-input-01.kicad_sch](../hardware/02-input-01.kicad_sch). Involved references: **C100, C101, C102, C380, C381, C382, C383, C384, C385, J120, L219, R380, R381, R382, R383, U7**. Primary inventory owners: 16; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** Run-0004: U7 rail reaches 95% at 1.325 ms and the averaged current hits its assumed 6 A ceiling while charging. The nominal R380/R381 EN divider gives 4.545 V at 5 V input, ignoring leakage. These facts do not validate real EN threshold, soft start or current-limit behavior. Startup peak labels use the requested reset-release window, not a measured boot phase (see S07).

**Steady operation.** Run-0004 U7 output 3.281876 V/1.208299 A; combined run-0016 output 3.269912 V/1.706415 A. These aggregate rail currents include downstream modeled demand and are not U7 pin-current measurements. Feedback-divider DC demand is 20 µA at 3.3 V; EN-divider demand 45.455 µA at 5 V, under ideal resistor assumptions.

**Time-domain behavior.** Separate fixed 5 V/2 A ngspice study: settled output mean 3.300051 V, 2.932 mV ripple, L219 RMS current 2.01489 A. A 1 A → 2 A local load-step study spans 3.150665–3.385516 V. Unprotected cold fixed PWM reaches 20.2197 A/5.700 V and is explicitly outside the constant-inductance model validity; it is not actual U7 startup.

**Fields, return paths and EMC.** Only a conditional local output-loop contribution has been calculated; source/harness, input commutation, core leakage, radiation and immunity remain unverified.

**Losses and temperature.** The 60 s thermal illustration for L219 uses 56.705 mW held five-cycle DCR loss, assumed 25 K/W and 0.5 J/K at 25 °C, yielding 26.406 °C. No U7, capacitor or board temperature is supplied. This 2 A illustration does not validate the 6 A capacity case.

**Missing models/evidence.** TPS566242 transient model is obtained but Cadence-encrypted and not run. Its readable header excludes operating/shutdown current, temperature dependence and large-duty operation. MLCC mounted/bias models, source impedance and package/plane parasitics are absent.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| 5V_SOC | 4.592139 | 4.848318 | 2.853584 | 4.248665 / run-0016 |
| VCC_3V3 | 3.265843 | 3.265843 | 2.1 | 3.243706 / run-0016 |
| VCC_3V3_SBC | 3.281876 | 3.281876 | 6 | 3.269912 / run-0016 |

### Findings and conclusions

**P02-01 · high.** Combined run-0016 produces 5V_SOC = 4.248665 V at 2.005341 A, versus 4.848318 V at 1.264018 A in nominal run-0004. The declared 4.5 V system floor fails. The combined 250 mΩ external source path loses 0.501335 V and 1.005348 W; this loss is outside the SBC unless a measured resistance partition places some on it. U7 and U3 remain above their recommended input minima in this saved case.

Action: Define minimum connector voltage, maximum source/harness resistance and real activity loads. Partition connector/cable/PCB losses and review upstream regulation before proposing a source-path change.

Acceptance: Reproduce nominal and combined cases with supported boundary inputs; verify every actual 5 V consumer limit. Do not call the 4.5 V scenario failure a proven IC undervoltage failure.

Evidence: [simulation/data/runs/run-0004.json](../simulation/data/runs/run-0004.json); [simulation/data/runs/run-0016.json](../simulation/data/runs/run-0016.json); [hardware/02-input-01.kicad_sch](../hardware/02-input-01.kicad_sch); [docs/connectors-and-testpoints.md](../docs/connectors-and-testpoints.md).

**P02-02 · high.** The R382 = 135 kΩ / R383 = 30 kΩ divider sets 3.300 V from 0.600 V nominal feedback. The retained full-temperature 0.591–0.609 V reference and ±0.1% resistors give 3.245186–3.354986 V before line/load/ripple/trace errors. This low corner leaves 45.186 mV above Wi-Fi VBAT minimum of 3.2 V before FB202; an illustrative 0.4 A through 50 mΩ reduces this to 25.186 mV. The saved combined corner does not sweep these feedback tolerances.

Action: Add source-qualified feedback/component corners and Wi-Fi burst measurements to the power budget. Preserve shared PMIC/SoC maximum voltages if a future setpoint change is considered.

Acceptance: Document minimum module-pad VBAT and all shared-consumer maximums at temperature and burst load; no arbitrary load/setpoint changes to make the result pass.

Evidence: [power-revision/regulator-source-qualification.md](../power-revision/regulator-source-qualification.md); [references/power-wifi/aw-cm256sm-v1.9.txt](../references/power-wifi/aw-cm256sm-v1.9.txt); [hardware/design-spec.json](../hardware/design-spec.json); [simulation/data/runs/run-0016.json](../simulation/data/runs/run-0016.json).

**P02-03 · high.** L219 is the qualified identity XAL6030-222MEC, 2.2 µH ±20%, 13.97 mΩ maximum DCR, 15.9 A saturation reference at 30% inductance reduction/25 °C. Its footprint polarity matches SW pad 2 / output pad 1. Exact C382–C385 MPNs and bias/ESR/ESL are unresolved. At 6 A, the retained worst-inductance nominal-frequency calculation gives 6.58 A peak and about 0.50 W DCR loss; these are capacity calculations, not established board demand.

Action: Select exact MLCCs, extract mounted network impedance and use a compatible exact TPS566242 controller model or measured responses. Check hot inductance/current and actual waveform losses.

Acceptance: Capacitance/stability and current margins are documented at accepted source/load/temperature corners, with vendor-reference and bench correlation. Existing passive SPICE checks alone do not close this gate.

Evidence: [power-revision/regulator-source-qualification.md](../power-revision/regulator-source-qualification.md); [simulation/data/time-domain.json](../simulation/data/time-domain.json); [simulation/professional/models/README.md](../simulation/professional/models/README.md); [hardware/design-spec.json](../hardware/design-spec.json).

**P02-04 · medium.** SBC_SW_3V3 has 4.378161 mm of B.Cu track and zero vias. SBC_FB_3V3 has 8.402500 mm of track and 2 vias. These are actual geometry facts, not loop-area or EMI measurements. The existing E/B study omits the critical U7 input commutation loop and does not qualify feedback noise immunity.

Action: Extract the actual input-capacitor/FET/ground loop, feedback return and nearby coupled conductors; correlate with switch-node/feedback probing and conducted/near-field measurements. Propose copper changes only from that evidence.

Acceptance: A defined local loop/return model or measurements show acceptable switching/feedback behavior and applicable product EMC evidence is retained.

Evidence: [simulation/data/electrical-audit.json](../simulation/data/electrical-audit.json); [hardware/rk3566-sbc.kicad_pcb](../hardware/rk3566-sbc.kicad_pcb); [simulation/TIME_DOMAIN_EM_ANALYSIS.md](../simulation/TIME_DOMAIN_EM_ANALYSIS.md).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C100 | 22u 10V | 4.744344 | 0.313641 | 4.592139 | 0 | 0 | calculated |
| C101 | 22u 10V | 4.744344 | 0.313641 | 4.592139 | 0 | 0 | calculated |
| C102 | 100nF 16V X7R(Murata) 10% | 3.294843 | 0.006358 | 3.265843 | 0 | 0 | calculated |
| C380 | 22uF 16V X7R | 4.744344 | 0.313641 | 4.592139 | 0 | 0 | calculated |
| C381 | 100nF 16V X7R(Murata) 10% | 4.744344 | 0.001426 | 4.592139 | 0 | 0 | calculated |
| C382 | 22uF 16V X7R | 3.299494 | 0.862722 | 3.281876 | 0 | 0 | calculated |
| C383 | 22uF 16V X7R | 3.299494 | 0.862722 | 3.281876 | 0 | 0 | calculated |
| C384 | 22uF 16V X7R | 3.299494 | 0.862722 | 3.281876 | 0 | 0 | calculated |
| C385 | 22uF 16V X7R | 3.299494 | 0.862722 | 3.281876 | 0 | 0 | calculated |
| J120 | 5V FROM MCU | 4.744344 | Unknown | 4.592139 | Unknown | Unknown | partial |
| L219 | 2.2uH XAL6030-222MEC | Unknown | 6 | Unknown | 1.208299 | Unknown | partial |
| R380 | 10k | 4.744344 | Unknown | 4.592139 | Unknown | Unknown | partial |
| R381 | 100k | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R382 | 135k 0.1% | 3.299494 | Unknown | 3.281876 | Unknown | Unknown | partial |
| R383 | 30k 0.1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| U7 | TPS566242DRLR | 4.744344 | Unknown | 4.592139 | Unknown | Unknown | partial |

## 03 — CPU buck supply and Kelvin feedback

Confirmed: U3 receives 5V_SOC; L206 = 240 nH feeds VDD_CPU_P, R227 = 10 mΩ feeds VDD_CPU, and R10/R229 returns the post-shunt sense node to CPU_FB. C249/C250 provide 44 µF nominal input bulk, C253/C254 together provide 44 µF pre-shunt output bulk and C255 = 22 µF post-shunt bulk; C252 adds 100 nF. C251 and R233 are DNP.

Native source: [hardware/03-cpu-01.kicad_sch](../hardware/03-cpu-01.kicad_sch). Involved references: **C249, C250, C251, C252, C253, C254, C255, L206, R10, R226, R227, R228, R229, R230, R231, R232, R233, U3**. Primary inventory owners: 18; DNP among owners: 2. Shared members are not extra physical parts.

**Startup and boot.** Nominal run-0004 reaches 95% VDD_CPU at 9.140 ms and holds 1.025 V by a feedforward Kelvin surrogate. It reports 4.677 A downstream charging peak; actual controller inrush and DVS behavior are unknown. Startup peak labels use the requested reset-release window, not a measured boot phase (see S07).

**Steady operation.** Nominal run-0004 VDD_CPU_P = 1.032500 V and VDD_CPU = 1.025000 V at 0.750 A. Combined run-0016 keeps 1.025000 V at 1.049996 A with pre-shunt 1.037343 V; the additional drop includes the engine’s assumed resistor temperature coefficient, not an actual shunt curve.

**Time-domain behavior.** Independent CCM sizing at ideal 5 V→1.025 V and 3 MHz gives 1.131771 A peak-to-peak ripple for 240 nH versus 0.823106 A for 330 nH, 37.5% higher. This does not predict PFM, startup or saturation; the retained frequency range is 2.65–3.35 MHz and exact revision remains open.

**Fields, return paths and EMC.** CPU_SW has 3.523141 mm of F.Cu track, zero vias. CPU_FB has 8.372857 mm of track and 2 vias. Input commutation through C249/C250, package grounds and the sense route needs coupling/return review; route lengths alone do not prove an EMI defect.

**Losses and temperature.** Only conditional shunt/inductor resistive losses can be computed. Retained U3 thetaJA = 65 °C/W is a package reference, not the 55 mm PCB thermal transfer function; controller, winding/core losses and actual temperatures are absent.

**Missing models/evidence.** Exact TCS revision/control/protection/DVS model, real L206 and R227 parameters, capacitor bias models and SoC activity-current envelopes are unavailable.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| 5V_SOC | 4.592139 | 4.848318 | 2.853584 | 4.248665 / run-0016 |
| VCC3V3_PMU | 3.2991 | 3.2991 | 0.029992 | 3.29852 / run-0016 |
| VDD_CPU | 1.025 | 1.025 | 4.67721 | 1.025 / run-0004 |
| VDD_CPU_P | 1.0325 | 1.0325 | 4.346602 | 1.0325 / run-0004 |

### Findings and conclusions

**P03-01 · high.** Board L206 = 240 nH has no exact MPN or hot/current curve. The retained TCS4525 Ver. 1.0 source specifies 5 A and 330/470 nH, but the current manufacturer page advertises 6 A and 220/470 nH. The new one-page PDF has an embedded EUP3265 title and does not resolve revision identity. Neither changing L206 to 330 nH nor accepting 240 nH is justified yet.

Action: Obtain fitted/sourced TCS4525_WT revision/lot confirmation, complete electrical/application data and an exact compatible model or characterized hardware. Qualify L206 value, lands, DCR, inductance versus current/temperature and losses.

Acceptance: Supplier or validated circuit evidence explicitly covers the selected 240 nH or a documented replacement across accepted corners. Preserve the historic 5 A analysis separately.

Evidence: [references/power-wifi/tcs4525.txt](../references/power-wifi/tcs4525.txt); [simulation/professional/models/README.md](../simulation/professional/models/README.md); [simulation/professional/models/TCS4525_Ver.1.1_manufacturer.pdf](../simulation/professional/models/TCS4525_Ver.1.1_manufacturer.pdf); [hardware/design-spec.json](../hardware/design-spec.json).

**P03-02 · high.** R227 shunt MPN and thermal derating remain open. Nominal run-0004 assumes 0.749997 A steady through R227, 7.49997 mV drop and 5.62496 mW; its modeled startup peak 4.677210 A gives 46.7721 mV/0.218763 W. At an illustrative 5 A it gives 50 mV/0.25 W. R228 = 100 Ω also bridges pre-shunt output to CPU_FB; with ideal R10/R229 joins this creates a small parallel path, about 0.5 mA at 50 mV, not the CPU load current.

Action: Select and thermally derate the real shunt, verify post-shunt Kelvin routing/loop stability, and model finite feedback-join impedance and FB bias. Preserve the distinction between CPU power current and sense/parallel-path current.

Acceptance: Exact shunt continuous/pulse ratings and temperature coefficient cover accepted peaks; feedback transients and sense routing are validated. Do not populate a power-current result on R10/R229.

Evidence: [simulation/data/runs/run-0004.json](../simulation/data/runs/run-0004.json); [hardware/03-cpu-01.kicad_sch](../hardware/03-cpu-01.kicad_sch); [hardware/design-spec.json](../hardware/design-spec.json); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml).

**P03-03 · high.** R226 = 51 kΩ ties CPU_EN to VCC3V3_PMU and C251 is unpopulated. R232 = 22 Ω ties CPU_VSEL to PMIC_SLEEP_H and R233 pulldown is DNP. CPU start therefore follows real PMU power/enable thresholds; it is not independently delayed by the model schedule. Retained VSEL defaults are 1.025 V low and 1.15 V high, subject to exact U3 revision and firmware configuration.

Action: Establish reset/default and sleep/wake GPIO states, EN leakage/thresholds, DVS register programming and approved SoC operating points. Capture simultaneous PMU 3.3 V, EN, VSEL and CPU-rail startup/recovery.

Acceptance: Measured or exact-model sequence remains inside approved CPU voltages through startup, DVFS and sleep transitions. An SoC absolute maximum is never used as a normal DVFS target.

Evidence: [references/power-wifi/tcs4525.txt](../references/power-wifi/tcs4525.txt); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [hardware/03-cpu-01.kicad_sch](../hardware/03-cpu-01.kicad_sch); [simulation/data/runs/run-0004.json](../simulation/data/runs/run-0004.json).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C249 | 22uF 10V X5R | 4.744344 | 0.313641 | 4.592139 | 0 | 0 | calculated |
| C250 | 22uF 10V X5R | 4.744344 | 0.313641 | 4.592139 | 0 | 0 | calculated |
| C251 | DNP 100nF · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| C252 | 100nF 16V X7R(Murata) 10% | 1.026125 | 0.005238 | 1.0325 | 0 | 0 | calculated |
| C253 | 22uF 6.3V X5R | 1.026125 | 1.152257 | 1.0325 | 0 | 0 | calculated |
| C254 | 22uF 6.3V X5R | 1.026125 | 1.152257 | 1.0325 | 0 | 0 | calculated |
| C255 | 22uF 6.3V X5R | 1.025 | 1.105051 | 1.025 | 0 | 0 | calculated |
| L206 | 240nH | Unknown | 4.346602 | Unknown | 0.749997 | Unknown | partial |
| R10 | 0R KELVIN JOIN | 1.025 | Unknown | 1.025 | Unknown | Unknown | partial |
| R226 | 51k | 3.299865 | Unknown | 3.2991 | Unknown | Unknown | partial |
| R227 | 10mR 1% | 0.046772 | 4.67721 | 0.0075 | 0.749997 | 0.005625 | calculated |
| R228 | 100R | 1.026125 | Unknown | 1.0325 | Unknown | Unknown | partial |
| R229 | 0R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R230 | 22R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R231 | 22R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R232 | 22R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R233 | DNP · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| U3 | TCS4525_WT | 4.744344 | Unknown | 4.592139 | Unknown | Unknown | partial |

## 04 — RK809-5 buck channels 1–4

Confirmed channel map: BUCK1/L201→VDD_LOGIC; BUCK2/L202→VDD_GPU; BUCK3/L203→VCC_DDR; BUCK4/L204→VDD_NPU. Each local output bank has two 22 µF capacitors plus 100 nF. R11/R12/R13 with 0 Ω feedback joins create sense paths; their current is not the respective SoC rail current.

Native source: [hardware/04-pmic_bucks-01.kicad_sch](../hardware/04-pmic_bucks-01.kicad_sch). Involved references: **C201, C202, C203, C204, C205, C206, C207, C208, C209, C210, C211, C212, C213, C214, C215, C216, C217, L201, L202, L203, L204, R11, R12, R13, R201, R202, R203, R204, R205, R206, R207, R208, R209, U2**. Primary inventory owners: 34; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** Nominal run-0004 modeled 95% times: LOGIC = 5.230 ms, GPU = 9.135 ms, NPU = 13.040 ms, DDR = 16.945 ms. These are candidate sequenced RC responses, not observed PMIC OTP timings.

**Steady operation.** Nominal run-0004: LOGIC = 0.894632 V/0.447315 A, GPU = 0.897845 V/0.179568 A, DDR = 1.342245 V/0.646264 A, NPU = 0.898562 V/0.119808 A. Combined run-0016: 0.891200 V/0.623838 A, 0.896459 V/0.251008 A, 1.337284 V/0.901426 A, 0.897636 V/0.167558 A respectively. These are aggregate assumed rail loads.

**Time-domain behavior.** The available averaged model omits PMIC switching regulation, protection and real load spectra. In particular, same final voltages in a capacitance sweep do not establish COT-loop stability or DDR transient tolerance.

**Fields, return paths and EMC.** PMIC_SW1/2/3/4 summed track lengths are 2.328796/2.132159/1.725000/1.725000 mm, all F.Cu and zero vias. PMIC_FB_DDR has 10.316346 mm of track and 2 vias; feedback/ground coupling and real hot loops remain unvalidated.

**Losses and temperature.** No exact winding loss model exists for L201–L204 and no full U2 loss map exists. Per-channel current capacities cannot all be converted into simultaneous allowable thermal loading.

**Missing models/evidence.** Exact RK809-5 OTP/COT/protection models; L201–L204 hot inductance/DCR/core loss; capacitor bias/ESL and SoC/DDR activity currents.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| VCC_3V3_SBC | 3.281876 | 3.281876 | 6 | 3.269912 / run-0016 |
| VCC_DDR | 1.342245 | 1.342245 | 0.646266 | 1.337284 / run-0016 |
| VDD_GPU | 0.897845 | 0.897845 | 0.179569 | 0.896459 / run-0016 |
| VDD_LOGIC | 0.894632 | 0.894632 | 0.447316 | 0.8912 / run-0016 |
| VDD_NPU | 0.898562 | 0.898562 | 0.119808 | 0.897636 / run-0016 |

### Findings and conclusions

**P04-01 · high.** RK809-5 default voltages, power-good conditions, slots and protection settings remain unverified. Generic rated currents 2.5/2.5/1.5/1.5 A are capacity references, not measured current-limit thresholds. L201–L204 are generic 470 nH placements with no exact saturation or thermal ratings.

Action: Obtain exact-5 OTP/register defaults and controller models or measurements, then select real inductors against actual peaks and hot saturation. Keep the generic RK809-1 sequence table out of the -5 boot proof.

Acceptance: Each output has exact source-qualified operating limits, a real inductor and supported startup/load/protection evidence; passed averaged regulation is not substituted for control validation.

Evidence: [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [hardware/design-spec.json](../hardware/design-spec.json); [simulation/data/runs/run-0004.json](../simulation/data/runs/run-0004.json).

**P04-02 · high.** R206 = 82 kΩ / R207 = 120 kΩ and retained external BUCK3 VFB = 0.800 V give 1.346667 V nominal. With 0.784–0.816 V feedback and 1% resistors, the static ideal range is 1.309125–1.384865 V before distribution/ripple. The low endpoint leaves 26.125 mV above ISSI DDR3L minimum of 1.283 V; this is not a complete transient margin. The engine instead uses a 1.350 V target.

Action: Confirm exact-5 external-feedback mode and tolerances; replace the rounded DDR target in a future model with the qualified divider and reference. Combine tolerance, temperature, trace and dynamic losses at memory and SoC pins.

Acceptance: Preserve measured/modeled minimum and maximum DDR voltages against all consumers, including power-up; verify BUCK3 feedback-mode registers. Do not change resistors solely to erase a generic scenario failure.

Evidence: [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [references/soc-memory/issi-ddr3l.txt](../references/soc-memory/issi-ddr3l.txt); [hardware/04-pmic_bucks-01.kicad_sch](../hardware/04-pmic_bucks-01.kicad_sch); [simulation/data/runs/run-0004.json](../simulation/data/runs/run-0004.json); [simulation/data/runs/run-0016.json](../simulation/data/runs/run-0016.json).

**P04-03 · medium.** The RK3566 guide requires BUCK1/2 output capacitance greater than 30 µF. The local 44 µF bulk alone retains 30.8 µF at 70% and 17.6 µF at 40%. Additional SoC capacitors are populated on each net, so 40% local retention is not proof of a complete-network violation; their frequency-dependent effectiveness depends on interconnect. R203 = 9.1 kΩ is a small load on the joined LOGIC feedback node, not a 1% output divider by itself.

Action: Qualify biased/aged MLCC capacitance and extract local-plus-distributed impedance. Verify remote-sense noise and exact-5 control requirements instead of counting every capacitor as equally effective.

Acceptance: Document effective output capacitance and measured/modelled impedance and transient response over the required bandwidth; keep remote-sense branches and R203’s actual connectivity in the model.

Evidence: [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [hardware/design-spec.json](../hardware/design-spec.json); [hardware/04-pmic_bucks-01.kicad_sch](../hardware/04-pmic_bucks-01.kicad_sch).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C201 | 22uF 6.3V X5R | 3.299494 | 0.862722 | 3.281876 | 0 | 0 | calculated |
| C202 | 22uF 6.3V X5R | 0.899191 | 0.006924 | 0.894632 | 0 | 0 | calculated |
| C203 | 22uF 6.3V X5R | 0.899191 | 0.006924 | 0.894632 | 0 | 0 | calculated |
| C204 | 100nF 16V X7R(Murata) 10% | 0.899191 | 3.147e-05 | 0.894632 | 0 | 0 | calculated |
| C205 | 10uF 10V X5R | 3.299494 | 0.392146 | 3.281876 | 0 | 0 | calculated |
| C206 | 22uF 6.3V X5R | 0.899676 | 0.006928 | 0.897845 | 0 | 0 | calculated |
| C207 | 22uF 6.3V X5R | 0.899676 | 0.006928 | 0.897845 | 0 | 0 | calculated |
| C208 | 100nF 16V X7R(Murata) 10% | 0.899676 | 3.149e-05 | 0.897845 | 0 | 0 | calculated |
| C209 | 10uF 10V X5R | 3.299494 | 0.392146 | 3.281876 | 0 | 0 | calculated |
| C210 | 22uF 6.3V X5R | 1.348831 | 0.010386 | 1.342245 | 0 | 0 | calculated |
| C211 | 22uF 6.3V X5R | 1.348831 | 0.010386 | 1.342245 | 0 | 0 | calculated |
| C212 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C213 | 10uF 10V X5R | 3.299494 | 0.392146 | 3.281876 | 0 | 0 | calculated |
| C214 | 22uF 6.3V X5R | 0.899784 | 0.006928 | 0.898562 | 0 | 0 | calculated |
| C215 | 22uF 6.3V X5R | 0.899784 | 0.006928 | 0.898562 | 0 | 0 | calculated |
| C216 | 100nF 16V X7R(Murata) 10% | 0.899784 | 3.149e-05 | 0.898562 | 0 | 0 | calculated |
| C217 | 10uF 10V X5R | 3.299494 | 0.392146 | 3.281876 | 0 | 0 | calculated |
| L201 | 470nH | Unknown | 0.103568 | Unknown | 0.447315 | Unknown | partial |
| L202 | 470nH | Unknown | 0.056233 | Unknown | 0.179568 | Unknown | partial |
| L203 | 470nH | Unknown | 0.141093 | Unknown | 0.646264 | Unknown | partial |
| L204 | 470nH | Unknown | 0.045765 | Unknown | 0.119808 | Unknown | partial |
| R11 | 0R KELVIN JOIN | 0.899191 | Unknown | 0.894632 | Unknown | Unknown | partial |
| R12 | 0R KELVIN JOIN | 0.899676 | Unknown | 0.897845 | Unknown | Unknown | partial |
| R13 | 0R KELVIN JOIN | 0.899784 | Unknown | 0.898562 | Unknown | Unknown | partial |
| R201 | 100R | 0.899191 | Unknown | 0.894632 | Unknown | Unknown | partial |
| R202 | 0R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R203 | 9.1k 1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R204 | 100R | 0.899676 | Unknown | 0.897845 | Unknown | Unknown | partial |
| R205 | 0R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R206 | 82k 1% | 1.348831 | Unknown | 1.342245 | Unknown | Unknown | partial |
| R207 | 120k 1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R208 | 100R | 0.899784 | Unknown | 0.898562 | Unknown | Unknown | partial |
| R209 | 0R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| U2 | RK809-5 | Unknown | Unknown | Unknown | Unknown | Unknown | partial |

## 05 — RK809-5 buck channel 5 / 1.8 V

Confirmed: U2 SW5/L205 feeds VCC_1V8; R210 = 0 Ω connects output to FB5 and R211 is DNP. C218/C219 total 44 µF plus C220 = 100 nF locally. VCC9 also feeds SWOUT1, coupling this channel’s input demand to the shared preregulator and switched 3.3 V path.

Native source: [hardware/05-pmic_bucks-02.kicad_sch](../hardware/05-pmic_bucks-02.kicad_sch). Involved references: **C218, C219, C220, L205, R210, R211, U2**. Primary inventory owners: 6; DNP among owners: 1. Shared members are not extra physical parts.

**Startup and boot.** Nominal run-0004 reaches 95% at 9.135 ms under the candidate slot arrangement. Actual BUCK5 timing and run/sleep voltage are not known.

**Steady operation.** Nominal run-0004 VCC_1V8 = 1.798561 V/0.119904 A; combined run-0016 = 1.797633 V/0.167779 A. Neither constitutes a verified memory/IO activity envelope.

**Time-domain behavior.** Load-step interactions with SWOUT1 and the upstream U7 converter are not represented by a qualified multi-controller model; output capacitance must include actual interconnect.

**Fields, return paths and EMC.** PMIC_SW5 has 1.725000 mm F.Cu track and zero vias. This connectivity fact does not supply loop inductance, return distribution or emission amplitude.

**Losses and temperature.** No L205 or per-channel U2 thermal result exists. The generic 2.5 A capacity is not a thermal budget for this board.

**Missing models/evidence.** Exact BUCK5 OTP/current-mode controller/protection model, L205/MLCC models, dynamic loads and shared-input impedance.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| VCC_1V8 | 1.798561 | 1.798561 | 0.119904 | 1.797633 / run-0016 |
| VCC_3V3_SBC | 3.281876 | 3.281876 | 6 | 3.269912 / run-0016 |

### Findings and conclusions

**P05-01 · high.** The board relies on a programmed/default 1.8 V BUCK5 setting. The retained generic RK809 table lists a 2.2 V default; that is not proof the actual -5 outputs 2.2 V, but shows why substituting generic defaults would be unsafe for a 1.8 V net. R210/R211 do not independently set 1.8 V with an external divider.

Action: Obtain exact-5 BUCK5 OTP and run/sleep settings; verify 1.8 V before SoC/DDR IO operation and after reset. Keep R211 DNP unless an explicitly qualified circuit revision requires it.

Acceptance: The correct-variant data and measured startup/sleep voltage establish the approved 1.8 V range before firmware can intervene.

Evidence: [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [hardware/design-spec.json](../hardware/design-spec.json); [hardware/05-pmic_bucks-02.kicad_sch](../hardware/05-pmic_bucks-02.kicad_sch); [simulation/data/runs/run-0004.json](../simulation/data/runs/run-0004.json).

**P05-02 · medium.** L205 = 470 nH is not an identified current-rated component. The 2.5 A channel capacity and 44 µF local nominal bulk do not establish inductor saturation, mounted capacitance or current-mode regulator stability. C217 input bypass appears on sheet 04 because the PMIC units share VCC9.

Action: Qualify the inductor and output network and include VCC9 shared-source impedance/load transitions with SWOUT1.

Acceptance: Acceptable current/temperature ratings, stable output transients and input decoupling are supported at the real system activity envelope.

Evidence: [hardware/design-spec.json](../hardware/design-spec.json); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [hardware/04-pmic_bucks-01.kicad_sch](../hardware/04-pmic_bucks-01.kicad_sch); [hardware/05-pmic_bucks-02.kicad_sch](../hardware/05-pmic_bucks-02.kicad_sch).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C218 | 22uF 6.3V X5R | 1.799784 | 0.013858 | 1.798561 | 0 | 0 | calculated |
| C219 | 22uF 6.3V X5R | 1.799784 | 0.013858 | 1.798561 | 0 | 0 | calculated |
| C220 | 100nF 16V X7R(Murata) 10% | 1.799784 | 6.299e-05 | 1.798561 | 0 | 0 | calculated |
| L205 | 470nH | Unknown | 0.04886 | Unknown | 0.119904 | Unknown | partial |
| R210 | 0R | 1.799784 | Unknown | 1.798561 | Unknown | Unknown | partial |
| R211 | DNP · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |

## 06 — RK809-5 LDO and switched outputs

Confirmed: VCC6 pin 30 now receives 5V_SOC through its own C222 bypass. VCC5/VCC7/VCC8 remain on VCC_3V3_SBC. LDO3 supplies VDDA0V9_PMU; R212 joins VCCA1V8_PMU to VCCIO_WL. VCC_3V3 and VCC3V3_SD are pass-switch outputs, not independently regulated 3.3 V rails.

Native source: [hardware/06-pmic_ldos-01.kicad_sch](../hardware/06-pmic_ldos-01.kicad_sch). Involved references: **C221, C222, C223, C224, C225, C226, C227, C228, C229, C230, C231, C232, C233, C234, C235, C258, C259, C260, R212, U2**. Primary inventory owners: 19; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** Candidate run-0004: low-voltage LDOs are grouped at 5.23/9.135/16.945 ms; VCCIO_SD and VCCIO_ACODEC are last to 95% at 20.85 ms. Actual slots and IO-before-core constraints remain unverified.

**Steady operation.** Combined run-0016 keeps VCC3V3_PMU = 3.298520 V, VCCIO_SD/ACODEC = 3.299408 V; its switched outputs fall to 3.243706 V and 3.266654 V. LDO dropout and pass-switch voltage loss are distinct mechanisms; actual source/current tolerances are not fully covered.

**Time-domain behavior.** Shared-input droop, LDO stability, output discharge and reverse/back-power behavior need exact models or measurement. The populated output bypasses are mostly 1 µF, with 4.7 µF on ACODEC and 22 µF on each switch; printed values alone do not give effective capacitance.

**Fields, return paths and EMC.** LDOs may attenuate some conducted ripple but no frequency/load PSRR model is supplied. Switching and IO return-current coupling across shared PMIC grounds remains an open layout/EM task.

**Losses and temperature.** At 5.0 V→3.3 V, each 100 mA LDO contributes 0.17 W; three hypothetical 400 mA loads would give 2.04 W before all other PMIC losses. The retained generic document specifies 2 W power and below 125 °C absolute junction temperature, so simultaneous capacity maxima are not an acceptable assumed budget.

**Missing models/evidence.** Exact LDO/switch OTP, dropout/PSRR/reverse-conduction/discharge models, complete PMIC loss map, mounted thermal transfer and actual activity currents.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| 5V_SOC | 4.592139 | 4.848318 | 2.853584 | 4.248665 / run-0016 |
| VCC3V3_PMU | 3.2991 | 3.2991 | 0.029992 | 3.29852 / run-0016 |
| VCC3V3_SD | 3.279888 | 3.279888 | 2.1 | 3.266654 / run-0016 |
| VCCA1V8_IMAGE | 1.7994 | 1.7994 | 0.019993 | 1.799013 / run-0016 |
| VCCA1V8_PMU | 1.798891 | 1.798891 | 0.036977 | 1.798175 / run-0016 |
| VCCA_1V8 | 1.798651 | 1.798651 | 0.044966 | 1.797781 / run-0016 |
| VCCIO_ACODEC | 3.29964 | 3.29964 | 0.011999 | 3.299408 / run-0016 |
| VCCIO_SD | 3.29964 | 3.29964 | 0.011999 | 3.299408 / run-0016 |
| VCCIO_WL | 1.798831 | 1.798831 | 0.011992 | 1.798077 / run-0016 |
| VCC_3V3 | 3.265843 | 3.265843 | 2.1 | 3.243706 / run-0016 |
| VCC_3V3_SBC | 3.281876 | 3.281876 | 6 | 3.269912 / run-0016 |
| VDDA0V9_IMAGE | 0.898951 | 0.898951 | 0.034959 | 0.898275 / run-0016 |
| VDDA0V9_PMU | 0.899251 | 0.899251 | 0.024979 | 0.898767 / run-0016 |
| VDDA_0V9 | 0.898652 | 0.898652 | 0.044933 | 0.897784 / run-0016 |

### Findings and conclusions

**P06-01 · high.** Feeding VCC6 from 5V_SOC provides real headroom for the three 3.3 V LDO outputs. It also adds heat: summing (Vin−Vout) × saved aggregate I over all nine LDOs gives 0.484703 W in nominal run-0004 and 0.629665 W in combined run-0016, excluding quiescent, buck, switch and codec losses. These are load-assumption-dependent losses, not U2 temperature predictions.

Action: Establish per-LDO activity currents and the complete PMIC loss/thermal budget. Check 5 V tolerance, actual dropout and powered-off behavior; preserve the intentional VCC6/RTC input arrangement unless a qualified redesign changes it.

Acceptance: Validated losses and mounted-board temperatures meet derated limits. Do not transplant generic thetaJA = 21.99 °C/W from its 114×76 mm four-layer test board onto this 55×55 mm design as a solved temperature.

Evidence: [simulation/data/runs/run-0004.json](../simulation/data/runs/run-0004.json); [simulation/data/runs/run-0016.json](../simulation/data/runs/run-0016.json); [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [power-revision/regulator-source-qualification.md](../power-revision/regulator-source-qualification.md); [hardware/design-spec.json](../hardware/design-spec.json).

**P06-02 · high.** The applicable guide and RK809 electrical table identify LDO3 as 100 mA; other LDOs are nominally 400 mA under specified conditions. The generic sequence table has inconsistent LDO numbering/rating entries and cannot override the electrical pin/channel table or exact-5 data. Each LDO voltage and default remains an OTP/configuration dependency.

Action: Use the exact channel/pin mapping and qualified load limits. Count VCCIO_WL downstream demand once inside LDO8’s VCCA1V8_PMU source load, and verify 1.8 V IO compatibility and timing.

Acceptance: Per-channel requirements and model limits agree with supplier data and measured loads; neither model inventory coverage nor generic 400 mA labels substitute for this evidence.

Evidence: [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [hardware/06-pmic_ldos-01.kicad_sch](../hardware/06-pmic_ldos-01.kicad_sch).

**P06-03 · medium.** The RK3566 guide gives both -5 switches 2.1 A with 90/100 mΩ on-resistance, while generic RK809 gives 1.5 A/3 A. Nominal run-0004 models VCC_3V3 = 3.265843 V/0.178136 A and VCC3V3_SD = 3.279888 V/0.019878 A. Both startup currents touch an assumed 2.1 A ceiling; that is not an observed current-limit threshold.

Action: Resolve exact-5 rated/limit currents and hot on-resistance; combine preregulator tolerance with switch/trace drop and real downstream inrush.

Acceptance: Qualified consumer-pin limits and allowed inrush are met across source, load and temperature corners; keep the unresolved rating conflict visible until resolved.

Evidence: [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [simulation/data/runs/run-0004.json](../simulation/data/runs/run-0004.json); [simulation/data/runs/run-0016.json](../simulation/data/runs/run-0016.json).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C221 | 1uF 6.3V X5R | 3.299494 | 0.039215 | 3.281876 | 0 | 0 | calculated |
| C222 | 1uF 16V X7R | 4.744344 | 0.014256 | 4.592139 | 0 | 0 | calculated |
| C223 | 1uF 6.3V X5R | 3.299494 | 0.039215 | 3.281876 | 0 | 0 | calculated |
| C224 | 1uF 6.3V X5R | 3.299494 | 0.039215 | 3.281876 | 0 | 0 | calculated |
| C225 | 1uF 6.3V X5R | 0.899843 | 0.00031494 | 0.898951 | 0 | 0 | calculated |
| C226 | 1uF 6.3V X5R | 0.899798 | 0.00031493 | 0.898652 | 0 | 0 | calculated |
| C227 | 1uF 6.3V X5R | 0.899888 | 0.00031496 | 0.899251 | 0 | 0 | calculated |
| C228 | 1uF 6.3V X5R | 3.299946 | 0.001155 | 3.29964 | 0 | 0 | calculated |
| C229 | 1uF 6.3V X5R | 3.299865 | 0.001155 | 3.2991 | 0 | 0 | calculated |
| C230 | 1uF 6.3V X5R | 1.799798 | 0.00062993 | 1.798651 | 0 | 0 | calculated |
| C231 | 1uF 6.3V X5R | 1.799834 | 0.00063033 | 1.798891 | 0 | 0 | calculated |
| C232 | 1uF 6.3V X5R | 1.79991 | 0.00062997 | 1.7994 | 0 | 0 | calculated |
| C233 | 4.7uF 6.3V X5R | 3.299946 | 0.005428 | 3.29964 | 0 | 0 | calculated |
| C234 | 22uF 6.3V X5R | 3.29697 | 2.09969 | 3.279888 | 0 | 0 | calculated |
| C235 | 22uF 6.3V X5R | 3.294843 | 1.398761 | 3.265843 | 0 | 0 | calculated |
| C258 | 4.7uF 6.3V X5R | 1.799825 | 0.002963 | 1.798831 | 0 | 0 | calculated |
| C259 | 1uF 10V X5R | 1.799825 | 0.00063033 | 1.798831 | 0 | 0 | calculated |
| C260 | 100nF 16V X7R(Murata) 10% | 1.799825 | 6.303e-05 | 1.798831 | 0 | 0 | calculated |
| R212 | 0R | Unknown | Unknown | Unknown | Unknown | Unknown | partial |

## 07 — PMIC supervision, I2C, reset and 32 kHz

Confirmed: VCC_RTC pin 45 is on 5V_SOC with C236; C237 bypasses PMIC_VREF. R222 = 100 kΩ / R223 = 33 kΩ and C242 = 100 nF drive VDC. R221 = 10 kΩ pulls RESETn to VCC3V3_PMU; C240 and cross-sheet C82 each add 100 nF. R238 joins SoC TSADC_SHUT_M0 to RESETn. R220 is DNP, isolating the optional PMIC clock export to the SoC.

Native source: [hardware/07-pmic_control-01.kicad_sch](../hardware/07-pmic_control-01.kicad_sch). Involved references: **C236, C237, C238, C239, C240, C241, C242, R213, R214, R215, R216, R217, R218, R220, R221, R222, R223, R224, R225, R238, U1, U2, Y201**. Primary inventory owners: 22; DNP among owners: 1. Shared members are not extra physical parts.

**Startup and boot.** Nominal run-0004 first modeled stable-rail time 20.850 ms and requested release 40.000 ms leave 19.150 ms modeled margin. Actual VDC/RTC/clock startup and the 200 nF reset network are separate unresolved timing contributors. POWER_KEY uses R225 = 100 Ω, C241 = 100 nF and the PMIC internal pull-up; guide button thresholds are 500 ms power-on, 6 s forced-off and 20 ms sleep/wake. The engine defines startup peak windows up to the requested reset_release_ms, even when its ideal supervisor delays the actual RESETn transition; modeled activity also starts from the requested time. These labels do not demonstrate physical or firmware startup state.

**Steady operation.** Static resistor calculations describe only forced states, not switching histories: R217 = 10 kΩ pulls interrupt to 3.3 V; R218 = 10 kΩ pulls the open-drain clock to 1.8 V. PWRON, INT, I2C and reset currents depend on actual device states and are not assigned fabricated waveforms.

**Time-domain behavior.** Saved slow-start run-0011 and early-reset run-0012 fail their requested release timing; brownout run-0014 is an intentional negative case. These check the candidate supervisor and do not show the fitted PMIC actually resets/restarts as modeled.

**Fields, return paths and EMC.** The weak 32 kHz crystal loop and high-impedance VDC/feedback nodes require switch-coupling/return review. PMIC_VDC routing includes 6 vias and 6.985391 mm of track; this is geometry evidence, not an EMI failure.

**Losses and temperature.** The reset/TSADC path must cause the intended low assertion before thermal damage, but it is not a simulated thermal protection loop. Actual PMIC/SoC thresholds, firmware configuration and temperature are unverified.

**Missing models/evidence.** Exact PMIC OTP/VDC/reset/button/clock model, SoC reset input thresholds/edge constraints, mounted crystal parameters, bus capacitance and executed boot/I2C firmware.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| 5V_SOC | 4.592139 | 4.848318 | 2.853584 | 4.248665 / run-0016 |
| VCC3V3_PMU | 3.2991 | 3.2991 | 0.029992 | 3.29852 / run-0016 |
| VCCIO_WL | 1.798831 | 1.798831 | 0.011992 | 1.798077 / run-0016 |

### Findings and conclusions

**P07-01 · high.** The native VDC divider gives 1.240602 V at 5 V, Thevenin 24.812 kΩ and tau 2.481203 ms. Ignoring input loading, a 5 V step crosses the documented 0.55 V startup trigger after 1.453461 ms. The corresponding static input is 2.216667 V. RK809 describes rising-edge startup triggering; this network is not a qualified undervoltage/brownout supervisor.

Action: Model the real source ramp, VDC threshold/leakage and RTC/input readiness. Verify slow ramp, insertion, interrupted ramp and brownout/recovery behavior on the exact PMIC.

Acceptance: All required source trajectories start and recover correctly with proven reset behavior; never substitute 2.2167 V VDC triggering for recommended supply or brownout limits.

Evidence: [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [hardware/07-pmic_control-01.kicad_sch](../hardware/07-pmic_control-01.kicad_sch); [simulation/data/runs/run-0016.json](../simulation/data/runs/run-0016.json).

**P07-02 · high.** RESETn sees 200 nF total from C240+C82, so R221 gives 2.000 ms ideal pull-up RC, 4.394 ms for a 10–90% rise and 2.408 ms to 70% of its final voltage after release. With the model’s 70% capacitance factor tau would be 1.400 ms. Saved RESETn is an ideal digital event and omits this analog net. The guide requests 100 nF near reset pins, so deleting either capacitor solely to speed the edge is not justified.

Action: Correlate reset low/high thresholds, allowed edge rate, PMIC sink/leakage and both capacitance sites with the real power sequence. Verify thermal/watchdog assertion is low as required and no competing high drive exists.

Acceptance: Measure both PMIC and SoC reset pins; cold reset remains asserted at least 10 ms after the final valid rail, and asserts before PMUIO1 falls below 2.93 V. Keep warm-reset 100-cycle and analog-threshold requirements distinct.

Evidence: [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [hardware/07-pmic_control-01.kicad_sch](../hardware/07-pmic_control-01.kicad_sch); [hardware/17-soc_clock-01.kicad_sch](../hardware/17-soc_clock-01.kicad_sch); [simulation/data/runs/run-0004.json](../simulation/data/runs/run-0004.json).

**P07-03 · medium.** R215/R216, each 2.2 kΩ, pull I2C to PMU 3.3 V. At 3.3 V a held-low line draws up to 1.5 mA ignoring VOL; at VOL = 0.4 V it draws 1.318 mA before small series drops. With a simple RC and the 300 ns Fast-mode rise limit, 2.2 kΩ permits about 160.94 pF total bus capacitance, not automatically the 400 pF protocol maximum. No bus capacitance or executed PMIC/CPU transactions are supplied.

Action: Measure or extract total pin/route capacitance, confirm configured speed and sink thresholds, and test PMIC/CPU access through startup and sleep. Preserve domain-voltage compatibility and account for 22 Ω series resistors.

Acceptance: Observed rise/fall/setup/hold and low-level voltages meet every connected device’s mode requirements; executed transactions confirm address/configuration behavior.

Evidence: [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [references/power-wifi/tcs4525.txt](../references/power-wifi/tcs4525.txt); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [simulation/section-review/power-review.md](../simulation/section-review/power-review.md).

**P07-04 · medium.** Y201 has no exact crystal MPN/CL/ESR. C238/C239, each 22 pF, form an ideal 11 pF series load plus pin/stray capacitance; this does not identify the correct crystal. Native PMIC_XIN/XOUT track totals are 5.123553/8.334214 mm, both F.Cu with no vias. R220 DNP means the SoC does not receive the optional PMIC_CLK32K signal through that link.

Action: Select the crystal and validate load/ESR/start margin and routing coupling. Confirm the chosen SoC clock mode and firmware assumptions. Probe a buffered clock rather than loading the weak crystal pins.

Acceptance: Qualified oscillator start/frequency and intended SoC clock mode are documented across temperature and voltage; no measured-clock claim is made from static connectivity.

Evidence: [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [hardware/design-spec.json](../hardware/design-spec.json); [hardware/rk3566-sbc.kicad_pcb](../hardware/rk3566-sbc.kicad_pcb).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C236 | 1uF 16V X7R | 4.744344 | 0.014256 | 4.592139 | 0 | 0 | calculated |
| C237 | 1uF 10V X5R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C238 | 22pF C0G 50V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C239 | 22pF C0G 50V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C240 | 100nF 16V X7R(Murata) 10% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C241 | 100nF 16V X7R(Murata) 10% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C242 | 100nF 16V X7R(Murata) 10% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R213 | 22R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R214 | 22R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R215 | 2.2k | 3.299865 | Unknown | 3.2991 | Unknown | Unknown | partial |
| R216 | 2.2k | 3.299865 | Unknown | 3.2991 | Unknown | Unknown | partial |
| R217 | 10k | 3.299865 | Unknown | 3.2991 | Unknown | Unknown | partial |
| R218 | 10k | 1.799825 | Unknown | 1.798831 | Unknown | Unknown | partial |
| R220 | DNP · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| R221 | 10k | 3.299865 | Unknown | 3.2991 | Unknown | Unknown | partial |
| R222 | 100k | 4.744344 | Unknown | 4.592139 | Unknown | Unknown | partial |
| R223 | 33k | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R224 | 22R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R225 | 100R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R238 | 0R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| U1 | RK3566 | Unknown | Unknown | Unknown | Unknown | Unknown | partial |
| Y201 | 32.768kHz | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |

## 08 — Unused PMIC codec bias and supply support

Confirmed: FB201 connects 5V_SOC to U2 VCC_SPK_HP with C243 = 10 µF bypass. C244 = 2.2 µF connects CPN/CPP; C245 = 1 µF and C246 = 2.2 µF bypass positive/negative charge-pump nodes; C247/C248 each 1 µF bypass internal 1.8 V digital/analog nodes. Speaker/headphone outputs are unconnected; MCLK/SDI and microphone/sense inputs have deliberate ground connections. LRCLK/BCLK have 100 kΩ pulldowns R239/R240.

Native source: [hardware/08-pmic_audio-01.kicad_sch](../hardware/08-pmic_audio-01.kicad_sch). Involved references: **C243, C244, C245, C246, C247, C248, FB201, R239, R240, U2**. Primary inventory owners: 9; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** The audio input follows 5V_SOC through a ferrite, independently of PMIC output enables. Its modeled 95% time 0.965 ms and 97.835 mA nominal peak reflect an assumed branch charging/load network; internal pump and bias startup have no supplied waveforms. Startup peak labels use the requested reset-release window, not a measured boot phase (see S07).

**Steady operation.** There is no external speaker/headphone load on these PMIC output pins. The separate board audio codec/amplifiers are other sections; their supply currents must not be conflated with unused RK809 audio current.

**Time-domain behavior.** Flying-capacitor commutation, bias sequencing and codec-disable transitions are unmodeled. A continuous audio input voltage does not establish that internal negative/positive bias rails are valid.

**Fields, return paths and EMC.** Native CPN/CPP tracks total 1.978112/1.874558 mm, F.Cu with zero vias. Ferrite impedance and local pump-return current are required before calculating attenuation or coupling into clocks/analog circuitry.

**Losses and temperature.** No complete idle/charge-pump/analog dissipation or PMIC temperature is known. Generic 1.3 W Class-D output capability is irrelevant to unconnected speaker pins and cannot be used as heat here.

**Missing models/evidence.** Exact unused-codec register/default behavior, pump/bias dynamics, actual standby current and FB201 impedance/current/temperature curves.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| 5V_SOC | 4.592139 | 4.848318 | 2.853584 | 4.248665 / run-0016 |
| PMIC_AUDIO_5V | 4.592047 | 4.848221 | 0.092316 | 4.248525 / run-0016 |

### Findings and conclusions

**P08-01 · medium.** The codec being unused does not make its internal bias/charge-pump support optional. Some I2S pins can be outputs in master mode, so 100 kΩ LRCLK/BCLK pulldowns are compatible with that possibility; they are not measured activity loads. Unused analog output pins remain unconnected and should not be assigned speaker-power results.

Action: Obtain exact-5 unused-codec/bias recommendations and firmware reset/disable states before removing supply, flying capacitors or bias components. Keep each mandatory bypass and unused-pin disposition explicit.

Acceptance: Supplier/application guidance and current/bias measurements support the selected inactive configuration with stable internal rails and no forced output contention.

Evidence: [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [hardware/08-pmic_audio-01.kicad_sch](../hardware/08-pmic_audio-01.kicad_sch); [hardware/design-spec.json](../hardware/design-spec.json).

**P08-02 · medium.** FB201 is only specified as 120 Ω@100 MHz/2 A; its exact impedance-versus-frequency/DC-bias and DCR are unknown. The model assumes 50 mΩ and a small codec load: nominal run-0004 audio input 4.848221 V/1.939 mA, combined run-0016 4.248525 V/2.379 mA. These are declared load results, not measured idle current. The combined 4.5 V system-floor failure does not violate the generic VCC_SPK_HP 2.7–5.5 V recommended range by itself.

Action: Select the exact ferrite against actual idle/startup/charge-pump current and required attenuation, measure bias settling and conducted noise, and confirm whether the system truly requires 4.5 V on this unused-audio branch.

Acceptance: Supported DC/RF impedance, voltage margin and observed inactive current/noise justify the selected part and system limit. Do not remove the rail merely to eliminate a scenario flag.

Evidence: [references/power-wifi/rk809-datasheet-v1.01.txt](../references/power-wifi/rk809-datasheet-v1.01.txt); [simulation/data/runs/run-0004.json](../simulation/data/runs/run-0004.json); [simulation/data/runs/run-0016.json](../simulation/data/runs/run-0016.json); [hardware/design-spec.json](../hardware/design-spec.json).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C243 | 10uF 10V X5R | 4.74433 | 0.092126 | 4.592047 | 0 | 0 | calculated |
| C244 | 2.2uF 10V X5R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C245 | 1uF 10V X5R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C246 | 2.2uF 10V X5R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C247 | 1uF 10V X5R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C248 | 1uF 10V X5R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| FB201 | 120R@100MHz 2A | Unknown | Unknown | Unknown | Unknown | Unknown | partial |
| R239 | 100k 1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R240 | 100k 1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |

## 09 — RK3566 core rails and decoupling

The native power map and local capacitor populations are consistent with separate CPU, logic, GPU, NPU and analog/PMU domains. The stored rail run meets its conditional voltage screens; it does not establish SoC operating-point, regulator-loop or die-current qualification.

Native source: [hardware/09-soc_power-01.kicad_sch](../hardware/09-soc_power-01.kicad_sch). Involved references: **C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, C15, C16, C27, C28, C29, C30, C31, C32, C33, C34, C35, U1**. Primary inventory owners: 25; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** The 95% milestones above are model milestones, not measured power-good times. U1 has 11 CPU, 9 logic, 5 GPU and 5 NPU supply balls. All are mapped to their intended rails; each domain is treated as one lumped node.

**Steady operation.** Run-0027: CPU 1.025000 V / 0.749997 A; logic 0.894632 V / 0.447315 A; GPU 0.897845 V / 0.179568 A; NPU 0.898562 V / 0.119808 A. These are rail-load budgets, not individually resolved ball currents. Logic has 84.632 mV above its 0.81 V lower limit in this run.

**Time-domain behavior.** The RC model cannot resolve package inductance, anti-resonance, voltage at individual balls, AVS changes or regulator phase margin. The startup CPU branch peak is especially sensitive to ideal source and capacitor charging assumptions.

**Fields, return paths and EMC.** Core current-loop radiation and simultaneous-switching noise are outside the local U7 output-loop field model. Include the actual power/ground stack, package and distributed decouplers before assigning fields to U1.

**Losses and temperature.** No SoC junction temperature is available. The CPU rail alone carries approximately 0.769 W in the assumed steady budget, but electrical rail power is not a measured die heat map or a thermal qualification result.

**Missing models/evidence.** Exact bulk MLCC models, RK3566 package power/ground parasitics and activity currents, operating-point tables, compatible TCS4525 model and exact RK809-5 OTP/controller models.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| VCC3V3_PMU | 3.2991 | 3.2991 | 0.029992 | 3.29852 / run-0016 |
| VCCA1V8_PMU | 1.798891 | 1.798891 | 0.036977 | 1.798175 / run-0016 |
| VCCA_1V8 | 1.798651 | 1.798651 | 0.044966 | 1.797781 / run-0016 |
| VCCIO_ACODEC | 3.29964 | 3.29964 | 0.011999 | 3.299408 / run-0016 |
| VCCIO_SD | 3.29964 | 3.29964 | 0.011999 | 3.299408 / run-0016 |
| VCCIO_WL | 1.798831 | 1.798831 | 0.011992 | 1.798077 / run-0016 |
| VCC_1V8 | 1.798561 | 1.798561 | 0.119904 | 1.797633 / run-0016 |
| VCC_3V3 | 3.265843 | 3.265843 | 2.1 | 3.243706 / run-0016 |
| VDDA0V9_PMU | 0.899251 | 0.899251 | 0.024979 | 0.898767 / run-0016 |
| VDDA_0V9 | 0.898652 | 0.898652 | 0.044933 | 0.897784 / run-0016 |
| VDD_CPU | 1.025 | 1.025 | 4.67721 | 1.025 / run-0004 |
| VDD_GPU | 0.897845 | 0.897845 | 0.179569 | 0.896459 / run-0016 |
| VDD_LOGIC | 0.894632 | 0.894632 | 0.447316 | 0.8912 / run-0016 |
| VDD_NPU | 0.898562 | 0.898562 | 0.119808 | 0.897636 / run-0016 |

### Findings and conclusions

**DG09-01 · info.** Sheet-local nominal bypass is 70.7 µF CPU, 70.8 µF logic, 48.8 µF GPU and 44.1 µF NPU. Total directly connected board capacitance on those rails is 92.7, 114.9, 92.9 and 88.2 µF respectively. The saved model applies a uniform 0.7 factor, not measured part-specific derating.

Action: Select exact bulk-capacitor ordering codes and extract the regulator-to-ball PDN, retaining these populations until that analysis justifies a change.

Acceptance: Each populated capacitor has a voltage/bias/temperature model; rail impedance and load-step excursions are checked at the SoC balls over the chosen workloads.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/09-soc_power-01.kicad_sch](../hardware/09-soc_power-01.kicad_sch).

**DG09-02 · high.** Run-0027 holds VDD_CPU at exactly 1.025 V through an ideal Kelvin-feedback rule and produces a 4.677 A peak in the R227/CPU-capacitor branch. Neither number is a TCS4525/RK3566 transient prediction. CPU/GPU/NPU upper acceptance values used by the behavioral screen are scenario targets; the SoC recommended table gives no fixed maximum for those dynamic domains.

Action: Define the supported CPU/GPU/NPU operating points and measured/authorized load profiles, then replace ideal Kelvin behavior with a qualified controller/PDN model.

Acceptance: Boot and every allowed operating point satisfy the voltage requirements supplied for that speed bin; real startup and load-step current peaks remain inside regulator, inductor, shunt and interconnect ratings.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [references/rk3566-v1.2.txt](../references/rk3566-v1.2.txt); [simulation/engine.py](../simulation/engine.py); [hardware/03-cpu-01.kicad_sch](../hardware/03-cpu-01.kicad_sch).

**DG09-03 · high.** The saved model reaches 95% on logic/PMU 0.9 V at 5.230 ms, PMU 1.8/3.3 V and GPU at 9.135 ms, CPU at 9.140 ms and NPU at 13.040 ms. CPU_EN is physically pulled from PMU 3.3 V through R226 with C251 DNP, so this is not an independently verified CPU sequence.

Action: Resolve the exact RK809-5 OTP/channel sequence and the TCS enable/soft-start behavior; instrument the corresponding SoC rails and reset.

Acceptance: Measured stable-power order, continuous reset hold and recovery satisfy the selected Rockchip requirements at supply and temperature corners; no rail timing is inferred solely from the candidate group number.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [hardware/03-cpu-01.kicad_sch](../hardware/03-cpu-01.kicad_sch); [hardware/09-soc_power-01.kicad_sch](../hardware/09-soc_power-01.kicad_sch).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C1 | 4.7uF 6.3V X5R | 1.025 | 0.236079 | 1.025 | 0 | 0 | calculated |
| C2 | 22uF 6.3V X5R | 1.025 | 1.105051 | 1.025 | 0 | 0 | calculated |
| C3 | 22uF 6.3V X5R | 1.025 | 1.105051 | 1.025 | 0 | 0 | calculated |
| C4 | 22uF 6.3V X5R | 1.025 | 1.105051 | 1.025 | 0 | 0 | calculated |
| C5 | 100nF 16V X7R(Murata) 10% | 0.899191 | 3.147e-05 | 0.894632 | 0 | 0 | calculated |
| C6 | 22uF 6.3V X5R | 0.899191 | 0.006924 | 0.894632 | 0 | 0 | calculated |
| C7 | 22uF 6.3V X5R | 0.899191 | 0.006924 | 0.894632 | 0 | 0 | calculated |
| C8 | 4.7uF 6.3V X5R | 0.899191 | 0.001479 | 0.894632 | 0 | 0 | calculated |
| C9 | 22uF 6.3V X5R | 0.899191 | 0.006924 | 0.894632 | 0 | 0 | calculated |
| C10 | 100nF 16V X7R(Murata) 10% | 0.899676 | 3.149e-05 | 0.897845 | 0 | 0 | calculated |
| C11 | 4.7uF 6.3V X5R | 0.899676 | 0.00148 | 0.897845 | 0 | 0 | calculated |
| C12 | 22uF 6.3V X5R | 0.899676 | 0.006928 | 0.897845 | 0 | 0 | calculated |
| C13 | 22uF 6.3V X5R | 0.899676 | 0.006928 | 0.897845 | 0 | 0 | calculated |
| C14 | 100nF 16V X7R(Murata) 10% | 0.899784 | 3.149e-05 | 0.898562 | 0 | 0 | calculated |
| C15 | 22uF 6.3V X5R | 0.899784 | 0.006928 | 0.898562 | 0 | 0 | calculated |
| C16 | 22uF 6.3V X5R | 0.899784 | 0.006928 | 0.898562 | 0 | 0 | calculated |
| C27 | 100nF 16V X7R(Murata) 10% | 3.299865 | 0.0001155 | 3.2991 | 0 | 0 | calculated |
| C28 | 1uF 10V X5R | 0.899888 | 0.00031496 | 0.899251 | 0 | 0 | calculated |
| C29 | 100nF 16V X7R(Murata) 10% | 0.899888 | 3.15e-05 | 0.899251 | 0 | 0 | calculated |
| C30 | 1uF 10V X5R | 1.799834 | 0.00063033 | 1.798891 | 0 | 0 | calculated |
| C31 | 100nF 16V X7R(Murata) 10% | 1.799834 | 6.303e-05 | 1.798891 | 0 | 0 | calculated |
| C32 | 1uF 10V X5R | 0.899798 | 0.00031493 | 0.898652 | 0 | 0 | calculated |
| C33 | 100nF 16V X7R(Murata) 10% | 0.899798 | 3.149e-05 | 0.898652 | 0 | 0 | calculated |
| C34 | 1uF 10V X5R | 1.799798 | 0.00062993 | 1.798651 | 0 | 0 | calculated |
| C35 | 100nF 16V X7R(Murata) 10% | 1.799798 | 6.299e-05 | 1.798651 | 0 | 0 | calculated |

## 10 — RK3566 IO and PHY supply domains

The sheet separates 0.9 V and 1.8 V image/PHY supplies from IO banks. No unconnected declared SoC supply pin was found. The most important remaining work is bank-level power-off behavior and high-frequency supply integrity, not a blanket voltage reassignment.

Native source: [hardware/10-soc_phy_power-01.kicad_sch](../hardware/10-soc_phy_power-01.kicad_sch). Involved references: **C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C48, C49, C50, C51, C52, C53, C54, C55, C56, C57, C58, C59, C60, C61, C62, C63, C64, C65, C66, C67, U1**. Primary inventory owners: 32; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** Both image analog rails reach their modeled 95% level at 16.945 ms. IO and PHY state machines are not simulated, so these supply curves cannot prove CSI/USB/HDMI PHY reset completion.

**Steady operation.** Run-0027 gives VCC_1V8 1.798561 V, VCCIO_WL 1.798831 V, VCCIO_SD and VCCIO_ACODEC 3.299640 V, and VCC_3V3 3.265843 V. Their stated 1.8/3.3 V limits are 1.62–1.98 V and 2.97–3.63 V; all cited values are conditional lumped-rail results.

**Time-domain behavior.** Shared analog loads and signal clamp currents remain unresolved. Unused eDP/HDMI/MULTI_PHY signal pins do not by themselves authorize removal of their connected supply or bypass networks.

**Fields, return paths and EMC.** A 100 nF label does not establish its impedance near PHY edge harmonics. Use physical MLCC placement, mounting inductance and reference-plane geometry; no U7 field plot represents these domains.

**Losses and temperature.** The image-rail budget is approximately 31.4 mW at 0.9 V and 36.0 mW at 1.8 V in the stored run. These are aggregate assumed electrical loads and cannot be converted to PHY temperatures.

**Missing models/evidence.** RK3566 IO power-domain checklist and off-state pin models, enabled-PHY current spectra and noise limits, distributed MLCC and package/plane parasitics.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| VCC3V3_PMU | 3.2991 | 3.2991 | 0.029992 | 3.29852 / run-0016 |
| VCCA1V8_IMAGE | 1.7994 | 1.7994 | 0.019993 | 1.799013 / run-0016 |
| VCCA_1V8 | 1.798651 | 1.798651 | 0.044966 | 1.797781 / run-0016 |
| VCCIO_ACODEC | 3.29964 | 3.29964 | 0.011999 | 3.299408 / run-0016 |
| VCCIO_SD | 3.29964 | 3.29964 | 0.011999 | 3.299408 / run-0016 |
| VCCIO_WL | 1.798831 | 1.798831 | 0.011992 | 1.798077 / run-0016 |
| VCC_1V8 | 1.798561 | 1.798561 | 0.119904 | 1.797633 / run-0016 |
| VCC_3V3 | 3.265843 | 3.265843 | 2.1 | 3.243706 / run-0016 |
| VDDA0V9_IMAGE | 0.898951 | 0.898951 | 0.034959 | 0.898275 / run-0016 |
| VDDA_0V9 | 0.898652 | 0.898652 | 0.044933 | 0.897784 / run-0016 |

### Findings and conclusions

**DG10-01 · info.** The native map connects VCCIO2/1C13 to VCC_1V8, VCCIO1/1D13 to VCCIO_ACODEC, VCCIO3/1F17 to VCCIO_SD, VCCIO4/1E16 to VCCIO_WL, VCCIO5/6/7 to VCC_3V3 and both PMUIO banks to VCC3V3_PMU. Across U1 there are 80 non-ground power-input balls on 17 named rails.

Action: Keep this bank map explicit in the firmware/device-tree and external-interface power checklist.

Acceptance: Every active signal is assigned to the correct supply bank and matches its connected peripheral voltage in all operating and sleep modes.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [hardware/10-soc_phy_power-01.kicad_sch](../hardware/10-soc_phy_power-01.kicad_sch).

**DG10-02 · medium.** Thirty-two 100 nF capacitors are assigned on this sheet. Image 0.9 V has five local capacitors and image 1.8 V four. The stored voltages are 0.898951 V and 1.799400 V, respectively; the lumped model cannot test ripple coupling between CSI, DSI and HDMI analog pins that share those rails.

Action: Extract local decoupler/plane impedances and obtain the required analog-rail noise limits for the enabled PHYs.

Acceptance: At the actual PHY pins, DC limits and documented ripple/noise requirements hold during camera traffic and simultaneous system activity.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/10-soc_phy_power-01.kicad_sch](../hardware/10-soc_phy_power-01.kicad_sch).

**DG10-03 · high.** The saved rail milestones differ substantially: VCCIO_WL reaches 95% at 9.135 ms, VCC_3V3 at 18.975 ms, and VCCIO_SD/ACODEC at 20.850 ms. IO drivers and external sources are not switched by a pin-level power-off model, so a rail-voltage pass cannot exclude back-power through IO clamps.

Action: Review each connected interface against this native bank map for cold start, partial power, suspend and loss of the external peripheral rails; change isolation or sequencing only where an actual domain conflict is established.

Acceptance: No active input exceeds its receiving-bank powered/off specification and no unintended clamp current or rail back-feed occurs in the tested supply permutations.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C36 | 100nF 16V X7R(Murata) 10% | 1.799784 | 6.299e-05 | 1.798561 | 0 | 0 | calculated |
| C37 | 100nF 16V X7R(Murata) 10% | 3.299946 | 0.0001155 | 3.29964 | 0 | 0 | calculated |
| C38 | 100nF 16V X7R(Murata) 10% | 1.799798 | 6.299e-05 | 1.798651 | 0 | 0 | calculated |
| C39 | 100nF 16V X7R(Murata) 10% | 1.799798 | 6.299e-05 | 1.798651 | 0 | 0 | calculated |
| C40 | 100nF 16V X7R(Murata) 10% | 1.799825 | 6.303e-05 | 1.798831 | 0 | 0 | calculated |
| C41 | 100nF 16V X7R(Murata) 10% | 3.299946 | 0.0001155 | 3.29964 | 0 | 0 | calculated |
| C42 | 100nF 16V X7R(Murata) 10% | 1.799798 | 6.299e-05 | 1.798651 | 0 | 0 | calculated |
| C43 | 100nF 16V X7R(Murata) 10% | 1.799798 | 6.299e-05 | 1.798651 | 0 | 0 | calculated |
| C44 | 100nF 16V X7R(Murata) 10% | 0.899798 | 3.149e-05 | 0.898652 | 0 | 0 | calculated |
| C45 | 100nF 16V X7R(Murata) 10% | 3.294843 | 0.006358 | 3.265843 | 0 | 0 | calculated |
| C46 | 100nF 16V X7R(Murata) 10% | 3.294843 | 0.006358 | 3.265843 | 0 | 0 | calculated |
| C47 | 100nF 16V X7R(Murata) 10% | 1.799798 | 6.299e-05 | 1.798651 | 0 | 0 | calculated |
| C48 | 100nF 16V X7R(Murata) 10% | 0.899798 | 3.149e-05 | 0.898652 | 0 | 0 | calculated |
| C49 | 100nF 16V X7R(Murata) 10% | 0.899798 | 3.149e-05 | 0.898652 | 0 | 0 | calculated |
| C50 | 100nF 16V X7R(Murata) 10% | 0.899798 | 3.149e-05 | 0.898652 | 0 | 0 | calculated |
| C51 | 100nF 16V X7R(Murata) 10% | 1.799798 | 6.299e-05 | 1.798651 | 0 | 0 | calculated |
| C52 | 100nF 16V X7R(Murata) 10% | 3.294843 | 0.006358 | 3.265843 | 0 | 0 | calculated |
| C53 | 100nF 16V X7R(Murata) 10% | 3.294843 | 0.006358 | 3.265843 | 0 | 0 | calculated |
| C54 | 100nF 16V X7R(Murata) 10% | 3.294843 | 0.006358 | 3.265843 | 0 | 0 | calculated |
| C55 | 100nF 16V X7R(Murata) 10% | 3.294843 | 0.006358 | 3.265843 | 0 | 0 | calculated |
| C56 | 100nF 16V X7R(Murata) 10% | 3.294843 | 0.006358 | 3.265843 | 0 | 0 | calculated |
| C57 | 100nF 16V X7R(Murata) 10% | 0.899843 | 3.149e-05 | 0.898951 | 0 | 0 | calculated |
| C58 | 100nF 16V X7R(Murata) 10% | 0.899843 | 3.149e-05 | 0.898951 | 0 | 0 | calculated |
| C59 | 100nF 16V X7R(Murata) 10% | 0.899843 | 3.149e-05 | 0.898951 | 0 | 0 | calculated |
| C60 | 100nF 16V X7R(Murata) 10% | 0.899843 | 3.149e-05 | 0.898951 | 0 | 0 | calculated |
| C61 | 100nF 16V X7R(Murata) 10% | 3.299865 | 0.0001155 | 3.2991 | 0 | 0 | calculated |
| C62 | 100nF 16V X7R(Murata) 10% | 1.79991 | 6.3e-05 | 1.7994 | 0 | 0 | calculated |
| C63 | 100nF 16V X7R(Murata) 10% | 0.899843 | 3.149e-05 | 0.898951 | 0 | 0 | calculated |
| C64 | 100nF 16V X7R(Murata) 10% | 1.79991 | 6.3e-05 | 1.7994 | 0 | 0 | calculated |
| C65 | 100nF 16V X7R(Murata) 10% | 1.79991 | 6.3e-05 | 1.7994 | 0 | 0 | calculated |
| C66 | 100nF 16V X7R(Murata) 10% | 3.299865 | 0.0001155 | 3.2991 | 0 | 0 | calculated |
| C67 | 100nF 16V X7R(Murata) 10% | 1.79991 | 6.3e-05 | 1.7994 | 0 | 0 | calculated |

## 11 — RK3566 physical ground-ball inventory

All 187 physical ground balls are native-connected in one group. This verifies the ground inventory, while return impedance, via reliability and thermal spreading remain separate questions.

Native source: [hardware/11-soc_ground-01.kicad_sch](../hardware/11-soc_ground-01.kicad_sch). Involved references: **U1**. Primary inventory owners: 0; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** A connected ground network exists before modeled rail startup, but the behavioral model assumes it is an ideal zero-volt reference. It does not calculate ground bounce during capacitor charging.

**Steady operation.** No numeric ground-ball current is assigned. All ball currents sum through distributed package/copper paths that are absent from the lumped rail model.

**Time-domain behavior.** Native via spans and plane connections are known; actual spreading inductance, simultaneous-switching ground motion and microvia reliability are not calculated.

**Fields, return paths and EMC.** Do not replace the ground planes with one guessed return wire. The saved magnetic model only closes explicit U7 output-loop filaments and has no solved current distribution under U1.

**Losses and temperature.** Ground balls/vias may conduct heat as well as current, but neither the 187-ball count nor the 152 via-in-pad count establishes a thermal resistance.

**Missing models/evidence.** Full package power/ground interconnect, native filled-plane mesh, copper thickness/material qualification, via plating/construction and thermal stack/interface data.

### Findings and conclusions

**DG11-01 · info.** The 565-ball U1 map contains 131 VSS and 56 AVSS/DDR/PLL ground balls, for 187 total. Fresh native connectivity puts all 187 in one GND group. 152 have a same-surface ground-via center inside their pad; the other 35 remain connected through the native copper.

Action: Preserve the complete ground-ball endpoint inventory through subsequent layout edits and review any changed ground escape individually.

Acceptance: Zero missing ground balls and zero native group splits after each proposed revision; manufacturer land/via construction accepted by the fabricator.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/11-soc_ground-01.kicad_sch](../hardware/11-soc_ground-01.kicad_sch); [research/rk3566-pin-audit.json](../research/rk3566-pin-audit.json).

**DG11-02 · medium.** The largest nearest same-surface ground-via center distance among U1 ground balls is 2.829 mm at AR38. This is a geometric inspection marker, not its return-current path or an inductance limit. The viewer omits copper-zone fills and therefore cannot be used to diagnose absent ground planes.

Action: Inspect AR38 and the other non-via-in-pad escapes together with actual filled zones and nearby high-speed return transitions.

Acceptance: A native plane/PDN extraction demonstrates the needed return impedance; any added ground via has a documented benefit and passes stack/drill/assembly checks.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [simulation/board_view.py](../simulation/board_view.py); [hardware/rk3566-sbc.kicad_pcb](../hardware/rk3566-sbc.kicad_pcb).

**DG11-03 · medium.** The retained native-reference audit identifies lost ground coverage beneath narrow outer-edge areas of DDR3_BA2 and DDR3_DQ11 even though their affected centerlines remain covered. The differential-pair audit reports 24.721 mm of uncovered centerline, all within its explicit 0.4 mm transition neighborhoods; that neighborhood is bookkeeping, not a current-return allowance.

Action: Carry finite-width reference coverage and transition return continuity into the DDR extraction, including these retained edge changes.

Acceptance: No unexplained reference cut or reference transfer remains in the extracted channels; SI and return-current evidence covers the complete transition geometry.

Evidence: [differential-revision/final/return-reference-assessment.json](../differential-revision/final/return-reference-assessment.json); [differential-revision/final/pair-references.json](../differential-revision/final/pair-references.json); [reports/final-readiness.json](../reports/final-readiness.json).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

This sheet contains shared IC units; their physical references are counted under their native primary sheet. Every relevant unit and pin remains in this section’s review and web inspector.

## 12 — RK3566 unused pins and explicit no-connect inventory

The explicit no-connect inventory is internally consistent: 154 U1 pins are unused, comprising 150 bidirectional pins, three outputs and one input. No declared power pin was found in that inventory; functional pin-specific handling still needs the manufacturer unused-pin checklist.

Native source: [hardware/12-unused_io-01.kicad_sch](../hardware/12-unused_io-01.kicad_sch). Involved references: **U1**. Primary inventory owners: 0; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** Reset-state pulls and pinmux are not implemented by the electrical simulator. The no-connect declarations prove intent, not a powered-up GPIO state or immunity to floating-input current.

**Steady operation.** No 0 A claim is made for unused IC pins. Internal pull currents, analog bias and leakage depend on actual configuration and silicon conditions.

**Time-domain behavior.** Validate that enable/disable and suspend sequences leave unused functions in documented safe states, especially the recovery role and test/debug mux.

**Fields, return paths and EMC.** Unrouted unused pins do not form board trace antennas, but their package coupling and internally enabled functions are still outside the EM model.

**Losses and temperature.** No per-pin leakage/temperature model exists. Disabling unused PHY and GPIO functions may affect power, but no saving is quantified here.

**Missing models/evidence.** Exact RK3566 unused-pin/pinmux checklist, boot register configuration, off-state/analog input characteristics and recovery firmware evidence.

### Findings and conclusions

**DG12-01 · info.** The 154 no-connect pins are named physical balls, not missing schematic wires. U1.1M18/DFT_TEST_GND is deliberately outside that group and is connected to GND through populated R6 = 0 Ω.

Action: Keep a reviewed per-ball table of no-connect intent and required reset/sleep pinmux/pull state.

Acceptance: All intentionally unused pins match the exact RK3566 pinout/unused-pin guidance, and no power, test or required boot function is silently treated as a generic GPIO.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [hardware/12-unused_io-01.kicad_sch](../hardware/12-unused_io-01.kicad_sch); [hardware/17-soc_clock-01.kicad_sch](../hardware/17-soc_clock-01.kicad_sch).

**DG12-02 · medium.** USB_OTG0_ID at T37 is the only unused pin typed input. The carrier uses OTG0 for recovery, so its intended peripheral-only role must be established by the actual OTG/controller configuration rather than inferred from the unused marker.

Action: Confirm device-only recovery behavior and the permitted handling of OTG0_ID; add a bias connection only if the applicable controller guidance requires it.

Acceptance: Cold boot and Maskrom recovery enumerate reliably for every supported USB power state without an unintended host-role transition.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [hardware/12-unused_io-01.kicad_sch](../hardware/12-unused_io-01.kicad_sch); [hardware/25-usb_recovery-01.kicad_sch](../hardware/25-usb_recovery-01.kicad_sch).

**DG12-03 · medium.** ARM_JTAG_TCK/TMS multiplexed balls 1D20/1F18 are no-connects even though R5 pulls SDMMC0_DET_L high. EMMC_RSTn at 1B16 is also a no-connect, consistent with the selected 34-pin module interface providing no reset contact. Neither JTAG accessibility nor direct eMMC hardware reset should be advertised.

Action: Document the actual debug/recovery paths; if JTAG or a dedicated storage reset is required, define that change explicitly rather than repurposing an unused pin casually.

Acceptance: The recovery plan is demonstrated with corrupt boot media; debug documentation and firmware reset handling match only physically available connections.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [references/soc-memory/radxa-emmc-brief-rev1.1.txt](../references/soc-memory/radxa-emmc-brief-rev1.1.txt).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

This sheet contains shared IC units; their physical references are counted under their native primary sheet. Every relevant unit and pin remains in this section’s review and web inspector.

## 13 — DDR3L address, command and clock

U4 and U5 are two 8 Gbit ×16 DDR3L devices forming a single 32-bit rank with 2 GiB total capacity. Their CA/control and clock nets are connected, but the selected loader, channel timing and DDR reset protocol have not been demonstrated.

Native source: [hardware/13-ddr_control-01.kicad_sch](../hardware/13-ddr_control-01.kicad_sch). Involved references: **C430, R404, U1, U4, U5**. Primary inventory owners: 4; DNP among owners: 2. Shared members are not extra physical parts.

**Startup and boot.** DDR rail 95% occurs at 16.945 ms in run-0027, but loader reset/CKE timing, DLL lock, ZQ calibration and training are absent. Reset must be established while power is rising; this requires a real pin/boot model or capture.

**Steady operation.** Both devices use the same CA/control nets and VCC_DDR rail. The ISSI −125 grade supports a device bin of 1600 MT/s; no operating data rate for this PCB is qualified. The prior 800 MHz/1600 MT/s timing calculations are explicitly sensitivity cases.

**Time-domain behavior.** Clock matching in millimeters cannot establish matched delay when layer allocation, vias, packages and branches differ. Receiver data-sheet setup/hold specifications must not be repurposed as allowable PCB skew.

**Fields, return paths and EMC.** The clock/CA multi-drop loops, RC reservation and long RESET route need real return planes and driver edge rates. No emissions value follows from connectivity or the small equal-length clock residual.

**Losses and temperature.** DRAM active/refresh/ODT power is unresolved; the VCC_DDR budget includes both memories and the SoC PHY and cannot be divided equally into device temperatures.

**Missing models/evidence.** Exact Rockchip loader training configuration, per-ball package delays, SoC/ISSI IBIS and timing models, confirmed laminate/impedance, and loader-controlled reset/clock/CKE trajectories.

### Findings and conclusions

**DG13-01 · info.** The source-matching native audit finds all 74 DDR-prefixed nets connected, including 100 U1-to-DRAM paths: 44 DQ/DQS/DM point-to-point signals, 26 CA/reset nets to both DRAMs and both clock polarities to both DRAMs. The other two DDR-prefixed nets are reference/optional-RC support. Manufacturer pin extraction found no DRAM/SoC signal mapping mismatch.

Action: Preserve the single-rank map and obtain an approved DDR loader/bin configuration for these exact devices and the custom topology.

Acceptance: The boot loader recognizes the intended 2 GiB geometry, initializes both devices, trains all four byte lanes and passes sustained memory testing across operating corners.

Evidence: [differential-revision/final/timing/ddr-timing-audit.md](../differential-revision/final/timing/ddr-timing-audit.md); [references/soc-memory/memory-verification.json](../references/soc-memory/memory-verification.json); [hardware/13-ddr_control-01.kicad_sch](../hardware/13-ddr_control-01.kicad_sch).

**DG13-02 · high.** Native CLK paths are 18.948 mm to U4 and 20.248 mm to U5, with essentially zero P/N 3D mismatch. However, clock parallel overlap is only 70.9%; uncoupled copper is 7.703/7.795 mm. CA A1→U4 is 61.075 mm in 3D, while CKE→U5 is 29.584 mm. The published 6 ps/mm sensitivity gives 252.759 ps A1-vs-CLK and 56.014 ps CKE-vs-CLK offsets; neither is receiver timing slack.

Action: Extract CA and clock channels at both loads with actual packages and the chosen rate/1T-or-2T configuration; address long A1 routing, transition symmetry and clock uncoupled regions based on that result.

Acceptance: Actual setup/hold/eye requirements are met at U4 and U5 for CS/CKE/ODT and all CA signals with the loader modes used during initialization and normal traffic.

Evidence: [differential-revision/final/timing/ddr-timing-audit.md](../differential-revision/final/timing/ddr-timing-audit.md); [reports/differential-review.md](../reports/differential-review.md); [differential-revision/final/channel-metrics.json](../differential-revision/final/channel-metrics.json).

**DG13-03 · high.** DDR3_RESETn reaches U4 at 73.481 mm and U5 at 85.851 mm in 3D. No separate DDR_RESETn/CKE waveform exists in the stored run. The 40 ms system-reset release is not proof of the DRAM protocol: ISSI specifies reset low through stable power for at least 200 µs, followed by at least 500 µs before active CKE.

Action: Capture or simulate the real loader-driven DDR reset/CKE/clock sequence and the complete asynchronous reset net, including both loads.

Acceptance: ISSI startup requirements are satisfied at both DRAM pins, with monotonic reset threshold crossings and qualified overshoot/undershoot. Do not length-match asynchronous RESET to CLK.

Evidence: [differential-revision/final/timing/ddr-timing-audit.md](../differential-revision/final/timing/ddr-timing-audit.md); [references/soc-memory/issi-ddr3l.txt](../references/soc-memory/issi-ddr3l.txt); [hardware/13-ddr_control-01.kicad_sch](../hardware/13-ddr_control-01.kicad_sch).

**DG13-04 · medium.** R404 = 100 Ω and C430 = 10 pF are both DNP. They reserve a series RC branch across CLKP and CLKN; they are not populated termination and are not series resistors inserted into the two clock conductors.

Action: Include the actual DNP pad/branch geometry in clock extraction and evaluate candidate RC values only with the full differential channel.

Acceptance: The selected population is documented and improves measured/simulated clock integrity without violating driver load or receiver swing/timing requirements.

Evidence: [hardware/design-spec.json](../hardware/design-spec.json); [hardware/13-ddr_control-01.kicad_sch](../hardware/13-ddr_control-01.kicad_sch).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C430 | 10pF C0G DNP · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| R404 | 100R 1% DNP · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| U4 | IS43TR16512BL-125KBLI 8Gb DDR3L | 1.348831 | Unknown | 1.342245 | Unknown | Unknown | partial |
| U5 | IS43TR16512BL-125KBLI 8Gb DDR3L | 1.348831 | Unknown | 1.342245 | Unknown | Unknown | partial |

## 14 — DDR3L byte lanes 0 and 1 / U4

All 22 DQ/DM/DQS signals for U4 are connected. Byte 0 is relatively compact; byte 1 crosses more layers and its strobe legs have asymmetric transition counts that remain an SI concern despite small total-length mismatch.

Native source: [hardware/14-ddr_low-01.kicad_sch](../hardware/14-ddr_low-01.kicad_sch). Involved references: **U1, U4**. Primary inventory owners: 0; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** U4 byte behavior begins only after DDR rail, reset, clock and loader training. None of the digital lane output states is simulated during rail startup.

**Steady operation.** DQ and DM signal voltages/currents are unknown time functions; the common VCC_DDR rail is 1.342245 V in run-0027. That does not imply every signal remains at that voltage or carries rail current.

**Time-domain behavior.** Read and write directions swap driver/receiver roles. Simultaneous switching, ODT settings, DLL timing, crosstalk and package delay must be included; a single DC connection check covers neither direction.

**Fields, return paths and EMC.** DQS1 transition asymmetry is a concrete candidate for mode conversion and reference discontinuity review, not a quantified emissions failure. DQS0 has 83.8% geometric parallel overlap and still has short uncoupled escapes.

**Losses and temperature.** Byte-lane activity and ODT losses are not available. U4 remains temperature-unknown and must not inherit the separate L219 thermal illustration.

**Missing models/evidence.** U4 and RK3566 IBIS/package models, read/write timing/ODT/training settings, actual material loss and full aggressor/return geometry.

### Findings and conclusions

**DG14-01 · info.** Byte 0 DQ/DM 3D paths span 11.011–25.973 mm. DQS0 P/N are 13.773/13.801 mm, both with four traversed via objects, for 0.028 mm mismatch. The largest positive equal-velocity DQ/DM offset is DQ7 at 73.119 ps; the most negative is −16.657 ps. These are path comparisons at assumed 6 ps/mm.

Action: Include all byte-0 data/mask/strobe channels and their real package delays in read and write timing analysis.

Acceptance: Byte-0 read/write eyes and training margins meet the selected part and controller requirements across PVT; no artificial 0.028 mm meander is added solely to zero a geometry number.

Evidence: [differential-revision/final/timing/ddr-timing-audit.md](../differential-revision/final/timing/ddr-timing-audit.md); [differential-revision/final/ddr-paths.json](../differential-revision/final/ddr-paths.json); [hardware/14-ddr_low-01.kicad_sch](../hardware/14-ddr_low-01.kicad_sch).

**DG14-02 · high.** DQS1P and DQS1N are closely length matched (33.349 and 33.329 mm in 3D), but their existing paths traverse three and eight via objects respectively. P uses F/In5/B; N also includes In2. Pair parallel overlap is 73.8% with approximately 7.9 mm uncoupled copper per leg.

Action: Evaluate a more symmetric DQS1 layer/via topology and reduce separated segments where an extracted differential channel confirms benefit.

Acceptance: Extracted and measured differential response, common-mode conversion, timing and return continuity improve while native connectivity and manufacturability remain intact.

Evidence: [differential-revision/final/timing/ddr-timing-audit.md](../differential-revision/final/timing/ddr-timing-audit.md); [reports/differential-review.md](../reports/differential-review.md); [differential-revision/final/pair-references.json](../differential-revision/final/pair-references.json).

**DG14-03 · medium.** Byte 1 DQ/DM paths span 35.296–45.345 mm, with 11.745–72.037 ps offset from mean DQS in the equal-velocity case; DQ11 is the largest positive offset. The retained-reference review also identifies narrow finite-width ground-edge loss beneath DQ11.

Action: Prioritize DQ11 and the byte-1 reference/transition topology together; do not treat the edge-area finding as measured eye closure.

Acceptance: All byte-1 channels meet full electrical timing and return-path checks, including the repaired/reference-edge geometry.

Evidence: [differential-revision/final/timing/ddr-timing-audit.md](../differential-revision/final/timing/ddr-timing-audit.md); [differential-revision/final/return-reference-assessment.json](../differential-revision/final/return-reference-assessment.json).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

This sheet contains shared IC units; their physical references are counted under their native primary sheet. Every relevant unit and pin remains in this section’s review and web inspector.

## 15 — DDR3L byte lanes 2 and 3 / U5

All 22 U5 data/mask/strobe signals are connected. The strongest geometry priorities are byte 3 data spread and byte 2 strobe transitions; neither currently establishes an electrical timing pass or fail.

Native source: [hardware/15-ddr_high-01.kicad_sch](../hardware/15-ddr_high-01.kicad_sch). Involved references: **U1, U5**. Primary inventory owners: 0; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** U5 reset and training must be validated independently from U4 because its branch lengths and byte topology differ. The stored rail model supplies neither DQS waveform nor training state.

**Steady operation.** Byte 2 DQ/DM paths span 15.930–22.226 mm and have −37.701 to +0.078 ps equal-velocity offsets from DQS2; DM2 is most negative. These are diagnostic geometry comparisons, not signed setup/hold slack.

**Time-domain behavior.** Byte 3 has the largest data-path spread while DQS3 has the simplest strobe layer topology. The optimization target must be actual trained timing and signal quality, not uniform millimeters across unrelated signals.

**Fields, return paths and EMC.** DQS2 transition/return geometry and byte-3 crosstalk require an extracted network. The existing U7 B/H map has no valid current excitation for either byte.

**Losses and temperature.** U5 activity/ODT power and junction temperature are unknown. Do not split the shared 0.646 A modeled DDR-rail current into arbitrary U4/U5 or lane currents.

**Missing models/evidence.** U5/RK3566 package timing and IO models, configured bit/byte mapping and training, actual stack/return extraction and aggressor states.

### Findings and conclusions

**DG15-01 · high.** Byte 3 DQ/DM paths span 11.758–29.544 mm, a 17.786 mm spread. Their equal-velocity offsets from mean DQS3 range 16.421–123.139 ps; DQ31 is the largest positive offset. Moving both DQS3 legs together would shift all offsets but would not narrow that DQ/DM spread.

Action: Evaluate the longest byte-3 routes, especially DQ31, against package-aware trained timing before selecting shorter routes or intentional matching.

Acceptance: All byte-3 read/write margins pass the selected electrical timing model and PVT tests; changes preserve strobe pairing and avoid dense independent-leg meanders.

Evidence: [differential-revision/final/timing/ddr-timing-audit.md](../differential-revision/final/timing/ddr-timing-audit.md); [hardware/15-ddr_high-01.kicad_sch](../hardware/15-ddr_high-01.kicad_sch).

**DG15-02 · medium.** DQS3 P/N are wholly on F.Cu with zero traversed vias and 8.938/9.103 mm paths. The 0.165 mm mismatch is the largest remaining DDR strobe geometry mismatch, but its 79.0% parallel overlap is substantially better than earlier revisions. There is no obtained manufacturer PCB skew limit that makes 0.165 mm by itself a failure.

Action: Keep the short F.Cu topology as a candidate and tune only if extracted differential delay/timing requires it.

Acceptance: Full channel timing and coupling are qualified; any tuning improves delay balance without degrading spacing, return continuity or manufacturability.

Evidence: [differential-revision/final/timing/ddr-timing-audit.md](../differential-revision/final/timing/ddr-timing-audit.md); [reports/differential-review.md](../reports/differential-review.md).

**DG15-03 · high.** DQS2 uses six traversed via objects per leg and 22.149/22.277 mm total paths, with 0.127 mm mismatch. Parallel overlap is 62.7%, with 6.084/6.211 mm uncoupled copper. A reviewed DQS2N transition at normalized (24.2,17.4) mm has its nearest listed compatible ground via 3.202 mm away; this is a geometric proximity measurement only.

Action: Review DQS2 return transfers and separated segments with native planes; consider symmetric routing and local return stitching only after electrical and drill-stack review.

Acceptance: Extracted return impedance and differential/common-mode response meet the channel requirements, with no newly introduced drill or stack-interface conflict.

Evidence: [differential-revision/final/timing/ddr-timing-audit.md](../differential-revision/final/timing/ddr-timing-audit.md); [differential-revision/final/pair-references.json](../differential-revision/final/pair-references.json); [differential-revision/final/return-reference-assessment.json](../differential-revision/final/return-reference-assessment.json); [reports/differential-review.md](../reports/differential-review.md).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

This sheet contains shared IC units; their physical references are counted under their native primary sheet. Every relevant unit and pin remains in this section’s review and web inspector.

## 16 — DDR3L supply, VREF and ZQ networks

The physical reference topology matches DDR3L use: one shared VCC_DDR supply, a separate precision VREFCA divider, SoC-generated VREFDQ and separate calibration resistors. The references are not dynamically solved by the current rail model.

Native source: [hardware/16-ddr_power-01.kicad_sch](../hardware/16-ddr_power-01.kicad_sch). Involved references: **C17, C18, C19, C20, C21, C22, C23, C24, C25, C26, C400, C401, C402, C403, C404, C405, C406, C407, C408, C409, C410, C411, C412, C413, C414, C415, C416, C417, C418, C419, C420, C421, C422, C423, C424, C425, C426, C427, C428, C429, R1, R400, R401, R402, R403, U1, U4, U5**. Primary inventory owners: 45; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** VCC_DDR reaches the model 95% level at 16.945 ms. VREFCA has an additional physical RC trajectory and VREFDQ has a separate internal-source trajectory; neither is validated by the system RESETn release at 40 ms.

**Steady operation.** Run-0027 gives VCC_DDR 1.342245 V and an aggregate 0.646264 A, leaving 59.245 mV above the 1.283 V lower bound. The ideal divider draws 0.671122 mA and dissipates approximately 0.4504 mW in each 1 kΩ resistor; this analytic branch is not an extra DRAM-current measurement.

**Time-domain behavior.** Reference tracking, ODT switching, refresh steps, rail anti-resonance and VREF return noise are missing. DC capacitor headroom below 6.3/16 V ratings does not establish bias capacitance or high-frequency effectiveness.

**Fields, return paths and EMC.** Keep VREFCA/VREFDQ return paths quiet in the actual filled-plane context. The separate reference sources cannot be merged simply because both nominally equal half the DDR supply.

**Losses and temperature.** The modeled shared rail delivers approximately 0.867 W, covering assumed memory/PHY loads. Individual DRAM heat and reference-buffer temperature remain unknown; divider resistor dissipation is the only narrow DC thermal input computed here. The selected industrial memory case-temperature limit is 95 °C; the refresh interval must be shortened above 85 °C, independently of whether the SoC is throttling.

**Missing models/evidence.** RK3566 VREFOUT output/load model, DRAM VREF input/leakage/noise limits under selected modes, capacitor DC-bias/ESL/ESR and per-device dynamic current/thermal models.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| VCC_DDR | 1.342245 | 1.342245 | 0.646266 | 1.337284 / run-0016 |

### Findings and conclusions

**DG16-01 · info.** Each DRAM has 18 VCC_DDR and 21 GND pins, with four explicit NC balls (J1/J9/L1/L9). U1 has 13 DDRPHY supply balls on VCC_DDR. This sheet supplies 48.5 µF nominal rail bypass; the complete board rail has 92.6 µF, represented as 64.82 µF in run-0027.

Action: Qualify the actual rail/capacitor model and load profile including both DRAMs, the SoC PHY and ODT/refresh activity.

Acceptance: The complete shared rail meets 1.283–1.417 V at both DRAM/SoC pin groups under startup, refresh, burst traffic and memory stress. The 1.417 V upper bound comes from the SoC and is tighter than the ISSI 1.45 V supply limit.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [references/soc-memory/memory-verification.json](../references/soc-memory/memory-verification.json); [hardware/16-ddr_power-01.kicad_sch](../hardware/16-ddr_power-01.kicad_sch).

**DG16-02 · high.** R402/R403 are 1 kΩ, 0.1%, giving unloaded VREFCA = VCC_DDR/2. C413+C428 = 200 nF yields 500 Ω Thevenin resistance and a nominal 100 µs time constant (70 µs under uniform 0.7 derating). At the stored 1.342245 V rail, ideal DC VREFCA is 0.671122 V; worst opposing resistor tolerances alone give a divider ratio of 0.4995–0.5005. Neither input leakage nor VREF noise is included.

Action: Add a loaded reference model including both DRAM inputs, capacitor tolerance/leakage and actual supply/reference return paths.

Acceptance: VREFCA tracks the specified fraction of VDD with noise and settling within the exact ISSI limits at both M8 pins during power ramp and all traffic modes.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [references/soc-memory/issi-ddr3l.txt](../references/soc-memory/issi-ddr3l.txt); [hardware/16-ddr_power-01.kicad_sch](../hardware/16-ddr_power-01.kicad_sch).

**DG16-03 · high.** DDR_VREFOUT drives both U4.H1 and U5.H1 as VREFDQ, with C414/C429 totaling 200 nF. It is not another ideal fixed 0.675 V rail in the saved solver. The source output impedance, startup, permitted capacitive load and programmed calibration must be established.

Action: Obtain the RK3566 VREFOUT characteristics and actual loader setting, then model or measure both VREFDQ loads and probe loading.

Acceptance: Both H1 pins satisfy the applicable VREFDQ level/noise/settling limits throughout initialization, training and data transfer without loading the source outside its specification.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [hardware/16-ddr_power-01.kicad_sch](../hardware/16-ddr_power-01.kicad_sch).

**DG16-04 · medium.** R1 = 120 Ω, 1% connects the SoC DDR_RZQ to GND; R400/R401 = 240 Ω, 1% independently connect U4/U5 ZQ to GND. These are calibration networks, not DC rail loads: VCC_DDR/RZQ is not their continuous current.

Action: Qualify precision resistor ordering codes over temperature and include actual ZQ calibration behavior in the DDR bring-up plan.

Acceptance: Calibration completes reliably and output/ODT impedance meets the configured requirements over operating corners; resistor currents/power come from the driven pin waveform.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [references/soc-memory/issi-ddr3l.txt](../references/soc-memory/issi-ddr3l.txt).

**DG16-05 · high.** The exact selected IS43TR16512BL-125KBLI ordering code is an industrial device with case-temperature range −40 to 95 °C. The retained ISSI specification requires 7.8 µs average refresh interval up to 85 °C and 3.9 µs above 85 °C within this grade. The saved 25 °C ambient parameter is not a DRAM case-temperature measurement and supplies no refresh-state verification.

Action: Qualify DRAM case temperatures and configure a supported refresh policy for the entire permitted case-temperature range, including the resulting extra refresh power.

Acceptance: Both devices remain within their case-temperature grade and receive the required refresh rate at every supported condition; retention/memory stress tests cover the warmest permitted case.

Evidence: [references/soc-memory/issi-ddr3l.txt](../references/soc-memory/issi-ddr3l.txt); [hardware/design-spec.json](../hardware/design-spec.json).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C17 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C18 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C19 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C20 | 4.7uF 6.3V X5R | 1.348831 | 0.002219 | 1.342245 | 0 | 0 | calculated |
| C21 | 22uF 6.3V X5R | 1.348831 | 0.010386 | 1.342245 | 0 | 0 | calculated |
| C22 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C23 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C24 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C25 | 4.7uF 6.3V X5R | 1.348831 | 0.002219 | 1.342245 | 0 | 0 | calculated |
| C26 | 4.7uF 6.3V X5R | 1.348831 | 0.002219 | 1.342245 | 0 | 0 | calculated |
| C400 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C401 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C402 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C403 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C404 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C405 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C406 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C407 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C408 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C409 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C410 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C411 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C412 | 4.7uF 6.3V X5R | 1.348831 | 0.002219 | 1.342245 | 0 | 0 | calculated |
| C413 | 100nF 16V X7R(Murata) 10% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C414 | 100nF 16V X7R(Murata) 10% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C415 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C416 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C417 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C418 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C419 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C420 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C421 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C422 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C423 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C424 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C425 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C426 | 100nF 16V X7R(Murata) 10% | 1.348831 | 4.721e-05 | 1.342245 | 0 | 0 | calculated |
| C427 | 4.7uF 6.3V X5R | 1.348831 | 0.002219 | 1.342245 | 0 | 0 | calculated |
| C428 | 100nF 16V X7R(Murata) 10% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C429 | 100nF 16V X7R(Murata) 10% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R1 | 120R 1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R400 | 240R 1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R401 | 240R 1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R402 | 1k 0.1% | 1.348831 | Unknown | 1.342245 | Unknown | Unknown | partial |
| R403 | 1k 0.1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |

## 17 — 24 MHz clock, reset and boot straps

The oscillator topology and reset/strap connections are explicit, but the crystal ordering code is still unqualified. A previously hidden analog limitation is the total 200 nF reset load across sheets 07 and 17; the current digital reset trace does not model it.

Native source: [hardware/17-soc_clock-01.kicad_sch](../hardware/17-soc_clock-01.kicad_sch). Involved references: **C80, C81, C82, R2, R3, R5, R6, U1, Y1**. Primary inventory owners: 8; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** The simulator does not solve crystal startup, oscillator amplitude or PLL lock. The reset candidate has 19.15 ms between its modeled final stable rail and digital release, but this must be reconciled with the analog reset network and real clock availability.

**Steady operation.** Oscillator node voltages, crystal current and R2/R3 AC dissipation are unknown. It would be incorrect to display the 1.8 V rail value as the XIN/XOUT waveform or infer crystal current from 24 MHz alone.

**Time-domain behavior.** R238 directly links the low-asserting TSADC shutdown signal to the reset network through 0 Ω. Pin mode, open-drain compatibility and rail-collapse behavior must be verified together with the RC release, not as independent ideal digital events.

**Fields, return paths and EMC.** The all-F.Cu crystal route avoids signal vias, but the 8.441 mm XIN connection remains a coupling-sensitive analog path. Its actual loop, shield/return and aggressors must be considered before any EMI conclusion.

**Losses and temperature.** Crystal overdrive and oscillator startup depend on the exact part and temperature. No crystal temperature or dissipation is available; the separate L219 thermal model has no relevance here.

**Missing models/evidence.** Qualified Y1 motional equivalent circuit/ESR/load/drive specification; RK3566 oscillator model; reset sink/leakage/threshold/rise-time characteristics and actual startup clock/PLL timing.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| VCC3V3_PMU | 3.2991 | 3.2991 | 0.029992 | 3.29852 / run-0016 |

### Findings and conclusions

**DG17-01 · high.** Y1 is only specified as 24 MHz, 12 pF. C80 and C81 are 18 pF C0G, giving an ideal series load of 9 pF before pin/PCB stray capacitance; reaching a 12 pF load would require approximately 3 pF additional effective stray. R2 = 22 Ω and R3 = 1 MΩ are present. No exact crystal ESR, drive-level or startup model is available.

Action: Select the exact crystal and validate loading, negative-resistance/startup margin and drive level; retain the manufacturer-required 22 Ω/1 MΩ topology while choosing capacitors from the qualified load.

Acceptance: Oscillation starts over voltage/temperature/aging corners, meets frequency accuracy and crystal drive rating, and provides the clock required before reset release. The 18 pF values are supported by actual load extraction or measurement.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [hardware/17-soc_clock-01.kicad_sch](../hardware/17-soc_clock-01.kicad_sch).

**DG17-02 · medium.** Fresh native paths give U1.AD37→Y1.3 = 8.441 mm and U1.AD37→C81.1 = 10.106 mm, all F.Cu with no vias. U1.AD38→R2.1 is 2.308 mm. The XIN path is not geometrically symmetric with XOUT and its load cannot be represented by the two capacitor labels alone.

Action: Review a shorter, quieter oscillator placement/return arrangement using measured or extracted parasitic capacitance; do not assume trace equality itself is a crystal requirement.

Acceptance: The revised or retained layout passes oscillator startup, frequency/drive and coupled-noise checks and preserves both crystal ground connections.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/rk3566-sbc.kicad_pcb](../hardware/rk3566-sbc.kicad_pcb).

**DG17-03 · high.** RESETn has R221 = 10 kΩ to VCC3V3_PMU and both C240 and C82 = 100 nF populated, for a 2.0 ms ideal pull-up time constant and approximately 4.394 ms 10–90% rise (1.4/3.076 ms with uniform 0.7 capacitance factor). U2.67→U1.AG38 is 54.074 mm in the native 3D path graph. The saved RESETn waveform changes digitally at 40 ms and includes none of this analog release behavior.

Action: Model the actual wired reset network with PMIC/SoC sink, leakage and thresholds, and verify its release and watchdog/thermal assertion at U1. Preserve both local reset capacitors pending explicit source-backed review.

Acceptance: VIL/VIH, permitted rise time, minimum assertion and continuous power-good hold are met at all reset receivers across corners; no conflicting active-high driver or slow threshold chatter exists.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/07-pmic_control-01.kicad_sch](../hardware/07-pmic_control-01.kicad_sch); [hardware/17-soc_clock-01.kicad_sch](../hardware/17-soc_clock-01.kicad_sch); [simulation/engine.py](../simulation/engine.py).

**DG17-04 · info.** R5 pulls SDMMC0_DET_L high through 10 kΩ to PMU 3.3 V, selecting the documented JTAG/UART mux state rather than SD-card-present mode. R6 bonds DFT_TEST_GND to GND. These strap connections are present, but their actual sampled levels are not simulated.

Action: Preserve the intended strap states and include reset-sampling and recovery behavior in bring-up verification.

Acceptance: The straps reach documented input levels before sampling and remain valid during reset; debug capability matches the actually routed pins.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C80 | 18pF C0G | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C81 | 18pF C0G | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C82 | 100nF 16V X7R(Murata) 10% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R2 | 22R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R3 | 1M | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R5 | 10k | 3.299865 | Unknown | 3.2991 | Unknown | Unknown | partial |
| R6 | 0R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| Y1 | 24MHz 12pF | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |

## 18 — Removable 8 / 16 GB eMMC module

The 34-pin signal connector pinout and 30-pin mechanical support match the retained Radxa module definition, and all measured host signals are connected. The exact module silicon, operating mode and connector/module channel remain unqualified.

Native source: [hardware/18-emmc-01.kicad_sch](../hardware/18-emmc-01.kicad_sch). Involved references: **C431, C432, C433, C434, J1, J2, R4, R14, R20, R21, R22, R23, R24, R25, R26, R27, R28, R29, U1**. Primary inventory owners: 18; DNP among owners: 8. Shared members are not extra physical parts.

**Startup and boot.** The module has two separate supplies and no dedicated reset contact in this connector map. C431/C432 give 10.1 µF local nominal 3.3 V bypass; C433/C434 give 4.8 µF on 1.8 V. Inrush and card-internal sequencing cannot be inferred from those host capacitors alone.

**Steady operation.** Run-0027 host rail values are 3.265843 V and 1.798561 V. The shared rail currents include other SoC consumers and are not eMMC current. If CMD or D0 is held low, its populated 10 kΩ pull draws about 0.180 mA and dissipates 0.3235 mW at the stored 1.8 V rail; high-state leakage is not that value.

**Time-domain behavior.** Boot negotiation, high-speed mode changes, strobe operation, erase/program current peaks, sleep and power-fail data integrity are not simulated. The intended removable module swap remains a power-off operation.

**Fields, return paths and EMC.** The off-board connector/module changes the return and common-mode path. The board-only U7 magnetic field example cannot predict eMMC cable/module radiation or high-speed channel quality.

**Losses and temperature.** Module silicon and package are not identified by capacity alone. No 8/16 GB module temperature or R14 waveform loss has been calculated; the local L219 thermal illustration must not color J1/J2 as storage temperature.

**Missing models/evidence.** Exact 8/16 GB module silicon/firmware/temperature grades and power/timing limits; connector S-parameters or equivalent circuit, module/package trace delays, host/device IO models and firmware mode sequence.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| VCC3V3_PMU | 3.2991 | 3.2991 | 0.029992 | 3.29852 / run-0016 |
| VCC_1V8 | 1.798561 | 1.798561 | 0.119904 | 1.797633 / run-0016 |
| VCC_3V3 | 3.265843 | 3.265843 | 2.1 | 3.243706 / run-0016 |

### Findings and conclusions

**DG18-01 · info.** J1 supplies 1.8 V on pins 12/20/21 and 3.3 V on 22/23, with eight data, CMD, CLK and strobe signals. J2 has 30 explicit no-connect electrical pads because it is the module support connector. R20/R21 provide populated 10 kΩ CMD/D0 pull-ups; R22–R28 and R29 are DNP reservations, consistent with the documented host topology.

Action: Qualify the exact 8 GB and 16 GB module ordering codes and preserve the connector/keying and populated/DNP intent.

Acceptance: Both modules mate correctly, enumerate, boot and pass read/write/power-cycle tests; support contacts remain intentionally unwired and neither module requires a missing host signal.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [references/soc-memory/radxa-emmc-brief-rev1.1.txt](../references/soc-memory/radxa-emmc-brief-rev1.1.txt); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [references/soc-memory/radxa-emmc-pinmap.json](../references/soc-memory/radxa-emmc-pinmap.json); [hardware/18-emmc-01.kicad_sch](../hardware/18-emmc-01.kicad_sch).

**DG18-02 · high.** R4 pulls FLASH_VOL_SEL high to PMU 3.3 V, matching the 1.8 V VCCIO2/eMMC IO domain. Run-0027 reaches 95% on 1.8 V at 9.135 ms but the module 3.3 V rail at 18.975 ms, a 9.840 ms separation. This is not inherently a power-order violation, but the model contains no CMD timing or partial-power IO-clamp behavior.

Action: Verify the high strap during reset and enforce command/startup behavior only after both module rails are stable; model the exact module during partial power and power-off replacement.

Acceptance: The chosen module and host meet their powered/off IO limits and both-rail startup requirements; command activity and wake-up never precede stable supplies.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/design-spec.json](../hardware/design-spec.json); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt); [hardware/18-emmc-01.kicad_sch](../hardware/18-emmc-01.kicad_sch).

**DG18-03 · high.** Fresh native 3D host paths span 14.263–21.704 mm for D0–D7 (7.441 mm spread), 33.448 mm for CMD and 25.697 mm for strobe. The two copper sections of CLK total 17.753 mm before/after R14, excluding the resistor body span. Signal paths use differing F/B/In2/In5 allocations and one or two traversed via objects. These host-only lengths omit SoC package, connector and module traces.

Action: Extract the complete host/connector/module channel for the selected transfer mode, including package delays, clock series resistor, pulls and real module load.

Acceptance: Read/write timing and signal-quality requirements pass for each qualified module and allowed bus speed; no arbitrary length-equality target replaces actual timing.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [hardware/rk3566-sbc.kicad_pcb](../hardware/rk3566-sbc.kicad_pcb).

**DG18-04 · medium.** R14 is the exact 22 Ω Yageo RC0201FR-0722RL clock series resistor, 50 mW at 70 °C per retained part qualification. The earlier 23.53 mW C·V²·f example assumes 30 pF, 1.98 V and 200 MHz and is not its measured dissipation. TP62/TP63 have 0.2245 mm extra existing-metal path from the main clock/D0 channel to the probe endpoint in the graph; pad/probe capacitance remains additional.

Action: Include resistor loss/temperature derating and test-pad/probe loading in the full channel; demonstrate recovery with the available D0/CLK probes.

Acceptance: R14 remains within power/voltage/temperature ratings at the actual edge/load conditions and probes do not invalidate timing; corrupt-media Maskrom recovery is demonstrated.

Evidence: [simulation/section-review/digital-evidence.json](../simulation/section-review/digital-evidence.json); [research/r14-emmc-clock-0201.md](../research/r14-emmc-clock-0201.md); [hardware/design-spec.json](../hardware/design-spec.json).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C431 | 10uF 6.3V X5R | 3.294843 | 0.6358 | 3.265843 | 0 | 0 | calculated |
| C432 | 100nF 16V X7R(Murata) 10% | 3.294843 | 0.006358 | 3.265843 | 0 | 0 | calculated |
| C433 | 4.7uF 6.3V X5R | 1.799784 | 0.002961 | 1.798561 | 0 | 0 | calculated |
| C434 | 100nF 16V X7R(Murata) 10% | 1.799784 | 6.299e-05 | 1.798561 | 0 | 0 | calculated |
| J1 | GB042-34P-H10 eMMC SIGNAL | Unknown | Unknown | Unknown | Unknown | Unknown | partial |
| J2 | GB042-30P-H10 eMMC SUPPORT | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R4 | 10k | 3.299865 | Unknown | 3.2991 | Unknown | Unknown | partial |
| R14 | 22R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R20 | 10k | 1.799784 | Unknown | 1.798561 | Unknown | Unknown | partial |
| R21 | 10k | 1.799784 | Unknown | 1.798561 | Unknown | Unknown | partial |
| R22 | 10k · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| R23 | 10k · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| R24 | 10k · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| R25 | 10k · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| R26 | 10k · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| R27 | 10k · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| R28 | 10k · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| R29 | 100k DNP · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |

## 19 — SDIO Wi-Fi, Bluetooth, clocks and antenna

U6 is an AW-CM256SM module fed through FB202 from the 3.3 V preregulator, with 1.8 V VCCIO_WL, an external 37.4 MHz crystal, and a U.FL antenna feed. Connectivity and the intended voltage domains are explicit; RF performance, internal regulator behavior and module startup remain unvalidated.

Native source: [hardware/19-wifi-01.kicad_sch](../hardware/19-wifi-01.kicad_sch). Involved references: **C256, C257, C261, C262, C263, C264, C265, C266, C267, FB202, J201, L207, R219, R234, R235, R236, R237, R241, R242, U1, U6, Y202**. Primary inventory owners: 21; DNP among owners: 3. Shared members are not extra physical parts.

**Startup and boot.** R235 pulls WL_REG_ON toward VCCIO_WL; BT_REG_ON is independently driven. The module has its own POR and enable timing. The 160 ms board run does not execute SDIO commands, establish internal VDDC availability, or verify a repeated WL/BT power cycle. Firmware must implement the module timing independently of RK3566 reset release.

**Steady operation.** Run 27 predicts WIFI_VBAT 3.271961 V at 0.198300 A aggregate assumed load, leaving about 72 mV above the 3.2 V module minimum. This is a rail-budget calculation; U6 current, L207 ripple, RF output power and oscillator amplitude remain Unknown. VCCIO_WL is modeled at 1.798831 V.

**Time-domain behavior.** The narrow VBAT headroom is vulnerable to source tolerance, FB202/trace drop and transmit bursts. C256 is 22 µF nominal; effective capacitance at DC bias and the burst waveform are absent. A nominal 200 mA rail load does not prove the module peak current budget.

**Fields, return paths and EMC.** C264 is the 10 pF series RF element and C265/C266 are DNP shunt tuning positions. No VNA result, approved stack impedance or final antenna/cable loss is present. R237 provides 22 Ω SDIO clock damping; geometry and resistor presence do not prove SDIO timing or emitted RF compliance.

**Losses and temperature.** No U6 power map, shield-to-board thermal model or enclosure temperature result exists. RF duty cycle and L207/ferrite loss must be supplied before a temperature can be assigned. The app thermal study of L219 does not apply to this module.

**Missing models/evidence.** AzureWave internal buck/control and TX/RX activity models; crystal negative-resistance/ESR/drive budget; antenna/cable S-parameters; extracted SDIO/UART channels; package thermal path.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| VCCIO_WL | 1.798831 | 1.798831 | 0.011992 | 1.798077 / run-0016 |
| VCC_3V3_SBC | 3.281876 | 3.281876 | 6 | 3.269912 / run-0016 |
| WIFI_VBAT | 3.271961 | 3.271961 | 0.865263 | 3.253686 / run-0016 |

### Findings and conclusions

**s19-vbat-margin · high.** Only 0.1 V nominal separates a 3.3 V source from the module 3.2 V minimum before series losses. The saved 72 mV residual margin is conditional on the chosen load and resistance, so nominal pass is not a TX qualification.

Action: Obtain the module burst-current envelope and effective C256 curve; evaluate the source/ferrite/trace path at the module pad 9. Change the Wi-Fi supply architecture or filtering only if the qualified envelope requires it.

Acceptance: Measured pad 9 voltage remains within the module operating range for cold start, TX bursts, minimum input and all declared temperatures; source margin and ripple are recorded.

Evidence: [hardware/19-wifi-01.kicad_sch](../hardware/19-wifi-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [simulation/data/runs/run-0027.json](../simulation/data/runs/run-0027.json); [references/power-wifi/aw-cm256sm-v1.9.txt](../references/power-wifi/aw-cm256sm-v1.9.txt).

**s19-module-sequence · high.** The module requires at least 150 ms after internal VDDC and VDDIO are available before SDIO access, plus a 10 ms minimum off interval for a full WL/BT regulator cycle. R235 pulls WL_REG_ON high, but the board model does not track internal VDDC or software traffic.

Action: Define a module power-sequence state machine and confirm bootloader/Linux GPIO ownership. Add controllable default-off hardware only if boot policy requires it.

Acceptance: Logic-analyzer and rail captures show the required guard times, independent WL/BT resets and successful enumeration across repeated cold/warm cycles.

Evidence: [hardware/19-wifi-01.kicad_sch](../hardware/19-wifi-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [references/power-wifi/aw-cm256sm-v1.9.txt](../references/power-wifi/aw-cm256sm-v1.9.txt).

**s19-crystal-load · warning.** Y202 is specified 37.4 MHz/12 pF; C262 and C263 are each 8 pF. Their simple series equivalent is 4 pF before pin/PCB parasitics, so these values do not establish a 12 pF operating load. R234 adds 100 Ω in the drive leg.

Action: Retain these as tuning placeholders until the actual crystal and module oscillator requirements are reconciled; characterize startup, frequency error and drive with a suitable low-loading method.

Acceptance: Final crystal MPN/ESR/drive/load are approved and frequency/startup margin pass temperature, tolerance and supply corners.

Evidence: [hardware/19-wifi-01.kicad_sch](../hardware/19-wifi-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [references/power-wifi/aw-cm256sm-v1.9.txt](../references/power-wifi/aw-cm256sm-v1.9.txt).

**s19-control-direction · warning.** U6.6 is BT_WAKE input and U6.7 is BT_HOSTWAKE output; the inherited net names suggest the opposite direction. R241/R242 correctly weakly pull unused bidirectional PCM clock/sync low instead of shorting possible outputs.

Action: Document or safely rename wake directions and assert GPIO2_C0 as host output/GPIO2_C1 as host input. Preserve the weak PCM pulls and explicit unconnected outputs.

Acceptance: Pinmux review and sleep/wake captures match the manufacturer pin directions; no opposing output drivers occur.

Evidence: [hardware/19-wifi-01.kicad_sch](../hardware/19-wifi-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [references/power-wifi/aw-cm256sm-v1.9.txt](../references/power-wifi/aw-cm256sm-v1.9.txt).

**s19-rf-dfm · warning.** The host land pattern and three underside non-host contacts are documented engineering geometry. The 10 pF feed, DNP match pads and U.FL placement are not a tuned 50 Ω antenna network.

Action: Obtain vendor land/stencil approval and the exact antenna/cable, then extract and tune the RF feed. Preserve DNP status until measured tuning supports population.

Acceptance: Supplier approves module assembly geometry; VNA/antenna and coexistence tests meet a declared target on the final enclosure.

Evidence: [hardware/19-wifi-01.kicad_sch](../hardware/19-wifi-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [references/power-wifi/aw-cm256sm-v1.9.txt](../references/power-wifi/aw-cm256sm-v1.9.txt).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C256 | 22uF 6.3V X5R | 3.297995 | 0.859431 | 3.271961 | 0 | 0 | calculated |
| C257 | 100nF 16V X7R(Murata) 10% | 3.297995 | 0.003907 | 3.271961 | 0 | 0 | calculated |
| C261 | 4.7uF 6.3V X5R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C262 | 8pF C0G 50V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C263 | 8pF C0G 50V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C264 | 10pF C0G | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C265 | DNP · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| C266 | DNP · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| C267 | DNP · DNP | Unknown | 0 | Unknown | 0 | Unknown | excluded |
| FB202 | 120R@100MHz | Unknown | Unknown | Unknown | Unknown | Unknown | partial |
| J201 | WIFI ANT 50R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| L207 | 2.2uH | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R219 | 22R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R234 | 100R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R235 | 10k | 1.799825 | Unknown | 1.798831 | Unknown | Unknown | partial |
| R236 | 22R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R237 | 22R | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R241 | 100k 1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R242 | 100k 1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| U6 | AW-CM256SM | Unknown | Unknown | Unknown | Unknown | Unknown | partial |
| Y202 | 37.4MHz 12pF | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |

## 20 — MCU harness, console and SPI display

J121 mixes a sequenced 3.3 V output, five externally generated power rails and logic interfaces; J103 supplies an external display. U100 protects the MCU-to-SoC UART path when its supply is off, while the remaining direct connections rely on a coordinated power policy.

Native source: [hardware/20-display_mcu-01.kicad_sch](../hardware/20-display_mcu-01.kicad_sch). Involved references: **C103, C104, C105, J103, J121, R50, R100, R101, U1, U100**. Primary inventory owners: 9; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** J121.6 exports VCC_3V3 to enable the MCU-side peripheral converter; pins 12/13, 15, and 17–19 return its regulated rails. The current model instead assumes those inputs rise at t=0. U100./OE is hard grounded, so its Ioff property is not a full enabled-state sequencing controller.

**Steady operation.** J103.1 uses 3V3_PER, while SPI/GPIO signals originate in RK3566 VCCIO6 powered from VCC_3V3. PMUIO2 on VCC3V3_PMU supplies UART2. The run predicts these rails near 3.29 V/3.27 V but gives no display, MCU or harness contact current. LCD_BL is a command pin, not a backlight power driver.

**Time-domain behavior.** Independent removal of MCU power, a broken J121 enable wire, or early SoC drive can leave one endpoint unpowered. U100 handles only MCU_TX→RADXA_RX. MCU_RX, SOC_HALT and audio-monitor outputs have no corresponding active isolation stage in this sheet.

**Fields, return paths and EMC.** The display MOSI/CLK paths include 33 Ω series parts R100/R101; CS/DC/RST/BL are direct. Their adequacy depends on driver edge rate, cable length and remote input load. No connector ESD network or cable common-mode model is present on J103/J121.

**Losses and temperature.** No display backlight, remote MCU, connector contact or harness-wire heat model is available. The rails on J121 must have source/current ownership and wire/contact limits; their assumed simulation ceilings are not connector ratings.

**Missing models/evidence.** Remote MCU regulator/enable schematic and firmware; connector/harness resistance and inductance; display MPN/current/backlight-driver model; IO power-off leakage and IBIS channels.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| 1V8_AUDIO | 1.79925 | 1.79925 | 0.014994 | 1.798767 / run-0016 |
| 3V3_PER | 3.291772 | 3.291772 | 0.164552 | 3.286484 / run-0016 |
| CAM_1V5 | 1.497504 | 1.497504 | 0.049917 | 1.495897 / run-0016 |
| CAM_1V8 | 1.799001 | 1.799001 | 0.019989 | 1.798356 / run-0016 |
| CAM_2V8 | 2.797004 | 2.797004 | 0.059922 | 2.795074 / run-0016 |
| VCC_3V3 | 3.265843 | 3.265843 | 2.1 | 3.243706 / run-0016 |

### Findings and conclusions

**s20-rail-ownership · high.** Five rails are inputs from the MCU board, while J121.6 VCC_3V3 is a sequenced output. Assuming all external rails present at t=0 bypasses the intended inter-board enable handshake and cannot validate it.

Action: Freeze an inter-board power contract including startup delays, shutdown order, discharge, connector current allocation and absent-board behavior. Extend the future model with that boundary before considering local replacements.

Acceptance: The combined MCU/SBC schematic and timing captures demonstrate sole ownership of each rail and no unintended regulator paralleling or back-powered rail.

Evidence: [hardware/20-display_mcu-01.kicad_sch](../hardware/20-display_mcu-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [research/carrier-interfaces.md](../research/carrier-interfaces.md); [simulation/data/runs/run-0027.json](../simulation/data/runs/run-0027.json).

**s20-io-off-state · high.** U100 has Ioff protection and 3.3 V power but its/OE is permanently low. The separate MCU_RX, SOC_HALT and monitor links are direct/resistive connections; their receivers and power-off behavior are outside the board model.

Action: Evaluate every powered/unpowered endpoint combination. Define safe pin states and OE policy, and add appropriate isolation where those tests or device limits require it.

Acceptance: Neither endpoint rail is raised outside its approved off-state budget; pin injection and transition levels stay inside both-device limits for startup, shutdown and cable sequencing.

Evidence: [hardware/20-display_mcu-01.kicad_sch](../hardware/20-display_mcu-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [research/carrier-interfaces.md](../research/carrier-interfaces.md); [references/sn74lvc1g125-revu.txt](../references/sn74lvc1g125-revu.txt).

**s20-console-contention · warning.** R50 is a populated 0 Ω link between U100 output and the UART2 receive node TP30. An external console transmitter would contend with the MCU transmitter unless this link is opened. TP31 observes SoC TX on MCU_RX.

Action: Make the external-console procedure and population option explicit; isolate R50 before attaching an external transmitter. Preserve unambiguous SoC RX/TX direction labels.

Acceptance: With R50 open only the external adapter drives SoC RX; with it closed only the MCU drives that node, and both states are covered by the debug procedure.

Evidence: [hardware/20-display_mcu-01.kicad_sch](../hardware/20-display_mcu-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [docs/connectors-and-testpoints.md](../docs/connectors-and-testpoints.md); [research/carrier-interfaces.md](../research/carrier-interfaces.md).

**s20-display-contract · warning.** J103 has one 3.3 V supply and no local backlight current driver. GPIO4_B0 serves LCD_RST, so enabling the full SPI3 pin group including MISO would conflict with the reset function. R100/R101 damp only MOSI and CLK.

Action: Specify the display MPN with onboard backlight driver, maximum load and harness. Restrict pinmux to the needed transmit-only SPI group and qualify edge/ESD behavior before adding damping/protection.

Acceptance: The chosen display operates with its specified logic and power budget; reset/PWM function during boot and signal integrity pass at the declared cable length and clock rate.

Evidence: [hardware/20-display_mcu-01.kicad_sch](../hardware/20-display_mcu-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [research/carrier-interfaces.md](../research/carrier-interfaces.md); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C103 | 4.7u 10V | 3.298763 | 0.005433 | 3.291772 | 0 | 0 | calculated |
| C104 | 100nF 16V X7R(Murata) 10% | 3.298763 | 0.0001156 | 3.291772 | 0 | 0 | calculated |
| C105 | 100nF 16V X7R(Murata) 10% | 3.294843 | 0.006358 | 3.265843 | 0 | 0 | calculated |
| J103 | SPI DISPLAY | 3.298763 | Unknown | 3.291772 | Unknown | Unknown | partial |
| J121 | MCU SIGNAL / LOW POWER | Unknown | Unknown | Unknown | Unknown | Unknown | partial |
| R50 | 0R REMOVE FOR EXT CONSOLE | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R100 | 33 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R101 | 33 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| U100 | SN74LVC1G125DPWR | 3.294843 | Unknown | 3.265843 | Unknown | Unknown | partial |

## 21 — VL53L5CX ToF and shared I²C bus

U110 AVDD and IOVDD share 3V3_PER; the reserved pins, 47 kΩ control bias and 4.7 µF/100 nF bypass follow a recognizable sensor application. Shared I²C loading, power-off recovery and active-ranging supply demand are not validated by the generic rail model.

Native source: [hardware/21-tof-01.kicad_sch](../hardware/21-tof-01.kicad_sch). Involved references: **C110, C111, R110, R111, R112, R113, R114, R115, U1, U110**. Primary inventory owners: 9; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** Sharing AVDD/IOVDD avoids a separate rail-order mismatch at the sensor when 3V3_PER is well behaved. R113 holds LPn high with no host connection. U1 can drive I2C_RST through the named net, but that resets the communications interface, not an independently switched sensor supply.

**Steady operation.** R110/R111 draw 1.5 mA each at an ideal 3.3 V low-held bus, or 3 mA for both lines. Sensor current is not represented as an individual waveform. ST lists active-ranging combined currents of 95 mA typical and 130 mA maximum, already comparable to the entire 130 mA non-codec 3V3_PER budget.

**Time-domain behavior.** The datasheet permits an additional 10 mA peak on each sensor supply; common-rail demand can therefore exceed the average budget before display/oscillator loads. Effective bypass, cable inductance and reset recovery after a brownout need a dedicated test.

**Fields, return paths and EMC.** SOC_SDA/SCL join the codec and PCA9306 camera translator. At 2.2 kΩ, the simple RC300 ns rise-time budget corresponds to about 161 pF; total bus capacitance and translator loading are not extracted. The ToF optical opening/cover and adjacent switching noise have no system test.

**Losses and temperature.** Continuous ranging at the documented 3.3 V configuration is approximately 313 mW typical, not a measured junction temperature. The native board places U110 at (50.0, 11.2) mm on the front, but enclosure conduction and cover-glass/optical-temperature effects are absent.

**Missing models/evidence.** ST mode-specific activity/reset behavior; sensor/cover optical model; total bus capacitance and endpoint leakage; MCU peripheral-source transient response; sensor package thermal network.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| 3V3_PER | 3.291772 | 3.291772 | 0.164552 | 3.286484 / run-0016 |

### Findings and conclusions

**s21-current-budget · high.** The shared 3V3_PER non-codec model allowance is 130 mA. U110 alone has a 130 mA combined active-ranging maximum in the current ST table, plus potential peak uplift; the display and oscillator also use this rail. The modeled rail pass does not establish its load budget.

Action: Build a disjoint per-load budget using the selected ranging mode and all external loads, then rerun rail/cable transients. Keep datasheet limits separate from actual measured current.

Acceptance: The upstream regulator and connector budget cover simultaneous peak loads, and sensor-pad voltage stays within the approved range under the declared ranging/display modes.

Evidence: [hardware/21-tof-01.kicad_sch](../hardware/21-tof-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [simulation/engine.py](../simulation/engine.py).

**s21-voltage-window · high.** The rail model accepts 3V3_PER up to 3.63 V using a generic ±10% band, whereas the sensor 3.3 V operating configuration ends at 3.6 V. A green shared-rail status can therefore hide a sensor-specific overvoltage limit.

Action: Give the future component stress checker the sensor-specific 3.0–3.6 V operating window and the external regulator tolerance/transient envelope; do not alter the PCB solely from nominal voltage.

Acceptance: All evaluated corners use component-specific limits and the actual source tolerance; no peak at U110 exceeds its permitted voltage.

Evidence: [hardware/21-tof-01.kicad_sch](../hardware/21-tof-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [simulation/engine.py](../simulation/engine.py).

**s21-recovery-control · warning.** LPn is only pulled high by R113; I2C_RST is host-controlled and R115 defaults it low. Thus this board cannot independently drive LPn low for comms isolation, and a whole-sensor power cycle would also affect other 3V3_PER loads.

Action: Define the driver recovery sequence and determine whether interface reset alone covers expected faults. If independent recovery is required, allocate host LPn control or an appropriately sequenced sensor load switch.

Acceptance: Forced I²C-stuck and sensor-brownout faults recover with the documented procedure without destabilizing codec/camera traffic.

Evidence: [hardware/21-tof-01.kicad_sch](../hardware/21-tof-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml).

**s21-i2c-rise-off-state · warning.** The 2.2 kΩ pull-ups to 3.3 V feed U1, U110, U130 and the camera translator. Their low-state current is calculable; rise time and injection into an unpowered VCCIO6 are not. The historic SDA routing audit explicitly did not qualify bus capacitance.

Action: Measure/extract the complete bus, begin with a supported conservative bus rate, and qualify power-off leakage. Select revised pull-ups/isolation only from rise-time and sink-current margins.

Acceptance: At the chosen bus rate, all endpoints satisfy rise time, VOL, setup/hold and power-off injection limits, including the active camera branch.

Evidence: [hardware/21-tof-01.kicad_sch](../hardware/21-tof-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [peripheral-revision/host-i2c/sda-complete/README.md](../peripheral-revision/host-i2c/sda-complete/README.md).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C110 | 4.7u 10V | 3.298763 | 0.005433 | 3.291772 | 0 | 0 | calculated |
| C111 | 100nF 16V X7R(Murata) 10% | 3.298763 | 0.0001156 | 3.291772 | 0 | 0 | calculated |
| R110 | 2.2k | 3.298763 | Unknown | 3.291772 | Unknown | Unknown | partial |
| R111 | 2.2k | 3.298763 | Unknown | 3.291772 | Unknown | Unknown | partial |
| R112 | 47k | 3.298763 | Unknown | 3.291772 | Unknown | Unknown | partial |
| R113 | 47k | 3.298763 | Unknown | 3.291772 | Unknown | Unknown | partial |
| R114 | 47k | 3.298763 | Unknown | 3.291772 | Unknown | Unknown | partial |
| R115 | 47k | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| U110 | VL53L5CXV0GC/1 | 3.298763 | Unknown | 3.291772 | Unknown | Unknown | partial |

## 22 — Two-lane camera, SCCB translation and 25 MHz clock

J110 implements the KLT-H7MA-OV5647 V1.0 pinout, including separate 1.5 V/1.8 V/2.8 V and filtered autofocus power. Level translation and default control bias are present, but sensor power sequencing, the autofocus budget and the complete CSI channel are not qualified.

Native source: [hardware/22-camera-01.kicad_sch](../hardware/22-camera-01.kicad_sch). Involved references: **C120, C121, C122, C123, C124, C125, C126, C127, FB120, J110, R120, R121, R122, R123, R124, R125, U1, U120, U121, U122, U123, Y120**. Primary inventory owners: 21; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** U121/U122 translate PWDN/reset to CAM_1V8; R123 pulls the 3.3 V PWDN input high and R124 pulls reset low. U123 translates the always-enabled 25 MHz oscillator. All buffer/OE pins are grounded. These states depend on external CAM rails and SoC bank timing; a common modeled t=0 rise does not implement the module startup sequence.

**Steady operation.** Run 27 predicts 1.497504 V/1.799001 V/2.797004 V on camera core/IO/analog and 2.795008 V on AF with an assumed 20 mA AF load. Those values use declared rail loads; sensor and actuator pin currents remain Unknown. The OV5647 brief calls for a tighter 1.5 V±5% core window than the model’s ±10%.

**Time-domain behavior.** U120 EN and VREF2 share a 200 kΩ bias from 3V3_PER. When CAM_1V8 is off or cannot sink bias, this arrangement can charge its low-side rail. Autofocus current steps and long harness paths are absent from the model; the module’s documented DW9714 has a 120 mA sink capability, not a guaranteed 20 mA load.

**Fields, return paths and EMC.** Native CSI pair mismatches are small, but final geometry retains 4.46–5.99 mm of uncoupled copper per leg. Package/flex/connector models, edge/LP-HS transitions and an approved impedance stack are absent. The geometry audit is not an eye diagram or a supported camera bitrate.

**Losses and temperature.** No sensor/VCM thermal solution exists. Power in FB120, the sensor core and actuator varies with operating mode and focus command. Board ambient alone does not establish optical image quality or sensor junction temperature.

**Missing models/evidence.** Exact purchased module/flex and register sequence; sensor/VCM current waveforms; CAM regulator discharge/sinking behavior; PCA9306 off-state network; full CSI channel and receiver/transmitter models.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| 3V3_PER | 3.291772 | 3.291772 | 0.164552 | 3.286484 / run-0016 |
| CAM_1V5 | 1.497504 | 1.497504 | 0.049917 | 1.495897 / run-0016 |
| CAM_1V8 | 1.799001 | 1.799001 | 0.019989 | 1.798356 / run-0016 |
| CAM_2V8 | 2.797004 | 2.797004 | 0.059922 | 2.795074 / run-0016 |
| CAM_AF_2V8 | 2.795008 | 2.795008 | 0.019964 | 2.791792 / run-0016 |
| VCC_3V3 | 3.265843 | 3.265843 | 2.1 | 3.243706 / run-0016 |

### Findings and conclusions

**s22-specific-module · warning.** The 24-pin connector is for one named KLT module, with pins 5–11 NC and two data lanes. It is not electrically interchangeable with a generic Pi camera flex. The vendor packet identifies the mating connector family and contains a not-recommended-for-new-design notice.

Action: Confirm the exact module and mating connector stock, orientation and optical/flex envelope before freezing a new PCB revision. Treat an alternate camera as an interface redesign.

Acceptance: Purchased module revision and mating parts match the approved pin table and mechanical sample; no pinout substitution is inferred from connector count.

Evidence: [hardware/22-camera-01.kicad_sch](../hardware/22-camera-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [research/carrier-interfaces.md](../research/carrier-interfaces.md); [docs/connectors-and-testpoints.md](../docs/connectors-and-testpoints.md).

**s22-translator-backbias · high.** U120 EN/VREF2 are permanently biased from 3V3_PER through R120 = 200 kΩ, with VREF1 on CAM_1V8. TI explicitly documents low-side rail rise when an LDO cannot sink this bias. This board has no host EN-off control or deliberate VREF1 bleed.

Action: Analyze the actual MCU-side CAM_1V8 regulator and all off-state loads. Provide an EN disable or manufacturer-sized bleed/isolation arrangement if the rail can float; do not choose a bleed from typical bias alone.

Acceptance: Across camera-off/peripherals-on and all ramp orders, CAM_1V8 and camera pins stay inside approved off-state/operating limits and the common I²C bus remains usable.

Evidence: [hardware/22-camera-01.kicad_sch](../hardware/22-camera-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [references/pca9306-revo.pdf](../references/pca9306-revo.pdf).

**s22-buffer-sequence · high.** PWDN/reset/MCLK outputs follow 1.8 V buffers with/OE hard low. Ioff supports power-off behavior but does not impose a camera-ready clock/reset sequence while the rail is ramping; Y120 is enabled whenever 3V3_PER exists.

Action: Define and capture sensor rail/reset/PWDN/clock ordering. If a quiet clock or guaranteed tri-state during ramps is required, add a controlled output enable or qualified oscillator-enable path.

Acceptance: At J110 the actual 25 MHz clock, level, rise/fall/duty and reset/PWDN timing satisfy the purchased module limits for every startup and shutdown order.

Evidence: [hardware/22-camera-01.kicad_sch](../hardware/22-camera-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [references/sn74lvc1g125-revu.txt](../references/sn74lvc1g125-revu.txt).

**s22-rail-af-envelope · high.** CAM_1V5 uses a 1.35–1.65 V model window, while the sensor brief’s core window is 1.425–1.575 V. The AF branch assumes 20 mA and FB120 = 0.1 Ω; the installed BLM18AG601SN1 manufacturer sheet gives 0.38 Ω maximum DCR. At 120 mA that maximum alone drops 45.6 mV and dissipates 5.47 mW.

Action: Apply device-specific voltage tolerances and a bounded ferrite DCR corner; obtain the real actuator current trajectory and source response before changing bead/bulk values.

Acceptance: Qualified core-voltage limits hold at the module; full focus travel and simultaneous imaging preserve the AF voltage budget and component thermal margins.

Evidence: [hardware/22-camera-01.kicad_sch](../hardware/22-camera-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [simulation/engine.py](../simulation/engine.py).

**s22-csi-channel · warning.** Final CSI0_D0/CLK/D1 parallel fractions are 64.8%/57.5%/55.6%, with D0 pin-path mismatch 0.022 mm and CLK/D1 approximately 0.000 mm. These are geometry measurements; uncoupled fanouts, vias and the external flex remain electrical discontinuities.

Action: Extract the complete two-lane channel using approved stackup and actual flex/connector models; set the intended bitrate and receiver criteria before retuning copper.

Acceptance: The declared operating mode passes LP/HS signaling and eye/timing requirements at all channels; any copper revision preserves net parity and fabricator-approved geometry.

Evidence: [hardware/22-camera-01.kicad_sch](../hardware/22-camera-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [reports/differential-review.md](../reports/differential-review.md).

**s22-shared-bus-loading · warning.** Camera-side 2.2 kΩ pulls join host-side 2.2 kΩ pulls through a passive translator. At low bus state the sink may carry current from both voltage domains; the ideal upper bound is about 2.32 mA per active line at 3.3 V/1.8 V, before voltage drops.

Action: Include both pull-up networks and camera cable capacitance in sink/rise-time checks; keep address conventions and sensor/VCM transactions explicit.

Acceptance: Every device pulling low can sink the combined current while meetingVOL; high levels and rise time pass on both sides of the translator.

Evidence: [hardware/22-camera-01.kicad_sch](../hardware/22-camera-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [references/pca9306-revo.pdf](../references/pca9306-revo.pdf).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C120 | 4.7u 10V | 1.499625 | 0.002467 | 1.497504 | 0 | 0 | calculated |
| C121 | 4.7u 10V | 1.79985 | 0.002961 | 1.799001 | 0 | 0 | calculated |
| C122 | 4.7u 10V | 2.79955 | 0.00461 | 2.797004 | 0 | 0 | calculated |
| C123 | 4.7u 10V | 2.79925 | 0.00461 | 2.795008 | 0 | 0 | calculated |
| C124 | 100nF 16V X7R(Murata) 10% | 1.79985 | 6.299e-05 | 1.799001 | 0 | 0 | calculated |
| C125 | 100nF 16V X7R(Murata) 10% | 1.79985 | 6.299e-05 | 1.799001 | 0 | 0 | calculated |
| C126 | 100nF 16V X7R(Murata) 10% | 1.79985 | 6.299e-05 | 1.799001 | 0 | 0 | calculated |
| C127 | 100nF 16V X7R(Murata) 10% | 3.298763 | 0.0001156 | 3.291772 | 0 | 0 | calculated |
| FB120 | 600R@100MHz | Unknown | Unknown | Unknown | Unknown | Unknown | partial |
| J110 | 24-5805-024-000-829 | Unknown | Unknown | Unknown | Unknown | Unknown | partial |
| R120 | 200k | 3.298763 | Unknown | 3.291772 | Unknown | Unknown | partial |
| R121 | 2.2k | 1.79985 | Unknown | 1.799001 | Unknown | Unknown | partial |
| R122 | 2.2k | 1.79985 | Unknown | 1.799001 | Unknown | Unknown | partial |
| R123 | 47k | 3.294843 | Unknown | 3.265843 | Unknown | Unknown | partial |
| R124 | 47k | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R125 | 33 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| U120 | PCA9306DQER | 1.79985 | Unknown | 1.799001 | Unknown | Unknown | partial |
| U121 | SN74LVC1G125DPWR | 1.79985 | Unknown | 1.799001 | Unknown | Unknown | partial |
| U122 | SN74LVC1G125DPWR | 1.79985 | Unknown | 1.799001 | Unknown | Unknown | partial |
| U123 | SN74LVC1G125DPWR | 1.79985 | Unknown | 1.799001 | Unknown | Unknown | partial |
| Y120 | 25.000MHz | 3.298763 | Unknown | 3.291772 | Unknown | Unknown | partial |

## 23 — Stereo codec, I²S and microphone front end

U130 is a TLV320AIC3104 with separate 1.8 V digital and 3.3 V analog/IO supplies, two electret inputs and differential line outputs. The passives establish a plausible interface, but the codec register configuration, signal levels, microphone bias current and clock timing remain undefined.

Native source: [hardware/23-audio-01.kicad_sch](../hardware/23-audio-01.kicad_sch). Involved references: **C130, C131, C132, C133, C134, C135, C136, C137, C138, C139, C140, C141, C142, C143, FB130, MK130, MK131, R130, R131, R132, R133, R134, R135, R136, R137, R138, R139, R140, R141, U1, U130**. Primary inventory owners: 30; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** R130 holds CODEC_RESET_N low. The external 1V8_AUDIO and 3V3_PER supplies are independently defined boundaries; FB130 adds analog-rail dynamics. TI recommends IOVDD first, analog supplies next, DVDD last within 5 ms of analog availability, reset held low until stable, and analog voltage never below DVDD. The present rail traces do not prove this sequence on the real MCU board.

**Steady operation.** Run 27 reports 3V3_AUDIO 3.288285 V with a 34.876 mA aggregate placeholder and 1V8_AUDIO 1.799250 V with 14.994 mA. These are not U130 supply-pin measurements. MICBIAS is programmable; R139 = 100 Ω, C137 = 4.7 µF and R140/R141 = 2.2 kΩ shape microphone supply behavior, while coupling capacitors remove DC from the signal inputs.

**Time-domain behavior.** The 100 Ω/4.7 µF bias branch has a 0.47 ms ideal RC time constant and 339 Hz single-pole corner, before MICBIAS output impedance and microphone load. A 1 mA total microphone bias load would drop 100 mV across R139; actual bias current, settling and pop behavior are unmodeled. Codec reset must remain asserted during partial rail loss.

**Fields, return paths and EMC.** R131–R135 provide 33 Ω source-series damping; R136–R138 add 100 Ω MCU monitor branches. The accepted WCLK monitor has a 20.689 mm geometric route after its resistor plus a 3.186 mm pre-resistor branch; a resistor does not remove this load. The 30 mm microphone baseline is physical geometry, not a noise/crosstalk qualification.

**Losses and temperature.** No codec, microphone or nearby class-D heating solution exists. U130 power depends on enabled ADC/DAC/output blocks and clocks. FB130 uses the same BLM18AG601SN1 as the camera AF branch; a maximum-DCR loss corner is needed before deriving temperature rise.

**Missing models/evidence.** Codec register/clock map and activity-current model; microphone capsule impedance/current; actual source rail sequencing; I²S driver/receiver/cable models; acoustic enclosure and package thermal paths.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| 1V8_AUDIO | 1.79925 | 1.79925 | 0.014994 | 1.798767 / run-0016 |
| 3V3_AUDIO | 3.288285 | 3.288285 | 0.034876 | 3.280757 / run-0016 |
| 3V3_PER | 3.291772 | 3.291772 | 0.164552 | 3.286484 / run-0016 |

### Findings and conclusions

**s23-codec-sequence · high.** The codec’s analog and digital rails come through different external paths, with only a GPIO/pulldown reset. Simultaneous ideal ramp commands do not verify TI’s analog-before-DVDD and reset constraints, especially on shutdown or a missing MCU rail.

Action: Incorporate the codec sequence into the cross-board power contract and driver; measure actual rail/reset ordering, including restart with one rail retained. Add sequencing hardware only if the existing sources cannot guarantee it.

Acceptance: Every startup/shutdown/brownout keeps the codec supply and reset relationship inside its documented conditions and recovers without an unexplained high-current state.

Evidence: [hardware/23-audio-01.kicad_sch](../hardware/23-audio-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml).

**s23-i2s-monitor · warning.** The three MCU monitor branches are real receiver loads; WCLK’s accepted route includes both a pre-resistor branch and a long 100 Ω-isolated extension. All clock/data inputs are directly tied to the selected 3.3 V IO domain. Timing remains dependent on the actual MCU harness and clock-master choice.

Action: Freeze SoC/codec clock-master roles and the MCU receiver load, preserve the shared TX/RX clock pinmux, and evaluate monitor-on/off timing before changing resistor values.

Acceptance: At the declared sample/bit rate, timing and voltage margins hold at U130 and the MCU with the real harness; no receiver back-powers the opposite domain.

Evidence: [hardware/23-audio-01.kicad_sch](../hardware/23-audio-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [peripheral-revision/wclk-monitor/README.md](../peripheral-revision/wclk-monitor/README.md); [research/carrier-interfaces.md](../research/carrier-interfaces.md).

**s23-microphone-bias · warning.** C137 is behind 100 Ω R139 rather than directly on MICBIAS, and the two microphone loads share this filter. The bias voltage is not fixed by the net name; the codec configuration and capsule operating current determine headroom and settling. The 1 µF signal coupling capacitors have no validated input-impedance model.

Action: Obtain the exact microphone electrical data and codec input/bias settings, calculate DC headroom and all filter corners, and measure startup pop/noise with the real enclosure.

Acceptance: Both microphones remain within their bias limits; sensitivity/channel balance and noise targets pass across bias settling, audio playback and Wi-Fi activity.

Evidence: [hardware/23-audio-01.kicad_sch](../hardware/23-audio-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml).

**s23-bead-dcr · warning.** FB130’s 0.1 Ω simulation resistance is an assumption; the exact BLM18AG601SN1 manufacturer sheet specifies 0.38 Ω maximum DCR. At 35 mA that bound gives 13.3 mV drop and 0.466 mW loss, before PCB resistance, rather than the model’s 3.5 mV/0.123 mW nominal calculation.

Action: Retain a nominal model if justified but add the published maximum-DCR corner and bias-dependent impedance. Reassess effective local capacitance and analog rejection under actual load.

Acceptance: The analog rail remains within codec limits and measured audio noise/distortion targets pass at worst source/load/DCR conditions.

Evidence: [hardware/23-audio-01.kicad_sch](../hardware/23-audio-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [simulation/engine.py](../simulation/engine.py).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C130 | 100nF 16V X7R(Murata) 10% | 3.298239 | 0.00011558 | 3.288285 | 0 | 0 | calculated |
| C131 | 100nF 16V X7R(Murata) 10% | 3.298239 | 0.00011558 | 3.288285 | 0 | 0 | calculated |
| C132 | 100nF 16V X7R(Murata) 10% | 3.298239 | 0.00011558 | 3.288285 | 0 | 0 | calculated |
| C133 | 100nF 16V X7R(Murata) 10% | 3.298763 | 0.0001156 | 3.291772 | 0 | 0 | calculated |
| C134 | 100nF 16V X7R(Murata) 10% | 1.799888 | 6.3e-05 | 1.79925 | 0 | 0 | calculated |
| C135 | 4.7u 10V | 3.298239 | 0.005432 | 3.288285 | 0 | 0 | calculated |
| C136 | 1u 10V | 1.799888 | 0.00062996 | 1.79925 | 0 | 0 | calculated |
| C137 | 4.7u 10V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C138 | 1u 10V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C139 | 1u 10V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C140 | 1u 10V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C141 | 1u 10V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C142 | 47p C0G | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C143 | 47p C0G | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| FB130 | 600R@100MHz | Unknown | Unknown | Unknown | Unknown | Unknown | partial |
| MK130 | CMC-4013-2-SMT-TR | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| MK131 | CMC-4013-2-SMT-TR | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R130 | 100k | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R131 | 33 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R132 | 33 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R133 | 33 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R134 | 33 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R135 | 33 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R136 | 100 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R137 | 100 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R138 | 100 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R139 | 100 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R140 | 2.2k 0.1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R141 | 2.2k 0.1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| U130 | TLV320AIC3104IRHBR | Unknown | Unknown | Unknown | Unknown | Unknown | partial |

## 24 — Stereo bridge-tied speaker amplifier

U140 is a 5 V TPA2012D2 in RTJ WQFN, with both channels controlled by AMP_ENABLE, 6 dB gain straps, AC-coupled differential inputs and a bead on each BTL lead. Speaker impedance, audio amplitude, cable geometry and output loss are absent from the simulation.

Native source: [hardware/24-speakers-01.kicad_sch](../hardware/24-speakers-01.kicad_sch). Involved references: **C150, C151, C152, C153, C154, C155, C156, C157, FB140, FB141, FB142, FB143, J140, J141, R150, U1, U140**. Primary inventory owners: 16; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** R150 = 100 kΩ defaults both shutdown pins low. The codec and amplifier must follow a mute/enable sequence to avoid startup transients. A modeled 5 V rail does not model the amplifier PWM stage or establish the state of its inputs when CODEC_RESET_N is released.

**Steady operation.** The speaker outputs are distinct positive/negative bridge nodes; neither is GND. Run 27’s 5V_SOC 4.592139 V and aggregate 1.315511 A are board-supply estimates, not amplifier or speaker current. The output stage is not driven by the U7 SPICE experiment.

**Time-domain behavior.** For context, TI’s 2.1 W per channel condition at 4 Ω / 5 V is at 10% THD, not a clean-audio design guarantee. That load power implies 0.725 A RMS and 1.025 A peak sine current per speaker before switching ripple. Real demands require a selected speaker and signal limit.

**Fields, return paths and EMC.** The right filtered output paths are about 88.58/93.86 mm planar versus 8.76/9.94 mm on the left in the accepted route audit. Native netlist contains four series beads but no output shunt capacitors. Long board traces plus the external speaker cable require an evaluated filter and return path; no conducted or radiated pass exists.

**Losses and temperature.** U140’s exposed pad is GND-connected in the netlist, but the assembled solder/plane/enclosure thermal path is unqualified. At 0.725 A RMS a 0.14 Ω bead would dissipate about 73.5 mW per lead; switching loss and trace/contact loss are additional. No junction temperature follows from the app’s separate L219-only estimate.

**Missing models/evidence.** Speaker impedance versus frequency and power rating; audio amplitude/crest factor; TPA2012D2 switching/loss model; bead impedance/DC-bias data; cable and enclosure; thermal-pad assembly and heat-removal model.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| 5V_SOC | 4.592139 | 4.848318 | 2.853584 | 4.248665 / run-0016 |

### Findings and conclusions

**s24-bead-rating · high.** FB140–FB143 have the native value 600R@100 MHz 2 A, but the exact BLM21PG601SN1 manufacturer catalog row lists 1400 mA and 0.14 Ω maximum DCR. This is a rating annotation discrepancy, not proof that the current circuit overloads the beads.

Action: Obtain the current supplier approval sheet and correct the 2 A annotation or select a genuinely qualified alternate after current/thermal/impedance review. Do not silently carry the label forward.

Acceptance: BOM, schematic and procurement specification agree on the exact bead and temperature-dependent rating; RMS/ripple current and dissipation stay inside the approved envelope.

Evidence: [hardware/24-speakers-01.kicad_sch](../hardware/24-speakers-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml).

**s24-output-filter · high.** The final circuit uses series beads only, while the right speaker traces are nearly 90–94 mm before the external cable. TI’s filter guidance distinguishes ferrite filtering from LC filtering for long leads or sensitive lower-frequency circuitry. The current network has not been assessed against the actual cable.

Action: Model the selected speaker/cable and compare bead-only, manufacturer ferrite-plus-shunt and LC options. Reserve or add matched filter positions only after checking stability, idle current, distortion and emissions.

Acceptance: Chosen filter passes the declared audio and EMC tests with the longest intended cable and worst operating mode; no excessive capacitive output loading is introduced.

Evidence: [hardware/24-speakers-01.kicad_sch](../hardware/24-speakers-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [peripheral-revision/audio-speakers/speaker-review.md](../peripheral-revision/audio-speakers/speaker-review.md).

**s24-btl-power · warning.** Both gain straps are grounded and both shutdown controls share AMP_ENABLE. The board does not specify a speaker impedance or audio limiter, and the generic 5 V load budget does not resolve either channel’s current. Grounding a negative speaker terminal would short an active BTL output.

Action: Specify speakers, allowable distortion and limiter level; document differential probing and BTL harness polarity. Include both channels in supply and copper-loss budgets, then validate mute/enable sequencing.

Acceptance: The declared output power is achieved within distortion, supply droop, component current and thermal limits; wiring/probing never treats either BTL terminal as ground.

Evidence: [hardware/24-speakers-01.kicad_sch](../hardware/24-speakers-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [docs/connectors-and-testpoints.md](../docs/connectors-and-testpoints.md).

**s24-thermal-pad · warning.** The RTJ exposed pad is netlisted to GND, and accepted routing checks preserve all amplifier pads and output paths. Those checks do not establish solder voiding, thermal-via manufacture, temperature rise or the benefit of plane copper on this 55 mm board.

Action: Use actual loss and assembly geometry for a board thermal calculation, followed by temperature testing at the maximum declared audio duty and ambient.

Acceptance: Measured or validated junction estimate has a documented margin to the selected operating limit; bead/trace/connector temperatures also pass.

Evidence: [hardware/24-speakers-01.kicad_sch](../hardware/24-speakers-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [peripheral-revision/audio-speakers/speaker-review.md](../peripheral-revision/audio-speakers/speaker-review.md).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C150 | 1u 10V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C151 | 1u 10V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C152 | 1u 10V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C153 | 1u 10V | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| C154 | 100nF 16V X7R(Murata) 10% | 4.744344 | 0.001426 | 4.592139 | 0 | 0 | calculated |
| C155 | 100nF 16V X7R(Murata) 10% | 4.744344 | 0.001426 | 4.592139 | 0 | 0 | calculated |
| C156 | 10u 10V | 4.744344 | 0.142564 | 4.592139 | 0 | 0 | calculated |
| C157 | 10u 10V | 4.744344 | 0.142564 | 4.592139 | 0 | 0 | calculated |
| FB140 | 600R@100MHz 2A | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| FB141 | 600R@100MHz 2A | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| FB142 | 600R@100MHz 2A | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| FB143 | 600R@100MHz 2A | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| J140 | LEFT SPEAKER BTL | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| J141 | RIGHT SPEAKER BTL | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R150 | 100k | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| U140 | TPA2012D2RTJR | 4.744344 | Unknown | 4.592139 | Unknown | Unknown | partial |

## 25 — USB recovery data port and operator buttons

J150 is a USB-C USB2 device/recovery connection with separate CC pull-downs, data-line ESD and a VBUS sensing divider. USB VBUS is isolated from the main 5 V rail by topology; recovery enumeration and protection of non-data connector pins are not demonstrated.

Native source: [hardware/25-usb_recovery-01.kicad_sch](../hardware/25-usb_recovery-01.kicad_sch). Involved references: **C160, J150, R15, R160, R161, R162, R163, R164, R165, SW100, SW101, SW102, U1, U150**. Primary inventory owners: 13; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** USB_VBUS may exist before J120 main power. R162/R163 therefore apply a divided voltage to RK3566 VBUSDET even when the PHY rails are off; the model has no powered-off detector behavior. SW100 grounds SARADC recovery input, while SW101/SW102 act through the PMIC/reset support networks.

**Steady operation.** R162 = 100 kΩ over R163 = 150 kΩ gives 0.6 × VBUS: 3.0 V and 20 µA divider current at 5 V. With ±1% resistors and 4.75–5.25 V input, the calculated detector interval is 2.827–3.175 V, inside the guide’s 2.7–3.3 V detection band. This arithmetic does not prove clamp/injection behavior during detach or unpowered operation.

**Time-domain behavior.** C160 = 100 nF is the only direct VBUS capacitor on this sheet; no local VBUS/CC TVS appears in the native netlist. U150 protects the two data lines. Attach/detach, cable discharge and ESD outcomes require a specified external environment and measurement.

**Fields, return paths and EMC.** Final complete SoC-to-USB-C path mismatches are 0.007 mm atA contacts and 0.112 mm atB contacts. Uncoupled fanouts and the connector’s duplicateD+/D− contacts remain part of the full channel. TPD2EUSB30 presence and close matching do not establish USB signal integrity or system immunity.

**Losses and temperature.** Divider dissipation is only 100µW total at 5 V by resistor arithmetic, but USB fault/ESD heating is not a steady-state thermal model. No connector-temperature or transient-protection result is available; the connector is not the authorized main power input.

**Missing models/evidence.** RK3566 powered-off VBUSDET and USB PHY models; connector/cable/ESD discharge path; exact CC/VBUS surge environment; USB device firmware and recovery/MaskROM procedure.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| VCCA_1V8 | 1.798651 | 1.798651 | 0.044966 | 1.797781 / run-0016 |

### Findings and conclusions

**s25-vbus-detector · warning.** The 100 kΩ/150 kΩ divider matches a 5 V attach-detect use and its tolerance result fits the hardware guide. It remains connected to U1.T38 when main board power is absent; no detector power-off tolerance/injection result is present.

Action: Verify the specific RK3566 detector off-state limits and test VBUS-first/main-power-first/slow-detach cases; add isolation/clamping only if required without disturbing its high-level window.

Acceptance: Detector voltage/current stays within its device limits in every sequence and USB attach/detach remains reliable, including resistor and source tolerances.

Evidence: [hardware/25-usb_recovery-01.kicad_sch](../hardware/25-usb_recovery-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

**s25-port-protection · warning.** U150 protects USB_CONN_P/N only. CC1/CC2 each have 5.1 kΩ toGND; VBUS has a divider/capacitor, and the shell is directly on GND. No CC or VBUS protection device appears on this sheet. This is a protection-coverage gap to assess, not a demonstrated immunity failure.

Action: Define the connector exposure and immunity target, review the discharge path and add correctly rated low-leakage protection where justified. Verify exact TPD2EUSB30 part/footprint and ground path.

Acceptance: Data and non-data contacts meet the declared ESD/transient tests without latent damage or incorrect attach state; added protection preserves CC and USB operation.

Evidence: [hardware/25-usb_recovery-01.kicad_sch](../hardware/25-usb_recovery-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml).

**s25-usb-channel · warning.** R164/R165 are 2.2 Ω data-series elements and U150 sits on the connector side. The final geometry has small end-to-end mismatch but still significant uncoupled/forked copper; package, ESD and cable parasitics are not simulated.

Action: Extract the complete USB2 channel and validate the intended speed with the exact connector/cable/ESD package. Rework routing or series values only from the channel evidence.

Acceptance: USB2 eye/timing and recovery data transfer pass the declared operating conditions and cable variants.

Evidence: [hardware/25-usb_recovery-01.kicad_sch](../hardware/25-usb_recovery-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [reports/differential-review.md](../reports/differential-review.md).

**s25-recovery-procedure · warning.** SW100 pulls SARADC_VIN0 low through the RECOVERY_KEY net; R15 is 10 kΩ to VCCA_1V8. This is not proof of a forced MaskROM path when a valid eMMC boot device is fitted. SW101 uses 22 Ω toRESETn; SW102 uses 100 Ω to PMIC_PWRON.

Action: Document separate recovery and true MaskROM procedures, main-power requirement and button timing; validate them with the selected boot image and removable eMMC. Preserve the RECOVERY label.

Acceptance: Repeated power/reset/recovery trials produce the documented boot mode and USB identity; a recoverable path remains when normal eMMC boot fails.

Evidence: [hardware/25-usb_recovery-01.kicad_sch](../hardware/25-usb_recovery-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [research/carrier-interfaces.md](../research/carrier-interfaces.md); [docs/connectors-and-testpoints.md](../docs/connectors-and-testpoints.md).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| C160 | 100nF 16V X7R(Murata) 10% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| J150 | USB-C DATA / RECOVERY | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R15 | 10k | 1.799798 | Unknown | 1.798651 | Unknown | Unknown | partial |
| R160 | 5.1k | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R161 | 5.1k | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R162 | 100k 1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R163 | 150k 1% | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R164 | 2.2 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| R165 | 2.2 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| SW100 | RECOVERY | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| SW101 | PMIC_RESET_KEY | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| SW102 | PWRON_KEY | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| U150 | TPD2EUSB30DRTR | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |

## 26 — Bring-up testpoints and rail observability — group 1

This sheet owns 40 testpoint components spanning power rails, UART, PMIC controls, Wi-Fi enables and two inline eMMC access pads. The pads provide voltage access; they are not 40 current sensors or proof that the underlying nodes were measured.

Native source: [hardware/26-debug-01.kicad_sch](../hardware/26-debug-01.kicad_sch). Involved references: **TP30, TP31, TP32, TP33, TP34, TP35, TP50, TP51, TP52, TP53, TP54, TP55, TP56, TP57, TP58, TP59, TP60, TP61, TP62, TP63, TP201, TP202, TP203, TP204, TP205, TP206, TP207, TP208, TP209, TP210, TP211, TP212, TP213, TP214, TP215, TP216, TP217, TP218, TP219, TP220**. Primary inventory owners: 40; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** TP201/202/203–214 and TP215 allow rail/reset correlation. TP50–56 observe external peripheral rails that must be related to J121.6 enable timing. TP218/219 expose Wi-Fi enables but not the internal module VDDC needed for its timing proof.

**Steady operation.** TP203/TP204 straddle the 10 mΩ R227 CPU supply shunt. Their differential voltage can estimate aggregate CPU-rail current if pickup is truly Kelvin and the shunt/offset are calibrated; at 1 A the ideal signal is 10 mV and shunt dissipation 10 mW. Other one-node pads report potential, not current.

**Time-domain behavior.** Probe capacitance, ground inductance and attachment time can alter clock/reference behavior. TP62/TP63 are 0.6 mm eMMC clock/D0 inline landings, not disconnected stubs. They remain a capacitive discontinuity and a measurement load; no loaded-channel test is supplied.

**Fields, return paths and EMC.** The map includes PMIC SCL/SDA at TP57/58, not the separate peripheral SOC_SCL/SDA bus. Sensitive clocks should use short returns/low-loading probes; long scope-ground loops could create ringing absent from the board. The current geometry audit does not simulate the probe fixture.

**Losses and temperature.** Testpoint voltage does not determine temperature. Shunt-derived current may support a loss estimate for R227 only after its resistance/temperature coefficient is known; it does not resolve internal RK3566 block heat or external rail dissipation.

**Missing models/evidence.** Probe R/C/bandwidth and return fixture; differential amplifier/offset; R227 calibrated value and temperature coefficient; loaded eMMC channel; fixture mechanical clearance.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| 1V8_AUDIO | 1.79925 | 1.79925 | 0.014994 | 1.798767 / run-0016 |
| 3V3_AUDIO | 3.288285 | 3.288285 | 0.034876 | 3.280757 / run-0016 |
| 3V3_PER | 3.291772 | 3.291772 | 0.164552 | 3.286484 / run-0016 |
| 5V_SOC | 4.592139 | 4.848318 | 2.853584 | 4.248665 / run-0016 |
| CAM_1V5 | 1.497504 | 1.497504 | 0.049917 | 1.495897 / run-0016 |
| CAM_1V8 | 1.799001 | 1.799001 | 0.019989 | 1.798356 / run-0016 |
| CAM_2V8 | 2.797004 | 2.797004 | 0.059922 | 2.795074 / run-0016 |
| CAM_AF_2V8 | 2.795008 | 2.795008 | 0.019964 | 2.791792 / run-0016 |
| VCC3V3_PMU | 3.2991 | 3.2991 | 0.029992 | 3.29852 / run-0016 |
| VCCA1V8_PMU | 1.798891 | 1.798891 | 0.036977 | 1.798175 / run-0016 |
| VCC_1V8 | 1.798561 | 1.798561 | 0.119904 | 1.797633 / run-0016 |
| VCC_3V3 | 3.265843 | 3.265843 | 2.1 | 3.243706 / run-0016 |
| VCC_3V3_SBC | 3.281876 | 3.281876 | 6 | 3.269912 / run-0016 |
| VCC_DDR | 1.342245 | 1.342245 | 0.646266 | 1.337284 / run-0016 |
| VDDA0V9_PMU | 0.899251 | 0.899251 | 0.024979 | 0.898767 / run-0016 |
| VDDA_0V9 | 0.898652 | 0.898652 | 0.044933 | 0.897784 / run-0016 |
| VDD_CPU | 1.025 | 1.025 | 4.67721 | 1.025 / run-0004 |
| VDD_CPU_P | 1.0325 | 1.0325 | 4.346602 | 1.0325 / run-0004 |
| VDD_GPU | 0.897845 | 0.897845 | 0.179569 | 0.896459 / run-0016 |
| VDD_LOGIC | 0.894632 | 0.894632 | 0.447316 | 0.8912 / run-0016 |
| VDD_NPU | 0.898562 | 0.898562 | 0.119808 | 0.897636 / run-0016 |

### Findings and conclusions

**s26-current-observability · warning.** Only TP203/TP204 intentionally bracket the 10 mΩ CPU shunt R227. Even there the measured difference contains pickup/offset error unless the connections are Kelvin. The remaining voltage pads do not establish per-component current.

Action: Specify a differential Kelvin fixture and calibration/error budget; map each other current question to an actual shunt, branch measurement or justified model.

Acceptance: A known-load test verifies measured shunt current and uncertainty; the report never labels a rail aggregate as an individual IC pin current.

Evidence: [hardware/26-debug-01.kicad_sch](../hardware/26-debug-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [hardware/03-cpu-01.kicad_sch](../hardware/03-cpu-01.kicad_sch); [docs/connectors-and-testpoints.md](../docs/connectors-and-testpoints.md).

**s26-emmc-probe-loading · warning.** TP62/TP63 are retained inline 0.6 mm eMMC clock/D0 pads. Eliminating a branch stub does not eliminate pad/probe capacitance, and the remote module and high-speed timing are still unqualified.

Action: Use low-loading probes and model the mounted fixture/pads. Do not add larger branched pads merely to improve access; capture high-speed results only after probe loading is bounded.

Acceptance: Unprobed and probed channels both satisfy the chosen speed/timing criteria, or the probe setup is explicitly limited to low-speed bring-up.

Evidence: [hardware/26-debug-01.kicad_sch](../hardware/26-debug-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [docs/connectors-and-testpoints.md](../docs/connectors-and-testpoints.md); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

**s26-signal-identity · warning.** TP57/58 are PMIC I²C, while the ToF/codec/camera host bus is SOC_SCL/SDA. TP30 is SoC RX and TP31 is SoC TX despite the inherited RADXA_RX/MCU_RX net names. Confusing these nodes can invalidate a bring-up conclusion or create UART contention.

Action: Publish one directional testpoint map with probe levels, intended bus and console isolation steps; keep functional silk consistent in a future drawing update.

Acceptance: Bench captures name the actual nets and UART direction; the R50 procedure and PMIC-versus-peripheral bus distinction are unambiguous.

Evidence: [hardware/26-debug-01.kicad_sch](../hardware/26-debug-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [docs/connectors-and-testpoints.md](../docs/connectors-and-testpoints.md).

**s26-access-limits · warning.** The native map gives local probe positions and existing GND pads; package-envelope graphics do not prove access with an installed heatsink, eMMC module, flexes and wiring. Probe force and ground-lead routing were not evaluated.

Action: Review the assembled access/fixture envelope and capture a scope connection plan. Move or duplicate only low-speed/DC pads if access is physically blocked; avoid new high-speed stubs.

Acceptance: All required bring-up measurements can be made without mechanical interference or adjacent-pin shorts and with a bounded probe-return loop.

Evidence: [hardware/26-debug-01.kicad_sch](../hardware/26-debug-01.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [docs/connectors-and-testpoints.md](../docs/connectors-and-testpoints.md); [simulation/data/board-layout.json](../simulation/data/board-layout.json).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| TP30 | SOC_RX | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP31 | SOC_TX | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP32 | GND | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP33 | RECOVERY | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP34 | DDR1V35 | 1.348831 | Unknown | 1.342245 | Unknown | Unknown | partial |
| TP35 | DDR_VREFDQ | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP50 | PER3V3 | 3.298763 | Unknown | 3.291772 | Unknown | Unknown | partial |
| TP51 | AUDIO1V8 | 1.799888 | Unknown | 1.79925 | Unknown | Unknown | partial |
| TP52 | CAM1V5 | 1.499625 | Unknown | 1.497504 | Unknown | Unknown | partial |
| TP53 | CAM1V8 | 1.79985 | Unknown | 1.799001 | Unknown | Unknown | partial |
| TP54 | CAM2V8 | 2.79955 | Unknown | 2.797004 | Unknown | Unknown | partial |
| TP55 | CAM_AF | 2.79925 | Unknown | 2.795008 | Unknown | Unknown | partial |
| TP56 | AUDIO3V3 | 3.298239 | Unknown | 3.288285 | Unknown | Unknown | partial |
| TP57 | PMIC_SCL | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP58 | PMIC_SDA | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP59 | PMIC_INT | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP60 | PMIC_SLEEP | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP61 | GND | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP62 | EMMC CLK | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP63 | EMMC D0 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP201 | 5V_SOC | 4.744344 | Unknown | 4.592139 | Unknown | Unknown | partial |
| TP202 | VCC_3V3_SBC | 3.299494 | Unknown | 3.281876 | Unknown | Unknown | partial |
| TP203 | VDD_CPU | 1.025 | Unknown | 1.025 | Unknown | Unknown | partial |
| TP204 | VDD_CPU_P | 1.026125 | Unknown | 1.0325 | Unknown | Unknown | partial |
| TP205 | VDD_LOGIC | 0.899191 | Unknown | 0.894632 | Unknown | Unknown | partial |
| TP206 | VDD_GPU | 0.899676 | Unknown | 0.897845 | Unknown | Unknown | partial |
| TP207 | VDD_NPU | 0.899784 | Unknown | 0.898562 | Unknown | Unknown | partial |
| TP208 | VCC_DDR | 1.348831 | Unknown | 1.342245 | Unknown | Unknown | partial |
| TP209 | VCC_1V8 | 1.799784 | Unknown | 1.798561 | Unknown | Unknown | partial |
| TP210 | VCC_3V3 | 3.294843 | Unknown | 3.265843 | Unknown | Unknown | partial |
| TP211 | VCC3V3_PMU | 3.299865 | Unknown | 3.2991 | Unknown | Unknown | partial |
| TP212 | VDDA_0V9 | 0.899798 | Unknown | 0.898652 | Unknown | Unknown | partial |
| TP213 | VDDA0V9_PMU | 0.899888 | Unknown | 0.899251 | Unknown | Unknown | partial |
| TP214 | VCCA1V8_PMU | 1.799834 | Unknown | 1.798891 | Unknown | Unknown | partial |
| TP215 | RESETn | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP216 | PMIC_PWRON | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP217 | PMIC_CLK32K | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP218 | WIFI_REG_ON_H_GPIO2_B1 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP219 | BT_REG_ON_H_GPIO2_B7 | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |
| TP220 | GND | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |

## 27 — Bring-up testpoints and rail observability — group 2

TP221–TP227 add seven specific analog/image/IO/reference observation points. They close voltage-access gaps, but the domain identities and probe loading must remain distinct; they do not add functional or thermal models.

Native source: [hardware/27-debug-02.kicad_sch](../hardware/27-debug-02.kicad_sch). Involved references: **TP221, TP222, TP223, TP224, TP225, TP226, TP227**. Primary inventory owners: 7; DNP among owners: 0. Shared members are not extra physical parts.

**Startup and boot.** TP221–TP224 expose analog/image/codec-domain rails used in SoC sequencing. TP225/226 distinguish SD and Wi-Fi IO voltages. Their appearance in the candidate rail waveform does not prove actual OTP/pinmux sequencing or peripheral enumeration.

**Steady operation.** TP226 is VCCIO_WL, presently linked to 1.8 V; it must not be interpreted as Wi-Fi 3.3 V VBAT. TP227 is the DDR command/address reference from R402/R403 = 1 kΩ, 0.1%, distinct from TP35 on DDR_VREFOUT. At nominal 1.35 V DDR, the ideal unloaded divider gives 0.675 V.

**Time-domain behavior.** The TP227 divider has approximately 500 Ω Thevenin resistance before its capacitors/loads. A 1 MΩ DC probe would shift the ideal voltage by about 0.05%; transient error also depends on probe capacitance and local decoupling. The SoC-driven DDR_VREFOUT source has a different, unmodeled output impedance.

**Fields, return paths and EMC.** TP222 is a small 0.6 mm image-rail access pad with a separately checked 1.2 mm probe disk in the geometry documentation. Neither that mechanical screen nor the lack of a high-speed branch establishes EMC. The optical/clock/reference neighborhoods need a fixture-aware measurement.

**Losses and temperature.** No temperatures can be inferred directly from these seven voltage readings. Each image/analog/IO source needs an actual load and thermal model; core temperature depends on silicon activity and package heat transfer.

**Missing models/evidence.** Reference-source impedance/noise and probe capacitance; selected IO voltage configuration; fixture access after assembly; actual image/analog block current and thermal model.

Associated modeled rails; currents are aggregate rail demands:

| Net | Run-0027 steady V | Nominal steady V | Run-0027 full-experiment peak A | Campaign minimum steady V / run |
|---|---:|---:|---:|---|
| VCCA1V8_IMAGE | 1.7994 | 1.7994 | 0.019993 | 1.799013 / run-0016 |
| VCCA_1V8 | 1.798651 | 1.798651 | 0.044966 | 1.797781 / run-0016 |
| VCCIO_ACODEC | 3.29964 | 3.29964 | 0.011999 | 3.299408 / run-0016 |
| VCCIO_SD | 3.29964 | 3.29964 | 0.011999 | 3.299408 / run-0016 |
| VCCIO_WL | 1.798831 | 1.798831 | 0.011992 | 1.798077 / run-0016 |
| VDDA0V9_IMAGE | 0.898951 | 0.898951 | 0.034959 | 0.898275 / run-0016 |

### Findings and conclusions

**s27-vref-separation · warning.** TP227 DDR3_VREFCA is a passive 1 kΩ/1 kΩ divider node; TP35 DDR_VREFOUT is a separate SoC-relatedDQ reference. They are different nets with different source impedances and must not be shorted or treated as duplicate points.

Action: Define separate DC/ripple limits and probe impedance for each reference; keep the distinction explicit in the next measurement and PCB-change task.

Acceptance: Both references are measured with bounded loading against their own specification; no fixture or modification ties the nets together.

Evidence: [hardware/27-debug-02.kicad_sch](../hardware/27-debug-02.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [hardware/16-ddr_power-01.kicad_sch](../hardware/16-ddr_power-01.kicad_sch); [docs/connectors-and-testpoints.md](../docs/connectors-and-testpoints.md).

**s27-io-domain-identity · warning.** TP225 VCCIO_SD and TP226 VCCIO_WL are domain rails, not connector power aliases. Native R212 links Wi-Fi IO to VCCA1V8_PMU; the shared 3.3 V peripheral domains instead use other supply nets. A software IO-voltage setting cannot be inferred from the label alone.

Action: Cross-check actual rail measurement with RK3566 IO-domain configuration and the selected storage/Wi-Fi mode before exercising the bus.

Acceptance: Electrical rail levels and software domain settings agree with every attached device through reset and runtime voltage changes.

Evidence: [hardware/27-debug-02.kicad_sch](../hardware/27-debug-02.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [research/carrier-interfaces.md](../research/carrier-interfaces.md); [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

**s27-probe-access · warning.** The seven probes include image/analog rails in dense neighborhoods; TP222’s larger access disk is a separate geometric check, not an assembled probe guarantee. The current web color overlay assigns modeled voltage only, and no branch current sensor exists at these pads.

Action: Verify probe approach and nearby ground access with the real assembly, and preserve explicit Unknown current/temperature values. Relocate a pad only if the actual fixture requires it.

Acceptance: A documented fixture can reach every required rail/reference without loading it beyond its measurement budget or contacting neighboring copper.

Evidence: [hardware/27-debug-02.kicad_sch](../hardware/27-debug-02.kicad_sch); [simulation/data/native-netlist.xml](../simulation/data/native-netlist.xml); [docs/connectors-and-testpoints.md](../docs/connectors-and-testpoints.md); [simulation/data/board-layout.json](../simulation/data/board-layout.json).

### Component ledger — unique owners

Values below are the frozen 4.75 V run. Scalar V retains the original component model’s meaning; the complete JSON and web inspector include every pin and its potential. Startup current uses the recorded requested-reset window; steady current is an average. **Unknown is not zero.**

| Ref | Value | Startup model V | Startup current A | Steady model V | Steady current A | Steady real loss W | Coverage |
|---|---|---:|---:|---:|---:|---:|---|
| TP221 | VCCA_1V8 | 1.799798 | Unknown | 1.798651 | Unknown | Unknown | partial |
| TP222 | VCCA1V8_IMAGE | 1.79991 | Unknown | 1.7994 | Unknown | Unknown | partial |
| TP223 | VDDA0V9_IMAGE | 0.899843 | Unknown | 0.898951 | Unknown | Unknown | partial |
| TP224 | VCCIO_ACODEC | 3.299946 | Unknown | 3.29964 | Unknown | Unknown | partial |
| TP225 | VCCIO_SD | 3.299946 | Unknown | 3.29964 | Unknown | Unknown | partial |
| TP226 | VCCIO_WL | 1.799825 | Unknown | 1.798831 | Unknown | Unknown | partial |
| TP227 | DDR3_VREFCA | Unknown | Unknown | Unknown | Unknown | Unknown | unmodeled |

## Reproduction and next-stage work

Regenerate the section ledger with `python3 section_analysis.py` and this report with `python3 write_section_report.py` from `simulation/`. Both scripts are read-only with respect to hardware. The ledger rejects changed hardware/run/engine identities and retains hashes for review inputs. The web service also checks the report’s own saved inputs, including BOM/schematic-only changes.

The focused accounting, identity, unknown-value, campaign and service checks pass 31 tests (`python3 -m unittest test_section_analysis test_service -v`). Browser verification is recorded separately in `data/sections-validation.json`; do not treat software tests as physical qualification.

Implement the [next PCB revision task](NEXT_PCB_REVISION_TASK.md) against a separate proposed revision. Keep the frozen hardware, original findings and failed scenarios available for before/after comparison. Changes need a documented mechanism and applicable acceptance checks; a prettier plot or higher subjective score does not close a physical evidence gap.
