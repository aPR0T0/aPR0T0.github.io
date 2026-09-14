# RK3566 Rev4 peripheral section review — sheets 19–27

**Reviewed 14 September 2026. Physical readiness remains 2.5/10; target 8 is not met. No PCB, BOM, firmware, solver or score was changed by this review.**

PCB SHA-256: `3ba4da7036173e31941ea22b041d1a2a3433c2bcdedccf1a75b1f52b31ce2807`. Evidence paths in the JSON are relative to `rk3566-sbc-rev4`. The native netlist assigns 166 primary component records to these nine sheets; RK3566/PMIC units referenced across sheets remain shared devices, not additional components. Full-board unique-part accounting belongs to the parent review.

## Conclusions before any PCB change

The strongest new findings concern actual interfaces and stated specifications: externally owned camera/audio/peripheral rails are not sequenced by this board; the saved model bypasses their enable handshake; ToF and autofocus load envelopes are incompletely budgeted; the camera translator has an untested back-bias path; and the speaker bead rating annotation disagrees with the current indexed manufacturer catalog. Exact correction of a label or a model limit is distinct from approval to replace a component or reroute copper.

The existing final routing report proves continuity and the documented geometric measurements on this exact PCB. It retains 71 strict differential screening findings and 176 stacked-interface warnings. Its historical 7/10 geometric review is narrower than professional hardware readiness. No report in this review demonstrates actual RK3566 boot execution, USB/CSI/SDIO/I²S signal integrity, calibrated per-IC current, system EMC or full-board thermal behavior.

### Changes supported now versus changes needing evidence

- **Supported documentation/model work:** reconcile the speaker-bead rating; add published maximum ferrite resistance corners; apply sensor-specific voltage windows; document rail ownership, console isolation, wake directions, clock pinmux and recovery procedures. These findings justify preparing changes, not asserting that those changes already exist.
- **Inputs required before hardware choices:** MCU-side power/enable circuit, display/speaker/camera/antenna and cables, operating modes, upstream rail tolerances, semiconductor off-state limits and approved fabrication stack/process.
- **Conditional PCB work:** power-off isolation/OE control, translator disable or bleed, local rail changes, additional protection/output filtering and high-speed rerouting. Select exact circuits/values only after the corresponding electrical requirement is established.

## Frozen analysis context

Selected `run-0027`: input 4.75 V, source resistance 0.12 Ω, load scale 1, capacitance scale 0.7, soft start 1.39 ms, requested reset 40 ms, ambient 25 °C, step 0.005 ms, duration 160 ms, scenario `nominal`. `run-0004` is the 5 V nominal comparison with the same listed nominal settings.

Values below are read from saved runs. A rail “pass” is only the existing model check, not a part qualification. Currents are aggregate declared rail loads, not individual IC currents. The 13-case campaign (run-0004–run-0016) remains separate retained evidence; this review does not select a passing corner to erase a failing one.

Sources: [simulation/data/runs/run-0027.json](../../simulation/data/runs/run-0027.json), [simulation/data/runs/run-0004.json](../../simulation/data/runs/run-0004.json), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [simulation/data/board-layout.json](../../simulation/data/board-layout.json), [reports/differential-review.md](../../reports/differential-review.md).

## S19 — SDIO Wi-Fi, Bluetooth, clocks and antenna

U6 is an AW-CM256SM module fed through FB202 from the 3.3 V preregulator, with 1.8 V VCCIO_WL, an external 37.4 MHz crystal, and a U.FL antenna feed. Connectivity and the intended voltage domains are explicit; RF performance, internal regulator behavior and module startup remain unvalidated.

Native primary records: **21**. `C256`, `C257`, `C261`, `C262`, `C263`, `C264`, `C265`, `C266`, `C267`, `FB202`, `J201`, `L207`, `R219`, `R234`, `R235`, `R236`, `R237`, `R241`, `R242`, `U6`, `Y202`.
Schematic: [hardware/19-wifi-01.kicad_sch](../../hardware/19-wifi-01.kicad_sch).

| State / discipline | Assessment |
|---|---|
| Startup | R235 pulls WL_REG_ON toward VCCIO_WL; BT_REG_ON is independently driven. The module has its own POR and enable timing. The 160 ms board run does not execute SDIO commands, establish internal VDDC availability, or verify a repeated WL/BT power cycle. Firmware must implement the module timing independently of RK3566 reset release. |
| Steady state | Run 27 predicts WIFI_VBAT 3.271961 V at 0.198300 A aggregate assumed load, leaving about 72 mV above the 3.2 V module minimum. This is a rail-budget calculation; U6 current, L207 ripple, RF output power and oscillator amplitude remain Unknown. VCCIO_WL is modeled at 1.798831 V. |
| Transient / shutdown | The narrow VBAT headroom is vulnerable to source tolerance, FB202/trace drop and transmit bursts. C256 is 22 µF nominal; effective capacitance at DC bias and the burst waveform are absent. A nominal 200 mA rail load does not prove the module peak current budget. |
| EMI / EMC | C264 is the 10 pF series RF element and C265/C266 are DNP shunt tuning positions. No VNA result, approved stack impedance or final antenna/cable loss is present. R237 provides 22 Ω SDIO clock damping; geometry and resistor presence do not prove SDIO timing or emitted RF compliance. |
| Thermal | No U6 power map, shield-to-board thermal model or enclosure temperature result exists. RF duty cycle and L207/ferrite loss must be supplied before a temperature can be assigned. The app thermal study of L219 does not apply to this module. |

**Missing models:** AzureWave internal buck/control and TX/RX activity models; crystal negative-resistance/ESR/drive budget; antenna/cable S-parameters; extracted SDIO/UART channels; package thermal path.

Saved rail comparison — all currents below are aggregate model values.

| Rail | Run0027 steady V | Run0027 aggregate A | Run0004 steady V | Run0004 aggregate A |
|---|---:|---:|---:|---:|
| WIFI_VBAT | 3.271961 | 0.1983 | 3.271961 | 0.1983 |
| VCCIO_WL | 1.798831 | 0.011992 | 1.798831 | 0.011992 |

### s19-vbat-margin · HIGH · requires input

Only 0.1 V nominal separates a 3.3 V source from the module 3.2 V minimum before series losses. The saved 72 mV residual margin is conditional on the chosen load and resistance, so nominal pass is not a TX qualification.

**Affected:** U6, FB202, C256, C257; nets WIFI_VBAT, VCC_3V3_SBC.

**Next action:** Obtain the module burst-current envelope and effective C256 curve; evaluate the source/ferrite/trace path at the module pad 9. Change the Wi-Fi supply architecture or filtering only if the qualified envelope requires it.

**Acceptance:** Measured pad 9 voltage remains within the module operating range for cold start, TX bursts, minimum input and all declared temperatures; source margin and ripple are recorded.

