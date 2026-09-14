# Online simulation execution plan

Prepared 2026-09-14 for the saved RK3566 revision 4 PCB, SHA-256 `3ba4da7036173e31941ea22b041d1a2a3433c2bcdedccf1a75b1f52b31ce2807`.

**Execution status: prepared, not run.** TI WEBENCH identifies the exact TPS566242 and the requirements form is filled. Its **View Design TPS566242** button remains disabled until the user accepts the WEBENCH Notice, Terms of Use and Privacy Policy. No legal terms were accepted, account created, board uploaded, purchase made, or remote simulation result claimed by the agent.

The live form is in the app browser at [TI WEBENCH](https://webench.ti.com/power-designer/switching-regulator?base_pn=TPS566242&origin=ODS&litsection=features). Reloading the page may reset form values; the complete prepared request and native component values are saved in `webench-request.json`.

## Tool selection

**First electrical tool: TI WEBENCH Power Designer.** TI explicitly supports TPS566242 custom designs, making this the most direct online route found for U7. The selection is based on exact-part support and low setup effort; no cross-tool speed or accuracy benchmark has been performed. The actual device's available analyses and exported model scope still need inspection after design creation. [TI product page](https://www.ti.com/product/TPS566242), [WEBENCH workflow](https://webench.ti.com/help/PowerDesigner/Overview.htm)

The official downloaded TPS566242 transient model is Cadence-encrypted for PSpice. LTspice installation alone would not make that model usable. Original files, model exclusions, pin mapping and download hashes are preserved in `models/`. Quiescent/shutdown current, temperature dependence and large-duty operation are explicitly excluded by the downloadable model. WEBENCH's exact model must be assessed separately; do not assume its scope is identical merely because the part number matches. [Model audit](models/README.md)

**Thermal candidate: SimScale private electronics-cooling workflow**, after actual heat loads, material/contact data, airflow and private project access are established. Its documented low-frequency EM scope must not be represented as a full-wave PCB emissions solver. **Full-wave/SI/PI candidates:** a supported Ansys HFSS/SIwave/Icepak cloud setup or a suitable Cadence OnCloud configuration. Access, modules, import geometry, licenses and costs must be established before execution. AI-assisted optimization is useful after valid solver models and training data exist. See [the sourced online-tool comparison](ONLINE_SOLVER_OPTIONS.md).

## Prepared U7 comparison case

| Input | Value | Evidence status |
|---|---:|---|
| Part | TPS566242 | Exact U7 base device identified by WEBENCH |
| Input range / nominal | 4.75–5.25 V / 5 V | Declared comparison at the converter input; source/cable drop is a separate model |
| Output | 3.3 V | Native 135 kΩ / 30 kΩ feedback divider with 0.6 V reference |
| Nominal / maximum load | 2 A / 2 A | Existing local study's comparison load; not a measured board maximum |
| Ambient | 25 °C | Assumed comparison condition, not a measurement |
| Design preference | Balanced | Search preference only; generated parts must be checked against the board |
| L219 | 2.2 µH, XAL6030-222MEC | Exact part in saved BOM; maximum DCR 13.97 mΩ used in prior calculations |
| Input capacitance | C380 22 µF + C381 100 nF | C380's exact MPN remains unresolved |
| Output capacitance | C382–C385, four 22 µF branches | 88 µF nominal; effective capacitance, ESR/ESL and exact procurement identities need qualification |
| Enable divider | 10 kΩ from VIN, 100 kΩ to GND | Native R380/R381 connectivity |

The generator may propose a different BOM, inductor, capacitor bank or feedback divider. Keep that manufacturer-generated design as a separate reference. Only label a second design as matching the native circuit after each relevant part, pin, value, control connection and operating condition has been compared. If the UI cannot represent the exact circuit, retain an explicit difference table and call the result a reference comparison.

## Required run sequence and retained evidence

1. Record the online design ID, solver/model version if exposed, selected part variant, supported analyses, schematic and complete BOM. Save the untouched manufacturer reference first.
2. Before each run, freeze an input manifest containing the exact design/BOM identity, analysis type, source ramp, enable waveform, initial conditions, load levels/slew/delay, stop time, time-step settings and measurement windows. Record any service-fixed or undisclosed setting as such. Then run the reference's supported startup and steady-state analyses, checking startup mode and stated model limits. Record convergence warnings; an empty/error plot is a failed run.
3. Create the native-passive comparison where the service permits it. Preserve L219, four capacitor branches or a justified equivalent, feedback and enable networks. Mark unknown capacitor bias/ESR and PCB parasitics explicitly.
4. Run supported startup, load-transient and line-transient analyses at the declared 5 V/3.3 V/2 A baseline, using the frozen per-run manifest. Preserve the simulator's reported settings beside those requested, and flag any mismatch. Do not describe an unspecified instantaneous edge as a measured board event.
5. Compare 4.75 V and 5.25 V input cases and justified load/capacitance variants. Preserve every failure and each unsupported analysis. A 6 A device-rating test is a separate capacity experiment, not an established normal board load.
6. Where supported, retain small-signal loop/impedance analysis with the model and operating-point limits stated. Numerical agreement between a fixed-PWM passive model and a controller model is not a stability proof.
7. Export raw waveforms, scalar measurements, model/BOM records, input conditions and warnings. Link them to the original PCB hash and the exact online design ID. Compare relevant regulation/transient/voltage/current margins against source-qualified consumer limits rather than a generic percentage band.
8. Add actual findings to the existing web app and handoff only after the comparison is reviewable. Keep the current video labeled as its original simplified/illustrative recording unless it is regenerated from newly qualified results.

## Boundaries of the result

This U7 workflow cannot supply RK809-5 OTP, TCS4525 behavior, RK3566/DDR boot execution, individual IC currents, whole-board heat sources or radiated/immunity results. Those require their own inputs and appropriate models or measurements. A converter design generated online is not the saved eight-layer PCB's field or thermal solution.

The current output's independent professional-readiness assessment is **2.5/10**, with **8/10 presentation** and **8/10 mathematical implementation within the declared scope**. The fixed credit ledger and remaining gates are in [PROFESSIONAL_REVIEW.md](../PROFESSIONAL_REVIEW.md). Tool selection, account access and a downloaded encrypted model do not earn physical-validation credit by themselves. Historical 9/10 behavioral and 2.85/10 evidence scores remain attached to their original rubrics and results.
