# 12 / 24 V detector boards

Two unbuilt PCB prototypes extend the original LMC662 / ADS1115 detector. Use the [interactive board and pin guide](power.html) to select specimen current or the positive collector. Both accept a regulated 9–30 V input, including nominal 12 V and 24 V. This supply powers detector electronics and collector bias; the electron gun, scan drivers and grounded ESP32 have separate supplies.

## What is onboard

Input fuse and reverse-polarity diode → LMR51420 500 kHz buck → approximately 5.09 V → RECOM R05P09D/P isolated raw ±9 V → RC filtering → TPS7A49 / TPS7A30 local ±5 V. The ADC runs from its own 3.3 V supply regulator. The collector also has a separate digital 3.3 V rail, an ATmega328P and two VO2611-X016 optocouplers.

The collector's XP Power CA02P-5 module is soldered onto the same board. It creates programmable 0–200 V from the onboard 5 V bus. Two 10 kΩ filter stages and 100 nF / 1 µF capacitors feed FCOM. Nominal FCOM at a raw 200 V is about 199.6 V because of bleeder loading. A TPS2553-1 latch-off switch limits the bias-module input: 88.7 kΩ / 1% programs a calculated 262–342 mA range, below the module’s 420 mA short-protection input limit. Its active-LOW fault goes through J3.7 to ESP32 GPIO34. Verify startup and current-limit behavior on the assembled board. Program linearity is specified from 15% of full scale, so treat low-bias settings as requiring calibration.

The isolated supply and HV converter are packaged modules; the buck is a discrete IC / inductor circuit. This is a self-contained onboard power design, not an entirely discrete magnetics design. Obtain current distributor quotes: the HV module may dominate cost.

Both layouts use local top/bottom PGND copper and six stitching vias around the buck's ground returns. The amplifier's C9/C10 bypass capacitors have direct 0.75 mm returns to the quiet AGND or FCOM plane. The guarded SUM trace and its no-plane region remain separate. These filled-copper connections were inspected in the native boards; their noise performance still requires measurement.

## Choose the current path

| Connection | Specimen-current board | Collector board |
|---|---|---|
| J1.1 SUM | Insulated conductive specimen holder | Separate insulated metal collector |
| J1.2 guard | AGND, near chamber ground | FCOM, near positive collector bias |
| Specimen | Only through SUM; insulated from stage | Grounded conductive contact |
| Local analog common | Deliberately bonded to PGND/chamber | Elevated FCOM |
| J3 data | Direct 3.3 V I²C to ESP32 | Ground-side UART through two optocouplers |
| Extra bias | None | Generated and filtered onboard |

The specimen-current board’s direct I²C is not isolated during power-off. Keep both host and detector powered while connected, using coordinated power; disconnect the interface before separately power-cycling either side. The collector uses host-powered VIO at J3.2 for its ground-side UART interface.

SUM is the amplifier input. The positive bias connects to FCOM, never directly to SUM; a direct bias wire would bypass the measurement. At steady state, unsaturated feedback holds SUM close to the amplifier's local common. The collector reading is net collected electron current, potentially a mixture of SE, BSE and background. There is no charge multiplication on a plain metal collector. An insulating specimen still needs a charging solution.

## Collector boundary

The complete analog circuit, ADS1115 and ATmega328P operate relative to FCOM. The primary side, CA converter case/return, outer enclosure, accessible cable shield, grounded specimen and scan ESP32 operate relative to chamber ground. Only the rated isolated converter, two optocouplers and deliberate filtered bias network bridge these references. No grounded USB, programming or oscilloscope cable belongs on FCOM while biased.

Mount the collector PCB on nylon / PEEK standoffs with insulating fasteners. Four 3.2 mm holes reserve a maximum 6.4 mm diameter insulating washer envelope. A grounded screw head is not an electrically neutral hole: maintain separation from grounded metal above and below the floating copper.

The PCB design enforces a 5 mm copper separation between primary and FCOM regions and a separate 2 mm rule between grounded-side HV and low-voltage conductors. These are layout rules, not certification. RECOM's 250 VAC rms basic working insulation is the relevant published working specification; 6.4 kV is a brief test rating. Converter and optocoupler capacitance still carries displacement current. Rail filters cannot remove every path for common-mode pickup.

## Collector startup and shutdown

1. Verify component orientations, cleanliness, connector numbering and the exact BOM. Assemble and inspect the input power stages before fitting the high-impedance parts where practical.
2. With the electron beam blanked and the HV module disabled, power from a current-limited regulated source. Verify 5 V bus, ±9 V raw rails, ±5 V local rails and both 3.3 V domains using their correct reference. Repeat at 12 V and 24 V and across expected loads.
3. Program the ATmega328P for an external 8 MHz crystal and 3.3 V operation with bias disabled and verified discharged. Remove all ICSP connections. Connect the grounded ESP32 via the specified UART, two control pins and active-LOW fault input. Feed collector J3.2 HOST_VIO from the ESP32’s 3.3 V rail (allow 19 mA); this removes the board-powered LED/pull-up injection path into host GPIO. Leakage and hot-plug behavior remain unverified. On the specimen-current board, J3.2 is instead a reference output and is left open.
4. Begin with the bias pot at minimum. The ESP32 first confirms the optical link. Its `b` command raises HV_ENABLE while holding PGM_RELEASE LOW for at least 100 ms, then releases the buffered RC ramp. Hardware also uses a TPS3808G50 to qualify the actual module 5 V rail, with a datasheet delay of 180–420 ms before allowing PGM_RELEASE to release the clamp. The buffer remains powered from the unswitched 5 V bus. A 10 kΩ / 47 µF command filter gives about 0.47–0.59 s nominal ramp time; effective capacitance and leakage must be checked. The sketch keeps the beam blanked for a 10 s initial settling policy and checks the optical link during that interval. That delay is a starting policy, not a guarantee of pA settling. Measure the actual bias rise, overshoot and settling before deciding the interval is adequate.
5. With bias steady and beam blanked, use `z` to measure a new zero. Only then use `s` for a scan. Repeat zero after any bias adjustment. The acquisition sequence requests fresh ADC conversions; CRC, request IDs, status and timeouts reject incomplete or stale replies.
6. `x` aborts, blanks the beam, clamps programming to zero and removes the CA module's 5 V input. Passive bleeders remain connected. Check voltage with a rated instrument before touching or attaching a programmer; a software OFF state is not proof of discharge.

The final 1 µF capacitor alone stores 20 mJ at 200 V. Its independent 9.98 MΩ bleeder has a 9.98 s time constant, but additional paths and unspecified module internal capacitance affect whole-assembly discharge. Measure the complete assembly, including cables and relevant faults. These software controls are not a certified beam interlock.

## Proving that readings are electrons

- Inject a known local current into SUM at zero bias and elevated bias. Establish gain, sign, offset, clipping and settling with the real cable and feedthrough.
- Log the collector dark current with pumps, heater, converters and UART operating. Repeat a raster with the beam blanked and then blocked upstream; image structure under those conditions is pickup.
- Compare repeated scans and measured incident beam current. Repeat at fixed, settled bias values. Separate bias-dependent leakage and displacement current from collection changes.
- Record raw ADC codes, zero, calibration, timing, measured bias and all faults. A clean DRC does not establish a picoampere noise floor.

The board-specific package contains the exact connector schedule, native CAD, BOM, CAD results and prototype fabrication outputs. The original externally powered Rev A and the earlier battery / fibre collector concept remain separate options on their original pages.
