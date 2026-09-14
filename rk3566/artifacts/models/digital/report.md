# Digital manufacturer-model acquisition and executed DDR3L input study

The exact ISSI DDR3L family model was acquired and used in **25 ngspice channel cases**, rather than retained as an unused download. The study combines its nonlinear DM input/termination tables and individual pin package parasitics with the four native PCB DM route lengths. It provides conditional voltage and single-pin current results. It does not establish DDR timing, memory training, boot, thermal or EMC qualification.

The original PCB, schematic, component database, frozen simulation runs and previous reports were not edited. The earlier physical-evidence score remains unchanged. This new evidence belongs to a separate, bounded model study.

## Model availability and provenance

| Target | Finding | Use in this study |
|---|---|---|
| U4/U5, IS43TR16512BL-125KBLI | Public, unencrypted ISSI IBIS 4.2 file with `43tr16512bl` x16 component | Exact-family DM input, ODT and individual D3/E7 package data |
| U1, RK3566 | No public exact analog I/O/package or internal power model found in the bounded official-source search | Assumed source at the U1 PCB ball; no substitute SoC presented as exact |
| eMMC module | Retained design does not identify the assembled eMMC silicon order code | No unrelated chip model substituted |
| AW-CM256SM | Public module documentation; no exact executable module I/O model exposed in this search | Not simulated here |
| Y1, 24 MHz / 12 pF crystal | Exact ordering code and motional parameters absent | No crystal-startup waveform invented |

