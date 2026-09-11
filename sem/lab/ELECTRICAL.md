# Electrical visualization model

The electrical layer is a conceptual connection diagram and ideal virtual instrumentation. It does not connect to physical hardware or represent a verified gun connector pinout. Voltmeters compare two nodes in parallel; ammeters measure a series branch. Infinite voltmeter input resistance and zero ammeter burden resistance are assumed. [OpenStax, meters](https://openstax.org/books/college-physics-2e/pages/21-4-dc-voltmeters-and-ammeters)

## Active LMC662 detector connections

The current default uses an insulated conductive specimen holder inside vacuum. Its sealed signal feedthrough connects to the LMC662 U1A summing input; the electronics sit in an earthed enclosure outside vacuum. The stage and chamber remain earthed. The holder stays near zero by feedback and must not have a second ground connection that bypasses the amplifier.

| Node | Connection / nominal value |
| --- | --- |
| Specimen holder | Feedthrough → U1A pin 2 (−IN); input guard is AGND |
| U1A pin 3 (+IN) | Quiet AGND |
| U1A pin 1 (OUT) | 100 MΩ in parallel with 10 pF back to pin 2 |
| LMC662 pin 8 / pin 4 | +5 V / −5 V, decoupled locally |
| U1B pin 6 (−IN) | 40.2 kΩ from TIA output; 10 kΩ feedback from pin 7 |
| U1B pin 5 (+IN) | 1.32 V nominal, from filtered 15 kΩ / 10 kΩ divider |
| U1B pin 7 | Protection/filter → ADS1115 A0 |
| ADS1115 A1 | 1.65 V nominal reference |
| ADS1115 supply | On-board MCP1700 3.3 V rail derived from +5 V |
| J3 pin 1 | AGND → ESP32 GND |
| J3 pin 2 | REF3V3 output only, ≤20 mA; **not ESP32 power** |
| J3 pin 3 / pin 4 | SDA → GPIO21 / SCL → GPIO22, pull-ups to 3.3 V |
| J3 pin 5 | ALERT/RDY left unconnected in default harness; firmware polls I²C |
| ESP32 | Separate USB power; default GPIO27 is the scan-DAC CS |

These connector references belong to the **detector PCB**, not the earlier acceleration-controller board. The [local detector package](http://localhost:4173/detector-pcb/) and [visual wiring guide](current.html) are the full assembly references. Chip pin assignments: [TI LMC662](https://www.ti.com/lit/ds/symlink/lmc662.pdf#page=2) and [TI ADS1115](https://www.ti.com/lit/ds/symlink/ads1115.pdf).

Positive absorbed electron current obeys `Iabs = Ib − ISE − IBSE` and produces `Vtia = Iabs Rf`. U1B maps that to `A0 = 1.648358 − 0.248756 Vtia`; the differential ADC measures `A0 − 1.65 V`. The default ±0.256 V PGA / 128 SPS setting gives 7.8125 µV per code, or about 0.314 pA/code referred through 100 MΩ and the attenuator. The nominal −1.642 mV zero offset, component tolerances and actual drift require zero and gain calibration. [Current-law derivation](https://openstax.org/books/university-physics-volume-2/pages/10-3-kirchhoffs-rules), [ADC definition](https://www.ti.com/lit/ds/symlink/ads1115.pdf)

The current-mode ammeter is a **virtual inferred current**, not a physical meter inserted into the pA lead. Output voltmeters and a real high-impedance oscilloscope belong at buffered output nodes. The model's conservative ±4 V TIA limit and ADC PGA checks indicate clipping; they are not measured limits of an assembled board. No detector HV supply is added. The gun HV, floating heater and scan electronics remain separate.

The initial 5 pA RMS additional noise allowance is an **assumption**. It does not follow from the LMC662 typical input bias current and is not a promised noise floor or sensitivity. Leakage, stability, electrode charging and physical image performance need measurement. See [current-detector physics assumptions](PHYSICS.md#lmc662-specimen-current-detector-assumptions).

## Shared instrument parameters

| Parameter | Default | Meaning |
| --- | --- | --- |
| `gunGap` | 20 mm | Cathode-to-anode distance for a gap-average field |
| `anodeApertureGap` | 20 mm | Anode-to-aperture distance for a gap-average field |
| `apertureBias` | 0 V | Aperture potential relative to grounded anode |
| `heaterResistance` | 1.5 Ω | Effective hot filament resistance |
| `lensResistance` | 8 Ω | Steady-state coil resistance |

These defaults preserve legacy setups. They are teaching assumptions, not researched component specifications. The hot resistance does not change the existing thermal model; it translates the selected power into an illustrative voltage and current.

## Electrode potentials and fields

The positive axial direction follows the beam. The cathode is at `−1000 × voltage` volts; the anode is at zero. Integrating `E = −∇V` gives the axial gap average `Ēz = −ΔV/g`; the electron force `Fz = −eĒz` points opposite E. A 3 kV cathode–anode difference across 20 mm gives −150 kV/m. [OpenStax, field from potential](https://openstax.org/books/university-physics-volume-2/pages/7-4-determining-field-from-potential)

Anode and aperture at the same ground potential have zero *mean* gap field. This does not prove zero local field near holes or edges. The rim illustration is qualitative; local fields are not solved. Changing aperture diameter affects beam clipping but does not manufacture a uniform accelerating field. Aperture bias is an exploratory field overlay and does not yet recompute electron energy, focusing or transmission. Conductors are equipotential, and static field lines meet their surfaces normally. [OpenStax, conductors](https://openstax.org/books/university-physics-volume-2/pages/7-5-equipotential-surfaces-and-conductors)

Live scan fields use the same gap-gradient relation independently for X and Y. The scan program supplies normalized coordinates; amplitude scales both, and the alignment offset applies to X. Both voltmeters report opposed-plate differences, not DAC outputs or absolute plate potentials. Their readings remain defined while the beam is blanked. An explicit zero acceleration input is honored by the electrical overlay as zero gun field and no extracted beam, although the separate optics model requires positive beam energy.

## Electrical and beam currents

`P = VI = I²R = V²/R` yields heater current/voltage and coil dissipation. The heater differential voltage is centered on the cathode potential as an explicit midpoint convention. Floating source supplies are a real topology, but this schematic does not identify the user's heater terminals. [OpenStax, electrical power](https://openstax.org/books/university-physics-volume-2/pages/9-5-electrical-energy-and-power), [Kimball Physics, floating source/grid supply example](https://www.kimballphysics.com/wp-content/uploads/2022/11/FRA-2X1-2_EGPS-1011_current-2.pdf)

The electron-stream budget partitions extracted current into aperture interception, modeled gas loss, downstream blanker interception and specimen arrival. Aperture closure and scan blanking leave upstream emission distinct. Specimen arrival is incident beam current; a real specimen's net current also depends on its emitted electrons. HV supply current is unknown because external loads have not been modeled. Charge conservation supports the budget, not the assumed beam-transmission factors. [OpenStax, Kirchhoff's rules](https://openstax.org/books/university-physics-volume-2/pages/10-3-kirchhoffs-rules)

**Legacy ET mode only:** PMT anode signal current is output photoelectron charge per dwell, including gain. It is separate from the dynode divider and other HV loads; the PMT bias current remains unknown. [Hamamatsu, PMT handbook §5.1.3](https://www.hamamatsu.com/resources/pdf/etd/PMT_handbook_v4E.pdf#page=88)

The optional UM6N4 reference monitor uses +4.64 V at 6 kV full scale, matching Spellman's standard V Mon. It returns no value above the reference rating, is independent of HV polarity, and is not the legacy signed E Out monitor. This calibration only applies while using the specified reference; changing the BOM supply does not validate it for another module. [Spellman, UM datasheet pp. 2–3](https://www.spellmanhv.com/-/media/en/Products/UM.pdf#page=3)

## Preserved detector alternatives

The S11141-10 BSE and ET/PMT diagrams remain selectable. Their separate [BSE connection proposal](BSE_CONNECTIONS.md) and [ET build guide](DETECTOR_BUILD.md) describe their own supply, sensor and ADC conventions. They do not describe the new LMC662 board.

## Verification

`node --test simulator/electrical.test.mjs` checks field/force signs, zero-HV behavior, gap scaling, grounded and biased aperture behavior, power conservation, floating differential voltage, aperture closure, scan blanking, charge accounting, unknown supply loads, bounded monitor conversion and live X/Y formula updates.
