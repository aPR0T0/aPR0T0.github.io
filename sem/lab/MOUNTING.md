# Adjustable side mount for the S11141-10

The selected design places the detector **inside the evacuated specimen chamber**, beside the scanned primary beam, and aims its exposed silicon face at the specimen. There must be an unobstructed vacuum path from the specimen to that face. The detector's central hole remains physically present but is no longer the route for the primary beam. Off-axis BSE collection is an established configuration; selecting low-angle electrons can emphasize directional topographic shading. [JEOL BSE detector arrangements](https://www.jeol.com/words/semterms/20121023.083357.php).

The detector package, holder and short internal leads remain in vacuum. In this design, the quiet bias supply, current amplifier, ADC conditioning and ESP32 remain outside. Both diode connections, A and K, cross the chamber wall through sealed electrical feedthroughs. The electrons stay inside the chamber; only electrical signals and bias cross its wall. The manufacturer specifies no detector window and illustrates electrons entering the silicon from vacuum. [Hamamatsu datasheet, pp. 1 and 3](https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/s11141-10_s11142-10_kspd1083e.pdf).

## Recorded starting geometry

| Setting | Proposed value |
|---|---:|
| Detector centre, lateral offset from beam axis | +16 mm |
| Detector centre height above specimen plane | 14 mm |
| Face tilt from horizontal, normal toward specimen | 48.8° |
| Active face | 10 × 10 mm, central Ø2 mm hole |
| Package envelope used for clearance | 25 × 11 × 1 mm |
| Extra mounting allowance | 2 mm around package envelope |
| Extra beam radius and alignment allowance | 0.25 mm |
| Bias | A at −5 V; K held near signal 0 V by TIA |
| TIA / pixel dwell in the saved run | 10 MΩ ∥ 5 pF / 680 µs |

Offset and height refer to the **detector centre**, not its nearest edge. Tilt 0° means a horizontal face looking down. Positive tilt turns its sensitive normal toward −X and downward. The aim button points the normal toward the current scan centre, including the X plate offset. The saved 48.8° starting value points approximately at the beam axis; it can be refined using that button.

The active dimensions and package outline come from the [Hamamatsu datasheet, pp. 1 and 4](https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/s11141-10_s11142-10_kspd1083e.pdf). The rectangular envelope, its orientation, bracket allowance and beam allowance are project assumptions. They do not include a verified pin harness, holder or chamber CAD model. Do not fabricate from the illustration alone; confirm the delivered outline, clearances and permitted mounting method first.

## Mechanical arrangement

Use an adjustable support with lateral translation, vertical translation and a lockable pitch joint. Support the ceramic package without loading the exposed silicon, hole edge or leads. Use materials and hardware compatible with the selected vacuum process and the detector manufacturer's mounting/cleaning limits. Keep the holder and cable behind the active face, with strain relief so adjustment cannot pull on the detector leads. Provide a deliberate protective-earth connection for exposed conductive mounting parts; determine the signal-reference bond independently.

The complete holder and wiring must stay outside **all** primary-beam positions, including X offset, both scan axes and the intended beam envelope. Verify clearance through the full range of scan settings, stage motion and detector adjustment. The proposed geometry has not been checked against a measured chamber or objective assembly.

## Clearance estimate

The simulator uses the existing ideal electrostatic scan equation to obtain the extreme beam-centre X position over the full final drift. It then checks sufficient separation in X:

`clearance = offset − [12.5 cos(tilt) + 0.5 sin(tilt)] − mount allowance − max(0, scan xmax) − beam allowance`.

This follows from projecting the assumed package box onto X and subtracting the beam envelope. It is conservative in the final drift and sufficient for that box when positive. A nonpositive result means separation has not been established; it is not a ray-traced proof of impact. The package's lowest Z point, including mounting allowance, is also checked against the specimen plane. The displayed clearance is the X separation; the status can still warn of specimen-plane overlap.

There is no chamber, lens or cable collision solver, no finite-beam interception model, and no automatic beam blanking based on these estimates. A larger scan or a smaller offset can therefore leave a warning while the teaching animation continues. In centred comparison mode, the opening is shown but clipping through it remains unmodeled.

## Collection and image behavior

For a source point s and surface patch r, `dΩ = max(0,n·(s−r)) dA / |r−s|³`, where n points out of the sensitive face. Rotate into the detector plane, integrate its rectangle analytically, and subtract the central hole by equal-area numerical quadrature. The on-axis case retains the previous exact formula. This is the projected-area definition of solid angle; the rectangular integral is documented by [Crawford, UCRL-1753](https://escholarship.org/content/qt58m1f8rr/qt58m1f8rr.pdf).

The model retains isotropic upper-hemisphere emission and adjustable BSE yield/obstruction factors. Side-mode signal readouts use the actual scan-centre offset. A cached 9 × 9 collection map varies relative image brightness across the scan; it is bilinearly interpolated during texture generation. Fewer collected electrons increase the estimated noise. Contrast display remains normalized. Actual angular emission, material response, topographic shading, structures blocking the view and the full electron-energy spectrum are not solved.

The geometry computation is cached. Changing detector tilt or position does not require per-electron integration or firmware changes.

## Electrical connections and commissioning

The existing [connection schedule](BSE_CONNECTIONS.md) applies unchanged: detector A → sealed electrical feedthrough → quiet negative bias; K → sealed electrical feedthrough → TIA inverting input; TIA → offset/filter/buffer/protection → ESP32 GPIO34. Place the external amplifier near the feedthrough, keep the sensitive current lead short and shielded, and include the actual cable and feedthrough capacitance in the amplifier compensation assessment. Select feedthroughs, internal wiring and mounting materials for the intended vacuum process. The mounting controls do not command motors or configure physical analog parts.

1. Confirm the delivered package, exposed face, A/K orientation and permitted mounting method.
2. Assemble and secure the adjustable mount; check the full beam/stage/holder/cable clearance mechanically with the beam off.
3. Bench-check amplifier gain, bias polarity, dark baseline, settling and conditioned output range using the existing electrical procedure.
4. Establish the beam using the microscope operating guide, starting with a conductive reference specimen and the saved slow raster.
5. Compare dark-subtracted signal while adjusting the mount through verified positions; lock the final position and record it in the BOM and a new snapshot.
6. Re-measure noise and settling after changes to detector cabling or geometry. Keep the earlier centred snapshots for comparison.
