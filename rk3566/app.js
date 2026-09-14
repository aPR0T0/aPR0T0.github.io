"use strict";

const $ = (query, root = document) => root.querySelector(query);
const $$ = (query, root = document) => [...root.querySelectorAll(query)];
const COLORS = ["#188c87", "#6c80c8", "#cbac63", "#73a7b7", "#a087b1", "#78a67c", "#cd9382", "#447a9d"];
const pageInfo = {
  sections: ["Every PCB section, reviewed", "Trace findings, modeled voltages and currents, and proposed changes across the complete board."],
  models: ["Manufacturer model studies", "Explore executed vendor models and explicit assumptions, with traceable results and operating limits."],
  workbench: ["Interactive simulation workspace", "Explore the board in 3D, probe saved results, and compare operating scenarios."],
  professional: ["Professional evidence review", "What is established, what remains unverified, and the next steps toward hardware validation."],
  "time-em": ["Current and fields, through time", "Inspect the switched U7 network and its conditional electric and magnetic field contributions."],
  board: ["Your board, connected to the data", "Explore the actual PCB and follow modeled pin voltages from startup to steady state."],
  overview: ["Electrical simulation lab", "Follow power delivery from the first microsecond to steady state."],
  power: ["Power delivery, in detail", "Inspect startup transients, steady-state margins, and modeled load currents."],
  boot: ["From power-on to reset release", "Review the modeled sequence and the evidence needed to establish a real boot."],
  components: ["Every component, accounted for", "Search the design inventory and inspect calculated values and model coverage."],
  emi: ["EMI & EMC engineering review", "Explore switching estimates, geometry findings, and measurement requirements."],
  iterations: ["A traceable simulation history", "Compare operating conditions without hiding failed corners or changing the evidence."],
};
const baseControls = [
  {key:"vin_v",label:"Input voltage",unit:"V",min:4.5,max:5.5,step:.05,default:5},
  {key:"source_resistance_ohm",label:"Source resistance",unit:"Ω",min:.01,max:.5,step:.01,default:.08},
  {key:"load_scale",label:"Load multiplier",unit:"×",min:.2,max:1.6,step:.05,default:1},
  {key:"capacitance_scale",label:"Effective capacitance",unit:"×",min:.3,max:1.2,step:.05,default:.8},
  {key:"soft_start_ms",label:"Converter soft start",unit:"ms",min:1,max:20,step:.01,default:1.39,advanced:true},
  {key:"reset_release_ms",label:"Reset release",unit:"ms",min:10,max:80,step:1,default:40,advanced:true},
  {key:"ambient_c",label:"Ambient temperature",unit:"°C",min:0,max:80,step:1,default:25,advanced:true},
  {key:"dt_ms",label:"Time step",unit:"ms",min:.02,max:.1,step:.01,default:.05,advanced:true},
  {key:"source_current_limit_a",label:"Source current limit",unit:"A",min:.5,max:10,step:.1,advanced:true,optional:true},
  {key:"duration_ms",label:"Simulation duration",unit:"ms",min:50,max:500,step:10,advanced:true,optional:true},
  {key:"step_load_scale",label:"Step load multiplier",unit:"×",min:.2,max:3,step:.1,advanced:true,optional:true},
  {key:"step_at_ms",label:"Load step time",unit:"ms",min:10,max:300,step:1,advanced:true,optional:true},
  {key:"brownout_voltage_v",label:"Brownout voltage",unit:"V",min:0,max:5,step:.1,advanced:true,optional:true},
  {key:"brownout_at_ms",label:"Brownout time",unit:"ms",min:10,max:300,step:1,advanced:true,optional:true},
  {key:"brownout_duration_ms",label:"Brownout duration",unit:"ms",min:1,max:100,step:1,advanced:true,optional:true},
  {key:"frequency_scale",label:"Switching frequency",unit:"×",min:.5,max:1.5,step:.05,advanced:true,optional:true},
];
let state = null;
let page = pageInfo[location.hash.slice(1)] ? location.hash.slice(1) : "board";
let requestBusy = false;
let polling = false;
let inputsDirty = false;
let parametersReady = false;
let chartMode = "voltage";
let hiddenSeries = new Set();
let seriesInitialized = false;
let componentSearch = "";
let componentFilter = "all";
let componentLimit = 60;
let expandedComponent = null;
let selectedIteration = null;
let lastSignature = "";
let toastTimeout;

function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function number(value) { return typeof value === "number" && Number.isFinite(value) ? value : (typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null); }
function first(...values) { return values.find(v => v !== null && v !== undefined); }
function fmt(value, digits = 2) { const n = number(value); return n === null ? "—" : n.toLocaleString(undefined, {minimumFractionDigits:digits,maximumFractionDigits:digits}); }
function human(value) { return String(value ?? "").replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase()); }
function asArray(value) { return Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : []; }
function describe(value) { if (value === null || value === undefined) return ""; if (typeof value === "string" || typeof value === "number") return String(value); if (Array.isArray(value)) return value.map(describe).filter(Boolean).join(" · "); if (typeof value === "object") return String(first(value.detail,value.description,value.note,value.message,value.title,value.name,JSON.stringify(value))); return String(value); }
function isPass(status) { return ["pass","passed","ok","stable","calculated","valid","met","verified","modeled"].includes(String(status).toLowerCase()); }
function isFail(status) { return ["fail","failed","error","blocked","risk","high","critical"].includes(String(status).toLowerCase()); }
function statusClass(status) { return isPass(status) ? "pass" : isFail(status) ? "fail" : ["warning","partial","caution","conditional","assumed"].includes(String(status).toLowerCase()) ? "warning" : status === "running" ? "running" : "unknown"; }
function badge(status, label) { return `<span class="badge ${statusClass(status)}">${esc(label || human(status || "unknown"))}</span>`; }
function reading(value, unit, digits = 3) { return number(value) === null ? '<span class="unknown-text">Unknown</span>' : `<span class="mono">${fmt(value,digits)} <span>${esc(unit)}</span></span>`; }
function engineering(value, unit) { const n = number(value); if(n === null) return "Unknown"; const abs = Math.abs(n); if(abs === 0) return `0 ${unit}`; const prefixes = [[1e9,"G"],[1e6,"M"],[1e3,"k"],[1,""],[1e-3,"m"],[1e-6,"µ"],[1e-9,"n"],[1e-12,"p"]]; const [scale,prefix] = prefixes.find(([s]) => abs >= s) || prefixes.at(-1); return `${fmt(n/scale,2)} ${prefix}${unit}`; }
function scoreValues() { const score = state?.result?.score || {}; return {model:number(first(score.behavioral,score.model,score.simulation_validation,score.validation)),evidence:number(first(score.evidence,score.hardware_evidence,score.hardware)),target:number(score.target) ?? 8,targetMet:score.target_met,scope:score.scope,criteria:asArray(score.criteria)}; }
function currentRails() { return asArray(state?.result?.rails); }
function currentBoot() { return asArray(state?.result?.boot); }
function iterations() { return asArray(state?.iterations); }
function getFindings() { return asArray(state?.audit?.findings); }
function hasResult() { return Boolean(state?.result); }
function isSuperseded(result=state?.result) { if(!result)return false;if(result.superseded!==undefined)return Boolean(result.superseded);return Boolean(state?.engine_sha256 && (!result.engine_sha256 || result.engine_sha256!==state.engine_sha256)); }
function empty(title, detail) { return `<div class="empty-state"><strong>${esc(title)}</strong>${esc(detail)}</div>`; }
function panel(title, subtitle, body, right="") { return `<section class="panel"><div class="panel-heading"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:""}</div>${right}</div>${body}</section>`; }
function safeUrl(value) { try { const url = new URL(value); return ["https:","http:"].includes(url.protocol) ? url.href : null; } catch { return null; } }

