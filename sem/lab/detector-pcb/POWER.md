# Clean low-voltage power for the detector

J2 requires regulated +5 V, 0 V and −5 V. The board does not accept raw 9 V batteries or raw AA packs. MCP1700 has a 6 V input limit. Use two floating regulated 5 V sources in series, or the low-cost battery arrangement below. Both rails must measure 4.5–5.5 V in magnitude before connection.

## Battery option: two identical, electrically separate regulator assemblies

For **each** assembly, use one 9 V battery and clip, one **ST L7805CV in TO-220**, 0.33 µF input capacitor, 0.1 µF output capacitor, and a 820 Ω output-load resistor. Keep capacitors close to the regulator. Use a two-pole power switch that disconnects the positive terminal of each battery independently.

Facing the L7805CV's printed face, leads down, its TO-220 pins are **1 IN, 2 GND, 3 OUT**; the tab is GND. Follow the package drawing of the actual ordered part. Battery positive goes through its switch to pin 1; battery negative goes to pin 2. Fit 0.33 µF from pin 1 to pin 2 and 0.1 µF from pin 3 to pin 2. Fit 820 Ω from pin 3 to pin 2 for at least 5 mA load throughout the accepted rail range. This arrangement follows ST's [L78 application circuit and regulation conditions](https://www.st.com/resource/en/datasheet/l78.pdf).

First verify each assembly produces approximately 5 V between its own OUT and GND, without connecting them together. Replace a battery before its loaded regulator input falls below 7.5 V; never compensate by bypassing the regulator. These are offboard supply assemblies and are not part of the detector PCB Gerbers.

## Series connection

Call the assemblies **P** and **N**. They are ordinary positive regulators powered by separate batteries; assembly N becomes the negative rail by the way its output is referenced.

```
P.OUT --------------------------- J2.1  +5 V
P.GND ---------+----------------- J2.2   0 V / chamber
N.OUT ---------+
N.GND --------------------------- J2.3  -5 V
```

**Do not join the two battery negatives.** Join P.GND to N.OUT exactly as shown. Battery N's negative terminal is at −5 V relative to the chamber in this connection.

Keep the two regulator assemblies insulated from each other and the metal enclosure except at the intentional chamber midpoint. In particular, the TO-220 tabs are tied to their respective regulator GND pins: bolting both bare tabs to one conductive surface shorts this arrangement. Their dissipation is low at the detector's light load; do not use a shared uninsulated heatsink.

Budget allowance: ₹700 including two batteries, clips, regulators, capacitors, load resistors, switch and small construction boards. This is an estimate, not a delivered quote. A ready-made dual bench supply can be used instead after verifying its grounding configuration; a generic dual-output switching module is not automatically quiet enough for picoampere work.

No mains wiring or kilovolt supply is part of this detector power option. Verify output ripple and resulting dark-current noise with the completed detector before relying on it for images.
