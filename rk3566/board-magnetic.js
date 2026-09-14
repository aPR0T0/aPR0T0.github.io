/* Whole-board field display. Signed kernels and current samples come from the saved model. */
"use strict";
window.BoardMagnetic=(()=>{
  const q=s=>document.querySelector(s), esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const finite=v=>typeof v==="number"&&Number.isFinite(v),fmt=(v,n=3)=>finite(v)?v.toLocaleString(undefined,{maximumFractionDigits:n}):"Unknown";
  const list=v=>Array.isArray(v)?v:v==null?[]:[v],prose=v=>typeof v==="string"?v:v?.detail||v?.description||v?.note||JSON.stringify(v),math=()=>window.WorkbenchMath;
  const H_PER_UT=1e-6/(4*Math.PI*1e-7);
  let data=null,layout=null,state=null,generation=0,observer=null,index=0,height=1,source="all",kind="b",showLoops=true,showVectors=false;
  let playing=false,animation=null,lastStamp=0,cursor=0,lastPaint=0,snapshot=null,bounds=null,point=null,scale=1,waveIndex={},traceCache=new Map(),scaleCache=new Map(),downloads=[],raster=null;
  const isH=()=>kind.startsWith("h"),axis=()=>kind.length>1?kind.at(-1):"magnitude",unit=()=>isH()?"A/m":"µT",convert=v=>v*(isH()?H_PER_UT:1);
  const label=()=>axis()==="magnitude"?(isH()?"|H|":"|B|"):kind[0].toUpperCase()+kind[1];
  const times=()=>data?.waveforms?.time_ms||[],magnetic=()=>data?.magnetic||{},grid=()=>magnetic().field_grids?.find(g=>g.z_mm===height)||magnetic().field_grids?.[0];
  const loops=()=>(magnetic().loops||[]).filter(l=>source==="all"||l.id===source),currentName=l=>l.current_series||l.spice_current_series;
  function current(loop,at=index){const s=waveIndex[currentName(loop)];return s?.unit==="A"&&s.net===loop.net&&s.values?.length===times().length?s.values[at]:null;}
  function currentSource(){return math().boardSourceMatches(data,layout,state);}
  async function get(path){const r=await(window.RKSnapshot?window.RKSnapshot.fetch(path):fetch(path,{cache:"no-store"}));const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||"Unable to load the whole-board analysis.");return d;}
  function render(){return '<section class="bm-workspace" aria-label="Whole-board magnetic field analysis"><div id="bm-loading" class="em-loading"><span class="spinner"></span><strong>Loading the whole-board magnetic scenario</strong><p>Matching saved rail currents to the field model and PCB.</p></div><div id="bm-content" hidden></div></section>';}
  function cleanup(){generation++;pause();observer?.disconnect();observer=null;downloads.forEach(URL.revokeObjectURL);downloads=[];}
  async function mount(currentState){
    state=currentState;const token=generation;
    try{[data,layout]=await Promise.all([get("/api/board-magnetic-field"),get("/api/board-layout")]);if(token!==generation||!q("#bm-content"))return;
      const g=grid();if(!g||!times().length)throw new Error("Saved field grids or current samples are unavailable.");
      if(!magnetic().field_grids.some(g=>g.z_mm===height))height=g.z_mm;if(source!=="all"&&!magnetic().loops.some(l=>l.id===source))source="all";
      waveIndex=Object.fromEntries(data.waveforms.series.map(s=>[s.name,s]));index=times().length-1;point={x:(g.x_mm[0]+g.x_mm.at(-1))/2,y:(g.y_mm[0]+g.y_mm.at(-1))/2};
      traceCache.clear();scaleCache.clear();raster=null;build();q("#bm-loading").hidden=true;q("#bm-content").hidden=false;
      observer=new ResizeObserver(()=>{raster=null;drawMap();});observer.observe(q("#bm-map"));requestAnimationFrame(paint);
    }catch(e){if(token===generation&&q("#bm-loading"))q("#bm-loading").innerHTML="<strong>Whole-board analysis is unavailable</strong><p>"+esc(e.message)+"</p>";}
  }
  function build(){
    const count=magnetic().loops.length,b=layout.bounds;
    q("#bm-content").innerHTML=`
      <div class="bm-banner"><div><div class="em-overline">WHOLE-BOARD MAGNETIC SCENARIO</div><h2>Averaged power-current field across the PCB</h2><p>${count} saved rail-current envelopes drive assumed closed paths over the ${fmt(b.width)} × ${fmt(b.height)} mm board.</p></div><span class="badge warning">Conditional estimate</span></div>
      <div class="bm-scope"><strong>Averaged power currents · saved ${esc(data.selected_run_id)}</strong><p>${esc(data.scope)}</p><p>Only the terminal XY positions come from the PCB. All forward paths are projected onto the B.Cu center plane; straight transport paths, aggregate loads and subsurface returns are assumed. Signal, IC-internal, cable and magnetic-core fields remain unresolved.</p><a href="#time-em">U7 switching experiment ↗</a><a href="#workbench">Explore the field in 3D ↗</a></div>
      <div id="bm-guard" class="bm-guard" role="status" hidden>Source or model changed. Quantitative fields and probes are disabled until the saved analysis is rebuilt.</div>
      <div class="bm-grid"><section class="panel bm-map-panel"><div class="panel-heading"><div><h2>Whole-board magnetic field</h2><p id="bm-map-subtitle"></p></div><span class="small-tag">${fmt(b.width)} × ${fmt(b.height)} mm</span></div>
        <div class="bm-controls"><label>Field quantity<select id="bm-kind">${[["b","|B| · µT"],["bx","Bx · µT"],["by","By · µT"],["bz","Bz · µT"],["h","|H| · A/m"],["hx","Hx · A/m"],["hy","Hy · A/m"],["hz","Hz · A/m"]].map(([v,s])=>`<option value="${v}" ${kind===v?"selected":""}>${s}</option>`).join("")}</select></label>
        <label>Height from B.Cu center<select id="bm-height">${magnetic().field_grids.map(g=>`<option value="${g.z_mm}" ${height===g.z_mm?"selected":""}>${g.z_mm} mm outward</option>`).join("")}</select></label>
        <label class="bm-source-control">Current source<select id="bm-source"><option value="all">All ${count} modeled rail loops</option>${magnetic().loops.map(l=>`<option value="${esc(l.id)}" ${source===l.id?"selected":""}>${esc(l.net||l.name||l.id)}</option>`).join("")}</select></label></div>
        <div class="bm-map-stage"><canvas id="bm-map" role="img" aria-label="Whole-board magnetic field in native PCB top-view coordinates; click to place a probe"></canvas><div class="bm-map-caption">NATIVE PCB TOP-VIEW COORDINATES<span>Probe plane is outward from the back copper</span></div></div><div id="bm-legend" class="bm-legend"></div>
        <div class="bm-map-options"><label><input id="bm-loops" type="checkbox" ${showLoops?"checked":""}>Assumed transport and return paths</label><label><input id="bm-vectors" type="checkbox" ${showVectors?"checked":""}>In-plane field direction</label></div><div class="bm-path-key"><span><i></i>Assumed transport</span><span><i class="return"></i>Assumed return</span><span>Package outlines retain native XY positions.</span></div></section>
        <aside class="bm-inspector"><section class="panel"><div class="panel-heading"><div><h2>Field probe</h2><p>Click anywhere on the board map.</p></div></div><div id="bm-probe" class="bm-probe" aria-live="polite"></div><div class="bm-probe-picker"><label for="bm-probe-preset">Saved position</label><select id="bm-probe-preset"><option value="center">Board center</option>${list(magnetic().probes).map((p,i)=>`<option value="${i}">${esc(p.name||"Probe "+(i+1))}</option>`).join("")}<option value="custom" hidden>Map selection</option></select><small>Map height applies to every selected position.</small></div></section>
        <section class="panel"><div class="panel-heading"><div><h2>Currents at this sample</h2><p id="bm-current-time"></p></div></div><div id="bm-currents" class="bm-currents"></div><p class="bm-current-note">Each channel drives one aggregate loop. These currents are not summed as a board supply current.</p></section></aside></div>
      <section class="panel bm-time-panel"><div class="panel-heading"><div><h2 id="bm-trace-title">Probe through time</h2><p>Saved rail-current clock in milliseconds · independent of U7 switching playback</p></div><span class="small-tag">${times().length.toLocaleString()} SAMPLES</span></div><div id="bm-trace" class="bm-trace"></div>
      <div class="bm-timeline"><button id="bm-play" class="button secondary" type="button" aria-label="Play whole-board magnetic samples">▷ Play</button><div><span>SELECTED SAMPLE</span><strong id="bm-time-value"></strong></div><input id="bm-time" type="range" min="0" max="${times().length-1}" step="1" value="${index}" aria-label="Whole-board saved current sample"><span>${fmt(times()[0])}–${fmt(times().at(-1))} ms</span></div><p class="bm-time-note">Signed fields from averaged rail currents are added before taking magnitude. This is the magnitude of the averaged vector, not a switching peak, RMS or average field magnitude. H = B/µ₀ in modeled air.</p></section>
      <section class="panel bm-evidence"><div class="panel-heading"><div><h2>What defines this estimate</h2><p>Current source, assumed geometry and numerical checks</p></div><button id="bm-export" type="button" class="button secondary">↓ Export probe</button></div><div class="bm-evidence-body"><div class="bm-evidence-summary">${list(magnetic().notes).slice(0,3).map(n=>`<p>${esc(prose(n))}</p>`).join("")}</div>
      <details><summary>Current coverage and geometry assumptions</summary><p id="bm-coverage"></p>${list(data.assumptions).map(n=>`<p>${esc(prose(n))}</p>`).join("")}</details><details><summary>Model limits</summary>${list(data.limitations).map(n=>`<p>${esc(prose(n))}</p>`).join("")}</details><details><summary>Numerical verification</summary>${list(magnetic().validation?.checks).map(c=>`<p><strong>${esc(c.status||"Recorded")} · ${esc(c.title||c.name||c.id)}</strong><br>${esc(prose(c))}</p>`).join("")}</details>
      <div class="bm-downloads"><a href="/api/board-magnetic-report" data-snapshot-href="/api/board-magnetic-report" download="WHOLE_BOARD_MAGNETIC_ANALYSIS.md">↓ Read the magnetic analysis</a><a href="/api/board-magnetic-field" data-snapshot-href="/api/board-magnetic-field" download="RK3566-whole-board-magnetic.json">↓ Complete field data and assumptions</a><span>Saved ${esc(data.selected_run_id)} · PCB ${esc(data.source_sha256?.slice(0,12))}</span></div></div></section>`;
    const coverage=data.coverage||{};q("#bm-coverage").textContent=typeof coverage==="string"?coverage:`${coverage.modeled_rail_count??count} modeled rail loops out of ${coverage.rail_count??data.waveforms.series.filter(s=>s.unit==="A").length} saved rail channels. ${list(coverage.unsupported_rails).map(r=>r.net+": "+r.reason).join(" ")} Other signal and device-internal currents are not included.`;
    bind();drawTrace();
  }
  function selectedKernels(){const ids=new Set(loops().map(l=>l.id));return grid().kernels.filter(k=>ids.has(k.loop_id));}
  function field(){if(!currentSource()||!loops().length)return null;return math().sumMagnetic({...grid(),kernels:selectedKernels()},Object.fromEntries(loops().map(l=>[l.id,current(l)])));}
  function fieldValue(f,i){return convert(axis()==="magnitude"?f.values[i]:f["b"+axis()][i]);}
  function bound(){
    const key=height+":"+source;if(scaleCache.has(key))return scaleCache.get(key);let result=0;
    for(const k of selectedKernels()){const loop=loops().find(l=>l.id===k.loop_id),values=times().map((_,i)=>current(loop,i));if(!values.length||values.some(v=>!finite(v)))return null;
      const peak=values.reduce((a,b)=>Math.max(a,Math.abs(b)),0);let coefficient=0;for(let i=0;i<k.bx_nt_per_a.length;i++)coefficient=Math.max(coefficient,Math.hypot(k.bx_nt_per_a[i],k.by_nt_per_a[i],k.bz_nt_per_a[i]));result+=peak*coefficient/1000;
    }result=Math.max(result,1e-9);scaleCache.set(key,result);return result;
  }
  function pointIndex(){const g=grid();return math().nearest(g.y_mm,point.y)*g.x_mm.length+math().nearest(g.x_mm,point.x);}
  function paint(){
    if(!q("#bm-map"))return;const valid=currentSource();q("#bm-guard").hidden=valid;snapshot=field();scale=valid?bound():null;q("#bm-time").value=index;q("#bm-time-value").textContent=fmt(times()[index],4)+" ms";
    q("#bm-current-time").textContent="Saved "+data.selected_run_id+" · "+fmt(times()[index],4)+" ms";q("#bm-map-subtitle").textContent=(source==="all"?"Sum of available modeled rail contributions":source+" contribution")+" · "+height+" mm from B.Cu center";
    q("#bm-currents").innerHTML=loops().map(l=>`<div><span>${esc(l.net||l.name||l.id)}</span><strong>${valid?fmt(current(l),4):"Unknown"}${valid&&finite(current(l))?" A":""}</strong></div>`).join("");drawMap();paintProbe();updateCursor();
  }
  function palette(v,signed){
    if(signed){const a=Math.min(1,Math.abs(v)),target=v<0?[85,157,242]:[244,154,113];return[31,59,71].map((x,i)=>Math.round(x+(target[i]-x)*a));}
    const stops=[[16,41,55],[28,85,109],[41,138,148],[84,188,154],[204,214,139],[244,183,84]],p=Math.min(.999999,Math.max(0,v))*(stops.length-1),i=Math.floor(p),f=p-i;return stops[i].map((v,j)=>Math.round(v+(stops[i+1][j]-v)*f));
  }
  function drawMap(){
    const canvas=q("#bm-map");if(!canvas)return;const box=canvas.getBoundingClientRect(),w=Math.max(280,box.width),h=Math.max(320,box.height),dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#102b38";ctx.fillRect(0,0,w,h);const g=grid();if(!g)return;
    const x0=g.x_mm[0],x1=g.x_mm.at(-1),y0=g.y_mm[0],y1=g.y_mm.at(-1),factor=Math.min((w-78)/(x1-x0),(h-106)/(y1-y0)),p={x:47+(w-78-factor*(x1-x0))/2,y:55,w:factor*(x1-x0),h:factor*(y1-y0)};
    bounds={...p,x0,x1,y0,y1};const X=x=>p.x+(x-x0)*factor,Y=y=>p.y+(y-y0)*factor;
    if(snapshot&&finite(scale)){
      const ow=Math.ceil(p.w),oh=Math.ceil(p.h),key=ow+":"+oh+":"+height;if(raster?.key!==key){const off=document.createElement("canvas");off.width=ow;off.height=oh;raster={key,off,ctx:off.getContext("2d"),xs:Array.from({length:ow},(_,i)=>math().nearest(g.x_mm,x0+(i+.5)/ow*(x1-x0))),ys:Array.from({length:oh},(_,i)=>math().nearest(g.y_mm,y0+(i+.5)/oh*(y1-y0)))};}
      const c=raster,image=c.ctx.createImageData(ow,oh),signed=axis()!=="magnitude",max=convert(scale),colors=Array.from(snapshot.values,(_,i)=>{const v=fieldValue(snapshot,i);return palette(signed?v/max:Math.log1p(Math.max(0,v)/max*1000)/Math.log1p(1000),signed);});
      for(let iy=0;iy<oh;iy++)for(let ix=0;ix<ow;ix++){const color=colors[c.ys[iy]*g.x_mm.length+c.xs[ix]],i=(iy*ow+ix)*4;image.data[i]=color[0];image.data[i+1]=color[1];image.data[i+2]=color[2];image.data[i+3]=255;}c.ctx.putImageData(image,0,0);ctx.drawImage(c.off,p.x,p.y,p.w,p.h);
    }else{ctx.fillStyle="#b7c9d0";ctx.font="12px system-ui";ctx.textAlign="center";ctx.fillText("Quantitative field unavailable",w/2,h/2);}
    ctx.save();ctx.beginPath();ctx.rect(p.x,p.y,p.w,p.h);ctx.clip();
    for(const c of layout.components){const b=c.bounds;if(!b)continue;ctx.strokeStyle="#d1e6d337";ctx.lineWidth=.55;ctx.strokeRect(X(b.x),Y(b.y),b.width*factor,b.height*factor);if(/^U[1-9]$/.test(c.ref)||c.ref==="L219"){ctx.fillStyle="#eff7e7";ctx.font="9px ui-monospace,monospace";ctx.textAlign="center";ctx.fillText(c.ref,X(c.x),Y(c.y)-3);}}
    if(showLoops)for(const loop of loops())for(const s of loop.segments||[]){const returning=/return/.test(s.provenance||"");ctx.strokeStyle=returning?"#e6abc37c":"#f6dc9899";ctx.setLineDash(returning?[3,3]:[7,3]);ctx.lineWidth=source==="all"?.8:1.7;ctx.beginPath();ctx.moveTo(X(s.start[0]),Y(s.start[1]));ctx.lineTo(X(s.end[0]),Y(s.end[1]));ctx.stroke();}
    ctx.setLineDash([]);
    if(showVectors&&snapshot){const stride=Math.max(1,Math.ceil(Math.max(g.x_mm.length,g.y_mm.length)/17));ctx.strokeStyle="#eff8eaad";ctx.lineWidth=.8;for(let iy=1;iy<g.y_mm.length-1;iy+=stride)for(let ix=1;ix<g.x_mm.length-1;ix+=stride){const i=iy*g.x_mm.length+ix,dx=snapshot.bx[i],dy=snapshot.by[i],length=Math.hypot(dx,dy);if(length<1e-14)continue;const ux=dx/length,uy=dy/length,x=X(g.x_mm[ix]),y=Y(g.y_mm[iy]),n=5;ctx.beginPath();ctx.moveTo(x-ux*n,y-uy*n);ctx.lineTo(x+ux*n,y+uy*n);ctx.lineTo(x+ux*(n-3)-uy*2,y+uy*(n-3)+ux*2);ctx.moveTo(x+ux*n,y+uy*n);ctx.lineTo(x+ux*(n-3)+uy*2,y+uy*(n-3)-ux*2);ctx.stroke();}}
    const i=pointIndex(),px=X(g.x_mm[i%g.x_mm.length]),py=Y(g.y_mm[Math.floor(i/g.x_mm.length)]);ctx.strokeStyle="#fff";ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.moveTo(px-10,py);ctx.lineTo(px+10,py);ctx.moveTo(px,py-10);ctx.lineTo(px,py+10);ctx.stroke();ctx.restore();
    ctx.strokeStyle="#b6d4c675";ctx.lineWidth=1;ctx.strokeRect(p.x,p.y,p.w,p.h);ctx.font="9px ui-monospace,monospace";ctx.fillStyle="#91b6c0";for(let i=0;i<=5;i++){const f=i/5;ctx.textAlign="center";ctx.fillText(fmt(x0+f*(x1-x0),1),p.x+f*p.w,p.y+p.h+18);ctx.textAlign="right";ctx.fillText(fmt(y0+f*(y1-y0),1),p.x-9,p.y+f*p.h+3);}ctx.textAlign="right";ctx.fillText("Native x (mm)",p.x+p.w,p.y+p.h+33);ctx.textAlign="left";ctx.fillText("y (mm)",7,p.y-10);
    if(!snapshot || !finite(scale)){q("#bm-legend").textContent="Field scale unavailable · source identity or required currents are unknown.";return;}
    const max=convert(scale),signed=axis()!=="magnitude";q("#bm-legend").innerHTML=`<span>${signed?"−"+fmt(max):"0"} ${unit()}</span><i class="${signed?"bm-diverging":"bm-ramp"}"></i><span>${fmt(max)} ${unit()}</span><small>${signed?"Linear, signed":"Logarithmic magnitude"} scale · fixed through time for this source and height · nearest saved grid node</small>`;
  }
  function paintProbe(){
    if(!q("#bm-probe"))return;const i=pointIndex(),g=grid(),x=g.x_mm[i%g.x_mm.length],y=g.y_mm[Math.floor(i/g.x_mm.length)];
    q("#bm-probe").innerHTML=`<span>x ${fmt(x,2)} · y ${fmt(y,2)} · z ${fmt(height)} mm</span>${snapshot?`<strong>${label()} ${fmt(fieldValue(snapshot,i),5)} <small>${unit()}</small></strong><p>|B| ${fmt(snapshot.values[i],5)} µT · |H| ${fmt(snapshot.values[i]*H_PER_UT,5)} A/m</p><dl><dt>Bx</dt><dd>${fmt(snapshot.bx[i],5)} µT</dd><dt>By</dt><dd>${fmt(snapshot.by[i],5)} µT</dd><dt>Bz</dt><dd>${fmt(snapshot.bz[i],5)} µT</dd></dl>`:'<strong>Unknown</strong><p>Required source identity or current samples are unavailable.</p>'}`;
  }
  function probeTrace(){
    if(!currentSource())return [];const i=pointIndex(),key=[height,source,kind,i].join(":");if(traceCache.has(key))return traceCache.get(key);const kernels=selectedKernels(),byId=Object.fromEntries(loops().map(l=>[l.id,l]));
    const values=times().map((_,at)=>{let bx=0,by=0,bz=0;for(const k of kernels){const amp=current(byId[k.loop_id],at);if(!finite(amp))return null;bx+=k.bx_nt_per_a[i]*amp/1000;by+=k.by_nt_per_a[i]*amp/1000;bz+=k.bz_nt_per_a[i]*amp/1000;}return convert(axis()==="magnitude"?Math.hypot(bx,by,bz):({x:bx,y:by,z:bz})[axis()]);});traceCache.set(key,values);return values;
  }
  function drawTrace(){
    const container=q("#bm-trace");if(!container)return;const values=probeTrace(),t=times(),w=960,h=176,p={l:58,r:25,t:19,b:30};q("#bm-trace-title").textContent=label()+" at the selected probe, through time";
    if(!values.some(finite)){container.innerHTML='<p class="bm-trace-empty">Field trace unavailable: current samples or model identity are unknown.</p>';return;}
    let low=0,high=0;for(const v of values)if(finite(v)){low=Math.min(low,v);high=Math.max(high,v);}const pad=Math.max((high-low)*.06,Math.abs(high)*.02,1e-8);low-=pad;high+=pad;
    const X=v=>p.l+(v-t[0])/(t.at(-1)-t[0]||1)*(w-p.l-p.r),Y=v=>p.t+(high-v)/(high-low)*(h-p.t-p.b);let d="",active=false;values.forEach((v,i)=>{if(!finite(v)){active=false;return;}d+=(active?"L":"M")+X(t[i]).toFixed(2)+","+Y(v).toFixed(2);active=true;});
    let ticks="";for(let i=0;i<5;i++){const f=i/4,v=low+f*(high-low),time=t[0]+f*(t.at(-1)-t[0]);ticks+=`<line x1="${p.l}" y1="${Y(v)}" x2="${w-p.r}" y2="${Y(v)}" stroke="#e4ecef"/><text x="${p.l-10}" y="${Y(v)+3}" text-anchor="end">${fmt(v,4)}</text><text x="${X(time)}" y="${h-10}" text-anchor="middle">${fmt(time,2)}</text>`;}
    container.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label()} probe trace in ${unit()} over milliseconds; click to choose time"><g fill="#7e98a4" font-size="9" font-family="system-ui">${ticks}<text x="${p.l}" y="11">${unit()}</text><text x="${w-p.r}" y="11" text-anchor="end">Time (ms)</text></g><path d="${d}" fill="none" stroke="#1a9f91" stroke-width="1.8"/><line id="bm-chart-cursor" y1="${p.t}" y2="${h-p.b}" stroke="#396b7a" stroke-dasharray="3 3"/></svg>`;
    container.querySelector("svg").addEventListener("click",e=>{pause();const b=e.currentTarget.getBoundingClientRect(),f=Math.max(0,Math.min(1,((e.clientX-b.left)/b.width*w-p.l)/(w-p.l-p.r)));index=math().nearest(t,t[0]+f*(t.at(-1)-t[0]));paint();});updateCursor();
  }
  function updateCursor(){const t=times(),line=q("#bm-chart-cursor");if(line){const x=58+(t[index]-t[0])/(t.at(-1)-t[0]||1)*(960-58-25);line.setAttribute("x1",x);line.setAttribute("x2",x);}}
  function bind(){
    q("#bm-kind").addEventListener("change",e=>{kind=e.target.value;drawTrace();paint();});q("#bm-height").addEventListener("change",e=>{height=Number(e.target.value);raster=null;drawTrace();paint();});q("#bm-source").addEventListener("change",e=>{source=e.target.value;drawTrace();paint();});
    q("#bm-loops").addEventListener("change",e=>{showLoops=e.target.checked;drawMap();});q("#bm-vectors").addEventListener("change",e=>{showVectors=e.target.checked;drawMap();});q("#bm-time").addEventListener("input",e=>{pause();index=Number(e.target.value);paint();});q("#bm-play").addEventListener("click",()=>playing?pause():play());
    q("#bm-map").addEventListener("click",e=>{if(!bounds)return;const b=e.target.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,p=bounds;if(x<p.x||x>p.x+p.w||y<p.y||y>p.y+p.h)return;point={x:p.x0+(x-p.x)/p.w*(p.x1-p.x0),y:p.y0+(y-p.y)/p.h*(p.y1-p.y0)};q("#bm-probe-preset").value="custom";drawTrace();drawMap();paintProbe();});
    q("#bm-probe-preset").addEventListener("change",e=>{const g=grid(),position=magnetic().probes?.[Number(e.target.value)]?.position_mm;point=Array.isArray(position)?{x:position[0],y:position[1]}:{x:(g.x_mm[0]+g.x_mm.at(-1))/2,y:(g.y_mm[0]+g.y_mm.at(-1))/2};drawTrace();drawMap();paintProbe();});q("#bm-export").addEventListener("click",exportProbe);
  }
  function exportProbe(){
    pause();const i=pointIndex(),g=grid(),record={study:"whole-board averaged power-current scenario",selected_run_id:data.selected_run_id,source_sha256:data.source_sha256,model_code_sha256:data.model_code_sha256,calculation_sha256:data.calculation_sha256,engine_sha256:data.engine_sha256,source_and_model_current:currentSource(),time_ms:times()[index],sample_index:index,current_source:source,position_mm:[g.x_mm[i%g.x_mm.length],g.y_mm[Math.floor(i/g.x_mm.length)],height],B_uT:snapshot?{x:snapshot.bx[i],y:snapshot.by[i],z:snapshot.bz[i],magnitude:snapshot.values[i]}:null,H_A_per_m:snapshot?{x:snapshot.bx[i]*H_PER_UT,y:snapshot.by[i]*H_PER_UT,z:snapshot.bz[i]*H_PER_UT,magnitude:snapshot.values[i]*H_PER_UT}:null,probe_trace:{quantity:label(),unit:unit(),time_ms:times(),values:probeTrace()},scope:data.scope,assumptions:data.assumptions,limitations:data.limitations};
    const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:"application/json"}));downloads.push(url);const a=document.createElement("a");a.href=url;a.download="RK3566-whole-board-magnetic-probe.json";document.body.append(a);a.click();a.remove();
  }
  function pause(){playing=false;if(animation!==null)cancelAnimationFrame(animation);animation=null;if(q("#bm-play")){q("#bm-play").textContent="▷ Play";q("#bm-play").setAttribute("aria-label","Play whole-board magnetic samples");}}
  function play(){if(!times().length)return;playing=true;const t=times();if(index>=t.length-1)index=0;cursor=t[index];lastStamp=performance.now();lastPaint=0;q("#bm-play").textContent="Ⅱ Pause";q("#bm-play").setAttribute("aria-label","Pause whole-board magnetic samples");
    const tick=stamp=>{if(!playing||!q("#bm-map")){pause();return;}cursor+=(t.at(-1)-t[0])*(stamp-lastStamp)/14000;lastStamp=stamp;index=math().nearest(t,Math.min(cursor,t.at(-1)));if(stamp-lastPaint>100||cursor>=t.at(-1)){paint();lastPaint=stamp;}if(cursor>=t.at(-1)){pause();return;}animation=requestAnimationFrame(tick);};animation=requestAnimationFrame(tick);}
  return {render,mount,cleanup};
})();
