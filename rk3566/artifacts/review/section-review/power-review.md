# Power-section review: native sheets 02–08

Reviewed 14 September 2026 against the saved revision 4 PCB SHA-256 `3ba4da7036173e31941ea22b041d1a2a3433c2bcdedccf1a75b1f52b31ce2807`. No schematic, PCB, BOM, solver or saved simulation result was changed. The existing professional readiness remains **2.5/10** under PRV-1; section coverage earns no new physical-validation credit.

This report distinguishes **confirmed connectivity**, **conditional calculations/model results**, **source conflicts** and **open physical validation**. Proposed changes below are dependencies for a future PCB task, not authorization to choose arbitrary substitute values. The exact machine-readable findings are in [power-review.json](power-review.json).

## Evidence and scenario identities

The review reads native child schematics plus the endpoint-checked netlist and saved PCB. Shared U2/U1 units appear in multiple sheets, so section membership counts are not unique component counts. Every section lists its actual native references in the JSON.

| Saved run | Source V | Source-path R | Assumed load factor | Effective-C factor | Ambient | Meaning |
|---|---:|---:|---:|---:|---:|---|
|0004|5.00 V|0.120 Ω|1.0|0.70|25 °C|Frozen nominal behavioral case, model 9/10|
|0016|4.75 V|0.250 Ω|1.4|0.40|70 °C|Frozen combined corner, model 7/10; declared 5 V floors fail|
|0027|4.75 V|0.120 Ω|1.0|0.70|25 °C|Later selected exploratory case; not substituted for nominal run-0004|

All load factors, effective-capacitance factors and temperature coefficients above are model assumptions. The detailed U7 switching experiments are a **different fixed 5 V local experiment**, and the 60 s thermal illustration is a separate held-loss calculation. Currents at rail sources are aggregate loads, not individual IC currents. Failed cases remain preserved.

## Source anchors and fresh calculations

