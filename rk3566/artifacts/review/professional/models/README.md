# Vendor-model availability and compatibility

Checked 14 September 2026. The actual U7 controller model has been obtained from Texas Instruments, but **no vendor-controller simulation has been run or benchmarked**. The current model body is encrypted for PSpice and cannot be imported directly into LTspice or the available ngspice 42.

## Preserved public downloads

| File | TI product-page description | Inspection |
|---|---|---|
| `slum811.zip` | TPS566242 PSpice Transient Model | Correct U7 family; model Final 1.0, 18 April 2022; PSpice 17.4-2019 S015; 17 Cadence `CDNENCSTART_ADV2` encrypted blocks. |
| `slum815.zip` | TPS564242 PSPICE Reference Design Model | A different 4 A device, although linked from the TPS566242 page. It must not substitute for the board's 6 A TPS566242. Also encrypted. |

The original archives and extracted files are unchanged. Each `*-download.json` records the requested and resolved URL, retrieval time, byte count and SHA-256. Each `*-files.json` records every original archive member's hash. `model-audit.json` gives the machine-readable findings and native pin mapping.

Source: [TPS566242 design resources](https://www.ti.com/product/TPS566242#design-tools-simulation), [SLUM811 download](https://www.ti.com/lit/zip/slum811), [SLUM815 download](https://www.ti.com/lit/zip/slum815).

## Exact interface and vendor scope

The model's exposed port order is `VIN EN AGND SW FB GND`, corresponding to native board package pins `1 5 4 2 6 3`. The archive includes its original OrCAD Capture project, symbols, startup and steady-state simulation profiles, model signature, and features/limitations PDF. The reference project should be opened and benchmarked unchanged before adapting it to this PCB.

TI identifies feedback output setting, enable, negative current limiting, overcurrent protection, input undervoltage lockout, and entry into pulse-skipping operation as supported behaviors. Its supplied notes explicitly exclude operating quiescent current, shutdown current, temperature-dependent behavior, and large-duty operation. The model therefore cannot establish complete U7 supply-current or thermal accuracy even after a successful compatible simulator run.

The vendor specifies startup with `STEADY_STATE=0`. Accelerated steady-state initialization requires `STEADY_STATE=1`, appropriate external energy-storage initial conditions and at least 2 V on its soft-start capacitor. Both grounds are internally referenced to zero; this model cannot independently validate PCB ground bounce or an inverting configuration.

These observations come from the model's original readable header and its visually reviewed supplied PDF; the encrypted controller body was not decrypted or modified.

## Simulator compatibility

[ngspice's own model documentation](https://ngspice.sourceforge.io/modelparams.html) says encrypted commercial models cannot run in open-source ngspice. [TI's model portability guidance](https://e2e.ti.com/support/tools/simulation-hardware-system-design-tools-group/sim-hw-system-design/f/simulation-hardware-system-design-tools-forum/692613/faq-tina-spice-note-about-encrypted-models-and-importing-models-from-one-simulator-to-another) explains that PSpice-encrypted models require their intended simulator; cross-simulator import requires an unencrypted model. [Analog Devices' import guide](https://www.analog.com/en/resources/technical-articles/ltspice-how-to-import-third-party-models.html) directs encrypted-model questions to the model vendor.

Installing LTspice would not remove this model-format restriction. The concrete route to a TPS566242 controller benchmark is its unchanged vendor reference project in a compatible PSpice environment, or an authorized unencrypted model supplied by TI. No software installation, login, external design upload, license-acceptance action, decryption, or vendor-controller run was performed during this audit.

## Copyright and supplied notices

The archives contain TI's copyright and warranty-disclaimer header, preserved in the original libraries and additionally in `TPS566242-original-header.txt`. No separate license file was present in either archive. The product page links [TI's terms](https://www.ti.com/legal/terms-conditions/terms-of-sale.html). Public download availability is not being represented as an open-source license or a redistribution permission. No copyright/signature notice was removed.

## Other board regulators

- **U3, TCS4525_WT:** no public SPICE download was listed on the [manufacturer product page](https://www.tctek.cn/en/product/tcs4525/) or found in the bounded English/Chinese model searches. The official page and its linked `TCS4525_Ver.1.1_manufacturer.pdf` are preserved here with download metadata. This download is only a one-page product brief, not complete electrical specifications; its embedded PDF title is `EUP3265 ver1.1`, with an August 2015 creation date and March 2025 modification date. The current page advertises 6 A and a 0.22/0.47 µH solution, while the project's saved Ver.1.0 reference specifies 5 A and 0.33/0.47 µH. These brief/page statements do not resolve the exact device/revision or replacement specification. Qualification remains open; this discovery did not alter the board, models, checks or scores.
- **U2, RK809-5:** bounded searches of Rockchip's public domains found reference schematics and documentation, but no executable SPICE/OTP model. This does not establish that a private vendor model does not exist. Models or sequencing tables for other RK809 suffixes must not be silently substituted.

The existing ideal-PWM passive experiments remain useful numerical tests within their stated scope. They are not substitutes for the missing controller, PMIC, firmware, thermal or full-board electromagnetic evidence.
