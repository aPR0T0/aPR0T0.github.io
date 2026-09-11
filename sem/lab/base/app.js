import { DEFAULTS, calculate, EQUATIONS, updatePressure } from './physics.js';
import { ColumnView } from './column.js';
import { PRESETS, DEFAULT_PROGRAM, compileProgram, scanPoint, generateFirmware, parseFirmwareConfig, CONFIG_HINTS } from './scan.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { ...DEFAULTS };
const status = { beamOn: true, roughing: true, turbo: true, scanPoint: { x: 0, y: 0, blank: false }, selected: 'gun' };
let derived = calculate(state);
let paused = false, requestedBeam = true, currentPage = 'lab', selectedComponent = 'gun', simulationTime = 0;
let scanIndex = 0, frameCount = 0, sampleRemainder = 0, path = null, customPath = null, pathVersion = 0;
let activeEditor = 'trajectory', trajectoryCode = DEFAULT_PROGRAM, firmwareCode = '', firmwareDirty = false;
let currentEquation = null, popoverPinned = false, popoverTimer, toastTimer;
let guideIndex = 0;
const guideCompleted = new Set();
const sourceConfig = [
  ['voltage','Acceleration voltage',1,5,.1,'kV','Negative cathode; grounded anode'],
  ['heaterPower','Filament heating',0,5,.05,'W','Illustrative tungsten heat balance'],
  ['wehnelt','Wehnelt bias',-300,0,5,'V','Relative to the cathode'],
];
const opticsConfig = [
  ['aperture','Aperture / slit diameter',10,300,5,'µm','Circular aperture in this model'],
  ['lensCurrent','Magnetic lens current',0,.9,.005,'A',''],
  ['workingDistance','Post-plate drift',5,50,1,'mm','Scan plate exit to specimen'],
  ['plateVoltage','X plate offset',-50,50,1,'V','Model alignment offset; separate hardware bias'],
  ['scanAmplitude','Scan amplitude',1,100,1,'V','Peak differential plate command'],
  ['plateGap','Plate gap',3,20,.5,'mm',''],
  ['plateLength','Plate length',5,40,1,'mm',''],
];
const vacuumConfig = [
  ['pumpSpeed','Turbo pumping speed',1,100,1,'L/s','Nominal speed at pump inlet'],
  ['chamberVolume','Chamber volume',1,30,1,'L',''],
  ['conductance','Line conductance',1,30,.5,'L/s','Effective speed is conductance-limited'],
  ['gasLoad','Gas load / leak',-8,-2,.25,'mbar·L/s','Logarithmic control',true],
];
const detectorConfig = [
  ['pmtVoltage','Photomultiplier bias',400,1100,10,'V','Model: 10 dynodes; gain calibrated at 800 V'],
  ['collectionBias','Collection cage bias',0,400,10,'V','Positive bias attracts secondary electrons'],
  ['dwell','Pixel dwell',20,1000,10,'µs','Longer dwell increases electron counts'],
];
const programConfig = [
  ['resolution','Pixels per side',2,512,1,'px','N × N samples per frame'],
  ['dwell','Beam-on dwell',20,1000,10,'µs','Frame minimum includes settling and retrace'],
  ['scanAmplitude','Scan amplitude',1,100,1,'V','Peak command to differential scan amplifiers'],
];
function formatNumber(value, digits=2) { return Number.isFinite(value) ? value.toLocaleString('en-US',{maximumFractionDigits:digits}) : '—'; }
function exp(value, digits=2) { return Number.isFinite(value) ? value.toExponential(digits).replace('e-',' × 10⁻').replace('e+',' × 10^') : '—'; }
function sci(value, digits=2) { return Number.isFinite(value) ? value.toExponential(digits) : '—'; }
function renderControls(target,configs){
  configs.forEach(([key,label,min,max,step,unit,hint,log])=>{
    const value=log?Math.log10(state[key]):state[key];
    const id=`${target.replace('#','')}-${key}`;
    const el=document.createElement('div');el.className='control';
    el.innerHTML=`<div class="control-label"><label for="${id}">${label}</label><div class="input-value"><input class="numeric-value" aria-label="${label} value" data-number="${key}" data-log="${!!log}" type="number" step="${log?'any':step}" min="${log?10**min:min}" max="${log?10**max:max}" value="${state[key]}"><span>${unit}</span></div></div><input id="${id}" aria-label="${label}" data-param="${key}" data-log="${!!log}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><div class="range-labels"><span>${log?'10⁻⁸':min}${log?'':' '+unit}</span><span>${log?'10⁻²':max}${log?'':' '+unit}</span></div>${hint?`<p class="control-hint">${hint}</p>`:''}`;
    $(target).append(el);
  });
}
renderControls('#source-sliders',sourceConfig);renderControls('#optics-sliders',opticsConfig);renderControls('#vacuum-sliders',vacuumConfig);renderControls('#detector-sliders',detectorConfig);renderControls('#program-sliders',programConfig);
function syncControls(){
  $$('[data-param]').forEach(el=>{const value=el.dataset.log==='true'?Math.log10(state[el.dataset.param]):state[el.dataset.param];if(value>Number(el.max)){el.max=value;el.closest('.control').querySelector('.range-labels span:last-child').textContent=value;}el.value=value;el.style.setProperty('--range',`${100*(value-Number(el.min))/(Number(el.max)-Number(el.min))}%`);});
  $$('[data-number]').forEach(el=>{if(state[el.dataset.number]>Number(el.max))el.max=state[el.dataset.number];if(document.activeElement!==el)el.value=state[el.dataset.number];});
  $('#scan-mode').value=state.scanMode;
  $('#roughing-toggle').checked=status.roughing;$('#turbo-toggle').checked=status.turbo;
  $$('#pattern-pills button').forEach(el=>el.classList.toggle('active',el.dataset.pattern===state.scanMode));
}
function setParam(key,value){
  const old=state[key];state[key]=value;
  if(key==='resolution'&&state.scanMode==='custom'){
    state.scanMode='raster';toast('Resolution changed. Apply your custom program again to rebuild its path.');
  }
  if(key==='resolution'||key==='scanMode') buildPath();
  refresh(true);syncControls();
  if(old!==value)$('#global-status').textContent='Parameters updated. Equations and image respond to the current setup.';
}
$$('[data-param]').forEach(el=>el.addEventListener('input',()=>setParam(el.dataset.param,el.dataset.log==='true'?10**Number(el.value):Number(el.value))));
$$('[data-number]').forEach(el=>el.addEventListener('input',()=>{const value=Number(el.value);if(el.value!==''&&Number.isFinite(value)&&value>=Number(el.min)&&value<=Number(el.max)){setParam(el.dataset.number,el.dataset.number==='resolution'?Math.round(value):value);}}));
$$('[data-number]').forEach(el=>el.addEventListener('change',()=>{
  let value=Number(el.value);
  if(!Number.isFinite(value)||el.value===''){syncControls();return;}
  value=Math.max(Number(el.min),Math.min(Number(el.max),value));
  if(el.dataset.number==='resolution')value=Math.round(value);
  setParam(el.dataset.number,value);el.value=value;
}));

