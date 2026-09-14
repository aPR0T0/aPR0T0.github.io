/* Native PCB geometry viewer. Time-dependent values come only from saved waveforms. */
"use strict";

window.BoardView = (() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const numeric = value => typeof value === "number" && Number.isFinite(value) ? value : null;
  const text = value => Array.isArray(value) ? value.map(text).filter(Boolean).join(" · ") : value && typeof value === "object" ? String(value.detail || value.title || value.description || JSON.stringify(value)) : String(value ?? "");
  const fmt = (value, digits = 3) => numeric(value) === null ? "Unknown" : value.toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const measurement = (value, unit, digits = 3) => numeric(value) === null ? '<span class="board-unknown">Unknown</span>' : `${fmt(value,digits)} <small>${escape(unit)}</small>`;
  const badge = (status, label) => `<span class="badge ${["fail","failed","high"].includes(status)?"fail":["pass","calculated"].includes(status)?"pass":["partial","warning","conditional"].includes(status)?"warning":"unknown"}">${escape(label || String(status || "unknown").replace(/_/g," "))}</span>`;
  let currentState = null;
  let layout = null;
  let layoutPromise = null;
  let generation = 0;
  let resultId = null;
  let side = "F";
  let overlay = "voltage";
  let showCopper = false;
  let showPads = true;
  let showLabels = true;
  let layerChoice = "surface";
  let selectedRef = "U1";
  let selectedNet = null;
  let timeMs = null;
  let playing = false;
  let animationId = null;
  let animationLast = null;
  let viewport = null;
  let fullViewport = null;
  let search = "";
  let dragged = false;
  let modelByRef = new Map();
  let inventoryByRef = new Map();
  let waveByNet = new Map();
  let times = [];
  let colorNodes = [];
  let lastTimeSnapshot = {};
  const unknownColor = "#657781";

  function render() {
    return `<section class="board-workspace"><div class="board-view-header"><div><div class="board-mini-label">NATIVE PCB · ELECTRICAL OVERLAY</div><h2>Explore the saved design</h2><p>Select a component. Inspect its pins. Scrub the simulated startup.</p></div><div id="board-focus-scores" class="board-focus-scores"></div><a class="board-handoff-link" data-snapshot-href="/api/handoff" href="#" download="NEXT_AGENT_HANDOFF.md"><span>↓</span><div><strong>Download agent handoff</strong><small>Findings, limitations, and next steps</small></div><span>↗</span></a></div><div id="board-layout-warning" class="board-layout-warning" hidden></div><div class="board-grid"><div class="board-main"><div class="board-toolbar"><div class="board-side-tabs" role="group" aria-label="Board viewing side"><button data-board-side="F" class="${side==="F"?"active":""}">Front</button><button data-board-side="B" class="${side==="B"?"active":""}">Back</button></div><label class="board-overlay-label">Overlay <select id="board-overlay" aria-label="Electrical overlay"><option value="voltage" ${overlay==="voltage"?"selected":""}>Pin voltage</option><option value="coverage" ${overlay==="coverage"?"selected":""}>Model coverage</option><option value="stress" ${overlay==="stress"?"selected":""}>Component stress</option><option value="none" ${overlay==="none"?"selected":""}>Physical placement</option></select></label><div class="board-display-options"><label><input id="board-show-copper" type="checkbox" ${showCopper?"checked":""}>Copper</label><label><input id="board-show-pads" type="checkbox" ${showPads?"checked":""}>Pads</label><label><input id="board-show-labels" type="checkbox" ${showLabels?"checked":""}>Labels</label></div><button id="board-focus" class="board-focus-button" title="Expand board workspace" aria-label="Expand board workspace">⛶ <span>Focus</span></button></div><div class="board-stage" id="board-stage"><div class="board-loading"><span class="spinner"></span><strong>Loading the actual KiCad placement</strong><span>Footprints, pads, tracks, and vias from the saved PCB.</span></div></div><div class="board-stage-footer"><span id="board-orientation">Front · viewed from top</span><span id="board-dimensions">Native board geometry</span><span>Wheel to zoom · drag to pan</span></div><div class="board-timeline"><div class="board-time-heading"><div><span class="board-time-label">SIMULATION TIME</span><strong id="board-time-display">— <small>ms</small></strong></div><span class="board-time-phase" id="board-time-phase">Loading waveforms</span><div class="board-time-presets"><button data-board-time="start">Start</button><button data-board-time="reset">Reset</button><button data-board-time="steady">Steady</button></div></div><div class="board-time-control"><button id="board-play" aria-label="Play simulated startup" title="Play simulated startup">▷</button><input id="board-time" type="range" min="0" max="160" step="any" value="0" aria-label="Simulation time in milliseconds"><span id="board-time-end">— ms</span></div><div class="board-time-note">Pin colors follow saved voltage samples. Playback spans about 8 seconds; component currents retain their stated measurement window.</div></div><div id="board-legend" class="board-legend"></div></div><aside class="board-inspector"><div class="board-search"><span>⌕</span><input id="board-component-search" type="search" value="${escape(search)}" placeholder="Find reference or component…" aria-label="Find a component on the PCB"><div id="board-search-results" class="board-search-results" hidden></div></div><div id="board-selected"><div class="board-inspector-empty">Select a component on the board to inspect its electrical evidence.</div></div></aside></div><div class="board-provenance"><span class="live-dot"></span><div id="board-source-note">The view uses saved two-dimensional placement; it does not predict temperature or electromagnetic fields.</div><a href="#components">Full component inventory ↗</a></div></section>`;
  }
  function cleanup() {
    generation += 1;
    pause();
    colorNodes = [];
  }
  async function mount(state) {
    currentState = state;
    const token = generation;
    modelByRef = new Map((state.result?.components || []).map(c=>[c.ref,c]));
    inventoryByRef = new Map((state.board?.components || []).map(c=>[c.ref,c]));
    times = state.result?.waveforms?.time_ms || [];
    waveByNet = new Map((state.result?.waveforms?.series || []).filter(s=>s.unit === "V").map(s=>[s.net || s.name,s.values]));
    if(resultId !== state.result?.id) {resultId=state.result?.id;timeMs=times.at(-1) ?? 0;}
    if(timeMs === null)timeMs=times.at(-1) ?? 0;
    try {
      if(!layout || layout.source_sha256 !== state.board?.sha256) {
        if(!layoutPromise)layoutPromise=window.RKSnapshot.fetch("/api/board-layout",{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error || "Native geometry is not available.");return data;}).finally(()=>{layoutPromise=null;});
        layout=await layoutPromise;
        viewport=null;
      }
      if(token !== generation || !q("#board-stage"))return;
      setup();
    } catch(error) {
      if(token!==generation || !q("#board-stage"))return;
      q("#board-stage").innerHTML=`<div class="board-loading"><strong>Board geometry could not be loaded</strong><span>${escape(error.message)}</span><button class="button secondary" id="board-retry">Retry geometry</button></div>`;
      q("#board-retry")?.addEventListener("click",()=>mount(currentState));
    }
  }
  function geometryMatches() {
    return Boolean(layout?.source_sha256 && currentState?.board?.sha256===layout.source_sha256 && currentState?.result?.source_sha256===layout.source_sha256 && layout.source_current!==false && currentState?.source_current!==false);
  }
  function setup() {
    const bounds=layout.bounds || {x:0,y:0,width:55,height:55};
    const margin=Math.max(bounds.width,bounds.height)*.065;
    fullViewport={x:bounds.x-margin,y:bounds.y-margin,w:bounds.width+2*margin,h:bounds.height+2*margin};
    if(!viewport)viewport={...fullViewport};
    q("#board-dimensions").textContent=`${fmt(bounds.width,1)} × ${fmt(bounds.height,1)} mm · ${(layout.components || []).length} footprints`;
    const warning=q("#board-layout-warning");
    warning.hidden=geometryMatches();
    warning.textContent=geometryMatches()?"":"Source mismatch: the PCB geometry and selected simulation do not share the current source identity. Electrical overlays and pin values are disabled; the physical placement remains inspectable.";
    q("#board-overlay").disabled=!geometryMatches();
    q("#board-source-note").textContent=`Native PCB ${String(layout.source_sha256 || "unknown").slice(0,12)} · ${(layout.tracks || []).length.toLocaleString()} trace segments · ${(layout.vias || []).length.toLocaleString()} vias. ${layout.limitations?.find?.(v=>/zone/i.test(v)) || "Copper zones and 3D fields are not shown."}`;
    q("#board-time").min=times[0] ?? 0;
    q("#board-time").max=times.at(-1) ?? 1;
    q("#board-time").value=timeMs;
    q("#board-time").disabled=!times.length || !geometryMatches();
    q("#board-play").disabled=!times.length || !geometryMatches();
    q("#board-time-end").textContent=`${fmt(times.at(-1),0)} ms`;
    if(!layout.components.some(c=>c.ref===selectedRef))selectedRef=layout.components.find(c=>c.ref==="U1")?.ref || layout.components[0]?.ref;
    const initiallySelected=layout.components.find(c=>c.ref===selectedRef);
    if(initiallySelected && initiallySelected.side!==side)selectedRef=layout.components.find(c=>c.side===side && /^U\d/.test(c.ref))?.ref || layout.components.find(c=>c.side===side)?.ref;
    bindControls();
    drawBoard();
    updateTime();
    updateInspector();
  }
  function timeSnapshot() {
    if(!geometryMatches())return {};
    const snapshot={GND:0};
    if(!times.length)return snapshot;
    let lo=0,hi=times.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(times[mid]<timeMs)lo=mid+1;else hi=mid;}
    const index=lo>0 && Math.abs(times[lo-1]-timeMs)<Math.abs(times[lo]-timeMs)?lo-1:lo;
    for(const [net,values] of waveByNet)if(numeric(values[index])!==null)snapshot[net]=values[index];
    return snapshot;
  }
  function snapTime(value) {if(!times.length)return value;let lo=0,hi=times.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(times[mid]<value)lo=mid+1;else hi=mid;}return lo>0 && Math.abs(times[lo-1]-value)<Math.abs(times[lo]-value)?times[lo-1]:times[lo];}
  function pinVoltage(net,model) {
    if(!geometryMatches())return null;
    if(numeric(lastTimeSnapshot[net])!==null)return lastTimeSnapshot[net];
    const final=times.at(-1);
    if(numeric(final)!==null && timeMs>=final) {
      const pin=(model?.pins || []).find(p=>p.net===net);
      if(numeric(pin?.steady_v)!==null)return pin.steady_v;
    }
    return null;
  }
  function componentMaximum(ref) {
    const model=modelByRef.get(ref);
    if(!model)return null;
    const values=(model.pins || []).map(p=>pinVoltage(p.net,model)).filter(v=>numeric(v)!==null);
    // GND alone never establishes that an otherwise unmodeled component is at 0 V.
    const knownSupply=(model.pins || []).some(p=>p.net!=="GND" && numeric(pinVoltage(p.net,model))!==null);
    return values.length && knownSupply ? Math.max(...values) : null;
  }
  function voltageColor(value) {
    if(numeric(value)===null)return unknownColor;
    const scale=Math.max(5,...(currentState.result?.rails || []).map(r=>r.nominal_v || 0));
    const fraction=Math.max(0,Math.min(1,value/scale));
    const stops=[[48,91,101],[34,161,155],[89,208,160],[226,190,99]];
    const pos=fraction*(stops.length-1),i=Math.min(stops.length-2,Math.floor(pos)),t=pos-i;
    return `rgb(${stops[i].map((a,n)=>Math.round(a+(stops[i+1][n]-a)*t)).join(",")})`;
  }
  function componentColor(ref) {
    const model=modelByRef.get(ref),inventory=inventoryByRef.get(ref);
    if(model?.dnp || inventory?.dnp)return "#465766";
    if(!geometryMatches() || overlay==="none")return "#507b7c";
    if(overlay==="coverage")return {calculated:"#45b99e",partial:"#c5a360",unmodeled:unknownColor,excluded:"#465766"}[model?.coverage] || unknownColor;
    if(overlay==="stress")return {pass:"#45b99e",fail:"#d67675",warning:"#d0ad6d",partial:"#d0ad6d"}[model?.stress?.status] || unknownColor;
    return voltageColor(componentMaximum(ref));
  }
  function outlinePath() {
    const edges=(layout.outline || []).filter(e=>Array.isArray(e.start) && Array.isArray(e.end)).map(e=>({a:e.start,b:e.end}));
    if(!edges.length)return "";
    const same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<.015;
    let path="";
    while(edges.length){const first=edges.shift();let last=first.b;path+=`M${first.a[0]},${first.a[1]}L${last[0]},${last[1]}`;let count=0;
      while(edges.length && !same(last,first.a) && count++<10000){const i=edges.findIndex(e=>same(e.a,last)||same(e.b,last));if(i<0)break;const edge=edges.splice(i,1)[0];last=same(edge.a,last)?edge.b:edge.a;path+=`L${last[0]},${last[1]}`;}
      if(same(last,first.a))path+="Z";
    }
    return path;
  }
  function isLayerVisible(track) {
    if(layerChoice==="all")return true;
    const layer=String(track.layer ?? "");
    const name=layerChoice==="surface"?(side==="F"?"F.Cu":"B.Cu"):layerChoice;
    const physical=(layout.layers || []).find(l=>l.name===name || String(l.id)===name);
    return layer===name || layer===String(physical?.id) || String(track.layer_name || "")===name;
  }
  function activeCopperId() {const name=layerChoice==="surface"?(side==="F"?"F.Cu":"B.Cu"):layerChoice;return (layout.layers || []).find(l=>l.name===name || String(l.id)===name)?.id;}
  function padShape(pad, ref, fill) {
    const width=numeric(pad.width),height=numeric(pad.height);
    if(width===null || height===null)return "";
    const selected=selectedNet && pad.net===selectedNet;
    const stroke=selected?"#e9fff5":"#152c35";
    const attrs=`class="board-pad" data-pad-ref="${escape(ref)}" data-pad-net="${escape(pad.net || "")}" fill="${fill}" stroke="${stroke}" stroke-width="${selected?.09:.035}"`;
    const polygons=pad.polygons || (pad.polygon?[pad.polygon]:[]);
    if(polygons.length)return polygons.map(polygon=>{const points=Array.isArray(polygon)?polygon:polygon.points || [];const rings=[points,...(polygon.holes || [])];const d=rings.filter(r=>r.length).map(r=>r.map((p,i)=>`${i?"L":"M"}${Array.isArray(p)?p.join(","):`${p.x},${p.y}`}`).join(" ")+" Z").join(" ");return `<path ${attrs} d="${d}" fill-rule="evenodd"/>`;}).join("");
    const angle=numeric(pad.svg_rotation) ?? -(pad.rotation || 0);
    const rotation=` transform="rotate(${angle} ${pad.x} ${pad.y})"`;
    const shape=String(pad.shape || "").toLowerCase();
    let html=shape.includes("circle")?`<ellipse ${attrs} cx="${pad.x}" cy="${pad.y}" rx="${width/2}" ry="${height/2}"/>`:`<rect ${attrs} x="${pad.x-width/2}" y="${pad.y-height/2}" width="${width}" height="${height}" rx="${shape.includes("oval")?Math.min(width,height)/2:shape.includes("round")?(numeric(pad.corner_radius) ?? Math.min(width,height)*.15):0}"${rotation}/>`;
    const drill=typeof pad.drill==="object"?Math.min(pad.drill.width || pad.drill.x || 0,pad.drill.height || pad.drill.y || 0):numeric(pad.drill);
    if(pad.through_hole && drill>0)html+=`<circle cx="${pad.x}" cy="${pad.y}" r="${drill/2}" fill="#152a36"/>`;
    return html;
  }
  function nativeGraphic(g) {
    const shape=String(g.type || g.shape || "").toLowerCase();
    const attrs=`fill="none" stroke="#c4ded5" stroke-width="${numeric(g.width) ?? .075}" opacity=".36" pointer-events="none"`;
    if(Array.isArray(g.polygons))return g.polygons.map(p=>`<polygon ${attrs} points="${(p.points || []).map(v=>v.join(",")).join(" ")}"/>`).join("");
    if(Array.isArray(g.points))return `<polyline ${attrs} points="${g.points.map(p=>p.join(",")).join(" ")}"/>`;
    if(shape.includes("circle") && g.center && g.radius)return `<circle ${attrs} cx="${g.center[0]}" cy="${g.center[1]}" r="${g.radius}"/>`;
    if(g.start && g.end && (shape.includes("rect")))return `<rect ${attrs} x="${Math.min(g.start[0],g.end[0])}" y="${Math.min(g.start[1],g.end[1])}" width="${Math.abs(g.start[0]-g.end[0])}" height="${Math.abs(g.start[1]-g.end[1])}"/>`;
    if(g.start && g.end)return `<line ${attrs} x1="${g.start[0]}" y1="${g.start[1]}" x2="${g.end[0]}" y2="${g.end[1]}"/>`;
    return "";
  }
  function drawBoard() {
    const stage=q("#board-stage");if(!stage || !layout)return;
    lastTimeSnapshot=timeSnapshot();
    const bounds=layout.bounds;
    const boardPath=outlinePath();
    const mirror=side==="B"?`translate(${2*bounds.x+bounds.width},0) scale(-1,1)`:"";
    const footprints=(layout.components || []).filter(c=>c.side===side);
    const copperId=activeCopperId();
    let copper="";
    if(showCopper) {
      copper=(layout.tracks || []).filter(isLayerVisible).map(track=>`<line x1="${track.start[0]}" y1="${track.start[1]}" x2="${track.end[0]}" y2="${track.end[1]}" stroke="${selectedNet && track.net===selectedNet?"#b9f8b1":"#5f8276"}" stroke-width="${Math.max(.035,track.width || .05)}" opacity="${selectedNet?(track.net===selectedNet?.95:.14):.42}" stroke-linecap="round"/>`).join("");
      copper+=(layout.vias || []).filter(via=>layerChoice==="all" || (via.layers || []).includes(copperId)).map(via=>`<circle cx="${via.x}" cy="${via.y}" r="${Math.max(.025,((layerChoice!=="all" && via.diameters?.[String(copperId)]) || via.diameter || .2)/2)}" fill="${selectedNet && via.net===selectedNet?"#b9f8b1":"#2c534e"}" stroke="#668a79" stroke-width=".045" opacity="${selectedNet && via.net!==selectedNet?.18:.6}"/>`).join("");
    }
    const surfaceId=(layout.layers || []).find(l=>l.name===(side==="F"?"F.Cu":"B.Cu"))?.id;
    const oppositePads=showPads?(layout.components || []).filter(c=>c.side!==side).map(c=>(c.pads || []).filter(p=>p.through_hole && (p.layers || []).includes(surfaceId)).map(p=>`<g data-board-ref="${escape(c.ref)}" class="board-component" tabindex="0" role="button" aria-label="Inspect through-hole pad on ${escape(c.ref)}"><title>${escape(c.ref)} · through-hole pad ${escape(p.number)}</title>${padShape(p,c.ref,geometryMatches() && overlay==="voltage"?voltageColor(pinVoltage(p.net,modelByRef.get(c.ref))):"#a5ac82")}</g>`).join("")).join(""):"";
    const bodies=footprints.map(component=>{
      const ref=component.ref,model=modelByRef.get(ref),inventory=inventoryByRef.get(ref),dnp=model?.dnp || inventory?.dnp;
      const box=component.bounds || {x:component.x-.25,y:component.y-.25,width:.5,height:.5};
      const selected=selectedRef===ref,fill=componentColor(ref),label=showLabels && (selected || /^U\d|^J\d|^L\d|^Y\d/.test(ref));
      const bodyWidth=Math.max(.18,box.width),bodyHeight=Math.max(.18,box.height);
      const textX=box.x+box.width/2,textY=box.y+box.height/2;
      const font=Math.min(selected?.95:.65,Math.max(.4,box.width/(ref.length+1)*1.05));
      const title=`${ref} · ${component.value || inventory?.value || "Mechanical / placement feature"}`;
      const selectedRing=selected?`<rect class="board-selection-ring" x="${box.x-.25}" y="${box.y-.25}" width="${bodyWidth+.5}" height="${bodyHeight+.5}" rx=".35" fill="none" stroke="#edfff2" stroke-width=".15"/><rect x="${box.x-.34}" y="${box.y-.34}" width="${bodyWidth+.68}" height="${bodyHeight+.68}" rx=".44" fill="none" stroke="#61d2ba" stroke-width=".09" opacity=".65"/>`:"";
      const padHtml=showPads?(component.pads || []).map(p=>padShape(p,ref,geometryMatches() && overlay==="voltage"?voltageColor(pinVoltage(p.net,model)):dnp?"#657076":"#a5ac82")).join(""):"";
      const graphicHtml=(component.graphics || []).filter(g=>[`${side}.Fab`,`${side}.Silkscreen`].includes(g.layer_name)).map(nativeGraphic).join("");
      const mirrorText=side==="B"?`translate(${2*textX},0) scale(-1,1)`:"";
      return `<g class="board-component ${selected?"selected":""} ${dnp?"dnp":""}" data-board-ref="${escape(ref)}" tabindex="0" role="button" aria-label="Inspect ${escape(title)}"><title>${escape(title)}</title><rect class="board-component-body" data-body-ref="${escape(ref)}" x="${box.x}" y="${box.y}" width="${bodyWidth}" height="${bodyHeight}" rx="${Math.min(.22,bodyWidth*.12,bodyHeight*.12)}" fill="${fill}" fill-opacity="${dnp?.14:.36}" stroke="${fill}" stroke-width="${selected?.15:.07}" ${dnp?'stroke-dasharray=".2 .12"':""}/>${padHtml}${graphicHtml}${selectedRing}${label?`<text x="${textX}" y="${textY+.18}" transform="${mirrorText}" font-family="ui-monospace,monospace" font-size="${font}" text-anchor="middle" fill="${selected?"#f0fff6":"#d3e5df"}" stroke="#183f3b" stroke-width=".1" paint-order="stroke" pointer-events="none">${escape(ref)}</text>`:""}</g>`;
    }).join("");
    const options=(layout.layers || []).filter(l=>l.copper).map(l=>`<option value="${escape(l.name || l.id)}" ${String(layerChoice)===String(l.name || l.id)?"selected":""}>${escape(l.name || l.id)}</option>`).join("");
    const boardGraphics=(layout.graphics || []).filter(g=>g.layer_name===`${side}.Silkscreen`).map(nativeGraphic).join("");
    stage.innerHTML=`<div class="board-canvas-label"><span class="live-dot"></span><span>${side==="F"?"FRONT":"BACK"} ASSEMBLY</span><span class="board-canvas-count">${footprints.length} footprints</span></div><div class="board-view-tools"><button data-board-zoom="in" title="Zoom in" aria-label="Zoom in">+</button><button data-board-zoom="out" title="Zoom out" aria-label="Zoom out">−</button><button data-board-zoom="fit" title="Fit entire board" aria-label="Fit entire board">⊡</button><span id="board-zoom-label">100%</span></div>${showCopper?`<div class="board-copper-layer"><label for="board-layer">COPPER</label><select id="board-layer"><option value="surface" ${layerChoice==="surface"?"selected":""}>Visible surface</option><option value="all" ${layerChoice==="all"?"selected":""}>All copper layers</option>${options}</select></div>`:""}<svg class="board-svg" id="board-svg" viewBox="${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}" role="img" aria-label="Native ${side==="F"?"front":"back"} PCB placement with selectable components"><defs><pattern id="board-native-grid" width="2.5" height="2.5" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".025" fill="#a1d2c9" opacity=".16"/></pattern><filter id="board-drop-shadow" x="-15%" y="-15%" width="130%" height="140%"><feDropShadow dx="0" dy=".7" stdDeviation=".7" flood-color="#030f17" flood-opacity=".5"/></filter></defs><g transform="${mirror}">${boardPath?`<path d="${boardPath}" fill="#17463e" fill-rule="evenodd" stroke="#3c7c68" stroke-width=".2" filter="url(#board-drop-shadow)"/><path d="${boardPath}" fill="url(#board-native-grid)" fill-rule="evenodd"/>`:`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#17463e" stroke="#3c7c68" stroke-width=".2"/>`}<g class="board-copper" pointer-events="none">${copper}</g><g>${oppositePads}${bodies}</g><g>${boardGraphics}</g></g></svg><div class="board-canvas-hint" id="board-canvas-hint"><span>◎</span> Click any footprint to inspect its pins</div>`;
    q("#board-orientation").textContent=side==="F"?"Front · viewed from top":"Back · mirrored horizontally, viewed from underneath";
    qa("[data-board-side]").forEach(button=>button.classList.toggle("active",button.dataset.boardSide===side));
    colorNodes=qa("[data-body-ref],[data-pad-net]");
    bindCanvas();
    updateLegend();
    updateZoomLabel();
  }
  function updateTime() {
    if(!q("#board-time-display"))return;
    timeMs=snapTime(timeMs);
    lastTimeSnapshot=timeSnapshot();
    q("#board-time-display").innerHTML=`${fmt(timeMs,2)} <small>ms</small>`;
    q("#board-time").value=timeMs;
    const end=times.at(-1) || 1;
    const reset=numeric(lastTimeSnapshot.RESETn);
    q("#board-time-phase").textContent=reset===null?"Reset state unknown":reset>0?"Candidate RESETn high · released":"Candidate RESETn low · held";
    const pct=100*(timeMs-(times[0] || 0))/(end-(times[0] || 0));q("#board-time").style.setProperty("--board-time-fill",`${pct}%`);
    if(overlay==="voltage" && geometryMatches())for(const node of colorNodes){if(node.dataset.bodyRef){const color=componentColor(node.dataset.bodyRef);node.setAttribute("fill",color);node.setAttribute("stroke",color);}else node.setAttribute("fill",voltageColor(pinVoltage(node.dataset.padNet,modelByRef.get(node.dataset.padRef))));}
    const model=modelByRef.get(selectedRef);
    qa("[data-inspector-net]").forEach(node=>{node.innerHTML=measurement(pinVoltage(node.dataset.inspectorNet,model),"V");});
    const max=q("#board-selected-voltage");if(max)max.innerHTML=measurement(componentMaximum(selectedRef),"V");
    const readTime=q("#board-pin-read-time");if(readTime)readTime.textContent=`at ${fmt(timeMs,2)} ms`;
    const count=q("#board-pin-known-count");if(count){const component=layout.components.find(c=>c.ref===selectedRef);count.textContent=modelPins(component,model).filter(p=>numeric(pinVoltage(p.net,model))!==null).length;}
  }
  function pause() {playing=false;if(animationId!==null)cancelAnimationFrame(animationId);animationId=null;animationLast=null;const button=q("#board-play");if(button){button.textContent="▷";button.setAttribute("aria-label","Play simulated startup");}}
  function play() {
    if(playing){pause();return;}
    if(!times.length || !geometryMatches())return;
    const start=times[0],end=times.at(-1);if(timeMs>=end)timeMs=start;
    playing=true;q("#board-play").textContent="Ⅱ";q("#board-play").setAttribute("aria-label","Pause simulated startup");
    const frame=stamp=>{
      if(!playing || !q("#board-svg")){pause();return;}
      if(animationLast===null)animationLast=stamp;
      const elapsed=stamp-animationLast;
      if(elapsed>=60){timeMs=Math.min(end,timeMs+(end-start)*elapsed/8000);animationLast=stamp;updateTime();}
      if(timeMs>=end){pause();return;}
      animationId=requestAnimationFrame(frame);
    };animationId=requestAnimationFrame(frame);
  }
  function updateLegend() {
    const legend=q("#board-legend");if(!legend)return;
    const effective=geometryMatches()?overlay:"none";
    if(effective==="voltage")legend.innerHTML=`<div class="board-voltage-scale"><span>0 V</span><i></i><span>${fmt(Math.max(5,...(currentState.result?.rails || []).map(r=>r.nominal_v || 0)),1)} V</span></div><span class="board-legend-key"><i style="background:${unknownColor}"></i>Unknown</span><span class="board-legend-key"><i class="dashed"></i>DNP</span><p>Body color = highest modeled pin voltage. Pads use their own net voltage; mixed-supply devices need pin-level inspection.</p>`;
    else if(effective==="coverage")legend.innerHTML=`<span class="board-legend-key"><i style="background:#45b99e"></i>Calculated</span><span class="board-legend-key"><i style="background:#c5a360"></i>Partial</span><span class="board-legend-key"><i style="background:${unknownColor}"></i>Unmodeled / mechanical</span><span class="board-legend-key"><i class="dashed"></i>DNP</span><p>Coverage describes available electrical calculations. It does not establish successful boot or qualified hardware.</p>`;
    else if(effective==="stress")legend.innerHTML=`<span class="board-legend-key"><i style="background:#45b99e"></i>Within modeled limit</span><span class="board-legend-key"><i style="background:#d0ad6d"></i>Review required</span><span class="board-legend-key"><i style="background:#d67675"></i>Exceeded</span><span class="board-legend-key"><i style="background:${unknownColor}"></i>Unknown</span><p>Component stress comes from the active result’s stated checks. This overlay is not a temperature or electromagnetic-field map.</p>`;
    else legend.innerHTML=`<span class="board-legend-key"><i style="background:#507b7c"></i>Native footprint bounds</span><span class="board-legend-key"><i style="background:#a5ac82"></i>Native pads</span><span class="board-legend-key"><i class="dashed"></i>DNP</span><p>Positions, pads, and footprint graphics come from KiCad. Copper pours, enclosure geometry, and 3D component bodies are omitted.</p>`;
  }
  function modelPins(component,model) {
    const actual=new Map();
    for(const pad of component?.pads || [])if((pad.number || pad.net) && !actual.has(String(pad.number)))actual.set(String(pad.number),{pin:String(pad.number),net:pad.net || null});
    for(const pin of model?.pins || [])if(!actual.has(String(pin.pin)))actual.set(String(pin.pin),{pin:String(pin.pin),net:pin.net});
    return [...actual.values()].sort((a,b)=>a.pin.localeCompare(b.pin,undefined,{numeric:true}));
  }
  function updateInspector() {
    const root=q("#board-selected");if(!root)return;
    const component=layout.components.find(c=>c.ref===selectedRef);
    if(!component){root.innerHTML='<div class="board-inspector-empty">Select a footprint on the current side.</div>';return;}
    const model=modelByRef.get(selectedRef),inventory=inventoryByRef.get(selectedRef),pins=modelPins(component,model),dnp=model?.dnp || inventory?.dnp;
    const coverage=model?.coverage || (dnp?"excluded":inventory?"unmodeled":"mechanical");
    const matched=geometryMatches(),startup=matched?model?.startup:{},steady=matched?model?.steady:{};
    const stress=matched?model?.stress:null;
    const knownPins=matched?pins.filter(p=>numeric(pinVoltage(p.net,model))!==null).length:0;
    root.innerHTML=`<div class="board-selected-header"><div><span class="board-selected-ref">${escape(component.ref)}</span><span class="board-selected-side">${component.side==="B"?"BACK":"FRONT"}</span></div><h3>${escape(component.value || inventory?.value || "Mechanical feature")}</h3><p>${escape(inventory?.mpn || model?.mpn || "Exact part number not specified")}</p><div class="board-selected-badges">${badge(coverage,coverage==="unmodeled"?"Not modeled":coverage)}${dnp?badge("unknown","Do not populate"):""}</div></div><div class="board-inspector-metric"><div><span>Highest modeled pin voltage</span><strong id="board-selected-voltage">${measurement(componentMaximum(selectedRef),"V")}</strong></div><span class="board-metric-symbol">ϟ</span></div><div class="board-inspector-coordinates"><span>X <b>${fmt(component.x,2)} mm</b></span><span>Y <b>${fmt(component.y,2)} mm</b></span><span>Rotation <b>${fmt(component.rotation,0)}°</b></span></div><div class="board-pin-heading"><h4>Pin voltages <span>${pins.length}</span></h4><span id="board-pin-read-time">at ${fmt(timeMs,2)} ms</span></div><div class="board-pin-table"><table><thead><tr><th>Pin</th><th>Net</th><th>Voltage</th></tr></thead><tbody>${pins.map(p=>`<tr class="${selectedNet && selectedNet===p.net?"selected-net":""}"><td class="mono">${escape(p.pin || "—")}</td><td><button data-inspect-net="${escape(p.net || "")}" title="Highlight ${escape(p.net || "unconnected pad")}" ${!p.net?"disabled":""}>${escape(p.net || "Unconnected")}</button></td><td class="mono" data-inspector-net="${escape(p.net || "")}">${measurement(pinVoltage(p.net,model),"V")}</td></tr>`).join("") || '<tr><td colspan="3" class="board-unknown">No electrical pins</td></tr>'}</tbody></table></div><div class="board-pin-explanation"><span id="board-pin-known-count">${knownPins}</span> pin voltages available at this time. Click a net to highlight its routed copper. Signal pins without a model remain unknown.</div>${selectedNet?`<div class="board-net-selection"><span>Highlighting <strong>${escape(selectedNet)}</strong></span><button id="board-clear-net" aria-label="Clear selected net">×</button></div>`:""}<div class="board-branch-heading"><h4>Component current evidence</h4><span>Defined windows</span></div><div class="board-current-values"><div><span>Startup peak</span><strong>${measurement(startup?.current_a,"A",4)}</strong><small>0–${fmt(currentState.result?.parameters?.reset_release_ms,0)} ms · requested reset window</small></div><div><span>Steady average</span><strong>${measurement(steady?.current_a,"A",4)}</strong><small>Final 20% of the simulation</small></div></div><p class="board-current-note">These are this component’s available estimates, not instantaneous values at the scrubber. A whole-rail current is never assigned to an individual IC.</p>${stress?`<div class="board-component-stress"><div><strong>Component stress</strong>${badge(stress.status)}</div><p>${escape(text(stress.detail))}</p></div>`:""}<details class="board-model-notes"><summary>Model &amp; evidence notes <span>⌄</span></summary><strong>${escape(text(model?.model) || "No component electrical model")}</strong><p>${escape(text(model?.notes) || "This footprint is present in the native layout. Per-component behavior has not been calculated.")}</p></details>`;
    qa("[data-inspect-net]",root).forEach(button=>button.addEventListener("click",()=>{selectedNet=button.dataset.inspectNet;showCopper=true;layerChoice="all";q("#board-show-copper").checked=true;drawBoard();updateInspector();}));
    q("#board-clear-net")?.addEventListener("click",()=>{selectedNet=null;drawBoard();updateInspector();});
  }
  function selectComponent(ref,focus=false) {
    const component=layout.components.find(c=>c.ref===ref);if(!component)return;
    selectedRef=ref;selectedNet=null;
    if(component.side!==side){side=component.side;viewport={...fullViewport};}
    if(focus){const box=component.bounds || {x:component.x-2,y:component.y-2,width:4,height:4};const dimension=Math.max(13,box.width*3,box.height*3);const cx=side==="B"?2*layout.bounds.x+layout.bounds.width-(box.x+box.width/2):box.x+box.width/2;viewport={x:cx-dimension/2,y:box.y+box.height/2-dimension/2,w:dimension,h:dimension};}
    drawBoard();updateInspector();
  }
  function updateSearch() {
    const box=q("#board-search-results"),term=search.trim().toLowerCase();if(!box)return;
    if(!term){box.hidden=true;box.innerHTML="";return;}
    const matches=layout.components.filter(c=>[c.ref,c.value,inventoryByRef.get(c.ref)?.mpn].join(" ").toLowerCase().includes(term)).sort((a,b)=>(a.ref.toLowerCase()===term?-1:b.ref.toLowerCase()===term?1:a.ref.localeCompare(b.ref,undefined,{numeric:true}))).slice(0,18);
    box.hidden=false;box.innerHTML=matches.length?matches.map(c=>`<button data-find-component="${escape(c.ref)}"><strong>${escape(c.ref)}</strong><span>${escape(c.value || "Mechanical feature")}</span><small>${c.side==="B"?"Back":"Front"} ↗</small></button>`).join(""):'<p>No matching footprint</p>';
    qa("[data-find-component]",box).forEach(button=>button.addEventListener("click",()=>{selectComponent(button.dataset.findComponent,true);box.hidden=true;q("#board-component-search").blur();}));
  }
  function bindControls() {
    q("#board-focus").addEventListener("click",()=>{const workspace=q(".board-workspace");const active=workspace.classList.toggle("is-focused");q("#board-focus").innerHTML=active?'× <span>Close focus</span>':'⛶ <span>Focus</span>';q("#board-focus").setAttribute("aria-label",active?"Close expanded board workspace":"Expand board workspace");q("#board-focus-scores").innerHTML=`<span>${currentState.result?.superseded?"Historical model checks":"Model checks"}<b>${fmt(currentState.result?.score?.behavioral,1)}/10</b></span><span>Hardware evidence <b>${fmt(currentState.result?.score?.evidence,2)}/10</b></span>`;});
    qa("[data-board-side]").forEach(button=>button.addEventListener("click",()=>{side=button.dataset.boardSide;viewport={...fullViewport};selectedNet=null;const target=layout.components.find(c=>c.ref===selectedRef);if(target?.side!==side)selectedRef=layout.components.find(c=>c.side===side && /^U\d/.test(c.ref))?.ref || layout.components.find(c=>c.side===side)?.ref;drawBoard();updateInspector();}));
    q("#board-overlay").addEventListener("change",event=>{overlay=event.target.value;drawBoard();});
    q("#board-show-copper").addEventListener("change",event=>{showCopper=event.target.checked;drawBoard();});
    q("#board-show-pads").addEventListener("change",event=>{showPads=event.target.checked;drawBoard();});
    q("#board-show-labels").addEventListener("change",event=>{showLabels=event.target.checked;drawBoard();});
    q("#board-time").addEventListener("input",event=>{pause();timeMs=Number(event.target.value);updateTime();});
    q("#board-play").addEventListener("click",play);
    qa("[data-board-time]").forEach(button=>button.addEventListener("click",()=>{pause();timeMs=button.dataset.boardTime==="start"?times[0] || 0:button.dataset.boardTime==="reset"?Math.max(times[0] || 0,Math.min(times.at(-1) || 0,currentState.result?.parameters?.reset_release_ms || 0)):times.at(-1) || 0;updateTime();}));
    q("#board-component-search").addEventListener("input",event=>{search=event.target.value;updateSearch();});
    q("#board-component-search").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();q("[data-find-component]")?.click();}if(event.key==="Escape")q("#board-search-results").hidden=true;});
  }
  function svgPoint(event) {const svg=q("#board-svg");const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;return point.matrixTransform(svg.getScreenCTM().inverse());}
  function setViewport() {q("#board-svg")?.setAttribute("viewBox",`${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`);updateZoomLabel();}
  function updateZoomLabel() {const label=q("#board-zoom-label");if(label && viewport && fullViewport)label.textContent=`${Math.round(fullViewport.w/viewport.w*100)}%`;}
  function zoom(factor,center) {
    const targetWidth=viewport.w*factor;if(targetWidth<fullViewport.w/12 || targetWidth>fullViewport.w*2)return;
    const cx=center?.x ?? viewport.x+viewport.w/2,cy=center?.y ?? viewport.y+viewport.h/2;
    viewport={x:cx-(cx-viewport.x)*factor,y:cy-(cy-viewport.y)*factor,w:targetWidth,h:viewport.h*factor};setViewport();
  }
  function bindCanvas() {
    const svg=q("#board-svg");
    qa("[data-board-zoom]").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.boardZoom==="fit"){viewport={...fullViewport};setViewport();}else zoom(button.dataset.boardZoom==="in"?.8:1.25);}));
    q("#board-layer")?.addEventListener("change",event=>{layerChoice=event.target.value;drawBoard();});
    svg.addEventListener("wheel",event=>{event.preventDefault();zoom(event.deltaY<0?.9:1.1,svgPoint(event));},{passive:false});
    let drag=null;
    svg.addEventListener("pointerdown",event=>{if(event.button!==0)return;drag={point:svgPoint(event),x:event.clientX,y:event.clientY,view:{...viewport}};dragged=false;});
    svg.addEventListener("pointermove",event=>{if(!drag)return;const dist=Math.hypot(event.clientX-drag.x,event.clientY-drag.y);if(dist<3 && !dragged)return;if(!dragged)svg.setPointerCapture(event.pointerId);dragged=true;svg.classList.add("dragging");const point=svgPoint(event);viewport.x-=point.x-drag.point.x;viewport.y-=point.y-drag.point.y;setViewport();});
    const endDrag=()=>{drag=null;svg.classList.remove("dragging");};svg.addEventListener("pointerup",endDrag);svg.addEventListener("pointercancel",endDrag);
    svg.addEventListener("click",event=>{if(dragged){dragged=false;return;}const target=event.target.closest("[data-board-ref]");if(target)selectComponent(target.dataset.boardRef);});
    svg.addEventListener("keydown",event=>{const target=event.target.closest("[data-board-ref]");if(target && ["Enter"," "].includes(event.key)){event.preventDefault();selectComponent(target.dataset.boardRef);}});
  }
  document.addEventListener("keydown",event=>{if(event.key==="Escape" && q(".board-workspace.is-focused"))q("#board-focus")?.click();});
  return {render,mount,cleanup};
})();
