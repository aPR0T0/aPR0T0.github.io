# Collector12 acquisition firmware

This directory contains the floating ATmega328P acquisition sketch and the grounded ESP32 scan-host sketch for **Collector12 B0, unbuilt**. The two UART directions cross the PCB's **onboard VO2611 optocouplers**. An external fibre pair is not fitted. The electron-gun supply and blanker power circuit are outside this PCB.

The specimen-current board uses direct local I²C and the existing `simulator/firmware/ESP32_LMC662_scan/ESP32_LMC662_scan.ino` sketch; do not use this collector UART sketch for that board.

## Verification status

`python3 detector-integrated/firmware/tests/run_tests.py` compiles the shared protocol and the actual two `.ino` source files with a desktop C++ compiler and lightweight Arduino/Wire/SPI API stubs. All three test binaries passed with `-Wall -Wextra -Wpedantic -Werror`. Coverage includes:

- CRC and packet resynchronization; wrong version, stale ID, wrong type and corrupted response rejection.
- A fresh ADS1115 conversion after discarding an interrupted old conversion; I²C errors, short reads, timeout and ADC clipping.
- Bias outputs low at startup; `b`, `z`, `s`, `x` command gates; immediate abort; response deadlines across millisecond-counter rollover.
- Idle/startup link loss and fault status removing bias and invalidating dark zero; heartbeat cadence and separation from sample exchanges, including the long startup settling interval.
- Active-low HV fault input during startup, idle and an active wait; explicit fault rearm, a 20 ms disable/reset interval, and no automatic retry when the fault signal clears.

The idle-link regression test failed against the previous host sketch and passed after the watchdog was added. These are **portable source and behavioral checks, not Arduino target builds**. Arduino preprocessing, the AVR/ESP32 cores, target linking, bootloaders/fuses, real UART/I²C timing, electrical behavior and hardware operation have **not** been verified. No Arduino target toolchain was available during this review.

From the repository root, `python3 detector-integrated/firmware/tests/electrical_contract_test.py` separately checks the source specifications in `detector-integrated/specs`. Its six tests cover selected IC/package pin maps, supply and ground references, the host interface, SUM-node membership, current limiting, and supply-qualified clamp release. They are independent of the generated pin-net audit and do not constitute PCB DRC or circuit simulation.

## Prepare the two sketches

Each Arduino sketch folder must contain the shared header. From this directory:

```sh
cp CollectorLink.h FloatingCollector/CollectorLink.h
cp CollectorLink.h ESP32_Collector_scan/CollectorLink.h
```

The exported design package supplies a copy in each sketch folder. Keep the two copies identical whenever the protocol changes. The portable tests include the shared header directly and therefore do not verify packaging or Arduino's library search behavior.

For `FloatingCollector/FloatingCollector.ino`:

- Use **ATmega328P-PU**, 3.3 V, with the fitted **external 8 MHz crystal**. Select an Arduino-compatible ATmega328P target that supports this clock, such as an appropriately configured MiniCore installation.
- The sketch requires `__AVR_ATmega328P__` and `F_CPU == 8000000UL`. It uses Wire's timeout API from Arduino AVR core 1.8.6 or an equivalent implementation.
- The selected crystal load capacitance must match C25/C26 plus board stray capacitance. “External crystal” and “external clock input” fuse modes are different.
- Verify clock-source, startup-time and clock-divider fuses against the fitted part and crystal. In particular, an unexpected divide-by-eight clock would make an 8 MHz crystal execute at 1 MHz and invalidate UART/I²C timing. A build-time `F_CPU` check cannot read or correct fuses.
- Choose the bootloader, boot-reset configuration and brownout setting consistently with the selected core, 3.3 V supply and actual programming method. No fuse-byte recipe has been validated for this board; do not copy generic Uno/16 MHz fuse values.
- Program using a 3.3 V compatible AVR ISP. Verify fuses and device signature using the actual programmer before relying on serial communication.

For `ESP32_Collector_scan/ESP32_Collector_scan.ino`:

- Use a **classic ESP32-WROOM-32 without PSRAM**, with an installed compatible Arduino-ESP32 core. The sketch rejects other target-family macros and `BOARD_HAS_PSRAM` because GPIO16/17 are used for the detector UART.
- Compile the exported sketch for the exact installed board profile. The portable C++17 check is not an ESP32 core build; no particular core version or FQBN has been target-verified here.
- The ESP32 is separately powered. Connect its regulated 3.3 V output to **J3 pin 2, HOST_VIO input**. This supplies the host-side UART LED/pull-up circuits (allow about 19 mA), so those circuits lose power with the ESP32. Never connect 5 V here. The detector does not power the ESP32.
- Confirm GPIO25 HIGH actually blanks the external electron beam and GPIO25 LOW exposes it. The sketch cannot prove that the external blanker works. Provide an appropriate hardware default for the blanker during reset or loss of host power.

