# Digital section review — RK3566 revision 4

Native PCB SHA256: `3ba4da7036173e31941ea22b041d1a2a3433c2bcdedccf1a75b1f52b31ce2807`. This review covers schematic sheets 09–18 and makes no hardware, solver, score or release-status change. Hardware evidence remains **2.5/10**; connectivity and the conditional model must not be presented as physical qualification.

All numeric rail results below are frozen from **run-0027**, nominal scenario at **4.75 V input**, source resistance **0.12 Ω**, capacitor factor **0.7**, soft start **1.39 ms**, requested system-reset release **40 ms**, **25 °C** assumed ambient and **160 ms** duration. They are not the earlier 5 V video baseline or campaign envelopes. The saved run reaches its final modeled stable rail at 20.850 ms. Its per-rail currents are assumed aggregate load/capacitor currents, never individual IC or pin currents.

Fresh read-only native path measurements cover 21 eMMC/oscillator/reset/reference nets with zero graph failures. The DDR audit cited below already matches the exact current PCB hash. All 3D lengths use proposed copper-center depths and omit package interconnect. The 1.580 mm stack entry sum versus 1.600 mm declared thickness remains unresolved; no material propagation model is inferred from these lengths.

The evidence snapshot and complete selected native path details are in [digital-evidence.json](digital-evidence.json). The structured review is [digital-review.json](digital-review.json). Stored sources and this selected run are hashed there so later changes cannot silently turn these numbers into current evidence.

## Frozen SoC/DDR rail results

| Rail | Steady V | 95% time, ms | Peak aggregate A | Steady aggregate A | Nominal / modeled C, µF |
|---|---:|---:|---:|---:|---:|
| VDD_LOGIC | 0.894632 | 5.230 | 0.447316 | 0.447315 | 114.90 / 80.43 |
| VDDA0V9_PMU | 0.899251 | 5.230 | 0.024979 | 0.024979 | 2.10 / 1.47 |
| VDDA_0V9 | 0.898652 | 5.230 | 0.044933 | 0.044932 | 2.50 / 1.75 |
| VCC_1V8 | 1.798561 | 9.135 | 0.119904 | 0.119904 | 49.00 / 34.30 |
| VCCA1V8_PMU | 1.798891 | 9.135 | 0.036977 | 0.036977 | 2.10 / 1.47 |
| VCCA_1V8 | 1.798651 | 9.135 | 0.044966 | 0.044966 | 2.70 / 1.89 |
| VCC3V3_PMU | 3.299100 | 9.135 | 0.029992 | 0.029992 | 1.30 / 0.91 |
| VDD_GPU | 0.897845 | 9.135 | 0.179569 | 0.179568 | 92.90 / 65.03 |
| VDD_CPU | 1.025000 | 9.140 | 4.677210 | 0.749997 | 92.70 / 64.89 |
| VDD_NPU | 0.898562 | 13.040 | 0.119808 | 0.119808 | 88.20 / 61.74 |
| VCC_DDR | 1.342245 | 16.945 | 0.646266 | 0.646264 | 92.60 / 64.82 |
| VCCA1V8_IMAGE | 1.799400 | 16.945 | 0.019993 | 0.019993 | 1.40 / 0.98 |
| VDDA0V9_IMAGE | 0.898951 | 16.945 | 0.034959 | 0.034959 | 1.50 / 1.05 |
| VCC_3V3 | 3.265843 | 18.975 | 2.100000 | 0.178136 | 33.00 / 23.10 |
| VCCIO_SD | 3.299640 | 20.850 | 0.011999 | 0.011999 | 1.10 / 0.77 |
| VCCIO_ACODEC | 3.299640 | 20.850 | 0.011999 | 0.011999 | 4.80 / 3.36 |
| VCCIO_WL | 1.798831 | 9.135 | 0.011992 | 0.011992 | 5.90 / 4.13 |

The table is a saved behavioral result. The CPU branch peak includes the ideal Kelvin/capacitor model. GPU/NPU/CPU target windows are not fixed manufacturer operating ceilings. PHY/IO currents cover assigned rail loads, not those specific internal blocks. VREFCA, VREFDQ, crystal oscillation and digital memory traffic are not solved waveforms.

## s09: RK3566 core rails and decoupling

The native power map and local capacitor populations are consistent with separate CPU, logic, GPU, NPU and analog/PMU domains. The stored rail run meets its conditional voltage screens; it does not establish SoC operating-point, regulator-loop or die-current qualification.

**Physical members on this sheet:** C1, C10, C11, C12, C13, C14, C15, C16, C2, C27, C28, C29, C3, C30, C31, C32, C33, C34, C35, C4, C5, C6, C7, C8, C9, U1. Multi-unit ICs appear on several sheets; they are one physical component, not additional devices.

### DG09-01 — INFO

Sheet-local nominal bypass is 70.7 µF CPU, 70.8 µF logic, 48.8 µF GPU and 44.1 µF NPU. Total directly connected board capacitance on those rails is 92.7, 114.9, 92.9 and 88.2 µF respectively. The saved model applies a uniform 0.7 factor, not measured part-specific derating.

**Action:** Select exact bulk-capacitor ordering codes and extract the regulator-to-ball PDN, retaining these populations until that analysis justifies a change.

**Acceptance:** Each populated capacitor has a voltage/bias/temperature model; rail impedance and load-step excursions are checked at the SoC balls over the chosen workloads.

**Affected:** U1, C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, C15, C16; VDD_CPU, VDD_LOGIC, VDD_GPU, VDD_NPU.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/09-soc_power-01.kicad_sch](../../hardware/09-soc_power-01.kicad_sch).

### DG09-02 — HIGH

Run-0027 holds VDD_CPU at exactly 1.025 V through an ideal Kelvin-feedback rule and produces a 4.677 A peak in the R227/CPU-capacitor branch. Neither number is a TCS4525/RK3566 transient prediction. CPU/GPU/NPU upper acceptance values used by the behavioral screen are scenario targets; the SoC recommended table gives no fixed maximum for those dynamic domains.

**Action:** Define the supported CPU/GPU/NPU operating points and measured/authorized load profiles, then replace ideal Kelvin behavior with a qualified controller/PDN model.

**Acceptance:** Boot and every allowed operating point satisfy the voltage requirements supplied for that speed bin; real startup and load-step current peaks remain inside regulator, inductor, shunt and interconnect ratings.

**Affected:** U1, U3, R227, R10, R229; VDD_CPU, VDD_CPU_P, VDD_GPU, VDD_NPU.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [references/rk3566-v1.2.txt](../../references/rk3566-v1.2.txt), [simulation/engine.py](../../simulation/engine.py), [hardware/03-cpu-01.kicad_sch](../../hardware/03-cpu-01.kicad_sch).

### DG09-03 — HIGH

The saved model reaches 95% on logic/PMU 0.9 V at 5.230 ms, PMU 1.8/3.3 V and GPU at 9.135 ms, CPU at 9.140 ms and NPU at 13.040 ms. CPU_EN is physically pulled from PMU 3.3 V through R226 with C251 DNP, so this is not an independently verified CPU sequence.

**Action:** Resolve the exact RK809-5 OTP/channel sequence and the TCS enable/soft-start behavior; instrument the corresponding SoC rails and reset.

**Acceptance:** Measured stable-power order, continuous reset hold and recovery satisfy the selected Rockchip requirements at supply and temperature corners; no rail timing is inferred solely from the candidate group number.

