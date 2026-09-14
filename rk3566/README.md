# RK3566 circuit analysis on GitHub Pages

Open `/rk3566/` to explore the exported PCB analysis, all retained simulation runs, 2D/3D placement, waveform playback, field probes, model studies, and evidence downloads.

This is a saved analysis snapshot. The publication banner shows its export time; all source/model freshness checks refer to that export. Recorded operating conditions are read-only. Use **View saved runs** to inspect another iteration. Playback, case selection, probes, and view exports work in the browser. Computing new runs or campaigns requires the original local Python workbench.

`publication.json` maps the original read endpoints and artifact requests to local `data/` and `artifacts/` files. `publication.js` resolves only those recorded routes, caches immutable data, and rejects write requests. Selected-iteration exports retain the complete evidence bundle and replace its selected result with that iteration. No external simulation backend is required.

Serve this repository with a static HTTP server and open `/rk3566/`; opening `index.html` through `file://` cannot load browser modules and snapshot JSON reliably.
