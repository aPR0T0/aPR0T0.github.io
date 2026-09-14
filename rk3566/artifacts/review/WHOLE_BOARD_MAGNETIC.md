# Whole-board averaged magnetic contribution study

The visualization evaluates magnetic-flux density B and magnetic-field strength H over the entire saved 55 × 55 mm PCB outline. It uses the saved startup rail-current envelopes and hypothetical closed current paths anchored to native terminal XY positions. It expands source coverage beyond the local U7 study without claiming a complete electromagnetic board solution.

## Evidence and geometry

`board_magnetic.py` reads the native PCB inventory, board layout, proposed stackup and latest saved averaged simulation. A buck rail begins at its output-inductor terminal. Other rails begin at their declared source terminal. Connected active packages, connectors, oscillators and declared downstream rail sources provide load anchors. The arithmetic centroid of each package's rail terminals is calculated first, and these package centroids are then averaged to locate one virtual aggregate sink. This is a geometric construction; no equal or measured electrical current shares are assigned to individual packages or pins.

Each saved aggregate rail current passes through one closed rectangular filament: source to virtual sink, down to an assumed return plane, back under the forward path, and up to the source. Every segment is marked as assumed geometry. All forward paths lie in a hypothetical z=0 plane at the B.Cu center, including paths whose anchors originate on front-side components. Actual trace routes, layers, pours, vias and package interiors are not represented.

Positive z points outside the back of the board. Whole-board planes are sampled 1, 2 and 5 mm above this reference with 0.5 mm spacing (111 × 111 points). The adjacent return offset is calculated from the proposed last dielectric and copper layers (0.1015 mm). Six named probes also retain coefficients for a 1 mm return-depth hypothesis. These are sensitivity comparisons, not alternative solved ground-current distributions.

The saved board has no populated noncapacitive destination for `VCC3V3_SD`: only U2 and C234 connect to this net. Its modeled current therefore remains unlocated and is excluded from the map with an explicit coverage record. The other 29 modeled rails have supported source and load anchors. All other signal and interface currents remain unknown; an area showing a small modeled contribution is not established to have a small total field.

## Calculation and time basis

The exact finite-straight-filament Biot–Savart integral in the unchanged `time_domain.py` supplies vector coefficients in nT/A. Grid generation evaluates the same four-wire sum algebraically in local rectangle coordinates for speed; stored vectors retain eight significant decimal digits and their signs. Tests independently compare both evaluations. At any saved time, signed vectors are added:

`B(t, r) = sum_j K_j(r) I_j(t)`

Magnitude is taken after vector addition. In air, `H = B / mu0`, converting nT to tesla first. Whole-board playback uses the saved averaged `time_ms` samples and matching `<net> current` series without inventing switching frequency or phase. The independent U7 switching experiment uses microseconds and is not added to this map. RMS of a combined field must include cross terms; adding source magnitudes or root-summing individual source RMS values is not the combined vector result.

The hypotheses omit inductor winding/core leakage, switching input loops, signal/clock/RF currents, copper current sharing, eddy and displacement currents, skin/proximity effects, shielding, dielectric response and radiation. Quasistatic current-envelope plots cannot establish switching-edge radiation or EMC compliance.

## Reproduction and guards

Run `python3 -B board_magnetic.py` from this directory to rebuild `data/board-magnetic-field.json`, then `python3 -B -m unittest -v test_board_magnetic` to verify it. Generation requires current saved native inputs and the matching averaged engine version. It does not rerun or change the old averaged or U7 simulation evidence.

The artifact includes SHA-256 hashes of native source files, board inventory and layout, saved current run, stackup, averaged engine and both magnetic-model source dependencies. `current_flags(payload, root)` checks these read-only for the server. Input hashes are captured before input reads and calculations, then rechecked before writing the artifact so a concurrent input change cannot silently relabel old data. A changed dependency makes the evidence stale until regeneration.

Checks compare the finite-wire kernel with an independent symmetric-wire expression, independently integrate an arbitrary wire, verify rectangular-loop axial field, reversal cancellation, closed-path continuity and native terminal anchors, preserve exact saved current values, account for unlocated rails, and compare whole-board kernel norms at 0.5 versus 0.25 mm spacing. These are numerical and provenance checks; they do not validate the chosen spatial current hypotheses.

Primary references: [MIT Biot–Savart superposition and finite current sticks](https://web.mit.edu/6.013_book/www/chapter8/8.2.html) and [MIT conditions for quasistatic fields](https://web.mit.edu/6.013_book/www/chapter3/3.3.html).
