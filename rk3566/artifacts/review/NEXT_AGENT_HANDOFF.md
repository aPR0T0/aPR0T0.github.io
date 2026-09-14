# RK3566 revision 4 — simulation conclusions and next-agent work

**Objective:** establish which remaining issues are real circuit limitations, which depend on missing device or system data, and which are intentional fault tests. Improve the design or model only when supported by that evidence. Keep the web app and saved results reproducible. This handoff was prepared without changing hardware.

**Workspace:** `/home/candy/eyecandy/general-electronics/radxa-cm3-carrier-board/design-revision/rk3566-sbc-rev4`. All paths below are relative to this directory.

**Whole-board section review, 2026-09-14:** [WHOLE_BOARD_ANALYSIS.md](WHOLE_BOARD_ANALYSIS.md) now covers all 26 native functional sections, 422 electrical references, 1,890 pins and 94 source-based observations. Its explicit reference cases are run-0004 and run-0027. Use [NEXT_PCB_REVISION_TASK.md](NEXT_PCB_REVISION_TASK.md) as the standalone brief for the future revision proposal; it includes all section findings and acceptance criteria while preserving the historical campaign and H01–H09 below. The [All PCB sections view](http://127.0.0.1:8766/#sections) provides the interactive board, component/pin inspection and saved waveform comparison. Coverage does not establish full-board physics or increase PRV-1 readiness.

**Later professional review:** `simulation/PROFESSIONAL_REVIEW.md` assigns **2.5/10 full-board validation readiness** using its fixed PRV-1 evidence rubric, distinct from historical model scores. `simulation/professional/ONLINE_RUN_PLAN.md` and `simulation/professional/webench-request.json` prepare a manufacturer-supported online U7 study. The TPS566242 PSpice model has been obtained and audited but is encrypted; no new controller simulation is claimed. The WEBENCH form awaits the user's own acceptance of TI's terms. The current TCS4525 manufacturer page conflicts with the retained device reference on current rating and recommended inductance; H03 requires exact revision qualification before changing either the model or board. Preserve these distinctions when continuing the work.

**Interactive workspace:** [INTERACTIVE_WORKBENCH.md](INTERACTIVE_WORKBENCH.md) documents `#workbench`, its five selectable studies, native XY/proxy-height geometry, limited current/temperature/field overlays, startup reruns and PNG/JSON provenance exports. Preserve its source guards and unknown quantities when extending the interface. Improved presentation adds no physical-validation credit; browser acceptance evidence is separate from this usage guide. Include the guide, `workbench_data.py`, its tests, `web/workbench*` and `web/vendor/` when sharing the application. Use `python3 server.py --port 8766 --resume` from `simulation/` to retain a compatible saved current run.

**Frozen identity, 2026-09-14:**

- PCB: `hardware/rk3566-sbc.kicad_pcb`, SHA256 `3ba4da7036173e31941ea22b041d1a2a3433c2bcdedccf1a75b1f52b31ce2807`.
- Simulation engine: `simulation/engine.py`, SHA256 `e8981c307ede683836aa755d9e1bb3d182be0e42a5bc07f471682becbed18c2c`, model version `1.0.0`.
- Qualification campaign: `simulation/data/campaign.json`, **13 completed cases, run-0004 through run-0016; four cases failed scenario checks**. Full results are in `simulation/data/runs/`.
- Frozen nominal reference for this handoff: `run-0019`, nominal parameters, **model checks 9/10; hardware-evidence heuristic 2.85/10; hardware target not met**. `run-0004` is the campaign's nominal baseline. Earlier development runs `run-0001` and `run-0002` scored 10 under an older engine and are superseded, not current validation results.
- Existing hardware routing/readiness review: **7/10, NOT FOR FABRICATION** in `reports/final-readiness.json`. It uses a different rubric from the simulation scores.
- Inventory: **422 components, 405 populated, 17 DNP**, plus four mechanical holes. **All 16 ICs lack supplied validated internal electrical models.** BootROM, DDR training, firmware execution, RF operation, junction temperature and EMI/EMC compliance remain unverified.
- Fresh native DRC: **zero unconnected; 61 differential-gap, 8 uncoupled-length, 2 skew and 176 co-located-hole findings**. The five configured ignored checks remain recorded. The 176 stacked interfaces have zero recorded geometric exceptions; fabrication reliability is still unqualified.
- Verification already retained: **75 tests passed** in `simulation/data/test-results.txt`, including time-domain fields, video-data integrity, illustrative thermal-model checks and video streaming; four independent ngspice passive-network checks passed in `simulation/data/spice-validation.json`. These checks do not qualify the assembled board.
- Time-domain extension: `simulation/TIME_DOMAIN_EM_ANALYSIS.md` and `simulation/data/{time-domain.json,electric-field.json,em-cross-section-geometry.json}`. Four local U7 experiments provide current histories and conditional E/B/H contributions. All 18 circuit/magnetic checks and four electric checks pass within their stated scope. Full-board fields, actual converter startup and EMC remain unverified; historical scores are unchanged.
- Video delivery: `simulation/data/video/RK3566-Rev4-voltage-current-temperature.mp4`, 74 seconds at 1280 × 720/24 fps, with source manifest and raw input data in the same folder. The final chapter is an **illustrative L219 DCR-only thermal node**; all other component temperatures remain unknown. It is not a thermal qualification or a reason to increase the evidence score.

## What the completed campaign actually found

Default assumptions were 5 V input, 120 mΩ source/cable resistance, 4 A source ceiling, load scale 1.0, effective-capacitance factor 0.7, U7 soft-start parameter 1.39 ms, requested reset release 40 ms, ambient 25°C and integration step 5 µs over 160 ms. Loads and several response parameters are assumptions, not measured silicon behavior.

| Run | Change from default | Model score | Conclusion from the saved result |
|---|---|---:|---|
| 0004 | Nominal | 9 | Conditional model checks pass; unavailable light-load ripple earns no point. |
| 0005 | Input 4.75 V | 9 | Passes this isolated assumed input corner. |
| 0006 | Input 5.25 V | 9 | Passes this isolated assumed input corner. |
| 0007 | Source/cable resistance 250 mΩ | 9 | Passes this isolated resistance corner. |
| 0008 | Assumed loads ×1.4 | 9 | Passes this isolated load corner. |
| 0009 | Effective capacitance 40% | 9 | Passes the averaged model; does not establish controller stability. |
| 0010 | Ambient 70°C | 9 | Passes the loss-sensitivity model; no junction temperatures calculated. |
| **0011** | **Soft-start parameter 15 ms** | **5** | Active-window regulation and requested reset timing fail. |
| **0012** | **Requested reset at 5 ms** | **5** | Intentional early-reset test fails active-window regulation and requested reset timing. |
| 0013 | Assumed load step ×1.6 at 80 ms | 9 | Passes the declared activity step. |
| **0014** | **Input dip to 2.5 V from 80–100 ms** | **5.5** | Intentional brownout fails active-window regulation, source-capacity and regulator-input checks. |
| 0015 | Time step reduced to 2.5 µs | 9 | Retains nominal scenario result; inspect numerical convergence metrics separately. |
| **0016** | **4.75 V, 250 mΩ, loads ×1.4, capacitance 40%, 70°C** | **7** | Final regulation fails on the two modeled 5 V nets. |

**The combined corner needs careful interpretation.** In `run-0016`, `5V_SOC` reaches **4.248665 V** steady and `PMIC_AUDIO_5V` reaches **4.248525 V**, below the model's declared **4.5 V** floor. Modeled 5 V steady current is **2.005341 A**: approximately 0.5013 V is lost in the assumed 250 mΩ source/cable path. The U3 and U7 input-range checks still pass. `WIFI_VBAT` is **3.253686 V**, `VCC_DDR` **1.337284 V**, `VDD_CPU` **1.025 V**, and `VCC3V3_PMU` **3.298520 V**. This result does **not** demonstrate a DDR, Wi-Fi or CPU failure; the 4.5 V floor is a system scenario requirement that must be confirmed against the actual 5 V consumers and upstream source. Do not automatically raise a regulator setpoint, replace a part, or weaken the floor to erase this result.

In `run-0011`, all modeled core rails are first stable at **127.125 ms**, so the requested 40 ms release is too early by 87.125 ms; the **candidate** supervisor actually releases at **137.125 ms** after its 10 ms hold. The 15 ms parameter also scales other ramps, so this is not an identified RK809-5 timing specification. In `run-0012`, requested release is 5 ms, first stable time 20.86 ms and candidate actual release 30.86 ms. These runs establish the checker catches bad requests, not that the real PMIC follows the candidate supervisor.

In `run-0014`, the modeled active input falls to **2.491 V**, below TCS4525's 2.7 V and TPS566242's 3.0 V recommended input minima. The source reaches its assumed **4 A** ceiling during the event/recovery. The candidate reset releases again at **110.16 ms**, after a new 10 ms stable interval. Recovered steady rails do not turn this interrupted-operation run into a pass. Its normal-operation score should remain below 8; successful fault detection/recovery is a separate regression outcome.

## Work packages

Run the independent source, component, firmware and layout investigations in parallel. Coordinate any changes through the preserved source hash and a separate proposed revision; never mix new copper or new assumptions into the existing run history.

### P0 — H01: establish the actual input and load envelope

**Affected:** J120; `5V_SOC`; U7; U3; U140; FB201/`PMIC_AUDIO_5V`; external MCU power-board source and harness. Also J121's `3V3_PER`, `1V8_AUDIO`, `CAM_1V5`, `CAM_1V8`, `CAM_2V8`.

**Evidence:** `simulation/data/runs/run-0016.json`; audit finding `external-rails`; `hardware/design-spec.json`; `simulation/engine.py` `_catalog()`; `docs/connectors-and-testpoints.md`.

**Work:** identify upstream converter capability, source tolerance, connector/harness resistance and current limit across battery/input states and temperature. Replace aggregate rail-load assumptions with characterized startup, idle, CPU/GPU/NPU activity, DDR, Wi-Fi transmit, camera, display and speaker loads where available. Establish whether 4.5 V is the correct minimum at J120 and at each 5 V consumer. Audit powered-off injection paths because SOC_SDA/SCL pull up to external `3V3_PER`. Characterize external J121 rail sequencing separately from J120 current.

**Needed inputs/dependencies:** upstream board design/source specifications, exact cables/connectors, intended peripherals and speaker loads, measured or manufacturer activity-current envelopes. Model terms must be non-overlapping so downstream power is not counted twice.

**Done when:** the accepted source/load envelope has a provenance table, each boundary source has its own voltage/current/timing specification, and run-0016 is reproduced with supported parameters. Either demonstrate margin for the accepted operating envelope or propose a quantified source-path/design change. Report actual component-limit violations separately from a declared system-voltage-window violation. Validate any proposed change across the full original campaign.

### P0 — H02: qualify PMIC startup, reset, shutdown and CPU enable

**Affected:** U2 RK809-5; U3 TCS4525_WT; R222/R223/C242 (`PMIC_VDC`); R226/C251 (`CPU_EN`); R232/R233 (`CPU_VSEL`); R221/RESETn; R238/TSADC_SHUT_M0; VCC6 and VCC_RTC.

**Evidence:** audit IDs `pmic-otp`, `source-switch-conflict`; runs 0011/0012/0014; `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt` §§2.2.1.2–3 and 2.2.5; generic `rk809-datasheet-v1.01.txt`; `tcs4525.txt`.

**Work:** obtain the exact RK809-5 ordering/OTP table and compare every default rail, enable slot and reset delay with the native circuit. Do not apply the retained **RK809-1** default table to -5. Resolve the guide's -5 switch ratings of 2.1 A versus generic RK809's 1.5/3 A. Verify RTC first/highest non-audio input and retain the intentional VCC6/RTC connection to 5V_SOC. Model the VDC RC threshold and CPU enable from the real PMU3V3 ramp: R226 pulls CPU_EN up, C251 is DNP; CPU start is not an independent programmable delay. Confirm VSEL-low 1.025 V versus VSEL-high 1.15 V and approved firmware DVS settings.

**Needed inputs/dependencies:** supplier OTP/variant data and actual power-on/off waveforms; H01's boundary ramps. Exact supervisor behavior and operating limits must be separated from typical thresholds and model assumptions.

**Done when:** source or measurements show RESETn stays low for at least **10 ms after the last stable rail**, reset is asserted before power-off when PMUIO1 falls below **2.93 V**, and shutdown/recovery are supported by evidence. Warm reset's separate minimum is **100 cycles of 24 MHz**. Keep intentional bad-reset and brownout runs as negative tests. Real hardware reset/boot remains unverified until observed; a candidate supervisor waveform is insufficient.

### P0 — H03: select critical power parts and validate the power network

**Affected:** U3 TCS4525_WT; U7 TPS566242; L201–L205 (470 nH); L206 (240 nH); R227 (10 mΩ shunt); R10/R229 Kelvin feedback; L219; C382–C385; U2 LDOs; bulk/decoupling capacitors.

**Evidence:** audit IDs `cpu-inductor`, `pmic-inductors`, `capacitor-effective`, `cpu-shunt`, `pmic-thermal`; `power-revision/regulator-source-qualification.md`; `simulation/data/spice-validation.json`; `simulation/REFERENCES.md`; `simulation/professional/models/{README.md,model-audit.json}` and the retained manufacturer downloads.

**Work:** obtain exact MPNs, qualified host lands, tolerance, hot saturation, DCR and thermal-current curves for L201–L206. Qualify U3's exact device/revision before judging L206=240 nH: the retained TCS4525 Ver.1.0 reference states **5 A and 330/470 nH**, while the [current manufacturer page](https://www.tctek.cn/en/product/tcs4525/) states **6 A and 220/470 nH**. Its newly downloaded Ver.1.1 PDF is a one-page product brief with an embedded `EUP3265 ver1.1` title, not complete replacement electrical specifications. Obtain supplier revision/lot confirmation and complete application data or a validated matching controller model; the new page and brief alone establish neither that 240 nH is accepted nor that it requires replacement. Keep the saved 5 A/retained-reference analysis identifiable until this is resolved. Choose and derate R227: at the illustrative **5 A** point, it dissipates **0.25 W** with **50 mV** drop; the design requests at least a 0.5 W part or a demonstrated budget, and the actual accepted current must come from H01/U3 qualification. Preserve after-shunt Kelvin feedback, without assigning CPU power current to the sense branch. Import effective MLCC capacitance, ESR/ESL and interconnect parasitics. Qualify PMIC channel loading and thermal dissipation; VDDA0V9_PMU is **LDO3, 100 mA**, not 400 mA. With 5 V into 3.3 V LDOs, 100 mA dissipates approximately 0.17 W per channel.

**Needed inputs/dependencies:** exact part data and controller models, H01 load envelopes, H02 operating voltages, PCB thermal conditions. None of the 16 ICs has a qualified internal model used in the existing results. U7's encrypted TI PSpice transient model is now preserved under `simulation/professional/models/`, but its vendor reference has not been run and its exclusions prevent complete supply-current or temperature prediction. Follow `simulation/professional/ONLINE_RUN_PLAN.md` for the separate online comparison, or benchmark the unchanged vendor project in a compatible PSpice environment. Document unavailable models and use measured port behavior where appropriate rather than assigning invented individual currents.

**Done when:** critical-part BOM and power budget specify actual ratings with margin at accepted corners; effective capacitance and stability assumptions are verified; modeled versus measured output transients correlate within a declared tolerance. The existing ideal-PWM SPICE benchmark may verify passive arithmetic, but cannot close controller startup, stability, protection, saturation or thermal gates.

### P0 — H04: establish clocks, memory and a real firmware boot path

**Affected:** U1; Y1 and its crystal network; Y201/PMIC clock; R220 DNP; U4/U5 IS43TR16512BL; removable eMMC module/connectors and boot straps; PMIC/I²C firmware configuration.

**Evidence:** audit IDs `clock-selection`, `ddr-boot`; `references/soc-memory/issi-ddr3l.txt` §2.2.1; `references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt` clock/reset and eMMC sections; linked official U-Boot/Rockchip references in `simulation/REFERENCES.md`.

**Work:** select the exact 24 MHz and 32.768 kHz crystals and validate load/ESR/startup. R220 is intentionally DNP, so do not assume an assembled external SoC 32 kHz input. Obtain the approved RK3566 DDR3L template, package delays and loader/training configuration for this **2 GiB, two-x16, x32 rank**. Check DDR3_RESETn independently from RESETn: ISSI requires at least **200 µs** asserted reset with stable power, then at least **500 µs** before CKE activation plus the full initialization/ZQ sequence. Identify the exact removable eMMC SKU; check VCC/VCCQ and FLASH_VOL_SEL configuration before CMD. Build a board-specific firmware configuration and define serial diagnostics and recovery steps.

**Needed inputs/dependencies:** H01/H02/H03 verified power behavior; manufacturer DDR template/configuration; exact eMMC and crystal parts; bootable media/firmware sources; representative hardware for execution tests. Firmware preparation can run in parallel; boot claims require the hardware prerequisites.

**Done when:** retain cold/warm boot serial logs, DDR training output, memory stress results and storage tests for the accepted configuration. Record tested speed/temperature/voltage cases. A boot timeline or a generic RK3566 image is not a successful custom-board boot. Probe buffered clocks, not the sensitive PMIC crystal pins.

### P1 — H05: quantify Wi-Fi supply and RF installation margin

**Affected:** U6 AW-CM256SM, FB202, L207, Wi-Fi bypass parts, `WIFI_VBAT`, `VCCIO_WL`, module antenna connector/installation and enable/wake GPIOs.

**Evidence:** audit `wifi-headroom`; U6/FB202 metadata; AzureWave v1.9; regulator source review. The campaign's nominal Wi-Fi load is 0.2 A, whereas the prior **0.4 A** reference is a minimum current-capability note, not a measured transmit peak.

**Work:** characterize module-pad VBAT at actual transmit bursts and temperature. Combine preregulator reference/divider tolerances with ferrite DCR/bias, trace drop and transient response; the current sweep does not vary the actual feedback reference/divider tolerance. The calculated low preregulator corner **3.245 V**, less **20 mV** at an illustrative 0.4 A through FB202, leaves only about **25 mV** above the **3.2 V** module minimum before PCB/ripple losses. Verify VDDIO, enable timing, clock, wake GPIO directions and antenna operating conditions.

**Needed inputs/dependencies:** actual Wi-Fi burst profiles and exact RF installation; H01/H03 network models; vendor host-land/assembly approval.

**Done when:** demonstrate at U6 pin 9 that accepted operating corners stay within the module requirement, with documented dynamic margin and no unqualified current substitution. Any proposed supply or filter change must also respect the PMIC/SoC consumers and regulator stability. RF and EMC qualification remain separate.

### P1 — H06: close signal-integrity and fabrication evidence gaps

**Affected:** DDR clock/strobes/data, CSI, USB, eMMC paths; GND reference planes; eight-layer 2+4+2 stack-up; stacked microvias.

**Evidence:** `simulation/data/native-drc.json`; `reports/differential-review.md`; `reports/stacked01/inventory.json`; `differential-revision/final/timing/`; retained-reference review; audit IDs `differential-geometry`, `reference-cuts`, `hdi-qualification`.

**Work:** classify the 71 strict differential findings by actual channel/receiver requirements and analyze real package, connector and branch effects. Include reference-edge intrusions of **23.652 µm under DDR3_BA2** and **8.000 µm under DDR3_DQ11**, both 80 µm traces with covered centrelines. Obtain actual material/permittivity, copper thickness/roughness and fabricator impedance/process approval. Evaluate stacked-interface reliability rather than treating zero geometric exceptions as approval. Do not delete DRC rules or hide warnings to improve a score.

**Needed inputs/dependencies:** vendor package/IBIS/channel models; DDR template from H04; approved fabricator stack-up and HDI process. Routing changes depend on these criteria.

**Done when:** every retained finding has a source-based resolution or documented waiver, with extracted channel results or bench correlation against the declared interface speed. Preserve zero shorts/unconnected/physical-clearance errors, net and endpoint parity, mechanical fit and the exact proposed-revision hash. Fabrication release requires actual process acceptance.

### P1 — H07: define and execute complete-product EMI/EMC work

**Affected:** U7/U3/U2/Wi-Fi switching loops, reference returns, U140 speaker outputs/harness, external connectors, ESD paths, antenna, enclosure and cables.

**Evidence:** audit `emc-evidence`; native switch-node geometry in `simulation/data/electrical-audit.json`; TI SNVA755 reference; `simulation/data/spice-validation.json` scope limits; completed local time-domain results and work packages EM-01–EM-05 in `simulation/TIME_DOMAIN_EM_ANALYSIS.md`.

**Work:** establish applicable product jurisdiction, standard/class, operating modes, cable lengths, antenna and enclosure before setting limits. Build a field/return-path model where practical and perform precompliance measurements of conducted/radiated emissions and applicable immunity. For buck converters, analyze the input-capacitor/FET/return high-di/dt loop as well as the switch node. The eight recorded switch nets have no vias, but their lengths are not loop areas or emission amplitudes. Use real switching-edge spectra and measured common-mode paths; an illustrative 1/n harmonic plot is not receiver output. Verify protection against relevant ESD/EFT/surge/RF disturbances with the actual product test plan.

**Needed inputs/dependencies:** H01/H03 operating currents; H06 real stack-up; actual enclosure/harness/antenna; applicable test limits, calibrated equipment or laboratory access.

**Done when:** retain test configuration, raw traces, detector/bandwidth/test levels, pass margins and functional recovery evidence. A matched differential route or a 9/10 model score cannot close EMC. Choose mitigations only after identifying the measured coupling path, then repeat affected tests.

**Time-domain conclusions to carry forward:** the initialized U7 model settles to 1.579–2.422 A in L219 over its last five switching cycles. The abrupt 1→2 A load case produces a 3.151–3.386 V excursion. The unprotected fixed-PWM cold example reaches 20.22 A, beyond the constant-inductance model's valid range; it does not predict actual U7 startup. A programmed duty ramp limits its modeled peak to 2.624 A, but does not establish the real control law. Return-path assumptions materially change B/H. The local electric result uses verified coplanar grounds and reaches fixed-probe mesh/domain changes of 1.36%/1.99%; this is numerical convergence, not a full-board accuracy claim.

**Next EM work, in order:** retain EM-01 as the completed conditional baseline; acquire device or measured waveforms and solve U7's input-capacitor/commutation return loop (EM-02); extend to U3 and the opposite-face U2 input networks (EM-03); extract board PDN/plane/via current sharing and frequency-dependent current density with a qualified stack (EM-04); then add high-speed interfaces and the actual product harness/enclosure (EM-05). Each package's required inputs and acceptance evidence are listed in the analysis report. Do not move copper or substitute parts solely from a conditional map's color or a singular corner maximum.

### P1 — H08: maintain truthful model coverage and web reporting

**Affected files:** `simulation/engine.py`, `extract.py`, `board_view.py`, `audit.py`, `spice_check.py`, `server.py`, `web/`, `test_*.py`, `data/`.

**Evidence:** all saved runs and model hashes; all source audit findings; 75-test log and browser verification. The behavioral model covers 30 supply nodes; the separate detailed current/field experiments cover the declared local U7 subcircuit, not all signal networks or IC internals.

**Work:** add characterized models and source citations as H01–H07 supply them. Keep each component quantity marked calculated, partial, assumed, unknown or DNP; unknown current is `null`, not zero. Add stress/fault cases only with stated requirements. Preserve source hashes, engine hashes, time-step convergence, charge conservation, stage timing and original negative cases. Clearly distinguish requested reset time, candidate actual reset release, and measured hardware reset. Separate per-rail acceptance criteria from recommended limits and absolute maximums; CPU/GPU/NPU datasheet maximum operating voltage is not supplied by the retained table, and the **1.2 V absolute maximum is not a normal DVS target**.

**Needed inputs/dependencies:** source-qualified data from the other packages. Vendor-model availability is not assumed; characterize aggregate ports where internal models cannot be obtained. Keep inferred signal/component results explicitly incomplete.

**Done when:** every changed assumption/model is linked to evidence and a versioned result, the original campaign is reproducible, the web app displays all failures/unknowns and exports the underlying data, and applicable tests pass. Keep the independent SPICE benchmark labeled fixed 5 V/2 A ideal PWM; its assumed 3 mΩ ESR and 2 ns edges do not change with dashboard sliders. Historical scores remain attached to their original engines.

**Temperature/video follow-up for H03/H08:** `simulation/VIDEO_THERMAL_METHOD.md` defines the current illustration and required evidence. The assumed L219 node uses 25 K/W, 0.5 J/K and 25 °C ambient, driven by 56.705 mW of modeled DCR loss held for 60 seconds; its 26.406 °C result is not a component hotspot prediction. Obtain actual losses at the operating waveform and transient thermal response on the intended PCB, including mounting, surrounding dissipation, ambient and airflow. Replace the assumed node only with supported parameters and validation. Resolve capacitor part identities and package/board models before adding their temperatures or IC temperatures. Do not interpolate the one-node estimate into a board heatmap. Regenerate `video_data.py`, `thermal_video.py` and `render_video.py` in order when issuing a new recording, preserving the prior manifest and data.

### P2 — H09: reconcile documentation and issue a concrete next revision

**Affected:** `hardware/design-spec.json` descriptive fields, BOM sourcing/qualification fields, readiness documents, this action list and generated result links.

**Evidence:** audit `stale-metadata` and completed H01–H08 records. The current spec still describes revision 3/unplaced peripherals despite the saved revision 4 board.

**Work:** synchronize descriptive metadata and exact-part sourcing when those facts are established. Collect justified changes into a reviewable proposed revision with a change list, electrical rationale, affected net/part list, source references and validation results. Preserve this baseline and its unresolved results.

**Done when:** no metadata contradicts the proposed revision; each handoff task has a disposition and artifact; open manufacturer/bench inputs are explicit. Unfinished boot/EMC/process gates remain open in the release recommendation.

## Reproduction and evidence handling

Inspect the preserved campaign before launching anything: starting the service creates a fresh nominal run; starting a campaign appends new run IDs and updates the current campaign index. Preserve `simulation/data/` before a new campaign if a fixed index is required. The original `run-0004`–`run-0016` files retain their parameters and identities.

```sh
cd /home/candy/eyecandy/general-electronics/radxa-cm3-carrier-board/design-revision/rk3566-sbc-rev4
sha256sum hardware/rk3566-sbc.kicad_pcb simulation/engine.py
cd simulation
python3 -m unittest discover -s . -p 'test_*.py' -v
```

Recalculate one saved case without overwriting the recorded run or needing the web server:

```sh
python3 - <<'PY'
import hashlib, json
from pathlib import Path
from engine import simulate

case = json.loads(Path('data/runs/run-0016.json').read_text())
board = json.loads(Path('data/board.json').read_text())
assert board['sha256'] == case['source_sha256']
assert hashlib.sha256(Path('engine.py').read_bytes()).hexdigest() == case['engine_sha256']
result = simulate(board, case['parameters'])
print(json.dumps({
    'score': result['score'],
    'failed_checks': [c for c in result['checks'] if c['status'] == 'fail'],
    'failed_rails': [r for r in result['rails'] if r['status'] == 'fail']
}, indent=2))
PY
```

For a deliberately revised model, record the new hash and compare against the original result rather than bypassing the identity assertion and presenting it as reproduction. Change `run-0016` to 0011, 0012 or 0014 to inspect the other failed cases. Full saved traces are already in each JSON.

Rebuild generated evidence after an intentional source change, from `simulation/`:

```sh
python3 extract.py
python3 board_view.py
kicad-cli pcb drc --format json -o data/native-drc.json ../hardware/rk3566-sbc.kicad_pcb
python3 audit.py
python3 spice_check.py
python3 em_geometry_audit.py
python3 electric_field.py
python3 time_domain.py
python3 -m unittest discover -s . -p 'test_*.py' -v
python3 server.py --port 8766 --campaign
```

The application is at `http://127.0.0.1:8766/`. If it is already running, use its existing **Run validation sweep** control; do not start a second process on the same port. Restart after engine changes so the loaded model and recorded hash agree. `extract.py` needs KiCad's `pcbnew` and `kicad-cli`; the independent SPICE benchmark uses installed `libngspice.so.0`. See `simulation/README.md` for the export behavior and `simulation/REFERENCES.md` for source details.

## Minimum files to give another agent

This file is sufficient to explain the assignment, but numerical reproduction needs source files. Preserve the relative directory structure under `rk3566-sbc-rev4/`; a screenshot or this document alone cannot reconstruct the circuit.

- **To review conclusions:** this file, `simulation/README.md`, `simulation/REFERENCES.md`, and `simulation/data/{board.json,board-layout.json,electrical-audit.json,campaign.json,latest-result.json,source-hashes.json,native-drc.json,spice-validation.json,test-results.txt}` plus `simulation/data/runs/run-0004.json` through `run-0016.json`. Include `run-0019.json` to retain the exact nominal snapshot cited here.
- **For the new current/field conclusions:** also include `simulation/TIME_DOMAIN_EM_ANALYSIS.md`, `simulation/data/{time-domain.json,electric-field.json,em-cross-section-geometry.json,time-domain-browser-validation.json}`, and both `simulation/data/time-domain/` and `simulation/data/electric-field/`. The full grids and adaptive-step currents preserve the evidence behind the plotted display samples. The complete simulation folder includes their generators and independent tests.
- **For video and temperature work:** include `simulation/VIDEO_THERMAL_METHOD.md`, `simulation/data/video/` with its MP4, `video-manifest.json`, `video-data.json`, `thermal-data.json`, and the three video generator scripts/tests. The electrical and thermal chapter clocks and assumptions must remain distinct.
- **For the professional review and next controller study:** include `simulation/PROFESSIONAL_REVIEW.md`, `simulation/professional/{ONLINE_RUN_PLAN.md,ONLINE_SOLVER_OPTIONS.md,webench-request.json,review-status.json}`, and `simulation/professional/models/{README.md,model-audit.json,TPS566242-original-header.txt,verification.json}` plus the `*-download.json` and `*-files.json` provenance records. Preserve the original vendor archives and their notices where available to the receiving agent; otherwise use the recorded official URLs to retrieve them and verify hashes. Include the retained TCS4525 manufacturer page, one-page PDF and metadata alongside `references/power-wifi/tcs4525.txt` so the revision conflict is visible. A model download or prepared online form is not an executed result.
- **To rerun the app and tests:** add the full `simulation/` code/web/test folder and **`hardware/`** with its PCB, project, all hierarchical schematics, custom symbols, library tables, BOM, design specification and layer configuration. The source-hash manifest identifies required extraction inputs; omitting a child schematic breaks source validation. Include `simulation/data/board-layout.json` for the hash-matched Board view, or regenerate it with `python3 board_view.py`. Screenshot images and Python caches are optional.
- **To rerun the source audit:** add `reports/final-readiness.json`, `reports/stacked01/inventory.json`, `differential-review.json`, `docs/design-readiness.md`, `power-revision/regulator-source-qualification.md`, `references/rk3566-v1.2.txt`, `references/soc-memory/issi-ddr3l.txt`, and `references/power-wifi/{rk3566-hardware-design-guide-v1.1-en.txt,rk809-datasheet-v1.01.txt,tcs4525.txt,aw-cm256sm-v1.9.txt}`. Retained PDFs are useful for checking figures/tables, but these text files support the existing audit citations.
- **For H04–H07 design changes or qualification:** also share the referenced connector/testpoint, memory, differential timing, retained-reference and HDI process reports; custom footprint libraries; relevant manufacturer drawings/models; and the upstream MCU power-board design and harness specifications. If these are unavailable, the receiving agent should record the dependency rather than invent it. There is no need to send every historical routing checkpoint merely to reproduce the current model.

## Fixed acceptance and scoring gate

1. Preserve the current model-check weights: final rail regulation **2**, active-window regulation **2**, reset timing **2**, current capacity **1.5**, applicable CCM ripple **1**, numerical conservation **1**, component accounting **0.5**. Unknown checks earn **zero**. Mandatory rail/reset/capacity/conservation/regulator-input/component-stress failures cap the model result below **8** (currently 7.5). Do not change weights, thresholds, fault duration or load/source assumptions simply to reach 8.
2. A valid normal-operation scenario may meet the **8/10 model** threshold only for its declared, evidenced inputs and all mandatory gates. The unchanged nominal case currently scores **9/10**; three light-load converter ripple estimates lack established CCM applicability, so the ripple point remains unearned. Require every accepted normal operating corner to pass, not just the best run.
3. Keep intentionally injected early-reset and brownout cases as negative normal-operation scenarios. An independent fault-response regression can pass when the failure is detected and the expected reset/recovery occurs, while the run's normal-operation score stays below 8. Decide whether the 15 ms ramp and combined corner are required operating conditions from H01/H02 specifications; do not relabel them merely for scoring.
4. The **2.85/10 hardware-evidence heuristic** and existing **7/10 routing review** are separate, limited metrics. The present evidence heuristic is capped at 4 by its implementation and cannot prove complete-board readiness. Do not force it to 8 through a denominator or rubric change. Close named hardware gates with exact parts/models and correlated tests; if a broader evidence rubric is later required, version it and agree its scope and hard gates before scoring it. Preserve the historical **9/2.85** results and identify the new rubric separately.
5. Leave **actual boot, DDR timing/training, EMI/EMC, thermal limits and fabrication process unverified** until the specified evidence exists. A hardware-release recommendation requires those applicable gates to be closed or explicitly accepted with documented scope. Neither IC inventory coverage nor zero physical DRC errors substitutes for these results.

**Expected next-agent delivery:** an updated task disposition table keyed H01–H09; source/model/bench evidence links; a proposed revision only where supported; the full retained campaign and added tests; a web app showing current data and open limitations; and a release recommendation that states exactly which hardware gates remain open.