## Exact Collector12 wiring

Use the connector pin numbers in the matching KiCad revision, not a rendered board's apparent left/right orientation.

| Connector / pin | Connection |
|---|---|
| J2.1, VIN | Positive regulated 9–30 V DC; nominal 12 V or 24 V |
| J2.2, PGND | DC return |
| J4.1 and J4.2, PGND | Chamber and accessible outer shield/enclosure; make the protective-earth/chassis arrangement separately as required |
| J1.1, SUM | Separate metal collector through its insulated, guarded vacuum feedthrough |
| J1.2, FCOM | Inner guard at the floating collector common; do not bond this to PGND/chamber |
| J3.1, PGND | ESP32 ground |
| J3.2, HOST_VIO | Input from the ESP32's own regulated 3.3 V output; required for the host-side UART interface |
| J3.3, HOST_TX | ESP32 GPIO17, UART TX into the board |
| J3.4, HOST_RX | ESP32 GPIO16, UART RX from the board |
| J3.5, HV_ENABLE | ESP32 GPIO32; LOW disables the CA02P-5 input supply |
| J3.6, PGM_RELEASE | ESP32 GPIO33; LOW commands the programming-input clamp stage |
| J3.7, HV_FAULT_N | ESP32 GPIO34 input; LOW reports the module input switch's overcurrent/reverse/thermal fault; board 10 kΩ pull-up to HOST_VIO |
| J3.8, PGND | Duplicate host ground / return |

The collector specimen has a conductive contact to the grounded stage. Only the separate collector connects to SUM. Bias is applied to **FCOM**, not directly to SUM. The local analog rails are approximately FCOM +5 V, FCOM −5 V and FCOM +3.3 V; their absolute voltage relative to the chamber rises with FCOM.

The ATmega's physical DIP pins are: 2 = RX from U7, 3 = TX into U6, 27 = SDA, 28 = SCL, 7 = +3V3D, 8/22 = FCOM. Local I²C is ADS1115 address 0x48. The grounded ESP32 has no I²C connection to the floating island.