const components={
  gun:['01 / ELECTRON GUN','Tungsten filament','Heating releases electrons; the Wehnelt bias controls the accepted emission.','source'],
  anode:['02 / ACCELERATION','Grounded anode','The cathode-to-anode potential sets the electron kinetic energy.','source'],
  aperture:['03 / BEAM FORMATION','Circular aperture','A smaller opening removes high-angle rays, trading current for a narrower cone.','optics'],
  lens:['04 / MAGNETIC OPTICS','Magnetic objective lens','The coil’s axial B field focuses the beam. Refocus when beam energy changes.','optics'],
  scan:['05 / BEAM STEERING','X / Y electrostatic plates','Two orthogonal electric fields move the spot along the programmed scan.','optics'],
  specimen:['06 / INTERACTION','Specimen stage','Primary electrons produce secondary electrons; contrast here is synthetic.','optics'],
  detector:['07 / DETECTION','Everhart–Thornley detector','Cage → scintillator → light guide → photocathode → dynodes → anode.','detector'],
  vacuum:['00 / VACUUM','Turbo + backing pumps','Pump speed, gas load, and line conductance set the chamber pressure.','vacuum'],
};
function showControl(name){
  $$('[data-control]').forEach(el=>{const yes=el.dataset.control===name;el.classList.toggle('active',yes);el.setAttribute('aria-selected',yes);el.tabIndex=yes?0:-1;});
  $$('.control-pane').forEach(el=>{const yes=el.id===`controls-${name}`;el.hidden=!yes;el.classList.toggle('active',yes);});
}
$$('[data-control]').forEach((el,index)=>{
  el.addEventListener('click',()=>showControl(el.dataset.control));
  el.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const tabs=$$('[data-control]'),next=tabs[(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];next.click();next.focus();}});
});
function selectComponent(id,zoom=false){
  const data=components[id];if(!data)return;
  selectedComponent=id;status.selected=id;
  $('#component-category').textContent=data[0];$('#component-title').textContent=data[1];$('#component-description').textContent=data[2];
  $$('[data-component]').forEach(el=>el.classList.toggle('active',el.dataset.component===id));
  showControl(data[3]);if(zoom)column.focus(id);
  column.update(state,derived,status);
}
const column=new ColumnView($('#column-canvas'),{onSelect:id=>selectComponent(id)});
$$('[data-component]').forEach(el=>el.addEventListener('click',()=>selectComponent(el.dataset.component,true)));
$('#focus-component').addEventListener('click',()=>column.focus(selectedComponent));
$('#zoom-in').addEventListener('click',()=>column.zoom(1.25));$('#zoom-out').addEventListener('click',()=>column.zoom(.8));$('#zoom-reset').addEventListener('click',()=>column.reset());
$$('[data-view]').forEach(el=>el.addEventListener('click',()=>{$$('[data-view]').forEach(btn=>{btn.classList.toggle('active',el===btn);btn.setAttribute('aria-pressed',el===btn);});column.setView(el.dataset.view);}));
$('#inspect-detector').addEventListener('click',()=>selectComponent('detector',true));
function showPage(name){
  currentPage=name;
  $$('.page').forEach(el=>{el.hidden=el.id!==`page-${name}`;el.classList.toggle('active',!el.hidden);});
  $$('[data-page]').forEach(el=>{el.classList.toggle('active',el.dataset.page===name);if(el.dataset.page===name)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  closePopover();
  if(name==='program'){drawTrajectory();renderEditor();}
  if(name==='physics')updateEquations();
  column.pause(paused||name!=='lab');
}
$$('[data-page]').forEach(el=>el.addEventListener('click',()=>showPage(el.dataset.page)));
$$('[data-go]').forEach(el=>el.addEventListener('click',()=>{showPage(el.dataset.go);window.scrollTo({top:0,behavior:'smooth'});}));
$('.brand-mark').addEventListener('click',event=>{event.preventDefault();showPage('lab');});$('.wordmark').addEventListener('click',event=>{event.preventDefault();showPage('lab');});
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},4500);}
function updateBeam(){
  const vacuumReady=state.pressure<=1e-4, hot=derived.temperature>1500, emitted=derived.beamCurrent>1e-6;
  status.beamOn=requestedBeam&&vacuumReady&&hot&&emitted;
  $('#beam-state').textContent=!requestedBeam?'Beam blanked':!vacuumReady?'Vacuum interlock':!hot?'Filament cold':!emitted?'Emission cut off':'Beam active';
  $('#beam-dot').style.background=status.beamOn?'#5e9b65':'#be9b59';
  $('#beam-toggle').textContent=requestedBeam?'Blank beam':'Enable beam';
  $('#scene-status').textContent=paused?'PAUSED':status.beamOn?'BEAM ON':'BEAM BLANKED';
}
$('#auto-focus').addEventListener('click',()=>{state.lensCurrent=Number(derived.focusCurrent.toFixed(5));refresh(true);syncControls();toast('Lens current set to the first modeled focus.');});
$('#beam-toggle').addEventListener('click',()=>{requestedBeam=!requestedBeam;refresh(false);});
$('#pause').addEventListener('click',()=>{paused=!paused;column.pause(paused||currentPage!=='lab');$('#pause').textContent=paused?'▶':'Ⅱ';$('#pause').setAttribute('aria-label',paused?'Resume simulation':'Pause simulation');$('#pause').title=paused?'Resume simulation':'Pause simulation';updateBeam();});
function imagingPreset(){Object.assign(state,DEFAULTS);requestedBeam=true;paused=false;status.roughing=true;status.turbo=true;simulationTime=0;guideCompleted.clear();buildPath();refresh(true);syncControls();column.reset();column.pause(currentPage!=='lab');$('#pause').textContent='Ⅱ';$('#pause').setAttribute('aria-label','Pause simulation');$('#global-status').textContent='Imaging preset loaded. High vacuum and a warm filament are already established.';}
function coldStart(){paused=false;column.pause(currentPage!=='lab');$('#pause').textContent='Ⅱ';$('#pause').setAttribute('aria-label','Pause simulation');Object.assign(state,DEFAULTS,{heaterPower:0,voltage:1,pressure:1013});requestedBeam=false;status.roughing=false;status.turbo=false;simulationTime=0;guideCompleted.clear();buildPath();refresh(true);syncControls();$('#global-status').textContent='Cold start: chamber at atmosphere. Begin with the roughing pump in Vacuum or follow the Operating guide.';showControl('vacuum');}
$('#cold-start').addEventListener('click',()=>{coldStart();toast('Cold start loaded. Open the Operating guide for the full sequence.');});
$('#imaging-preset').addEventListener('click',()=>{imagingPreset();toast('Imaging preset loaded. Explore any component or parameter.');});
$('#roughing-toggle').addEventListener('change',event=>{status.roughing=event.target.checked;if(!status.roughing){status.turbo=false;$('#turbo-toggle').checked=false;toast('Backing pump off; the simulated turbo has stopped.');}refresh(false);});
$('#turbo-toggle').addEventListener('change',event=>{
  if(event.target.checked&&(!status.roughing||state.pressure>.1)){event.target.checked=false;toast('Start the backing pump and reach ≤ 0.1 mbar before enabling the turbo.');return;}
  status.turbo=event.target.checked;refresh(false);
});
$('#vent').addEventListener('click',()=>{status.roughing=false;status.turbo=false;requestedBeam=false;state.heaterPower=0;state.pressure=1013;refresh(true);syncControls();toast('Chamber vented in the model. Heater and beam are off.');});
$('#scan-mode').addEventListener('change',event=>{state.scanMode=event.target.value;buildPath();refresh(true);syncControls();});
function refresh(imageChanged=false){
  derived=calculate(state);updateBeam();column.update(state,derived,status);
  $('#temperature-readout').textContent=`${formatNumber(derived.temperature,0)} K`;
  $('#temperature-bar').style.width=`${Math.min(100,Math.max(0,(derived.temperature-293)/3000*100))}%`;
  $('#pressure-readout').textContent=`${sci(state.pressure)} mbar`;
  $('#vacuum-note').textContent=state.pressure<=1e-4?'Model beam permit: pressure ≤ 1 × 10⁻⁴ mbar.':state.pressure<=.1?'Turbo crossover reached. Enable turbo to reach high vacuum.':'Rough down first. Turbo crossover is 0.1 mbar in this model.';
  $('#field-width').textContent=`${formatNumber(derived.scanFieldWidth*1000,1)} µm`;
  $('#scale-label').textContent=`${formatNumber(derived.scanFieldWidth*1000*.2,1)} µm`;
  $('#frame-time').textContent=`${formatNumber(derived.frameTime,3)} s`;
  $('#probe-current').textContent=`${formatNumber(status.beamOn?derived.beamCurrent:0,2)} nA`;
  $('#focus-current').textContent=`${derived.focusCurrent.toFixed(3)} A`;
  $('#detector-limit').textContent=derived.pmtAnodeCurrent>100?`Model limit: ${formatNumber(derived.pmtAnodeCurrent,1)} µA estimated PMT anode current. Saturation is not modeled; reduce gain or emission.`:`Estimated PMT anode current: ${formatNumber(status.beamOn?derived.pmtAnodeCurrent:0,2)} µA. Signal trace is normalized synthetic intensity.`;
  $('#detector-limit').classList.toggle('limit-active',derived.pmtAnodeCurrent>100);
  $('#pmt-gain').textContent=`${sci(derived.pmtGain,1)}×`;
  $('#signal-value').textContent=status.beamOn?formatNumber(derived.snr,1):'0.0';
  $('#scan-count').textContent=`${state.resolution} × ${state.resolution} px`;
  $('#model-clock').textContent=`SIM TIME ${simulationTime.toFixed(1)} s${state.pressure>1e-4?' · VACUUM 20×':''}`;
  updateEquations();
  if(imageChanged){rebuildSpecimen();restartScan();drawTrajectory();}
}

