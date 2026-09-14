# Next task: evidence-based RK3566 PCB revision proposal

Prepared 14 September 2026. **This is the brief for a future task. Preparing this file did not create another task or change the PCB, schematic, BOM, firmware, models or saved runs.**

Start from the frozen RK3566 SBC revision 4 below. Resolve the documented model/source inconsistencies, evaluate all 26 schematic sections and 94 findings, and produce an isolated, reviewable next-revision proposal containing only justified circuit, part, layout and documentation changes. Preserve the baseline and explain the before/after result for every proposed change. Complete work that is possible from the supplied evidence; explicitly carry forward manufacturer, upstream-board or bench dependencies that cannot yet be closed.

The current assessment accounts for **422 electrical references, 405 populated parts, 17 DNP parts and all 1,890 physical pins**, plus four mechanical holes. Coverage is an inventory achievement; it does not establish valid component currents, executed boot, temperatures or EMC compliance. **Professional validation readiness remains 2.5/10 under PRV-1.** This file does not authorize fabrication, purchasing or release.

All paths are relative to `rk3566-sbc-rev4/`. The originating workspace is `/home/candy/eyecandy/general-electronics/radxa-cm3-carrier-board/design-revision/rk3566-sbc-rev4`.

## Frozen starting point

| Artifact | Preserved identity |
|---|---|
| Native PCB | `hardware/rk3566-sbc.kicad_pcb` |
| PCB SHA-256 | `3ba4da7036173e31941ea22b041d1a2a3433c2bcdedccf1a75b1f52b31ce2807` |
| Engine | `simulation/engine.py`, version 1.0.0 |
| Engine SHA-256 | `e8981c307ede683836aa755d9e1bb3d182be0e42a5bc07f471682becbed18c2c` |
| Nominal campaign reference | `simulation/data/runs/run-0004.json`, 5.00 V input |
| Selected analysis reference | `simulation/data/runs/run-0027.json`, 4.75 V input; a distinct saved case |
| Complete frozen campaign | 13 cases: `run-0004` through `run-0016`; four fail scenario checks |
| Native/component/section ledger | `simulation/data/section-analysis.json` |
| Design-input manifest | Its `source_hashes`: **36 preserved design-input hashes**, verified unchanged during this analysis |
| Additional analysis provenance | Its `analysis_input_hashes`: **24 hashes** covering extracted data, models, saved runs and section-review JSONs |

Run-0004 uses 120 mΩ source resistance, load scale 1.0, effective-capacitance factor 0.7, 25 °C ambient, a 1.39 ms soft-start parameter, requested reset release at 40 ms, a 5 µs integration step and 160 ms duration. Run-0027 uses the same values except 4.75 V input. Their steady measurement window is 128–160 ms. These are declared behavioral assumptions, not characterized IC operating profiles.

**Startup-window correction to carry forward:** saved component startup metrics end at the *requested* reset time, usually 40 ms. They may omit later physical startup or the candidate supervisor's delayed transition. The engine also begins its activity ramp from the requested time. `rail.peak_current_a` spans the complete experiment; it is different from the startup-window peak. Preserve historical records and fix the future model/window labels and activity policy with separate requested, simulated-actual and measured reset states.

The earlier [NEXT_AGENT_HANDOFF.md](NEXT_AGENT_HANDOFF.md) contains H01–H09 and older snapshot identities, including run-0019. Keep that history; this new section-review task uses run-0004 and run-0027 as its explicit reference cases.

## Work order and change discipline

1. **Verify and preserve the complete working-tree baseline.** A Git HEAD checkout may omit the frozen uncommitted hardware. Create an isolated proposal from the hash-matched files, preserve its starting manifest, and keep original run/data artifacts immutable. Record branch/copy location and all new hashes.
2. **Close supported source/annotation errors and model gaps first** in the proposal. Distinguish a documented maximum, typical value, operating requirement, absolute maximum, assumed parameter and measured waveform. Recompute consumer-specific margins before judging copper.
3. **Resolve system requirements and exact part identities.** The MCU-board sources, harness, intended camera/display/speakers, operating frequencies, power modes, ambient/airflow, enclosure and product EMC target are inputs, not choices to invent silently. Independent source, firmware, SI and thermal packages can proceed in parallel.
4. **Select physical changes only from a demonstrated need.** Provide affected references/nets, exact replacement ordering code or native geometry, authoritative source, calculation/extraction, risks and acceptance criteria. A source/data correction may close a finding without moving copper. Keep unresolved candidates separate from implemented proposal changes.
5. **Rerun native and numerical checks against the new identity.** Preserve connectivity, intended DNP/unused-pin handling, mechanical fit, return paths and approved fabrication constraints. Evaluate changes at every affected interface and load, including powered-off states; retain original negative scenarios.
6. **Issue a reviewable before/after package.** Supply schematic/PCB/BOM/firmware/model diffs, new data, source references, a 94-ID disposition register and an honest release recommendation. Do not merge or replace the frozen design as part of merely preparing the proposal.

Do not tune arbitrary thresholds or loads to reach 8/10. Do not tighten every DRC rule, add serpentine to every DDR net, equalize trace lengths without delay criteria, delete reset capacitors to improve a digital timing chart, or move parts because an illustrative field map has a bright pixel. Do not assign a whole rail's current to every IC or infer a heatmap from L219's assumed thermal node. Unknown quantities remain unknown.

## Priority packages

### N01 — Correct supported ratings, limits and load accounting first

**Type:** source/BOM annotation and model correction; physical substitutions are conditional. **Priority:** P0.

