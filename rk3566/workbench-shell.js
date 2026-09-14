/* Static, accessible workspace shell. Data and interactions belong to workbench.js. */
"use strict";
window.SimulationWorkbenchShell=(()=>{
  const paths={
    cube:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    front:'<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M8 8h8M8 12h5M8 16h8"/>',
    back:'<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="m9 8 6 8m0-8-6 8"/>',
    fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><path d="M8 8h8v8H8z"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 16 5-4 4 4 4-6 5 6"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    layer:'<path d="m12 3 10 5-10 5L2 8l10-5Zm-9 9 9 4.5 9-4.5M3 16l9 4.5 9-4.5"/>',
    probe:'<path d="m14 3 7 7-4 4-2-2-8 8-3-3 8-8-2-2 4-4Z"/><path d="m3 21 2-2"/>',
    pin:'<path d="m9 3 8 8-3 2-1 5-3-3-6 6m6-6-4-4 5-1 2-3"/>',
    trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    chart:'<path d="M3 3v18h18"/><path d="m5 15 4-5 4 3 3-7 5 3"/>',
    play:'<path d="m8 4 12 8-12 8V4Z"/>',
    settings:'<path d="M4 7h16M4 17h16M8 4v6m8 4v6"/>',
    tree:'<path d="M5 4v14h5M5 11h5"/><rect x="11" y="7" width="9" height="7" rx="1"/><rect x="11" y="17" width="9" height="4" rx="1"/>',
    arrow:'<path d="M6 18 18 6M7 6h11v11"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>'
  };
  const icon=name=>`<svg class="wb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.cube}</svg>`;
  function render(){return `
<section class="wb-workspace" aria-label="Interactive board result workbench">
  <header class="wb-toolbar">
    <div class="wb-workspace-name">${icon("cube")}<div><strong>RK3566 workbench</strong><span>RESULT EXPLORATION</span></div></div>
    <div class="wb-status-wrap"><span class="wb-status-dot" aria-hidden="true"></span><span id="wb-status" role="status" aria-live="polite">Loading saved result context</span></div>
    <div class="wb-toolbar-actions"><button id="wb-reset-view" type="button" class="wb-button" title="Reset camera and fit the board">${icon("fit")}<span>Reset view</span></button><button id="wb-save-view" type="button" class="wb-button wb-button-accent" title="Save the current result view as a PNG">${icon("image")}<span>Save view</span></button><button id="wb-export-probe" type="button" class="wb-button" title="Export the selected probe and provenance as JSON"><span>Export probe</span></button></div>
  </header>

  <div class="wb-layout">
    <details class="wb-rail wb-study-rail" open>
      <summary class="wb-rail-heading"><span>${icon("tree")}<strong>Study & display</strong></span><span class="wb-drawer-chevron" aria-hidden="true">⌄</span></summary>
      <div class="wb-rail-body">
        <section class="wb-control-section" aria-labelledby="wb-component-label">
          <label class="wb-label" id="wb-component-label" for="wb-search">Find a component</label>
          <div class="wb-search-wrap">${icon("search")}<input id="wb-search" type="search" placeholder="Reference or part name" autocomplete="off" spellcheck="false" aria-describedby="wb-search-hint"></div>
          <p class="wb-help" id="wb-search-hint">Search the saved board, or select a part in the viewport.</p>
          <div id="wb-search-results" class="wb-search-results" aria-live="polite"></div>
        </section>

        <section class="wb-control-section" id="wb-scenario-controls" data-wb-study-only="startup" aria-labelledby="wb-scenario-title">
          <div class="wb-section-heading"><h3 id="wb-scenario-title">Startup scenario</h3><span class="wb-tag">BEHAVIORAL</span></div>
          <p class="wb-help">Recorded inputs for the selected saved behavioral run.</p>
          <div class="wb-input-grid">
            <label class="wb-number-field" for="wb-vin"><span>Input voltage</span><span class="wb-input-unit"><input id="wb-vin" type="number" readonly aria-readonly="true" min="2" max="6" step="any" value="5" inputmode="decimal"><small>V</small></span></label>
            <label class="wb-number-field" for="wb-load"><span>Load scale</span><span class="wb-input-unit"><input id="wb-load" type="number" readonly aria-readonly="true" min="0.2" max="1.6" step="any" value="1" inputmode="decimal"><small>×</small></span></label>
            <label class="wb-number-field" for="wb-source-r"><span>Source resistance</span><span class="wb-input-unit"><input id="wb-source-r" type="number" readonly aria-readonly="true" min="0.01" max="0.5" step="any" value="0.12" inputmode="decimal"><small>Ω</small></span></label>
            <label class="wb-number-field" for="wb-soft-start"><span>Soft start</span><span class="wb-input-unit"><input id="wb-soft-start" type="number" readonly aria-readonly="true" min="1" max="20" step="any" value="1.39" inputmode="decimal"><small>ms</small></span></label>
          </div>
          <button id="wb-run" class="wb-button wb-button-primary wb-full-width" type="button">${icon("tree")}View saved runs</button>
          <div id="wb-scenario-status" class="wb-scenario-status" role="status" aria-live="polite">Choose an iteration to inspect another recorded operating point.</div>
        </section>

        <details class="wb-control-section wb-display-settings" open>
          <summary class="wb-section-heading"><span>${icon("settings")}<strong>Display settings</strong></span><span class="wb-drawer-chevron" aria-hidden="true">⌄</span></summary>
          <div class="wb-display-body">
            <div class="wb-section-heading wb-layer-heading"><h3>Board visibility</h3>${icon("layer")}</div>
            <div id="wb-layer-controls" class="wb-layer-controls"><p class="wb-help">Layers load with the native board geometry.</p></div>
            <label class="wb-label wb-range-label" for="wb-explode"><span>Layer separation</span><span id="wb-explode-value">As assembled</span></label>
            <input id="wb-explode" class="wb-range" type="range" min="0" max="5" step="0.1" value="0" aria-describedby="wb-explode-hint">
            <p id="wb-explode-hint" class="wb-help">Exploded layers are a viewing aid.</p>
            <p id="wb-display-note" class="wb-help wb-display-note" role="status">Package heights are display proxies; copper zone fills are omitted.</p>
            <div id="wb-field-controls" class="wb-field-controls" data-wb-quantity-only="magnetic" hidden>
              <label class="wb-label" for="wb-height">Height from B.Cu center</label>
              <select id="wb-height"><option value="1">1 mm outward</option><option value="2">2 mm outward</option><option value="5">5 mm outward</option></select>
              <label class="wb-label" for="wb-field-display">Field display</label>
              <select id="wb-field-display"><option value="heatmap">Field magnitude</option><option value="vectors">Direction vectors</option><option value="both" selected>Magnitude + vectors</option></select>
              <label class="wb-label wb-range-label" for="wb-opacity"><span>Field opacity</span><span id="wb-opacity-value">70%</span></label>
              <input id="wb-opacity" class="wb-range" type="range" min="0.2" max="1" step="0.05" value="0.7">
              <p class="wb-help">Conditional output-loop contribution, within its recorded model scope.</p>
            </div>
            <div id="wb-thermal-controls" class="wb-thermal-controls" data-wb-study-only="thermal" hidden>
              <label class="wb-label" for="wb-thermal-case">Thermal assumption</label>
              <select id="wb-thermal-case"><option value="">Loading saved assumptions…</option></select>
              <p class="wb-help">Saved L219 thermal parameter cases. Other component temperatures remain Unknown.</p>
            </div>
          </div>
        </details>

        <section class="wb-control-section wb-reference-tree" aria-labelledby="wb-reference-title">
          <h3 id="wb-reference-title">Evidence & sources</h3>
          <a href="#professional">${icon("tree")}<span>Professional review</span>${icon("arrow")}</a>
          <a href="#time-em">${icon("chart")}<span>Time-domain analyses</span>${icon("arrow")}</a>
          <a data-snapshot-href="/api/handoff" href="#" download="NEXT_AGENT_HANDOFF.md">${icon("download")}<span>Agent handoff</span></a>
        </section>
      </div>
    </details>

    <section class="wb-viewport-panel" aria-label="Board viewport and result selection">
      <div class="wb-viewport-toolbar">
        <div class="wb-study-select"><label for="wb-study">Study</label><select id="wb-study"><option value="startup">Board startup</option><option value="settled">U7 settled switching</option><option value="load_step">U7 load step</option><option value="duty_ramp">U7 duty ramp</option><option value="thermal">L219 temperature estimate</option></select></div>
        <div class="wb-quantity-select"><label for="wb-quantity">Result quantity</label><select id="wb-quantity"><option value="voltage">Voltage</option><option value="current">Current</option><option value="temperature">Temperature</option><option value="magnetic">Magnetic field</option><option value="placement">Placement only</option></select></div>
        <div class="wb-camera-group" role="group" aria-label="Camera orientation"><button type="button" data-wb-camera="iso" class="wb-camera-button active" aria-label="Isometric view" title="Isometric view">${icon("cube")}<span>3D</span></button><button type="button" data-wb-camera="front" class="wb-camera-button" aria-label="Front view" title="Front view">${icon("front")}<span>Front</span></button><button type="button" data-wb-camera="back" class="wb-camera-button" aria-label="Back view" title="Back view">${icon("back")}<span>Back</span></button></div>
      </div>
      <div class="wb-stage">
        <div id="wb-scene" class="wb-scene" role="img" aria-label="Interactive 3D view of the saved RK3566 PCB"></div>
        <div class="wb-view-caption"><span class="wb-caption-mark"></span><span id="wb-known-count">NATIVE BOARD GEOMETRY</span></div>
        <div id="wb-legend" class="wb-legend" aria-label="Result color scale"><strong>Result legend</strong><span>The selected quantity defines the scale.</span></div>
        <div id="wb-hover" class="wb-navigation-hint">Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Select a component</div>
      </div>
      <div class="wb-probe-strip">${icon("probe")}<div id="wb-probe" aria-live="polite">Select a component to inspect its available results.</div></div>
    </section>

    <details class="wb-rail wb-inspector-rail" open>
      <summary class="wb-rail-heading"><span>${icon("probe")}<strong>Probe inspector</strong></span><span class="wb-drawer-chevron" aria-hidden="true">⌄</span></summary>
      <div class="wb-inspector-body">
        <div id="wb-inspector"><div class="wb-inspector-empty">${icon("probe")}<h3>Inspect the result</h3><p>Select a part in the board or search by reference.</p><p class="wb-help">Values appear only where the saved model supports that quantity.</p></div></div>
        <div class="wb-probe-actions"><button id="wb-pin-probe" type="button" class="wb-button wb-button-primary">${icon("pin")}Pin probe to chart</button><button id="wb-clear-probes" type="button" class="wb-button" title="Clear pinned comparison probes">${icon("trash")}Clear probes</button></div>
        <div id="wb-pinned-probes" class="wb-pinned-probes" aria-live="polite"></div>
      </div>
    </details>

    <section class="wb-chart-dock" aria-label="Synchronized chart and playback timeline">
      <header class="wb-dock-heading"><div>${icon("chart")}<h3 id="wb-chart-title">Probe through time</h3><span id="wb-chart-unit" class="wb-chart-unit"></span></div><label id="wb-window-control" class="wb-window-control" for="wb-window" hidden><span>Time window</span><select id="wb-window"><option value="full">Full experiment</option><option value="event">Event detail</option><option value="cycles">Settled cycles</option></select></label></header>
      <div id="wb-chart" class="wb-chart"><div class="wb-chart-empty"><span>No waveform selected</span><p>The board, probe values and chart will follow the same saved sample.</p></div></div>
      <div class="wb-timeline">
        <button id="wb-play" type="button" class="wb-play" aria-label="Play saved simulation samples" title="Play or pause result playback">${icon("play")}</button>
        <div class="wb-time-readout"><span>SELECTED SAMPLE</span><strong id="wb-time-value">— <small id="wb-time-unit"></small></strong></div>
        <div class="wb-time-track"><input id="wb-time" class="wb-range" type="range" min="0" max="0" step="1" value="0" aria-label="Saved simulation sample"><div><span id="wb-time-start">Start</span><span id="wb-time-end">End</span></div></div>
        <label class="wb-speed-control" for="wb-speed"><span>Playback</span><select id="wb-speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
      </div>
    </section>
  </div>

  <footer class="wb-scope-bar">${icon("info")}<div id="wb-scope" role="status">Result exploration uses saved analyses and explicit assumptions. Unsupported component quantities remain Unknown.</div><a href="#professional">Evidence review ${icon("arrow")}</a></footer>
  <dialog id="wb-export-dialog" class="wb-export-dialog" aria-labelledby="wb-export-title"><header><h3 id="wb-export-title">Export preview</h3><button id="wb-export-close" type="button" class="wb-button">Close preview</button></header><p id="wb-export-description"></p><img id="wb-export-image" alt="Exported board view with source and model scope" hidden><pre id="wb-export-json" hidden></pre><a id="wb-export-download" class="wb-button wb-button-primary" download>Download file</a></dialog>
</section>`;}
  return {render};
})();