**Affected:** U1, U2, U3, R226, C251; CPU_EN, VCC3V3_PMU, VDD_CPU, VDD_LOGIC, VDD_NPU.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt), [hardware/03-cpu-01.kicad_sch](../../hardware/03-cpu-01.kicad_sch), [hardware/09-soc_power-01.kicad_sch](../../hardware/09-soc_power-01.kicad_sch).

**Startup:** The 95% milestones above are model milestones, not measured power-good times. U1 has 11 CPU, 9 logic, 5 GPU and 5 NPU supply balls. All are mapped to their intended rails; each domain is treated as one lumped node.

**Steady state:** Run-0027: CPU 1.025000 V / 0.749997 A; logic 0.894632 V / 0.447315 A; GPU 0.897845 V / 0.179568 A; NPU 0.898562 V / 0.119808 A. These are rail-load budgets, not individually resolved ball currents. Logic has 84.632 mV above its 0.81 V lower limit in this run.

**Transient:** The RC model cannot resolve package inductance, anti-resonance, voltage at individual balls, AVS changes or regulator phase margin. The startup CPU branch peak is especially sensitive to ideal source and capacitor charging assumptions.

**EMI / EMC:** Core current-loop radiation and simultaneous-switching noise are outside the local U7 output-loop field model. Include the actual power/ground stack, package and distributed decouplers before assigning fields to U1.

**Thermal:** No SoC junction temperature is available. The CPU rail alone carries approximately 0.769 W in the assumed steady budget, but electrical rail power is not a measured die heat map or a thermal qualification result.

**Required models and evidence:** Exact bulk MLCC models, RK3566 package power/ground parasitics and activity currents, operating-point tables, compatible TCS4525 model and exact RK809-5 OTP/controller models.

**Proposed work for a future change task:**

- Qualify C1–C16 bulk-capacitor ordering codes and bias-dependent capacitance.
- Create a core PDN/load-step model at the SoC balls and qualify the supported DVFS table.
- Resolve CPU_EN/PMIC sequence before considering any enable-delay or capacitor change.

## s10: RK3566 IO and PHY supply domains

The sheet separates 0.9 V and 1.8 V image/PHY supplies from IO banks. No unconnected declared SoC supply pin was found. The most important remaining work is bank-level power-off behavior and high-frequency supply integrity, not a blanket voltage reassignment.

**Physical members on this sheet:** C36, C37, C38, C39, C40, C41, C42, C43, C44, C45, C46, C47, C48, C49, C50, C51, C52, C53, C54, C55, C56, C57, C58, C59, C60, C61, C62, C63, C64, C65, C66, C67, U1. Multi-unit ICs appear on several sheets; they are one physical component, not additional devices.

### DG10-01 — INFO

The native map connects VCCIO2/1C13 to VCC_1V8, VCCIO1/1D13 to VCCIO_ACODEC, VCCIO3/1F17 to VCCIO_SD, VCCIO4/1E16 to VCCIO_WL, VCCIO5/6/7 to VCC_3V3 and both PMUIO banks to VCC3V3_PMU. Across U1 there are 80 non-ground power-input balls on 17 named rails.

**Action:** Keep this bank map explicit in the firmware/device-tree and external-interface power checklist.

**Acceptance:** Every active signal is assigned to the correct supply bank and matches its connected peripheral voltage in all operating and sleep modes.

**Affected:** U1; VCC_1V8, VCCIO_ACODEC, VCCIO_SD, VCCIO_WL, VCC_3V3, VCC3V3_PMU.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [hardware/10-soc_phy_power-01.kicad_sch](../../hardware/10-soc_phy_power-01.kicad_sch).

### DG10-02 — MEDIUM

Thirty-two 100 nF capacitors are assigned on this sheet. Image 0.9 V has five local capacitors and image 1.8 V four. The stored voltages are 0.898951 V and 1.799400 V, respectively; the lumped model cannot test ripple coupling between CSI, DSI and HDMI analog pins that share those rails.

**Action:** Extract local decoupler/plane impedances and obtain the required analog-rail noise limits for the enabled PHYs.

**Acceptance:** At the actual PHY pins, DC limits and documented ripple/noise requirements hold during camera traffic and simultaneous system activity.

**Affected:** U1, C57, C58, C59, C60, C62, C63, C64, C65, C67; VDDA0V9_IMAGE, VCCA1V8_IMAGE.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/10-soc_phy_power-01.kicad_sch](../../hardware/10-soc_phy_power-01.kicad_sch).

### DG10-03 — HIGH

The saved rail milestones differ substantially: VCCIO_WL reaches 95% at 9.135 ms, VCC_3V3 at 18.975 ms, and VCCIO_SD/ACODEC at 20.850 ms. IO drivers and external sources are not switched by a pin-level power-off model, so a rail-voltage pass cannot exclude back-power through IO clamps.

**Action:** Review each connected interface against this native bank map for cold start, partial power, suspend and loss of the external peripheral rails; change isolation or sequencing only where an actual domain conflict is established.

**Acceptance:** No active input exceeds its receiving-bank powered/off specification and no unintended clamp current or rail back-feed occurs in the tested supply permutations.

**Affected:** U1, U2, R212; VCCIO_WL, VCCIO_SD, VCCIO_ACODEC, VCC_3V3, 3V3_PER, 1V8_AUDIO.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

**Startup:** Both image analog rails reach their modeled 95% level at 16.945 ms. IO and PHY state machines are not simulated, so these supply curves cannot prove CSI/USB/HDMI PHY reset completion.

**Steady state:** Run-0027 gives VCC_1V8 1.798561 V, VCCIO_WL 1.798831 V, VCCIO_SD and VCCIO_ACODEC 3.299640 V, and VCC_3V3 3.265843 V. Their stated 1.8/3.3 V limits are 1.62–1.98 V and 2.97–3.63 V; all cited values are conditional lumped-rail results.

**Transient:** Shared analog loads and signal clamp currents remain unresolved. Unused eDP/HDMI/MULTI_PHY signal pins do not by themselves authorize removal of their connected supply or bypass networks.

**EMI / EMC:** A 100 nF label does not establish its impedance near PHY edge harmonics. Use physical MLCC placement, mounting inductance and reference-plane geometry; no U7 field plot represents these domains.

**Thermal:** The image-rail budget is approximately 31.4 mW at 0.9 V and 36.0 mW at 1.8 V in the stored run. These are aggregate assumed electrical loads and cannot be converted to PHY temperatures.

**Required models and evidence:** RK3566 IO power-domain checklist and off-state pin models, enabled-PHY current spectra and noise limits, distributed MLCC and package/plane parasitics.

**Proposed work for a future change task:**

- Create an interface-by-interface power-off/back-feed matrix using the native bank map.
- Qualify image/PHY PDNs with the real enabled interfaces and retain unused-PHY support until the manufacturer checklist is resolved.

## s11: RK3566 physical ground-ball inventory

All 187 physical ground balls are native-connected in one group. This verifies the ground inventory, while return impedance, via reliability and thermal spreading remain separate questions.

**Physical members on this sheet:** U1. Multi-unit ICs appear on several sheets; they are one physical component, not additional devices.

### DG11-01 — INFO

The 565-ball U1 map contains 131 VSS and 56 AVSS/DDR/PLL ground balls, for 187 total. Fresh native connectivity puts all 187 in one GND group. 152 have a same-surface ground-via center inside their pad; the other 35 remain connected through the native copper.

**Action:** Preserve the complete ground-ball endpoint inventory through subsequent layout edits and review any changed ground escape individually.

