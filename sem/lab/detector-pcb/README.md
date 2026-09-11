# LMC662 specimen-current detector — revision A0

**This is a new, unbuilt engineering prototype.** The native schematic and routed PCB pass the included electrical-geometry checks. No fabricated board, measured noise floor, measured settling time, or demonstrated butterfly-wing resolution is claimed. This board measures net specimen current; it does not collect secondary electrons like an Everhart–Thornley detector.

The board uses a **LMC662AIMX/NOPB**, 100 MΩ feedback, 10 pF C0G compensation, an inverting attenuator, and an **ADS1115IDGSR**. It needs clean **+5 V / 0 V / −5 V**, with the 3.3 V ADC supply generated onboard. It needs no detector high voltage. The SEM gun's existing 3–5 kV supply remains a separate subsystem.

- [Schematic PDF](exports/schematic.pdf) · [Zoomable schematic](exports/schematic.svg)
- [Top board view](exports/board-top.png) · [Assembly drawing](exports/assembly.svg)
- [Editable BOM](bom.csv) · [Budget allowances](budget.csv)
- [KiCad project](kicad/lmc662_specimen_detector.kicad_pro) · [Fabrication package](fabrication.zip)
- [Check results](verification/check-summary.json) · [Clean battery power](POWER.md)

## Circuit and signal convention

`I_abs > 0` means net electron deposition on the specimen. Conventional current entering the summing node has the opposite sign. With a conductive specimen and a functioning feedback loop, the holder is held near chamber ground even though its mounting is electrically insulated.

1. **U1A:** pin 3 = AGND; pin 2 = specimen / SUM; pin 1 = TIA. R1 = 100 MΩ and C1 = 10 pF are in parallel from pin 1 to pin 2.
2. **U1B:** pin 5 = filtered 1.32 V; R2 = 40.2 kΩ from TIA to pin 6; R3 = 10.0 kΩ from pin 7 to pin 6. Its output is attenuated and shifted inside the ADC's 0–3.3 V input window under normal regulated-rail operation.
3. **ADC:** AIN0 reads the protected U1B output; AIN1 reads filtered 1.65 V. AIN2/AIN3 and ADDR are grounded. Read differential AIN0−AIN1 at I²C address `0x48`.

Using an ideal op amp and nominal resistor values:

```
V_TIA = +I_abs × R1
alpha = R3 / R2 = 10 / 40.2 = 0.2487562189
V_BIAS = 3.3 × 10 / (15 + 10) = 1.32 V
V_AIN0 = (1 + alpha) × V_BIAS − alpha × V_TIA
       = 1.648358209 − 0.2487562189 × V_TIA
V_diff = V_AIN0 − V_AIN1
       = −0.001641791 − alpha × I_abs × 100 MΩ
I_abs = −(V_diff − measured_dark_zero) / measured_transimpedance
```

The inverting-stage expression follows by equating `(V_TIA−V_BIAS)/R2` and `(V_BIAS−V_out)/R3`. The nominal transimpedance to the differential ADC is 24.8756 MΩ; resistor tolerances, input loading, offsets and leakage change the measured value. **A dark zero and injected-current gain calibration are mandatory.**

At PGA ±0.256 V, one code is 7.8125 µV: **0.3141 pA per nominal code**, not a demonstrated minimum detectable current. The nominal positive-current span is approximately 10.23 nA before ADC clipping; the negative span is slightly different because the uncalibrated baseline is not exactly zero. Wider PGA ranges trade quantization for headroom. Keep TIA within a conservative ±4 V operating target until its actual swing is measured.

