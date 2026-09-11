# S11141-10 detector: electrical connection proposal

The active BSE visualizer uses an S11141-10 silicon detector inside the evacuated specimen chamber and a proposed analog front end outside it. The specimen and exposed silicon face share an unobstructed vacuum path. The detector signal is generated directly in silicon. This configuration has no scintillator, photomultiplier, collector cage or separate detector kilovolt supply. The microscope's accelerating supply still powers the electron gun.

This is a functional connection schedule and a simulation model. The exact feedthrough, detector mounting, amplifier PCB, offset reference, filtering and ADC protection have not been selected or verified as an assembly. The former ET detector remains available as a separate comparison mode.

## Detector mounting

The current design uses an adjustable side mount **inside the vacuum chamber**, with the whole detector package and internal wiring clear of the scanned beam envelope. The exposed face points toward the specimen; the central hole is not used by the primary beam in this mode. The [mechanical proposal](MOUNTING.md) defines the starting geometry, mounting allowance and clearance checks. Both A and K cross the wall through sealed electrical feedthroughs; the bias supply, TIA, conditioning and ESP32 stay outside in this design. Changing placement leaves the following diode polarity and amplifier wiring unchanged. Strain-relieve the leads, place the external TIA close to its feedthrough and include the actual lead and feedthrough capacitance in its compensation assessment.

## Signal path and polarity

```text
                 VACUUM                    AIR / ANALOG FRONT END

                                     Rf in parallel with Cf
                                  ┌───────────────────────────┐
quiet −VR ── A [S11141-10] K ──────●──── −IN       OUT ────────●── conditioning
                     ↑                     OPA140                       │
                  specimen              +IN │                    GPIO34 / ADC1_CH6
                                            │
signal 0 V ─────────────────────────────────┘

Conditioning: buffer/filter, +0.15 V offset, limit/protect.
ESP32 GND and conditioning reference connect separately to signal 0 V.

OPA140 power: V+ → +5VA; V− → −5VA; supply midpoint → signal 0 V.
```

**The negative bias connects to the anode A.** The cathode K connects to the TIA inverting input, which negative feedback holds near signal 0 V. Therefore `VR = VK − VA` is positive. The interactive range is 0–5 V reverse bias.

Conventional generated current leaves the summing node through K toward A. The amplifier supplies the same current through its feedback resistor, so its output rises: `VOUT ≈ +(Isignal + Idark) Rf`. This current direction is different from the moving beam electrons drawn in the microscope. The sign follows Kirchhoff's current law applied to the photodiode equivalent circuit. [Hamamatsu photodiode technical note, §2-1 and §3-1](https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/si_pd_kspd9001e.pdf)

## Connection schedule

| From | To | Purpose |
|---|---|---|
| S11141-10 **A** | Sealed electrical feedthrough → quiet adjustable `−VR`, nominal −5 V | Reverse bias the junction. Source return joins signal 0 V. |
| S11141-10 **K** | Short lead → sealed electrical feedthrough → external TIA `−IN` | Sensitive current input; keep leakage and capacitance low. |
| TIA `+IN` | Quiet signal 0 V | Establish virtual ground at K. |
| TIA `OUT` | `Rf ∥ Cf` back to `−IN` | Current-to-voltage gain and compensation. |
| TIA `V+`, `V−` | +5VA, −5VA respectively | Proposed analog supply rails; decouple locally. Matching rail names in the drawing are connected nets. |
| TIA `OUT` | High-impedance scope input and conditioning input | Inspect positive output, dark baseline and settling. |
| Scope return | Defined signal reference | Account for an earth-referenced scope when planning the reference bond. |
| Conditioning output | ESP32 GPIO34 | Proposed unity signal gain plus 0.15 V offset, filtering, buffering and protection. |
| Analog/ADC references | Deliberately joined signal 0 V | Avoid pump, heater and scan-driver return currents in the sensitive path. |
| Chamber and exposed enclosure | Separate protective-earth bond | A signal cable or ADC ground must not provide the only protective-earth connection. |

The simulation meters are ideal. The generated-current ammeter excludes dark current, while the TIA voltmeter includes its modeled offset. A physical series meter would read the total current and add burden, leakage and capacitance; it is not a required build component. Place real voltage observations at buffered outputs where possible.

The physical detector leads are labeled by **A/K function only** in the visualization. Verify their orientation against the manufacturer's delivery drawing before fabricating a harness; do not apply a generic two-pin footprint or the four-element S11142-10 connection arrangement.

## Candidate amplifier and practical limits

OPA140 is a candidate, not a validated front end for this detector. Its allowed dual supplies include ±5 V. If selecting **OPA140AID, eight-pin SOIC (D)**, the verified mapping is: pin 2 `−IN`, pin 3 `+IN`, pin 4 `V−`, pin 6 `OUT`, pin 7 `V+`; pins 1, 5 and 8 are NC. Other package variants have different mappings. Check the top-view orientation and exact purchased suffix. [TI OPA140 datasheet, Table 5-1 and operating conditions](https://www.ti.com/lit/gpn/opa140)

The model starts at **Rf = 10 MΩ, Cf = 5 pF**. These are project assumptions. For an ideal amplifier:

- `τ = Rf Cf = 50 µs`.
- `f−3dB = 1/(2πτ) ≈ 3.18 kHz`.
- `t1% = ln(100)τ ≈ 230 µs`.

The feedback impedance is `Rf/(1+sRfCf)`; solving its exponential step error gives these estimates. Detector and cable capacitance interact with the real op-amp response, so validate phase margin and settling. Merely choosing these two components does not prove stability. [Hamamatsu, feedback and gain-peaking discussion](https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/si_pd_kspd9001e.pdf#page=9)

At 5 V reverse bias, the detector datasheet lists 450 pF typical capacitance and 5 nA typical / 60 nA maximum dark current. Its 1–30 keV characterization refers to incident electrons. The 2.5 MHz figure is an optical test into 50 Ω, not this TIA's pixel rate. The detector is windowless; its temperature limits and mounting need to be respected. [S11141-10 datasheet](https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/s11141-10_s11142-10_kspd1083e.pdf)

## ADC interface and first measurements

The existing firmware's **0.15–3.1 V** target is a project configuration. The simulator represents an ideal `VADC,in = VOUT + 0.15 V`, followed by clipping at the selected ceiling. It does not create the offset source or protect physical hardware. The conditioner must implement a quiet offset reference, suitable drive impedance, anti-alias filtering and protection against amplifier overload and power sequencing. A raw ±5 V amplifier output is not ready to connect to GPIO34. ADC readings require calibration; changing a web parameter does not reconfigure physical attenuation or protection. [Espressif ADC calibration](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/adc/adc_calibration.html)

Bring up the analog stage with the beam blanked and the ADC disconnected. Check the power rails and polarity, measure the dark baseline, then use a controlled small test signal to measure gain and settling. Verify the conditioned voltage under zero signal, normal signal, overload and power sequencing before connecting the ESP32. Calibrate the ADC transfer, then select a pixel dwell from the measured settling and noise. Use the existing beam and vacuum procedure for imaging; record the detector settings and a dark frame with each setup.

The web image is an estimated BSE image. Collection geometry, specimen yield, energy distribution, amplifier and detector noise, and response time have explicit approximations in the live formula cards. Software checks and screenshot reviews do not establish hardware performance.