async function api(path) {
  const response = await window.RKSnapshot.fetch(path);
  let data; try { data = await response.json(); } catch { throw new Error(`The saved data returned an unreadable response (${response.status}).`); }
  if(!response.ok || data.error) throw new Error(describe(data.error) || `Request failed (${response.status}).`);
  return data;
}
function setError(message) { const el = $("#error-banner"); el.textContent = message || ""; el.hidden = !message; }
function toast(message) { const el=$("#toast");el.textContent=message;el.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{el.hidden=true;},4000); }
function updateConnection(connected) { const el=$("#connection-status");el.className=`connection ${connected?"":"offline"}`;el.innerHTML=`<span class="live-dot"></span>${connected?"Saved snapshot loaded":"Snapshot unavailable"}`; }
function signature(data) { const result=data.result || {}; return JSON.stringify([data.running,data.campaign,data.iterations?.length,data.iterations?.at?.(-1)?.id,result.id,result.created_at,result.parameters,result.score,result.summary,selectedIteration]); }
function acceptState(data,force=false) {
  if(data.state) data=data.state;
  if(!data.board && state?.board) data={...state,...data};
  state=data;
  window.SimulationWorkbench?.updateState(data);
  updateConnection(true);
  if(!parametersReady) setupParameters();
  if(!seriesInitialized && data.result?.waveforms?.series) {
    const preferred=new Set(["5V_SOC","VCC_3V3_SBC","VCC_DDR","VCC_1V8","VDD_CPU","VDD_LOGIC","RESETn"]);
    data.result.waveforms.series.forEach(s=>{if(!preferred.has(s.net || s.name))hiddenSeries.add(s.name);});
    seriesInitialized=true;
  }
  if(data.source_current===false)setError("The source check recorded at export did not match this result. Its original source identity is retained for historical inspection.");
  const key=signature(data);
  if(force || key!==lastSignature) {lastSignature=key;render();}
  updateActions();
}
async function refresh(force=false) {
  if(polling || requestBusy) return;
  polling=true;
  try {const data=await api("/api/state");if(selectedIteration!==null && state?.result)data.result=state.result;acceptState(data,force);} catch(error) {updateConnection(false);if(!state)setError(`${error.message} Reload the page to retry the published snapshot files.`);} finally{polling=false;}
}
function parameters() { const entries=[...new FormData($("#parameter-form")).entries()]; return Object.fromEntries(entries.map(([key,value])=>[key,key==="scenario"?value:Number(value)])); }
function setupParameters() {
  let schema=state.parameter_schema || {};
  if(Array.isArray(schema)) schema=Object.fromEntries(schema.map(item=>[first(item.key,item.name),item]));
  const defaults=state.defaults || {};
  const active=state.result?.parameters || {};
  const controls=baseControls.filter(c=>!c.optional || schema[c.key] || defaults[c.key]!==undefined || active[c.key]!==undefined).map(c=>{
    const server=schema[c.key] || {};
    return {...c,min:first(server.min,server.minimum,c.min),max:first(server.max,server.maximum,c.max),step:first(server.step,c.step),default:first(active[c.key],defaults[c.key],server.default,c.default,c.min)};
  });
  const html=c=>`<div class="control"><div class="control-header"><label for="${c.key}">${esc(c.label)}</label><div class="control-input"><input id="${c.key}" name="${c.key}" type="number" min="${c.min}" max="${c.max}" step="any" value="${c.default}" required aria-label="${esc(c.label)}"><span>${esc(c.unit)}</span></div></div><input type="range" data-control="${c.key}" min="${c.min}" max="${c.max}" step="any" value="${c.default}" data-precision="${Math.max(2,String(c.step).split('.')[1]?.length || 0)}" aria-label="${esc(c.label)} slider"><div class="control-bounds"><span>${esc(c.min)} ${esc(c.unit)}</span><span>${esc(c.max)} ${esc(c.unit)}</span></div></div>`;
  $("#primary-controls").innerHTML=controls.filter(c=>!c.advanced).map(html).join("");
  $("#advanced-controls").innerHTML=controls.filter(c=>c.advanced).map(html).join("");
  $("#scenario").value=first(active.scenario,defaults.scenario,"nominal");
  $$("input[type=range]",$("#parameter-form")).forEach(slider=>{paintSlider(slider);slider.addEventListener("input",()=>{const rounded=Number(Number(slider.value).toFixed(Number(slider.dataset.precision)));$(`#${slider.dataset.control}`).value=rounded;paintSlider(slider);markDirty();});});
  $$("input[type=number]",$("#parameter-form")).forEach(input=>input.addEventListener("input",()=>{const slider=$(`[data-control="${input.name}"]`);slider.value=input.value;paintSlider(slider);markDirty();}));
  $("#scenario").addEventListener("change",markDirty);
  $$("input, select", $("#parameter-form")).forEach(input=>{input.disabled=true;});
  $("#parameter-hint").textContent="These read-only conditions belong to the displayed saved run.";
  parametersReady=true;
}
function paintSlider(slider) { const percent=100*(Number(slider.value)-Number(slider.min))/(Number(slider.max)-Number(slider.min));slider.style.setProperty("--fill",`${Math.max(0,Math.min(100,percent))}%`); }
function markDirty() { inputsDirty=true;$("#parameter-hint").textContent="Conditions changed. Apply to compute new results."; }
function updateActions() {
  $("#run-button").disabled=requestBusy || !state;
  $("#apply-button").disabled=true;
  $("#campaign-button").disabled=true;
  $("#export-button").disabled=!state;
  $("#campaign-button").hidden=false;
  $("#stop-button").hidden=true;
  $("#parameter-panel").classList.remove("simulating");
  $("#campaign-status").textContent="Startup, load-step, and brownout results are retained in the saved history.";
}
async function selectIteration(id) {
  if(requestBusy)return;
  requestBusy=true;setError("");updateActions();
  try {const data=await api(`/api/iteration?id=${encodeURIComponent(id)}`);selectedIteration=id;parametersReady=false;inputsDirty=false;acceptState(data,true);$("#parameter-hint").textContent="These conditions belong to the saved iteration.";page="overview";location.hash="overview";render();toast(`Viewing saved iteration ${id}.`);}
  catch(error){selectedIteration=null;setError(error.message);}finally{requestBusy=false;updateActions();}
}