The DIP numbering is corroborated by ZU4, ATMEGA328P-PU, in the [official Arduino Uno Rev3 schematic](https://content.arduino.cc/assets/UNO-TH_Rev3e_sch.pdf). This is a package-pin cross-check; the Uno's 5 V/16 MHz operating setup is not the configuration used here.

J5 is a standard AVR ISP pin arrangement: **1 MISO, 2 +3V3D, 3 SCK, 4 MOSI, 5 RESET, 6 FCOM**. Its “ISOLATED ICSP” label refers to its location on the floating island; it does not make a connected programmer isolated. Disconnect detector bias power, verify full discharge, then connect a suitable programmer. Remove the programmer and every other conductive path to grounded equipment before operating with bias. J5 pin 2 is the local target rail; do not inject a 5 V programmer supply into it.

Scan DAC connections remain outside the detector PCB: ESP32 GPIO18 SCK, GPIO23 MOSI, GPIO27 CS to the DAC80502; GPIO25 to the external blanker control. This sketch configures the DAC for a nominal 2.5 V span and centers both channels at 1.25 V. Check the scan-amplifier connections and gain separately.

HOST_VIO must come from the **same supply as the ESP32 GPIOs**, rather than an independently powered 3.3 V source. This makes the host-side LED supply and RX/TX pull-ups turn off with the ESP32 and removes the earlier board-supply injection path into an unpowered host. Physical power sequencing, output leakage and hot-plug behavior still need hardware verification; the optocoupler's output-side 5 V supply remains on the detector board.

## Commands and startup

Open the ESP32 USB serial interface at **921600 baud**. Send single-character commands; line endings are ignored. The isolated board UART runs at **38400 baud, 8N1**.

| Command | Behavior |
|---|---|
| `b` | Explicit bias enable or fault rearm. Blanks the beam and invalidates zero, holds module enable LOW and clamp active for at least 20 ms to reset the current-limit latch, then requires FAULT_N HIGH. Checks the local MCU using PING/PONG, enables the CA02P-5 input while keeping the programming command zero, waits at least 100 ms, requests clamp release, then applies a 10,000 ms settling policy with periodic link checks. The hardware supervisor also has to qualify the module supply before the clamp can release. |
| `z` | Requires the bias sequence to be ready. Keeps the beam blanked, waits for settling, then averages 32 fresh conversions to establish dark zero. |
| `s` | Starts scanning only after a successful zero at the currently enabled bias. |
| `x` | Stops scanning, blanks the beam, lowers both bias-control signals and invalidates zero. A new `b`, `z`, `s` sequence is required to resume. |

Bias is off at reset/setup. Starting a scan directly with `s` cannot bypass the zero requirement. Keep the board trimmer fixed during zeroing and acquisition; changing bias invalidates the meaning of the previous dark zero. The **10 s interval after the firmware's PGM_RELEASE request is an initial policy to measure**, not an established settling time. The TPS3808G50 qualifies the actual HV_MODULE_5 supply with a specified 180–420 ms delay in the selected CT-resistor configuration; this can hold the hardware clamp longer than the firmware's 100 ms request delay. The RC command ramp, capacitance under DC bias, leakage and real collector load still determine the measured response. Measure FCOM, startup overshoot, settling, ripple and discharge using appropriately rated equipment before relying on any image.

Each sample request launches a new ADS1115 single-shot conversion: A0−A1, ±0.256 V PGA range, 128 samples/s. An unfinished previous conversion is completed and discarded before the next starts. The local MCU reports I²C failure, ADC timeout or clipping instead of reporting a successful sample.

While the host is idle with bias ready, and during the startup settling sequence, a PING is sent after **500 ms without a successful exchange**. A current transaction has a **100 ms reply deadline**. A missing/invalid response or nonzero status follows the same error path as an acquisition fault: beam blank, bias off and dark-zero validity cleared. Probes run sequentially in idle/startup and are not interleaved with a sample or zero-calibration exchange. Loss of the link during the 10 s startup policy therefore does not wait for that whole interval to expire. These are software intervals; target timing still needs verification.

The host program cannot detect its own CPU hanging, an output transistor failing, a stuck control wire, an ineffective blanker or residual high voltage. It is not a hardware interlock. Q202 clamps the buffer input, and U21 stays powered from unswitched BUCK5 when the module supply is removed. The series Q203/Q204 clamp-release path requires both PGM_RELEASE HIGH and the TPS3808G50 module-supply qualifier released; a LOW control or an unqualified module supply maintains the zero-command state. Firmware lowers PGM_RELEASE before lowering HV_ENABLE. Normally connected bleeders provide passive discharge, but `x`, a LOW GPIO or an extinguished LED is not proof of zero voltage. Full board and external-wiring discharge must be measured.

The TPS2553DBVR-1 module input switch reports **FAULT_N LOW** through J3.7. GPIO34 is configured as `INPUT`; it has no usable internal pull-up, so the PCB's external pull-up and HOST_VIO connection are required. Firmware samples it only after configuring the input, then checks it in command handling, responsive waits, transactions and the idle loop. LOW blanks the beam, removes bias and invalidates zero. The fault remains latched in software until an explicit `b`; clearing the wire or cooling the device does not automatically retry a scan.

The switch datasheet specifies a 5–10 ms overcurrent fault deglitch and a 2–6 ms reverse-voltage fault deglitch; thermal fault indication is immediate. A 20 ms enable-LOW/clamp-active interval is an engineering reset allowance, not a manufacturer-specified minimum reset pulse. During that explicit reset the firmware permits FAULT deassertion to settle while bias stays off; it refuses to enable if FAULT_N remains LOW afterward. Correct the fault cause before rearming. The subsequent 100 ms zero-command hold belongs to the CA02P-5 startup requirement and is retained.

## Packet formats

The isolated UART packet is 14 bytes. Both sketches must use the same `CollectorLink.h`:

| Bytes | Meaning |
|---|---|
| 0–1 | `A5 5A` synchronization |
| 2 | Protocol version `1` |
| 3 | Type: REQUEST=1, REPLY=2, PING=3, PONG=4 |
| 4–7 | Request/pixel ID, unsigned 32-bit, little endian |
| 8–9 | Signed 16-bit raw ADC code, little endian; zero for commands/PONG |
| 10 | Status: OK=0, I²C error=1, ADC timeout=2, clipped=4 |
| 11 | Reserved zero |
| 12–13 | CRC-16/CCITT-FALSE over bytes 0–11, polynomial `0x1021`, initial `0xFFFF`, low CRC byte first |

The host accepts a reply only when its ID and expected type match the current transaction and status is OK. Old IDs cannot satisfy a new request. PING checks protocol liveness; it does not test analog conversion quality.

The ESP32 USB output retains the separate `CUR1` scan stream: four little-endian uint32 values (magic `0x31525543`, frame number, first sample index, sample count), followed by that many signed int32 Q8 dark-corrected ADC counts. `INT32_MIN` is a blank sample marker. Other negative values are valid measurements. Human-readable status lines begin with `#`; the receiving application must distinguish them from binary records. No GUI/transport integration test has been performed here.