**Acceptance:** Zero missing ground balls and zero native group splits after each proposed revision; manufacturer land/via construction accepted by the fabricator.

**Affected:** U1; GND.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/11-soc_ground-01.kicad_sch](../../hardware/11-soc_ground-01.kicad_sch), [research/rk3566-pin-audit.json](../../research/rk3566-pin-audit.json).

### DG11-02 — MEDIUM

The largest nearest same-surface ground-via center distance among U1 ground balls is 2.829 mm at AR38. This is a geometric inspection marker, not its return-current path or an inductance limit. The viewer omits copper-zone fills and therefore cannot be used to diagnose absent ground planes.

**Action:** Inspect AR38 and the other non-via-in-pad escapes together with actual filled zones and nearby high-speed return transitions.

**Acceptance:** A native plane/PDN extraction demonstrates the needed return impedance; any added ground via has a documented benefit and passes stack/drill/assembly checks.

**Affected:** U1; GND.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [simulation/board_view.py](../../simulation/board_view.py), [hardware/rk3566-sbc.kicad_pcb](../../hardware/rk3566-sbc.kicad_pcb).

### DG11-03 — MEDIUM

The retained native-reference audit identifies lost ground coverage beneath narrow outer-edge areas of DDR3_BA2 and DDR3_DQ11 even though their affected centerlines remain covered. The differential-pair audit reports 24.721 mm of uncovered centerline, all within its explicit 0.4 mm transition neighborhoods; that neighborhood is bookkeeping, not a current-return allowance.

**Action:** Carry finite-width reference coverage and transition return continuity into the DDR extraction, including these retained edge changes.

**Acceptance:** No unexplained reference cut or reference transfer remains in the extracted channels; SI and return-current evidence covers the complete transition geometry.

**Affected:** U1, U4, U5; GND, DDR3_BA2, DDR3_DQ11.

**Evidence:** [differential-revision/final/return-reference-assessment.json](../../differential-revision/final/return-reference-assessment.json), [differential-revision/final/pair-references.json](../../differential-revision/final/pair-references.json), [reports/final-readiness.json](../../reports/final-readiness.json).

**Startup:** A connected ground network exists before modeled rail startup, but the behavioral model assumes it is an ideal zero-volt reference. It does not calculate ground bounce during capacitor charging.

**Steady state:** No numeric ground-ball current is assigned. All ball currents sum through distributed package/copper paths that are absent from the lumped rail model.

**Transient:** Native via spans and plane connections are known; actual spreading inductance, simultaneous-switching ground motion and microvia reliability are not calculated.

**EMI / EMC:** Do not replace the ground planes with one guessed return wire. The saved magnetic model only closes explicit U7 output-loop filaments and has no solved current distribution under U1.

**Thermal:** Ground balls/vias may conduct heat as well as current, but neither the 187-ball count nor the 152 via-in-pad count establishes a thermal resistance.

**Required models and evidence:** Full package power/ground interconnect, native filled-plane mesh, copper thickness/material qualification, via plating/construction and thermal stack/interface data.

**Proposed work for a future change task:**

- Preserve all ground endpoints; extract the actual filled-ground return network.
- Review the 35 ground balls without a via center inside the pad and the retained BA2/DQ11 reference-edge changes before adding or relocating vias.

## s12: RK3566 unused pins and explicit no-connect inventory

The explicit no-connect inventory is internally consistent: 154 U1 pins are unused, comprising 150 bidirectional pins, three outputs and one input. No declared power pin was found in that inventory; functional pin-specific handling still needs the manufacturer unused-pin checklist.

**Physical members on this sheet:** U1. Multi-unit ICs appear on several sheets; they are one physical component, not additional devices.

### DG12-01 — INFO

The 154 no-connect pins are named physical balls, not missing schematic wires. U1.1M18/DFT_TEST_GND is deliberately outside that group and is connected to GND through populated R6 = 0 Ω.

**Action:** Keep a reviewed per-ball table of no-connect intent and required reset/sleep pinmux/pull state.

**Acceptance:** All intentionally unused pins match the exact RK3566 pinout/unused-pin guidance, and no power, test or required boot function is silently treated as a generic GPIO.

**Affected:** U1, R6; DFT_TEST_GND.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [hardware/12-unused_io-01.kicad_sch](../../hardware/12-unused_io-01.kicad_sch), [hardware/17-soc_clock-01.kicad_sch](../../hardware/17-soc_clock-01.kicad_sch).

### DG12-02 — MEDIUM

USB_OTG0_ID at T37 is the only unused pin typed input. The carrier uses OTG0 for recovery, so its intended peripheral-only role must be established by the actual OTG/controller configuration rather than inferred from the unused marker.

**Action:** Confirm device-only recovery behavior and the permitted handling of OTG0_ID; add a bias connection only if the applicable controller guidance requires it.

**Acceptance:** Cold boot and Maskrom recovery enumerate reliably for every supported USB power state without an unintended host-role transition.

**Affected:** U1; USB_VBUS_DET, USB_D_P, USB_D_N.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [hardware/12-unused_io-01.kicad_sch](../../hardware/12-unused_io-01.kicad_sch), [hardware/25-usb_recovery-01.kicad_sch](../../hardware/25-usb_recovery-01.kicad_sch).

### DG12-03 — MEDIUM

ARM_JTAG_TCK/TMS multiplexed balls 1D20/1F18 are no-connects even though R5 pulls SDMMC0_DET_L high. EMMC_RSTn at 1B16 is also a no-connect, consistent with the selected 34-pin module interface providing no reset contact. Neither JTAG accessibility nor direct eMMC hardware reset should be advertised.

**Action:** Document the actual debug/recovery paths; if JTAG or a dedicated storage reset is required, define that change explicitly rather than repurposing an unused pin casually.

**Acceptance:** The recovery plan is demonstrated with corrupt boot media; debug documentation and firmware reset handling match only physically available connections.

**Affected:** U1, R5, J1; SDMMC0_DET_L.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt), [references/soc-memory/radxa-emmc-brief-rev1.1.txt](../../references/soc-memory/radxa-emmc-brief-rev1.1.txt).

**Startup:** Reset-state pulls and pinmux are not implemented by the electrical simulator. The no-connect declarations prove intent, not a powered-up GPIO state or immunity to floating-input current.

**Steady state:** No 0 A claim is made for unused IC pins. Internal pull currents, analog bias and leakage depend on actual configuration and silicon conditions.

**Transient:** Validate that enable/disable and suspend sequences leave unused functions in documented safe states, especially the recovery role and test/debug mux.

**EMI / EMC:** Unrouted unused pins do not form board trace antennas, but their package coupling and internally enabled functions are still outside the EM model.

**Thermal:** No per-pin leakage/temperature model exists. Disabling unused PHY and GPIO functions may affect power, but no saving is quantified here.

**Required models and evidence:** Exact RK3566 unused-pin/pinmux checklist, boot register configuration, off-state/analog input characteristics and recovery firmware evidence.

**Proposed work for a future change task:**

- Add an explicit unused-pin/reset/suspend configuration table.
- Resolve OTG0_ID handling and document the absence of routed JTAG and module hardware reset; route those functions only if required by the future product scope.

## s13: DDR3L address, command and clock

U4 and U5 are two 8 Gbit ×16 DDR3L devices forming a single 32-bit rank with 2 GiB total capacity. Their CA/control and clock nets are connected, but the selected loader, channel timing and DDR reset protocol have not been demonstrated.