**Project evidence:** [hardware/19-wifi-01.kicad_sch](../../hardware/19-wifi-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [simulation/data/runs/run-0027.json](../../simulation/data/runs/run-0027.json), [references/power-wifi/aw-cm256sm-v1.9.txt](../../references/power-wifi/aw-cm256sm-v1.9.txt).

**Manufacturer/standard basis:** [AzureWave AW-CM256SM datasheet V1.9, manufacturer document preserved by Pine64](https://files.pine64.org/doc/datasheet/rockpro64/AW-CM256SM_DS_DF_V1.9_STD.pdf).

### s19-module-sequence · HIGH · requires input

The module requires at least 150 ms after internal VDDC and VDDIO are available before SDIO access, plus a 10 ms minimum off interval for a full WL/BT regulator cycle. R235 pulls WL_REG_ON high, but the board model does not track internal VDDC or software traffic.

**Affected:** U6, R235, TP218, TP219; nets WIFI_REG_ON_H_GPIO2_B1, BT_REG_ON_H_GPIO2_B7, VCCIO_WL.

**Next action:** Define a module power-sequence state machine and confirm bootloader/Linux GPIO ownership. Add controllable default-off hardware only if boot policy requires it.

**Acceptance:** Logic-analyzer and rail captures show the required guard times, independent WL/BT resets and successful enumeration across repeated cold/warm cycles.

**Project evidence:** [hardware/19-wifi-01.kicad_sch](../../hardware/19-wifi-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [references/power-wifi/aw-cm256sm-v1.9.txt](../../references/power-wifi/aw-cm256sm-v1.9.txt).

**Manufacturer/standard basis:** [AzureWave AW-CM256SM datasheet V1.9, manufacturer document preserved by Pine64](https://files.pine64.org/doc/datasheet/rockpro64/AW-CM256SM_DS_DF_V1.9_STD.pdf).

### s19-crystal-load · WARNING · requires input

Y202 is specified 37.4 MHz/12 pF; C262 and C263 are each 8 pF. Their simple series equivalent is 4 pF before pin/PCB parasitics, so these values do not establish a 12 pF operating load. R234 adds 100 Ω in the drive leg.

**Affected:** Y202, C262, C263, R234, U6; nets WIFI_XIN, WIFI_XOUT, WIFI_XTAL_DRIVE.

**Next action:** Retain these as tuning placeholders until the actual crystal and module oscillator requirements are reconciled; characterize startup, frequency error and drive with a suitable low-loading method.

**Acceptance:** Final crystal MPN/ESR/drive/load are approved and frequency/startup margin pass temperature, tolerance and supply corners.

**Project evidence:** [hardware/19-wifi-01.kicad_sch](../../hardware/19-wifi-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [references/power-wifi/aw-cm256sm-v1.9.txt](../../references/power-wifi/aw-cm256sm-v1.9.txt).

**Manufacturer/standard basis:** [AzureWave AW-CM256SM datasheet V1.9, manufacturer document preserved by Pine64](https://files.pine64.org/doc/datasheet/rockpro64/AW-CM256SM_DS_DF_V1.9_STD.pdf).

### s19-control-direction · WARNING · qualified documentation or firmware

U6.6 is BT_WAKE input and U6.7 is BT_HOSTWAKE output; the inherited net names suggest the opposite direction. R241/R242 correctly weakly pull unused bidirectional PCM clock/sync low instead of shorting possible outputs.

**Affected:** U6, R241, R242; nets BT_WAKE_HOST_H_GPIO2_C0, HOST_WAKE_BT_H_GPIO2_C1, BT_UNUSED_PCM_CLK, BT_UNUSED_PCM_SYNC.

**Next action:** Document or safely rename wake directions and assert GPIO2_C0 as host output/GPIO2_C1 as host input. Preserve the weak PCM pulls and explicit unconnected outputs.

**Acceptance:** Pinmux review and sleep/wake captures match the manufacturer pin directions; no opposing output drivers occur.

**Project evidence:** [hardware/19-wifi-01.kicad_sch](../../hardware/19-wifi-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [references/power-wifi/aw-cm256sm-v1.9.txt](../../references/power-wifi/aw-cm256sm-v1.9.txt).

**Manufacturer/standard basis:** [AzureWave AW-CM256SM datasheet V1.9, manufacturer document preserved by Pine64](https://files.pine64.org/doc/datasheet/rockpro64/AW-CM256SM_DS_DF_V1.9_STD.pdf).

### s19-rf-dfm · WARNING · requires input

The host land pattern and three underside non-host contacts are documented engineering geometry. The 10 pF feed, DNP match pads and U.FL placement are not a tuned 50 Ω antenna network.

**Affected:** U6, J201, C264, C265, C266; nets WIFI_RF, WIFI_ANT.

**Next action:** Obtain vendor land/stencil approval and the exact antenna/cable, then extract and tune the RF feed. Preserve DNP status until measured tuning supports population.

**Acceptance:** Supplier approves module assembly geometry; VNA/antenna and coexistence tests meet a declared target on the final enclosure.

**Project evidence:** [hardware/19-wifi-01.kicad_sch](../../hardware/19-wifi-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [references/power-wifi/aw-cm256sm-v1.9.txt](../../references/power-wifi/aw-cm256sm-v1.9.txt).

**Manufacturer/standard basis:** [AzureWave AW-CM256SM datasheet V1.9, manufacturer document preserved by Pine64](https://files.pine64.org/doc/datasheet/rockpro64/AW-CM256SM_DS_DF_V1.9_STD.pdf).

**Proposed change classification:**

- Qualified documentation/firmware change: correct wake-direction naming and record WL/BT timing without changing the PCB.
- Requires input: exact RF burst load, antenna/cable and vendor oscillator/land approval.
- Conditional PCB change: improve VBAT regulation/filtering or crystal/matching population only after quantified margin/tuning results.

## S20 — MCU harness, console and SPI display

J121 mixes a sequenced 3.3 V output, five externally generated power rails and logic interfaces; J103 supplies an external display. U100 protects the MCU-to-SoC UART path when its supply is off, while the remaining direct connections rely on a coordinated power policy.

Native primary records: **9**. `C103`, `C104`, `C105`, `J103`, `J121`, `R50`, `R100`, `R101`, `U100`.
Schematic: [hardware/20-display_mcu-01.kicad_sch](../../hardware/20-display_mcu-01.kicad_sch).

| State / discipline | Assessment |
|---|---|
| Startup | J121.6 exports VCC_3V3 to enable the MCU-side peripheral converter; pins 12/13, 15, and 17–19 return its regulated rails. The current model instead assumes those inputs rise at t=0. U100./OE is hard grounded, so its Ioff property is not a full enabled-state sequencing controller. |
| Steady state | J103.1 uses 3V3_PER, while SPI/GPIO signals originate in RK3566 VCCIO6 powered from VCC_3V3. PMUIO2 on VCC3V3_PMU supplies UART2. The run predicts these rails near 3.29 V/3.27 V but gives no display, MCU or harness contact current. LCD_BL is a command pin, not a backlight power driver. |
| Transient / shutdown | Independent removal of MCU power, a broken J121 enable wire, or early SoC drive can leave one endpoint unpowered. U100 handles only MCU_TX→RADXA_RX. MCU_RX, SOC_HALT and audio-monitor outputs have no corresponding active isolation stage in this sheet. |
| EMI / EMC | The display MOSI/CLK paths include 33 Ω series parts R100/R101; CS/DC/RST/BL are direct. Their adequacy depends on driver edge rate, cable length and remote input load. No connector ESD network or cable common-mode model is present on J103/J121. |
| Thermal | No display backlight, remote MCU, connector contact or harness-wire heat model is available. The rails on J121 must have source/current ownership and wire/contact limits; their assumed simulation ceilings are not connector ratings. |

**Missing models:** Remote MCU regulator/enable schematic and firmware; connector/harness resistance and inductance; display MPN/current/backlight-driver model; IO power-off leakage and IBIS channels.

Saved rail comparison — all currents below are aggregate model values.

| Rail | Run0027 steady V | Run0027 aggregate A | Run0004 steady V | Run0004 aggregate A |
|---|---:|---:|---:|---:|
| VCC_3V3 | 3.265843 | 0.178136 | 3.265843 | 0.178136 |
| 3V3_PER | 3.291772 | 0.164551 | 3.291772 | 0.164551 |
| 1V8_AUDIO | 1.79925 | 0.014994 | 1.79925 | 0.014994 |
| CAM_1V5 | 1.497504 | 0.049917 | 1.497504 | 0.049917 |
| CAM_1V8 | 1.799001 | 0.019989 | 1.799001 | 0.019989 |
| CAM_2V8 | 2.797004 | 0.059921 | 2.797004 | 0.059921 |

### s20-rail-ownership · HIGH · requires input

Five rails are inputs from the MCU board, while J121.6 VCC_3V3 is a sequenced output. Assuming all external rails present at t=0 bypasses the intended inter-board enable handshake and cannot validate it.

**Affected:** J121, U100, C103, C104, C105; nets VCC_3V3, 3V3_PER, 1V8_AUDIO, CAM_1V5, CAM_1V8, CAM_2V8.

**Next action:** Freeze an inter-board power contract including startup delays, shutdown order, discharge, connector current allocation and absent-board behavior. Extend the future model with that boundary before considering local replacements.

**Acceptance:** The combined MCU/SBC schematic and timing captures demonstrate sole ownership of each rail and no unintended regulator paralleling or back-powered rail.

**Project evidence:** [hardware/20-display_mcu-01.kicad_sch](../../hardware/20-display_mcu-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [research/carrier-interfaces.md](../../research/carrier-interfaces.md), [simulation/data/runs/run-0027.json](../../simulation/data/runs/run-0027.json).

### s20-io-off-state · HIGH · requires input

U100 has Ioff protection and 3.3 V power but its/OE is permanently low. The separate MCU_RX, SOC_HALT and monitor links are direct/resistive connections; their receivers and power-off behavior are outside the board model.

**Affected:** U100, J121, R136, R137, R138, U1; nets MCU_TX, MCU_RX, SOC_HALT, AUDIO_MON_BCLK, AUDIO_MON_WCLK, AUDIO_MON_DATA.

**Next action:** Evaluate every powered/unpowered endpoint combination. Define safe pin states and OE policy, and add appropriate isolation where those tests or device limits require it.

**Acceptance:** Neither endpoint rail is raised outside its approved off-state budget; pin injection and transition levels stay inside both-device limits for startup, shutdown and cable sequencing.

**Project evidence:** [hardware/20-display_mcu-01.kicad_sch](../../hardware/20-display_mcu-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [research/carrier-interfaces.md](../../research/carrier-interfaces.md), [references/sn74lvc1g125-revu.txt](../../references/sn74lvc1g125-revu.txt).

**Manufacturer/standard basis:** [TI SN74LVC1G125, SCES223U](https://www.ti.com/lit/ds/symlink/sn74lvc1g125.pdf).

### s20-console-contention · WARNING · qualified documentation or firmware

R50 is a populated 0 Ω link between U100 output and the UART2 receive node TP30. An external console transmitter would contend with the MCU transmitter unless this link is opened. TP31 observes SoC TX on MCU_RX.

**Affected:** R50, U100, TP30, TP31, J121; nets RADXA_RX, MCU_TX_BUFFERED, MCU_RX.

**Next action:** Make the external-console procedure and population option explicit; isolate R50 before attaching an external transmitter. Preserve unambiguous SoC RX/TX direction labels.

**Acceptance:** With R50 open only the external adapter drives SoC RX; with it closed only the MCU drives that node, and both states are covered by the debug procedure.

**Project evidence:** [hardware/20-display_mcu-01.kicad_sch](../../hardware/20-display_mcu-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [docs/connectors-and-testpoints.md](../../docs/connectors-and-testpoints.md), [research/carrier-interfaces.md](../../research/carrier-interfaces.md).

### s20-display-contract · WARNING · requires input

J103 has one 3.3 V supply and no local backlight current driver. GPIO4_B0 serves LCD_RST, so enabling the full SPI3 pin group including MISO would conflict with the reset function. R100/R101 damp only MOSI and CLK.

**Affected:** J103, R100, R101, U1; nets LCD_BL, LCD_RST, LCD_CLK, LCD_MOSI, LCD_CS.

**Next action:** Specify the display MPN with onboard backlight driver, maximum load and harness. Restrict pinmux to the needed transmit-only SPI group and qualify edge/ESD behavior before adding damping/protection.

**Acceptance:** The chosen display operates with its specified logic and power budget; reset/PWM function during boot and signal integrity pass at the declared cable length and clock rate.

**Project evidence:** [hardware/20-display_mcu-01.kicad_sch](../../hardware/20-display_mcu-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [research/carrier-interfaces.md](../../research/carrier-interfaces.md), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

**Manufacturer/standard basis:** [Rockchip RK3566 Hardware Design Guide V1.1](https://dl.xkwy2018.com/downloads/RK3568/RK356X/Hardware/Rockchip_RK3566_Hardware_Design_Guide_V1.1_EN.pdf).

**Proposed change classification:**

- Qualified documentation/firmware change: publish rail ownership, R50 console isolation and transmit-only display pinmux.
- Requires input: MCU regulator/enable implementation, harness pin current limits and display MPN.
- Conditional PCB change: add OE sequencing or bidirectional power-off isolation/protection only after cross-board off-state analysis.

## S21 — VL53L5CX ToF and shared I²C bus

U110 AVDD and IOVDD share 3V3_PER; the reserved pins, 47 kΩ control bias and 4.7 µF/100 nF bypass follow a recognizable sensor application. Shared I²C loading, power-off recovery and active-ranging supply demand are not validated by the generic rail model.

Native primary records: **9**. `C110`, `C111`, `R110`, `R111`, `R112`, `R113`, `R114`, `R115`, `U110`.
Schematic: [hardware/21-tof-01.kicad_sch](../../hardware/21-tof-01.kicad_sch).

| State / discipline | Assessment |
|---|---|
| Startup | Sharing AVDD/IOVDD avoids a separate rail-order mismatch at the sensor when 3V3_PER is well behaved. R113 holds LPn high with no host connection. U1 can drive I2C_RST through the named net, but that resets the communications interface, not an independently switched sensor supply. |
| Steady state | R110/R111 draw 1.5 mA each at an ideal 3.3 V low-held bus, or 3 mA for both lines. Sensor current is not represented as an individual waveform. ST lists active-ranging combined currents of 95 mA typical and 130 mA maximum, already comparable to the entire 130 mA non-codec 3V3_PER budget. |
| Transient / shutdown | The datasheet permits an additional 10 mA peak on each sensor supply; common-rail demand can therefore exceed the average budget before display/oscillator loads. Effective bypass, cable inductance and reset recovery after a brownout need a dedicated test. |
| EMI / EMC | SOC_SDA/SCL join the codec and PCA9306 camera translator. At 2.2 kΩ, the simple RC300 ns rise-time budget corresponds to about 161 pF; total bus capacitance and translator loading are not extracted. The ToF optical opening/cover and adjacent switching noise have no system test. |
| Thermal | Continuous ranging at the documented 3.3 V configuration is approximately 313 mW typical, not a measured junction temperature. The native board places U110 at (50.0, 11.2) mm on the front, but enclosure conduction and cover-glass/optical-temperature effects are absent. |

**Missing models:** ST mode-specific activity/reset behavior; sensor/cover optical model; total bus capacitance and endpoint leakage; MCU peripheral-source transient response; sensor package thermal network.

Saved rail comparison — all currents below are aggregate model values.

| Rail | Run0027 steady V | Run0027 aggregate A | Run0004 steady V | Run0004 aggregate A |
|---|---:|---:|---:|---:|
| 3V3_PER | 3.291772 | 0.164551 | 3.291772 | 0.164551 |

### s21-current-budget · HIGH · requires input

The shared 3V3_PER non-codec model allowance is 130 mA. U110 alone has a 130 mA combined active-ranging maximum in the current ST table, plus potential peak uplift; the display and oscillator also use this rail. The modeled rail pass does not establish its load budget.

**Affected:** U110, C110, C111, J121, J103, Y120; nets 3V3_PER.

**Next action:** Build a disjoint per-load budget using the selected ranging mode and all external loads, then rerun rail/cable transients. Keep datasheet limits separate from actual measured current.

**Acceptance:** The upstream regulator and connector budget cover simultaneous peak loads, and sensor-pad voltage stays within the approved range under the declared ranging/display modes.

**Project evidence:** [hardware/21-tof-01.kicad_sch](../../hardware/21-tof-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [simulation/engine.py](../../simulation/engine.py).

**Manufacturer/standard basis:** [ST VL53L5CX, DS13754 Rev13](https://www.st.com/resource/en/datasheet/vl53l5cx.pdf).

### s21-voltage-window · HIGH · qualified model or documentation

The rail model accepts 3V3_PER up to 3.63 V using a generic ±10% band, whereas the sensor 3.3 V operating configuration ends at 3.6 V. A green shared-rail status can therefore hide a sensor-specific overvoltage limit.

**Affected:** U110, J121; nets 3V3_PER.

**Next action:** Give the future component stress checker the sensor-specific 3.0–3.6 V operating window and the external regulator tolerance/transient envelope; do not alter the PCB solely from nominal voltage.

**Acceptance:** All evaluated corners use component-specific limits and the actual source tolerance; no peak at U110 exceeds its permitted voltage.

**Project evidence:** [hardware/21-tof-01.kicad_sch](../../hardware/21-tof-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [simulation/engine.py](../../simulation/engine.py).

**Manufacturer/standard basis:** [ST VL53L5CX, DS13754 Rev13](https://www.st.com/resource/en/datasheet/vl53l5cx.pdf).

### s21-recovery-control · WARNING · requires input

LPn is only pulled high by R113; I2C_RST is host-controlled and R115 defaults it low. Thus this board cannot independently drive LPn low for comms isolation, and a whole-sensor power cycle would also affect other 3V3_PER loads.

**Affected:** U110, R113, R115, U1; nets TOF_LPN, TOF_I2C_RST, 3V3_PER.

**Next action:** Define the driver recovery sequence and determine whether interface reset alone covers expected faults. If independent recovery is required, allocate host LPn control or an appropriately sequenced sensor load switch.

**Acceptance:** Forced I²C-stuck and sensor-brownout faults recover with the documented procedure without destabilizing codec/camera traffic.

**Project evidence:** [hardware/21-tof-01.kicad_sch](../../hardware/21-tof-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml).

**Manufacturer/standard basis:** [ST VL53L5CX, DS13754 Rev13](https://www.st.com/resource/en/datasheet/vl53l5cx.pdf).

### s21-i2c-rise-off-state · WARNING · requires input

The 2.2 kΩ pull-ups to 3.3 V feed U1, U110, U130 and the camera translator. Their low-state current is calculable; rise time and injection into an unpowered VCCIO6 are not. The historic SDA routing audit explicitly did not qualify bus capacitance.

**Affected:** R110, R111, U110, U120, U130, U1; nets SOC_SDA, SOC_SCL, 3V3_PER, VCC_3V3.

**Next action:** Measure/extract the complete bus, begin with a supported conservative bus rate, and qualify power-off leakage. Select revised pull-ups/isolation only from rise-time and sink-current margins.

**Acceptance:** At the chosen bus rate, all endpoints satisfy rise time, VOL, setup/hold and power-off injection limits, including the active camera branch.

**Project evidence:** [hardware/21-tof-01.kicad_sch](../../hardware/21-tof-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [peripheral-revision/host-i2c/sda-complete/README.md](../../peripheral-revision/host-i2c/sda-complete/README.md).

**Manufacturer/standard basis:** [NXP UM10204 I2C-bus specification](https://cache.nxp.com/docs/en/user-guide/UM10204.pdf).

**Proposed change classification:**

- Qualified model/documentation change: apply U110 voltage limits and replace the shared-load placeholder with a traceable load budget.
- Requires input: ranging duty, optical assembly and external 3.3 V converter behavior.
- Conditional PCB change: expose LPn or add isolated sensor power only if required recovery/off-state behavior is otherwise unavailable.

## S22 — Two-lane camera, SCCB translation and 25 MHz clock

J110 implements the KLT-H7MA-OV5647 V1.0 pinout, including separate 1.5 V/1.8 V/2.8 V and filtered autofocus power. Level translation and default control bias are present, but sensor power sequencing, the autofocus budget and the complete CSI channel are not qualified.

Native primary records: **21**. `C120`, `C121`, `C122`, `C123`, `C124`, `C125`, `C126`, `C127`, `FB120`, `J110`, `R120`, `R121`, `R122`, `R123`, `R124`, `R125`, `U120`, `U121`, `U122`, `U123`, `Y120`.
Schematic: [hardware/22-camera-01.kicad_sch](../../hardware/22-camera-01.kicad_sch).

| State / discipline | Assessment |
|---|---|
| Startup | U121/U122 translate PWDN/reset to CAM_1V8; R123 pulls the 3.3 V PWDN input high and R124 pulls reset low. U123 translates the always-enabled 25 MHz oscillator. All buffer/OE pins are grounded. These states depend on external CAM rails and SoC bank timing; a common modeled t=0 rise does not implement the module startup sequence. |
| Steady state | Run 27 predicts 1.497504 V/1.799001 V/2.797004 V on camera core/IO/analog and 2.795008 V on AF with an assumed 20 mA AF load. Those values use declared rail loads; sensor and actuator pin currents remain Unknown. The OV5647 brief calls for a tighter 1.5 V±5% core window than the model’s ±10%. |
| Transient / shutdown | U120 EN and VREF2 share a 200 kΩ bias from 3V3_PER. When CAM_1V8 is off or cannot sink bias, this arrangement can charge its low-side rail. Autofocus current steps and long harness paths are absent from the model; the module’s documented DW9714 has a 120 mA sink capability, not a guaranteed 20 mA load. |
| EMI / EMC | Native CSI pair mismatches are small, but final geometry retains 4.46–5.99 mm of uncoupled copper per leg. Package/flex/connector models, edge/LP-HS transitions and an approved impedance stack are absent. The geometry audit is not an eye diagram or a supported camera bitrate. |
| Thermal | No sensor/VCM thermal solution exists. Power in FB120, the sensor core and actuator varies with operating mode and focus command. Board ambient alone does not establish optical image quality or sensor junction temperature. |

**Missing models:** Exact purchased module/flex and register sequence; sensor/VCM current waveforms; CAM regulator discharge/sinking behavior; PCA9306 off-state network; full CSI channel and receiver/transmitter models.

Saved rail comparison — all currents below are aggregate model values.

| Rail | Run0027 steady V | Run0027 aggregate A | Run0004 steady V | Run0004 aggregate A |
|---|---:|---:|---:|---:|
| CAM_1V5 | 1.497504 | 0.049917 | 1.497504 | 0.049917 |
| CAM_1V8 | 1.799001 | 0.019989 | 1.799001 | 0.019989 |
| CAM_2V8 | 2.797004 | 0.059921 | 2.797004 | 0.059921 |
| CAM_AF_2V8 | 2.795008 | 0.019964 | 2.795008 | 0.019964 |

### s22-specific-module · WARNING · requires input

The 24-pin connector is for one named KLT module, with pins 5–11 NC and two data lanes. It is not electrically interchangeable with a generic Pi camera flex. The vendor packet identifies the mating connector family and contains a not-recommended-for-new-design notice.

**Affected:** J110; nets CSI0_D0_P, CSI0_D0_N, CSI0_D1_P, CSI0_D1_N, CSI0_CLK_P, CSI0_CLK_N.

**Next action:** Confirm the exact module and mating connector stock, orientation and optical/flex envelope before freezing a new PCB revision. Treat an alternate camera as an interface redesign.

**Acceptance:** Purchased module revision and mating parts match the approved pin table and mechanical sample; no pinout substitution is inferred from connector count.

**Project evidence:** [hardware/22-camera-01.kicad_sch](../../hardware/22-camera-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [research/carrier-interfaces.md](../../research/carrier-interfaces.md), [docs/connectors-and-testpoints.md](../../docs/connectors-and-testpoints.md).

**Manufacturer/standard basis:** [Kai Lap KLT-H7MA-OV5647 V1.0 module specification](https://kailaptech.net/KLT/EN/PDF/KLT-H7MA-OV5647%20V1.0%205MP%20OmniVision%20OV5647%20MIPI%20Interface%20Auto%20Focus%20Camera%20Module.pdf).

### s22-translator-backbias · HIGH · requires input

U120 EN/VREF2 are permanently biased from 3V3_PER through R120 = 200 kΩ, with VREF1 on CAM_1V8. TI explicitly documents low-side rail rise when an LDO cannot sink this bias. This board has no host EN-off control or deliberate VREF1 bleed.

**Affected:** U120, R120, R121, R122; nets CAM_I2C_BIAS, CAM_1V8, 3V3_PER, CAM_SDA, CAM_SCL.

**Next action:** Analyze the actual MCU-side CAM_1V8 regulator and all off-state loads. Provide an EN disable or manufacturer-sized bleed/isolation arrangement if the rail can float; do not choose a bleed from typical bias alone.

**Acceptance:** Across camera-off/peripherals-on and all ramp orders, CAM_1V8 and camera pins stay inside approved off-state/operating limits and the common I²C bus remains usable.

**Project evidence:** [hardware/22-camera-01.kicad_sch](../../hardware/22-camera-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [references/pca9306-revo.pdf](../../references/pca9306-revo.pdf).

**Manufacturer/standard basis:** [TI PCA9306, SCPS113O](https://www.ti.com/lit/ds/symlink/pca9306.pdf).

### s22-buffer-sequence · HIGH · requires input

PWDN/reset/MCLK outputs follow 1.8 V buffers with/OE hard low. Ioff supports power-off behavior but does not impose a camera-ready clock/reset sequence while the rail is ramping; Y120 is enabled whenever 3V3_PER exists.

**Affected:** U121, U122, U123, Y120, R123, R124, R125; nets CAM_PWDN, CAM_RESET_N, CAM_MCLK, CAM_1V8, 3V3_PER.

**Next action:** Define and capture sensor rail/reset/PWDN/clock ordering. If a quiet clock or guaranteed tri-state during ramps is required, add a controlled output enable or qualified oscillator-enable path.

**Acceptance:** At J110 the actual 25 MHz clock, level, rise/fall/duty and reset/PWDN timing satisfy the purchased module limits for every startup and shutdown order.

**Project evidence:** [hardware/22-camera-01.kicad_sch](../../hardware/22-camera-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [references/sn74lvc1g125-revu.txt](../../references/sn74lvc1g125-revu.txt).

**Manufacturer/standard basis:** [TI SN74LVC1G125, SCES223U](https://www.ti.com/lit/ds/symlink/sn74lvc1g125.pdf), [Kai Lap KLT-H7MA-OV5647 V1.0 module specification](https://kailaptech.net/KLT/EN/PDF/KLT-H7MA-OV5647%20V1.0%205MP%20OmniVision%20OV5647%20MIPI%20Interface%20Auto%20Focus%20Camera%20Module.pdf).

### s22-rail-af-envelope · HIGH · qualified model or documentation

CAM_1V5 uses a 1.35–1.65 V model window, while the sensor brief’s core window is 1.425–1.575 V. The AF branch assumes 20 mA and FB120 = 0.1 Ω; the installed BLM18AG601SN1 manufacturer sheet gives 0.38 Ω maximum DCR. At 120 mA that maximum alone drops 45.6 mV and dissipates 5.47 mW.

**Affected:** J110, FB120, C120, C123, J121; nets CAM_1V5, CAM_2V8, CAM_AF_2V8.

**Next action:** Apply device-specific voltage tolerances and a bounded ferrite DCR corner; obtain the real actuator current trajectory and source response before changing bead/bulk values.

**Acceptance:** Qualified core-voltage limits hold at the module; full focus travel and simultaneous imaging preserve the AF voltage budget and component thermal margins.

**Project evidence:** [hardware/22-camera-01.kicad_sch](../../hardware/22-camera-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [simulation/engine.py](../../simulation/engine.py).

**Manufacturer/standard basis:** [Kai Lap KLT-H7MA-OV5647 V1.0 module specification](https://kailaptech.net/KLT/EN/PDF/KLT-H7MA-OV5647%20V1.0%205MP%20OmniVision%20OV5647%20MIPI%20Interface%20Auto%20Focus%20Camera%20Module.pdf), [Murata BLM18AG601SN1 manufacturer product sheet](https://www.murata.com/en-us/api/pdfdownloadapi?cate=cgsubChipFerriBead&partno=BLM18AG601SN1%23).

### s22-csi-channel · WARNING · requires input

Final CSI0_D0/CLK/D1 parallel fractions are 64.8%/57.5%/55.6%, with D0 pin-path mismatch 0.022 mm and CLK/D1 approximately 0.000 mm. These are geometry measurements; uncoupled fanouts, vias and the external flex remain electrical discontinuities.

**Affected:** J110, U1; nets CSI0_D0_P, CSI0_D0_N, CSI0_CLK_P, CSI0_CLK_N, CSI0_D1_P, CSI0_D1_N.

**Next action:** Extract the complete two-lane channel using approved stackup and actual flex/connector models; set the intended bitrate and receiver criteria before retuning copper.

**Acceptance:** The declared operating mode passes LP/HS signaling and eye/timing requirements at all channels; any copper revision preserves net parity and fabricator-approved geometry.

**Project evidence:** [hardware/22-camera-01.kicad_sch](../../hardware/22-camera-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [reports/differential-review.md](../../reports/differential-review.md).

### s22-shared-bus-loading · WARNING · requires input

Camera-side 2.2 kΩ pulls join host-side 2.2 kΩ pulls through a passive translator. At low bus state the sink may carry current from both voltage domains; the ideal upper bound is about 2.32 mA per active line at 3.3 V/1.8 V, before voltage drops.

**Affected:** U120, R110, R111, R121, R122; nets SOC_SDA, SOC_SCL, CAM_SDA, CAM_SCL.

**Next action:** Include both pull-up networks and camera cable capacitance in sink/rise-time checks; keep address conventions and sensor/VCM transactions explicit.

**Acceptance:** Every device pulling low can sink the combined current while meetingVOL; high levels and rise time pass on both sides of the translator.

**Project evidence:** [hardware/22-camera-01.kicad_sch](../../hardware/22-camera-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [references/pca9306-revo.pdf](../../references/pca9306-revo.pdf).

**Manufacturer/standard basis:** [TI PCA9306, SCPS113O](https://www.ti.com/lit/ds/symlink/pca9306.pdf), [NXP UM10204 I2C-bus specification](https://cache.nxp.com/docs/en/user-guide/UM10204.pdf).

**Proposed change classification:**

- Qualified model/documentation change: tighten camera core voltage limits and include AF load/DCR corners.
- Requires input: exact module/flex supply, camera register timing and external regulator off-state behavior.
- Conditional PCB change: controlled PCA9306/buffer enables or bleed, revised filtering and CSI geometry only after the corresponding off-state/channel result.

## S23 — Stereo codec, I²S and microphone front end

U130 is a TLV320AIC3104 with separate 1.8 V digital and 3.3 V analog/IO supplies, two electret inputs and differential line outputs. The passives establish a plausible interface, but the codec register configuration, signal levels, microphone bias current and clock timing remain undefined.

Native primary records: **30**. `C130`, `C131`, `C132`, `C133`, `C134`, `C135`, `C136`, `C137`, `C138`, `C139`, `C140`, `C141`, `C142`, `C143`, `FB130`, `MK130`, `MK131`, `R130`, `R131`, `R132`, `R133`, `R134`, `R135`, `R136`, `R137`, `R138`, `R139`, `R140`, `R141`, `U130`.
Schematic: [hardware/23-audio-01.kicad_sch](../../hardware/23-audio-01.kicad_sch).

| State / discipline | Assessment |
|---|---|
| Startup | R130 holds CODEC_RESET_N low. The external 1V8_AUDIO and 3V3_PER supplies are independently defined boundaries; FB130 adds analog-rail dynamics. TI recommends IOVDD first, analog supplies next, DVDD last within 5 ms of analog availability, reset held low until stable, and analog voltage never below DVDD. The present rail traces do not prove this sequence on the real MCU board. |
| Steady state | Run 27 reports 3V3_AUDIO 3.288285 V with a 34.876 mA aggregate placeholder and 1V8_AUDIO 1.799250 V with 14.994 mA. These are not U130 supply-pin measurements. MICBIAS is programmable; R139 = 100 Ω, C137 = 4.7 µF and R140/R141 = 2.2 kΩ shape microphone supply behavior, while coupling capacitors remove DC from the signal inputs. |
| Transient / shutdown | The 100 Ω/4.7 µF bias branch has a 0.47 ms ideal RC time constant and 339 Hz single-pole corner, before MICBIAS output impedance and microphone load. A 1 mA total microphone bias load would drop 100 mV across R139; actual bias current, settling and pop behavior are unmodeled. Codec reset must remain asserted during partial rail loss. |
| EMI / EMC | R131–R135 provide 33 Ω source-series damping; R136–R138 add 100 Ω MCU monitor branches. The accepted WCLK monitor has a 20.689 mm geometric route after its resistor plus a 3.186 mm pre-resistor branch; a resistor does not remove this load. The 30 mm microphone baseline is physical geometry, not a noise/crosstalk qualification. |
| Thermal | No codec, microphone or nearby class-D heating solution exists. U130 power depends on enabled ADC/DAC/output blocks and clocks. FB130 uses the same BLM18AG601SN1 as the camera AF branch; a maximum-DCR loss corner is needed before deriving temperature rise. |

**Missing models:** Codec register/clock map and activity-current model; microphone capsule impedance/current; actual source rail sequencing; I²S driver/receiver/cable models; acoustic enclosure and package thermal paths.

Saved rail comparison — all currents below are aggregate model values.

| Rail | Run0027 steady V | Run0027 aggregate A | Run0004 steady V | Run0004 aggregate A |
|---|---:|---:|---:|---:|
| 3V3_PER | 3.291772 | 0.164551 | 3.291772 | 0.164551 |
| 3V3_AUDIO | 3.288285 | 0.034876 | 3.288285 | 0.034876 |
| 1V8_AUDIO | 1.79925 | 0.014994 | 1.79925 | 0.014994 |

### s23-codec-sequence · HIGH · requires input

The codec’s analog and digital rails come through different external paths, with only a GPIO/pulldown reset. Simultaneous ideal ramp commands do not verify TI’s analog-before-DVDD and reset constraints, especially on shutdown or a missing MCU rail.

**Affected:** U130, R130, FB130, C134, C136, J121; nets CODEC_RESET_N, 3V3_PER, 3V3_AUDIO, 1V8_AUDIO.

**Next action:** Incorporate the codec sequence into the cross-board power contract and driver; measure actual rail/reset ordering, including restart with one rail retained. Add sequencing hardware only if the existing sources cannot guarantee it.

**Acceptance:** Every startup/shutdown/brownout keeps the codec supply and reset relationship inside its documented conditions and recovers without an unexplained high-current state.

**Project evidence:** [hardware/23-audio-01.kicad_sch](../../hardware/23-audio-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml).

**Manufacturer/standard basis:** [TI TLV320AIC3104, SLAS510G](https://www.ti.com/lit/ds/symlink/tlv320aic3104.pdf).

### s23-i2s-monitor · WARNING · requires input

The three MCU monitor branches are real receiver loads; WCLK’s accepted route includes both a pre-resistor branch and a long 100 Ω-isolated extension. All clock/data inputs are directly tied to the selected 3.3 V IO domain. Timing remains dependent on the actual MCU harness and clock-master choice.

**Affected:** R131, R132, R133, R134, R135, R136, R137, R138, U130, J121; nets AIC_MCLK, AIC_BCLK, AIC_WCLK, I2S_DOUT_SOC, AUDIO_MON_BCLK, AUDIO_MON_WCLK, AUDIO_MON_DATA.

**Next action:** Freeze SoC/codec clock-master roles and the MCU receiver load, preserve the shared TX/RX clock pinmux, and evaluate monitor-on/off timing before changing resistor values.

**Acceptance:** At the declared sample/bit rate, timing and voltage margins hold at U130 and the MCU with the real harness; no receiver back-powers the opposite domain.

**Project evidence:** [hardware/23-audio-01.kicad_sch](../../hardware/23-audio-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [peripheral-revision/wclk-monitor/README.md](../../peripheral-revision/wclk-monitor/README.md), [research/carrier-interfaces.md](../../research/carrier-interfaces.md).

### s23-microphone-bias · WARNING · requires input

C137 is behind 100 Ω R139 rather than directly on MICBIAS, and the two microphone loads share this filter. The bias voltage is not fixed by the net name; the codec configuration and capsule operating current determine headroom and settling. The 1 µF signal coupling capacitors have no validated input-impedance model.

**Affected:** U130, R139, R140, R141, C137, C138, C139, C140, C141, C142, C143, MK130, MK131; nets MICBIAS, MIC_BIAS_FILT, MIC_L_RAW, MIC_R_RAW, MIC_LP, MIC_RP.

**Next action:** Obtain the exact microphone electrical data and codec input/bias settings, calculate DC headroom and all filter corners, and measure startup pop/noise with the real enclosure.

**Acceptance:** Both microphones remain within their bias limits; sensitivity/channel balance and noise targets pass across bias settling, audio playback and Wi-Fi activity.

**Project evidence:** [hardware/23-audio-01.kicad_sch](../../hardware/23-audio-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml).

**Manufacturer/standard basis:** [TI TLV320AIC3104, SLAS510G](https://www.ti.com/lit/ds/symlink/tlv320aic3104.pdf).

### s23-bead-dcr · WARNING · qualified model or documentation

FB130’s 0.1 Ω simulation resistance is an assumption; the exact BLM18AG601SN1 manufacturer sheet specifies 0.38 Ω maximum DCR. At 35 mA that bound gives 13.3 mV drop and 0.466 mW loss, before PCB resistance, rather than the model’s 3.5 mV/0.123 mW nominal calculation.

**Affected:** FB130, C130, C131, C132, C135, U130; nets 3V3_PER, 3V3_AUDIO.

**Next action:** Retain a nominal model if justified but add the published maximum-DCR corner and bias-dependent impedance. Reassess effective local capacitance and analog rejection under actual load.

**Acceptance:** The analog rail remains within codec limits and measured audio noise/distortion targets pass at worst source/load/DCR conditions.

**Project evidence:** [hardware/23-audio-01.kicad_sch](../../hardware/23-audio-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [simulation/engine.py](../../simulation/engine.py).

**Manufacturer/standard basis:** [Murata BLM18AG601SN1 manufacturer product sheet](https://www.murata.com/en-us/api/pdfdownloadapi?cate=cgsubChipFerriBead&partno=BLM18AG601SN1%23).

**Proposed change classification:**

- Qualified documentation/firmware change: specify codec register, reset, clock-master and monitor-bus roles.
- Qualified model change: include maximum FB130 resistance and distinct supply-pin load budgets without presenting them as measurements.
- Requires input: microphone operating data, acoustic target, MCU harness and source sequencing.
- Conditional PCB change: revise bias/filter/isolation only after DC, noise, timing and off-state results.

## S24 — Stereo bridge-tied speaker amplifier

U140 is a 5 V TPA2012D2 in RTJ WQFN, with both channels controlled by AMP_ENABLE, 6 dB gain straps, AC-coupled differential inputs and a bead on each BTL lead. Speaker impedance, audio amplitude, cable geometry and output loss are absent from the simulation.

Native primary records: **16**. `C150`, `C151`, `C152`, `C153`, `C154`, `C155`, `C156`, `C157`, `FB140`, `FB141`, `FB142`, `FB143`, `J140`, `J141`, `R150`, `U140`.
Schematic: [hardware/24-speakers-01.kicad_sch](../../hardware/24-speakers-01.kicad_sch).

| State / discipline | Assessment |
|---|---|
| Startup | R150 = 100 kΩ defaults both shutdown pins low. The codec and amplifier must follow a mute/enable sequence to avoid startup transients. A modeled 5 V rail does not model the amplifier PWM stage or establish the state of its inputs when CODEC_RESET_N is released. |
| Steady state | The speaker outputs are distinct positive/negative bridge nodes; neither is GND. Run 27’s 5V_SOC 4.592139 V and aggregate 1.315511 A are board-supply estimates, not amplifier or speaker current. The output stage is not driven by the U7 SPICE experiment. |
| Transient / shutdown | For context, TI’s 2.1 W per channel condition at 4 Ω / 5 V is at 10% THD, not a clean-audio design guarantee. That load power implies 0.725 A RMS and 1.025 A peak sine current per speaker before switching ripple. Real demands require a selected speaker and signal limit. |
| EMI / EMC | The right filtered output paths are about 88.58/93.86 mm planar versus 8.76/9.94 mm on the left in the accepted route audit. Native netlist contains four series beads but no output shunt capacitors. Long board traces plus the external speaker cable require an evaluated filter and return path; no conducted or radiated pass exists. |
| Thermal | U140’s exposed pad is GND-connected in the netlist, but the assembled solder/plane/enclosure thermal path is unqualified. At 0.725 A RMS a 0.14 Ω bead would dissipate about 73.5 mW per lead; switching loss and trace/contact loss are additional. No junction temperature follows from the app’s separate L219-only estimate. |

**Missing models:** Speaker impedance versus frequency and power rating; audio amplitude/crest factor; TPA2012D2 switching/loss model; bead impedance/DC-bias data; cable and enclosure; thermal-pad assembly and heat-removal model.

Saved rail comparison — all currents below are aggregate model values.

| Rail | Run0027 steady V | Run0027 aggregate A | Run0004 steady V | Run0004 aggregate A |
|---|---:|---:|---:|---:|
| 5V_SOC | 4.592139 | 1.315511 | 4.848318 | 1.264018 |

### s24-bead-rating · HIGH · qualified documentation or bom

FB140–FB143 have the native value 600R@100 MHz 2 A, but the exact BLM21PG601SN1 manufacturer catalog row lists 1400 mA and 0.14 Ω maximum DCR. This is a rating annotation discrepancy, not proof that the current circuit overloads the beads.

**Affected:** FB140, FB141, FB142, FB143; nets SPK_L_P_RAW, SPK_L_N_RAW, SPK_R_P_RAW, SPK_R_N_RAW.

**Next action:** Obtain the current supplier approval sheet and correct the 2 A annotation or select a genuinely qualified alternate after current/thermal/impedance review. Do not silently carry the label forward.

**Acceptance:** BOM, schematic and procurement specification agree on the exact bead and temperature-dependent rating; RMS/ripple current and dissipation stay inside the approved envelope.

**Project evidence:** [hardware/24-speakers-01.kicad_sch](../../hardware/24-speakers-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml).

**Manufacturer/standard basis:** [Murata ferrite model catalog 2602, BLM21PG601SN1 row](https://www.murata.com/-/media/webrenewal/tool/library/common-pdf/static-model/component-list-fb-s-2602.ashx?cvid=20260515010000000000&la=en-sg).

### s24-output-filter · HIGH · requires input

The final circuit uses series beads only, while the right speaker traces are nearly 90–94 mm before the external cable. TI’s filter guidance distinguishes ferrite filtering from LC filtering for long leads or sensitive lower-frequency circuitry. The current network has not been assessed against the actual cable.

**Affected:** U140, FB140, FB141, FB142, FB143, J140, J141; nets SPK_L_P, SPK_L_N, SPK_R_P, SPK_R_N.

**Next action:** Model the selected speaker/cable and compare bead-only, manufacturer ferrite-plus-shunt and LC options. Reserve or add matched filter positions only after checking stability, idle current, distortion and emissions.

**Acceptance:** Chosen filter passes the declared audio and EMC tests with the longest intended cable and worst operating mode; no excessive capacitive output loading is introduced.

**Project evidence:** [hardware/24-speakers-01.kicad_sch](../../hardware/24-speakers-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [peripheral-revision/audio-speakers/speaker-review.md](../../peripheral-revision/audio-speakers/speaker-review.md).

**Manufacturer/standard basis:** [TI TPA2012D2, SLOS438F](https://www.ti.com/lit/ds/symlink/tpa2012d2.pdf).

### s24-btl-power · WARNING · requires input

Both gain straps are grounded and both shutdown controls share AMP_ENABLE. The board does not specify a speaker impedance or audio limiter, and the generic 5 V load budget does not resolve either channel’s current. Grounding a negative speaker terminal would short an active BTL output.

**Affected:** U140, R150, J140, J141; nets AMP_ENABLE, SPK_L_P, SPK_L_N, SPK_R_P, SPK_R_N, 5V_SOC.

**Next action:** Specify speakers, allowable distortion and limiter level; document differential probing and BTL harness polarity. Include both channels in supply and copper-loss budgets, then validate mute/enable sequencing.

**Acceptance:** The declared output power is achieved within distortion, supply droop, component current and thermal limits; wiring/probing never treats either BTL terminal as ground.

**Project evidence:** [hardware/24-speakers-01.kicad_sch](../../hardware/24-speakers-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [docs/connectors-and-testpoints.md](../../docs/connectors-and-testpoints.md).

**Manufacturer/standard basis:** [TI TPA2012D2, SLOS438F](https://www.ti.com/lit/ds/symlink/tpa2012d2.pdf).

### s24-thermal-pad · WARNING · requires input

The RTJ exposed pad is netlisted to GND, and accepted routing checks preserve all amplifier pads and output paths. Those checks do not establish solder voiding, thermal-via manufacture, temperature rise or the benefit of plane copper on this 55 mm board.

**Affected:** U140, C154, C155, C156, C157; nets 5V_SOC, GND.

**Next action:** Use actual loss and assembly geometry for a board thermal calculation, followed by temperature testing at the maximum declared audio duty and ambient.

**Acceptance:** Measured or validated junction estimate has a documented margin to the selected operating limit; bead/trace/connector temperatures also pass.

**Project evidence:** [hardware/24-speakers-01.kicad_sch](../../hardware/24-speakers-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [peripheral-revision/audio-speakers/speaker-review.md](../../peripheral-revision/audio-speakers/speaker-review.md).

**Manufacturer/standard basis:** [TI TPA2012D2, SLOS438F](https://www.ti.com/lit/ds/symlink/tpa2012d2.pdf).

**Proposed change classification:**

- Qualified BOM/documentation change: resolve the exact speaker-bead 2 A versus 1.4 A rating discrepancy.
- Requires input: speaker impedance/power, audio limiter, cable and enclosure.
- Conditional PCB change: add or revise output filtering and heat-removal copper only from the qualified load/EMC/thermal study.

## S25 — USB recovery data port and operator buttons

J150 is a USB-C USB2 device/recovery connection with separate CC pull-downs, data-line ESD and a VBUS sensing divider. USB VBUS is isolated from the main 5 V rail by topology; recovery enumeration and protection of non-data connector pins are not demonstrated.

Native primary records: **13**. `C160`, `J150`, `R15`, `R160`, `R161`, `R162`, `R163`, `R164`, `R165`, `SW100`, `SW101`, `SW102`, `U150`.
Schematic: [hardware/25-usb_recovery-01.kicad_sch](../../hardware/25-usb_recovery-01.kicad_sch).

| State / discipline | Assessment |
|---|---|
| Startup | USB_VBUS may exist before J120 main power. R162/R163 therefore apply a divided voltage to RK3566 VBUSDET even when the PHY rails are off; the model has no powered-off detector behavior. SW100 grounds SARADC recovery input, while SW101/SW102 act through the PMIC/reset support networks. |
| Steady state | R162 = 100 kΩ over R163 = 150 kΩ gives 0.6 × VBUS: 3.0 V and 20 µA divider current at 5 V. With ±1% resistors and 4.75–5.25 V input, the calculated detector interval is 2.827–3.175 V, inside the guide’s 2.7–3.3 V detection band. This arithmetic does not prove clamp/injection behavior during detach or unpowered operation. |
| Transient / shutdown | C160 = 100 nF is the only direct VBUS capacitor on this sheet; no local VBUS/CC TVS appears in the native netlist. U150 protects the two data lines. Attach/detach, cable discharge and ESD outcomes require a specified external environment and measurement. |
| EMI / EMC | Final complete SoC-to-USB-C path mismatches are 0.007 mm atA contacts and 0.112 mm atB contacts. Uncoupled fanouts and the connector’s duplicateD+/D− contacts remain part of the full channel. TPD2EUSB30 presence and close matching do not establish USB signal integrity or system immunity. |
| Thermal | Divider dissipation is only 100µW total at 5 V by resistor arithmetic, but USB fault/ESD heating is not a steady-state thermal model. No connector-temperature or transient-protection result is available; the connector is not the authorized main power input. |

**Missing models:** RK3566 powered-off VBUSDET and USB PHY models; connector/cable/ESD discharge path; exact CC/VBUS surge environment; USB device firmware and recovery/MaskROM procedure.

Saved rail comparison — all currents below are aggregate model values.

| Rail | Run0027 steady V | Run0027 aggregate A | Run0004 steady V | Run0004 aggregate A |
|---|---:|---:|---:|---:|
| VCCA_1V8 | 1.798651 | 0.044966 | 1.798651 | 0.044966 |
| 5V_SOC | 4.592139 | 1.315511 | 4.848318 | 1.264018 |

### s25-vbus-detector · WARNING · requires input

The 100 kΩ/150 kΩ divider matches a 5 V attach-detect use and its tolerance result fits the hardware guide. It remains connected to U1.T38 when main board power is absent; no detector power-off tolerance/injection result is present.

**Affected:** R162, R163, C160, J150, U1; nets USB_VBUS, USB_VBUS_DET.

**Next action:** Verify the specific RK3566 detector off-state limits and test VBUS-first/main-power-first/slow-detach cases; add isolation/clamping only if required without disturbing its high-level window.

**Acceptance:** Detector voltage/current stays within its device limits in every sequence and USB attach/detach remains reliable, including resistor and source tolerances.

**Project evidence:** [hardware/25-usb_recovery-01.kicad_sch](../../hardware/25-usb_recovery-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

**Manufacturer/standard basis:** [Rockchip RK3566 Hardware Design Guide V1.1](https://dl.xkwy2018.com/downloads/RK3568/RK356X/Hardware/Rockchip_RK3566_Hardware_Design_Guide_V1.1_EN.pdf).

### s25-port-protection · WARNING · requires input

U150 protects USB_CONN_P/N only. CC1/CC2 each have 5.1 kΩ toGND; VBUS has a divider/capacitor, and the shell is directly on GND. No CC or VBUS protection device appears on this sheet. This is a protection-coverage gap to assess, not a demonstrated immunity failure.

**Affected:** J150, U150, R160, R161, C160; nets USB_CC1, USB_CC2, USB_VBUS, USB_CONN_P, USB_CONN_N, GND.

**Next action:** Define the connector exposure and immunity target, review the discharge path and add correctly rated low-leakage protection where justified. Verify exact TPD2EUSB30 part/footprint and ground path.

**Acceptance:** Data and non-data contacts meet the declared ESD/transient tests without latent damage or incorrect attach state; added protection preserves CC and USB operation.

**Project evidence:** [hardware/25-usb_recovery-01.kicad_sch](../../hardware/25-usb_recovery-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml).

**Manufacturer/standard basis:** [TI TPDxEUSB30, SLVSAC2G](https://www.ti.com/lit/ds/symlink/tpd2eusb30.pdf).

### s25-usb-channel · WARNING · requires input

R164/R165 are 2.2 Ω data-series elements and U150 sits on the connector side. The final geometry has small end-to-end mismatch but still significant uncoupled/forked copper; package, ESD and cable parasitics are not simulated.

**Affected:** U150, R164, R165, J150, U1; nets USB_CONN_P, USB_CONN_N, USB_D_P, USB_D_N.

**Next action:** Extract the complete USB2 channel and validate the intended speed with the exact connector/cable/ESD package. Rework routing or series values only from the channel evidence.

**Acceptance:** USB2 eye/timing and recovery data transfer pass the declared operating conditions and cable variants.

**Project evidence:** [hardware/25-usb_recovery-01.kicad_sch](../../hardware/25-usb_recovery-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [reports/differential-review.md](../../reports/differential-review.md).

**Manufacturer/standard basis:** [TI TPDxEUSB30, SLVSAC2G](https://www.ti.com/lit/ds/symlink/tpd2eusb30.pdf).

### s25-recovery-procedure · WARNING · qualified documentation or firmware

SW100 pulls SARADC_VIN0 low through the RECOVERY_KEY net; R15 is 10 kΩ to VCCA_1V8. This is not proof of a forced MaskROM path when a valid eMMC boot device is fitted. SW101 uses 22 Ω toRESETn; SW102 uses 100 Ω to PMIC_PWRON.

**Affected:** SW100, SW101, SW102, R15, R224, R225, TP33; nets RECOVERY_KEY, RESET_KEY, POWER_KEY, RESETn, PMIC_PWRON.

**Next action:** Document separate recovery and true MaskROM procedures, main-power requirement and button timing; validate them with the selected boot image and removable eMMC. Preserve the RECOVERY label.

**Acceptance:** Repeated power/reset/recovery trials produce the documented boot mode and USB identity; a recoverable path remains when normal eMMC boot fails.

**Project evidence:** [hardware/25-usb_recovery-01.kicad_sch](../../hardware/25-usb_recovery-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [research/carrier-interfaces.md](../../research/carrier-interfaces.md), [docs/connectors-and-testpoints.md](../../docs/connectors-and-testpoints.md).

**Proposed change classification:**

- Qualified documentation/firmware change: distinguish Recovery from MaskROM and state that external 5 V main power is required.
- Requires input: USB exposure/protection target and powered-off VBUSDET behavior.
- Conditional PCB change: add CC/VBUS protection or detector isolation only after limits and system tests justify it.

## S26 — Bring-up testpoints and rail observability — group 1

This sheet owns 40 testpoint components spanning power rails, UART, PMIC controls, Wi-Fi enables and two inline eMMC access pads. The pads provide voltage access; they are not 40 current sensors or proof that the underlying nodes were measured.

Native primary records: **40**. `TP30`, `TP31`, `TP32`, `TP33`, `TP34`, `TP35`, `TP50`, `TP51`, `TP52`, `TP53`, `TP54`, `TP55`, `TP56`, `TP57`, `TP58`, `TP59`, `TP60`, `TP61`, `TP62`, `TP63`, `TP201`, `TP202`, `TP203`, `TP204`, `TP205`, `TP206`, `TP207`, `TP208`, `TP209`, `TP210`, `TP211`, `TP212`, `TP213`, `TP214`, `TP215`, `TP216`, `TP217`, `TP218`, `TP219`, `TP220`.
Schematic: [hardware/26-debug-01.kicad_sch](../../hardware/26-debug-01.kicad_sch).

| State / discipline | Assessment |
|---|---|
| Startup | TP201/202/203–214 and TP215 allow rail/reset correlation. TP50–56 observe external peripheral rails that must be related to J121.6 enable timing. TP218/219 expose Wi-Fi enables but not the internal module VDDC needed for its timing proof. |
| Steady state | TP203/TP204 straddle the 10 mΩ R227 CPU supply shunt. Their differential voltage can estimate aggregate CPU-rail current if pickup is truly Kelvin and the shunt/offset are calibrated; at 1 A the ideal signal is 10 mV and shunt dissipation 10 mW. Other one-node pads report potential, not current. |
| Transient / shutdown | Probe capacitance, ground inductance and attachment time can alter clock/reference behavior. TP62/TP63 are 0.6 mm eMMC clock/D0 inline landings, not disconnected stubs. They remain a capacitive discontinuity and a measurement load; no loaded-channel test is supplied. |
| EMI / EMC | The map includes PMIC SCL/SDA at TP57/58, not the separate peripheral SOC_SCL/SDA bus. Sensitive clocks should use short returns/low-loading probes; long scope-ground loops could create ringing absent from the board. The current geometry audit does not simulate the probe fixture. |
| Thermal | Testpoint voltage does not determine temperature. Shunt-derived current may support a loss estimate for R227 only after its resistance/temperature coefficient is known; it does not resolve internal RK3566 block heat or external rail dissipation. |

**Missing models:** Probe R/C/bandwidth and return fixture; differential amplifier/offset; R227 calibrated value and temperature coefficient; loaded eMMC channel; fixture mechanical clearance.

Saved rail comparison — all currents below are aggregate model values.

| Rail | Run0027 steady V | Run0027 aggregate A | Run0004 steady V | Run0004 aggregate A |
|---|---:|---:|---:|---:|
| 5V_SOC | 4.592139 | 1.315511 | 4.848318 | 1.264018 |
| VCC_3V3_SBC | 3.281876 | 1.208299 | 3.281876 | 1.208299 |
| VDD_CPU | 1.025 | 0.749997 | 1.025 | 0.749997 |
| VDD_CPU_P | 1.0325 | 0.749997 | 1.0325 | 0.749997 |
| VCC_3V3 | 3.265843 | 0.178136 | 3.265843 | 0.178136 |
| 3V3_PER | 3.291772 | 0.164551 | 3.291772 | 0.164551 |
| 1V8_AUDIO | 1.79925 | 0.014994 | 1.79925 | 0.014994 |

### s26-current-observability · WARNING · qualified measurement plan

Only TP203/TP204 intentionally bracket the 10 mΩ CPU shunt R227. Even there the measured difference contains pickup/offset error unless the connections are Kelvin. The remaining voltage pads do not establish per-component current.

**Affected:** TP203, TP204, R227; nets VDD_CPU_P, VDD_CPU.

**Next action:** Specify a differential Kelvin fixture and calibration/error budget; map each other current question to an actual shunt, branch measurement or justified model.

**Acceptance:** A known-load test verifies measured shunt current and uncertainty; the report never labels a rail aggregate as an individual IC pin current.

**Project evidence:** [hardware/26-debug-01.kicad_sch](../../hardware/26-debug-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [hardware/03-cpu-01.kicad_sch](../../hardware/03-cpu-01.kicad_sch), [docs/connectors-and-testpoints.md](../../docs/connectors-and-testpoints.md).

### s26-emmc-probe-loading · WARNING · requires input

TP62/TP63 are retained inline 0.6 mm eMMC clock/D0 pads. Eliminating a branch stub does not eliminate pad/probe capacitance, and the remote module and high-speed timing are still unqualified.

**Affected:** TP62, TP63, J1, U1; nets EMMC_CLK, EMMC_D0.

**Next action:** Use low-loading probes and model the mounted fixture/pads. Do not add larger branched pads merely to improve access; capture high-speed results only after probe loading is bounded.

**Acceptance:** Unprobed and probed channels both satisfy the chosen speed/timing criteria, or the probe setup is explicitly limited to low-speed bring-up.

**Project evidence:** [hardware/26-debug-01.kicad_sch](../../hardware/26-debug-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [docs/connectors-and-testpoints.md](../../docs/connectors-and-testpoints.md), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

**Manufacturer/standard basis:** [Rockchip RK3566 Hardware Design Guide V1.1](https://dl.xkwy2018.com/downloads/RK3568/RK356X/Hardware/Rockchip_RK3566_Hardware_Design_Guide_V1.1_EN.pdf).

### s26-signal-identity · WARNING · qualified documentation or firmware

TP57/58 are PMIC I²C, while the ToF/codec/camera host bus is SOC_SCL/SDA. TP30 is SoC RX and TP31 is SoC TX despite the inherited RADXA_RX/MCU_RX net names. Confusing these nodes can invalidate a bring-up conclusion or create UART contention.

**Affected:** TP30, TP31, TP57, TP58, R50; nets RADXA_RX, MCU_RX, I2C0_SCL_PMIC, I2C0_SDA_PMIC, SOC_SCL, SOC_SDA.

**Next action:** Publish one directional testpoint map with probe levels, intended bus and console isolation steps; keep functional silk consistent in a future drawing update.

**Acceptance:** Bench captures name the actual nets and UART direction; the R50 procedure and PMIC-versus-peripheral bus distinction are unambiguous.

**Project evidence:** [hardware/26-debug-01.kicad_sch](../../hardware/26-debug-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [docs/connectors-and-testpoints.md](../../docs/connectors-and-testpoints.md).

### s26-access-limits · WARNING · requires input

The native map gives local probe positions and existing GND pads; package-envelope graphics do not prove access with an installed heatsink, eMMC module, flexes and wiring. Probe force and ground-lead routing were not evaluated.

**Affected:** TP32, TP61, TP220, TP201, TP202, TP215, TP218, TP219; nets GND, 5V_SOC, VCC_3V3_SBC, RESETn, WIFI_REG_ON_H_GPIO2_B1, BT_REG_ON_H_GPIO2_B7.

**Next action:** Review the assembled access/fixture envelope and capture a scope connection plan. Move or duplicate only low-speed/DC pads if access is physically blocked; avoid new high-speed stubs.

**Acceptance:** All required bring-up measurements can be made without mechanical interference or adjacent-pin shorts and with a bounded probe-return loop.

**Project evidence:** [hardware/26-debug-01.kicad_sch](../../hardware/26-debug-01.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [docs/connectors-and-testpoints.md](../../docs/connectors-and-testpoints.md), [simulation/data/board-layout.json](../../simulation/data/board-layout.json).

**Proposed change classification:**

- Qualified documentation/measurement change: publish the probe-level/current-observability matrix and a calibrated CPU Kelvin procedure.
- Requires input: real probe fixture and assembled heatsink/module/cable access.
- Conditional PCB change: improve only genuinely blocked low-speed test access while preserving high-speed loading constraints.

## S27 — Bring-up testpoints and rail observability — group 2

TP221–TP227 add seven specific analog/image/IO/reference observation points. They close voltage-access gaps, but the domain identities and probe loading must remain distinct; they do not add functional or thermal models.

Native primary records: **7**. `TP221`, `TP222`, `TP223`, `TP224`, `TP225`, `TP226`, `TP227`.
Schematic: [hardware/27-debug-02.kicad_sch](../../hardware/27-debug-02.kicad_sch).

| State / discipline | Assessment |
|---|---|
| Startup | TP221–TP224 expose analog/image/codec-domain rails used in SoC sequencing. TP225/226 distinguish SD and Wi-Fi IO voltages. Their appearance in the candidate rail waveform does not prove actual OTP/pinmux sequencing or peripheral enumeration. |
| Steady state | TP226 is VCCIO_WL, presently linked to 1.8 V; it must not be interpreted as Wi-Fi 3.3 V VBAT. TP227 is the DDR command/address reference from R402/R403 = 1 kΩ, 0.1%, distinct from TP35 on DDR_VREFOUT. At nominal 1.35 V DDR, the ideal unloaded divider gives 0.675 V. |
| Transient / shutdown | The TP227 divider has approximately 500 Ω Thevenin resistance before its capacitors/loads. A 1 MΩ DC probe would shift the ideal voltage by about 0.05%; transient error also depends on probe capacitance and local decoupling. The SoC-driven DDR_VREFOUT source has a different, unmodeled output impedance. |
| EMI / EMC | TP222 is a small 0.6 mm image-rail access pad with a separately checked 1.2 mm probe disk in the geometry documentation. Neither that mechanical screen nor the lack of a high-speed branch establishes EMC. The optical/clock/reference neighborhoods need a fixture-aware measurement. |
| Thermal | No temperatures can be inferred directly from these seven voltage readings. Each image/analog/IO source needs an actual load and thermal model; core temperature depends on silicon activity and package heat transfer. |

**Missing models:** Reference-source impedance/noise and probe capacitance; selected IO voltage configuration; fixture access after assembly; actual image/analog block current and thermal model.

Saved rail comparison — all currents below are aggregate model values.

| Rail | Run0027 steady V | Run0027 aggregate A | Run0004 steady V | Run0004 aggregate A |
|---|---:|---:|---:|---:|
| VCCA_1V8 | 1.798651 | 0.044966 | 1.798651 | 0.044966 |
| VCCA1V8_IMAGE | 1.7994 | 0.019993 | 1.7994 | 0.019993 |
| VDDA0V9_IMAGE | 0.898951 | 0.034959 | 0.898951 | 0.034959 |
| VCCIO_ACODEC | 3.29964 | 0.011999 | 3.29964 | 0.011999 |
| VCCIO_SD | 3.29964 | 0.011999 | 3.29964 | 0.011999 |
| VCCIO_WL | 1.798831 | 0.011992 | 1.798831 | 0.011992 |

### s27-vref-separation · WARNING · qualified measurement plan

TP227 DDR3_VREFCA is a passive 1 kΩ/1 kΩ divider node; TP35 DDR_VREFOUT is a separate SoC-relatedDQ reference. They are different nets with different source impedances and must not be shorted or treated as duplicate points.

**Affected:** TP227, TP35, R402, R403, U1, U4, U5; nets DDR3_VREFCA, DDR_VREFOUT.

**Next action:** Define separate DC/ripple limits and probe impedance for each reference; keep the distinction explicit in the next measurement and PCB-change task.

**Acceptance:** Both references are measured with bounded loading against their own specification; no fixture or modification ties the nets together.

**Project evidence:** [hardware/27-debug-02.kicad_sch](../../hardware/27-debug-02.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [hardware/16-ddr_power-01.kicad_sch](../../hardware/16-ddr_power-01.kicad_sch), [docs/connectors-and-testpoints.md](../../docs/connectors-and-testpoints.md).

### s27-io-domain-identity · WARNING · qualified documentation or firmware

TP225 VCCIO_SD and TP226 VCCIO_WL are domain rails, not connector power aliases. Native R212 links Wi-Fi IO to VCCA1V8_PMU; the shared 3.3 V peripheral domains instead use other supply nets. A software IO-voltage setting cannot be inferred from the label alone.

**Affected:** TP225, TP226, R212, U1, U6; nets VCCIO_SD, VCCIO_WL, VCCA1V8_PMU.

**Next action:** Cross-check actual rail measurement with RK3566 IO-domain configuration and the selected storage/Wi-Fi mode before exercising the bus.

**Acceptance:** Electrical rail levels and software domain settings agree with every attached device through reset and runtime voltage changes.

**Project evidence:** [hardware/27-debug-02.kicad_sch](../../hardware/27-debug-02.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [research/carrier-interfaces.md](../../research/carrier-interfaces.md), [references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt](../../references/power-wifi/rk3566-hardware-design-guide-v1.1-en.txt).

**Manufacturer/standard basis:** [Rockchip RK3566 Hardware Design Guide V1.1](https://dl.xkwy2018.com/downloads/RK3568/RK356X/Hardware/Rockchip_RK3566_Hardware_Design_Guide_V1.1_EN.pdf).

### s27-probe-access · WARNING · requires input

The seven probes include image/analog rails in dense neighborhoods; TP222’s larger access disk is a separate geometric check, not an assembled probe guarantee. The current web color overlay assigns modeled voltage only, and no branch current sensor exists at these pads.

**Affected:** TP221, TP222, TP223, TP224, TP225, TP226, TP227; nets VCCA_1V8, VCCA1V8_IMAGE, VDDA0V9_IMAGE, VCCIO_ACODEC, VCCIO_SD, VCCIO_WL, DDR3_VREFCA.

**Next action:** Verify probe approach and nearby ground access with the real assembly, and preserve explicit Unknown current/temperature values. Relocate a pad only if the actual fixture requires it.

**Acceptance:** A documented fixture can reach every required rail/reference without loading it beyond its measurement budget or contacting neighboring copper.

**Project evidence:** [hardware/27-debug-02.kicad_sch](../../hardware/27-debug-02.kicad_sch), [simulation/data/native-netlist.xml](../../simulation/data/native-netlist.xml), [docs/connectors-and-testpoints.md](../../docs/connectors-and-testpoints.md), [simulation/data/board-layout.json](../../simulation/data/board-layout.json).

**Proposed change classification:**

- Qualified documentation/measurement change: distinguish CA/DQ references and storage/Wi-Fi IO domains in the probe plan.
- Requires input: reference limits and actual fixture characteristics.
- Conditional PCB change: relocate a blocked low-speed probe only after assembled-access review and reference loading analysis.

## Reference handling and limits

Technical part claims use manufacturer documents or the NXP I²C specification; locally retained Rockchip/AzureWave PDFs are manufacturer-authored documents even when mirrored by board vendors. The AzureWave V1.9 copy is the design-specific timing basis. A newly indexed AzureWave URL could not be retrieved, so no newer-module equivalence is claimed. The Murata catalog/product data were visible in current indexed official results, but live print/catalog retrieval redirected or failed; obtain the current approval sheet before procurement. The 1.4 A catalog entry therefore establishes an unresolved 2 A labeling conflict, not a substitute for temperature-dependent approval data.

Routing README files describe their explicitly frozen intermediate acceptances; no earlier candidate, partial-open count or patch instruction is treated as current board state. The hash-matched final review is the current geometry basis. Mathematical examples (divider voltage, RC time constant, resistor loss and RMS current from specified output power) are conditional calculations, not new circuit simulations or measurements. No RF/E/H map from the U7-only study is applied to these peripheral circuits.

The next PCB-change task should carry each finding ID, required input, selected design response and acceptance evidence forward. Close a finding only when that evidence exists; a better-looking visualization or a higher numerical self-score does not close hardware validation gaps.