function render() {
  window.BoardView?.cleanup();
  window.TimeDomainEM?.cleanup();
  window.ProfessionalReview?.cleanup();
  window.SimulationWorkbench?.cleanup();
  window.SectionReview?.cleanup();
  window.ModelStudies?.cleanup();
  $("main").classList.toggle("board-page",page==="board");
  $("main").classList.toggle("em-page",page==="time-em");
  $("main").classList.toggle("professional-page",page==="professional");
  $("main").classList.toggle("workbench-page",page==="workbench");
  $("main").classList.toggle("sections-page",page==="sections");
  $("main").classList.toggle("models-page",page==="models");
  window.ProfessionalReview?.refreshStatus(state);
  $(".shell").classList.toggle("board-shell",page==="board");
  const board=state?.board || {};
  const revision=String(first(board.revision,"4")).replace(/^rev(?:ision)?\s*/i,"");
  $("#sidebar-revision").textContent=`Revision ${revision}`;
  $("#heading-revision").textContent=`REVISION ${revision}`;
  $("#component-count").textContent=first(board.counts?.components,board.components?.length,"—");
  $("#iteration-count").textContent=iterations().length;
  $("#footer-board").textContent=`${first(board.name,"RK3566 SBC")} · revision ${revision} · ${board.sha256?`PCB ${String(board.sha256).slice(0,12)}`:"design inventory loaded"}`;
  $("#model-stamp").textContent=board.sha256?`PCB ${String(board.sha256).slice(0,12)} · ${first(board.counts?.components,board.components?.length,"?")} components`:`${first(board.counts?.components,board.components?.length,"?")} design components loaded`;
  const timestamp=first(state.result?.generated_at,state.result?.created_at,state.result?.timestamp);
  $("#last-updated").textContent=`Snapshot exported ${window.RKSnapshot.dateLabel()}${timestamp?` · Result computed ${formatDate(timestamp)}`:""}`;
  $("#page-title").textContent=pageInfo[page][0];$("#page-subtitle").textContent=pageInfo[page][1];
  $$(".nav-link").forEach(link=>{link.classList.toggle("active",link.dataset.page===page);if(link.dataset.page===page)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");});
  $(".workbench").classList.toggle("no-parameters",["models","sections","workbench","professional","board","time-em","components","emi","iterations"].includes(page));
  renderMetrics();
  const content=$("#page-content");
  if(!hasResult() && !["models","sections","professional","board","time-em","components","emi"].includes(page)) {content.innerHTML=panel("Ready to simulate","The latest board inventory is loaded.",empty("Start with nominal conditions","Run a simulation to generate voltage, current, timing, and model-check results."));return;}
  const renderers={workbench:()=>window.SimulationWorkbench?.render(state) || empty("3D workspace unavailable","Reload the page to load the workbench."),professional:()=>window.ProfessionalReview?.render(state) || empty("Professional review unavailable","Reload the page to load the review."),"time-em":()=>window.TimeDomainEM?.render(state) || empty("Time-domain analysis unavailable","Reload the page to load the field viewer."),board:()=>window.BoardView?.render(state) || empty("Board explorer unavailable","Reload the page to load the native board viewer."),overview:renderOverview,power:renderPower,boot:renderBoot,components:renderComponents,emi:renderEMI,iterations:renderIterations};
  renderers.sections=()=>window.SectionReview.render();
  renderers.models=()=>window.ModelStudies.render();
  content.innerHTML=renderers[page]();
  if(isSuperseded() && !["time-em","professional"].includes(page))content.insertAdjacentHTML("afterbegin",`<div class="superseded-banner" role="status"><span>!</span><div><strong>Archived result · superseded simulation model</strong><p>${esc(describe(first(state.result.model_comparison_note,state.model_comparison_note)) || "These are the original results from an earlier engine. Their score is historical; run the current model to evaluate this condition with the latest physics.")}</p></div></div>`);
  bindContent();
  if(page==="board")window.BoardView?.mount(state);
  if(page==="time-em")window.TimeDomainEM?.mount(state);
  if(page==="professional")window.ProfessionalReview?.mount(state);
  if(page==="workbench")window.SimulationWorkbench?.mount(state,{onRunStart:()=>{requestBusy=true;updateActions();},onRunEnd:()=>{requestBusy=false;updateActions();},onState:next=>acceptState(next,true)});
  if(page==="sections")window.SectionReview.mount();
  if(page==="models")window.ModelStudies.mount(state);
}
function renderMetrics() {
  const score=scoreValues(), rails=currentRails(), board=state?.board || {};
  const valid=rails.filter(r=>isPass(r.status)).length;
  const results=asArray(state?.result?.components);
  const calculated=results.filter(c=>["calculated","partial"].includes(c.coverage)).length;
  const total=first(board.counts?.components,board.components?.length,results.length);
  const superseded=isSuperseded();
  const modelCaption=superseded?"Superseded model · original score":number(score.model)!==null && score.model>=score.target?"Behavioral target reached":"Checks of this operating condition";
  const cards=[
    {label:superseded?"Model checks · historical":"Model checks",value:fmt(score.model,1),suffix:"/ 10",icon:"✓",caption:modelCaption,fill:score.model*10,amber:superseded},
    {label:"Hardware evidence",value:fmt(score.evidence,1),suffix:"/ 10",icon:"◇",caption:"Boot and EMC measurements pending",amber:true},
    {label:"Steady rails in range",value:hasResult()?String(valid):"—",suffix:`/ ${rails.length || "—"}`,icon:"ϟ",caption:rails.length?`Final window · ${rails.length-valid} outside limits`:"Awaiting model results",amber:rails.length>valid},
    {label:"Component coverage",value:hasResult()?String(calculated):"—",suffix:`/ ${total || "—"}`,icon:"▦",caption:"Calculated or partially modeled"},
  ];
  $("#metric-cards").innerHTML=cards.map(c=>`<article class="metric-card"><div class="metric-top">${c.label}</div><span class="metric-icon">${c.icon}</span><div class="metric-value">${esc(c.value)}<small>${esc(c.suffix)}</small></div><div class="metric-caption ${c.amber?"amber":""}"><span class="dot"></span>${esc(c.caption)}</div>${c.fill?`<div class="score-mini" title="${esc(c.value)} out of 10"><span style="width:${Math.min(100,c.fill)}%"></span></div>`:""}</article>`).join("");
}
function iterationNotice() {
  if(selectedIteration!==null)return `<div class="overview-iteration"><span class="live-dot"></span><div><strong>Saved iteration ${esc(selectedIteration)}</strong><p>Showing the original result and operating conditions.</p></div><button class="panel-link" id="return-current">Return to published result ↗</button></div>`;
  const count=iterations().length;if(!count)return "";
  return `<div class="overview-iteration"><span class="live-dot"></span><div><strong>${"Simulation evidence retained"}</strong><p>${count} ${count===1?"iteration":"iterations"} available for comparison. Failed corners remain visible.</p></div><a href="#iterations" class="panel-link">View history ↗</a></div>`;
}
function renderOverview() {
  const rails=currentRails(), checks=asArray(state.result.checks);
  const important=[...checks.filter(c=>!isPass(c.status)),...checks.filter(c=>isPass(c.status))].slice(0,5);
  return waveformPanel()+`<div class="section-row">${panel("Rail health","Steady-state operating points",`<div class="rail-summary">${rails.slice(0,7).map((r,i)=>`<div class="rail-row"><span class="rail-dot" style="--trace:${COLORS[i%COLORS.length]}"></span><span class="rail-name" title="${esc(r.net)}">${esc(r.net)}</span><span class="rail-reading">${fmt(r.steady_v,3)} V<small>nom. ${fmt(r.nominal_v,2)} V</small></span>${badge(r.status)}</div>`).join("") || empty("No rail model","Rail models were not returned by the engine.")}</div>`,`<a href="#power" class="panel-link">All rails ↗</a>`)}${panel("Validation checks","What this run establishes",`<div class="check-list">${important.map(checkRow).join("") || empty("No checks available","Run the simulation to generate validation checks.")}</div>`,`<a href="#boot" class="panel-link">Details ↗</a>`)}</div>`+iterationNotice();
}
function checkRow(check) { const cls=statusClass(check.status),icon=cls==="pass"?"✓":cls==="fail"?"×":cls==="warning"?"!":"?";return `<div class="check-item"><span class="check-icon ${cls}">${icon}</span><div class="check-copy"><strong>${esc(first(check.title,check.name,check.id,"Model check"))}</strong><p>${esc(describe(first(check.detail,check.notes,check.description,check.status)))}</p></div></div>`; }

function waveformData() {
  const waves=state?.result?.waveforms || {},times=asArray(first(waves.time_ms,waves.times_ms,waves.time));
  let series=asArray(waves.series);
  if(!series.length && waves.voltages)series=Object.entries(waves.voltages).map(([name,values])=>({name,values,unit:"V"}));
  return {times:times.map(Number),series:series.filter(s=>Array.isArray(s.values)).map((s,i)=>({...s,color:COLORS[i%COLORS.length],name:first(s.name,s.net,`Series ${i+1}`),unit:s.unit || "V"}))};
}
function waveformPanel() {
  const {times,series}=waveformData();
  const filtered=series.filter(s=>chartMode==="current"?s.unit.toLowerCase()==="a":s.unit.toLowerCase()==="v");
  const count=filtered.length;
  const active=filtered.filter(s=>!hiddenSeries.has(s.name));
  const traceButton=s=>`<button class="legend-toggle ${hiddenSeries.has(s.name)?"inactive":""}" data-series="${esc(s.name)}" aria-pressed="${!hiddenSeries.has(s.name)}"><span class="legend-line" style="--trace:${s.color}"></span>${esc(s.name)}</button>`;
  const toolbar=`<div class="chart-toolbar"><button class="chart-mode ${chartMode==="voltage"?"active":""}" data-chart-mode="voltage">Voltage</button><button class="chart-mode ${chartMode==="current"?"active":""}" data-chart-mode="current">Current</button><details class="trace-picker"><summary>Signals (${active.length}/${filtered.length}) ⌄</summary><div class="trace-options">${filtered.map(traceButton).join("")}</div></details><span class="chart-range">${times.length?`${fmt(times[0],0)} — ${fmt(times.at(-1),0)} ms`:"No samples"}</span></div>`;
  const chart=count && times.length?`<div class="chart-wrap">${chartSvg(times,filtered)}<div class="tooltip" id="chart-tooltip" hidden></div></div><div class="chart-legend">${active.map(traceButton).join("") || '<span class="tiny-note">Select a signal from the Signals menu to display its trace.</span>'}</div>`:`<div class="empty-chart">No ${esc(chartMode)} waveforms are available for this model.</div>`;
  return panel("Transient response","Startup → steady state · computed time-domain traces",toolbar+chart+`<div class="chart-footnote"><span><span class="live-dot"></span>${esc(human(first(state?.result?.parameters?.scenario,"nominal")))} scenario · ${times.length.toLocaleString()} samples</span><span>Hover to inspect · select signals to compare</span></div>`,badge("info",`Δt ${engineering(number(state?.result?.parameters?.dt_ms)===null?null:state.result.parameters.dt_ms*.001,"s")}`));
}
function chartSvg(times,series) {
  const visible=series.filter(s=>!hiddenSeries.has(s.name));
  const w=720,h=266,p={l:49,r:20,t:24,b:38},plotW=w-p.l-p.r,plotH=h-p.t-p.b;
  const values=visible.flatMap(s=>s.values.filter(v=>number(v)!==null).map(Number));
  const low=Math.min(0,...values),rawMax=Math.max(.1,...values),range=rawMax-low;
  const magnitude=Math.pow(10,Math.floor(Math.log10(range || 1)));
  const tick=Math.max(magnitude/5,Math.ceil(range/4/(magnitude/5))*(magnitude/5));
  const min=Math.floor(low/tick)*tick,max=Math.ceil((rawMax+range*.07)/tick)*tick;
  const firstTime=times[0] || 0,lastTime=times.at(-1) || 1;
  const x=t=>p.l+(t-firstTime)/(lastTime-firstTime || 1)*plotW;
  const y=v=>p.t+plotH-(v-min)/(max-min || 1)*plotH;
  const yTicks=Array.from({length:5},(_,i)=>min+(max-min)*i/4);
  const xTicks=Array.from({length:6},(_,i)=>firstTime+(lastTime-firstTime)*i/5);
  let svg=`<svg class="waveform-chart" id="waveform-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(chartMode)} waveforms over time" data-left="${p.l}" data-right="${w-p.r}" data-first="${firstTime}" data-last="${lastTime}"><defs><clipPath id="plot-clip"><rect x="${p.l}" y="${p.t}" width="${plotW}" height="${plotH}"/></clipPath></defs>`;
  svg+=yTicks.map(v=>`<line x1="${p.l}" y1="${y(v)}" x2="${w-p.r}" y2="${y(v)}" stroke="#eaf0f3" stroke-dasharray="3 4"/><text x="${p.l-11}" y="${y(v)+3}" text-anchor="end" fill="#95a8b2" font-size="9" font-family="ui-monospace,monospace">${fmt(v,max<.1?3:max<1?2:1)}</text>`).join("");
  svg+=xTicks.map(v=>`<line x1="${x(v)}" y1="${p.t}" x2="${x(v)}" y2="${h-p.b}" stroke="#f0f4f6"/><text x="${x(v)}" y="${h-18}" text-anchor="middle" fill="#95a8b2" font-size="9" font-family="ui-monospace,monospace">${fmt(v,0)}</text>`).join("");
  svg+=`<text x="${p.l-17}" y="12" fill="#879faa" font-size="9">${chartMode==="voltage"?"V":"A"}</text><text x="${w-p.r+1}" y="${h-5}" fill="#99aab4" font-size="9" text-anchor="end">Time (ms)</text>`;
  const reset=number(state?.result?.parameters?.reset_release_ms);
  if(reset!==null && reset>=firstTime && reset<=lastTime)svg+=`<line x1="${x(reset)}" y1="${p.t}" x2="${x(reset)}" y2="${h-p.b}" stroke="#b8cbd3" stroke-dasharray="4 4"/><text x="${Math.min(x(reset)+6,w-99)}" y="16" fill="#a0b0b8" font-size="8">RESET RELEASE</text>`;
  svg+=`<g clip-path="url(#plot-clip)">`;
  for(const s of visible) {const step=Math.max(1,Math.floor(times.length/750));let path="",segment=false;for(let i=0;i<times.length;i+=step){const v=number(s.values[i]);if(v===null){segment=false;continue;}path+=`${segment?"L":"M"}${x(times[i]).toFixed(2)},${y(v).toFixed(2)} `;segment=true;}const last=number(s.values[times.length-1]);if(last!==null&&segment)path+=`L${x(lastTime).toFixed(2)},${y(last).toFixed(2)}`;svg+=`<path d="${path}" stroke="${s.color}" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`;}
  svg+=`</g><line id="chart-cursor" x1="0" x2="0" y1="${p.t}" y2="${h-p.b}" stroke="#6d959f" stroke-dasharray="2 3" visibility="hidden"/><rect id="chart-hit" x="${p.l}" y="${p.t}" width="${plotW}" height="${plotH}" fill="transparent"/></svg>`;
  return svg;
}
function bindChart() {
  const svg=$("#waveform-svg"),hit=$("#chart-hit"),tip=$("#chart-tooltip"),cursor=$("#chart-cursor");if(!svg || !hit)return;
  hit.addEventListener("pointermove",event=>{
    const box=svg.getBoundingClientRect(),x=(event.clientX-box.left)*720/box.width;
    const {times,series}=waveformData();
    const fraction=Math.max(0,Math.min(1,(x-Number(svg.dataset.left))/(Number(svg.dataset.right)-Number(svg.dataset.left))));
    const target=times[0]+fraction*(times.at(-1)-times[0]);
    let lo=0,hi=times.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(times[mid]<target)lo=mid+1;else hi=mid;}
    const index=lo>0 && Math.abs(times[lo-1]-target)<Math.abs(times[lo]-target)?lo-1:lo;
    const filtered=series.filter(s=>!hiddenSeries.has(s.name) && (chartMode==="current"?s.unit.toLowerCase()==="a":s.unit.toLowerCase()==="v"));
    tip.innerHTML=`<strong>${fmt(times[index],2)} ms</strong>${filtered.slice(0,12).map(s=>`<div class="tooltip-row"><span style="color:${s.color}">${esc(s.name)}</span><span>${number(s.values[index])===null?"Unknown":`${fmt(s.values[index],3)} ${esc(s.unit)}`}</span></div>`).join("")}`;
    tip.hidden=false;tip.style.top="24px";tip.style.left=`${Math.max(0,Math.min(box.width-210,(event.clientX-box.left)+14))}px`;
    cursor.setAttribute("x1",String(x));cursor.setAttribute("x2",String(x));cursor.setAttribute("visibility","visible");
  });
  hit.addEventListener("pointerleave",()=>{tip.hidden=true;cursor.setAttribute("visibility","hidden");});
}
function renderPower() {
  const rails=currentRails();
  const body=`<div class="table-wrap"><table><thead><tr><th>Rail</th><th>Nominal</th><th>Steady</th><th>Min. steady</th><th>Maximum</th><th>Window peak current</th><th>Steady current</th><th>Check</th></tr></thead><tbody>${rails.map(r=>`<tr><td><strong class="mono">${esc(r.net)}</strong><div class="rail-note">${esc(describe(r.model))}</div></td><td>${reading(r.nominal_v,"V")}</td><td>${reading(r.steady_v,"V")}</td><td>${reading(r.min_steady_v,"V")}</td><td>${reading(r.max_v,"V")}</td><td>${reading(r.peak_current_a,"A")}</td><td>${reading(r.steady_current_a,"A")}</td><td>${badge(r.status)}</td></tr>`).join("")}</tbody></table></div><div class="table-note">Rail currents are model estimates under the selected load assumptions. Peak current covers the full simulation window. Unknown component currents remain unassigned. Steady-state limits exclude the initial voltage ramp.</div>`;
  const notes=rails.filter(r=>describe(r.notes)).map(r=>({title:r.net,detail:describe(r.notes),status:r.status}));
  return waveformPanel()+panel("Rail operating points",`${rails.length} modeled supplies · voltage and current estimates`,body)+spicePanel()+panel("Model notes","Per-rail assumptions and limitations",`<div class="check-list">${notes.map(checkRow).join("") || empty("No extra notes","Review the exported model for the assumptions used by the engine.")}</div>`);
}
function renderBoot() {
  const boot=currentBoot();
  const max=Math.max(1,...boot.map(s=>number(s.end_ms)??number(s.start_ms)??0));
  const timeline=`<div class="timeline"><div class="timeline-scale">${[0,.25,.5,.75,1].map(t=>`<span>${fmt(max*t,0)} ms</span>`).join("")}</div>${boot.map(stage=>{const start=number(stage.start_ms),end=number(stage.end_ms);return `<div class="timeline-row"><div class="timeline-name" title="${esc(stage.name)}">${esc(stage.name)}</div><div class="timeline-track">${start===null?'<span class="unknown-text">Timing unverified</span>':`<div class="timeline-bar ${statusClass(stage.status)}" style="left:${100*start/max}%;width:${Math.max(.5,100*((end??start)-start)/max)}%" title="${esc(stage.detail)}"><span>${fmt(start,1)}${end!==null?`–${fmt(end,1)}`:""} ms</span></div>`}</div></div>`;}).join("")}</div>`;
  const requirements=asArray(state.audit?.boot_requirements);
  return panel("Modeled startup timeline","Behavioral timing · the SoC has not executed firmware",timeline,badge("unverified","Boot execution unverified"))+panel("Sequence checkpoints","Events, prerequisites, and the limits of each conclusion",`<div class="insight-banner"><span>!</span><div><strong>A passing power sequence does not establish a successful boot.</strong><p>Clock quality, reset thresholds, PMIC programming, DDR training, storage contents, and firmware execution need device models or hardware evidence.</p></div></div><div class="boot-detail">${boot.map((s,i)=>`<div class="boot-stage"><span class="stage-index">${String(i+1).padStart(2,"0")}</span><div class="stage-copy"><h3>${esc(s.name)}${badge(s.status)}</h3><p>${esc(describe(s.detail))}</p></div><span class="stage-time">${number(s.start_ms)===null?"Unverified":`${fmt(s.start_ms,1)} ms`}</span></div>`).join("")}</div>`)+panel("Boot evidence checklist","Requirements from the design audit",`<div class="check-list">${requirements.map(r=>checkRow(typeof r==="string"?{title:r,status:"unverified"}:r)).join("") || empty("Evidence checklist unavailable","See the model boundaries for the remaining boot-verification work.")}</div>`);
}

function allComponents() {
  const board=asArray(state?.board?.components), modeled=asArray(state?.result?.components), index=new Map(modeled.map(c=>[c.ref,c]));
  const combined=board.map(c=>({...c,...index.get(c.ref),inventory:c}));
  const seen=new Set(combined.map(c=>c.ref));
  return [...combined,...modeled.filter(c=>!seen.has(c.ref))].sort((a,b)=>String(a.ref).localeCompare(String(b.ref),undefined,{numeric:true}));
}
function componentState(c) { return c.coverage || (c.dnp?"excluded":"unmodeled"); }
function componentValues(c) { return {startupV:first(c.startup?.voltage_v,c.startup_voltage_v),startupI:first(c.startup?.current_a,c.peak_current_a,c.startup_current_a),steadyV:first(c.steady?.voltage_v,c.steady_voltage_v),steadyI:first(c.steady?.current_a,c.steady_current_a),steadyP:first(c.steady?.power_w,c.power_w)}; }
function componentRows() {
  const search=componentSearch.toLowerCase().trim();
  const components=allComponents().filter(c=>(componentFilter==="all" || componentState(c)===componentFilter) && (!search || [c.ref,c.value,c.mpn,c.kind,c.model,...asArray(c.pins).map(p=>typeof p==="object"?p.net:p)].map(describe).join(" ").toLowerCase().includes(search)));
  const rows=components.slice(0,componentLimit).map(c=>{
    const v=componentValues(c),coverage=componentState(c);
    return `<tr class="component-row" tabindex="0" role="button" aria-expanded="${expandedComponent===c.ref}" data-component="${esc(c.ref)}" aria-label="Inspect ${esc(c.ref)}"><td class="component-ref mono">${esc(c.ref)} <span style="font-size:8px;color:#9fb1b9">${expandedComponent===c.ref?"−":"+"}</span></td><td><div class="component-title">${esc(first(c.value,c.kind,"Unspecified component"))}<small>${esc(first(c.mpn,c.kind,""))}</small></div></td><td>${reading(v.startupV,"V")}</td><td>${reading(v.steadyV,"V")}</td><td>${reading(v.startupI,"A",4)}</td><td>${reading(v.steadyI,"A",4)}</td><td>${badge(coverage,coverage==="unmodeled"?"Not modeled":human(coverage))}</td></tr>${expandedComponent===c.ref?componentDetails(c):""}`;
  }).join("");
  return {rows:rows || `<tr><td colspan="7">${empty("No matching components","Try a reference, part number, value, or connected net.")}</td></tr>`,count:components.length,more:components.length>componentLimit};
}
function componentDetails(c) {
  const v=componentValues(c), pins=asArray(c.pins);
  const pinText=pins.map(p=>typeof p==="object"?`${first(p.pin,p.number,"?")}: ${first(p.net,p.name,"unassigned")}${number(p.steady_v)!==null?` (${fmt(p.steady_v,3)} V)`:""}`:describe(p)).join(" · ");
  const facts=[["Model",describe(c.model)||"No model available"],["Steady power",number(v.steadyP)===null?"Unknown":engineering(v.steadyP,"W")],["Assembly",c.dnp?"Do not populate":c.placed===false?"Placement unverified":"In design inventory"],["Part number",c.mpn||"Not specified"],["Component class",c.kind||"Not classified"],["Connected pins",pinText||"Pin-level model unavailable"]];
  const stress=c.stress?`<div class="component-stress"><strong>Component stress assessment</strong>${badge(c.stress.status)}<p>${esc(describe(c.stress.detail))}</p></div>`:"";
  return `<tr class="component-detail"><td colspan="7"><dl class="detail-grid">${facts.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl><p class="detail-note">${esc(describe(c.notes) || "No per-component current model is available. The model does not substitute zero for unknown values.")}</p>${stress}</td></tr>`;
}
function renderComponents() {
  const data=componentRows();
  return panel("Design component inventory",`${allComponents().length} components · click a row for pin voltages and modeling notes`,`<div class="search-toolbar"><div class="search-box"><span>⌕</span><input type="search" id="component-search" placeholder="Search reference, value, part number, or net…" value="${esc(componentSearch)}" aria-label="Search components"></div><select id="component-filter" aria-label="Filter by model coverage">${[["all","All coverage"],["calculated","Calculated"],["partial","Partial"],["unmodeled","Not modeled"],["excluded","Excluded / DNP"]].map(([value,label])=>`<option value="${value}" ${value===componentFilter?"selected":""}>${label}</option>`).join("")}</select></div><div class="table-wrap"><table><thead><tr><th>Reference</th><th>Component</th><th>Startup voltage</th><th>Steady voltage</th><th>Startup current</th><th>Steady current</th><th>Model coverage</th></tr></thead><tbody id="component-rows">${data.rows}</tbody></table></div><div id="component-more">${componentMore(data)}</div><div class="table-note">Unknown values mean the model has insufficient evidence to calculate them. A known pin voltage does not establish a component’s internal current. Component voltage is the model’s defined terminal voltage; inspect each row for connected pin voltages.</div>`,badge("info",`${data.count} results`));
}
function componentMore(data) { return data.more?`<div class="load-more"><button class="button secondary" id="load-more-components">Show next ${Math.min(60,data.count-componentLimit)} components <span>↓</span></button></div>`:""; }
function refreshComponents() { const data=componentRows();$("#component-rows").innerHTML=data.rows;$("#component-more").innerHTML=componentMore(data);const count=$("#page-content .panel-heading .badge");if(count)count.textContent=`${data.count} results`;bindComponentRows(); }
function bindComponentRows() { $$('[data-component]').forEach(row=>{const toggle=()=>{expandedComponent=expandedComponent===row.dataset.component?null:row.dataset.component;refreshComponents();};row.addEventListener("click",toggle);row.addEventListener("keydown",event=>{if(["Enter"," "].includes(event.key)){event.preventDefault();toggle();}});});$("#load-more-components")?.addEventListener("click",()=>{componentLimit+=60;refreshComponents();}); }

function renderEMI() {
  const emi=state?.result?.emi || {},audit=state?.audit || {},converters=asArray(emi.converters),tests=asArray(emi.emc_tests);
  const converterTable=converters.length?`<div class="table-wrap"><table><thead><tr><th>Converter / rail</th><th>Frequency</th><th>Inductance</th><th>Inductor ΔI p-p</th><th>Output ripple p-p</th><th>Capacitor RMS</th><th>Ripple screen</th></tr></thead><tbody>${converters.map(c=>`<tr><td><strong class="mono">${esc(c.ref)}</strong><div class="rail-note">${esc(c.net)}</div></td><td class="mono">${engineering(c.frequency_hz,"Hz")}</td><td class="mono">${engineering(c.inductance_h,"H")}</td><td class="mono">${engineering(c.delta_i_pp_a,"A")}</td><td class="mono">${engineering(c.ripple_v_pp,"V")}</td><td class="mono">${engineering(c.capacitor_rms_a,"A")}</td><td>${badge(c.status)}</td></tr>`).join("")}</tbody></table></div><details class="spice-details"><summary>Converter assumptions and operating modes <span>⌄</span></summary><div class="check-list">${converters.map(c=>checkRow({title:`${c.ref} · ${c.net}`,status:c.status,detail:c.notes})).join("")}</div></details><div class="table-note">Lumped switching estimates use the model’s inductance, frequency, capacitance, and load assumptions. They do not include a calibrated radiated or conducted emissions transfer function.</div>`:empty("Switching estimates unavailable","Run a simulation to inspect modeled converter ripple and switching conditions.");
  const findings=getFindings().filter(f=>["geometry","circuit","source_gap"].includes(f.kind) || /emi|emc|ground|return|differential|impedance|routing/i.test(describe(f)));
  const sources=asArray(audit.sources);
  return panel("EMC evidence status","Electrical risk review and laboratory test coverage",`<div class="insight-banner"><span>!</span><div><strong>${esc(describe(emi.summary)||"EMC compliance remains unverified.")}</strong><p>Measured conducted emissions, radiated emissions, immunity, and ESD are required to evaluate applicable limits.</p></div></div><div class="check-list">${tests.map(t=>checkRow({title:t.name,status:t.status || "unverified",detail:t.required_evidence})).join("") || checkRow({title:"Physical EMC testing",status:"unverified",detail:"No calibrated emissions or immunity measurements are available in this simulation."})}</div>`,badge("unverified","Measurements pending"))+panel("Switching and ripple estimates","Analytical estimates from the active operating condition",converterTable)+panel("Design audit findings",`${findings.length} relevant findings from the actual board audit`,`<div class="findings">${findings.slice(0,30).map(findingCard).join("") || empty("No structured findings available","Inspect the exported audit for any layout or source-model constraints.")}</div>`)+panel("Source references","Design files and primary documentation used in the review",`<div class="sources-list">${sources.map(sourceLink).join("") || '<p class="tiny-note">Source references are retained in the exported audit.</p>'}</div>`);
}
function spicePanel() {
  const spice=state?.spice;
  if(!spice)return "";
  const cases=asArray(spice.cases),checks=asArray(spice.checks),passed=checks.filter(c=>isPass(c.status)).length;
  const firstCase=cases[0] || {};
  const summary=`<div class="emi-values"><div class="fact-card"><div class="fact-label">Reference output voltage</div><div class="fact-value">${reading(firstCase.steady_v,"V",4)}</div><div class="fact-caption">${esc(firstCase.label || "Reference case")}</div></div><div class="fact-card"><div class="fact-label">Output ripple, peak to peak</div><div class="fact-value">${reading(firstCase.ripple_mv,"mV",3)}</div><div class="fact-caption">Independent switched-network calculation</div></div></div>`;
  const details=`<details class="spice-details"><summary>View ${cases.length} SPICE cases and ${checks.length} checks <span>⌄</span></summary><div class="table-wrap"><table><thead><tr><th>Case</th><th>Output</th><th>Ripple p-p</th><th>Inductor ripple p-p</th><th>Peak current</th></tr></thead><tbody>${cases.map(c=>`<tr><td class="line-break">${esc(c.label)}</td><td>${reading(c.steady_v,"V",4)}</td><td>${reading(c.ripple_mv,"mV",3)}</td><td>${reading(c.inductor_ripple_a,"A",4)}</td><td>${reading(c.peak_current_a,"A",4)}</td></tr>`).join("")}</tbody></table></div><div class="check-list">${checks.map(checkRow).join("")}</div><div class="table-note">${asArray(spice.limitations).map(l=>esc(describe(l))).join(" ")}</div></details>`;
  return panel("Independent SPICE check",describe(spice.engine),`<div class="spice-scope">${esc(describe(spice.scope))}</div>${summary}${details}`,badge(checks.length && passed===checks.length?"pass":"unverified",checks.length?`${passed}/${checks.length} checks`:spice.status || "Unverified"));
}
function findingCard(f) { const title=first(f.title,f.name,f.id,"Audit finding"),evidence=asArray(f.evidence).map(e=>first(e.path,e.source_id,e.section)).filter(Boolean);return `<article class="finding"><div class="finding-head">${badge(f.severity || f.status || "warning")}<h3>${esc(title)}</h3></div><p>${esc(describe(first(f.detail,f.description)))}</p>${f.action?`<p style="margin-top:7px">${esc(describe(f.action))}</p>`:""}${evidence.length?`<p class="tiny-note" style="margin-top:7px">Source: ${esc(evidence.join(" · "))}</p>`:""}</article>`; }
function sourceLink(source) { if(typeof source==="string")return `<div class="source-link"><span>↗</span>${esc(source)}</div>`;const url=safeUrl(first(source.url,source.href)),title=first(source.title,source.name,source.id,source.path,url,"Source reference");return `<div class="source-link"><span>↗</span>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`:`<span style="color:#648694">${esc(title)}${source.path?` · ${esc(source.path)}`:""}</span>`}</div>`; }
function formatDate(value) { const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"}); }

function iterationScore(item) { return number(typeof item.score==="object"?first(item.score.behavioral,item.score.model):first(item.score,item.behavioral_score)); }
function iterationEvidence(item) { return number(first(item.hardware_score,item.evidence_score,typeof item.score==="object"?item.score.evidence:null)); }
function failedCheckText(item) { return typeof item.failed_checks==="number"?`${item.failed_checks} failed model ${item.failed_checks===1?"check":"checks"}`:asArray(item.failed_checks).map(c=>typeof c==="string"?c:first(c.title,c.id,c.name)).join(" · "); }
function renderIterations() {
  const history=iterations(),current=history.filter(i=>!isSuperseded(i)),scores=current.map(iterationScore).filter(v=>v!==null),best=scores.length?Math.max(...scores):null;
  const met=current.filter(i=>(iterationScore(i)??-1)>=8).length;
  const summary=`<div class="iteration-summary"><div class="fact-card"><div class="fact-label">Conditions evaluated</div><div class="fact-value">${history.length}</div><div class="fact-caption">${history.length-current.length} superseded · every result retained</div></div><div class="fact-card"><div class="fact-label">Highest current-model score</div><div class="fact-value">${fmt(best,1)} <small>/ 10</small></div><div class="fact-caption">Behavioral validation only</div></div><div class="fact-card"><div class="fact-label">Current-model conditions ≥ 8</div><div class="fact-value">${met} <small>/ ${current.length}</small></div><div class="fact-caption">Failed stress corners remain visible</div></div></div>`;
  const rows=history.slice().reverse().map((item,index)=>{const params=item.parameters || {},id=first(item.id,item.index,history.length-index),superseded=isSuperseded(item);return `<tr class="${selectedIteration===id?"iteration-current":""} ${superseded?"superseded-row":""}"><td class="mono">${esc(first(item.index,id))}</td><td class="line-break"><strong>${esc(first(item.label,human(params.scenario),"Simulation"))}</strong><div class="rail-note">${esc(formatDate(item.created_at || item.timestamp || ""))}</div>${superseded?'<div style="margin-top:6px">'+badge("warning","Superseded model")+'</div>':""}</td><td class="mono">${fmt(params.vin_v,2)} V<br><span class="tiny-note">${fmt(params.load_scale,2)}× load</span></td><td class="mono">${fmt(iterationScore(item),1)} / 10${superseded?'<div class="tiny-note">Historical score</div>':""}</td><td class="mono">${fmt(iterationEvidence(item),1)} / 10</td><td>${badge(superseded?"unknown":item.status || ((iterationScore(item)??0)>=8?"pass":"warning"),superseded?`Original: ${human(item.status||"unverified")}`:null)}<div class="rail-note">${esc(failedCheckText(item))}</div></td><td><button class="panel-link" data-iteration="${esc(id)}">Inspect ↗</button></td></tr>`;}).join("");
  const historyTable=history.length?`<div class="table-wrap"><table><thead><tr><th>Run</th><th>Condition</th><th>Inputs</th><th>Model checks</th><th>Hardware evidence</th><th>Result</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-note">The score measures stated model checks. Changing load, supply, or capacitance assumptions explores operating conditions; it does not change the manufactured circuit or create missing hardware evidence.</div>`:empty("Your first iteration starts here","Run a simulation or start the validation sweep to create a reproducible history.");
  const score=scoreValues(),criteria=score.criteria;
  return panel("Validation campaign",state.campaign?.stop_reason?describe(state.campaign.stop_reason):"Bounded parameter sweep · target 8 out of 10",summary+iterationGraph(history),badge(state.running?"running":"info",state.running?"Running":"History retained"))+panel("All simulation iterations","Select a result to inspect its original waveforms and checks",historyTable)+panel("How the model-check score is defined","Scoring criteria returned by the simulation engine",`<div class="table-wrap"><table class="wide-cells"><thead><tr><th>Criterion</th><th>Weight</th><th>Earned</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${criteria.map(c=>`<tr><td>${esc(first(c.title,c.name,human(c.id)))}</td><td class="mono">${fmt(c.weight,2)}</td><td class="mono">${fmt(c.earned,2)}</td><td>${badge(c.status)}</td><td>${esc(describe(c.detail))}</td></tr>`).join("") || '<tr><td colspan="5">No structured score criteria were returned.</td></tr>'}</tbody></table></div><div class="table-note">${esc(describe(score.scope)||"Hardware evidence is scored separately. Unmodeled currents, actual SoC boot, and EMC measurements cannot be inferred from a high behavioral score.")}</div>`);
}
function iterationGraph(history) {
  if(history.length<2)return "";
  const width=900,left=48,right=24,top=20,bottom=143;
  const x=i=>left+i/Math.max(1,history.length-1)*(width-left-right),y=v=>bottom-v/10*(bottom-top);
  const model=history.map((item,i)=>({x:x(i),y:iterationScore(item),old:isSuperseded(item)})).filter(p=>p.y!==null && !p.old),evidence=history.map((item,i)=>({x:x(i),y:iterationEvidence(item),old:isSuperseded(item)})).filter(p=>p.y!==null && !p.old),legacy=history.map((item,i)=>({x:x(i),y:iterationScore(item),old:isSuperseded(item)})).filter(p=>p.y!==null && p.old);
  const path=points=>points.map((p,i)=>`${i?"L":"M"}${p.x.toFixed(2)},${y(p.y).toFixed(2)}`).join(" ");
  return `<div class="iteration-chart"><svg viewBox="0 0 ${width} 185" role="img" aria-label="Current model scores and separately marked superseded historical scores">${[0,2,4,6,8,10].map(v=>`<line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}" stroke="${v===8?"#a6c4bd":"#e9f0f3"}" stroke-dasharray="${v===8?"5 4":"2 3"}"/><text x="${left-13}" y="${y(v)+3}" font-size="9" fill="#9bb0bb" text-anchor="end">${v}</text>`).join("")}<text x="${width-right}" y="${y(8)-6}" font-size="8" fill="#7d9f96" text-anchor="end">TARGET 8</text><path d="${path(model)}" fill="none" stroke="#188c87" stroke-width="2"/><path d="${path(evidence)}" fill="none" stroke="#c7a165" stroke-width="1.7"/>${model.map(p=>`<circle cx="${p.x}" cy="${y(p.y)}" r="3" fill="#188c87"/>`).join("")}${legacy.map(p=>`<circle cx="${p.x}" cy="${y(p.y)}" r="3.5" fill="#f7fafb" stroke="#9cabb4" stroke-width="1.5"/>`).join("")}${history.map((item,i)=>history.length<20||i%Math.ceil(history.length/16)===0?`<text x="${x(i)}" y="161" text-anchor="middle" fill="#98aeb9" font-size="8">${esc(first(item.index,i+1))}</text>`:"").join("")}<text x="${width-right}" y="180" text-anchor="end" font-size="8" fill="#a1b0b8">ITERATION</text></svg><div class="chart-legend" style="padding:0 0 0 29px"><span class="legend-toggle"><span class="legend-line" style="--trace:#188c87"></span>Current model checks</span><span class="legend-toggle"><span class="legend-line" style="--trace:#c7a165"></span>Hardware evidence</span>${legacy.length?'<span class="legend-toggle"><span class="legend-line" style="--trace:#9cabb4"></span>Superseded model</span>':""}</div></div>`;
}