**Physical members on this sheet:** C430, R404, U1, U4, U5. Multi-unit ICs appear on several sheets; they are one physical component, not additional devices.

### DG13-01 — INFO

The source-matching native audit finds all 74 DDR-prefixed nets connected, including 100 U1-to-DRAM paths: 44 DQ/DQS/DM point-to-point signals, 26 CA/reset nets to both DRAMs and both clock polarities to both DRAMs. The other two DDR-prefixed nets are reference/optional-RC support. Manufacturer pin extraction found no DRAM/SoC signal mapping mismatch.

**Action:** Preserve the single-rank map and obtain an approved DDR loader/bin configuration for these exact devices and the custom topology.

**Acceptance:** The boot loader recognizes the intended 2 GiB geometry, initializes both devices, trains all four byte lanes and passes sustained memory testing across operating corners.

**Affected:** U1, U4, U5; DDR3_CS0n, DDR3_CKE, DDR3_ODT0, DDR3_CLKP, DDR3_CLKN.

**Evidence:** [differential-revision/final/timing/ddr-timing-audit.md](../../differential-revision/final/timing/ddr-timing-audit.md), [references/soc-memory/memory-verification.json](../../references/soc-memory/memory-verification.json), [hardware/13-ddr_control-01.kicad_sch](../../hardware/13-ddr_control-01.kicad_sch).

### DG13-02 — HIGH

Native CLK paths are 18.948 mm to U4 and 20.248 mm to U5, with essentially zero P/N 3D mismatch. However, clock parallel overlap is only 70.9%; uncoupled copper is 7.703/7.795 mm. CA A1→U4 is 61.075 mm in 3D, while CKE→U5 is 29.584 mm. The published 6 ps/mm sensitivity gives 252.759 ps A1-vs-CLK and 56.014 ps CKE-vs-CLK offsets; neither is receiver timing slack.

**Action:** Extract CA and clock channels at both loads with actual packages and the chosen rate/1T-or-2T configuration; address long A1 routing, transition symmetry and clock uncoupled regions based on that result.

**Acceptance:** Actual setup/hold/eye requirements are met at U4 and U5 for CS/CKE/ODT and all CA signals with the loader modes used during initialization and normal traffic.

**Affected:** U1, U4, U5; DDR3_A1, DDR3_CKE, DDR3_CS0n, DDR3_ODT0, DDR3_CLKP, DDR3_CLKN.

**Evidence:** [differential-revision/final/timing/ddr-timing-audit.md](../../differential-revision/final/timing/ddr-timing-audit.md), [reports/differential-review.md](../../reports/differential-review.md), [differential-revision/final/channel-metrics.json](../../differential-revision/final/channel-metrics.json).

### DG13-03 — HIGH

DDR3_RESETn reaches U4 at 73.481 mm and U5 at 85.851 mm in 3D. No separate DDR_RESETn/CKE waveform exists in the stored run. The 40 ms system-reset release is not proof of the DRAM protocol: ISSI specifies reset low through stable power for at least 200 µs, followed by at least 500 µs before active CKE.

**Action:** Capture or simulate the real loader-driven DDR reset/CKE/clock sequence and the complete asynchronous reset net, including both loads.

**Acceptance:** ISSI startup requirements are satisfied at both DRAM pins, with monotonic reset threshold crossings and qualified overshoot/undershoot. Do not length-match asynchronous RESET to CLK.

**Affected:** U1, U4, U5; DDR3_RESETn, DDR3_CKE.

**Evidence:** [differential-revision/final/timing/ddr-timing-audit.md](../../differential-revision/final/timing/ddr-timing-audit.md), [references/soc-memory/issi-ddr3l.txt](../../references/soc-memory/issi-ddr3l.txt), [hardware/13-ddr_control-01.kicad_sch](../../hardware/13-ddr_control-01.kicad_sch).

### DG13-04 — MEDIUM

R404 = 100 Ω and C430 = 10 pF are both DNP. They reserve a series RC branch across CLKP and CLKN; they are not populated termination and are not series resistors inserted into the two clock conductors.

**Action:** Include the actual DNP pad/branch geometry in clock extraction and evaluate candidate RC values only with the full differential channel.

**Acceptance:** The selected population is documented and improves measured/simulated clock integrity without violating driver load or receiver swing/timing requirements.

**Affected:** R404, C430, U1, U4, U5; DDR3_CLKP, DDR3_CLKN, DDR3_CLK_RC.

**Evidence:** [hardware/design-spec.json](../../hardware/design-spec.json), [hardware/13-ddr_control-01.kicad_sch](../../hardware/13-ddr_control-01.kicad_sch).

**Startup:** DDR rail 95% occurs at 16.945 ms in run-0027, but loader reset/CKE timing, DLL lock, ZQ calibration and training are absent. Reset must be established while power is rising; this requires a real pin/boot model or capture.

**Steady state:** Both devices use the same CA/control nets and VCC_DDR rail. The ISSI −125 grade supports a device bin of 1600 MT/s; no operating data rate for this PCB is qualified. The prior 800 MHz/1600 MT/s timing calculations are explicitly sensitivity cases.

**Transient:** Clock matching in millimeters cannot establish matched delay when layer allocation, vias, packages and branches differ. Receiver data-sheet setup/hold specifications must not be repurposed as allowable PCB skew.

**EMI / EMC:** The clock/CA multi-drop loops, RC reservation and long RESET route need real return planes and driver edge rates. No emissions value follows from connectivity or the small equal-length clock residual.

**Thermal:** DRAM active/refresh/ODT power is unresolved; the VCC_DDR budget includes both memories and the SoC PHY and cannot be divided equally into device temperatures.

**Required models and evidence:** Exact Rockchip loader training configuration, per-ball package delays, SoC/ISSI IBIS and timing models, confirmed laminate/impedance, and loader-controlled reset/clock/CKE trajectories.

**Proposed work for a future change task:**

- Qualify the selected DDR bin/loader and capture reset/CKE/clock startup.
- Prioritize A1/CA branch timing and the uncoupled clock regions in extracted-channel review.
- Choose R404/C430 population only after clock-channel comparison.

## s14: DDR3L byte lanes 0 and 1 / U4

All 22 DQ/DM/DQS signals for U4 are connected. Byte 0 is relatively compact; byte 1 crosses more layers and its strobe legs have asymmetric transition counts that remain an SI concern despite small total-length mismatch.

**Physical members on this sheet:** U1, U4. Multi-unit ICs appear on several sheets; they are one physical component, not additional devices.

### DG14-01 — INFO

Byte 0 DQ/DM 3D paths span 11.011–25.973 mm. DQS0 P/N are 13.773/13.801 mm, both with four traversed via objects, for 0.028 mm mismatch. The largest positive equal-velocity DQ/DM offset is DQ7 at 73.119 ps; the most negative is −16.657 ps. These are path comparisons at assumed 6 ps/mm.

**Action:** Include all byte-0 data/mask/strobe channels and their real package delays in read and write timing analysis.

**Acceptance:** Byte-0 read/write eyes and training margins meet the selected part and controller requirements across PVT; no artificial 0.028 mm meander is added solely to zero a geometry number.

**Affected:** U1, U4; DDR3_DQS0P, DDR3_DQS0N, DDR3_DQ0, DDR3_DQ1, DDR3_DQ2, DDR3_DQ3, DDR3_DQ4, DDR3_DQ5, DDR3_DQ6, DDR3_DQ7, DDR3_DM0.

