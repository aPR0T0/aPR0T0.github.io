"use strict";
window.SimulationWorkbench = (() => {
  const q = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const math = () => window.WorkbenchMath;
  const valid = value => typeof value === "number" && Number.isFinite(value);
  const fmt = (value, digits=3) => valid(value) ? value.toLocaleString(undefined,{maximumFractionDigits:digits}) : "Unknown";
  const palette = ["#19bda9","#6296ff","#e7b553","#ee8096"];
  const branchRefs = ["L219","C382","C383","C384","C385"];
  let generation = 0, viewer = null, loaded = null, loadPromise = null, state = null, hooks = {};
  let frame = null, playing = false, lastFrame = 0, playPosition = 0, busy = false;
  let study = "startup", quantity = "voltage", windowName = "full", selected = "U1", index = Number.MAX_SAFE_INTEGER;
  let series = [], times = [], unit = "ms", seriesMap = {}, pinned = [], fieldProbe = null, currentField = null;
  let baseline = null, fieldRange = [0,400], chartTraces = [], chartBounds = null, sceneNote = "";
  let visibility = {showComponents:true,showTracks:true,showPads:false,showVias:false,showSubstrate:true,explode_mm:0};
  let colorRange = [0,5], resizeObserver = null, keyHandler = null;
  let componentsByRef={}, netsByRef={}, voltageSeriesByNet={}, traceCache=new Map(), fieldBoundsCache=new Map(), lastPaint=0;
  let guard=null,guardCheckedAt=0,guardBusy=false;
  let thermalCase='central';
  let exportUrl=null,boardFieldSource='all';
  async function get(path) { const r=await window.RKSnapshot.fetch(path,{cache:"no-store"}); const d=await r.json(); if(!r.ok || d.error)throw new Error(d.error || `Request failed: ${r.status}`);return d; }
  async function load() {
    if(loaded) return loaded;
    if(!loadPromise) loadPromise=Promise.all([get('/api/workbench-layout'),get('/api/workbench-data'),import('./workbench3d.js'),get('/api/board-magnetic-field')])
      .then(([layout,data,_,boardField])=>loaded={layout,data,boardField}).finally(()=>loadPromise=null);
    return loadPromise;
  }
  function render() { return window.SimulationWorkbenchShell.render(); }
  function cleanup() {
    if(exportUrl)URL.revokeObjectURL(exportUrl);exportUrl=null;
    generation++; pause(); viewer?.destroy(); viewer=null; resizeObserver?.disconnect(); resizeObserver=null;
    if(keyHandler)document.removeEventListener('keydown',keyHandler); keyHandler=null;
  }
  async function mount(current, callbacks={}) {
    const token=generation; state=current; hooks=callbacks;
    try {
      const {layout}=await load(); if(token!==generation || !q('#wb-scene'))return;
      guard=await get('/api/workbench-status');guardCheckedAt=Date.now();if(token!==generation)return;
      componentsByRef=Object.fromEntries(layout.components.map(c=>[c.ref,c]));
      netsByRef=Object.fromEntries(layout.components.map(c=>[c.ref,[...new Set(c.pads.map(p=>p.net).filter(Boolean))]]));
      viewer=await window.Workbench3D.create(q('#wb-scene'),layout,{
        onSelect:ref=>selectComponent(ref), onHover:ref=>{if(q('#wb-hover'))q('#wb-hover').textContent=ref || 'Drag to rotate · wheel to zoom';},
        onFieldProbe:probe=>{fieldProbe=probe;paintProbe();drawChart();},
        onStatus:info=>{sceneNote=typeof info==='string'?info:[info?.note,...(info?.stackup_notes||[])].filter(Boolean).join(' ');if(q('#wb-display-note'))q('#wb-display-note').textContent=sceneNote;},
        onError:error=>{sceneNote=error.message;}
      });
      if(token!==generation){viewer.destroy();viewer=null;return;}
      bind(); configureStudy(false); updateLayers();
      q('#wb-status').textContent='Saved results ready';
      resizeObserver=new ResizeObserver(()=>{viewer?.resize();drawChart();});resizeObserver.observe(q('#wb-chart'));
    } catch(error) {
      if(token!==generation)return;
      q('#wb-scene').innerHTML=`<div class="wb-empty"><strong>3D workspace could not load</strong><p>${esc(error.message)}</p><a href="#board">Open the 2D board explorer ↗</a></div>`;
      q('#wb-status').textContent='Load error';
    }
  }
  function currentCase() {return loaded.data.cases.find(c=>c.id===study);}
  function camera(preset) {viewer.setCamera(preset==='iso'?'isometric':preset);document.querySelectorAll('[data-wb-camera]').forEach(b=>{const active=b.dataset.wbCamera===preset;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
  function isCurrent() {
    if(state.source_current===false || loaded.layout.source_current===false)return false;
    if(!guard || guard.source_current!==true || guard.source_sha256!==loaded.layout.source_sha256 || state.board.sha256!==loaded.layout.source_sha256)return false;
    if(study==='board_power')return math().boardSourceMatches(loaded.boardField,loaded.layout,state);
    if(study==='startup')return guard.startup_engine_current===true && state.result.source_sha256===loaded.layout.source_sha256 && state.result.engine_sha256===state.engine_sha256;
    return guard.dataset_version===loaded.data.dataset_version && guard.source_sha256===loaded.data.source_sha256 && guard.model_current===true && (study!=='thermal' || guard.thermal_model_current===true);
  }
  function updateState(next) {
    state=next;
    if(!viewer || !q('#wb-scene'))return;
    if(next.source_current===false){traceCache.clear();pause();paint();}
  }
  function bind() {
    q('#wb-study').value=study; q('#wb-quantity').value=quantity;
    q('#wb-study').addEventListener('change',e=>{study=e.target.value;windowName=study==='settled'?'cycles':'full';fieldProbe=null;configureStudy(true);});
    q('#wb-quantity').addEventListener('change',e=>{
      quantity=e.target.value;
      if(quantity==='temperature')study='thermal';
      else if(quantity==='magnetic' && ['thermal','startup'].includes(study)){study='board_power';windowName='full';}
      else if(quantity==='current' && ['thermal','startup','board_power'].includes(study)){study='settled';windowName='cycles';}
      else if(quantity!=='magnetic' && ['thermal','board_power'].includes(study))study='startup';
      if(quantity==='magnetic'){visibility.explode_mm=0;q('#wb-explode').value=0;camera('back');updateLayers();}
      configureStudy(true);
    });
    q('#wb-window').addEventListener('change',e=>{windowName=e.target.value;configureStudy(true);});
    q('#wb-thermal-case').innerHTML=loaded.data.thermal.series.map(s=>`<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
    q('#wb-thermal-case').value=thermalCase;
    q('#wb-thermal-case').addEventListener('change',e=>{thermalCase=e.target.value;paint();});
    q('#wb-play').addEventListener('click',()=>playing?pause():play());
    q('#wb-time').addEventListener('input',e=>{pause();index=math().nearest(times,Number(e.target.value));paint();});
    q('#wb-search').addEventListener('input',searchComponents);
    q('#wb-search-results').addEventListener('click',e=>{const b=e.target.closest('[data-wb-ref]');if(b)selectComponent(b.dataset.wbRef);});
    q('#wb-pin-probe').addEventListener('click',()=>{if(!pinned.includes(selected)){pinned.push(selected);pinned=pinned.slice(-3);}paint();});
    q('#wb-clear-probes').addEventListener('click',()=>{pinned=[];baseline=null;fieldProbe=null;paint();});
    document.querySelectorAll('[data-wb-camera]').forEach(button=>button.addEventListener('click',()=>camera(button.dataset.wbCamera)));
    q('#wb-explode').addEventListener('input',e=>{visibility.explode_mm=Number(e.target.value);fieldProbe=null;updateLayers();paintProbe();});
    const layerHTML=loaded.layout.copper_layer_order.map(id=>{const layer=loaded.layout.layers.find(l=>l.id===id);return `<label class="wb-layer-choice"><input type="checkbox" data-wb-layer="${id}" ${[0,2].includes(id)?'checked':''}><span>${esc(layer?.name || id)}</span><small>${esc(loaded.layout.stackup?.roles?.[layer?.name] || '')}</small></label>`;}).join('');
    q('#wb-layer-controls').innerHTML=`${layerHTML}<div class="wb-separator"></div>${[['showComponents','Components'],['showTracks','Routed traces'],['showPads','Pads'],['showVias','Vias'],['showSubstrate','Board substrate']].map(([key,label])=>`<label class="wb-layer-choice"><input type="checkbox" data-wb-visibility="${key}" ${visibility[key]?'checked':''}><span>${label}</span></label>`).join('')}`;
    q('#wb-layer-controls').addEventListener('change',updateLayers);
    for(const id of ['wb-height','wb-field-display','wb-opacity'])q('#'+id).addEventListener('input',()=>{q('#wb-opacity-value').textContent=`${Math.round(Number(q('#wb-opacity').value)*100)}%`;fieldProbe=null;paint();});
    q('#wb-board-source').innerHTML='<option value="all">All modeled rail loops</option>'+loaded.boardField.magnetic.loops.map(loop=>`<option value="${esc(loop.id)}">${esc(loop.net || loop.name || loop.id)}</option>`).join('');
    q('#wb-board-source').value=boardFieldSource;q('#wb-board-source').addEventListener('change',e=>{boardFieldSource=e.target.value;fieldProbe=null;traceCache.clear();paint();});
    const p=state.result.parameters;
    for(const [id,key] of [['wb-vin','vin_v'],['wb-load','load_scale'],['wb-source-r','source_resistance_ohm'],['wb-soft-start','soft_start_ms']])q('#'+id).value=p[key];
    q('#wb-scenario-status').textContent=`Saved ${state.result.id}${baseline?` · comparison ${baseline.id}`:''}. Read-only conditions from this published snapshot.`;
    q('#wb-run').addEventListener('click',()=>{location.hash='iterations';});
    q('#wb-save-view').addEventListener('click',()=>{pause();const range=quantity==='magnetic'?fieldRange:colorRange;const image=viewer.capture({label:`${study} · ${quantity} · ${fmt(times[index],6)} ${unit} · ${selected} · ${q('#wb-scope').textContent}`,legend:quantity==='placement'||quantity==='magnetic'&&!currentField?null:{range,unit:quantity==='voltage'?'V · highest known pin potential':quantity==='current'?'A · magnitude (probe retains sign)':quantity==='temperature'?'°C · assumed L219 node':study==='board_power'?'µT · averaged |B| · log scale':'µT · conditional |B|',colors:['#276dff','#1cd4cf','#e2ef4b','#fa9146','#e6505b']}});previewExport(image,'RK3566-interactive-view.png','image');});
    q('#wb-export-probe').addEventListener('click',saveView);
    q('#wb-export-close').addEventListener('click',()=>q('#wb-export-dialog').close());
    q('#wb-reset-view').addEventListener('click',()=>{pause();visibility.explode_mm=0;q('#wb-explode').value=0;updateLayers();camera('iso');index=0;fieldProbe=null;paint();});
    q('#wb-chart').addEventListener('pointerdown',event=>{if(!chartBounds || !times.length)return;pause();const box=q('#wb-chart').getBoundingClientRect();const t=times[0]+Math.max(0,Math.min(1,((event.clientX-box.left)/box.width*chartBounds.width-chartBounds.left)/(chartBounds.width-chartBounds.left-chartBounds.right)))*(times.at(-1)-times[0]);index=math().nearest(times,t);paint();});
    keyHandler=event=>{if(!q('#wb-scene') || /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName))return;if(event.code==='Space'){event.preventDefault();playing?pause():play();}if(event.code==='ArrowRight'||event.code==='ArrowLeft'){event.preventDefault();pause();index=Math.max(0,Math.min(times.length-1,index+(event.code==='ArrowRight'?1:-1)));paint();}};
    document.addEventListener('keydown',keyHandler);
    searchComponents();
  }
  function configureStudy(reset) {
    pause(); if(reset)index=0;
    traceCache.clear();fieldBoundsCache.clear();
    const startup=study==='startup', thermal=study==='thermal',boardPower=study==='board_power';
    if(boardPower){quantity='magnetic';windowName='full';if(reset)index=Number.MAX_SAFE_INTEGER;visibility.explode_mm=0;q('#wb-explode').value=0;camera('back');updateLayers();}
    if(startup && ['magnetic','temperature','current'].includes(quantity))quantity='voltage';
    if(thermal)quantity='temperature';
    if(!thermal && quantity==='temperature')quantity='voltage';
    let waveform;
    if(boardPower){waveform=loaded.boardField.waveforms;times=waveform.time_ms;series=waveform.series;unit='ms';}
    else if(startup){waveform=state.result.waveforms;times=waveform.time_ms;series=waveform.series;unit='ms';}
    else if(thermal){times=loaded.data.thermal.time_s;series=loaded.data.thermal.series.map(s=>({name:s.label,unit:'°C',values:s.temperature_c,id:s.id}));unit='s';}
    else {const c=currentCase();waveform=c[windowName==='cycles'?'switching_window':windowName==='event'?'event_window':'waveforms'] || c.waveforms;times=waveform.time_us;series=waveform.series;unit='µs';}
    seriesMap=Object.fromEntries(series.map(s=>[s.name,s]));index=Math.min(index,times.length-1);
    voltageSeriesByNet=Object.fromEntries(series.filter(s=>s.unit==='V'&&s.net).map(s=>[s.net,s]));
    q('#wb-study').value=study;q('#wb-quantity').value=quantity;q('#wb-window').value=windowName;
    q('#wb-scenario-controls').hidden=!startup;q('#wb-field-controls').hidden=quantity!=='magnetic';q('#wb-window-control').hidden=startup||thermal||boardPower;
    q('#wb-board-source-control').hidden=!boardPower;
    q('#wb-field-help').innerHTML=boardPower?'Averaged rail currents in assumed planar paths and returns. <a href="#magnetic">Whole-board B/H components, assumptions and probes ↗</a>':'Conditional U7 output-loop contribution. <a href="#magnetic">Open the whole-board scenario ↗</a>';
    q('#wb-thermal-controls').hidden=!thermal;
    q('#wb-time').min=times[0];q('#wb-time').max=times.at(-1);q('#wb-time').step='any';
    if(q('#wb-time-start'))q('#wb-time-start').textContent=`${fmt(times[0])} ${unit}`;
    if(q('#wb-time-end'))q('#wb-time-end').textContent=`${fmt(times.at(-1))} ${unit}`;
    if(!startup && !boardPower && !branchRefs.includes(selected) && quantity!=='placement')selected='L219';
    colorRange=quantity==='temperature'?[loaded.data.thermal.ambient_c,Math.max(...series.flatMap(s=>s.values))]:quantity==='current'?[0,Math.max(.01,...series.filter(s=>branchRefs.some(ref=>s.name===ref+' current')).flatMap(s=>s.values.map(Math.abs)))]:[0,Math.max(5,...series.filter(s=>s.unit==='V').flatMap(s=>s.values))];
    viewer?.setSelection(selected);
    paint();
  }
  function sample(name, at=index) {const v=seriesMap[name]?.values[at];return valid(v)?v:null;}
  function netVoltage(net,at=index) {
    if(!net || !isCurrent())return null;
    if(net==='GND')return 0;
    if(study==='startup')return voltageSeriesByNet[net]?.values[at] ?? null;
    if(study==='thermal')return null;
    return net==='SBC_SW_3V3'?sample('U7 switch node',at):net==='VCC_3V3_SBC'?sample('Local output voltage',at):null;
  }
  function component(ref) {return componentsByRef[ref];}
  function componentValue(ref, at=index) {
    const c=component(ref);if(!c || c.dnp || !isCurrent())return null;
    if(quantity==='temperature')return ref==='L219'?(series.find(s=>s.id===thermalCase)||series[0]).values[at]:null;
    if(quantity==='current')return branchRefs.includes(ref)&&!['startup','thermal'].includes(study)?sample(ref+' current',at):null;
    if(quantity==='voltage'){const active=netsByRef[ref].filter(net=>net!=='GND').map(net=>netVoltage(net,at));return active.some(valid)?math().knownMaximum([...active,...(netsByRef[ref].includes('GND')?[0]:[])]):null;}
    return null;
  }
  function fieldContext() {
    const boardPower=study==='board_power',magnetic=boardPower?loaded.boardField.magnetic:loaded.data.magnetic;
    const loops=magnetic.loops.filter(loop=>!boardPower || boardFieldSource==='all' || loop.id===boardFieldSource);
    const grid=magnetic.field_grids.find(g=>g.z_mm===Number(q('#wb-height').value)) || magnetic.field_grids[0];
    return {boardPower,magnetic,loops,grid:{...grid,kernels:grid.kernels.filter(k=>loops.some(loop=>loop.id===k.loop_id))}};
  }
  function fieldCurrent(loop,at=index) {
    const name=loop.current_series || loop.spice_current_series,s=seriesMap[name];
    if(study==='board_power' && (s?.unit!=='A' || s.net!==loop.net || s.values?.length!==times.length))return null;
    return sample(name,at);
  }
  function fieldAtSample() {
    const {boardPower,loops,grid}=fieldContext(),currents=Object.fromEntries(loops.map(loop=>[loop.id,fieldCurrent(loop)]));
    const field=math().sumMagnetic(grid,currents);if(!field)return null;
    // A conservative scale stays fixed across the selected saved time window.
    const key=[study,grid.z_mm,boardFieldSource].join(':');let bound=fieldBoundsCache.get(key);
    if(bound===undefined){bound=0;for(const k of grid.kernels){const loop=loops.find(l=>l.id===k.loop_id),values=times.map((_,i)=>fieldCurrent(loop,i));if(values.some(v=>!valid(v)))return null;const peak=values.reduce((a,b)=>Math.max(a,Math.abs(b)),0);let kp=0;for(let i=0;i<k.bx_nt_per_a.length;i++)kp=Math.max(kp,Math.hypot(k.bx_nt_per_a[i],k.by_nt_per_a[i],k.bz_nt_per_a[i]));bound+=kp*peak/1000;}fieldBoundsCache.set(key,bound);}
    fieldRange=[0,Math.max(boardPower?1e-9:1,bound)];
    return {...field,x_mm:grid.x_mm,y_mm:grid.y_mm,z_mm:grid.z_mm,nx:grid.nx,ny:grid.ny,range:fieldRange,logScale:boardPower,mode:q('#wb-field-display').value,opacity:Number(q('#wb-opacity').value),unit:'µT',label:boardPower?'Averaged power-current |B| · '+loaded.boardField.selected_run_id+' · '+(boardFieldSource==='all'?'sum of modeled contributions':boardFieldSource+' contribution'):'Conditional output-loop |B|'};
  }
  function paint() {
    if(!viewer || !times.length)return;
    const colors={},netColors={};let known=0;
    for(const c of loaded.layout.components){const value=componentValue(c.ref);if(valid(value))known++;colors[c.ref]=quantity==='placement'||quantity==='magnetic'?null:math().color(quantity==='current'&&valid(value)?Math.abs(value):value,...colorRange);}
    if(quantity==='voltage')for(const c of loaded.layout.components)for(const p of c.pads){const value=netVoltage(p.net);netColors[p.net]=math().color(value,...colorRange);}
    viewer.setOverlay(colors,{colorsByNet:netColors,mode:quantity,label:quantity==='voltage'?'Highest known pin potential':quantity});
    currentField=quantity==='magnetic'&&isCurrent()?fieldAtSample():null;viewer.setField(currentField);
    q('#wb-time').value=times[index];
    if(q('#wb-time-value'))q('#wb-time-value').textContent=`${fmt(times[index],6)} ${unit}`;
    if(q('#wb-known-count'))q('#wb-known-count').textContent=quantity==='magnetic'?(study==='board_power'?`Whole board · ${loaded.boardField.magnetic.loops.length} modeled rail loops`:'U7 region only'):quantity==='placement'?`${loaded.layout.components.length} native footprints`:`${known} / ${loaded.layout.components.filter(c=>!c.dnp&&!/^H\d+$/.test(c.ref)).length} quantities available`;
    const range=quantity==='magnetic'?fieldRange:colorRange,unitLabel=quantity==='voltage'?'V':quantity==='current'?'A magnitude':quantity==='temperature'?'°C':'µT';
    q('#wb-legend').innerHTML=quantity==='placement'?'<span>Native XY placement · package height proxies</span>':`<div class="wb-legend-ramp"></div><div class="wb-legend-values"><span>${fmt(range[0])}</span><strong>${esc(unitLabel)}</strong><span>${fmt(range[1])}</span></div><span class="wb-unknown-key">Gray = unknown · ${quantity==='voltage'?'body shows highest known pin potential':quantity==='current'?'probe retains current direction':quantity==='magnetic'?(study==='board_power'?'averaged rail field; fixed log scale':'saved local field; fixed scale'):'L219 illustrative node only'}</span>`;
    if(quantity==='magnetic'&&!currentField)q('#wb-legend').textContent='Field scale unavailable: source, input identity or required current samples are unknown.';
    paintScope();paintInspector();paintProbe();drawChart();
  }
  function paintScope() {
    if(!q('#wb-scope'))return;
    const thermal=loaded.data.thermal.series.find(s=>s.id===thermalCase)||loaded.data.thermal.series[0];
    const scope=study==='board_power'?`Averaged power-current field from saved ${loaded.boardField.selected_run_id}. Native terminal XY positions anchor assumed straight paths projected onto B.Cu and assumed subsurface returns. Each rail drives one aggregate load; signal, IC-internal and core fields are unresolved.`:study==='startup'?`Behavioral run ${state.result.id}. Rail voltages and aggregate loads use the saved scenario assumptions; no executed RK3566 boot.`:study==='thermal'?`L219-only assumed thermal RC: Rθ ${thermal.r_theta_k_per_w} K/W, Cθ ${thermal.c_theta_j_per_k} J/K, Ta ${loaded.data.thermal.ambient_c} °C; held DCR loss ${fmt(loaded.data.thermal.source_power_w*1000)} mW. Other temperatures remain unknown.`:'Fixed ideal-PWM U7 network. Actual TPS566242 control, protection, package and input hot-loop behavior are absent.';
    const extra=quantity==='magnetic'?(study==='board_power'?' Magnitude of the summed averaged field vector; no switching peak or RMS claim. Arrows show field direction.':' Magnetic slice uses saved signed current samples and conditional output-loop kernels. Arrows show vector direction, not particle flow.'):'';
    const flags=(currentCase()?.operating_point_flags||[]).map(f=>typeof f==='string'?f:f.detail||f.note||JSON.stringify(f)).join(' ');
    q('#wb-scope').textContent=(!isCurrent()?'SOURCE, INPUT OR MODEL CHANGED — quantitative overlays disabled. ':'')+scope+extra+' Study clocks are independent.'+(flags?' '+flags:'')+(visibility.explode_mm>0?' Exploded layers are a display offset; the quantitative magnetic slice is hidden.':'');
  }
  function selectComponent(ref) {if(!component(ref))return;selected=ref;fieldProbe=null;viewer?.setSelection(ref);paintInspector();paintProbe();drawChart();q('#wb-search').value=ref;searchComponents();}
  function searchComponents() {
    const term=q('#wb-search').value.trim().toLowerCase();
    const list=loaded.layout.components.filter(c=>!/^H\d+$/.test(c.ref)&&(!term||`${c.ref} ${c.value} ${c.pads.map(p=>p.net).join(' ')}`.toLowerCase().includes(term))).slice(0,term?14:8);
    q('#wb-search-results').innerHTML=list.map(c=>`<button type="button" data-wb-ref="${esc(c.ref)}" class="${c.ref===selected?'selected':''}"><strong>${esc(c.ref)}</strong><span>${esc(c.value)}</span><small>${c.side==='F'?'Front':'Back'}${c.dnp?' · DNP':''}</small></button>`).join('') || '<p>No matching component or net.</p>';
  }
  function paintInspector() {
    const c=component(selected);if(!c)return;
    const result=state.result.components.find(x=>x.ref===selected), nets=[...new Set(c.pads.map(p=>p.net).filter(Boolean))];
    const current=branchRefs.includes(selected)&&!['startup','thermal'].includes(study)&&isCurrent()?sample(selected+' current'):null;
    const temp=study==='thermal'&&selected==='L219'&&isCurrent()?(series.find(s=>s.id===thermalCase)||series[0]).values[index]:null;
    const activePotentials=nets.filter(n=>n!=='GND').map(n=>netVoltage(n));
    const v=activePotentials.some(valid)?math().knownMaximum([...activePotentials,...(nets.includes('GND')?[0]:[])]):null;
    const table=nets.slice(0,12).map(net=>`<tr><td>${esc(net)}</td><td>${fmt(netVoltage(net))} ${valid(netVoltage(net))?'V':''}</td></tr>`).join('');
    q('#wb-inspector').innerHTML=`<div class="wb-selected-heading"><span>${esc(c.ref)}</span><div><strong>${esc(c.value)}</strong><small>${c.side==='F'?'Front':'Back'} · ${fmt(c.x,2)}, ${fmt(c.y,2)} mm${c.dnp?' · DNP':''}</small></div></div><div class="wb-probe-values"><div><span>Highest known pin potential</span><strong>${fmt(v)} ${valid(v)?'V':''}</strong></div><div><span>Individual branch current</span><strong>${fmt(current)} ${valid(current)?'A':''}</strong></div><div><span>Illustrative temperature</span><strong>${fmt(temp)} ${valid(temp)?'°C':''}</strong></div></div><p class="wb-probe-note">${valid(current)?selected==='L219'?'Positive current: pad 2 (SW) → pad 1 (output).':'Positive current: pad 1 (output) → pad 2 (GND).':'An aggregate rail current is not an individual IC current.'}</p>${selected==='L219'&&!['startup','thermal','board_power'].includes(study)?`<p class="wb-probe-note">L219 terminal voltage: ${fmt(isCurrent()&&valid(sample('U7 switch node'))&&valid(sample('Local output voltage'))?sample('U7 switch node')-sample('Local output voltage'):null)} V · SW minus output.</p>`:''}<details open><summary>Connected nets · ${nets.length}</summary><table class="wb-probe-table"><tbody>${table}</tbody></table>${nets.length>12?`<p class="wb-probe-note">Showing 12 of ${nets.length} nets. <a href="#board">Inspect every pin ↗</a></p>`:''}</details><p class="wb-probe-note">${esc(result?.model || 'No qualified internal device model.')} Package height is a display proxy, not qualified mechanical CAD.</p>`;
  }
  function paintProbe() {
    if(!q('#wb-probe'))return;
    if(fieldProbe&&currentField){const i=fieldProbe.index;q('#wb-probe').innerHTML=`<strong>Nearest saved field node</strong><span>x ${fmt(fieldProbe.x_mm,2)}, y ${fmt(fieldProbe.y_mm,2)}, z ${fmt(fieldProbe.z_mm,2)} mm from B.Cu</span><b>|B| ${fmt(currentField.values[i],5)} µT · |H| ${fmt(currentField.values[i]*1e-6/(4*Math.PI*1e-7),5)} A/m</b><span>Bx ${fmt(currentField.bx[i])} · By ${fmt(currentField.by[i])} · Bz ${fmt(currentField.bz[i])} µT</span>`;return;}
    q('#wb-probe').innerHTML=`<strong>${esc(selected)} at ${fmt(times[index],6)} ${unit}</strong><span>${quantity==='voltage'?'Highest known pin potential':quantity==='current'?'Signed branch current':quantity==='temperature'?'Assumed thermal node':'Select a component or click the field slice'}</span>${['voltage','current','temperature'].includes(quantity)?`<b>${fmt(componentValue(selected))} ${quantity==='voltage'?'V':quantity==='current'?'A':'°C'}</b>`:''}`;
  }
  function refTrace(ref) {
    if(quantity==='temperature')return ref==='L219'?{name:'L219 central assumption',values:series[0].values,unit:'°C'}:null;
    if(quantity==='current')return seriesMap[ref+' current']?{...seriesMap[ref+' current'],name:ref+' signed current'}:null;
    if(quantity==='voltage'){if(!traceCache.has(ref))traceCache.set(ref,times.map((_,i)=>componentValue(ref,i)));return {name:ref+' highest pin potential',unit:'V',values:traceCache.get(ref)};}
    return null;
  }
  function traces() {
    if(study==='thermal')return series.map((s,i)=>({...s,name:i===0?'L219 · central assumption':s.name,color:palette[i%palette.length],dash:i>0}));
    if(quantity==='magnetic' && study==='board_power'){
      if(!isCurrent())return [];
      const {loops,grid}=fieldContext();
      if(fieldProbe){const point=fieldProbe.index,key=['board-probe',grid.z_mm,boardFieldSource,point].join(':');if(!traceCache.has(key))traceCache.set(key,times.map((_,at)=>{let bx=0,by=0,bz=0;for(const k of grid.kernels){const amp=fieldCurrent(loops.find(loop=>loop.id===k.loop_id),at);if(!valid(amp))return null;bx+=k.bx_nt_per_a[point]*amp/1000;by+=k.by_nt_per_a[point]*amp/1000;bz+=k.bz_nt_per_a[point]*amp/1000;}return Math.hypot(bx,by,bz);}));return [{name:'Averaged |B| at field probe',values:traceCache.get(key),unit:'µT',color:palette[0]}];}
      return loops.map(loop=>({name:loop.current_series || loop.spice_current_series,unit:'A',values:times.map((_,at)=>fieldCurrent(loop,at))})).filter(s=>s.values.every(valid)).sort((a,b)=>Math.max(...b.values.map(Math.abs))-Math.max(...a.values.map(Math.abs))).slice(0,4).map((s,i)=>({...s,color:palette[i%palette.length]}));
    }
    if(quantity==='magnetic')return ['L219 current','Load current'].map(name=>({...seriesMap[name],color:palette[name==='L219 current'?0:1]}));
    let result=[selected,...pinned.filter(r=>r!==selected)].map(refTrace).filter(t=>t&&t.values.some(valid));
    if(!result.length){const names=study==='startup'?['5V_SOC','VCC_3V3_SBC','VDD_CPU']:['L219 current','Load current'];result=names.map(name=>seriesMap[name]).filter(Boolean);}
    if(baseline&&study==='startup'&&quantity==='voltage'&&baseline.source_sha256===state.result.source_sha256&&baseline.engine_sha256===state.result.engine_sha256){const key='baseline:'+selected;const old=baseline.waveforms;if(!traceCache.has(key)){const byNet=Object.fromEntries(old.series.filter(s=>s.unit==='V').map(s=>[s.net,s]));traceCache.set(key,times.map(t=>{if(t<old.time_ms[0]||t>old.time_ms.at(-1))return null;const i=math().nearest(old.time_ms,t);const active=netsByRef[selected].filter(n=>n!=='GND').map(n=>byNet[n]?.values[i]);return active.some(valid)?math().knownMaximum([...active,...(netsByRef[selected].includes('GND')?[0]:[])]):null;}));}result.push({name:`${selected} baseline ${baseline.id}`,unit:'V',dash:true,values:traceCache.get(key)});}
    return result.slice(0,5).map((s,i)=>({...s,color:palette[i%palette.length]}));
  }
  function drawChart() {
    const container=q('#wb-chart');if(!container||!times.length)return;
    if(study==='board_power'&&quantity==='magnetic'&&!currentField){chartTraces=[];chartBounds=null;q('#wb-chart-unit').textContent='';container.innerHTML='<div class="wb-chart-empty">Quantitative field and current traces are unavailable.</div>';return;}
    chartTraces=traces();q('#wb-chart-unit').textContent=chartTraces[0]?.unit || '';q('#wb-pinned-probes').textContent=pinned.length?`Pinned: ${pinned.join(', ')}`:'';const width=Math.max(380,container.clientWidth),height=210,left=51,right=18,top=20,bottom=35;
    chartBounds={width,left,right};const all=chartTraces.flatMap(t=>t.values),[ymin,ymax]=math().range(all);
    const x=t=>left+(t-times[0])/(times.at(-1)-times[0]||1)*(width-left-right),y=v=>height-bottom-(v-ymin)/(ymax-ymin)*(height-top-bottom);
    const path=trace=>{let d='',active=false;const stride=Math.max(1,Math.floor(times.length/1200));for(let i=0;i<times.length;i+=stride){const v=trace.values[i];if(!valid(v)){active=false;continue;}d+=`${active?'L':'M'}${x(times[i]).toFixed(2)},${y(v).toFixed(2)}`;active=true;}const n=times.length-1;if(valid(trace.values[n]))d+=`${active?'L':'M'}${x(times[n]).toFixed(2)},${y(trace.values[n]).toFixed(2)}`;return d;};
    const tickY=Array.from({length:5},(_,i)=>{const v=ymin+(ymax-ymin)*i/4;return `<line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}" stroke="#29414e"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${fmt(v,2)}</text>`;}).join('');
    const tickX=Array.from({length:5},(_,i)=>{const t=times[0]+(times.at(-1)-times[0])*i/4;return `<text x="${x(t)}" y="${height-11}" text-anchor="middle">${fmt(t,2)}</text>`;}).join('');
    container.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Synchronized ${esc(chartTraces[0]?.unit || '')} traces; click to probe time"><g fill="#adc0cb" font-family="system-ui,sans-serif" font-size="11">${tickY}${tickX}<text x="${left}" y="13">${esc(chartTraces[0]?.unit || '')}</text><text x="${width-right}" y="13" text-anchor="end">Time (${unit})</text></g>${chartTraces.map(t=>`<path d="${path(t)}" fill="none" stroke="${t.color}" stroke-width="1.7" ${t.dash?'stroke-dasharray="5 4"':''}/>`).join('')}<line x1="${x(times[index])}" y1="${top}" x2="${x(times[index])}" y2="${height-bottom}" stroke="#ffffff" stroke-dasharray="3 3"/>${chartTraces.map(t=>valid(t.values[index])?`<circle cx="${x(times[index])}" cy="${y(t.values[index])}" r="3.5" fill="${t.color}" stroke="#dcebf1"/>`:'').join('')}</svg><div class="wb-chart-legend">${chartTraces.map(t=>`<span><i style="background:${t.color}"></i>${esc(t.name)} <b>${fmt(t.values[index])} ${esc(t.unit)}</b></span>`).join('')}</div><small class="wb-chart-note">${study==='thermal'?'Five assumed thermal parameter cases; not validated uncertainty bounds.':windowName==='full'&&!['startup','board_power'].includes(study)?'Full-window display is sampled; use Switching cycles for resolved edges.':'Cursor selects a saved sample; playback speed is independent of physical time.'}${!isCurrent()?' Historical data: source/model mismatch.':''}</small>`;
  }
  function updateLayers() {
    for(const input of document.querySelectorAll('[data-wb-visibility]'))visibility[input.dataset.wbVisibility]=input.checked;
    viewer?.setLayers({...visibility,visibleLayerIds:[...document.querySelectorAll('[data-wb-layer]:checked')].map(e=>Number(e.dataset.wbLayer))});
    if(q('#wb-explode-value'))q('#wb-explode-value').textContent=`${fmt(visibility.explode_mm,1)} mm display gap`;
    paintScope();
  }
  function play() {if(playing || !times.length)return;playing=true;lastFrame=performance.now();playPosition=index>=times.length-1?times[0]:times[index];q('#wb-play').textContent='Ⅱ Pause';q('#wb-play').setAttribute('aria-label','Pause simulation playback');frame=requestAnimationFrame(tick);}
  function pause() {playing=false;if(frame)cancelAnimationFrame(frame);frame=null;if(q('#wb-play')){q('#wb-play').textContent='▷ Play';q('#wb-play').setAttribute('aria-label','Play simulation playback');}}
  function tick(now) {if(!playing||!q('#wb-scene'))return;const span=times.at(-1)-times[0];playPosition+=span*(now-lastFrame)/14000*Number(q('#wb-speed').value || 1);lastFrame=now;index=math().nearest(times,Math.min(times.at(-1),playPosition));if(now-lastPaint>=50||playPosition>=times.at(-1)){paint();lastPaint=now;}if(playPosition>=times.at(-1)){pause();return;}frame=requestAnimationFrame(tick);}

  function previewExport(content,name,type) {
    pause();if(exportUrl)URL.revokeObjectURL(exportUrl);exportUrl=null;
    const image=q('#wb-export-image'),json=q('#wb-export-json'),link=q('#wb-export-download');image.hidden=type!=='image';json.hidden=type!=='json';
    if(type==='image')image.src=content;else {json.textContent=content;exportUrl=URL.createObjectURL(new Blob([content],{type:'application/json'}));}
    link.href=type==='image'?content:exportUrl;link.download=name;link.textContent=type==='image'?'Download PNG':'Download JSON';
    q('#wb-export-title').textContent=type==='image'?'Board view export':'Probe data export';q('#wb-export-description').textContent='Preview the saved sample and its model scope before downloading.';q('#wb-export-dialog').showModal();
  }
  function saveView() {
    const record={exported_at:new Date().toISOString(),source_sha256:loaded.layout.source_sha256,run_id:study==='startup'?state.result.id:null,study,quantity,window:windowName,time:times[index],time_unit:unit,sample_index:index,selected_component:selected,pinned_components:pinned,component_value:componentValue(selected),field_probe:fieldProbe,field_vector_uT:fieldProbe&&currentField?{bx:currentField.bx[fieldProbe.index],by:currentField.by[fieldProbe.index],bz:currentField.bz[fieldProbe.index]}:null,display:visibility,scope:q('#wb-scope').textContent,validation:'Exploring this view establishes no additional physical board validation.'};
    Object.assign(record,{engine_sha256:study==='startup'?state.result.engine_sha256:null,calculation_sha256:loaded.data.calculation_sha256,dataset_version:loaded.data.dataset_version,case_validity:currentCase()?.model_validity||null,operating_point_flags:currentCase()?.operating_point_flags||[],baseline_run_id:baseline?.id||null,baseline_engine_sha256:baseline?.engine_sha256||null,thermal_case:study==='thermal'?thermalCase:null,thermal_code_sha256:loaded.data.thermal.thermal_code_sha256,thermal_electrical_data_sha256:loaded.data.thermal.electrical_data_sha256,source_and_model_current:isCurrent()});
    if(study==='board_power')Object.assign(record,{selected_run_id:loaded.boardField.selected_run_id,engine_sha256:loaded.boardField.engine_sha256,calculation_sha256:loaded.boardField.calculation_sha256,model_code_sha256:loaded.boardField.model_code_sha256,current_source:boardFieldSource,assumptions:loaded.boardField.assumptions,limitations:loaded.boardField.limitations});
    previewExport(JSON.stringify(record,null,2),'RK3566-interactive-probe.json','json');
  }
  return {render,mount,cleanup,updateState,isRunning:()=>busy};
})();
