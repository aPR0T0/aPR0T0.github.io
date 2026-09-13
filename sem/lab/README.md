# Beam Lab v4 — LMC662 specimen-current microscope

A dependency-free local teaching simulator for the tungsten-source microscope concept. The new default detector uses an **electrically isolated specimen holder → LMC662 current amplifier → ADS1115 differential ADC → ESP32**. Its electronics stay outside vacuum beside a sealed electrical feedthrough. It needs ordinary low-voltage detector supplies, **±5 V and 3.3 V**, while the electron gun retains its separate acceleration supply.

The detector is a Rev A prototype. The simulator and PCB package do not establish pA measurement accuracy or 100 nm butterfly-wing imaging. The default **5 pA RMS additional noise floor is an adjustable assumption**, not an LMC662 specification or a demonstrated sensitivity.

A separate [biased metal collector wiring proposal](collector.html) describes a grounded specimen, a positively biased collector and a floating current readout. It is an unvalidated connection guide, with [downloadable connection notes](COLLECTOR_CONNECTIONS.md). The current, silicon BSE and ET simulation modes and their presets remain unchanged; the proposal has no collector scan or resolution model.

## Run

Node.js 20 or newer is sufficient. No installation or build step is needed.

```sh
cd simulator
npm start
```

Open **http://localhost:4173**. The server binds to `127.0.0.1`; use `PORT=4174 npm start` to select another local port. Use the Node server because a static server does not provide BOM, snapshots, research or PCB-package routes. Source links open separately; the simulator loads no external fonts or analytics and never connects to an instrument.

## Public blog edition

The allowlisted Pages build runs at `/sem/lab/`, linked to the portfolio project plan and blog article. Generate it from this checkout with:

```sh
node simulator/build-static.mjs --out /path/to/portfolio/sem/lab
```

The script also accepts `--base-path`, `--blog-url` and `--plan-url`. It adds the public-edition banner and project links without changing the local page. Physics, electron/field graphics, specimen scans, firmware editing, guides and PCB downloads remain available. The biased-collector guide, calculator and connection notes are included in both the public build and local ZIP. The original v1 runtime files are copied with identical bytes to `base/`.

The web edition stores an editable private BOM copy and immutable named setups in the visitor's browser storage. The shared parameter validator and BOM presentation code enforce the same model bounds, missing-value checks and source-change flags as localhost. Editing the browser copy does not alter published CSVs, PCB packages, another visitor's data or the active run. Storage survives page reloads; clearing site data removes it, so export important setups separately. Supported browsers use Web Locks to serialize changes across tabs. A saved browser BOM is retained across later site releases instead of being silently replaced by a newer published seed.

Component research is disabled on the public site: GitHub Pages cannot run the Node server or access a Codex session. **Run locally** provides instructions and a self-contained `beam-lab-local.zip`, including the runtime, Node server, BOM CSVs, reviewed design downloads and optional research bridge. Visitors do not need access to the private source repository. Authentication is supplied only through their own locally installed Codex session.

The publisher uses explicit runtime and artifact filename lists. It never reads saved setup/research history and excludes `data/`, `previous-session.json`, `.git`, credentials, review screenshots and server modules from the web root. The source ZIP includes only the explicit local-runtime additions; it contains no personal history or credentials. `build-manifest.json` records the published files and SHA-256 checksums. Run `npm test --prefix simulator` for browser persistence, source-edit validation, path closure and local-server regression tests.

## Explore