function equationCard(eq){const el=document.createElement('button');el.type='button';el.className='equation-card';el.dataset.equation=eq.id;el.setAttribute('aria-haspopup','dialog');el.setAttribute('aria-label',`${eq.title}: show derivation and sources`);el.innerHTML='<span class="equation-info">ⓘ</span><h3></h3><div class="formula"></div><div class="equation-result"></div><div class="equation-substitution"></div>';el.querySelector('h3').textContent=eq.title;el.querySelector('.formula').textContent=eq.formula;el.addEventListener('pointerenter',()=>{clearTimeout(popoverTimer);if(!popoverPinned)showEquation(eq,el,false);});el.addEventListener('pointerleave',scheduleClose);el.addEventListener('focus',()=>{if(!popoverPinned)showEquation(eq,el,false);});el.addEventListener('blur',scheduleClose);el.addEventListener('click',()=>showEquation(eq,el,true));return el;}
EQUATIONS.forEach(eq=>$('#all-equations').append(equationCard(eq)));
const quickCandidates=['speed','wavelength','emission','lens','vacuum','deflection'];
const quickIds=quickCandidates.map(id=>EQUATIONS.find(eq=>eq.id===id||eq.id.includes(id))).filter(Boolean).slice(0,4);
const quick=quickIds.length===4?quickIds:EQUATIONS.slice(0,4);
quick.forEach(eq=>$('#quick-equations').append(equationCard(eq)));
function equationContext(eq){if(eq.id==='field'){const p={...state,plateVoltage:state.plateVoltage+state.scanAmplitude*(status.scanPoint?.x||0)};return [p,{...derived,field:p.plateVoltage/(state.plateGap*1e-3)}];}return [state,derived];}
function updateEquations(){
  $$('[data-equation]').forEach(el=>{const eq=EQUATIONS.find(x=>x.id===el.dataset.equation);const [p,d]=equationContext(eq);el.querySelector('.equation-result').textContent=eq.result(p,d);el.querySelector('.equation-substitution').textContent=eq.substitution(p,d);});
  if(currentEquation&&!$('#equation-popover').hidden){const [p,d]=equationContext(currentEquation);$('#popover-live').textContent=`${currentEquation.substitution(p,d)}\n= ${currentEquation.result(p,d)}`;}
}
function showEquation(eq,el,pinned){
  clearTimeout(popoverTimer);currentEquation=eq;popoverPinned=pinned;
  const [p,d]=equationContext(eq);$('#popover-title').textContent=eq.title;$('#popover-formula').textContent=eq.formula;$('#popover-live').textContent=`${eq.substitution(p,d)}\n= ${eq.result(p,d)}`;$('#popover-derivation').textContent=eq.derivation;$('#popover-assumptions').textContent=eq.assumptions;$('#popover-sources').replaceChildren();eq.sources.forEach(source=>{const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`${source.label} ↗`;$('#popover-sources').append(a);});
  const pop=$('#equation-popover');pop.hidden=false;
  const rect=el.getBoundingClientRect(),width=pop.offsetWidth,height=pop.offsetHeight;
  let left=rect.right+12;if(left+width>window.innerWidth-12)left=Math.max(12,rect.left-width-12);
  if(window.innerWidth<760)left=(window.innerWidth-width)/2;
  const top=Math.max(12,Math.min(rect.top,window.innerHeight-height-12));pop.style.left=`${left}px`;pop.style.top=`${top}px`;
}
function scheduleClose(){clearTimeout(popoverTimer);if(!popoverPinned)popoverTimer=setTimeout(closePopover,350);}
function closePopover(){popoverPinned=false;currentEquation=null;$('#equation-popover').hidden=true;}
$('#equation-popover').addEventListener('pointerenter',()=>clearTimeout(popoverTimer));$('#equation-popover').addEventListener('pointerleave',scheduleClose);$('#equation-popover').addEventListener('focusin',()=>{popoverPinned=true;clearTimeout(popoverTimer);});$('#close-equation').addEventListener('click',closePopover);
document.addEventListener('keydown',event=>{if(event.key==='Escape')closePopover();});document.addEventListener('pointerdown',event=>{if(!event.target.closest('.equation-card')&&!event.target.closest('#equation-popover'))closePopover();});