**Evidence:** [differential-revision/final/timing/ddr-timing-audit.md](../../differential-revision/final/timing/ddr-timing-audit.md), [differential-revision/final/ddr-paths.json](../../differential-revision/final/ddr-paths.json), [hardware/14-ddr_low-01.kicad_sch](../../hardware/14-ddr_low-01.kicad_sch).

### DG14-02 — HIGH

DQS1P and DQS1N are closely length matched (33.349 and 33.329 mm in 3D), but their existing paths traverse three and eight via objects respectively. P uses F/In5/B; N also includes In2. Pair parallel overlap is 73.8% with approximately 7.9 mm uncoupled copper per leg.

**Action:** Evaluate a more symmetric DQS1 layer/via topology and reduce separated segments where an extracted differential channel confirms benefit.

**Acceptance:** Extracted and measured differential response, common-mode conversion, timing and return continuity improve while native connectivity and manufacturability remain intact.

**Affected:** U1, U4; DDR3_DQS1P, DDR3_DQS1N.

**Evidence:** [differential-revision/final/timing/ddr-timing-audit.md](../../differential-revision/final/timing/ddr-timing-audit.md), [reports/differential-review.md](../../reports/differential-review.md), [differential-revision/final/pair-references.json](../../differential-revision/final/pair-references.json).

### DG14-03 — MEDIUM

Byte 1 DQ/DM paths span 35.296–45.345 mm, with 11.745–72.037 ps offset from mean DQS in the equal-velocity case; DQ11 is the largest positive offset. The retained-reference review also identifies narrow finite-width ground-edge loss beneath DQ11.

**Action:** Prioritize DQ11 and the byte-1 reference/transition topology together; do not treat the edge-area finding as measured eye closure.

**Acceptance:** All byte-1 channels meet full electrical timing and return-path checks, including the repaired/reference-edge geometry.

**Affected:** U1, U4; DDR3_DQ8, DDR3_DQ9, DDR3_DQ10, DDR3_DQ11, DDR3_DQ12, DDR3_DQ13, DDR3_DQ14, DDR3_DQ15, DDR3_DM1.

**Evidence:** [differential-revision/final/timing/ddr-timing-audit.md](../../differential-revision/final/timing/ddr-timing-audit.md), [differential-revision/final/return-reference-assessment.json](../../differential-revision/final/return-reference-assessment.json).

**Startup:** U4 byte behavior begins only after DDR rail, reset, clock and loader training. None of the digital lane output states is simulated during rail startup.

**Steady state:** DQ and DM signal voltages/currents are unknown time functions; the common VCC_DDR rail is 1.342245 V in run-0027. That does not imply every signal remains at that voltage or carries rail current.

**Transient:** Read and write directions swap driver/receiver roles. Simultaneous switching, ODT settings, DLL timing, crosstalk and package delay must be included; a single DC connection check covers neither direction.

**EMI / EMC:** DQS1 transition asymmetry is a concrete candidate for mode conversion and reference discontinuity review, not a quantified emissions failure. DQS0 has 83.8% geometric parallel overlap and still has short uncoupled escapes.

**Thermal:** Byte-lane activity and ODT losses are not available. U4 remains temperature-unknown and must not inherit the separate L219 thermal illustration.

**Required models and evidence:** U4 and RK3566 IBIS/package models, read/write timing/ODT/training settings, actual material loss and full aggressor/return geometry.

**Proposed work for a future change task:**

- Assess a symmetric DQS1 transition topology with extracted channels.
- Review DQ11 return coverage and byte-0 DQ7/byte-1 DQ11 offsets against real package-aware timing.

## s15: DDR3L byte lanes 2 and 3 / U5

All 22 U5 data/mask/strobe signals are connected. The strongest geometry priorities are byte 3 data spread and byte 2 strobe transitions; neither currently establishes an electrical timing pass or fail.

**Physical members on this sheet:** U1, U5. Multi-unit ICs appear on several sheets; they are one physical component, not additional devices.

### DG15-01 — HIGH

Byte 3 DQ/DM paths span 11.758–29.544 mm, a 17.786 mm spread. Their equal-velocity offsets from mean DQS3 range 16.421–123.139 ps; DQ31 is the largest positive offset. Moving both DQS3 legs together would shift all offsets but would not narrow that DQ/DM spread.

**Action:** Evaluate the longest byte-3 routes, especially DQ31, against package-aware trained timing before selecting shorter routes or intentional matching.

**Acceptance:** All byte-3 read/write margins pass the selected electrical timing model and PVT tests; changes preserve strobe pairing and avoid dense independent-leg meanders.

**Affected:** U1, U5; DDR3_DQ24, DDR3_DQ25, DDR3_DQ26, DDR3_DQ27, DDR3_DQ28, DDR3_DQ29, DDR3_DQ30, DDR3_DQ31, DDR3_DM3, DDR3_DQS3P, DDR3_DQS3N.

**Evidence:** [differential-revision/final/timing/ddr-timing-audit.md](../../differential-revision/final/timing/ddr-timing-audit.md), [hardware/15-ddr_high-01.kicad_sch](../../hardware/15-ddr_high-01.kicad_sch).

### DG15-02 — MEDIUM

DQS3 P/N are wholly on F.Cu with zero traversed vias and 8.938/9.103 mm paths. The 0.165 mm mismatch is the largest remaining DDR strobe geometry mismatch, but its 79.0% parallel overlap is substantially better than earlier revisions. There is no obtained manufacturer PCB skew limit that makes 0.165 mm by itself a failure.

**Action:** Keep the short F.Cu topology as a candidate and tune only if extracted differential delay/timing requires it.

**Acceptance:** Full channel timing and coupling are qualified; any tuning improves delay balance without degrading spacing, return continuity or manufacturability.

**Affected:** U1, U5; DDR3_DQS3P, DDR3_DQS3N.

**Evidence:** [differential-revision/final/timing/ddr-timing-audit.md](../../differential-revision/final/timing/ddr-timing-audit.md), [reports/differential-review.md](../../reports/differential-review.md).

### DG15-03 — HIGH

DQS2 uses six traversed via objects per leg and 22.149/22.277 mm total paths, with 0.127 mm mismatch. Parallel overlap is 62.7%, with 6.084/6.211 mm uncoupled copper. A reviewed DQS2N transition at normalized (24.2,17.4) mm has its nearest listed compatible ground via 3.202 mm away; this is a geometric proximity measurement only.

**Action:** Review DQS2 return transfers and separated segments with native planes; consider symmetric routing and local return stitching only after electrical and drill-stack review.

**Acceptance:** Extracted return impedance and differential/common-mode response meet the channel requirements, with no newly introduced drill or stack-interface conflict.

**Affected:** U1, U5; DDR3_DQS2P, DDR3_DQS2N, GND.

**Evidence:** [differential-revision/final/timing/ddr-timing-audit.md](../../differential-revision/final/timing/ddr-timing-audit.md), [differential-revision/final/pair-references.json](../../differential-revision/final/pair-references.json), [differential-revision/final/return-reference-assessment.json](../../differential-revision/final/return-reference-assessment.json), [reports/differential-review.md](../../reports/differential-review.md).

**Startup:** U5 reset and training must be validated independently from U4 because its branch lengths and byte topology differ. The stored rail model supplies neither DQS waveform nor training state.

**Steady state:** Byte 2 DQ/DM paths span 15.930–22.226 mm and have −37.701 to +0.078 ps equal-velocity offsets from DQS2; DM2 is most negative. These are diagnostic geometry comparisons, not signed setup/hold slack.

