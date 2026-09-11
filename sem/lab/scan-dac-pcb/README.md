# DAC80502 scan module — A0 engineering prototype

This 60 × 45 mm, two-layer board generates the low-voltage X/Y commands for the microscope's external scan amplifiers. It replaces the MCP4922 scan DAC. The existing LMC662 detector PCB is a separate, unchanged assembly.

**Unbuilt and unmeasured.** CAD checks validate connectivity and spacing; they do not establish 16-bit effective accuracy, settling, noise, or image resolution. The board does not contain the scan-plate amplifiers, their power supplies, the ESP32, or an independent beam interlock.

## Circuit

U1 is DAC80502DRXT, powered by a clean 3.3 V supply shared with the ESP32 logic domain. Its internal 2.5 V reference drives both DACs. RN1 (ACASA1002S1002P100) forms a matched divider: its two upper 10 kΩ elements are paralleled, as are the two lower elements, making 5 kΩ/5 kΩ. C4 filters the midpoint; U2 (OPA333DBVR) buffers it. The exported nominal center is 1.25 V. [TI DAC datasheet, sections 6, 8.3, 8.6 and 9.5](https://www.ti.com/lit/ds/symlink/dac80502.pdf); [Vishay ACAS0612 dimensions and grade-S matching specifications](https://www.vishay.com/docs/28959/acas0612.pdf); [TI OPA333 pin map and operating conditions](https://www.ti.com/lit/ds/symlink/opa333.pdf).

DAC pin map: 1 VDD; 2 X/VOUTA; 3 RSTSEL → ground; 4 AGND; 5 SPI2C → ground; 6 SCLK; 7 SYNC; 8 SDIN; 9 Y/VOUTB; 10 VREFIO. **The DRX package has no central thermal pad.** Use the provided exact DRX footprint, not a generic WSON-10 with an exposed pad.

OPA333DBV pins: 1 output; 2 ground; 3 divider input; 4 inverting input joined to output; 5 +3.3 V. Do not substitute the differently pinned SC70 version.

RN1 pins 1 and 4 connect to VREFIO; 2, 3, 5 and 8 connect to DIV_1V25; 6 and 7 connect to ground. It is an eight-terminal convex0612 array with no center pad; its four resistors connect across opposite pairs1–8,2–7,3–6,4–5. The0.05% matching and15ppm/°C tracking specifications do not guarantee a one-DAC-code center error. Measure center offset under load after warmup; temperature drift also needs characterization.

C1 is 100 nF at U1's supply, C2 is 4.7 µF bulk, and C3 is 1 µF at VREFIO. Choose a C3 whose **effective** capacitance at 2.5 V exceeds 150 nF. C4 = 1 µF gives a nominal 2.5 ms divider filter time constant; C5 bypasses the buffer.

R7–R9 isolate the three analog outputs by 49.9 Ω. Prefer external amplifier inputs ≥1 MΩ and short paired signal/return wiring. Shared-center loading, input bias currents and cable capacitance must be included in bench calibration. The OPA333 feedback senses the buffer output before R9; it does not compensate the cable or load drop.

## Electrical connections

J1 is a six-pin 2.54 mm header. Pin 1 is identified by the square pad and assembly drawing.

| J1 pin | Connect to |
|---|---|
| 1 | Clean +3.3 V input, with sufficient current for module and output loads |
| 2 | ESP32 / analog system ground |
| 3 | ESP32 GPIO18 — SCLK |
| 4 | ESP32 GPIO23 — MOSI / SDIN |
| 5 | ESP32 GPIO27 — chip select / SYNC |
| 6 | ESP32 GPIO25 — active-high BLANK |

Use a common 3.3 V power domain; do not power the module from the LMC662 board's reference output. R1–R3 are 1 kΩ series resistors at the module interface, not a substitute for correct power sequencing. Do not drive SPI into an unpowered module. Start with SPI mode 1, MSB-first, 1 MHz and short leads. GPIO26 has no connection; simultaneous DAC updates use a software command.

| J2 pin | Signal to external scan-amplifier input |
|---|---|
| 1 | X_OUT, nominal 0…2.5 V |
| 2 | Ground / X return |
| 3 | Y_OUT, nominal 0…2.5 V |
| 4 | Ground / Y return |
| 5 | CENTER_OUT, nominal 1.25 V |
| 6 | Ground / center return |

J3 pin 1 exports BLANK to the external blanking interface; pin 2 is ground. BLANK is logic only, not an electrode driver. The local 10 kΩ pull-up holds BLANK high while 3.3 V is present. The **external** interlock must independently default to blank when the ESP32/module is unpowered, disconnected, resetting or faulty.

The assumed external transfer is `Vplate = 100 × (Vdac − Vcenter)`. That gain is a model and firmware setting that must match the real differential scan amplifier. These connectors cannot directly drive scanning plates. A previous amplifier centered at 1.65 V must have its reference changed to the provided 1.25 V center and be recalibrated. Confirm whether the existing amplifier commands differential plate voltage or one plate; use the corresponding physical gain.

## Firmware agreement

Use the project's updated ESP32 DAC80502 scan firmware. The required initial register sequence is:

| Step | Register | Value / behavior |
|---|---|---|
| Hardware reset/power-up | RSTSEL tied low | Codes start at zero; beam remains blank |
| Optional software reset | TRIGGER `0x05` | `0x000A`; then wait at least 250 µs before further writes |
| Divide reference, gain two on both channels | GAIN `0x04` | `0x0103` |
| Enable internal reference and channels | CONFIG `0x03` | `0x0000` |
| Enable synchronous update on both channels | SYNC `0x02` | `0x0003` |
| Center X and Y buffers | DACA `0x08`, DACB `0x09` | `0x8000` each |
| Commit both together | TRIGGER `0x05` | `0x0010` |
| Stabilize | Remain blanked | Allow 100 ms after initialization, then verify before enabling scan |

Every X/Y move loads both buffer registers and then writes one LDAC trigger. Register addresses plus their 16-bit payload form 24-bit SPI frames. At 3.3 V, incorrect reference-divider configuration disables the outputs. RSTSEL is not a guarantee of centered beam position before initialization.

The ideal conversion is `Vout = 2.5 × code / 65536`, for code 0…65535. Nominal midscale is 1.25 V and the maximum code is 2.49996185 V. One code is 38.147 µV, or 3.8147 mV after a nominal gain of100. These are arithmetic values before gain/offset/noise/loading errors. Tiny code increments are not proof of comparable spatial resolution.

## Low-voltage bench commissioning

1. Inspect WSON orientation, solder bridges and all eight RN1 terminations. Check for shorts between +3.3 V and ground before power. Leave scan amplifiers and gun power disconnected.
2. Apply current-limited 3.3 V. Verify supply polarity, BLANK high, SYNC high, and VREFIO near 2.5 V. Do not use a low-impedance load on the reference.
3. Initialize and hold both DACs at `0x8000`, blanked. Wait100 ms. Measure X, Y and center near1.25 V. A DMM can check basic function; it does not by itself validate38 µV steps, DAC linearity, or transient settling.
4. Command `0x4000`, `0x8000`, `0xC000` on each axis: ideal values0.625,1.25,1.875 V. Check both independent operation and simultaneous updates with a scope. Log actual values and instrument uncertainty.
5. Test code±1 around midscale with suitable low-noise instrumentation and repeated measurements. Quantify output noise, gain/offset, drift, and settling under the intended external amplifier load.
6. With all beam power still off, attach external amplifier inputs and confirm center/gain/polarity/limits. Confirm that reset, cable removal, controller failure and loss of module power keep the independent beam blanking system asserted.
7. Only after these checks, integrate with the microscope's existing vacuum, beam and electrical commissioning procedure. Calibrate physical position on a known specimen; keep measured raster step, probe diameter and image resolution separate.

## Procurement allowance

The matched network is listed at **₹109.63 for one** in the retrieved [DigiKey India listing](https://www.digikey.in/en/products/detail/vishay/ACASA1002S1002P100/4741029), before applicable delivery/tax. This is a listed part price, not a delivered quote or a promise of inventory.

`budget.csv` uses a separate **₹2,750 module planning allowance**:₹1,500 DAC,₹150 matched network,₹300 buffer,₹150 other small parts,₹650 shared PCB/stencil/reflow. Those allowances require current quotes; they exclude delivery, taxes, enclosure, instruments, ESP32 and the external scan amplifiers. This module budget is additional to the detector assembly.

## Files and rebuild

- `kicad/dac80502_scan.kicad_pro`, `.kicad_sch`, `.kicad_pcb`: editable project, schematic and routed PCB.
- `exports/`: schematic, copper views, assembly drawing and PCB renders. U1 uses a project-authored package-outline 3D body from the TI dimensions because the installed library lacks the exact vendor solid model; manufacturing comes from the native footprint and Gerbers.
- `fabrication.zip`: generated copper/mask/silkscreen/drill files plus fabrication notes.
- `bom.csv`, `budget.csv`: procurement and planning allowance, not a supplier quote.
- `verification/check-summary.json`: independent pins, KiCad ERC/DRC/parity, arithmetic and source hashes.
- `scan-dac-design.zip`: complete editable design and exports.

Rebuild with installed KiCad10 and its Python binding:

```sh
/usr/bin/python3 scan-dac-pcb/tools/generate.py
/usr/bin/python3 scan-dac-pcb/tools/route_board.py --preserve-seed
/usr/bin/python3 scan-dac-pcb/tools/export.py
```

Regenerating replaces the module CAD; preserve any manual edits first. The router is a deterministic geometry helper. Native KiCad ERC/DRC and the independent net audit remain required.