- **Microscope:** animated primary electrons, emitted SE/BSE, grounded chamber, insulating specimen support, sealed signal feedthrough, and atmospheric LMC662/ADS1115/ESP32 readout. The specimen is the sensing electrode. No PMT or silicon detector head appears in current mode.
- **Components and fields:** select or double-click a component to inspect or zoom; drag to pan and use the wheel or buttons to zoom. Aperture opening changes are exaggerated for visibility. The lens has magnetic B fields, and the anode, aperture and scan plates have electric E overlays. Fixed RGB scales preserve comparisons; arrows show polarity. Geometry and trajectories are schematic.
- **Detector controls:** change feedback resistance/capacitance, ADC range and rate, conversions per pixel, assumed emission yields and assumed additional noise. Values represent component substitutions or acquisition configuration. Real gain, leakage, stability and ADC scaling require measurement.
- **Electrical:** inspect complete functional connections, U1A feedback, U1B conditioning, external ADC, low-voltage supplies, signal returns and virtual meters. The holder has one intended DC signal return through the TIA; a separate holder ground would bypass measurement. The chamber and stage remain earthed.
- **PCB and wiring:** [the current-detector guide](http://localhost:4173/current.html) includes a zoomable circuit, connection schedule, live calculator, hover/click derivations, commissioning sequence, and links to the actual [Rev A package](http://localhost:4173/detector-pcb/). The board uses both LMC662 amplifiers and an ADS1115; inspect its schematic and checks before fabrication.
- **Biased collector proposal:** open the separate [collector connection guide](collector.html) beside the detector selector. It explains the floating readout and isolation boundaries for a biased metal electrode while the specimen stays grounded. This option is not the grounded-reference Rev A PCB and does not add a simulated detector mode.
- **Scan program:** select four paths or edit the JavaScript trajectory. Edit and export the separate ESP32 C++ sketch with configuration hints. In current mode, acquisition uses fresh ADS1115 differential conversions over I²C, synchronized with the selected DAC80502 16-bit scan DAC (MCP4922 retained for legacy runs). Custom JavaScript must be ported to C++ `pointAt()` separately.
- **Operating guide:** follow the cold-chamber → roughing → turbo → filament → acceleration → focus → scan → detector sequence. The displayed steps are a model procedure, not hardware interlock logic.
- **Physics and sources:** equations have live substitutions, derivations, explicit assumptions and source links. Detector formulas follow the selected architecture. Hover, focus or tap for details.
- **Parts and runs:** edit mapped assemblies and source BOM rows, read updated CSV files, research uncertain named components through local Codex, and preserve independent parameter snapshots. Saving a BOM does not silently retune an active run.

## New current-detector preset

| Setting | Default | Interpretation |
| --- | --- | --- |
| Beam voltage | 3 kV | User's intended operation is mostly 3–5 kV |
| Feedback | 100 MΩ ∥ 10 pF | 100 µV per net absorbed pA; component values |
| ADC | ADS1115, A0 − A1 | External differential readout, I²C address 0x48 |
| PGA / data rate | ±0.256 V / 128 SPS | Nominal 7.8125 µV per ADC code |
| Input-referred quantization | 0.314 pA/code | Includes the 10/40.2 attenuator; not accuracy |
| Settling / acquisition window | 5 ms / 10 ms | Slow initial scan, one fresh conversion per pixel |
| Resolution | 32 × 32 | Small first frame for experimental bring-up |
| Additional noise | 5 pA RMS | Adjustable model assumption, not measured |

`Iabs = Ib(1 − δSE − ηBSE)`. Positive net absorbed electron current produces positive TIA voltage. U1B maps that bipolar output to `A0 = 1.648358 − 0.248756 Vtia`, with A1 nominally 1.65 V. The differential zero is therefore about **−1.642 mV** even before real circuit errors; zero and gain calibration are mandatory. The model bounds TIA output at ±4 V on ±5 V supplies and flags ADC clipping.

Frame timing includes the selected settling wait plus the larger of requested acquisition dwell and `samples/(0.9 × SPS)`, allowing a 10% slow ADC clock, then retrace. Software, SPI, I²C and serial overhead extend real frames. RC settling and electronic noise are approximations; increasing sample count does not earn an unverified noise-reduction claim.

The specimen must conduct to its holder. A conductive coating and sound contact are required for the intended insulating biological specimen. Leakage, charging, drift, beam stability and specimen yields can dominate the image; none is inferred from a requested feature depth. The simulated image is a generated reference pattern, not a predicted micrograph.

## Preserved BSE and ET architectures

The selector retains **Previous · silicon BSE** and **Previous · scintillator + PMT**, with their geometry, controls, electrical diagrams and references. The silicon mode keeps the adjustable in-vacuum S11141-10 side/centred mount, OPA140 circuit proposal, reverse-bias and collection model. Its [guide](bse.html), [connections](BSE_CONNECTIONS.md) and [mounting assumptions](MOUNTING.md) remain available. The earlier [ET / PMT reference](detector.html) retains its distinct scintillator and PMT supplies.

The untouched original simulator is served at `/base/`, with its SHA-256 manifest in `versions/v1/`. The simulation BOM from before the current-detector change is retained in `versions/before-current/`. Existing saved setups remain independent of later part edits. Older snapshots without a detector mode restore as ET. A saved BSE or ET setup selects that earlier architecture explicitly.

## BOM-to-simulation workflow

1. Open **Parts & runs → Instrument parts**, or a component's **Part & specs**, and edit its identity, datasheet or modeled values.
2. Hardware identities are linked to `../bom/external_system_bom.csv` and `../bom/pcb_bom.csv`; model mappings and assumptions live in `../bom/simulation_parts.csv`. The detector board BOM at `../detector-pcb/bom.csv` is also editable. Separate mapped R1/C1 entries retain their reviewed feedback values; editing a linked physical BOM row marks it for review before a new run. BOM edits do not regenerate the checked CAD or Gerbers. Do not confuse its connectors with the acceleration-controller board.
3. **Read BOM & run** reloads disk data and checks completeness, source changes, units and supported ranges. For doubtful named parts, the bridge can call the installed Codex CLI to inspect primary documentation. Findings and unresolved measurements remain visible.
4. A resolved run records that BOM revision. Unspecified hardware or missing measurements pause resolution; **Run with recorded assumptions** explicitly uses the labeled model values. **Previous setups** reuses an earlier run without resolving the new BOM.

Disk changes are checked every 15 seconds and at explicit loads. Saves detect revision conflicts and retain CSV backups in `data/history/`; saved runs live in `data/setups/`. `data/` is not publicly served. See [Codex research setup](CODEX_RESEARCH.md) for authentication, usage and limitations. Research cannot invent measurements for an unbuilt detector.

## Validation and references

```sh
npm test
```

The tests cover the optical, vacuum, detector, electrical and scan models, blanking and polarity, clipping, ADC configuration/timing, snapshot compatibility, research boundaries and BOM workflows. CAD connectivity, software tests and screenshots are distinct from measurements of the assembled detector.

- [Current detector circuit, PCB package and commissioning](current.html)
- [LMC662 screenshot review and verification](REVIEW_CURRENT.md)
- [Generated ESP32 LMC662 acquisition sketch](firmware/ESP32_LMC662_scan/ESP32_LMC662_scan.ino)
- [Physics model and source map](PHYSICS.md)
- [Electrical model and connection definitions](ELECTRICAL.md)
- [Scan algorithms, firmware and protocol](SCAN.md)
- [Preserved BSE review](REVIEW_BSE.md) and [side-mount review](REVIEW_SIDE_MOUNT.md)
- [Preserved ET detector research](DETECTOR_BUILD.md)

## DAC80502 scan upgrade

The current BOM and imaging preset select DAC80502, 16 bits and a 2.5 V output range. `scan.html` provides the connector map, an interactive comparison, and links to the separate `scan-dac-pcb/` native PCB package. The scan program dashboard reports DAC voltage increments, nominal beam-position increments, requested endpoint spacing and unique raster positions. Actual sampled coordinates are quantized; requested image pixels can therefore contain repeated samples.

The image texture is synthetic and grows from 256×256 to 512×512 with the requested raster, with a separable approximation to optical blur. More samples describe the generated pattern more finely; they do not establish physical image resolution. This revision removes the old eight-pixel blur cap at small fields. Source size, aberrations and specimen contrast remain uncalibrated.

Old snapshots without scan-hardware fields infer the MCP4922 configuration from their applied sketch; immutable snapshot files and `/base/` are preserved. New BOM runs use DAC80502. A saved edited firmware draft is retained; the editor warns when its applied constants differ from the current model.


### Specimen library

The **Specimen scan** panel offers seven deterministic synthetic patterns: the original calibration grid, butterfly wing scales, spherical particles, a porous diatom-inspired disc, metal grains, microchip traces and a fiber mesh. **Browse all 7** opens visual references; selecting one restarts acquisition with the current scan settings. **Fit sample** centers the pattern and sets its suggested physical field width within the DAC/scan range. It preserves resolution, dwell, detector choice and beam settings.

The gallery shows ideal reference patterns. The live scan applies the existing beam blur, DAC quantization, detector response, noise and acquisition timing. Dimensions describe generated geometry; intensity does not establish actual material yield, specimen charging, depth or image resolution. The specimen choice is saved as optional top-level `specimenId` in run snapshots and exported setups, separate from BOM physics parameters. Older snapshots restore the original calibration pattern.

The image uses an N × N logical output grid for every scan trajectory. A sample is painted into the nearest requested image bin using the intensity at the actual DAC-quantized beam coordinate. Unvisited bins remain empty; subsequent samples in one bin replace its value. Exact pixel-cell bounds avoid artificial seams between rows/columns. The preview texture and acquired-image buffer use max(256, N) pixels per side, through the supported N=512. Every 512×512 sample therefore has its own displayed image pixel; it is not collapsed into a 256×256 buffer. ET mode now paints one sampled intensity per acquired pixel, matching the current/BSE modes rather than copying unsampled image detail.


### Detailed butterfly scan

Choose **Start detailed butterfly scan** in the startup dialog, or **Butterfly detail → Load preset** in the specimen panel. The preset sets a 512×512 raster over 140 µm, 3 kV, a 100 µm aperture and the calculated model focus. It retains the LMC662 100 MΩ / 10 pF circuit, ADS1115 ±0.256 V range at 128 SPS, and uses two fresh conversions per pixel, 20 ms acquisition and 5 ms settling. The minimum modeled hardware frame is **6553.641 s (1 h 49 min)**, before transport overhead.

The browser starts this preset at **500× preview playback**, completing the synthetic image in about 13.1 seconds, then holds the frame for inspection or PNG download. The hardware estimate, charge/noise model and ESP32 firmware retain the full acquisition timing. Playback is a view setting and is not exported as a hardware parameter. Normal presets and restored snapshots return to 1× playback. A modified working setup is saved locally before the detail preset replaces it.

The nominal raster spacing is approximately 274 nm and the illustrative beam spot approximately 200 nm. The generated ridge pattern is clear in the simulated image; it does not prove real butterfly-wing resolution. The noise floor is retained, with no guaranteed square-root improvement credited to two-conversion averaging. Local run/research history remains under ignored `simulator/data/`; the built-in preset is portable with the repository.

The integrated-power alternatives are documented in [`power.html`](power.html) and [`INTEGRATED_DETECTORS.md`](INTEGRATED_DETECTORS.md). `detector-integrated/current12` and `collector12` accept regulated 12/24 V input for detector electronics, with onboard bias on the collector variant. They preserve the externally powered Rev A as a separate package. The new guide exposes exact connector schedules, onboard power/signal architecture, native CAD downloads and recorded checks; both designs remain unbuilt prototypes.