**Transient:** Byte 3 has the largest data-path spread while DQS3 has the simplest strobe layer topology. The optimization target must be actual trained timing and signal quality, not uniform millimeters across unrelated signals.

**EMI / EMC:** DQS2 transition/return geometry and byte-3 crosstalk require an extracted network. The existing U7 B/H map has no valid current excitation for either byte.

**Thermal:** U5 activity/ODT power and junction temperature are unknown. Do not split the shared 0.646 A modeled DDR-rail current into arbitrary U4/U5 or lane currents.

**Required models and evidence:** U5/RK3566 package timing and IO models, configured bit/byte mapping and training, actual stack/return extraction and aggressor states.

**Proposed work for a future change task:**

- Prioritize DQ31 and the byte-3 spread in timing extraction.
- Review DQS2 transition returns and coupling; retain the short DQS3 F.Cu topology unless electrical evidence supports a revision.

## s16: DDR3L supply, VREF and ZQ networks

The physical reference topology matches DDR3L use: one shared VCC_DDR supply, a separate precision VREFCA divider, SoC-generated VREFDQ and separate calibration resistors. The references are not dynamically solved by the current rail model.

**Physical members on this sheet:** C17, C18, C19, C20, C21, C22, C23, C24, C25, C26, C400, C401, C402, C403, C404, C405, C406, C407, C408, C409, C410, C411, C412, C413, C414, C415, C416, C417, C418, C419, C420, C421, C422, C423, C424, C425, C426, C427, C428, C429, R1, R400, R401, R402, R403, U1, U4, U5. Multi-unit ICs appear on several sheets; they are one physical component, not additional devices.

### DG16-01 — INFO

Each DRAM has 18 VCC_DDR and 21 GND pins, with four explicit NC balls (J1/J9/L1/L9). U1 has 13 DDRPHY supply balls on VCC_DDR. This sheet supplies 48.5 µF nominal rail bypass; the complete board rail has 92.6 µF, represented as 64.82 µF in run-0027.

**Action:** Qualify the actual rail/capacitor model and load profile including both DRAMs, the SoC PHY and ODT/refresh activity.

**Acceptance:** The complete shared rail meets 1.283–1.417 V at both DRAM/SoC pin groups under startup, refresh, burst traffic and memory stress. The 1.417 V upper bound comes from the SoC and is tighter than the ISSI 1.45 V supply limit.

**Affected:** U1, U4, U5, C17, C20, C21, C25, C26, C412, C427; VCC_DDR, GND.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [references/soc-memory/memory-verification.json](../../references/soc-memory/memory-verification.json), [hardware/16-ddr_power-01.kicad_sch](../../hardware/16-ddr_power-01.kicad_sch).

### DG16-02 — HIGH

R402/R403 are 1 kΩ, 0.1%, giving unloaded VREFCA = VCC_DDR/2. C413+C428 = 200 nF yields 500 Ω Thevenin resistance and a nominal 100 µs time constant (70 µs under uniform 0.7 derating). At the stored 1.342245 V rail, ideal DC VREFCA is 0.671122 V; worst opposing resistor tolerances alone give a divider ratio of 0.4995–0.5005. Neither input leakage nor VREF noise is included.

**Action:** Add a loaded reference model including both DRAM inputs, capacitor tolerance/leakage and actual supply/reference return paths.

**Acceptance:** VREFCA tracks the specified fraction of VDD with noise and settling within the exact ISSI limits at both M8 pins during power ramp and all traffic modes.

**Affected:** R402, R403, C413, C428, U4, U5; DDR3_VREFCA, VCC_DDR.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [references/soc-memory/issi-ddr3l.txt](../../references/soc-memory/issi-ddr3l.txt), [hardware/16-ddr_power-01.kicad_sch](../../hardware/16-ddr_power-01.kicad_sch).

### DG16-03 — HIGH

DDR_VREFOUT drives both U4.H1 and U5.H1 as VREFDQ, with C414/C429 totaling 200 nF. It is not another ideal fixed 0.675 V rail in the saved solver. The source output impedance, startup, permitted capacitive load and programmed calibration must be established.

**Action:** Obtain the RK3566 VREFOUT characteristics and actual loader setting, then model or measure both VREFDQ loads and probe loading.

**Acceptance:** Both H1 pins satisfy the applicable VREFDQ level/noise/settling limits throughout initialization, training and data transfer without loading the source outside its specification.

**Affected:** U1, U4, U5, C414, C429, TP35; DDR_VREFOUT.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt), [hardware/16-ddr_power-01.kicad_sch](../../hardware/16-ddr_power-01.kicad_sch).

### DG16-04 — MEDIUM

R1 = 120 Ω, 1% connects the SoC DDR_RZQ to GND; R400/R401 = 240 Ω, 1% independently connect U4/U5 ZQ to GND. These are calibration networks, not DC rail loads: VCC_DDR/RZQ is not their continuous current.

**Action:** Qualify precision resistor ordering codes over temperature and include actual ZQ calibration behavior in the DDR bring-up plan.

**Acceptance:** Calibration completes reliably and output/ODT impedance meets the configured requirements over operating corners; resistor currents/power come from the driven pin waveform.

**Affected:** R1, R400, R401, U1, U4, U5; DDR_RZQ, U4_DDR_ZQ, U5_DDR_ZQ.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt), [references/soc-memory/issi-ddr3l.txt](../../references/soc-memory/issi-ddr3l.txt).

### DG16-05 — HIGH

The exact selected IS43TR16512BL-125KBLI ordering code is an industrial device with case-temperature range −40 to 95 °C. The retained ISSI specification requires 7.8 µs average refresh interval up to 85 °C and 3.9 µs above 85 °C within this grade. The saved 25 °C ambient parameter is not a DRAM case-temperature measurement and supplies no refresh-state verification.

**Action:** Qualify DRAM case temperatures and configure a supported refresh policy for the entire permitted case-temperature range, including the resulting extra refresh power.

**Acceptance:** Both devices remain within their case-temperature grade and receive the required refresh rate at every supported condition; retention/memory stress tests cover the warmest permitted case.

**Affected:** U4, U5; VCC_DDR.

**Evidence:** [references/soc-memory/issi-ddr3l.txt](../../references/soc-memory/issi-ddr3l.txt), [hardware/design-spec.json](../../hardware/design-spec.json).

**Startup:** VCC_DDR reaches the model 95% level at 16.945 ms. VREFCA has an additional physical RC trajectory and VREFDQ has a separate internal-source trajectory; neither is validated by the system RESETn release at 40 ms.

**Steady state:** Run-0027 gives VCC_DDR 1.342245 V and an aggregate 0.646264 A, leaving 59.245 mV above the 1.283 V lower bound. The ideal divider draws 0.671122 mA and dissipates approximately 0.4504 mW in each 1 kΩ resistor; this analytic branch is not an extra DRAM-current measurement.

**Transient:** Reference tracking, ODT switching, refresh steps, rail anti-resonance and VREF return noise are missing. DC capacitor headroom below 6.3/16 V ratings does not establish bias capacitance or high-frequency effectiveness.

**EMI / EMC:** Keep VREFCA/VREFDQ return paths quiet in the actual filled-plane context. The separate reference sources cannot be merged simply because both nominally equal half the DDR supply.

**Thermal:** The modeled shared rail delivers approximately 0.867 W, covering assumed memory/PHY loads. Individual DRAM heat and reference-buffer temperature remain unknown; divider resistor dissipation is the only narrow DC thermal input computed here. The selected industrial memory case-temperature limit is 95 °C; the refresh interval must be shortened above 85 °C, independently of whether the SoC is throttling.