function evidenceDialog() {
  const audit=state?.audit || {},score=scoreValues(),limitations=asArray(audit.limitations);
  $("#evidence-body").innerHTML=`<div class="evidence-section"><p>The simulation uses the board inventory and explicit behavioral assumptions to estimate electrical behavior. Each component’s coverage and every failed model check remain visible.</p><div class="evidence-score"><strong>${fmt(score.model,1)} / 10</strong><p><b>Model checks</b><br>Checks of the simulated operating condition and the implemented behavioral model.</p></div><div class="evidence-score"><strong>${fmt(score.evidence,1)} / 10</strong><p><b>Hardware evidence</b><br>Documentation, model coverage, and physical verification. A behavioral score does not fill evidence gaps.</p></div><h3>Model boundaries</h3><ul class="evidence-list">${(limitations.length?limitations:["Unmodeled per-component currents and internal behavior are unknown.","The RK3566 has not executed boot ROM, DDR training, or firmware in this behavioral model.","EMI estimates are not calibrated conducted or radiated emissions measurements.","EMC immunity and emissions require appropriate physical tests."]).map(l=>`<li>${esc(describe(l))}</li>`).join("")}</ul><h3>Traceability</h3><p>Export results to retain the active parameters, board identity, complete component inventory, model scores, audit findings, and iteration history.</p><div class="sources-list" style="padding:0">${asArray(audit.sources).slice(0,8).map(sourceLink).join("")}</div></div>`;
  $("#evidence-dialog").showModal();
}
function bindContent() {
  $$('[data-chart-mode]').forEach(button=>button.addEventListener("click",()=>{chartMode=button.dataset.chartMode;render();}));
  $$('[data-series]').forEach(button=>button.addEventListener("click",()=>{const name=button.dataset.series;if(hiddenSeries.has(name))hiddenSeries.delete(name);else hiddenSeries.add(name);render();}));
  $$('[data-iteration]').forEach(button=>button.addEventListener("click",()=>selectIteration(button.dataset.iteration)));
  $("#return-current")?.addEventListener("click",()=>{selectedIteration=null;parametersReady=false;inputsDirty=false;refresh(true);});
  $("#component-search")?.addEventListener("input",event=>{componentSearch=event.target.value;componentLimit=60;expandedComponent=null;refreshComponents();});
  $("#component-filter")?.addEventListener("change",event=>{componentFilter=event.target.value;componentLimit=60;expandedComponent=null;refreshComponents();});
  bindComponentRows();bindChart();
}

window.addEventListener("hashchange",()=>{const next=location.hash.slice(1);if(pageInfo[next]){page=next;if(state)render();window.scrollTo({top:0,behavior:"smooth"});}});
$("#parameter-form").addEventListener("submit",event=>event.preventDefault());
$("#run-button").addEventListener("click",()=>{location.hash="iterations";});
$("#export-button").addEventListener("click",async()=>{const button=$("#export-button");button.disabled=true;try{await window.RKSnapshot.download(selectedIteration===null?"/api/export":`/api/export?id=${encodeURIComponent(selectedIteration)}`,"rk3566-simulation-evidence.json");}catch(error){toast(error.message);}finally{updateActions();}});
$("#scope-more").addEventListener("click",evidenceDialog);
$("#evidence-link").addEventListener("click",event=>{event.preventDefault();evidenceDialog();});
$("#close-dialog").addEventListener("click",()=>$("#evidence-dialog").close());
$("#close-dialog-bottom").addEventListener("click",()=>$("#evidence-dialog").close());
$("#evidence-dialog").addEventListener("click",event=>{if(event.target===$("#evidence-dialog")){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
updateActions();
refresh(true);