- **FB140–FB143 / speaker outputs:** native text says `600R@100 MHz 2 A`; the exact **BLM21PG601SN1** catalog row gives **1.4 A and 0.14 Ω maximum DCR**. Retain the source and obtain the current supplier approval sheet. Correct the incorrect 2 A annotation in the proposal, or choose a different part only after actual BTL current, thermal and impedance requirements justify it. The discrepancy alone does not prove overload. Finding `s24-bead-rating`.
- **FB120 / camera AF and FB130 / codec analog supply:** **BLM18AG601SN1 maximum DCR is 0.38 Ω**, while the saved model assumes 0.1 Ω. Add the source-supported maximum corner; retain any nominal resistance only with a clear basis. At an illustrative 120 mA, 0.38 Ω gives **45.6 mV / 5.47 mW** on AF. At 35 mA it gives **13.3 mV / 0.466 mW** on the codec branch. These are DC corner calculations, not observed actuator/codec dissipation. Findings `s22-rail-af-envelope`, `s23-bead-dcr`.
- **U110 / VL53L5CX / 3V3_PER:** the model's **130 mA shared non-codec allowance** is already equaled by ST's **130 mA combined active-ranging maximum for the sensor alone**; display and oscillator demand also share the rail, and peak behavior needs its own profile. Build a disjoint per-load budget, including externally supplied demand and mode-dependent peaks. Give the sensor its **3.0–3.6 V operating window** instead of accepting the shared generic upper bound of 3.63 V. Findings `s21-current-budget`, `s21-voltage-window`.
- **Camera core / CAM_1V5:** replace the generic **1.35–1.65 V** acceptance window with the selected camera specification's **1.425–1.575 V** range, after confirming the exact module variant. Check source tolerance and ramp/overshoot at the receiving pins; changing a checker is not evidence that the actual source violates its requirement. Finding `s22-rail-af-envelope`.
- **Metrics and loads:** correct requested-reset window semantics described above, retain explicit assumed aggregate currents, and avoid double counting downstream branches or assigning pull-up/calibration currents from nonexistent signal states. Apply source-qualified limits per consumer rather than one ±10% test for every rail.

**Done when:** each changed field has a source/revision and nominal-versus-corner meaning; regression tests catch the actual old mismatch; original cases remain preserved; accepted operating and stress scenarios use the corrected limits and non-overlapping load budget. Any newly exposed failure leads to N02–N07 investigation before a component/copper decision.