**Required models and evidence:** RK3566 VREFOUT output/load model, DRAM VREF input/leakage/noise limits under selected modes, capacitor DC-bias/ESL/ESR and per-device dynamic current/thermal models.

**Proposed work for a future change task:**

- Qualify exact divider/ZQ and bulk capacitor parts.
- Extend the model with separate loaded VREFCA and VREFDQ startup/noise behavior.
- Qualify the shared DDR rail at all three physical consumers, without allocating arbitrary per-chip currents.
- Qualify the DRAM case-temperature/refresh policy, including the 85 °C refresh transition or a supported conservative refresh setting.

## s17: 24 MHz clock, reset and boot straps

The oscillator topology and reset/strap connections are explicit, but the crystal ordering code is still unqualified. A previously hidden analog limitation is the total 200 nF reset load across sheets 07 and 17; the current digital reset trace does not model it.

**Physical members on this sheet:** C80, C81, C82, R2, R3, R5, R6, U1, Y1. Multi-unit ICs appear on several sheets; they are one physical component, not additional devices.

### DG17-01 — HIGH

Y1 is only specified as 24 MHz, 12 pF. C80 and C81 are 18 pF C0G, giving an ideal series load of 9 pF before pin/PCB stray capacitance; reaching a 12 pF load would require approximately 3 pF additional effective stray. R2 = 22 Ω and R3 = 1 MΩ are present. No exact crystal ESR, drive-level or startup model is available.

**Action:** Select the exact crystal and validate loading, negative-resistance/startup margin and drive level; retain the manufacturer-required 22 Ω/1 MΩ topology while choosing capacitors from the qualified load.

**Acceptance:** Oscillation starts over voltage/temperature/aging corners, meets frequency accuracy and crystal drive rating, and provides the clock required before reset release. The 18 pF values are supported by actual load extraction or measurement.

**Affected:** Y1, R2, R3, C80, C81; XIN24M, XOUT24M, XTAL24_OUT.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt), [hardware/17-soc_clock-01.kicad_sch](../../hardware/17-soc_clock-01.kicad_sch).

### DG17-02 — MEDIUM

Fresh native paths give U1.AD37→Y1.3 = 8.441 mm and U1.AD37→C81.1 = 10.106 mm, all F.Cu with no vias. U1.AD38→R2.1 is 2.308 mm. The XIN path is not geometrically symmetric with XOUT and its load cannot be represented by the two capacitor labels alone.

**Action:** Review a shorter, quieter oscillator placement/return arrangement using measured or extracted parasitic capacitance; do not assume trace equality itself is a crystal requirement.

**Acceptance:** The revised or retained layout passes oscillator startup, frequency/drive and coupled-noise checks and preserves both crystal ground connections.

**Affected:** U1, Y1, C80, C81, R2, R3; XIN24M, XOUT24M, XTAL24_OUT.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/rk3566-sbc.kicad_pcb](../../hardware/rk3566-sbc.kicad_pcb).

### DG17-03 — HIGH

RESETn has R221 = 10 kΩ to VCC3V3_PMU and both C240 and C82 = 100 nF populated, for a 2.0 ms ideal pull-up time constant and approximately 4.394 ms 10–90% rise (1.4/3.076 ms with uniform 0.7 capacitance factor). U2.67→U1.AG38 is 54.074 mm in the native 3D path graph. The saved RESETn waveform changes digitally at 40 ms and includes none of this analog release behavior.

**Action:** Model the actual wired reset network with PMIC/SoC sink, leakage and thresholds, and verify its release and watchdog/thermal assertion at U1. Preserve both local reset capacitors pending explicit source-backed review.

**Acceptance:** VIL/VIH, permitted rise time, minimum assertion and continuous power-good hold are met at all reset receivers across corners; no conflicting active-high driver or slow threshold chatter exists.

**Affected:** U1, U2, R221, C240, C82, R238, TP215; RESETn, VCC3V3_PMU, TSADC_SHUT_M0.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/07-pmic_control-01.kicad_sch](../../hardware/07-pmic_control-01.kicad_sch), [hardware/17-soc_clock-01.kicad_sch](../../hardware/17-soc_clock-01.kicad_sch), [simulation/engine.py](../../simulation/engine.py).

### DG17-04 — INFO

R5 pulls SDMMC0_DET_L high through 10 kΩ to PMU 3.3 V, selecting the documented JTAG/UART mux state rather than SD-card-present mode. R6 bonds DFT_TEST_GND to GND. These strap connections are present, but their actual sampled levels are not simulated.

**Action:** Preserve the intended strap states and include reset-sampling and recovery behavior in bring-up verification.

**Acceptance:** The straps reach documented input levels before sampling and remain valid during reset; debug capability matches the actually routed pins.

**Affected:** U1, R5, R6; SDMMC0_DET_L, DFT_TEST_GND.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

**Startup:** The simulator does not solve crystal startup, oscillator amplitude or PLL lock. The reset candidate has 19.15 ms between its modeled final stable rail and digital release, but this must be reconciled with the analog reset network and real clock availability.

**Steady state:** Oscillator node voltages, crystal current and R2/R3 AC dissipation are unknown. It would be incorrect to display the 1.8 V rail value as the XIN/XOUT waveform or infer crystal current from 24 MHz alone.

**Transient:** R238 directly links the low-asserting TSADC shutdown signal to the reset network through 0 Ω. Pin mode, open-drain compatibility and rail-collapse behavior must be verified together with the RC release, not as independent ideal digital events.

**EMI / EMC:** The all-F.Cu crystal route avoids signal vias, but the 8.441 mm XIN connection remains a coupling-sensitive analog path. Its actual loop, shield/return and aggressors must be considered before any EMI conclusion.

**Thermal:** Crystal overdrive and oscillator startup depend on the exact part and temperature. No crystal temperature or dissipation is available; the separate L219 thermal model has no relevance here.

**Required models and evidence:** Qualified Y1 motional equivalent circuit/ESR/load/drive specification; RK3566 oscillator model; reset sink/leakage/threshold/rise-time characteristics and actual startup clock/PLL timing.

**Proposed work for a future change task:**

- Select and qualify the exact Y1 ordering code and C80/C81 effective load.
- Review shortening/quieter routing of the XIN network if the load/noise analysis supports it.
- Add the full 200 nF wired-reset RC model and validate at U1; do not delete reset capacitors just to accelerate the curve.

## s18: Removable 8 / 16 GB eMMC module

The 34-pin signal connector pinout and 30-pin mechanical support match the retained Radxa module definition, and all measured host signals are connected. The exact module silicon, operating mode and connector/module channel remain unqualified.

**Physical members on this sheet:** C431, C432, C433, C434, J1, J2, R14, R20, R21, R22, R23, R24, R25, R26, R27, R28, R29, R4, U1. Multi-unit ICs appear on several sheets; they are one physical component, not additional devices.

### DG18-01 — INFO

J1 supplies 1.8 V on pins 12/20/21 and 3.3 V on 22/23, with eight data, CMD, CLK and strobe signals. J2 has 30 explicit no-connect electrical pads because it is the module support connector. R20/R21 provide populated 10 kΩ CMD/D0 pull-ups; R22–R28 and R29 are DNP reservations, consistent with the documented host topology.

**Action:** Qualify the exact 8 GB and 16 GB module ordering codes and preserve the connector/keying and populated/DNP intent.