- Native files: `hardware/02-input-01.kicad_sch` through `hardware/08-pmic_audio-01.kicad_sch`; shared reset capacitance also appears in `hardware/17-soc_clock-01.kicad_sch`. Connectivity and geometry: `simulation/data/{native-netlist.xml,board.json,board-layout.json}`; component sourcing: `hardware/{design-spec.json,bom.csv}`.
- Retained Rockchip `references/power-wifi/rk809-datasheet-v1.01.txt`: pin map lines 733–774; recommended/DC characteristics lines 809–1000; external DDR feedback limits lines 870–872 and feedback-mode selection lines 4580–4584; startup description lines 1083–1097; LDO3/channel clarification lines 934–943 and 1129–1131; open-drain pins lines 1071–1073; thermal test-board conditions lines 6090–6112. Its power-sequence table is for RK809-1 and is not an exact-5 OTP record.
- `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt`: cold reset/shutdown lines 1265–1275; exact-5 features lines 1686–1700; >30 µF BUCK1/2 guidance lines 1729–1731; RTC/input and VDC requirements lines 1727–1749; power-off and TSADC behavior lines 1757–1780. The default sequence, voltage and current limits must still match the fitted -5 part.
- `references/power-wifi/tcs4525.txt`: retained operating limits/frequency lines 142–183, VSEL/default registers and inductor application guidance. The preserved later manufacturer page/PDF conflict is explained in `simulation/professional/models/README.md`; the fresh page retrieval timed out during this review, so the preserved source and its hashes are used. [Manufacturer product page](https://www.tctek.cn/en/product/tcs4525/).
- U7 source calculations and Coilcraft limits: `power-revision/regulator-source-qualification.md`; TI model exclusions: `simulation/professional/models/TPS566242-original-header.txt`. TI's exact-part page was rechecked; the PDF fetch failed during this review, so detailed limits remain attributed to the retained qualification record. [TI TPS566242](https://www.ti.com/product/TPS566242).
- DDR minimum 1.283 V: `references/soc-memory/issi-ddr3l.txt`, introductory low-voltage conditions. I2C Fast-mode 300 ns rise limit and `tr=0.8473×Rp×Cb`: NXP UM10204 Rev. 7.0, Table 11 and §7.1, checked 14 September 2026. With 2.2 kΩ this gives 160.94 pF before topology/device qualifications. [NXP I2C specification](https://www.nxp.com/docs/en/user-guide/UM10204.pdf).

Fresh arithmetic is reproducible directly from the stated inputs: feedback `Vref×(1+Rtop/Rbottom)`; RC divider `Rth=Rtop||Rbottom` and `t=−Rth×C×ln(1−Vthreshold/Vfinal)`; input path/shunt loss `I²R`; LDO-only loss `Σ(Vin−Vout)I`; CCM ripple `Vout(1−Vout/Vin)/(Lf)`. These equations do not supply missing controller, device-state or thermal models.

## S02 — Input connector and 3.3 V preregulator

Confirmed: J120 supplies 5V_SOC; U7 TPS566242 and L219 generate VCC_3V3_SBC. C100/C101 add 44 µF nominal input bulk, C380/C381 provide 22 µF + 100 nF input bypass, and C382–C385 provide 88 µF nominal output capacitance. C102 is on downstream switched VCC_3V3, not the U7 output.

**Startup:** Run-0004: U7 rail reaches 95% at 1.325 ms and the averaged current hits its assumed 6 A ceiling while charging. The nominal R380/R381 EN divider gives 4.545 V at 5 V input, ignoring leakage. These facts do not validate real EN threshold, soft start or current-limit behavior. Startup peak labels use the requested reset-release window, not a measured boot phase (see S07).

**Steady state:** Run-0004 U7 output 3.281876 V/1.208299 A; combined run-0016 output 3.269912 V/1.706415 A. These aggregate rail currents include downstream modeled demand and are not U7 pin-current measurements. Feedback-divider DC demand is 20 µA at 3.3 V; EN-divider demand 45.455 µA at 5 V, under ideal resistor assumptions.

**Transient:** Separate fixed 5 V/2 A ngspice study: settled output mean 3.300051 V, 2.932 mV ripple, L219 RMS current 2.01489 A. A 1 A → 2 A local load-step study spans 3.150665–3.385516 V. Unprotected cold fixed PWM reaches 20.2197 A/5.700 V and is explicitly outside the constant-inductance model validity; it is not actual U7 startup.

**EMI/EMC:** Only a conditional local output-loop contribution has been calculated; source/harness, input commutation, core leakage, radiation and immunity remain unverified.

**Thermal:** The 60 s thermal illustration for L219 uses 56.705 mW held five-cycle DCR loss, assumed 25 K/W and 0.5 J/K at 25 °C, yielding 26.406 °C. No U7, capacitor or board temperature is supplied. This 2 A illustration does not validate the 6 A capacity case.

**Findings and next-task acceptance:**

- **P02-01 / high / conditional_model:** Combined run-0016 produces 5V_SOC = 4.248665 V at 2.005341 A, versus 4.848318 V at 1.264018 A in nominal run-0004. The declared 4.5 V system floor fails. The combined 250 mΩ external source path loses 0.501335 V and 1.005348 W; this loss is outside the SBC unless a measured resistance partition places some on it. U7 and U3 remain above their recommended input minima in this saved case. **Action:** Define minimum connector voltage, maximum source/harness resistance and real activity loads. Partition connector/cable/PCB losses and review upstream regulation before proposing a source-path change. **Accept when:** Reproduce nominal and combined cases with supported boundary inputs; verify every actual 5 V consumer limit. Do not call the 4.5 V scenario failure a proven IC undervoltage failure. Evidence: `simulation/data/runs/run-0004.json`, `simulation/data/runs/run-0016.json`, `hardware/02-input-01.kicad_sch`, `docs/connectors-and-testpoints.md`.

- **P02-02 / high / calculated_tolerance:** The R382 = 135 kΩ / R383 = 30 kΩ divider sets 3.300 V from 0.600 V nominal feedback. The retained full-temperature 0.591–0.609 V reference and ±0.1% resistors give 3.245186–3.354986 V before line/load/ripple/trace errors. This low corner leaves 45.186 mV above Wi-Fi VBAT minimum of 3.2 V before FB202; an illustrative 0.4 A through 50 mΩ reduces this to 25.186 mV. The saved combined corner does not sweep these feedback tolerances. **Action:** Add source-qualified feedback/component corners and Wi-Fi burst measurements to the power budget. Preserve shared PMIC/SoC maximum voltages if a future setpoint change is considered. **Accept when:** Document minimum module-pad VBAT and all shared-consumer maximums at temperature and burst load; no arbitrary load/setpoint changes to make the result pass. Evidence: `power-revision/regulator-source-qualification.md`, `references/power-wifi/aw-cm256sm-v1.9.txt`, `hardware/design-spec.json`, `simulation/data/runs/run-0016.json`.

- **P02-03 / high / open_validation:** L219 is the qualified identity XAL6030-222MEC, 2.2 µH ±20%, 13.97 mΩ maximum DCR, 15.9 A saturation reference at 30% inductance reduction/25 °C. Its footprint polarity matches SW pad 2 / output pad 1. Exact C382–C385 MPNs and bias/ESR/ESL are unresolved. At 6 A, the retained worst-inductance nominal-frequency calculation gives 6.58 A peak and about 0.50 W DCR loss; these are capacity calculations, not established board demand. **Action:** Select exact MLCCs, extract mounted network impedance and use a compatible exact TPS566242 controller model or measured responses. Check hot inductance/current and actual waveform losses. **Accept when:** Capacitance/stability and current margins are documented at accepted source/load/temperature corners, with vendor-reference and bench correlation. Existing passive SPICE checks alone do not close this gate. Evidence: `power-revision/regulator-source-qualification.md`, `simulation/data/time-domain.json`, `simulation/professional/models/README.md`, `hardware/design-spec.json`.

- **P02-04 / medium / open_validation:** SBC_SW_3V3 has 4.378161 mm of B.Cu track and zero vias. SBC_FB_3V3 has 8.402500 mm of track and 2 vias. These are actual geometry facts, not loop-area or EMI measurements. The existing E/B study omits the critical U7 input commutation loop and does not qualify feedback noise immunity. **Action:** Extract the actual input-capacitor/FET/ground loop, feedback return and nearby coupled conductors; correlate with switch-node/feedback probing and conducted/near-field measurements. Propose copper changes only from that evidence. **Accept when:** A defined local loop/return model or measurements show acceptable switching/feedback behavior and applicable product EMC evidence is retained. Evidence: `simulation/data/electrical-audit.json`, `hardware/rk3566-sbc.kicad_pcb`, `simulation/TIME_DOMAIN_EM_ANALYSIS.md`.

**Missing models:** TPS566242 transient model is obtained but Cadence-encrypted and not run. Its readable header excludes operating/shutdown current, temperature dependence and large-duty operation. MLCC mounted/bias models, source impedance and package/plane parasitics are absent.

**Conditional future changes:** Qualify C380/C382–C385 exact MPNs and mounted capacitance before any capacitor substitution. Change source path, setpoint or loop geometry only after P02-01 through P02-04 establish a quantified need.

## S03 — CPU buck supply and Kelvin feedback

Confirmed: U3 receives 5V_SOC; L206 = 240 nH feeds VDD_CPU_P, R227 = 10 mΩ feeds VDD_CPU, and R10/R229 returns the post-shunt sense node to CPU_FB. C249/C250 provide 44 µF nominal input bulk, C253/C254 together provide 44 µF pre-shunt output bulk and C255 = 22 µF post-shunt bulk; C252 adds 100 nF. C251 and R233 are DNP.

**Startup:** Nominal run-0004 reaches 95% VDD_CPU at 9.140 ms and holds 1.025 V by a feedforward Kelvin surrogate. It reports 4.677 A downstream charging peak; actual controller inrush and DVS behavior are unknown. Startup peak labels use the requested reset-release window, not a measured boot phase (see S07).

**Steady state:** Nominal run-0004 VDD_CPU_P = 1.032500 V and VDD_CPU = 1.025000 V at 0.750 A. Combined run-0016 keeps 1.025000 V at 1.049996 A with pre-shunt 1.037343 V; the additional drop includes the engine’s assumed resistor temperature coefficient, not an actual shunt curve.

**Transient:** Independent CCM sizing at ideal 5 V→1.025 V and 3 MHz gives 1.131771 A peak-to-peak ripple for 240 nH versus 0.823106 A for 330 nH, 37.5% higher. This does not predict PFM, startup or saturation; the retained frequency range is 2.65–3.35 MHz and exact revision remains open.

**EMI/EMC:** CPU_SW has 3.523141 mm of F.Cu track, zero vias. CPU_FB has 8.372857 mm of track and 2 vias. Input commutation through C249/C250, package grounds and the sense route needs coupling/return review; route lengths alone do not prove an EMI defect.

**Thermal:** Only conditional shunt/inductor resistive losses can be computed. Retained U3 thetaJA = 65 °C/W is a package reference, not the 55 mm PCB thermal transfer function; controller, winding/core losses and actual temperatures are absent.

**Findings and next-task acceptance:**

- **P03-01 / high / source_conflict:** Board L206 = 240 nH has no exact MPN or hot/current curve. The retained TCS4525 Ver. 1.0 source specifies 5 A and 330/470 nH, but the current manufacturer page advertises 6 A and 220/470 nH. The new one-page PDF has an embedded EUP3265 title and does not resolve revision identity. Neither changing L206 to 330 nH nor accepting 240 nH is justified yet. **Action:** Obtain fitted/sourced TCS4525_WT revision/lot confirmation, complete electrical/application data and an exact compatible model or characterized hardware. Qualify L206 value, lands, DCR, inductance versus current/temperature and losses. **Accept when:** Supplier or validated circuit evidence explicitly covers the selected 240 nH or a documented replacement across accepted corners. Preserve the historic 5 A analysis separately. Evidence: `references/power-wifi/tcs4525.txt`, `simulation/professional/models/README.md`, `simulation/professional/models/TCS4525_Ver.1.1_manufacturer.pdf`, `hardware/design-spec.json`.

- **P03-02 / high / confirmed_connectivity:** R227 shunt MPN and thermal derating remain open. Nominal run-0004 assumes 0.749997 A steady through R227, 7.49997 mV drop and 5.62496 mW; its modeled startup peak 4.677210 A gives 46.7721 mV/0.218763 W. At an illustrative 5 A it gives 50 mV/0.25 W. R228 = 100 Ω also bridges pre-shunt output to CPU_FB; with ideal R10/R229 joins this creates a small parallel path, about 0.5 mA at 50 mV, not the CPU load current. **Action:** Select and thermally derate the real shunt, verify post-shunt Kelvin routing/loop stability, and model finite feedback-join impedance and FB bias. Preserve the distinction between CPU power current and sense/parallel-path current. **Accept when:** Exact shunt continuous/pulse ratings and temperature coefficient cover accepted peaks; feedback transients and sense routing are validated. Do not populate a power-current result on R10/R229. Evidence: `simulation/data/runs/run-0004.json`, `hardware/03-cpu-01.kicad_sch`, `hardware/design-spec.json`, `simulation/data/native-netlist.xml`.

- **P03-03 / high / open_validation:** R226 = 51 kΩ ties CPU_EN to VCC3V3_PMU and C251 is unpopulated. R232 = 22 Ω ties CPU_VSEL to PMIC_SLEEP_H and R233 pulldown is DNP. CPU start therefore follows real PMU power/enable thresholds; it is not independently delayed by the model schedule. Retained VSEL defaults are 1.025 V low and 1.15 V high, subject to exact U3 revision and firmware configuration. **Action:** Establish reset/default and sleep/wake GPIO states, EN leakage/thresholds, DVS register programming and approved SoC operating points. Capture simultaneous PMU 3.3 V, EN, VSEL and CPU-rail startup/recovery. **Accept when:** Measured or exact-model sequence remains inside approved CPU voltages through startup, DVFS and sleep transitions. An SoC absolute maximum is never used as a normal DVFS target. Evidence: `references/power-wifi/tcs4525.txt`, `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt`, `hardware/03-cpu-01.kicad_sch`, `simulation/data/runs/run-0004.json`.

**Missing models:** Exact TCS revision/control/protection/DVS model, real L206 and R227 parameters, capacitor bias models and SoC activity-current envelopes are unavailable.

**Conditional future changes:** Resolve U3 revision before selecting or changing L206. Populate exact qualified L206/R227 BOM entries; preserve the post-shunt Kelvin function in any revision. Change enable/VSEL networks only if qualified startup/sleep evidence demonstrates a need.

## S04 — RK809-5 buck channels 1–4

Confirmed channel map: BUCK1/L201→VDD_LOGIC; BUCK2/L202→VDD_GPU; BUCK3/L203→VCC_DDR; BUCK4/L204→VDD_NPU. Each local output bank has two 22 µF capacitors plus 100 nF. R11/R12/R13 with 0 Ω feedback joins create sense paths; their current is not the respective SoC rail current.

**Startup:** Nominal run-0004 modeled 95% times: LOGIC = 5.230 ms, GPU = 9.135 ms, NPU = 13.040 ms, DDR = 16.945 ms. These are candidate sequenced RC responses, not observed PMIC OTP timings.

**Steady state:** Nominal run-0004: LOGIC = 0.894632 V/0.447315 A, GPU = 0.897845 V/0.179568 A, DDR = 1.342245 V/0.646264 A, NPU = 0.898562 V/0.119808 A. Combined run-0016: 0.891200 V/0.623838 A, 0.896459 V/0.251008 A, 1.337284 V/0.901426 A, 0.897636 V/0.167558 A respectively. These are aggregate assumed rail loads.

**Transient:** The available averaged model omits PMIC switching regulation, protection and real load spectra. In particular, same final voltages in a capacitance sweep do not establish COT-loop stability or DDR transient tolerance.

**EMI/EMC:** PMIC_SW1/2/3/4 summed track lengths are 2.328796/2.132159/1.725000/1.725000 mm, all F.Cu and zero vias. PMIC_FB_DDR has 10.316346 mm of track and 2 vias; feedback/ground coupling and real hot loops remain unvalidated.

**Thermal:** No exact winding loss model exists for L201–L204 and no full U2 loss map exists. Per-channel current capacities cannot all be converted into simultaneous allowable thermal loading.

**Findings and next-task acceptance:**

- **P04-01 / high / open_validation:** RK809-5 default voltages, power-good conditions, slots and protection settings remain unverified. Generic rated currents 2.5/2.5/1.5/1.5 A are capacity references, not measured current-limit thresholds. L201–L204 are generic 470 nH placements with no exact saturation or thermal ratings. **Action:** Obtain exact-5 OTP/register defaults and controller models or measurements, then select real inductors against actual peaks and hot saturation. Keep the generic RK809-1 sequence table out of the -5 boot proof. **Accept when:** Each output has exact source-qualified operating limits, a real inductor and supported startup/load/protection evidence; passed averaged regulation is not substituted for control validation. Evidence: `references/power-wifi/rk809-datasheet-v1.01.txt`, `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt`, `hardware/design-spec.json`, `simulation/data/runs/run-0004.json`.

- **P04-02 / high / calculated_tolerance:** R206 = 82 kΩ / R207 = 120 kΩ and retained external BUCK3 VFB = 0.800 V give 1.346667 V nominal. With 0.784–0.816 V feedback and 1% resistors, the static ideal range is 1.309125–1.384865 V before distribution/ripple. The low endpoint leaves 26.125 mV above ISSI DDR3L minimum of 1.283 V; this is not a complete transient margin. The engine instead uses a 1.350 V target. **Action:** Confirm exact-5 external-feedback mode and tolerances; replace the rounded DDR target in a future model with the qualified divider and reference. Combine tolerance, temperature, trace and dynamic losses at memory and SoC pins. **Accept when:** Preserve measured/modeled minimum and maximum DDR voltages against all consumers, including power-up; verify BUCK3 feedback-mode registers. Do not change resistors solely to erase a generic scenario failure. Evidence: `references/power-wifi/rk809-datasheet-v1.01.txt`, `references/soc-memory/issi-ddr3l.txt`, `hardware/04-pmic_bucks-01.kicad_sch`, `simulation/data/runs/run-0004.json`, `simulation/data/runs/run-0016.json`.

- **P04-03 / medium / open_validation:** The RK3566 guide requires BUCK1/2 output capacitance greater than 30 µF. The local 44 µF bulk alone retains 30.8 µF at 70% and 17.6 µF at 40%. Additional SoC capacitors are populated on each net, so 40% local retention is not proof of a complete-network violation; their frequency-dependent effectiveness depends on interconnect. R203 = 9.1 kΩ is a small load on the joined LOGIC feedback node, not a 1% output divider by itself. **Action:** Qualify biased/aged MLCC capacitance and extract local-plus-distributed impedance. Verify remote-sense noise and exact-5 control requirements instead of counting every capacitor as equally effective. **Accept when:** Document effective output capacitance and measured/modelled impedance and transient response over the required bandwidth; keep remote-sense branches and R203’s actual connectivity in the model. Evidence: `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt`, `simulation/data/native-netlist.xml`, `hardware/design-spec.json`, `hardware/04-pmic_bucks-01.kicad_sch`.

**Missing models:** Exact RK809-5 OTP/COT/protection models; L201–L204 hot inductance/DCR/core loss; capacitor bias/ESL and SoC/DDR activity currents.

**Conditional future changes:** Qualify L201–L204 and MLCC procurement data. Update the DDR simulation target/tolerances only after exact-5 feedback mode is confirmed; propose resistor/copper changes only for demonstrated margin shortfalls.

## S05 — RK809-5 buck channel 5 / 1.8 V

Confirmed: U2 SW5/L205 feeds VCC_1V8; R210 = 0 Ω connects output to FB5 and R211 is DNP. C218/C219 total 44 µF plus C220 = 100 nF locally. VCC9 also feeds SWOUT1, coupling this channel’s input demand to the shared preregulator and switched 3.3 V path.

**Startup:** Nominal run-0004 reaches 95% at 9.135 ms under the candidate slot arrangement. Actual BUCK5 timing and run/sleep voltage are not known.

**Steady state:** Nominal run-0004 VCC_1V8 = 1.798561 V/0.119904 A; combined run-0016 = 1.797633 V/0.167779 A. Neither constitutes a verified memory/IO activity envelope.

**Transient:** Load-step interactions with SWOUT1 and the upstream U7 converter are not represented by a qualified multi-controller model; output capacitance must include actual interconnect.

**EMI/EMC:** PMIC_SW5 has 1.725000 mm F.Cu track and zero vias. This connectivity fact does not supply loop inductance, return distribution or emission amplitude.

**Thermal:** No L205 or per-channel U2 thermal result exists. The generic 2.5 A capacity is not a thermal budget for this board.

**Findings and next-task acceptance:**

- **P05-01 / high / open_validation:** The board relies on a programmed/default 1.8 V BUCK5 setting. The retained generic RK809 table lists a 2.2 V default; that is not proof the actual -5 outputs 2.2 V, but shows why substituting generic defaults would be unsafe for a 1.8 V net. R210/R211 do not independently set 1.8 V with an external divider. **Action:** Obtain exact-5 BUCK5 OTP and run/sleep settings; verify 1.8 V before SoC/DDR IO operation and after reset. Keep R211 DNP unless an explicitly qualified circuit revision requires it. **Accept when:** The correct-variant data and measured startup/sleep voltage establish the approved 1.8 V range before firmware can intervene. Evidence: `references/power-wifi/rk809-datasheet-v1.01.txt`, `hardware/design-spec.json`, `hardware/05-pmic_bucks-02.kicad_sch`, `simulation/data/runs/run-0004.json`.

- **P05-02 / medium / open_validation:** L205 = 470 nH is not an identified current-rated component. The 2.5 A channel capacity and 44 µF local nominal bulk do not establish inductor saturation, mounted capacitance or current-mode regulator stability. C217 input bypass appears on sheet 04 because the PMIC units share VCC9. **Action:** Qualify the inductor and output network and include VCC9 shared-source impedance/load transitions with SWOUT1. **Accept when:** Acceptable current/temperature ratings, stable output transients and input decoupling are supported at the real system activity envelope. Evidence: `hardware/design-spec.json`, `simulation/data/native-netlist.xml`, `references/power-wifi/rk809-datasheet-v1.01.txt`, `hardware/04-pmic_bucks-01.kicad_sch`, `hardware/05-pmic_bucks-02.kicad_sch`.

**Missing models:** Exact BUCK5 OTP/current-mode controller/protection model, L205/MLCC models, dynamic loads and shared-input impedance.

**Conditional future changes:** Select L205 and qualified capacitance; confirm exact-5 run/sleep programming before proposing any feedback-population change.

## S06 — RK809-5 LDO and switched outputs

Confirmed: VCC6 pin 30 now receives 5V_SOC through its own C222 bypass. VCC5/VCC7/VCC8 remain on VCC_3V3_SBC. LDO3 supplies VDDA0V9_PMU; R212 joins VCCA1V8_PMU to VCCIO_WL. VCC_3V3 and VCC3V3_SD are pass-switch outputs, not independently regulated 3.3 V rails.

**Startup:** Candidate run-0004: low-voltage LDOs are grouped at 5.23/9.135/16.945 ms; VCCIO_SD and VCCIO_ACODEC are last to 95% at 20.85 ms. Actual slots and IO-before-core constraints remain unverified.

**Steady state:** Combined run-0016 keeps VCC3V3_PMU = 3.298520 V, VCCIO_SD/ACODEC = 3.299408 V; its switched outputs fall to 3.243706 V and 3.266654 V. LDO dropout and pass-switch voltage loss are distinct mechanisms; actual source/current tolerances are not fully covered.

**Transient:** Shared-input droop, LDO stability, output discharge and reverse/back-power behavior need exact models or measurement. The populated output bypasses are mostly 1 µF, with 4.7 µF on ACODEC and 22 µF on each switch; printed values alone do not give effective capacitance.

**EMI/EMC:** LDOs may attenuate some conducted ripple but no frequency/load PSRR model is supplied. Switching and IO return-current coupling across shared PMIC grounds remains an open layout/EM task.

**Thermal:** At 5.0 V→3.3 V, each 100 mA LDO contributes 0.17 W; three hypothetical 400 mA loads would give 2.04 W before all other PMIC losses. The retained generic document specifies 2 W power and below 125 °C absolute junction temperature, so simultaneous capacity maxima are not an acceptable assumed budget.

**Findings and next-task acceptance:**

- **P06-01 / high / open_validation:** Feeding VCC6 from 5V_SOC provides real headroom for the three 3.3 V LDO outputs. It also adds heat: summing (Vin−Vout) × saved aggregate I over all nine LDOs gives 0.484703 W in nominal run-0004 and 0.629665 W in combined run-0016, excluding quiescent, buck, switch and codec losses. These are load-assumption-dependent losses, not U2 temperature predictions. **Action:** Establish per-LDO activity currents and the complete PMIC loss/thermal budget. Check 5 V tolerance, actual dropout and powered-off behavior; preserve the intentional VCC6/RTC input arrangement unless a qualified redesign changes it. **Accept when:** Validated losses and mounted-board temperatures meet derated limits. Do not transplant generic thetaJA = 21.99 °C/W from its 114×76 mm four-layer test board onto this 55×55 mm design as a solved temperature. Evidence: `simulation/data/runs/run-0004.json`, `simulation/data/runs/run-0016.json`, `references/power-wifi/rk809-datasheet-v1.01.txt`, `power-revision/regulator-source-qualification.md`, `hardware/design-spec.json`.

- **P06-02 / high / source_conflict:** The applicable guide and RK809 electrical table identify LDO3 as 100 mA; other LDOs are nominally 400 mA under specified conditions. The generic sequence table has inconsistent LDO numbering/rating entries and cannot override the electrical pin/channel table or exact-5 data. Each LDO voltage and default remains an OTP/configuration dependency. **Action:** Use the exact channel/pin mapping and qualified load limits. Count VCCIO_WL downstream demand once inside LDO8’s VCCA1V8_PMU source load, and verify 1.8 V IO compatibility and timing. **Accept when:** Per-channel requirements and model limits agree with supplier data and measured loads; neither model inventory coverage nor generic 400 mA labels substitute for this evidence. Evidence: `references/power-wifi/rk809-datasheet-v1.01.txt`, `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt`, `simulation/data/native-netlist.xml`, `hardware/06-pmic_ldos-01.kicad_sch`.

- **P06-03 / medium / source_conflict:** The RK3566 guide gives both -5 switches 2.1 A with 90/100 mΩ on-resistance, while generic RK809 gives 1.5 A/3 A. Nominal run-0004 models VCC_3V3 = 3.265843 V/0.178136 A and VCC3V3_SD = 3.279888 V/0.019878 A. Both startup currents touch an assumed 2.1 A ceiling; that is not an observed current-limit threshold. **Action:** Resolve exact-5 rated/limit currents and hot on-resistance; combine preregulator tolerance with switch/trace drop and real downstream inrush. **Accept when:** Qualified consumer-pin limits and allowed inrush are met across source, load and temperature corners; keep the unresolved rating conflict visible until resolved. Evidence: `references/power-wifi/rk809-datasheet-v1.01.txt`, `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt`, `simulation/data/runs/run-0004.json`, `simulation/data/runs/run-0016.json`.

**Missing models:** Exact LDO/switch OTP, dropout/PSRR/reverse-conduction/discharge models, complete PMIC loss map, mounted thermal transfer and actual activity currents.

**Conditional future changes:** Retain the headroom correction while qualifying losses and exact bypass parts. Resolve actual-5 switch and LDO settings before changing source voltages, output capacitors or power-domain sequencing.

## S07 — PMIC supervision, I2C, reset and 32 kHz

Confirmed: VCC_RTC pin 45 is on 5V_SOC with C236; C237 bypasses PMIC_VREF. R222 = 100 kΩ / R223 = 33 kΩ and C242 = 100 nF drive VDC. R221 = 10 kΩ pulls RESETn to VCC3V3_PMU; C240 and cross-sheet C82 each add 100 nF. R238 joins SoC TSADC_SHUT_M0 to RESETn. R220 is DNP, isolating the optional PMIC clock export to the SoC.

**Startup:** Nominal run-0004 first modeled stable-rail time 20.850 ms and requested release 40.000 ms leave 19.150 ms modeled margin. Actual VDC/RTC/clock startup and the 200 nF reset network are separate unresolved timing contributors. POWER_KEY uses R225 = 100 Ω, C241 = 100 nF and the PMIC internal pull-up; guide button thresholds are 500 ms power-on, 6 s forced-off and 20 ms sleep/wake. The engine defines startup peak windows up to the requested reset_release_ms, even when its ideal supervisor delays the actual RESETn transition; modeled activity also starts from the requested time. These labels do not demonstrate physical or firmware startup state.

**Steady state:** Static resistor calculations describe only forced states, not switching histories: R217 = 10 kΩ pulls interrupt to 3.3 V; R218 = 10 kΩ pulls the open-drain clock to 1.8 V. PWRON, INT, I2C and reset currents depend on actual device states and are not assigned fabricated waveforms.

**Transient:** Saved slow-start run-0011 and early-reset run-0012 fail their requested release timing; brownout run-0014 is an intentional negative case. These check the candidate supervisor and do not show the fitted PMIC actually resets/restarts as modeled.

**EMI/EMC:** The weak 32 kHz crystal loop and high-impedance VDC/feedback nodes require switch-coupling/return review. PMIC_VDC routing includes 6 vias and 6.985391 mm of track; this is geometry evidence, not an EMI failure.

**Thermal:** The reset/TSADC path must cause the intended low assertion before thermal damage, but it is not a simulated thermal protection loop. Actual PMIC/SoC thresholds, firmware configuration and temperature are unverified.

**Findings and next-task acceptance:**

- **P07-01 / high / calculated_network:** The native VDC divider gives 1.240602 V at 5 V, Thevenin 24.812 kΩ and tau 2.481203 ms. Ignoring input loading, a 5 V step crosses the documented 0.55 V startup trigger after 1.453461 ms. The corresponding static input is 2.216667 V. RK809 describes rising-edge startup triggering; this network is not a qualified undervoltage/brownout supervisor. **Action:** Model the real source ramp, VDC threshold/leakage and RTC/input readiness. Verify slow ramp, insertion, interrupted ramp and brownout/recovery behavior on the exact PMIC. **Accept when:** All required source trajectories start and recover correctly with proven reset behavior; never substitute 2.2167 V VDC triggering for recommended supply or brownout limits. Evidence: `references/power-wifi/rk809-datasheet-v1.01.txt`, `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt`, `hardware/07-pmic_control-01.kicad_sch`, `simulation/data/runs/run-0016.json`.

- **P07-02 / high / open_validation:** RESETn sees 200 nF total from C240+C82, so R221 gives 2.000 ms ideal pull-up RC, 4.394 ms for a 10–90% rise and 2.408 ms to 70% of its final voltage after release. With the model’s 70% capacitance factor tau would be 1.400 ms. Saved RESETn is an ideal digital event and omits this analog net. The guide requests 100 nF near reset pins, so deleting either capacitor solely to speed the edge is not justified. **Action:** Correlate reset low/high thresholds, allowed edge rate, PMIC sink/leakage and both capacitance sites with the real power sequence. Verify thermal/watchdog assertion is low as required and no competing high drive exists. **Accept when:** Measure both PMIC and SoC reset pins; cold reset remains asserted at least 10 ms after the final valid rail, and asserts before PMUIO1 falls below 2.93 V. Keep warm-reset 100-cycle and analog-threshold requirements distinct. Evidence: `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt`, `references/power-wifi/rk809-datasheet-v1.01.txt`, `simulation/data/native-netlist.xml`, `hardware/07-pmic_control-01.kicad_sch`, `hardware/17-soc_clock-01.kicad_sch`, `simulation/data/runs/run-0004.json`.

- **P07-03 / medium / calculated_network:** R215/R216, each 2.2 kΩ, pull I2C to PMU 3.3 V. At 3.3 V a held-low line draws up to 1.5 mA ignoring VOL; at VOL = 0.4 V it draws 1.318 mA before small series drops. With a simple RC and the 300 ns Fast-mode rise limit, 2.2 kΩ permits about 160.94 pF total bus capacitance, not automatically the 400 pF protocol maximum. No bus capacitance or executed PMIC/CPU transactions are supplied. **Action:** Measure or extract total pin/route capacitance, confirm configured speed and sink thresholds, and test PMIC/CPU access through startup and sleep. Preserve domain-voltage compatibility and account for 22 Ω series resistors. **Accept when:** Observed rise/fall/setup/hold and low-level voltages meet every connected device’s mode requirements; executed transactions confirm address/configuration behavior. Evidence: `references/power-wifi/rk809-datasheet-v1.01.txt`, `references/power-wifi/tcs4525.txt`, `simulation/data/native-netlist.xml`, `simulation/section-review/power-review.md`.

- **P07-04 / medium / open_validation:** Y201 has no exact crystal MPN/CL/ESR. C238/C239, each 22 pF, form an ideal 11 pF series load plus pin/stray capacitance; this does not identify the correct crystal. Native PMIC_XIN/XOUT track totals are 5.123553/8.334214 mm, both F.Cu with no vias. R220 DNP means the SoC does not receive the optional PMIC_CLK32K signal through that link. **Action:** Select the crystal and validate load/ESR/start margin and routing coupling. Confirm the chosen SoC clock mode and firmware assumptions. Probe a buffered clock rather than loading the weak crystal pins. **Accept when:** Qualified oscillator start/frequency and intended SoC clock mode are documented across temperature and voltage; no measured-clock claim is made from static connectivity. Evidence: `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt`, `references/power-wifi/rk809-datasheet-v1.01.txt`, `hardware/design-spec.json`, `hardware/rk3566-sbc.kicad_pcb`.

**Missing models:** Exact PMIC OTP/VDC/reset/button/clock model, SoC reset input thresholds/edge constraints, mounted crystal parameters, bus capacitance and executed boot/I2C firmware.

**Conditional future changes:** Add the full RESETn RC/receiver model before considering any reset capacitor or pull-up change. Choose Y201 and verify capacitor loading and SoC clock configuration. Treat VDC divider changes as startup-system changes requiring source-ramp and recovery evidence.

## S08 — Unused PMIC codec bias and supply support

Confirmed: FB201 connects 5V_SOC to U2 VCC_SPK_HP with C243 = 10 µF bypass. C244 = 2.2 µF connects CPN/CPP; C245 = 1 µF and C246 = 2.2 µF bypass positive/negative charge-pump nodes; C247/C248 each 1 µF bypass internal 1.8 V digital/analog nodes. Speaker/headphone outputs are unconnected; MCLK/SDI and microphone/sense inputs have deliberate ground connections. LRCLK/BCLK have 100 kΩ pulldowns R239/R240.

**Startup:** The audio input follows 5V_SOC through a ferrite, independently of PMIC output enables. Its modeled 95% time 0.965 ms and 97.835 mA nominal peak reflect an assumed branch charging/load network; internal pump and bias startup have no supplied waveforms. Startup peak labels use the requested reset-release window, not a measured boot phase (see S07).

**Steady state:** There is no external speaker/headphone load on these PMIC output pins. The separate board audio codec/amplifiers are other sections; their supply currents must not be conflated with unused RK809 audio current.

**Transient:** Flying-capacitor commutation, bias sequencing and codec-disable transitions are unmodeled. A continuous audio input voltage does not establish that internal negative/positive bias rails are valid.

**EMI/EMC:** Native CPN/CPP tracks total 1.978112/1.874558 mm, F.Cu with zero vias. Ferrite impedance and local pump-return current are required before calculating attenuation or coupling into clocks/analog circuitry.

**Thermal:** No complete idle/charge-pump/analog dissipation or PMIC temperature is known. Generic 1.3 W Class-D output capability is irrelevant to unconnected speaker pins and cannot be used as heat here.

**Findings and next-task acceptance:**

- **P08-01 / medium / confirmed_connectivity:** The codec being unused does not make its internal bias/charge-pump support optional. Some I2S pins can be outputs in master mode, so 100 kΩ LRCLK/BCLK pulldowns are compatible with that possibility; they are not measured activity loads. Unused analog output pins remain unconnected and should not be assigned speaker-power results. **Action:** Obtain exact-5 unused-codec/bias recommendations and firmware reset/disable states before removing supply, flying capacitors or bias components. Keep each mandatory bypass and unused-pin disposition explicit. **Accept when:** Supplier/application guidance and current/bias measurements support the selected inactive configuration with stable internal rails and no forced output contention. Evidence: `references/power-wifi/rk809-datasheet-v1.01.txt`, `simulation/data/native-netlist.xml`, `hardware/08-pmic_audio-01.kicad_sch`, `hardware/design-spec.json`.

- **P08-02 / medium / open_validation:** FB201 is only specified as 120 Ω@100 MHz/2 A; its exact impedance-versus-frequency/DC-bias and DCR are unknown. The model assumes 50 mΩ and a small codec load: nominal run-0004 audio input 4.848221 V/1.939 mA, combined run-0016 4.248525 V/2.379 mA. These are declared load results, not measured idle current. The combined 4.5 V system-floor failure does not violate the generic VCC_SPK_HP 2.7–5.5 V recommended range by itself. **Action:** Select the exact ferrite against actual idle/startup/charge-pump current and required attenuation, measure bias settling and conducted noise, and confirm whether the system truly requires 4.5 V on this unused-audio branch. **Accept when:** Supported DC/RF impedance, voltage margin and observed inactive current/noise justify the selected part and system limit. Do not remove the rail merely to eliminate a scenario flag. Evidence: `references/power-wifi/rk809-datasheet-v1.01.txt`, `simulation/data/runs/run-0004.json`, `simulation/data/runs/run-0016.json`, `hardware/design-spec.json`.

**Missing models:** Exact unused-codec register/default behavior, pump/bias dynamics, actual standby current and FB201 impedance/current/temperature curves.

**Conditional future changes:** Select FB201 from supported impedance/current data. Retain required support components until exact-variant guidance and measurement support a documented reduction.

## Delivery gate for a future PCB task

Start with exact U3/RK809-5 identities and system source/load specifications. Then qualify inductors, shunt and biased capacitor models, reconcile the DDR divider and reset/VDC behavior, and validate coupled regulator, sleep/recovery and thermal operation. Prepare a reviewable proposed circuit/copper change only where those results demonstrate a real shortfall. Preserve nominal run-0004, combined run-0016 and the original source hashes, and rerun every accepted normal corner plus the retained negative tests.

This review does not establish executed RK3566 boot, complete component current waveforms, board temperatures or EMC compliance. The current [professional review](../PROFESSIONAL_REVIEW.md) and [next-agent handoff](../NEXT_AGENT_HANDOFF.md) retain the unresolved release gates. An improved coverage report, interface or assumption set is not evidence that the physical PCB improved.