`R1 × C1 = 1 ms`, so the ideal feedback pole is 159.15 Hz and 5 time constants are 5 ms. These exclude amplifier dynamics, input/cable capacitance and parasitics. Longer cable, a different C1, or an actual capacitive specimen can change stability. The [TI LMC662 datasheet](https://www.ti.com/lit/ds/symlink/lmc662.pdf) describes input leakage control, guarding, and current-to-voltage applications; it does not validate this PCB's performance.

## Physical and electrical connections

**The specimen and its insulated holder are inside vacuum. The PCB, ESP32 and power supplies are outside vacuum.** Place the PCB in a conductive enclosure immediately beside a suitable vacuum electrical feedthrough. Keep the atmospheric signal wire extremely short; a PTFE-insulated lead or short low-noise coax is preferable. Ground the enclosure and cable shield at the chamber connection.

| Connector | Pin | Connection |
|---|---:|---|
| J1 | 1 | Feedthrough centre → insulated conductive specimen holder |
| J1 | 2 | Feedthrough shield / chamber ground / enclosure |
| J2 | 1 | Clean +5 V; acceptable 4.5–5.5 V |
| J2 | 2 | Supply midpoint / AGND / chamber ground |
| J2 | 3 | Clean −5 V; magnitude 4.5–5.5 V |
| J3 | 1 | ESP32 GND |
| J3 | 2 | **3.3 V reference OUTPUT**, optional logic-reference measurement only; do not connect to another supply or power an ESP32 from it |
| J3 | 3 | ESP32 GPIO21 / SDA |
| J3 | 4 | ESP32 GPIO22 / SCL |
| J3 | 5 | Optional ALERT/RDY; leave unconnected by default; do not use occupied scan-control GPIO27 |

J3 signal levels are 3.3 V. Power the ESP32 separately. SDA/SCL have onboard 4.7 kΩ pull-ups; keep the cable short and use 100 kHz I²C initially. Do not allow an independently powered controller to drive an unpowered ADC; initialize I²C after detector rails are present and release the lines before detector power-off. Check USB/chamber ground paths if connecting a computer.

A conventional 2.54 mm header fits J1, but direct-soldering a PTFE-insulated lead to the pads avoids a dirty plastic connector near the sensitive input. This improvement does not eliminate the PCB, feedthrough or specimen leakage paths. J1 pin 1 must **never** connect to the cathode, filament or acceleration supply. The board has no protection or insulation rating for a beam-column arc.

The holder must be insulated from the chamber with vacuum-compatible insulation, while the specimen's conductive coating/contact connects only to J1 pin 1. A second metal contact to the grounded stage bypasses the measurement. An uncoated insulating wing can charge and will not provide reliable absorbed-current contrast. This detector choice does not by itself establish 100 nm surface resolution.

## Assembly

The board is 88 × 60 mm, two layers, 1.6 mm FR-4, 35 µm copper, with four 3.2 mm unplated mounting holes. Minimum track/clearance is 0.18 mm; vias are 0.60/0.30 mm. Ground pours are kept away from the input region. The short SUM trace has exposed grounded guard copper on both faces, and no SUM via. The guard is at chamber 0 V because the non-inverting TIA input is at 0 V.

1. Confirm ordered packages against the BOM before assembly: **SOIC-8 LMC662**, **TSSOP-10 ADS1115**, **TO-92 MCP1700**, SOT-23 BAT54S. A DIP LMC662 or breakout module does not fit these IC footprints.
2. Fit small passive components and ICs first. Use fine soldering tools for the ADC's 0.5 mm lead pitch. Fit the axial 100 MΩ resistor and 10 pF capacitor last.
3. R1 uses an axial 6 × 2.5 mm part, bent to 7.62 mm lead pitch; the selected Stackpole HVA05FA100M fits that envelope. C1 must be C0G/NP0, 10 pF, with a body no larger than the 3 mm footprint and 2.5 mm lead pitch; verify the actual supplier's geometry. Avoid X7R for C1.
4. C11 positive goes to +5 V. **C12 positive goes to AGND**, and its negative goes to −5 V. Fit U1 and U2 with pin 1 aligned to the package mark.
5. Thoroughly remove flux residues and dry the board. Do not touch SUM, R1 or the guard with fingers afterwards. No solderless breadboard, ordinary input clamp diode, or IC socket belongs on SUM.
6. Mount the board on insulating standoffs in the grounded enclosure. Keep switching regulators, ESP32 antenna, scan-driver wiring and pump wiring away from the front end. The physical feedthrough and specimen insulation require their own vacuum and leakage checks.

## Commissioning and calibration

Start with no connection to the electron microscope. Use a current-limited regulated supply, or the isolated battery arrangement in [POWER.md](POWER.md).

1. With power off, inspect polarity, pin 1 orientation, shorts and resistance from each rail to AGND. Do not infer input leakage from a handheld continuity meter.
2. Apply both regulated rails; verify J2 +5/−5 and J3 pin 2 near +3.3 V. Allow at least 0.2 s for reference settling before reading. Check TP1 = TIA, TP2 = ADC_DRIVE, TP3 ≈ 1.65 V and TP4 = AGND. Probe low-impedance outputs only.
3. With a clean, shielded, disconnected input, record the dark baseline and its drift. Then repeat with the real feedthrough and specimen cable attached and the beam blanked. These are different leakage environments.
4. Configure ADS1115 AIN0−AIN1, PGA ±0.256 V and 128 SPS. If it clips, select a wider range to diagnose before treating data as an image. For each pixel, move/settle the scan, wait at least the chosen analog settling interval, then start a **fresh single-shot conversion** and wait for completion. At 128 SPS, a conversion is nominally 7.8125 ms; 5 ms settling plus one conversion is already about 12.8 ms, excluding communication overhead. The supplied firmware defines `SETTLE_US = 5000` followed by `DWELL_US = 10000` as an acquisition window: 15 ms per pixel before additional overhead. A 10 ms total dwell would not satisfy that schedule.
5. For a first electrical gain check, use a separate measured 100 MΩ calibration resistor from a quiet measured source to J1 pin 1. Apply +0.5 V and −0.5 V through that resistor only. These represent nominal conventional currents of ±5 nA, or `I_abs` of ∓5 nA. Measuring the difference between these two points helps reject constant offsets. Account for calibration-resistor tolerance. Never apply the source directly to SUM; remove the calibration connection afterwards.
6. Check linearity at smaller signals, both polarities, and wider PGA ranges. Record noise with no input, with cable/feedthrough, with pumps running, and with scan/ESP32 activity. A calibrated code-to-current factor is not a noise or spatial-resolution measurement.
7. Check a small injected-current step at TP1 with the actual input capacitance. Look for ringing/oscillation and measure settling. Increase C1 if needed, then update settling time and re-test. Do not reduce it simply to make scanning appear faster.
8. Only after electrical checks, connect the insulated holder, establish the required vacuum, and test a robust conductive sample before a coated wing. Establish beam current and beam spot independently. Save acquisition settings, dark zero and gain with each image.

TI's [ADS1115 datasheet](https://www.ti.com/lit/ds/symlink/ads1115.pdf) defines its conversion timing, differential PGA ranges, input limitations and I²C configuration. A differential measurement does **not** permit either input to go below ground. The output attenuator and downstream clamp in this design address that issue; there is no clamp on the picoampere input.

## Cost and sourcing

The three main indexed component prices observed on 11 September 2026 were approximately ₹213 for the SOIC LMC662 A grade, ₹484 for ADS1115IDGSR and ₹60 for HVA05FA100M. These are sourcing references, not delivered quotations. Shipping, GST, minimum quantities and availability must be checked at order time.

- [LMC662 A-grade SOIC listing](https://www.digikey.in/en/products/filter/linear/amplifiers/instrumentation-op-amps-buffer-amps/687?s=N4IgjCBcoLQCxVAYygMwIYBsDOBTANCAG4B2aWehA9lANogAcA7EwEwAMIAuoQA4AuUECAC%2BYoA)
- [ADS1115IDGSR listing](https://www.mouser.in/en/ProductDetail/Texas-Instruments/ADS1115IDGSR?qs=IK5e5L0zOXjKCJoVMhYO%2FQ%3D%3D)
- [Stackpole HVA05FA100M listing](https://www.digikey.com/en/products/detail/stackpole-electronics-inc/HVA05FA100M/6195869)

The [budget](budget.csv) allocates ₹6,600 for detector electronics, board fabrication/assembly, clean battery power, enclosure, wiring, delivery/tax and contingency. This is a planning allowance, not a vendor quote. **It assumes the ESP32 and a suitable vacuum feedthrough already exist; coating, the vacuum system, beam column and test equipment are excluded.** A new qualified feedthrough or coating service can consume the remaining budget. Check those before ordering.

## Reproduce or edit

Open `kicad/lmc662_specimen_detector.kicad_pro` in KiCad 10. Project-local symbol and footprint libraries are included. Native files are editable without running the generator. Stock 3D bodies come from the installed KiCad 10 model library and are visual approximations.

To regenerate deliberately (this overwrites native design files):

```sh
/usr/bin/python3 tools/generate.py
/usr/bin/python3 tools/route_board.py --preserve-seed
/usr/bin/python3 tools/export.py
```

Run from this directory or use absolute paths. `tools/check.py` can be run alone to check edits. It compares every native schematic pin net against the PCB and design manifest, runs unsuppressed KiCad ERC/DRC with schematic parity, and checks independent pin maps and arithmetic. `tools/export.py` verifies first, then emits manufacturing files, board renders, and ZIP archives. It does not order or fabricate a board. External wiring and actual performance remain bench work.