**Acceptance:** Both modules mate correctly, enumerate, boot and pass read/write/power-cycle tests; support contacts remain intentionally unwired and neither module requires a missing host signal.

**Affected:** J1, J2, R20, R21, R22, R23, R24, R25, R26, R27, R28, R29; EMMC_CMD, EMMC_D0, EMMC_DATA_STROBE, VCC_1V8, VCC_3V3.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [references/soc-memory/radxa-emmc-brief-rev1.1.txt](../../references/soc-memory/radxa-emmc-brief-rev1.1.txt), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt), [references/soc-memory/radxa-emmc-pinmap.json](../../references/soc-memory/radxa-emmc-pinmap.json), [hardware/18-emmc-01.kicad_sch](../../hardware/18-emmc-01.kicad_sch).

### DG18-02 — HIGH

R4 pulls FLASH_VOL_SEL high to PMU 3.3 V, matching the 1.8 V VCCIO2/eMMC IO domain. Run-0027 reaches 95% on 1.8 V at 9.135 ms but the module 3.3 V rail at 18.975 ms, a 9.840 ms separation. This is not inherently a power-order violation, but the model contains no CMD timing or partial-power IO-clamp behavior.

**Action:** Verify the high strap during reset and enforce command/startup behavior only after both module rails are stable; model the exact module during partial power and power-off replacement.

**Acceptance:** The chosen module and host meet their powered/off IO limits and both-rail startup requirements; command activity and wake-up never precede stable supplies.

**Affected:** U1, J1, R4, C431, C432, C433, C434; FLASH_VOL_SEL, VCC_1V8, VCC_3V3, EMMC_CMD.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/design-spec.json](../../hardware/design-spec.json), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt), [hardware/18-emmc-01.kicad_sch](../../hardware/18-emmc-01.kicad_sch).

### DG18-03 — HIGH

Fresh native 3D host paths span 14.263–21.704 mm for D0–D7 (7.441 mm spread), 33.448 mm for CMD and 25.697 mm for strobe. The two copper sections of CLK total 17.753 mm before/after R14, excluding the resistor body span. Signal paths use differing F/B/In2/In5 allocations and one or two traversed via objects. These host-only lengths omit SoC package, connector and module traces.

**Action:** Extract the complete host/connector/module channel for the selected transfer mode, including package delays, clock series resistor, pulls and real module load.

**Acceptance:** Read/write timing and signal-quality requirements pass for each qualified module and allowed bus speed; no arbitrary length-equality target replaces actual timing.

**Affected:** U1, J1, R14; EMMC_D0, EMMC_D1, EMMC_D2, EMMC_D3, EMMC_D4, EMMC_D5, EMMC_D6, EMMC_D7, EMMC_CMD, EMMC_CLK_SOC, EMMC_CLK, EMMC_DATA_STROBE.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [hardware/rk3566-sbc.kicad_pcb](../../hardware/rk3566-sbc.kicad_pcb).

### DG18-04 — MEDIUM

R14 is the exact 22 Ω Yageo RC0201FR-0722RL clock series resistor, 50 mW at 70 °C per retained part qualification. The earlier 23.53 mW C·V²·f example assumes 30 pF, 1.98 V and 200 MHz and is not its measured dissipation. TP62/TP63 have 0.2245 mm extra existing-metal path from the main clock/D0 channel to the probe endpoint in the graph; pad/probe capacitance remains additional.

**Action:** Include resistor loss/temperature derating and test-pad/probe loading in the full channel; demonstrate recovery with the available D0/CLK probes.

**Acceptance:** R14 remains within power/voltage/temperature ratings at the actual edge/load conditions and probes do not invalidate timing; corrupt-media Maskrom recovery is demonstrated.

**Affected:** R14, TP62, TP63; EMMC_CLK, EMMC_D0.

**Evidence:** [simulation/section-review/digital-evidence.json](../../simulation/section-review/digital-evidence.json), [research/r14-emmc-clock-0201.md](../../research/r14-emmc-clock-0201.md), [hardware/design-spec.json](../../hardware/design-spec.json).

**Startup:** The module has two separate supplies and no dedicated reset contact in this connector map. C431/C432 give 10.1 µF local nominal 3.3 V bypass; C433/C434 give 4.8 µF on 1.8 V. Inrush and card-internal sequencing cannot be inferred from those host capacitors alone.

**Steady state:** Run-0027 host rail values are 3.265843 V and 1.798561 V. The shared rail currents include other SoC consumers and are not eMMC current. If CMD or D0 is held low, its populated 10 kΩ pull draws about 0.180 mA and dissipates 0.3235 mW at the stored 1.8 V rail; high-state leakage is not that value.

**Transient:** Boot negotiation, high-speed mode changes, strobe operation, erase/program current peaks, sleep and power-fail data integrity are not simulated. The intended removable module swap remains a power-off operation.

**EMI / EMC:** The off-board connector/module changes the return and common-mode path. The board-only U7 magnetic field example cannot predict eMMC cable/module radiation or high-speed channel quality.

**Thermal:** Module silicon and package are not identified by capacity alone. No 8/16 GB module temperature or R14 waveform loss has been calculated; the local L219 thermal illustration must not color J1/J2 as storage temperature.

**Required models and evidence:** Exact 8/16 GB module silicon/firmware/temperature grades and power/timing limits; connector S-parameters or equivalent circuit, module/package trace delays, host/device IO models and firmware mode sequence.

**Proposed work for a future change task:**

- Qualify exact 8 GB and 16 GB module part numbers and bus modes.
- Build host-plus-module eMMC timing/SI and partial-power models, preserving the high FLASH_VOL_SEL strap.
- Validate R14 loss, probe loading and power-fail/recovery behavior before changing pulls, clock damping or routing.

## Primary-source basis and scope

Manufacturer-authored retained sources were used for requirements; project geometry and algebra supply the section-specific numerical findings. The [Rockchip RK3566 V1.2 data sheet](https://rockchip.fr/RK3566%20datasheet%20V1.2.pdf) is retained at `references/rk3566-v1.2.pdf`. The [Rockchip hardware design guide V1.1](https://dl.xkwy2018.com/downloads/RK3568/RK356X/Hardware/Rockchip_RK3566_Hardware_Design_Guide_V1.1_EN.pdf) is retained at `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.pdf`. These are manufacturer-authored documents hosted by public mirrors; this review does not claim they replace the exact silicon/support package.

The ISSI memory specification is retained at `references/soc-memory/ISSI-43-46TR16512B-81024BL.pdf`, sourced from the [ISSI-authored Rev C document](https://www.uttc.com.tw/wp-content/uploads/2025/12/43-46TR16512B-81024BL.pdf). Its startup requirements, reference constraints and supply range apply to the selected DRAM; its device speed grade does not qualify the custom PCB rate. The [Radxa eMMC module brief](https://dl.radxa.com/accessories/emmc-module/rad-doc-0126_radxa_emmc_module_product_brief__revision_1.1_g69c4d5d.pdf) is retained in `references/soc-memory/radxa-emmc-brief-rev1.1.pdf`; it establishes connector roles/pinout and capacity options, not exact storage-silicon timing or power.

The next task should first resolve exact parts/firmware/stackup, then extract and benchmark the relevant channels/PDNs, and only then apply evidence-backed changes. Do not auto-populate DNP damping/pulls, delete reset bypass, reassign unused pins or force DDR length equality from this review alone. No emissions compliance, boot success, memory eye, die temperature or fabrication release is claimed.