const imageSize=256;
const specimen=$('#specimen-canvas'),specimenCtx=specimen.getContext('2d');
const texture=document.createElement('canvas');texture.width=texture.height=imageSize;
const textureCtx=texture.getContext('2d',{willReadFrequently:true});
const scanBuffer=document.createElement('canvas');scanBuffer.width=scanBuffer.height=imageSize;
const scanCtx=scanBuffer.getContext('2d');
let signalSamples=new Float32Array(120),signalWrite=0,texturePixels=null;
function rebuildSpecimen(){
  const data=textureCtx.createImageData(imageSize,imageSize);
  const field=Math.max(.025,derived.scanFieldWidth||.3),scale=field/.35;
  const noise=24/Math.max(1,derived.snr||1),offset=(derived.deflection||0)/.35;
  for(let y=0;y<imageSize;y++)for(let x=0;x<imageSize;x++){
    const px=(x/imageSize-.5)*scale+offset,py=(y/imageSize-.5)*scale;
    const a=px*.97+py*.24,b=py*.97-px*.24;
    const gx=((a*5+.5)%1+1)%1-.5,gy=((b*5+.5)%1+1)%1-.5;
    const r=Math.hypot(gx,gy),isCircle=Math.floor((a+1)*5)%3===0;
    const edge=isCircle?Math.abs(r-.28):Math.abs(Math.max(Math.abs(gx),Math.abs(gy))-.28);
    let value=32+((isCircle?r<.28:Math.max(Math.abs(gx),Math.abs(gy))<.28)?95:0);
    value+=Math.exp(-edge*100)*75;
    if(Math.abs(gy)<.027&&Math.abs(gx)>.3)value+=25;
    const grain=((x*73856093^y*19349663)>>>0)%101/100-.5;
    value+=grain*(9+noise*5)+14*(py+.5);
    const index=(y*imageSize+x)*4;data.data[index]=Math.min(255,Math.max(0,value));data.data[index+1]=Math.min(255,Math.max(0,value+3));data.data[index+2]=Math.min(255,Math.max(0,value+2));data.data[index+3]=255;
  }
  textureCtx.putImageData(data,0,0);
  const blur=Math.max(.15,Math.min(8,(derived.spotSize||100)/(field*1e6)*imageSize));
  if(blur>.3){const temp=document.createElement('canvas');temp.width=temp.height=imageSize;const ctx=temp.getContext('2d');ctx.filter=`blur(${blur.toFixed(2)}px)`;ctx.drawImage(texture,0,0);textureCtx.drawImage(temp,0,0);}
  texturePixels=textureCtx.getImageData(0,0,imageSize,imageSize).data;
}
function restartScan(){scanIndex=0;frameCount=0;sampleRemainder=0;scanCtx.fillStyle='#162323';scanCtx.fillRect(0,0,imageSize,imageSize);drawSpecimen();}
$('#acquire').addEventListener('click',()=>{restartScan();toast('New scan started with the current parameters.');});
function buildPath(){
  const count=state.resolution**2;
  if(state.scanMode==='custom'&&customPath?.length===count*3)path=customPath;
  else{path=new Float32Array(count*3);for(let i=0;i<count;i++){const p=scanPoint(i,state.resolution,state.scanMode==='custom'?'raster':state.scanMode);path[i*3]=p.x;path[i*3+1]=p.y;path[i*3+2]=p.blank?1:0;}}
  pathVersion++;scanIndex=0;
}
function advanceScan(dt){
  if(!status.beamOn||!path||paused)return;
  sampleRemainder+=dt*state.resolution**2/Math.max(derived.frameTime,1e-6);
  const count=Math.min(8000,Math.floor(sampleRemainder));sampleRemainder-=count;
  const n=state.resolution,total=n*n,stamp=Math.max(1,Math.ceil(imageSize/n));
  for(let k=0;k<count;k++){
    if(scanIndex>=total){scanIndex=0;frameCount++;}
    const index=scanIndex*3,x=path[index],y=path[index+1],blank=path[index+2]===1;
    const ix=Math.min(imageSize-stamp,Math.max(0,Math.floor((x+1)*.5*(imageSize-1)))),iy=Math.min(imageSize-stamp,Math.max(0,Math.floor((y+1)*.5*(imageSize-1))));
    if(!blank)scanCtx.drawImage(texture,ix,iy,stamp,stamp,ix,iy,stamp,stamp);
    status.scanPoint={x,y,blank};scanIndex++;
  }
  if(count&&texturePixels){const px=Math.max(0,Math.min(imageSize-1,Math.round((status.scanPoint.x+1)*.5*(imageSize-1)))),py=Math.max(0,Math.min(imageSize-1,Math.round((status.scanPoint.y+1)*.5*(imageSize-1))));signalSamples[signalWrite++%signalSamples.length]=status.scanPoint.blank?0:texturePixels[(py*imageSize+px)*4]/255;}
}
function drawSpecimen(){
  const w=specimen.width,h=specimen.height;specimenCtx.imageSmoothingEnabled=true;specimenCtx.fillStyle='#152426';specimenCtx.fillRect(0,0,w,h);specimenCtx.drawImage(scanBuffer,0,0,w,h);
  if(status.beamOn&&!status.scanPoint.blank){const x=(status.scanPoint.x+1)*.5*w,y=(status.scanPoint.y+1)*.5*h;specimenCtx.strokeStyle='#c3e9c99c';specimenCtx.lineWidth=.6;specimenCtx.beginPath();specimenCtx.moveTo(x-5,y);specimenCtx.lineTo(x+5,y);specimenCtx.moveTo(x,y-5);specimenCtx.lineTo(x,y+5);specimenCtx.stroke();}
  $('#scan-progress-fill').style.width=`${scanIndex/(state.resolution**2)*100}%`;
}
function drawSignal(){const canvas=$('#signal-canvas'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#e9eee3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,h*.78);ctx.lineTo(w,h*.78);ctx.stroke();ctx.beginPath();for(let i=0;i<signalSamples.length;i++){const value=status.beamOn?signalSamples[(signalWrite+i)%signalSamples.length]:0,x=i/(signalSamples.length-1)*w,y=h-8-value*(h-12);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle='#73a386';ctx.lineWidth=1.2;ctx.stroke();}
function drawTrajectory(){
  const canvas=$('#trajectory-canvas'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pad=30;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#f5f7f0';ctx.fillRect(0,0,w,h);ctx.lineWidth=1;ctx.strokeStyle='#dce5d5';ctx.beginPath();for(let j=0;j<=4;j++){const x=pad+j*(w-2*pad)/4,y=pad+j*(h-2*pad)/4;ctx.moveTo(x,pad);ctx.lineTo(x,h-pad);ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);}ctx.stroke();
  ctx.font='10px monospace';ctx.fillStyle='#8a9b7f';ctx.textAlign='center';ctx.fillText('−1',pad,h-10);ctx.fillText('0',w/2,h-10);ctx.fillText('+1',w-pad,h-10);ctx.fillText('X',w-11,h-10);ctx.fillText('Y',12,18);
  if(!path)return;ctx.strokeStyle='#3d887689';ctx.lineWidth=.7;ctx.beginPath();const total=path.length/3,step=Math.max(1,Math.floor(total/5000));let start=true;
  for(let i=0;i<total;i+=step){const x=pad+(path[i*3]+1)*.5*(w-pad*2),y=pad+(path[i*3+1]+1)*.5*(h-pad*2);if(start||path[i*3+2])ctx.moveTo(x,y);else ctx.lineTo(x,y);start=false;}
  ctx.stroke();ctx.fillStyle='#c5924c';ctx.beginPath();ctx.arc(pad+(path[0]+1)*.5*(w-2*pad),pad+(path[1]+1)*.5*(h-2*pad),3,0,2*Math.PI);ctx.fill();ctx.font='9px sans-serif';ctx.textAlign='left';ctx.fillText('START',pad,15);
}

PRESETS.forEach(preset=>{const btn=document.createElement('button');btn.textContent=preset.label;btn.dataset.pattern=preset.id;btn.title=preset.description;btn.addEventListener('click',()=>{state.scanMode=preset.id;buildPath();refresh(true);syncControls();if(activeEditor==='firmware'&&!firmwareDirty){firmwareCode='';renderEditor();}toast(`${preset.label} trajectory applied.`);});$('#pattern-pills').append(btn);});
CONFIG_HINTS.forEach(hint=>{const el=document.createElement('div');el.className='config-hint';const h=document.createElement('h3');h.textContent=hint.title;const p=document.createElement('p');p.textContent=hint.body;const a=document.createElement('a');a.textContent='Manufacturer reference ↗';a.href=hint.url;a.target='_blank';a.rel='noopener noreferrer';el.append(h,p,a);$('#config-hints').append(el);});
function saveEditor(){if(activeEditor==='trajectory')trajectoryCode=$('#code-editor').value;else{firmwareCode=$('#code-editor').value;}}
function createFirmware(){return generateFirmware({...state,settle:state.settleTime,retrace:state.flyback});}
function renderEditor(){
  if(state.scanMode!=='custom'&&(!firmwareCode||!firmwareDirty))firmwareCode=createFirmware();
  $('#code-editor').value=activeEditor==='trajectory'?trajectoryCode:firmwareCode;
  $('#editor-language').textContent=activeEditor==='trajectory'?'JAVASCRIPT · WEB WORKER':'ARDUINO C++ · CLASSIC ESP32';
  $('#editor-description').textContent=activeEditor==='trajectory'?'Return a normalized point { x, y, blank } for each pixel. i = sample index, n = resolution, t = frame fraction.':(state.scanMode==='custom'?'Custom JS is active. This is the previous preset sketch; port the custom trajectory to pointAt() before running it on an ESP32. ':'')+'Edit the full sketch. Apply reads supported configuration constants for preview; export to compile with Arduino-ESP32.';
  $('#firmware-notice').hidden=activeEditor!=='firmware';
  $('#run-program').textContent=activeEditor==='trajectory'?'▶ Apply & preview':'✓ Validate & apply config';
  $$('[data-editor]').forEach(el=>{el.classList.toggle('active',el.dataset.editor===activeEditor);el.setAttribute('aria-pressed',el.dataset.editor===activeEditor);});
}
$$('[data-editor]').forEach(el=>el.addEventListener('click',()=>{saveEditor();activeEditor=el.dataset.editor;renderEditor();}));
$('#code-editor').addEventListener('input',()=>{saveEditor();if(activeEditor==='firmware')firmwareDirty=true;$('#program-status').textContent='Edited · not applied';});
$('#code-editor').addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();const el=event.target,start=el.selectionStart,end=el.selectionEnd;el.setRangeText('  ',start,end,'end');el.dispatchEvent(new Event('input'));}});
$('#run-program').addEventListener('click',async()=>{
  saveEditor();const message=$('#program-status'),button=$('#run-program');message.classList.remove('error');button.disabled=true;
  try{
    if(activeEditor==='trajectory'){
      message.textContent='Checking trajectory…';const version=++pathVersion,resolution=state.resolution;
      const result=await compileProgram(trajectoryCode,{resolution,timeout:1200});
      if(state.resolution!==resolution||version!==pathVersion)throw new Error('Setup changed while checking. Apply again.');
      customPath=result.points;state.scanMode='custom';$('#scan-mode option[value="custom"]').disabled=false;buildPath();refresh(true);syncControls();message.textContent=`${result.count.toLocaleString()} points checked · applied`;toast('Custom trajectory applied to the microscope.');
    }else{
      const parsed=parseFirmwareConfig(firmwareCode);if(parsed.errors.length)throw new Error(parsed.errors.join(' '));
      Object.assign(state,parsed.config,{settleTime:parsed.config.settle,flyback:parsed.config.retrace});
      buildPath();refresh(true);syncControls();message.textContent=parsed.warnings.length?`Config applied. ${parsed.warnings.join(' ')}`:'Configuration checked and applied. C++ requires compilation.';toast('Firmware configuration applied. Full C++ execution requires hardware.');
    }
  }catch(error){message.textContent=error.message;message.classList.add('error');}
  finally{button.disabled=false;}
});
$('#reset-program').addEventListener('click',()=>{if(activeEditor==='trajectory')trajectoryCode=DEFAULT_PROGRAM;else{if(state.scanMode==='custom'){toast('Choose a built-in pattern before regenerating firmware. Port custom JS to pointAt() manually.');return;}firmwareCode=createFirmware();firmwareDirty=false;}renderEditor();$('#program-status').textContent='Code reset · apply to update preview';$('#program-status').classList.remove('error');});
function download(name,text,type='text/plain'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#download-code').addEventListener('click',()=>{saveEditor();download(activeEditor==='trajectory'?'trajectory.js':'ESP32_scan.ino',activeEditor==='trajectory'?trajectoryCode:firmwareCode);});
$('#export-settings').addEventListener('click',()=>{saveEditor();download('beam-lab-setup.json',JSON.stringify({model:'Beam Lab 1.0 — idealized SEM',parameters:state,operatingState:{...status,requestedBeam},trajectoryCode,firmwareCode,assumptions:'Illustrative educational geometry and detector model; not calibrated hardware.',exportedAt:new Date().toISOString()},null,2),'application/json');toast('Simulation setup exported.');});

const guideSteps=[
  {title:'Prepare the instrument',short:'Check the column and starting state',body:'Start with a cold filament, blanked beam, pumps stopped, and a chamber at atmospheric pressure. Locate the electron gun, aperture, lenses, scan plates, specimen, detector, and pump connection in the cutaway.',observe:'No electron beam is visible. The pressure is 1,013 mbar and estimated filament temperature is near ambient.',hardware:'Select a documented gun and its floating heater supply. Verify the column, feedthroughs, grounding, shielding, vacuum gauges, and hardwired permit system against the engineering report before commissioning HV.',button:'Load cold starting state',action:()=>{coldStart();return 'Cold starting state loaded. Continue to the roughing pump.';}},
  {title:'Rough down the chamber',short:'Start the backing pump',body:'The roughing pump removes the bulk of the gas. Pressure follows the gas-balance model and approaches the backing pump’s floor. Watch pressure fall; simulated time runs at 20× during pump-down.',observe:'The pressure should fall below 0.1 mbar before the turbo can be enabled. Pump-down slows as it approaches the floor.',hardware:'The pump manufacturer sets the permitted turbo inlet and backing pressures. The 0.1 mbar crossover here is a teaching-model threshold, not a universal pump specification.',button:'Start roughing pump',action:()=>{status.roughing=true;syncControls();refresh(false);return 'Roughing pump started. Allow the model to reach ≤ 0.1 mbar before the next step.';}},
  {title:'Establish high vacuum',short:'Enable the turbo and check gas load',body:'Enable the turbomolecular pump once the roughing stage reaches crossover. Effective pumping speed includes the restriction of the connecting line. The final pressure approaches gas load divided by effective speed.',observe:'High-vacuum pressure should settle near Q / S_eff. A large leak can keep it above the 10⁻⁴ mbar model beam-permit threshold.',hardware:'Use a gauge suitable for each pressure range and measure near the gun. Tungsten-gun operation often targets about 10⁻⁵ mbar or better; the actual gun documentation governs.',button:'Enable turbomolecular pump',action:()=>{if(!status.roughing||state.pressure>.1)return 'Waiting: keep the roughing pump running until pressure is ≤ 0.1 mbar, then apply this step again.';status.turbo=true;syncControls();refresh(false);return 'Turbo running. Watch the chamber approach its modeled equilibrium pressure.';}},
  {title:'Warm the filament',short:'Explore temperature and emission',body:'Set illustrative heater power to 3 W. The simulator calculates a steady-state tungsten temperature from radiative and conductive losses, then estimates thermionic emission. The real warm-up transient is not modeled.',observe:'The filament glows and emission rises steeply with temperature. Acceleration voltage is still independent of heater power.',hardware:'Use the actual filament’s rated current, power, and warm-up procedure. The heater supply and controls float near the negative cathode potential; their continuous isolation rating matters.',button:'Set heater to 3 W',action:()=>{if(state.pressure>1e-4)return 'Waiting: establish high vacuum first. The model leaves the filament cold.';state.heaterPower=3;refresh(true);syncControls();return 'Steady-state heater model set to 3 W. Inspect temperature and thermionic emission in Physics & sources.';}},
  {title:'Form the primary beam',short:'Apply acceleration and inspect the aperture',body:'Enable the simulated beam at 3 kV with −150 V Wehnelt bias. Electrons accelerate toward the grounded anode. The aperture clips the angular spread and reduces the transmitted current.',observe:'Electron motion appears in the column. Change the aperture diameter and compare the probe-current and spot-size estimates.',hardware:'Commission the acceleration supply with characterized loads and verified interlocks first. Establish a beam on a suitable Faraday cup or phosphor target before relying on an imaging detector.',button:'Enable 3 kV beam',action:()=>{if(state.pressure>1e-4||derived.temperature<1500)return 'Waiting: high vacuum and a hot filament are required before enabling the beam.';state.voltage=3;state.wehnelt=-150;requestedBeam=true;refresh(true);syncControls();return 'Beam enabled. It is blanked automatically if chamber pressure rises above the model threshold.';}},
  {title:'Focus and calibrate',short:'Match the magnetic lens to the working distance',body:'The axial magnetic field bends electron trajectories into a focus. Adjust lens current so the modeled back focal plane meets the specimen. Lens-to-specimen distance is plate length plus post-plate drift in this ideal geometry. Re-focus when acceleration voltage or working distance changes.',observe:'Use Fields to inspect the magnetic lens. The modeled blur decreases near the calculated focus; shrinking the aperture also reduces current.',hardware:'Calibrate scan gain and astigmatism with a reference specimen. The model’s hard-edge solenoid, source size, aberrations, and schematic column do not predict a built microscope’s resolution.',button:'Set calculated focus current',action:()=>{state.lensCurrent=Number.isFinite(derived.focusCurrent)?Math.min(.9,Math.max(.05,derived.focusCurrent)):.45;refresh(true);syncControls();return `Model focus set to ${state.lensCurrent.toFixed(3)} A. Use the magnetic lens and spot-size equations to inspect the assumptions.`;}},
  {title:'Program the raster',short:'Synchronize plates, blanking, and sampling',body:'Scan a 128 × 128 raster with 40 µs beam-on dwell. Each pixel requires a position command, settling interval, exposure, and ADC sample. Retrace and serial transport add overhead to the ideal frame time.',observe:'Open Scan program to edit an arbitrary JavaScript trajectory. The ESP32 sketch uses an external dual 12-bit SPI DAC and separate bipolar scan amplifiers.',hardware:'Validate voltages, paired DAC updates, settling time, ADC signal conditioning, blanking polarity, and hardware timing. The sketch starts disarmed; serial s starts acquisition and x stops it.',button:'Apply a 128 × 128 raster',action:()=>{state.resolution=128;state.dwell=40;state.scanMode='raster';buildPath();refresh(true);syncControls();return 'Raster applied. Open Scan program to preview the trajectory or edit the firmware configuration.';}},
  {title:'Collect the first image',short:'Adjust detector gain, then shut down',body:'A positively biased cage collects secondary electrons. They strike a scintillator; light travels to the photomultiplier, whose dynodes amplify the signal. Compare dwell, probe current, collection bias, and PMT gain.',observe:'The synthetic specimen scan fills in. PMT gain changes signal amplification, while photon statistics and excess noise limit signal-to-noise ratio.',hardware:'Set scintillator and PMT supplies to the chosen detector’s specifications. For shutdown, blank the beam, reduce HV and heater, verify discharge, and follow pump and vent procedures. The collection cage is distinct from a current-measuring Faraday cup.',button:'Acquire the first image',action:()=>{state.pmtVoltage=800;state.collectionBias=250;refresh(true);syncControls();return status.beamOn?'Acquisition restarted. Inspect the detector, or blank the beam to explore shutdown.':'Detector set. Enable the beam after establishing high vacuum and heating.';}}
];
function renderGuide(){
  $('#guide-steps').replaceChildren();guideSteps.forEach((step,i)=>{const btn=document.createElement('button');btn.className=`guide-step${i===guideIndex?' active':''}`;btn.innerHTML=`<span class="step-circle">${String(i+1).padStart(2,'0')}</span><span><strong></strong><small></small></span><span class="step-check">${guideCompleted.has(i)?'✓':''}</span>`;btn.querySelector('strong').textContent=step.title;btn.querySelector('small').textContent=step.short;btn.addEventListener('click',()=>{guideIndex=i;renderGuide();});$('#guide-steps').append(btn);});
  const step=guideSteps[guideIndex];$('#guide-number').textContent=`STEP ${String(guideIndex+1).padStart(2,'0')} / 08`;$('#guide-title').textContent=step.title;$('#guide-body').textContent=step.body;$('#guide-observation').textContent=step.observe;$('#guide-hardware').textContent=step.hardware;$('#guide-action').textContent=step.button;$('#guide-feedback').textContent='';$('#guide-next').disabled=guideIndex===guideSteps.length-1;
}
$('#guide-action').addEventListener('click',()=>{const message=guideSteps[guideIndex].action();if(!message.startsWith('Waiting'))guideCompleted.add(guideIndex);renderGuide();$('#guide-feedback').textContent=message;});
$('#guide-next').addEventListener('click',()=>{guideIndex=Math.min(guideIndex+1,guideSteps.length-1);renderGuide();});
$('#guide-start').addEventListener('click',()=>{guideIndex=0;coldStart();renderGuide();$('#guide-feedback').textContent='Cold state loaded. Follow each step to form a beam and acquire an image.';});

buildPath();syncControls();renderGuide();renderEditor();refresh(true);showControl('source');
let lastTime=performance.now(),lastReadout=0,lastVisual=0;
function tick(now){
  const dt=Math.min(.1,(now-lastTime)/1000);lastTime=now;
  if(!paused&&!document.hidden){
    const multiplier=state.pressure>1e-4?20:1;simulationTime+=dt*multiplier;
    state.pressure=updatePressure(state.pressure,dt*multiplier,{...state,roughing:status.roughing,turbo:status.turbo});
    advanceScan(dt);
  }
  if(now-lastReadout>200){refresh(false);const stats=column.getStats();$('#fps').textContent=`${Math.round(stats.fps||0)} fps`;$('#zoom-value').textContent=`${Math.round((stats.zoom||1)*100)}%`;lastReadout=now;}
  if(currentPage==='lab'&&now-lastVisual>30){drawSpecimen();drawSignal();lastVisual=now;}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