Primary-source links retained by the section review: [Murata BLM21 catalog row](https://www.murata.com/-/media/webrenewal/tool/library/common-pdf/static-model/component-list-fb-s-2602.ashx?cvid=20260515010000000000&la=en-sg), [Murata BLM18AG601SN1](https://www.murata.com/en-us/api/pdfdownloadapi?cate=cgsubChipFerriBead&partno=BLM18AG601SN1%23), [ST VL53L5CX](https://www.st.com/resource/en/datasheet/vl53l5cx.pdf), [selected KLT camera specification](https://kailaptech.net/KLT/EN/PDF/KLT-H7MA-OV5647%20V1.0%205MP%20OmniVision%20OV5647%20MIPI%20Interface%20Auto%20Focus%20Camera%20Module.pdf). Detailed context is in [peripheral-review.md](section-review/peripheral-review.md).

### N02 — Define cross-board power, interface and off-state behavior

**Type:** system/source and firmware contract, followed by conditional isolation or sequencing changes. **Priority:** P0.

J120 supplies `5V_SOC`. J121 supplies five external rails (`3V3_PER`, `1V8_AUDIO`, `CAM_1V5`, `CAM_1V8`, `CAM_2V8`), while **J121.6 / VCC_3V3 is a sequenced output**. Document each source's tolerance, resistance/current allocation, enable handshake, ramp, discharge, shutdown and absent-board behavior. Model J121 independently from J120; ideal simultaneous external rails do not verify the intended MCU handshake.

In combined run-0016, 4.75 V input and 250 mΩ assumed source resistance produce **4.248665 V at 2.005341 A**, with approximately **0.501335 V drop and 1.005348 W path loss**. That is a declared 4.5 V system-floor failure, while U3/U7 input checks still pass. Partition cable/connector/board losses and establish real consumer requirements before redesigning the source or changing the floor.

Review every power-order combination for U1 IO banks, MCU UART/control signals, ToF/codec/host I²C and camera connections. U120 PCA9306 is permanently biased from 3V3_PER through 200 kΩ, with VREF1 on CAM_1V8; use the actual external regulator's sink/off-state behavior to determine whether an EN-disable, bleed or isolation change is necessary. U100/U121–U123 Ioff capability does not by itself guarantee correct enables and timing throughout rail ramps. Protect the external-console procedure: populated R50 must be isolated before an external transmitter drives SoC RX.

**Done when:** a pin-by-pin inter-board contract covers startup, runtime, suspend, shutdown, partial power, removal and fault recovery; no receiving pin exceeds its powered/off limits or creates unsupported back-feed. Proposed protection/enable changes have exact device limits and verified behavior. Related findings: `s20-*`, `s21-i2c-rise-off-state`, `s22-translator-backbias`, `s22-buffer-sequence`, `s23-codec-sequence`, `DG10-03`, `DG18-02`, `s25-vbus-detector`.

### N03 — Qualify power devices, PMIC defaults and analog reset

**Type:** supplier/model acquisition, component qualification and measurement; conditional power-circuit changes. **Priority:** P0.

Obtain exact **RK809-5 OTP/defaults**, feedback modes, enables, voltage settings and protection behavior. Do not import the generic RK809-1 startup table. Resolve switch-current references of 2.1 A versus generic 1.5/3 A; retain the electrical-table **100 mA LDO3** mapping. Confirm BUCK5's intended 1.8 V before firmware runs. Preserve the intentional VCC6/RTC connection to 5V_SOC while checking headroom and losses. Nine modeled LDOs alone dissipate **0.484703 W in run-0004** and **0.629665 W in run-0016**, excluding PMIC quiescent, buck, switch and codec losses. These values cannot be converted directly into board temperature using generic package thetaJA.

Resolve the **TCS4525 revision conflict**: retained Ver. 1.0 supports 5 A and 330/470 nH, whereas the later manufacturer page advertises 6 A and 220/470 nH; its one-page brief does not qualify the actual fitted silicon. Do not automatically replace or approve **L206 = 240 nH**. Qualify its actual MPN and hot/current characteristics, plus L201–L205, shunt R227 and MLCC effective capacitance. CPU Kelvin output at exactly 1.025 V is presently a surrogate; actual VSEL/EN/DVS behavior must follow qualified U3 and SoC data.

For **R206 = 82 kΩ / R207 = 120 kΩ**, the retained BUCK3 external reference gives **1.346667 V nominal** and **1.309125–1.384865 V** for the stated reference/1% resistor corners. The low endpoint leaves **26.125 mV** above the retained DDR3L minimum before trace/ripple/transient effects. Confirm external-feedback mode, then correct the rounded 1.350 V model target and evaluate both SoC and DRAM pins. Do not change the divider simply to improve a nominal chart.

Model the complete **RESETn** network: **R221 = 10 kΩ, C240 + C82 = 200 nF**, giving **2.0 ms ideal RC and 4.394 ms 10–90% rise**. Both local capacitors remain until exact source guidance justifies a change. Account for PMIC open-drain sink/leakage, SoC thresholds and TSADC/watchdog assertion. R222/R223/C242 give a **2.481203 ms VDC time constant** and **1.453461 ms ideal 0.55 V trigger crossing after a 5 V step**; VDC is not a substitute for a qualified brownout supervisor. Verify cold reset for at least 10 ms after the last valid rail and assertion before PMUIO1 falls below 2.93 V; keep warm-reset and DRAM protocol requirements separate.

**Done when:** exact sourced parts/defaults and accepted activity profiles support startup, load steps, sleep, brownout and recovery at all relevant corners. Any circuit change has its own stability/current/thermal evidence. Obtained but encrypted/unrun TPS566242 PSpice files are not a completed controller simulation. All 16 ICs still lack qualified internal dynamic models used by the current study. Related findings: `P02-*` through `P08-*`, `DG09-*`, `DG16-*`, `DG17-03`.

### N04 — Validate DDR, eMMC and physical return paths before routing changes

**Type:** stack/package/channel and firmware evidence, followed by targeted SI/PI changes. **Priority:** P0 for boot feasibility, P1 for implementation.

Preserve the checked **2 GiB, two-x16, x32 single-rank** DDR mapping and all native endpoints. Obtain the approved memory rate, loader configuration, package delays/models and fabrication stack. Evaluate address/command/clock at both DRAM loads and read/write DQ/DM/DQS timing per byte, including ODT, VREF and actual training capability.

Priority geometry is a reason to investigate, not a timing failure by itself:

- **DQS1:** closely matched 33.349/33.329 mm paths nevertheless traverse **3 versus 8 via objects** and different layer allocations. Assess a more symmetric topology and the approximately 7.9 mm uncoupled copper per leg.
- **Byte 3:** DQ/DM paths span 11.758–29.544 mm, a **17.786 mm spread**; DQ31 has the largest positive equal-velocity offset. Moving both DQS legs does not reduce that data spread. Do not apply blanket serpentine without package-aware timing and training limits.
- **DQS2 and DQS3:** verify return transfers and coupling; the reported 0.127/0.165 mm P/N geometry differences are not sourced electrical failure thresholds. Preserve useful short, direct topology unless channel evidence supports changing it.
- **CA/clock and references:** investigate long A1 routing, clock uncoupled regions, and finite-width ground-edge losses under DDR3_BA2 and DDR3_DQ11. A covered centreline or a bookkeeping transition neighborhood does not prove adequate return impedance.
- **eMMC:** D0–D7 host paths span 14.263–21.704 mm, a **7.441 mm spread**, while CMD is 33.448 mm and strobe 25.697 mm. Include SoC package, connector and actual removable module traces, R14, pulls and TP62/TP63 loading. Select the 8/16 GB module SKU and transfer mode before tuning host copper.

DDR3_RESETn has no executed protocol in the existing model: obtain/capture at least **200 µs reset with stable DRAM power and 500 µs before CKE**, followed by the complete required initialization/calibration sequence. Keep `DDR3_VREFCA` and `DDR_VREFOUT/VREFDQ` as distinct sources; the SoC ZQ and DRAM ZQ resistors are calibration networks, not continuous V/R loads. Include the selected industrial DRAM's temperature-dependent refresh policy.

**Done when:** every accepted memory channel has source-based timing/noise criteria, package/stack-aware evidence or correlated bench results, supported firmware and successful training/stress/storage tests. Resolve all retained DRC findings by justified correction or documented scope, without hiding or weakening checks. Related findings: `DG11-*` through `DG18-*`, `s26-emmc-probe-loading`, `s27-vref-separation`.

### N05 — Establish clocks, peripheral sequencing and real boot/recovery

**Type:** exact-part sourcing and firmware/bench validation; conditional control/clock changes. **Priority:** P1, in parallel with N03/N04.

Select actual Y1 24 MHz, Y201 32.768 kHz and Y202 37.4 MHz crystals and qualify load capacitance, ESR, drive level, start margin and temperature range. Capacitor labels do not establish operating load: Y1's two 18 pF parts give 9 pF series load before stray; Y201's two 22 pF parts give 11 pF; Y202's two 8 pF parts give 4 pF. R220 DNP leaves the optional PMIC-to-SoC 32 kHz export disconnected. Review Y120's exact oscillator/output enable and the camera rail/reset/PWDN/MCLK contract. Avoid loading weak crystal pins with an unsuitable probe.

Implement and verify SoC IO-bank settings, CPU DVFS, Wi-Fi/BT GPIO ownership and wake directions, display transmit-only SPI pinmux, codec clock-master/reset order and ToF recovery. Wi-Fi needs the vendor's **150 ms internal-supply-to-SDIO delay and 10 ms off interval**; an external supply waveform alone cannot prove it. Determine whether ToF needs controllable LPn or an independent power switch from the actual recovery requirement. The KLT camera is a specific connector/module interface, not a generic Pi-camera substitute.

Document UART direction and R50 isolation, USB device-only operation, RECOVERY-button behavior versus true Maskrom recovery, available boot straps, and the absence of accessible JTAG/direct eMMC reset where native pins are NC. Demonstrate cold/warm boot, corrupt-media recovery and restart under partial power with serial/loader logs.

**Done when:** exact clock/peripheral parts and configuration are documented, required oscillator/sequence margins are verified, and actual boot/training/peripheral/recovery executions are retained. No boot success is inferred from the 40 ms diagram. Related findings: `P07-*`, `DG10-*`, `DG12-*`, `DG17-*`, `s19-*` through `s23-*`, `s25-recovery-procedure`.

### N06 — Close speaker, connector EMC and current/thermal measurement scope

**Type:** product requirements, extraction and measurement; conditional filter/protection/thermal changes. **Priority:** P1.

Specify speaker impedance, audio duty/limiter and cable length before evaluating U140 and FB140–FB143. The right speaker routing is roughly **90–94 mm before the external cable**, with series beads only. Compare the existing network with manufacturer-supported ferrite/shunt or LC options using real load, stability, idle current, distortion and emissions evidence. Both speaker terminals are driven BTL outputs; never ground a negative terminal or infer each channel current from the aggregate 5 V load. Use actual assembly/thermal-pad geometry and complete losses for thermal work.

Define the product jurisdiction/EMC standard, exposure, operating modes, enclosure, antenna and harness. Review USB CC/VBUS protection coverage and actual discharge returns; no supplied immunity test proves these nodes safe or failing. Extract actual U7/U3/U2 input commutation loops, populated ground zones and reference transfers, then extend to high-speed ports and the complete product. A switch-net length is not loop area; the existing local conditional E/B/H calculations exclude significant paths and do not prove EMC compliance.

Preserve the conditional U7 current/field and video experiments as separate fixed-input studies. Their L219 thermal illustration uses **56.705 mW held DCR loss**, assumed **25 K/W, 0.5 J/K and 25 °C**, producing **26.406 °C after 60 s**. It is not an actual hotspot prediction, IC temperature or full-board heatmap. Obtain measured/qualified losses and mounted transient thermal response before assigning further temperatures.

Map every requested current to a physical branch or justified model. TP203/TP204 bracket R227; qualify the Kelvin fixture, offsets and bandwidth. Other testpoints predominantly observe voltage and do not measure each IC current. Bound probe loading and assembled access, especially eMMC, crystals, DDR references and dense analog rails.

**Done when:** supported source/load/enclosure conditions, raw field/current/temperature/EMC measurements, instrument configuration and uncertainty establish each applicable requirement. Proposed filters, protection, copper or thermal changes must improve the measured/extracted mechanism without violating another interface. Related findings: `P02-04`, `s19-rf-dfm`, `s24-*` through `s27-*`, plus the pending EM packages in [TIME_DOMAIN_EM_ANALYSIS.md](TIME_DOMAIN_EM_ANALYSIS.md).

### N07 — Reconcile revision identity and qualify the fabrication stack

**Type:** documentation/DFM correction, then physical stack-dependent review. **Priority:** P1; source identity must be settled before final SI/thermal extraction.

All **26 native sheet title blocks still say `REV3 DRAFT`** while the board is revision 4. Correct the proposal's revision/title/spec descriptions consistently and preserve the original labels in the baseline. A new label must not remove the current draft/non-release status by implication.

The proposed eight-layer dielectric and copper entries sum to **1.58 mm**, while declared board thickness is **1.60 mm**. Obtain the fabricator's actual materials, finished thickness/tolerances, copper, roughness, impedance and 2+4+2 HDI construction; reconcile source files and every dependent extraction. The viewer's 0.020 mm display gap is a visual bookkeeping device, **not a physical air gap or approved layer**.

Fresh native DRC retained **61 differential-gap, 8 uncoupled-length, 2 skew and 176 co-located-hole findings**, with zero unconnected items. Classify stacked interfaces, reference transitions and all configured ignored checks explicitly. Geometric agreement is not approval of laser-drill aspect ratio, stacked-via reliability, land pattern, assembly or impedance control. Preserve all 187 SoC ground balls, intended no-connects and mechanical/module/connector access.

**Done when:** the supplier-approved stack and process match the proposal and its models; titles/spec/BOM/manifests agree; each DRC/process/reference finding has a documented disposition; no new connectivity, clearance, return-path or assembly defect is introduced.

## Complete section scope

Every row remains in scope, including sheets whose physical IC reference is owned by another sheet. `Owned` counts assign each reference once; `Members` includes shared IC units. The pin column counts the native physical pins mapped in that section. These total 422 owned references and 1,890 pins; member counts are not a second component inventory.

| Section | Native sheet / subject | Owned / members | Pins | Findings | Main packages |
|---|---|---:|---:|---:|---|
| S02 | [02-input-01.kicad_sch](../hardware/02-input-01.kicad_sch) — Input connector and 3.3 V preregulator | 16 / 16 | 36 | 4 | N01–N03, N06 |
| S03 | [03-cpu-01.kicad_sch](../hardware/03-cpu-01.kicad_sch) — CPU buck supply and Kelvin feedback | 18 / 18 | 54 | 3 | N03 |
| S04 | [04-pmic_bucks-01.kicad_sch](../hardware/04-pmic_bucks-01.kicad_sch) — RK809-5 buck channels 1–4 | 34 / 34 | 79 | 3 | N03–N04 |
| S05 | [05-pmic_bucks-02.kicad_sch](../hardware/05-pmic_bucks-02.kicad_sch) — RK809-5 buck channel 5 / 1.8 V | 6 / 7 | 15 | 2 | N03 |
| S06 | [06-pmic_ldos-01.kicad_sch](../hardware/06-pmic_ldos-01.kicad_sch) — RK809-5 LDO and switched outputs | 19 / 20 | 53 | 3 | N02–N03 |
| S07 | [07-pmic_control-01.kicad_sch](../hardware/07-pmic_control-01.kicad_sch) — PMIC supervision, I2C, reset and 32 kHz | 22 / 23 | 67 | 4 | N03, N05 |
| S08 | [08-pmic_audio-01.kicad_sch](../hardware/08-pmic_audio-01.kicad_sch) — Unused PMIC codec bias and supply support | 9 / 10 | 38 | 2 | N03 |
| S09 | [09-soc_power-01.kicad_sch](../hardware/09-soc_power-01.kicad_sch) — RK3566 core rails and decoupling | 25 / 26 | 98 | 3 | N03–N04 |
| S10 | [10-soc_phy_power-01.kicad_sch](../hardware/10-soc_phy_power-01.kicad_sch) — RK3566 IO and PHY supply domains | 32 / 33 | 83 | 3 | N02, N04–N05 |
| S11 | [11-soc_ground-01.kicad_sch](../hardware/11-soc_ground-01.kicad_sch) — RK3566 physical ground-ball inventory | 0 / 1 | 187 | 3 | N04, N07 |
| S12 | [12-unused_io-01.kicad_sch](../hardware/12-unused_io-01.kicad_sch) — RK3566 unused pins and explicit no-connect inventory | 0 / 1 | 150 | 3 | N05, N07 |
| S13 | [13-ddr_control-01.kicad_sch](../hardware/13-ddr_control-01.kicad_sch) — DDR3L address, command and clock | 4 / 5 | 90 | 4 | N04 |
| S14 | [14-ddr_low-01.kicad_sch](../hardware/14-ddr_low-01.kicad_sch) — DDR3L byte lanes 0 and 1 / U4 | 0 / 2 | 44 | 3 | N04 |
| S15 | [15-ddr_high-01.kicad_sch](../hardware/15-ddr_high-01.kicad_sch) — DDR3L byte lanes 2 and 3 / U5 | 0 / 2 | 44 | 3 | N04 |
| S16 | [16-ddr_power-01.kicad_sch](../hardware/16-ddr_power-01.kicad_sch) — DDR3L supply, VREF and ZQ networks | 45 / 48 | 197 | 5 | N03–N04 |
| S17 | [17-soc_clock-01.kicad_sch](../hardware/17-soc_clock-01.kicad_sch) — 24 MHz clock, reset and boot straps | 8 / 9 | 24 | 4 | N03, N05 |
| S18 | [18-emmc-01.kicad_sch](../hardware/18-emmc-01.kicad_sch) — Removable 8 / 16 GB eMMC module | 18 / 19 | 107 | 4 | N02, N04–N05 |
| S19 | [19-wifi-01.kicad_sch](../hardware/19-wifi-01.kicad_sch) — SDIO Wi-Fi, Bluetooth, clocks and antenna | 21 / 22 | 101 | 5 | N03, N05–N06 |
| S20 | [20-display_mcu-01.kicad_sch](../hardware/20-display_mcu-01.kicad_sch) — MCU harness, console and SPI display | 9 / 10 | 54 | 4 | N02, N05 |
| S21 | [21-tof-01.kicad_sch](../hardware/21-tof-01.kicad_sch) — VL53L5CX ToF and shared I²C bus | 9 / 10 | 37 | 4 | N01–N02, N05 |
| S22 | [22-camera-01.kicad_sch](../hardware/22-camera-01.kicad_sch) — Two-lane camera, SCCB translation and 25 MHz clock | 21 / 22 | 89 | 6 | N01–N02, N04–N05 |
| S23 | [23-audio-01.kicad_sch](../hardware/23-audio-01.kicad_sch) — Stereo codec, I²S and microphone front end | 30 / 31 | 97 | 4 | N01–N02, N05–N06 |
| S24 | [24-speakers-01.kicad_sch](../hardware/24-speakers-01.kicad_sch) — Stereo bridge-tied speaker amplifier | 16 / 17 | 52 | 4 | N01, N06 |
| S25 | [25-usb_recovery-01.kicad_sch](../hardware/25-usb_recovery-01.kicad_sch) — USB recovery data port and operator buttons | 13 / 14 | 47 | 4 | N02, N05–N06 |
| S26 | [26-debug-01.kicad_sch](../hardware/26-debug-01.kicad_sch) — Bring-up testpoints and rail observability — group 1 | 40 / 40 | 40 | 4 | N04–N06 |
| S27 | [27-debug-02.kicad_sch](../hardware/27-debug-02.kicad_sch) — Bring-up testpoints and rail observability — group 2 | 7 / 7 | 7 | 3 | N03–N04, N06 |

## Acceptance register: all 94 section findings

Create one disposition row per ID below. Required fields: **status** (`open`, `resolved by source/model/firmware/physical change`, `validated unchanged`, or `deferred with dependency`), evidence/commit/result hash, affected refs/nets, validation performed, original acceptance criterion, residual risk and next owner/input. An informational connectivity finding still requires its invariant to survive the revision; it is not a request to move copper.

The concise actions below index the full conclusions, affected refs/nets, source evidence and acceptance conditions in [power-review.json](section-review/power-review.json), [digital-review.json](section-review/digital-review.json) and [peripheral-review.json](section-review/peripheral-review.json). The same records are embedded in [section-analysis.json](data/section-analysis.json). Do not replace their acceptance conditions with “updated,” “looks good,” or an aggregate score. Cross-cutting N01–N07 requirements, including metadata/stack/window corrections, also need dispositions.

| Finding ID | Recorded severity | Required next action |
|---|---|---|
| `P02-01` | high | Define minimum connector voltage, maximum source/harness resistance and real activity loads. |
| `P02-02` | high | Add source-qualified feedback/component corners and Wi-Fi burst measurements to the power budget. |
| `P02-03` | high | Select exact MLCCs, extract mounted network impedance and use a compatible exact TPS566242 controller model or measured responses. |
| `P02-04` | medium | Extract the actual input-capacitor/FET/ground loop, feedback return and nearby coupled conductors; correlate with switch-node/feedback probing and conducted/near-field measurements. |
| `P03-01` | high | Obtain fitted/sourced TCS4525_WT revision/lot confirmation, complete electrical/application data and an exact compatible model or characterized hardware. |
| `P03-02` | high | Select and thermally derate the real shunt, verify post-shunt Kelvin routing/loop stability, and model finite feedback-join impedance and FB bias. |
| `P03-03` | high | Establish reset/default and sleep/wake GPIO states, EN leakage/thresholds, DVS register programming and approved SoC operating points. |
| `P04-01` | high | Obtain exact-5 OTP/register defaults and controller models or measurements, then select real inductors against actual peaks and hot saturation. |
| `P04-02` | high | Confirm exact-5 external-feedback mode and tolerances; replace the rounded DDR target in a future model with the qualified divider and reference. |
| `P04-03` | medium | Qualify biased/aged MLCC capacitance and extract local-plus-distributed impedance. |
| `P05-01` | high | Obtain exact-5 BUCK5 OTP and run/sleep settings; verify 1.8 V before SoC/DDR IO operation and after reset. |
| `P05-02` | medium | Qualify the inductor and output network and include VCC9 shared-source impedance/load transitions with SWOUT1. |
| `P06-01` | high | Establish per-LDO activity currents and the complete PMIC loss/thermal budget. |
| `P06-02` | high | Use the exact channel/pin mapping and qualified load limits. |
| `P06-03` | medium | Resolve exact-5 rated/limit currents and hot on-resistance; combine preregulator tolerance with switch/trace drop and real downstream inrush. |
| `P07-01` | high | Model the real source ramp, VDC threshold/leakage and RTC/input readiness. |
| `P07-02` | high | Correlate reset low/high thresholds, allowed edge rate, PMIC sink/leakage and both capacitance sites with the real power sequence. |
| `P07-03` | medium | Measure or extract total pin/route capacitance, confirm configured speed and sink thresholds, and test PMIC/CPU access through startup and sleep. |
| `P07-04` | medium | Select the crystal and validate load/ESR/start margin and routing coupling. |
| `P08-01` | medium | Obtain exact-5 unused-codec/bias recommendations and firmware reset/disable states before removing supply, flying capacitors or bias components. |
| `P08-02` | medium | Select the exact ferrite against actual idle/startup/charge-pump current and required attenuation, measure bias settling and conducted noise, and confirm whether the system truly requires 4.5 V on this unused-audio branch. |
| `DG09-01` | info | Select exact bulk-capacitor ordering codes and extract the regulator-to-ball PDN, retaining these populations until that analysis justifies a change. |
| `DG09-02` | high | Define the supported CPU/GPU/NPU operating points and measured/authorized load profiles, then replace ideal Kelvin behavior with a qualified controller/PDN model. |
| `DG09-03` | high | Resolve the exact RK809-5 OTP/channel sequence and the TCS enable/soft-start behavior; instrument the corresponding SoC rails and reset. |
| `DG10-01` | info | Keep this bank map explicit in the firmware/device-tree and external-interface power checklist. |
| `DG10-02` | medium | Extract local decoupler/plane impedances and obtain the required analog-rail noise limits for the enabled PHYs. |
| `DG10-03` | high | Review each connected interface against this native bank map for cold start, partial power, suspend and loss of the external peripheral rails; change isolation or sequencing only where an actual domain conflict is established. |
| `DG11-01` | info | Preserve the complete ground-ball endpoint inventory through subsequent layout edits and review any changed ground escape individually. |
| `DG11-02` | medium | Inspect AR38 and the other non-via-in-pad escapes together with actual filled zones and nearby high-speed return transitions. |
| `DG11-03` | medium | Carry finite-width reference coverage and transition return continuity into the DDR extraction, including these retained edge changes. |
| `DG12-01` | info | Keep a reviewed per-ball table of no-connect intent and required reset/sleep pinmux/pull state. |
| `DG12-02` | medium | Confirm device-only recovery behavior and the permitted handling of OTG0_ID; add a bias connection only if the applicable controller guidance requires it. |
| `DG12-03` | medium | Document the actual debug/recovery paths; if JTAG or a dedicated storage reset is required, define that change explicitly rather than repurposing an unused pin casually. |
| `DG13-01` | info | Preserve the single-rank map and obtain an approved DDR loader/bin configuration for these exact devices and the custom topology. |
| `DG13-02` | high | Extract CA and clock channels at both loads with actual packages and the chosen rate/1T-or-2T configuration; address long A1 routing, transition symmetry and clock uncoupled regions based on that result. |
| `DG13-03` | high | Capture or simulate the real loader-driven DDR reset/CKE/clock sequence and the complete asynchronous reset net, including both loads. |
| `DG13-04` | medium | Include the actual DNP pad/branch geometry in clock extraction and evaluate candidate RC values only with the full differential channel. |
| `DG14-01` | info | Include all byte-0 data/mask/strobe channels and their real package delays in read and write timing analysis. |
| `DG14-02` | high | Evaluate a more symmetric DQS1 layer/via topology and reduce separated segments where an extracted differential channel confirms benefit. |
| `DG14-03` | medium | Prioritize DQ11 and the byte-1 reference/transition topology together; do not treat the edge-area finding as measured eye closure. |
| `DG15-01` | high | Evaluate the longest byte-3 routes, especially DQ31, against package-aware trained timing before selecting shorter routes or intentional matching. |
| `DG15-02` | medium | Keep the short F.Cu topology as a candidate and tune only if extracted differential delay/timing requires it. |
| `DG15-03` | high | Review DQS2 return transfers and separated segments with native planes; consider symmetric routing and local return stitching only after electrical and drill-stack review. |
| `DG16-01` | info | Qualify the actual rail/capacitor model and load profile including both DRAMs, the SoC PHY and ODT/refresh activity. |
| `DG16-02` | high | Add a loaded reference model including both DRAM inputs, capacitor tolerance/leakage and actual supply/reference return paths. |
| `DG16-03` | high | Obtain the RK3566 VREFOUT characteristics and actual loader setting, then model or measure both VREFDQ loads and probe loading. |
| `DG16-04` | medium | Qualify precision resistor ordering codes over temperature and include actual ZQ calibration behavior in the DDR bring-up plan. |
| `DG16-05` | high | Qualify DRAM case temperatures and configure a supported refresh policy for the entire permitted case-temperature range, including the resulting extra refresh power. |
| `DG17-01` | high | Select the exact crystal and validate loading, negative-resistance/startup margin and drive level; retain the manufacturer-required 22 Ω/1 MΩ topology while choosing capacitors from the qualified load. |
| `DG17-02` | medium | Review a shorter, quieter oscillator placement/return arrangement using measured or extracted parasitic capacitance; do not assume trace equality itself is a crystal requirement. |
| `DG17-03` | high | Model the actual wired reset network with PMIC/SoC sink, leakage and thresholds, and verify its release and watchdog/thermal assertion at U1. |
| `DG17-04` | info | Preserve the intended strap states and include reset-sampling and recovery behavior in bring-up verification. |
| `DG18-01` | info | Qualify the exact 8 GB and 16 GB module ordering codes and preserve the connector/keying and populated/DNP intent. |
| `DG18-02` | high | Verify the high strap during reset and enforce command/startup behavior only after both module rails are stable; model the exact module during partial power and power-off replacement. |
| `DG18-03` | high | Extract the complete host/connector/module channel for the selected transfer mode, including package delays, clock series resistor, pulls and real module load. |
| `DG18-04` | medium | Include resistor loss/temperature derating and test-pad/probe loading in the full channel; demonstrate recovery with the available D0/CLK probes. |
| `s19-vbat-margin` | high | Obtain the module burst-current envelope and effective C256 curve; evaluate the source/ferrite/trace path at the module pad 9. |
| `s19-module-sequence` | high | Define a module power-sequence state machine and confirm bootloader/Linux GPIO ownership. |
| `s19-crystal-load` | warning | Retain these as tuning placeholders until the actual crystal and module oscillator requirements are reconciled; characterize startup, frequency error and drive with a suitable low-loading method. |
| `s19-control-direction` | warning | Document or safely rename wake directions and assert GPIO2_C0 as host output/GPIO2_C1 as host input. |
| `s19-rf-dfm` | warning | Obtain vendor land/stencil approval and the exact antenna/cable, then extract and tune the RF feed. |
| `s20-rail-ownership` | high | Freeze an inter-board power contract including startup delays, shutdown order, discharge, connector current allocation and absent-board behavior. |
| `s20-io-off-state` | high | Evaluate every powered/unpowered endpoint combination. |
| `s20-console-contention` | warning | Make the external-console procedure and population option explicit; isolate R50 before attaching an external transmitter. |
| `s20-display-contract` | warning | Specify the display MPN with onboard backlight driver, maximum load and harness. |
| `s21-current-budget` | high | Build a disjoint per-load budget using the selected ranging mode and all external loads, then rerun rail/cable transients. |
| `s21-voltage-window` | high | Give the future component stress checker the sensor-specific 3.0–3.6 V operating window and the external regulator tolerance/transient envelope; do not alter the PCB solely from nominal voltage. |
| `s21-recovery-control` | warning | Define the driver recovery sequence and determine whether interface reset alone covers expected faults. |
| `s21-i2c-rise-off-state` | warning | Measure/extract the complete bus, begin with a supported conservative bus rate, and qualify power-off leakage. |
| `s22-specific-module` | warning | Confirm the exact module and mating connector stock, orientation and optical/flex envelope before freezing a new PCB revision. |
| `s22-translator-backbias` | high | Analyze the actual MCU-side CAM_1V8 regulator and all off-state loads. |
| `s22-buffer-sequence` | high | Define and capture sensor rail/reset/PWDN/clock ordering. |
| `s22-rail-af-envelope` | high | Apply device-specific voltage tolerances and a bounded ferrite DCR corner; obtain the real actuator current trajectory and source response before changing bead/bulk values. |
| `s22-csi-channel` | warning | Extract the complete two-lane channel using approved stackup and actual flex/connector models; set the intended bitrate and receiver criteria before retuning copper. |
| `s22-shared-bus-loading` | warning | Include both pull-up networks and camera cable capacitance in sink/rise-time checks; keep address conventions and sensor/VCM transactions explicit. |
| `s23-codec-sequence` | high | Incorporate the codec sequence into the cross-board power contract and driver; measure actual rail/reset ordering, including restart with one rail retained. |
| `s23-i2s-monitor` | warning | Freeze SoC/codec clock-master roles and the MCU receiver load, preserve the shared TX/RX clock pinmux, and evaluate monitor-on/off timing before changing resistor values. |
| `s23-microphone-bias` | warning | Obtain the exact microphone electrical data and codec input/bias settings, calculate DC headroom and all filter corners, and measure startup pop/noise with the real enclosure. |
| `s23-bead-dcr` | warning | Retain a nominal model if justified but add the published maximum-DCR corner and bias-dependent impedance. |
| `s24-bead-rating` | high | Obtain the current supplier approval sheet and correct the 2 A annotation or select a genuinely qualified alternate after current/thermal/impedance review. |
| `s24-output-filter` | high | Model the selected speaker/cable and compare bead-only, manufacturer ferrite-plus-shunt and LC options. |
| `s24-btl-power` | warning | Specify speakers, allowable distortion and limiter level; document differential probing and BTL harness polarity. |
| `s24-thermal-pad` | warning | Use actual loss and assembly geometry for a board thermal calculation, followed by temperature testing at the maximum declared audio duty and ambient. |
| `s25-vbus-detector` | warning | Verify the specific RK3566 detector off-state limits and test VBUS-first/main-power-first/slow-detach cases; add isolation/clamping only if required without disturbing its high-level window. |
| `s25-port-protection` | warning | Define the connector exposure and immunity target, review the discharge path and add correctly rated low-leakage protection where justified. |
| `s25-usb-channel` | warning | Extract the complete USB2 channel and validate the intended speed with the exact connector/cable/ESD package. |
| `s25-recovery-procedure` | warning | Document separate recovery and true MaskROM procedures, main-power requirement and button timing; validate them with the selected boot image and removable eMMC. |
| `s26-current-observability` | warning | Specify a differential Kelvin fixture and calibration/error budget; map each other current question to an actual shunt, branch measurement or justified model. |
| `s26-emmc-probe-loading` | warning | Use low-loading probes and model the mounted fixture/pads. |
| `s26-signal-identity` | warning | Publish one directional testpoint map with probe levels, intended bus and console isolation steps; keep functional silk consistent in a future drawing update. |
| `s26-access-limits` | warning | Review the assembled access/fixture envelope and capture a scope connection plan. |
| `s27-vref-separation` | warning | Define separate DC/ripple limits and probe impedance for each reference; keep the distinction explicit in the next measurement and PCB-change task. |
| `s27-io-domain-identity` | warning | Cross-check actual rail measurement with RK3566 IO-domain configuration and the selected storage/Wi-Fi mode before exercising the bus. |
| `s27-probe-access` | warning | Verify probe approach and nearby ground access with the real assembly, and preserve explicit Unknown current/temperature values. |

## Reproduction, checks and reporting

First verify the frozen inputs without modifying them, from the project root:

```sh
python3 - <<'PYVERIFY'
import hashlib, json
from pathlib import Path
m = json.loads(Path('simulation/data/section-analysis.json').read_text())
for group in ('source_hashes', 'analysis_input_hashes'):
    failures = [name for name, expected in m[group].items()
                if not Path(name).is_file()
                or hashlib.sha256(Path(name).read_bytes()).hexdigest() != expected]
    assert not failures, (group, failures)
    print(group, len(m[group]), 'matched')
PYVERIFY
```

In the **isolated proposal**, preserve the old results before running generators. The established extraction/check commands are:

```sh
cd simulation
python3 extract.py
python3 board_view.py
kicad-cli pcb drc --format json -o data/native-drc.json ../hardware/rk3566-sbc.kicad_pcb
python3 audit.py
python3 -m unittest discover -s . -p 'test_*.py' -v
```

`extract.py` regenerates the native XML netlist when design hashes change and checks source/PCB endpoint parity. Add the appropriate native schematic ERC and source-qualified DRC/DFM checks, comparing retained baseline warnings and ignored checks explicitly. `python3 section_analysis.py` currently builds the **frozen-run-based** ledger; update its comparison/provenance logic before using it to report a changed design with new runs. Do not combine baseline results with changed copper and label them current.

After model or source changes, restart the service so the running code and recorded engine hash agree. Run the preserved 13 parameter sets under the new model as **new** case IDs, plus new source-qualified corners and regressions. `python3 server.py --port 8766 --resume` preserves a compatible selected result; `--campaign` appends runs and updates the campaign index, so use it only after preserving the baseline. Keep full parameter, source and engine identities with every before/after comparison. Never overwrite run-0004–run-0016 or run-0027 to make history appear improved.

If relevant geometry or models change, revalidate the separate scoped experiments using `spice_check.py`, `em_geometry_audit.py`, `electric_field.py` and `time_domain.py`, then their tests. Their fixed-input local studies do not automatically follow the dashboard startup parameters. New thermal/video or field artifacts require new manifests and explicit valid scopes. Keep web source guards, all unknown values, exported raw data, and existing conditional studies visible.

Preserve the four failing campaign cases: **run-0011** (15 ms soft-start parameter), **run-0012** (requested reset at 5 ms), **run-0014** (2.5 V brownout from 80–100 ms), and **run-0016** (4.75 V / 250 mΩ / loads ×1.4 / capacitance 40% / 70 °C). Early reset and brownout remain negative normal-operation cases even if fault detection/recovery works. Decide whether slow ramp and combined conditions belong to the required operating envelope from N02/N03 evidence; do not relabel them for scoring.

**Scoring gate:** preserve historical nominal behavioral **9/10** and hardware-evidence heuristic **2.85/10**, separately from professional **2.5/10 PRV-1**. The old evidence heuristic is structurally capped at 4 and cannot demonstrate 8/10 hardware readiness through repeated simulation. Keep mandatory failures below the model's 8/10 target and unknown checks unearned; do not alter weights, denominators, limits or inputs to manufacture improvement. A future broader rubric must be versioned and its scope/gates agreed before scoring. A better model, interface or document is not itself evidence of improved physical hardware.

Expected delivery for the next task:

- An isolated proposed revision and an explicit before/after change table identifying source/model, firmware, BOM, schematic, copper and documentation changes separately.
- The completed 94-ID register and N01–N07 dispositions, exact-part/source records, upstream power/interface contract, approved stack/process inputs or named open dependencies.
- Native diff/rendered review files, BOM and endpoint parity, ERC/DRC/geometry/DFM results, updated component/rail limits and disjoint current budgets, new run IDs and unchanged baseline artifacts.
- Scope-appropriate SI/PI, transient, thermal/EMC and firmware/bench evidence; numerical convergence/tests where applicable; current web views and downloadable raw manifests/results.
- A release recommendation that explicitly leaves actual boot, DDR timing/training, EMI/EMC, thermal and manufacturing qualification open wherever evidence remains missing. Do not claim a finished fabrication-ready board from partial package completion.

## Files to provide with this task

This document explains the assignment on its own. Reproduction or PCB changes require the actual files with their directory structure; a screenshot or this brief alone cannot reconstruct the circuit.

1. **Minimum to review conclusions:** this file; `simulation/data/section-analysis.json`; all `simulation/section-review/` JSON/Markdown/evidence files; `simulation/NEXT_AGENT_HANDOFF.md`; `simulation/PROFESSIONAL_REVIEW.md`; `simulation/REFERENCES.md`; `simulation/data/{board.json,board-layout.json,native-netlist.xml,native-drc.json,electrical-audit.json,source-hashes.json}`; every run from `run-0004.json` through `run-0016.json`, plus `run-0027.json`.
2. **Required to make the proposal and rerun it:** complete `hardware/` including all 36 manifest inputs, layer/HDI configuration, custom symbols/footprints/library tables, BOM/specification and every hierarchical sheet; the full `simulation/` code, tests, web assets and retained data. Include `simulation/README.md` and `INTERACTIVE_WORKBENCH.md` for application behavior. Do not omit currently uncommitted files.
3. **Source/qualification evidence:** retained `references/`, `power-revision/regulator-source-qualification.md`, connector/testpoint and pinmux documents, `reports/`, differential timing/reference/HDI reviews and `simulation/professional/` provenance/models. Retain model license notices. A prepared WEBENCH request or downloaded encrypted archive is not an executed analysis; inspect its recorded status before relying on it.
4. **For extended current/field/thermal work:** retain `TIME_DOMAIN_EM_ANALYSIS.md`, `VIDEO_THERMAL_METHOD.md`, raw `data/time-domain/`, `data/electric-field/`, `data/video/`, corresponding JSONs/generators/tests and manifests. Keep the fixed local electrical and 60 s illustrative thermal clocks distinct.
5. **External dependencies to obtain:** MCU power-board sources and firmware, actual harnesses, exact camera/display/eMMC/antenna/speaker/crystal parts and models, fabricator stack/process approval, intended operating/EMC requirements and representative hardware/instruments. List unavailable inputs in the disposition register instead of guessing.