The [official ISSI product table](https://issi.com.cn/US/product-dram-ddr3.shtml) links the [downloaded model](https://issi.com.cn/WW/models/ibis/43tr16512-81024bl.ibs) directly from its 1.35 V, 512M×16, 96-ball IS43TR16512BL row. Both files are retained under `models/`; `models/downloads.json` records source URL, retrieval time, byte count and SHA256. The model hash is `8603dc2fd4ea76be044dcaa444dec3f6c264d0161a6defe54919ee009f84a3dc`.

Its file revision is 1.1. The header date and revision-history dates differ; the original bytes are retained without rewriting that history. Its disclaimer and copyright notice are preserved in the original file and every generated derivative SPICE deck. There is no encryption or license-acceptance step. Exact-family availability does not supply lot-specific or vendor bench correlation.

The [Rockchip download center](https://www.rock-chips.com/a/cn/downloadcenter/index.html) and [official RK3566 brief](https://www.rock-chips.com/uploads/pdf/2022.8.26/191/RK3566%20Brief%20Datasheet.pdf) provide documentation. The [Rockchip DDR configuration table](https://github.com/rockchip-linux/rkbin/blob/master/specific/Rockchip_Specific_PCB_Template_and_DDR_bin_Configuration_Table.md) concerns PCB templates and DDR firmware. Those artifacts are not analog I/O models. This search result does not establish that Rockchip cannot supply a model directly.

[AzureWave's module datasheet](https://www.azurewave.com/img/wireless-modules/AW_CM256SM_DS_Rev15_CYW.pdf) identifies CYW43455 and SDIO/UART interfaces. A semiconductor-family model, if subsequently obtained, would still need the module interconnect/package mapping before being labeled an exact AW-CM256SM channel.

## Executed circuit and assumptions

Each case is an isolated write-direction **DM input pulse**, with supply and chosen termination already established in the DC operating point. It is not a power-up waveform. Rise begins at 1 ns, fall begins at 3.5 ns and the simulation ends at 7 ns. The reference source edge is 250 ps from 0% to 100%; this is not a 10–90% edge specification. Separate 100 ps and 500 ps sensitivities are included.

The circuit is:

`assumed U1 PWL source → assumed source R → uniform lossless line → optional extra loop L → exact ISSI pin L/R → input die`

The package ball has its own `C_pin`. The die has `C_comp`, input ground/power clamps, and the selected non-driving ODT submodel. Native endpoint mapping is verified before every run. The input-only adapter does not translate output-driver waveforms or arbitrary IBIS features.

Per-pin values override package defaults: D3 uses 0.78676 Ω, 1.779 nH and 0.497 pF; E7 uses 0.73228 Ω, 1.842 nH and 0.425 pF. The typical die capacitance is 1.3 pF. The selected names are `DM_ODT0/40/60/120`; the ODT options retain their nonlinear manufacturer tables rather than replacing them with ideal resistors.

The adapter follows [IBIS 4.2](https://ibis.org/ver4.2/ver4_2.pdf): current is positive into the input, power-clamp table voltage is `VDD − Vdie`, and ground-clamp table voltage is `Vdie`. Piecewise interpolation uses the tabulated currents. The vendor's reverse-biased clamp ranges end early; endpoint leakage is held constant beyond those ends as an explicit adapter assumption. Forward-conduction extrapolation is rejected. Static ODT submodel tables are added only in the declared input/non-driving state. No ODT-switch timing is inferred.

[ngspice 42](https://ngspice.sourceforge.io/docs/ngspice-42-manual.pdf) executes the generated dependent-source and transmission-line circuits through the installed shared library. The maximum timestep is 2 ps, with 1 ps convergence references. This is selected-model translation to SPICE, not a claim that ngspice natively executed the entire IBIS file. No full vendor-model compliance checker or vendor simulator comparison has been performed.

The **assumed**, independently swept quantities are source resistance 20/34/60 Ω, line impedance 40/50/60 Ω, and propagation coefficient 5.5/6/7 ps/mm. They are not measurements or Rockchip register settings. The reference is 34 Ω, 50 Ω and 6 ps/mm. The source begins at the U1 ball, so Rockchip package impedance and internal output stage behavior are absent. Additional 1 nH and 3 nH loop-inductance cases are sensitivities, not solved actual return paths.

The ISSI typical column is characterized at 1.35 V / 50 °C. The min column is 1.283 V / 110 °C; the max column is 1.45 V / −40 °C. These labels describe the model data, not estimated chip temperatures. In particular, 1.45 V exceeds the retained shared RK3566/DRAM rail limit of 1.417 V, and the 110 °C model condition exceeds the selected industrial device's retained 95 °C case-temperature limit. Both are clearly labeled characterization sensitivities, not proposed board operating points. The nominal board recommendations do not change.

## Native route evidence

Source PCB SHA256: `3ba4da7036173e31941ea22b041d1a2a3433c2bcdedccf1a75b1f52b31ce2807`.

Lengths come from the already measured, hash-matched `differential-revision/final/ddr-paths.json`. The three-dimensional length adds traversed via-axis distance from the saved proposed stack to planar centerline length; it does not include either IC package.

| Net | Native endpoints | Planar mm | Via-axis mm | Total mm | Traversed via objects | Assumed delay at 6 ps/mm |
|---|---|---:|---:|---:|---:|---:|
| DDR3_DM0 | U1.1E2 → U4.E7 | 19.825 | 2.641 | 22.466 | 2 | 134.798 ps |
| DDR3_DM1 | U1.1G1 → U4.D3 | 36.246 | 3.090 | 39.336 | 3 | 236.014 ps |
| DDR3_DM2 | U1.1B8 → U5.E7 | 12.840 | 3.090 | 15.930 | 3 | 95.577 ps |
| DDR3_DM3 | U1.1A11 → U5.D3 | 12.609 | 2.641 | 15.250 | 2 | 91.499 ps |

The longest route is DM1. Its planar copper spans F.Cu, In5.Cu and B.Cu. DM2 spans F.Cu, In2.Cu and B.Cu; DM0 and DM3 use F.Cu/In5.Cu. The present solver assigns one uniform line to each full length. It does **not** extract impedance per layer, coupled traces, via stubs, plane openings, dielectric loss, frequency-dependent copper loss or reference-plane transitions. These geometry differences remain reasons to perform a later extracted multi-conductor study, not demonstrated SI failures by themselves.

## Numerical findings

All voltages below are at the **DRAM package ball**. Extrema use every accepted solver sample over 0–7 ns. The high plateau is a time-weighted 3.0–3.4 ns mean; the low plateau is a 6.3–6.9 ns mean. Delay is the first half-supply crossing at that ball relative to the assumed ideal source's half-supply crossing. It is not a DQS-referenced timing margin.

| Native route, reference assumptions and ODT60 | Minimum V | Maximum V | First crossing delay ps | Peak single-pin current mA |
|---|---:|---:|---:|---:|
| DM0 | 0.2014 | 1.1452 | 166.38 | 9.684 |
| DM1 | 0.2037 | 1.1428 | 270.15 | 9.837 |
| DM2 | 0.2098 | 1.1366 | 127.16 | 9.706 |
| DM3 | 0.2076 | 1.1388 | 125.64 | 9.893 |

The difference between the DM1 and DM3 crossing delays is approximately 144.51 ps under these source/channel assumptions. Comparing DM signals across different byte lanes does not establish a failure: the corresponding strobes, launch alignment and trained timing are not part of this study.

On DM1, termination changes the waveform substantially:

| ODT selection; all other reference parameters fixed | Minimum V | Maximum V | High plateau V | Low plateau V |
|---|---:|---:|---:|---:|
| Off | −0.2629 | 1.6133 | 1.3574 | 0.0005 |
| 40 | 0.2913 | 1.0549 | 1.0439 | 0.3025 |
| 60 | 0.2037 | 1.1428 | 1.1096 | 0.2372 |
| 120 | 0.0429 | 1.3047 | 1.2049 | 0.1436 |

Stronger termination damps ringing while reducing signal swing with the assumed source resistance. These results justify checking the **actual** Rockchip output configuration and DDR mode-register/ODT settings before selecting a termination strategy. They do not select an optimal ODT value by themselves, and they do not establish a DDR overshoot-area or AC timing violation.

The separate DM1, ODT-off 100 ps edge case reaches 17.55 mA peak pin current, versus 11.07 mA at 250 ps. Its ball extrema are approximately −0.2675 V and 1.6179 V. This difference shows why edge rate matters even when the pulse amplitudes change little. These currents belong to one modeled input path; they are not the total U4/U5 supply current.

Removing the receiver package from the ODT-off DM1 comparison shifts the first crossing from 300.78 ps to 275.87 ps and changes peak pin current from 11.07 mA to 8.18 mA. That comparison demonstrates a consequence of including the available package model. The no-package case is a sensitivity only; the actual result retains the manufacturer's package entries.

For DM1 with ODT60, the high/low plateau distances from the model's `Vinh/Vinl` are approximately 0.275/0.278 V at the package ball. Those are static indicators. An eye opening, setup/hold margin, training success or bit-error rate cannot be derived from this isolated pulse without the omitted strobe, source and channel information.

## Verification and reproducibility

The recorded six numerical/source checks passed:

1. Twelve ngspice DC sweeps cover all four selected termination choices and all three corners. **34,062** current comparisons against original tables, including supply-reference signs and source KCL, give a maximum absolute discrepancy below **1.7×10⁻¹⁶ A**. This verifies the translation, not silicon accuracy.
2. A separate 50 Ω source/line/load reference reproduces the analytic half-amplitude waveform after a 200 ps delay, with maximum sampled discrepancy below **1.2×10⁻¹⁶ V**.
3. Halving maximum timestep from 2 ps to 1 ps on the longest terminated and unterminated routes changes the compared voltage waveform by less than **40 µV**. The acceptance criterion was 3 mV.
4. The largest die-node current-conservation residual across the 25 cases is below **0.54 nA**. It includes package current, die capacitance and all four nonlinear clamp/termination branches.
5. Native PCB/source hashes, original model hash and all four endpoint mappings match the saved evidence.
6. Forward clamp and ODT conduction stay within their retained table domains. The separate reverse-leakage endpoint extension remains an explicit assumption.

Nine dedicated tests also pass. They verify original notices, case-sensitive IBIS units, exact pin package values, native endpoints, known original current-table points, executed numerical evidence, true nanosecond axes, all raw artifacts and input hashes.

Reproduce from the project root:

```sh
python3 simulation/model-expansion/digital/digital_study.py
python3 -m unittest discover -s simulation/model-expansion/digital -p 'test_digital_study.py' -v
```

`result.json` supplies the web application's study/case/trace schema and the source manifest. Every case has a generated `.cir`, solver `.log` and full-precision accepted-sample `.csv` under `raw/`; two additional full-resolution convergence runs are retained. `numerical-checks.json` is a compact check summary. UI traces use an extrema-preserving subset of actual solver timestamps; they do not create simulated data between saved samples.

## Conclusions for the next model-validation task

The acquired manufacturer model materially improves the DRAM input side: its termination nonlinearity, clamp behavior, capacitance and package contribution now participate in executed simulations. The route and ODT sensitivities are sufficient to prioritize a complete DDR channel extraction and confirmation of the configured source/termination states.

The next useful inputs are an exact RK3566 DDR I/O/package model with documented drive settings, qualified stackup dielectric and loss data, actual via/return geometry and coupling, corresponding DQS/clock/command channels, and the selected DDR firmware/mode-register/training configuration. Correlate the converted ISSI input subset against a vendor-supported IBIS simulator, then analyze read and write eyes with the relevant timing limits. Identify the eMMC silicon and crystal order codes before attempting exact module or oscillator models. No PCB component removal, rerouting, new drive setting or manufacturing approval is authorized by the conditional waveforms alone.
