/* Saved model-expansion studies. The API owns every numerical result and claim. */
"use strict";
window.ModelStudies = (() => {
  const q = selector => document.querySelector(selector);
  const arr = value => Array.isArray(value) ? value : [];
  const finite = value => typeof value === "number" && Number.isFinite(value);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const human = value => String(value ?? "").replace(/[_-]+/g, " ");
  const description = value => typeof value === "string" ? value : value && typeof value === "object" ? String(value.detail || value.note || value.description || value.label || value.title || "") : String(value ?? "");
  const COLORS = ["#52d8c8", "#8cadff", "#ffd178", "#ef97c4", "#adcb78", "#c0a3ff", "#77d4f1", "#f39d80"];
  const TIME_UNITS = new Set(["s", "ms", "us", "µs", "μs", "ns", "ps", "min", "h"]);
  let generation = 0, controller = null, statusController = null, statusTimer = null, resizeTimer = null, statusUnavailable = false, state = null, data = null;
  let studyId = null, caseId = null, compareId = "", axisKey = "", tab = "waveforms", search = "";
  let hiddenTraces = new Set(), chartState = null, cursorIndex = 0, xWindow = null, scaleChoice = "auto";
  const format = (value, digits = 6) => {
    if (!finite(value)) return "Unknown";
    const magnitude = Math.abs(value);
    if (magnitude !== 0 && (magnitude < 0.0001 || magnitude >= 1e9)) return value.toExponential(4).replace(/\.?0+e/, "e");
    return value.toLocaleString(undefined, {maximumFractionDigits: digits});
  };
  const valueText = value => {
    if (value === null || value === undefined) return "Unknown";
    if (finite(value)) return format(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(valueText).join(", ");
    if (typeof value === "object" && "value" in value) return `${valueText(value.value)}${value.unit ? ` ${value.unit}` : ""}`;
    return JSON.stringify(value);
  };
  function safeUrl(value, artifact = false) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith("/api/")) return window.RKSnapshot.url(`${url.pathname}${url.search}${url.hash}`);
      return !artifact && ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }
  function fileUrl(file) {
    return typeof file === "string" && file ? window.RKSnapshot.url(`/api/model-artifact?file=${encodeURIComponent(file)}`) : null;
  }
  function statusClass(value) {
    const text = String(value || "").toLowerCase();
    if (/fail|error|invalid|out.of.range|blocked|stale/.test(text)) return "danger";
    if (/warn|conditional|substitute|assum|partial|illustrat|mixed/.test(text)) return "conditional";
    if (/^(pass|passed|ok|complete|completed|ready|available|acquired|executed|verified)$/.test(text)) return "available";
    return "unknown";
  }
  const badge = (value, label) => `<span class="ms-badge ${statusClass(value)}">${esc(label || human(value) || "Status not supplied")}</span>`;
  function modelClass(study) {
    const type = String(study.model_type || "").toLowerCase();
    if (type === "manufacturer_exact_part_revision_comparison") return {name:"Manufacturer model comparison", kind:"mixed", detail:"Saved revisions of an official model are compared. A passing reference screen for one revision does not qualify its package, corners, power model or the complete board."};
    if (type === "manufacturer_exact_part_older_revision") return {name:"Manufacturer behavioral model (older revision)", kind:"vendor", detail:"An earlier official model revision is used with its recorded limitations; its reference checks do not establish full device or board qualification."};
    if (type === "family_proxy" || type === "manufacturer_other_part_family_proxy") return {name:"Different-part proxy", kind:"substitute", detail:"A manufacturer model for another device is used as an explicit family proxy; it is not the exact fitted component."};
    if (type === "manufacturer_exact_part_behavioral_typical_25c") return {name:"Manufacturer behavioral model", kind:"vendor", detail:"An official model names the exact part, with the model construction and stated typical conditions retained as limitations."};
    if (type === "mixed" || study.model_category === "mixed" || /vendor|manufacturer|official|ibis/.test(type) && /assum|subset|substitute|surrogate|mixed/.test(type)) return {name:"Mixed model basis", kind:"mixed", detail:"An acquired device model or subset is combined with explicitly assumed parts of the experiment."};
    if (["vendor_model", "official_model", "manufacturer_model"].includes(type)) return {name:"Manufacturer model", kind:"vendor", detail:"Acquisition and execution are recorded separately below."};
    if (/substitute|surrogate|behavior|assum|datasheet/.test(type)) return {name:"Explicit substitute", kind:"substitute", detail:"Results depend on the stated replacement model and assumptions."};
    if (/analytical|analytic|lumped|equivalent|ideal|calculation/.test(type)) return {name:"Analytical model", kind:"analytical", detail:"Results describe the declared mathematical approximation."};
    if (/unavailable|missing|unmodeled|unknown/.test(type)) return {name:"Model gap", kind:"unknown", detail:"No executable device model is established by this study."};
    return {name:human(study.model_type) || "Model type unspecified", kind:"other", detail:"Consult the provenance and limitations before using these results."};
  }
  function studies() { return arr(data?.studies); }
  function study() { return studies().find(item => String(item.id) === studyId) || studies()[0] || null; }
  function cases() { return arr(study()?.cases); }
  function currentCase() { return cases().find(item => String(item.id) === caseId) || cases()[0] || null; }
  function comparedCase() { return compareId ? cases().find(item => String(item.id) === compareId) || null : null; }
  function sourceStatus() {
    const hashMismatch = data?.source_sha256 && state?.board?.sha256 && data.source_sha256 !== state.board.sha256;
    if (hashMismatch || data?.superseded_snapshot || data?.source_current === false || data?.analysis_inputs_current === false || state?.source_current === false) return "stale";
    if (statusUnavailable) return "unknown";
    return data?.source_current === true && data?.analysis_inputs_current === true ? "current" : "unknown";
  }
  function render() {
    return '<section id="model-studies" class="ms-workspace"><div class="ms-loading" role="status"><span class="spinner"></span><h2>Loading saved model studies</h2><p>Reading model provenance, calculated results and source identity.</p></div></section>';
  }
  function cleanup() {
    generation++;
    controller?.abort();
    statusController?.abort();
    clearInterval(statusTimer);
    clearTimeout(resizeTimer);
    window.removeEventListener("resize",onResize);
    statusTimer = null;
    controller = null;
    statusController = null;
    chartState = null;
  }
  async function mount(currentState = null) {
    state = currentState;
    const token = ++generation;
    controller?.abort();
    statusController?.abort();
    clearInterval(statusTimer);
    statusTimer = null;
    controller = new AbortController();
    try {
      const response = await window.RKSnapshot.fetch("/api/model-studies", {cache:"no-store", signal:controller.signal});
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(description(result.error) || "The saved model studies are not available yet.");
      if (token !== generation || !q("#model-studies")) return;
      data = result;
      statusUnavailable = false;
      if (!studies().some(item => String(item.id) === studyId)) studyId = studies()[0] ? String(studies()[0].id) : null;
      normalizeSelection();
      paint();
      window.removeEventListener("resize",onResize);
      window.addEventListener("resize",onResize);

    } catch (error) {
      if (error.name === "AbortError" || token !== generation || !q("#model-studies")) return;
      q("#model-studies").innerHTML = `<div class="ms-loading ms-error" role="status"><span class="ms-load-symbol">◇</span><h2>Model studies unavailable</h2><p>${esc(error.message)}</p><p>No numerical results have been substituted for the missing data.</p><button type="button" class="ms-button" id="ms-retry">Reload saved studies</button></div>`;
      q("#ms-retry")?.addEventListener("click", () => mount(state));
    }
  }
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (q("#ms-chart") && chartState) paintChart(); },120);
  }
  async function pollStatus(token) {
    if (statusController || token !== generation || !q("#model-studies")) return;
    const request = new AbortController();
    statusController = request;
    try {
      const response = await window.RKSnapshot.fetch("/api/model-study-status", {cache:"no-store",signal:request.signal});
      const latest = await response.json();
      if (!response.ok || latest.error) throw new Error("Source status unavailable");
      if (token !== generation || !q("#model-studies")) return;
      const changedResult = data.result_sha256 && latest.result_sha256 ? data.result_sha256 !== latest.result_sha256 : data.generated_at && latest.generated_at ? data.generated_at !== latest.generated_at : false;
      if (changedResult || data.source_sha256 && latest.source_sha256 && data.source_sha256 !== latest.source_sha256) data.superseded_snapshot = true;
      data.source_current = latest.source_current;
      data.analysis_inputs_current = latest.analysis_inputs_current;
      statusUnavailable = false;
      paintFreshness();
    } catch (error) {
      if (error.name === "AbortError" || token !== generation || !q("#model-studies")) return;
      statusUnavailable = true;
      paintFreshness();
    } finally { if (statusController === request) statusController = null; }
  }
  function freshnessMarkup() {
    const freshness = sourceStatus();
    const title = freshness === "current" ? "PCB and analysis inputs matched at export" : data.superseded_snapshot ? "Newer results are available · this view shows the saved snapshot" : freshness === "stale" ? "Saved studies · source or analysis inputs have changed" : statusUnavailable ? "Source verification is temporarily unavailable" : "Source identity is not fully verified";
    const detail = freshness === "current" ? "Source matching establishes traceability; it does not establish hardware accuracy or compliance. Source status was checked when this snapshot was exported." : data.superseded_snapshot ? "Reload to read the published snapshot again. The current selection remains visible as historical evidence." : "The original results remain available for inspection. Treat them as historical evidence until their inputs are verified and the studies are rerun.";
    return `<span class="ms-source-icon">${freshness === "current" ? "✓" : "!"}</span><div><strong>${esc(title)}</strong><p>${esc(detail)}</p></div><span class="ms-source-hash">PCB ${esc(String(data.source_sha256 || "Unknown").slice(0,12))}</span>`;
  }
  function paintFreshness() {
    const node = q("#ms-source-status");
    if (!node) return;
    node.className = `ms-source ${sourceStatus()}`;
    node.innerHTML = freshnessMarkup();
  }
  function normalizeSelection(reset = false) {
    if (reset || !cases().some(item => String(item.id) === caseId)) caseId = cases()[0] ? String(cases()[0].id) : null;
    if (reset || compareId === caseId || !cases().some(item => String(item.id) === compareId)) compareId = "";
    const groups = axisGroups();
    if (reset || !groups.some(group => group.key === axisKey)) axisKey = groups[0]?.key || "";
    if (reset) { hiddenTraces = new Set(); cursorIndex = 0; xWindow = null; scaleChoice = "auto"; }
  }
  function axisOf(trace) {
    const xUnit = String(trace.x_unit || trace.time_unit || "Unit unspecified");
    const xLabel = String(trace.x_label || (TIME_UNITS.has(xUnit) ? "Time" : /^(Hz|kHz|MHz|GHz)$/i.test(xUnit) ? "Frequency" : "X axis"));
    const unit = String(trace.unit || "Unit unspecified");
    const scale = trace.x_scale === "log" ? "log" : "linear";
    return {unit, xUnit, xLabel, scale, key:JSON.stringify([unit, xUnit, xLabel, scale])};
  }
  function axisGroups() {
    const groups = new Map();
    arr(currentCase()?.traces).forEach(trace => {
      const axis = axisOf(trace);
      if (!groups.has(axis.key)) groups.set(axis.key, {...axis, count:0});
      groups.get(axis.key).count++;
    });
    return [...groups.values()];
  }
  function allTraces() {
    const traces = [];
    [currentCase(), comparedCase()].forEach((item, caseIndex) => {
      arr(item?.traces).forEach((trace, index) => {
        if (axisOf(trace).key !== axisKey) return;
        const sameNameIndex = arr(currentCase()?.traces).filter(t => axisOf(t).key === axisKey).findIndex(t => t.name === trace.name);
        traces.push({...trace, id:`${caseIndex}:${index}`, caseIndex, caseTitle:item.title || item.id, color:COLORS[(sameNameIndex < 0 ? index : sameNameIndex) % COLORS.length], axis:axisOf(trace)});
      });
    });
    return traces;
  }
  function downloads(items, compact = false) {
    const list = arr(items).flatMap(item => {
      const url = safeUrl(item.url, true) || fileUrl(item.file);
      return url ? [{...item, url}] : [];
    });
    if (!list.length) return "";
    return `<div class="${compact ? "ms-download-inline" : "ms-download-grid"}">${list.map(item => `<a href="${esc(item.url)}" download><span class="ms-download-icon">↓</span><span><strong>${esc(item.title || item.label || "Download artifact")}</strong>${!compact && (item.detail || item.file) ? `<small>${esc(item.detail || item.file)}</small>` : ""}</span>${!compact ? "<span>↗</span>" : ""}</a>`).join("")}</div>`;
  }
  function paint() {
    const node = q("#model-studies");
    if (!node) return;
    const freshness = sourceStatus(), list = studies(), allCases = list.flatMap(item => arr(item.cases));
    const counts = {vendor:list.filter(item => modelClass(item).kind === "vendor").length, conditional:list.filter(item => ["substitute","analytical"].includes(modelClass(item).kind)).length, traces:allCases.filter(item => arr(item.traces).some(trace => arr(trace.x).length && arr(trace.y).some(finite))).length};
    node.innerHTML = `<div class="ms-topline"><div><span class="ms-overline">MODEL EXPANSION · SAVED EXPERIMENTS</span><h2>From model source to waveform</h2><p>${esc(data.scope || "Inspect component studies with their declared models, assumptions and source evidence. These saved experiments are independent of the main board parameter controls.")}</p></div><button type="button" class="ms-button ms-refresh" id="ms-refresh" aria-label="Refresh model study results">↻ <span>Refresh</span></button></div><div id="ms-source-status" class="ms-source ${freshness}" role="status">${freshnessMarkup()}</div><div class="ms-summary"><div><strong>${list.length}</strong><span>Saved studies</span></div><div><strong>${counts.traces}<small> / ${allCases.length}</small></strong><span>Cases with numerical traces</span></div><div><strong>${counts.vendor}</strong><span>Manufacturer model studies</span></div><div><strong>${counts.conditional}</strong><span>Substitute or analytical studies</span></div></div>${downloads(data.downloads,true)}${list.length ? `<div class="ms-layout"><aside class="ms-study-rail"><label class="ms-search-label" for="ms-search">Find a model study</label><div class="ms-search-wrap"><span>⌕</span><input type="search" id="ms-search" autocomplete="off" placeholder="Device, model or study…" value="${esc(search)}"></div><div class="ms-rail-heading"><span>STUDY LIBRARY</span><output id="ms-search-count"></output></div><nav id="ms-study-list" class="ms-study-list" aria-label="Saved model studies"></nav><div class="ms-rail-note"><span>◇</span><p>Official documentation, an acquired model and a completed model run are different forms of evidence.</p><a href="#professional">Professional readiness ↗</a></div></aside><div id="ms-main" class="ms-main"></div></div>` : `<div class="ms-empty"><h3>No studies have been published yet</h3><p>Acquired models and generated studies will appear here when the backend publishes their saved evidence. The interface does not generate replacement results.</p></div>`}<footer class="ms-footer"><span>${data.generated_at ? `Generated ${esc(dateText(data.generated_at))}` : "Generation time not supplied"}</span><span>Results are conditional on each study’s declared scope.</span></footer>`;
    q("#ms-refresh")?.addEventListener("click", () => mount(state));
    if (description(data.readiness_note)) q("#ms-source-status").insertAdjacentHTML("afterend",`<div class="ms-readiness-note"><p>${esc(description(data.readiness_note))}</p><a href="#professional">Readiness rubric ↗</a></div>`);
    q("#ms-search")?.addEventListener("input", event => { search = event.target.value; paintStudyList(); });
    paintStudyList();
    paintMain();
  }
  function dateText(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(undefined, {year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  }
  function paintStudyList() {
    const node = q("#ms-study-list");
    if (!node) return;
    const term = search.trim().toLowerCase();
    const filtered = studies().filter(item => [item.title,item.id,item.summary,item.model_type,...arr(item.affected_refs)].join(" ").toLowerCase().includes(term));
    q("#ms-search-count").textContent = `${filtered.length} / ${studies().length}`;
    node.innerHTML = filtered.length ? filtered.map(item => {
      const type = modelClass(item), active = String(item.id) === String(study()?.id);
      return `<button type="button" class="ms-study-item ${active ? "active" : ""}" data-study="${esc(item.id)}" aria-current="${active ? "true" : "false"}"><span class="ms-study-symbol ${type.kind}">${type.kind === "vendor" ? "▦" : type.kind === "unknown" ? "?" : "∿"}</span><span><strong>${esc(item.title || item.id)}</strong><small>${esc(type.name)} · ${arr(item.cases).length} case${arr(item.cases).length === 1 ? "" : "s"}</small></span><span class="ms-study-arrow">›</span></button>`;
    }).join("") : '<p class="ms-no-match">No study matches this search.</p>';
    node.querySelectorAll("[data-study]").forEach(button => button.addEventListener("click", () => {
      studyId = button.dataset.study; normalizeSelection(true); paintStudyList(); paintMain();
    }));
  }
  function caseOptions(selected, includeNone = false) {
    return `${includeNone ? '<option value="">No comparison</option>' : ""}${cases().filter(item => !includeNone || String(item.id) !== caseId).map(item => `<option value="${esc(item.id)}" ${String(item.id) === selected ? "selected" : ""}>${esc(item.title || item.id)}</option>`).join("")}`;
  }
  function paintMain() {
    const item = study(), node = q("#ms-main");
    if (!item || !node) return;
    const type = modelClass(item);
    node.innerHTML = `<header class="ms-study-heading"><div class="ms-study-meta"><span class="ms-model-tag ${type.kind}">${esc(type.name)}</span>${badge(item.status)}<span class="ms-study-id">${esc(item.id)}</span></div><h2>${esc(item.title || item.id)}</h2><p>${esc(item.summary || "No study summary was supplied.")}</p></header><div class="ms-model-scope"><span>MODEL BASIS</span><p>${esc(description(item.provenance) || type.detail)}</p>${item.model_type ? `<small>${esc(human(item.model_type))}</small>` : ""}</div><div class="ms-view-tabs" aria-label="Study views">${[["waveforms","Waveforms"],["comparison","Compare cases"],["evidence","Evidence & files"]].map(([id,title]) => `<button type="button" data-ms-tab="${id}" aria-pressed="${tab === id}" class="${tab === id ? "active" : ""}">${title}</button>`).join("")}</div>${cases().length ? `<div class="ms-case-bar"><label for="ms-case">Selected case<select id="ms-case">${caseOptions(caseId)}</select></label><label for="ms-compare">Compare with<select id="ms-compare">${caseOptions(compareId,true)}</select></label></div>` : ""}<div id="ms-tab-content"></div>`;
    node.querySelectorAll("[data-ms-tab]").forEach(button => button.addEventListener("click", () => { tab = button.dataset.msTab; paintMain(); }));
    q("#ms-case")?.addEventListener("change", event => { caseId = event.target.value; normalizeSelection(); hiddenTraces = new Set(); cursorIndex = 0; xWindow = null; paintMain(); });
    q("#ms-compare")?.addEventListener("change", event => { compareId = event.target.value; cursorIndex = 0; hiddenTraces = new Set(); paintTab(); });
    paintTab();
  }
  function listMarkup(items, emptyText) {
    const list = arr(items).map(description).filter(Boolean);
    return list.length ? `<ul>${list.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p class="ms-unspecified">${esc(emptyText)}</p>`;
  }
  function assumptionPanels(compact = false) {
    const item = study(), selected = currentCase();
    const assumptions = [...arr(item?.assumptions), ...arr(selected?.assumptions)];
    const limitations = [...arr(item?.limitations), ...arr(selected?.limitations)];
    return `<div class="ms-boundary-grid ${compact ? "compact" : ""}"><section class="ms-boundary assumptions"><h3><span>≈</span> Assumptions used</h3>${listMarkup(assumptions,"No assumptions were supplied. This does not establish an assumption-free model.")}</section><section class="ms-boundary limitations"><h3><span>◇</span> What remains unknown</h3>${listMarkup(limitations,"No limitations were supplied; the model’s coverage is unverified.")}</section></div>`;
  }
  function paintTab() {
    const node = q("#ms-tab-content");
    if (!node) return;
    if (tab === "evidence") { node.innerHTML = evidenceMarkup(); return; }
    if (tab === "comparison") { node.innerHTML = comparisonMarkup(); return; }
    const item = currentCase(), groups = axisGroups();
    node.innerHTML = `${item ? caseNotice(item) : ""}${!item ? `<div class="ms-empty"><h3>No executed case is attached</h3><p>The model or source may be acquired or documented without a runnable study. Review its status and evidence below.</p></div>` : `<div class="ms-metric-grid">${metricsMarkup(item)}</div>`}${groups.length ? `<section class="ms-chart-panel"><div class="ms-chart-toolbar"><label for="ms-axis">Plotted quantity<select id="ms-axis">${groups.map(group => `<option value="${esc(group.key)}" ${group.key === axisKey ? "selected" : ""}>${esc(axisTitle(group))}</option>`).join("")}</select></label><label for="ms-scale">X axis scale<select id="ms-scale"><option value="auto" ${scaleChoice === "auto" ? "selected" : ""}>From saved data</option><option value="linear" ${scaleChoice === "linear" ? "selected" : ""}>Linear</option><option value="log" ${scaleChoice === "log" ? "selected" : ""}>Logarithmic</option></select></label><button type="button" class="ms-chart-reset" id="ms-fit">Fit all samples ⤢</button></div><div id="ms-trace-legend" class="ms-trace-legend"></div><div id="ms-chart" class="ms-chart"></div><div class="ms-chart-bottom"><div class="ms-axis-window"><label for="ms-x-min">X from<input id="ms-x-min" type="number" step="any"></label><label for="ms-x-max">X to<input id="ms-x-max" type="number" step="any"></label><button type="button" id="ms-apply-window">Apply window</button></div><p id="ms-window-message" role="status"></p></div><div class="ms-scrubber"><label for="ms-sample">Inspect saved sample</label><output id="ms-sample-time"></output><input type="range" id="ms-sample" min="0" max="0" value="0" step="1"><div id="ms-probe-values" class="ms-probe-values"></div></div><p class="ms-chart-note">Lines connect saved samples; they do not add a device model. Probe values use the nearest saved sample for each trace and report its actual x coordinate. Metrics below belong to the saved case, not the plot’s zoom window.</p></section>` : item ? '<div class="ms-empty"><h3>No numerical traces in this case</h3><p>Inspect its supplied metrics, checks and model evidence. Missing waveforms are not plotted as zero.</p></div>' : ""}${item ? `<details class="ms-details"><summary>Case parameters <span>${parameterEntries(item.parameters).length} recorded</span></summary>${parameterTable([item])}</details>` : ""}${assumptionPanels(true)}${checksMarkup([...arr(study()?.checks),...arr(item?.checks)],true)}`;
    if (!groups.length) return;
    q("#ms-axis").addEventListener("change", event => { axisKey = event.target.value; hiddenTraces = new Set(); xWindow = null; cursorIndex = 0; paintTab(); });
    q("#ms-scale").addEventListener("change", event => { scaleChoice = event.target.value; xWindow = null; paintChart(); });
    q("#ms-fit").addEventListener("click", () => { xWindow = null; paintChart(); });
    q("#ms-apply-window").addEventListener("click", applyWindow);
    q("#ms-sample").addEventListener("input", event => { cursorIndex = Number(event.target.value); paintProbe(); });
    paintChart();
  }
  function caseNotice(item) {
    const messages = value => (Array.isArray(value) ? value : value ? [value] : []).map(description).filter(Boolean);
    const validity = item.model_validity && typeof item.model_validity === "object" && !Array.isArray(item.model_validity) ? item.model_validity : null;
    const flags = [...new Set([...messages(item.operating_point_flags),...messages(item.warnings),...messages(validity?.warning),...messages(validity?.warnings)])];
    const validityStatus = validity ? typeof validity.status === "string" ? validity.status : null : typeof item.model_validity === "string" ? item.model_validity : null;
    const facts = validity ? Object.entries(validity).filter(([key,value]) => !["warning","warnings","status"].includes(key) && (value === null || ["boolean","number","string"].includes(typeof value))) : [];
    return `${item.summary || item.status || validityStatus ? `<div class="ms-case-note">${item.status ? badge(item.status) : ""}${validityStatus ? badge(validityStatus) : ""}${description(item.summary) ? `<p>${esc(description(item.summary))}</p>` : ""}</div>` : ""}${flags.length ? `<div class="ms-case-warning">${flags.map(flag => `<p>${esc(flag)}</p>`).join("")}</div>` : ""}${facts.length ? `<div class="ms-case-validity"><span>Recorded model-validity evidence</span><dl>${facts.map(([key,value]) => `<div><dt>${esc(key === "temperature_c" ? "Model temperature" : human(key))}</dt><dd>${esc(valueText(value))}${key === "temperature_c" && finite(value) ? " °C" : ""}</dd></div>`).join("")}</dl></div>` : ""}`;
  }
  function axisTitle(axis) {
    const names = {V:"Voltage",mV:"Voltage",A:"Current",mA:"Current",uA:"Current",µA:"Current",W:"Power",mW:"Power",ohm:"Impedance",Ohm:"Impedance",Ω:"Impedance",dB:"Magnitude",deg:"Phase","°":"Phase","°C":"Temperature",T:"Magnetic flux density",µT:"Magnetic flux density",nT:"Magnetic flux density"};
    return `${names[axis.unit] || "Quantity"} [${axis.unit}] · ${axis.xLabel} [${axis.xUnit}]`;
  }
  function metricsOf(item) {
    const raw = item?.metrics;
    if (Array.isArray(raw)) return raw.map((value,index) => typeof value === "object" && value ? {key:String(value.id || value.key || value.name || value.label || index),label:value.label || value.name || human(value.key || value.id || `Metric ${index+1}`),value:value.value,unit:value.unit || "",detail:value.detail || value.note || "",status:value.status} : {key:String(index),label:`Metric ${index+1}`,value,unit:"",detail:""});
    return raw && typeof raw === "object" ? Object.entries(raw).map(([key,value]) => value && typeof value === "object" && !Array.isArray(value) ? {key,label:value.label || value.name || human(key),value:value.value,unit:value.unit || "",detail:value.detail || value.note || "",status:value.status} : {key,label:human(key),value,unit:"",detail:""}) : [];
  }
  function metricsMarkup(item) {
    const metrics = metricsOf(item);
    return metrics.length ? metrics.slice(0,6).map(metric => `<article class="ms-metric"><span>${esc(metric.label)}</span><strong>${esc(valueText(metric.value))}${metric.unit ? `<small> ${esc(metric.unit)}</small>` : ""}</strong>${metric.detail ? `<p>${esc(metric.detail)}</p>` : ""}${metric.status ? badge(metric.status) : ""}</article>`).join("") + (metrics.length > 6 ? `<div class="ms-more-metrics">${metrics.length - 6} further metrics in Compare cases</div>` : "") : '<div class="ms-no-metrics">No case metrics were supplied. Numerical values are shown only where the saved study provides them.</div>';
  }
  function parameterEntries(parameters) {
    if (Array.isArray(parameters)) return parameters.map((item,index) => ({key:String(item.id || item.key || item.name || item.label || index),label:item.label || item.name || human(item.key || item.id || index),value:item.value,unit:item.unit || "",detail:item.detail || item.note || ""}));
    return parameters && typeof parameters === "object" ? Object.entries(parameters).map(([key,value]) => value && typeof value === "object" && !Array.isArray(value) && "value" in value ? {key,label:value.label || value.name || human(key),value:value.value,unit:value.unit || "",detail:value.detail || value.note || ""} : {key,label:human(key),value,unit:"",detail:""}) : [];
  }
  function parameterTable(items) {
    const rows = new Map();
    items.forEach(item => parameterEntries(item?.parameters).forEach(row => { if (!rows.has(row.key)) rows.set(row.key,row); }));
    if (!rows.size) return '<p class="ms-unspecified">No case parameters were supplied.</p>';
    return `<div class="ms-table-scroll"><table><thead><tr><th>Recorded parameter</th>${items.map(item => `<th>${esc(item.title || item.id)}</th>`).join("")}</tr></thead><tbody>${[...rows.values()].map(row => `<tr><th>${esc(row.label)}${row.detail ? `<small>${esc(row.detail)}</small>` : ""}</th>${items.map(item => { const value = parameterEntries(item.parameters).find(entry => entry.key === row.key); return `<td>${value ? `${esc(valueText(value.value))}${value.unit ? ` ${esc(value.unit)}` : ""}` : '<span class="ms-unknown">Not supplied</span>'}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  function comparisonMarkup() {
    const selected = currentCase(), comparison = comparedCase();
    if (!selected) return `<div class="ms-empty"><h3>No cases to compare</h3><p>Evidence may exist without an executed numerical study.</p></div>${assumptionPanels()}`;
    const items = comparison ? [selected,comparison] : [selected];
    const rows = new Map();
    items.forEach(item => metricsOf(item).forEach(metric => { if (!rows.has(metric.key)) rows.set(metric.key,metric); }));
    return `<div class="ms-section-heading"><h3>Recorded case metrics</h3><p>${comparison ? "Absolute difference is shown only for numeric metrics with identical units. Changing an assumed parameter does not validate it." : "Choose a comparison case above to place metrics and parameters side by side."}</p></div>${rows.size ? `<div class="ms-table-scroll ms-comparison-table"><table><thead><tr><th>Saved metric</th>${items.map(item => `<th>${esc(item.title || item.id)}</th>`).join("")}${comparison ? "<th>Comparison − selected</th>" : ""}</tr></thead><tbody>${[...rows.values()].map(row => {
      const values = items.map(item => metricsOf(item).find(metric => metric.key === row.key));
      const canDelta = values.length === 2 && values.every(value => value && finite(value.value)) && values[0].unit === values[1].unit;
      return `<tr><th>${esc(row.label)}${row.detail ? `<small>${esc(row.detail)}</small>` : ""}</th>${values.map(value => `<td>${value ? `${esc(valueText(value.value))}${value.unit ? ` ${esc(value.unit)}` : ""}${value.status ? `<small>${esc(human(value.status))}</small>` : ""}` : '<span class="ms-unknown">Not supplied</span>'}</td>`).join("")}${comparison ? `<td>${canDelta ? `${values[1].value - values[0].value > 0 ? "+" : ""}${format(values[1].value - values[0].value)} ${esc(values[0].unit)}` : '<span class="ms-unknown">Not comparable</span>'}</td>` : ""}</tr>`;
    }).join("")}</tbody></table></div>` : '<p class="ms-unspecified">No metrics supplied for these cases.</p>'}<section class="ms-comparison-parameters"><div class="ms-section-heading"><h3>Inputs and assumptions by case</h3><p>These are saved experiment inputs. The main board sliders do not change them.</p></div>${parameterTable(items)}</section><div class="ms-case-evidence-grid">${items.map(item => `<section class="ms-card"><h3>${esc(item.title || item.id)}</h3>${caseNotice(item)}${checksMarkup(arr(item.checks),true)}${downloads(item.downloads)}</section>`).join("")}</div>${assumptionPanels()}`;
  }
  function checksMarkup(checks, compact = false) {
    const unique = [...new Map(checks.map((check,index) => [check.id || `${check.title || check.name || index}:${check.detail || ""}`,check])).values()];
    if (!unique.length) return compact ? "" : '<p class="ms-unspecified">No validation checks were supplied.</p>';
    return `<section class="ms-checks ${compact ? "compact" : ""}"><div class="ms-section-heading"><h3>Recorded checks</h3><p>Each status applies to its named model check; it is not a board-wide pass.</p></div>${unique.map(check => `<article><span class="ms-check-dot ${statusClass(check.status)}"></span><div><strong>${esc(check.title || check.name || check.id || "Check")}</strong><p>${esc(check.detail || check.note || "No check detail supplied.")}</p></div>${badge(check.status)}</article>`).join("")}</section>`;
  }
  function sourceMarkup(sources) {
    const list = arr(sources);
    return list.length ? `<div class="ms-source-list">${list.map(source => {
      const url = safeUrl(source.url), local = fileUrl(source.file);
      return `<article><span class="ms-reference-symbol">↗</span><div><strong>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source.title || source.name || "Source reference")}</a>` : esc(source.title || source.name || "Source reference")}</strong>${description(source.detail || source.note || source.provenance) ? `<p>${esc(description(source.detail || source.note || source.provenance))}</p>` : ""}${source.status ? badge(source.status) : ""}${source.sha256 ? `<code>SHA-256 ${esc(source.sha256)}</code>` : ""}${local ? `<a class="ms-source-file" href="${local}" download>Download attached source ↓</a>` : ""}</div></article>`;
    }).join("")}</div>` : '<p class="ms-unspecified">No source references were supplied.</p>';
  }
  function evidenceMarkup() {
    const item = study(), selected = currentCase();
    return `<div class="ms-evidence-intro"><span>▦</span><p>Read the model’s origin, implementation and boundaries together. A manufacturer document or download alone does not demonstrate that a compatible device model ran successfully.</p></div><section class="ms-card"><div class="ms-section-heading"><h3>Model provenance</h3><p>${esc(description(item.provenance) || modelClass(item).detail)}</p></div><dl class="ms-provenance"><div><dt>Declared model type</dt><dd>${esc(human(item.model_type) || "Not supplied")}</dd></div><div><dt>Recorded study status</dt><dd>${esc(human(item.status) || "Not supplied")}</dd></div>${item.engine ? `<div><dt>Analysis engine</dt><dd>${esc(description(item.engine))}</dd></div>` : ""}${item.model_status ? `<div><dt>Model acquisition status</dt><dd>${esc(human(item.model_status))}</dd></div>` : ""}${item.run_status ? `<div><dt>Execution status</dt><dd>${esc(human(item.run_status))}</dd></div>` : ""}${item.source_sha256 ? `<div><dt>Study PCB identity</dt><dd><code>${esc(item.source_sha256)}</code></dd></div>` : ""}</dl></section>${assumptionPanels()}<section class="ms-card"><div class="ms-section-heading"><h3>Source references</h3><p>Recorded sources and acquisition status supplied by the study authors</p></div>${sourceMarkup([...arr(item.sources),...arr(selected?.sources)])}</section>${checksMarkup([...arr(item.checks),...arr(selected?.checks)])}<section class="ms-card"><div class="ms-section-heading"><h3>Reproduce and hand off</h3><p>Download the published reports, results and permitted analysis inputs.</p></div>${downloads([...arr(item.downloads),...arr(selected?.downloads)]) || '<p class="ms-unspecified">No downloadable artifacts were attached to this study.</p>'}<p class="ms-artifact-note">Only files explicitly published by the server are downloadable. Some manufacturer model files may have redistribution restrictions.</p></section>`;
  }
  function nearest(values, target) {
    if (!values.length) return -1;
    let left = 0, right = values.length - 1;
    while (left < right) { const middle = Math.floor((left + right) / 2); if (values[middle] < target) left = middle + 1; else right = middle; }
    return left > 0 && Math.abs(values[left-1] - target) <= Math.abs(values[left] - target) ? left-1 : left;
  }
  function prepared(trace, scale) {
    const x = arr(trace.x), y = arr(trace.y), points = [];
    let rejected = 0, ordered = true, previous = -Infinity;
    const n = Math.min(x.length,y.length);
    for (let i = 0; i < n; i++) {
      if (!finite(x[i]) || scale === "log" && x[i] <= 0) { rejected++; continue; }
      if (x[i] < previous) ordered = false;
      previous = x[i]; points.push({x:x[i],y:finite(y[i]) ? y[i] : null,index:i});
    }
    if (!ordered) points.sort((a,b) => a.x-b.x);
    return {...trace, points, sampleX:points.map(point => point.x), rejected, unequal:x.length !== y.length, ordered};
  }
  function bounds(values) {
    let min = Infinity, max = -Infinity;
    for (const value of values) if (finite(value)) { if (value < min) min = value; if (value > max) max = value; }
    return min === Infinity ? null : [min,max];
  }
  function ticks(min, max, count, logarithmic = false) {
    if (logarithmic) {
      const lo = Math.log10(min), hi = Math.log10(max), result = [];
      for (let i = 0; i <= count; i++) result.push(10 ** (lo + (hi-lo)*i/count));
      return result;
    }
    return Array.from({length:count+1},(_,i) => min+(max-min)*i/count);
  }
  function tickText(value) {
    const magnitude = Math.abs(value);
    if (magnitude !== 0 && (magnitude < 0.001 || magnitude >= 1e6)) return value.toExponential(1).replace(".0e","e");
    return format(value, Math.abs(value) < 1 ? 4 : 3);
  }
  // Each bucket keeps its extrema and missing-value breaks. Spikes are not averaged away.
  function decimate(points, limit = 1700) {
    if (points.length <= limit) return points;
    const result = [], size = Math.ceil(points.length / (limit / 4));
    for (let start = 0; start < points.length; start += size) {
      const end = Math.min(points.length,start+size), indices = new Set([start,end-1]);
      let low = start, high = start;
      for (let i = start; i < end; i++) {
        if (points[i].y === null) {
          if (i === start || points[i-1].y !== null) {indices.add(i);if (i > start) indices.add(i-1);}
          if (i+1 < end && points[i+1].y !== null) indices.add(i+1);
          continue;
        }
        if (points[low].y === null || points[i].y < points[low].y) low = i;
        if (points[high].y === null || points[i].y > points[high].y) high = i;
      }
      indices.add(low); indices.add(high);
      [...indices].sort((a,b) => a-b).forEach(index => result.push(points[index]));
    }
    return result;
  }
  function paintChart() {
    const axis = axisGroups().find(group => group.key === axisKey), chart = q("#ms-chart");
    if (!axis || !chart) return;
    const scale = scaleChoice === "auto" ? axis.scale : scaleChoice;
    const traces = allTraces().map(trace => prepared(trace,scale));
    const visible = traces.filter(trace => !hiddenTraces.has(trace.id));
    const reference = traces.find(trace => trace.caseIndex === 0 && trace.points.length) || traces.find(trace => trace.points.length);
    const domain = bounds(traces.flatMap(trace => trace.sampleX));
    const legend = q("#ms-trace-legend");
    legend.innerHTML = traces.map(trace => `<button type="button" data-ms-trace="${trace.id}" class="${hiddenTraces.has(trace.id) ? "muted" : ""}" aria-pressed="${!hiddenTraces.has(trace.id)}"><i style="--ms-trace:${trace.color}" class="${trace.caseIndex ? "dashed" : ""}"></i><span>${esc(trace.name || "Unnamed trace")}${comparedCase() ? `<small>${esc(trace.caseTitle)}</small>` : ""}</span></button>`).join("");
    legend.querySelectorAll("[data-ms-trace]").forEach(button => button.addEventListener("click", () => { const id = button.dataset.msTrace; if (hiddenTraces.has(id)) hiddenTraces.delete(id); else hiddenTraces.add(id); paintChart(); }));
    const comparisonMismatch = comparedCase() && !traces.some(trace => trace.caseIndex === 1);
    if (!domain || !reference) {
      chart.innerHTML = '<div class="ms-chart-empty">No finite samples are available for this axis. A logarithmic x axis also requires positive x values.</div>';
      chartState = null; q("#ms-sample").disabled = true; q("#ms-probe-values").innerHTML = ""; q("#ms-sample-time").textContent = "Unknown"; return;
    }
    let [xMin,xMax] = xWindow || domain;
    if (xMin === xMax) { if (scale === "log") {xMin /= 1.1;xMax *= 1.1;} else {const pad = Math.abs(xMin)*.05 || 1;xMin -= pad;xMax += pad;} }
    const inWindow = visible.flatMap(trace => trace.points.filter(point => point.x >= xMin && point.x <= xMax).map(point => point.y));
    let yBounds = bounds(inWindow), yMin = yBounds?.[0] ?? 0, yMax = yBounds?.[1] ?? 1;
    if (yBounds) { const pad = (yMax-yMin)*.09 || Math.abs(yMax)*.08 || 1; yMin -= pad; yMax += pad; }
    const W = Math.max(520,Math.round(chart.clientWidth || 900)-12), H = Math.max(310,Math.min(370,W*.43)), plot = {left:80,top:36,right:24,bottom:55};
    const pw = W-plot.left-plot.right, ph = H-plot.top-plot.bottom;
    const transform = value => scale === "log" ? Math.log10(value) : value;
    const txMin = transform(xMin), txMax = transform(xMax);
    const px = value => plot.left+(transform(value)-txMin)/(txMax-txMin)*pw;
    const py = value => plot.top+(yMax-value)/(yMax-yMin)*ph;
    const xTicks = ticks(xMin,xMax,5,scale === "log"), yTicks = ticks(yMin,yMax,4);
    const paths = visible.map(trace => {
      const points = trace.points.filter(point => point.x >= xMin && point.x <= xMax);
      let move = true;
      const d = decimate(points).map(point => {if (point.y === null) {move = true;return "";} const command = move ? "M" : "L"; move = false; return `${command}${px(point.x).toFixed(2)},${py(point.y).toFixed(2)}`;}).join(" ");
      return `<path d="${d}" fill="none" stroke="${trace.color}" stroke-width="1.8" ${trace.caseIndex ? 'stroke-dasharray="6 4"' : ""} vector-effect="non-scaling-stroke"/>`;
    }).join("");
    chart.innerHTML = `<svg id="ms-chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saved ${esc(axis.unit)} traces against ${esc(axis.xLabel)} in ${esc(axis.xUnit)}"><defs><clipPath id="ms-plot-clip"><rect x="${plot.left}" y="${plot.top}" width="${pw}" height="${ph}"/></clipPath></defs><text x="${plot.left}" y="18" fill="#c8dde4" font-size="12">${esc(axis.unit)}</text>${yTicks.map(value => `<line x1="${plot.left}" y1="${py(value)}" x2="${W-plot.right}" y2="${py(value)}" stroke="#294450"/><text x="${plot.left-12}" y="${py(value)+4}" text-anchor="end" fill="#a9c3ce" font-size="11">${esc(tickText(value))}</text>`).join("")}${xTicks.map(value => `<line x1="${px(value)}" y1="${plot.top}" x2="${px(value)}" y2="${H-plot.bottom}" stroke="#243e4c"/><text x="${px(value)}" y="${H-plot.bottom+23}" text-anchor="middle" fill="#a9c3ce" font-size="11">${esc(tickText(value))}</text>`).join("")}<text x="${plot.left+pw/2}" y="${H-9}" text-anchor="middle" fill="#c8dde4" font-size="12">${esc(axis.xLabel)} [${esc(axis.xUnit)}]${scale === "log" ? " · logarithmic" : ""}</text><g clip-path="url(#ms-plot-clip)">${paths}<line id="ms-cursor-line" x1="0" x2="0" y1="${plot.top}" y2="${H-plot.bottom}" stroke="#d2e7ee" stroke-width="1" stroke-dasharray="3 4"/><g id="ms-cursor-dots"></g></g>${!yBounds ? `<text x="${plot.left+pw/2}" y="${plot.top+ph/2}" text-anchor="middle" fill="#c8dde4" font-size="13">${visible.length ? "No numeric y values in this window" : "Select a trace above to plot"}</text>` : ""}<rect id="ms-chart-hit" x="${plot.left}" y="${plot.top}" width="${pw}" height="${ph}" fill="transparent"/></svg>`;
    chartState = {axis,scale,traces,visible,reference,xMin,xMax,yMin,yMax,px,py,W,H,plot,pw,ph,domain};
    q("#ms-x-min").value = xMin; q("#ms-x-max").value = xMax;
    q("#ms-x-min").setAttribute("aria-label",`Minimum ${axis.xLabel} in ${axis.xUnit}`); q("#ms-x-max").setAttribute("aria-label",`Maximum ${axis.xLabel} in ${axis.xUnit}`);
    const notes = [];
    if (comparisonMismatch) notes.push("The comparison case has no trace with this x quantity, units and saved scale.");
    if (traces.some(trace => trace.rejected)) notes.push("Invalid x samples and nonpositive logarithmic coordinates are omitted.");
    if (traces.some(trace => trace.unequal)) notes.push("A trace has unequal x/y lengths; only paired samples are shown.");
    if (traces.some(trace => !trace.ordered)) notes.push("Nonmonotonic x samples are sorted by coordinate for display.");
    q("#ms-window-message").textContent = notes.join(" ");
    const slider = q("#ms-sample"); slider.disabled = false; slider.max = Math.max(0,reference.points.length-1); cursorIndex = Math.min(cursorIndex,reference.points.length-1); slider.value = cursorIndex;
    q("#ms-chart-hit").addEventListener("pointermove", event => {
      if (!chartState) return;
      const svg = q("#ms-chart-svg"), rect = svg.getBoundingClientRect();
      const coordinate = (event.clientX-rect.left)/rect.width*W;
      const fraction = Math.max(0,Math.min(1,(coordinate-plot.left)/pw));
      const target = scale === "log" ? 10 ** (txMin+(txMax-txMin)*fraction) : xMin+(xMax-xMin)*fraction;
      cursorIndex = nearest(reference.sampleX,target); slider.value = cursorIndex; paintProbe();
    });
    paintProbe();
  }
  function applyWindow() {
    if (!chartState) return;
    const from = q("#ms-x-min"), to = q("#ms-x-max");
    const min = from.value === "" ? NaN : Number(from.value), max = to.value === "" ? NaN : Number(to.value);
    if (!finite(min) || !finite(max) || min >= max || chartState.scale === "log" && min <= 0) {
      q("#ms-window-message").textContent = "Enter finite increasing x limits. A logarithmic axis requires both limits to be positive."; return;
    }
    if (max < chartState.domain[0] || min > chartState.domain[1]) { q("#ms-window-message").textContent = "This range contains no saved x samples. Choose a window within the recorded experiment."; return; }
    xWindow = [min,max]; paintChart();
  }
  function paintProbe() {
    if (!chartState || !q("#ms-probe-values")) return;
    const {reference,visible,axis,px,py,xMin,xMax} = chartState;
    const point = reference.points[cursorIndex];
    if (!point) return;
    q("#ms-sample-time").textContent = `${axis.xLabel} ${format(point.x)} ${axis.xUnit}`;
    q("#ms-sample").setAttribute("aria-valuetext",`${axis.xLabel} ${format(point.x)} ${axis.xUnit}, saved sample ${cursorIndex+1} of ${reference.points.length}`);
    const cursor = q("#ms-cursor-line"), dots = [];
    if (cursor) {cursor.setAttribute("x1",px(point.x));cursor.setAttribute("x2",px(point.x));cursor.style.display = point.x >= xMin && point.x <= xMax ? "" : "none";}
    q("#ms-probe-values").innerHTML = visible.map(trace => {
      const index = nearest(trace.sampleX,point.x), sample = index >= 0 ? trace.points[index] : null;
      if (sample && finite(sample.y) && sample.x >= xMin && sample.x <= xMax) dots.push(`<circle cx="${px(sample.x)}" cy="${py(sample.y)}" r="3.3" fill="${trace.color}" stroke="#0e2633" stroke-width="1.5"/>`);
      return `<article><i style="background:${trace.color}"></i><div><span>${esc(trace.name || "Unnamed trace")}${comparedCase() ? ` · ${esc(trace.caseTitle)}` : ""}</span><strong>${sample ? format(sample.y) : "Unknown"}${sample && finite(sample.y) ? `<small> ${esc(axis.unit)}</small>` : ""}</strong><small>${sample ? `Saved ${esc(axis.xLabel.toLowerCase())} ${format(sample.x)} ${esc(axis.xUnit)}` : "No saved sample"}</small></div></article>`;
    }).join("") || '<p class="ms-probe-empty">Select one or more traces to inspect their saved values.</p>';
    if (q("#ms-cursor-dots")) q("#ms-cursor-dots").innerHTML = dots.join("");
  }
  return {render,mount,cleanup};
})();
