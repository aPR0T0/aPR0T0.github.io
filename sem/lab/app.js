import { SIDE_MOUNT_PRESET, collectionField, sampleCollectionField } from './detector-geometry.js';
import { updateMountView } from './mount-view.js';
import { BSE_EQUATIONS } from './bse.js';
import { CURRENT_EQUATIONS, ADC_RANGES, ADC_RATES, normalizeCurrent } from './current.js';
import { generateCurrentFirmware, parseCurrentFirmwareConfig } from './current-firmware.js';
import { DEFAULTS, calculate, EQUATIONS as PHYSICS_EQUATIONS, updatePressure } from './physics.js';
import { calculateElectrical, ELECTRICAL_EQUATIONS } from './electrical.js';
import { mountElectricalView } from './electrical-view.js';
import { ColumnView } from './column.js';
import { mountWorkspace } from './workspace.js';
import { PRESETS, DEFAULT_PROGRAM, compileProgram, scanPoint, generateFirmware, CONFIG_HINTS } from './scan.js';
import { SCAN_HARDWARE_DEFAULTS, LEGACY_SCAN_HARDWARE, createScanQuantizer, SCAN_HARDWARE_EQUATIONS } from './scan-hardware.js';
import { blurLuminance } from './image-blur.js';
import {DEFAULT_SPECIMEN_ID, getSpecimen, createSpecimenSampler} from './specimens.js';
import {mountSpecimenPicker} from './specimen-picker.js';
import {createImagePixelMapper} from './scan-image.js';
import {createButterflyDetailPreset} from './imaging-presets.js';
const parseFirmwareConfig = parseCurrentFirmwareConfig;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const EQUATIONS = [...PHYSICS_EQUATIONS,...ELECTRICAL_EQUATIONS,...BSE_EQUATIONS,...CURRENT_EQUATIONS,...SCAN_HARDWARE_EQUATIONS];
let electricalView = null;
let selectedSpecimenId=DEFAULT_SPECIMEN_ID, specimenPicker=null;
const state = { ...DEFAULTS };
const status = { beamOn: true, roughing: true, turbo: true, scanPoint: { x: 0, y: 0, blank: false }, selected: 'gun' };
let derived = calculate(state);
let paused = false, requestedBeam = true, currentPage = 'lab', selectedComponent = 'gun', simulationTime = 0;
let scanIndex = 0, frameCount = 0, sampleRemainder = 0, path = null, requestedPath = null, customPath = null, pathVersion = 0;
let mapImagePixel=null;
let previewRate=1, singleFramePreview=false, previewComplete=false;
let activeEditor = 'trajectory', trajectoryCode = DEFAULT_PROGRAM, firmwareCode = '', firmwareDirty = false;
let appliedTrajectoryCode = DEFAULT_PROGRAM, firmwareAppliedCode = '';
let currentEquation = null, popoverPinned = false, popoverTimer, toastTimer;
let guideIndex = 0;
const guideCompleted = new Set();
const sourceConfig = [
  ['voltage','Acceleration voltage',3,5,.1,'kV','Negative cathode; grounded anode'],
  ['heaterPower','Filament heating',0,5,.05,'W','Illustrative tungsten heat balance'],
  ['wehnelt','Wehnelt bias',-300,0,5,'V','Relative to the cathode'],
  ['gunGap','Cathode–anode spacing',5,50,1,'mm','Assumed gap for the average accelerating field'],
];
const opticsConfig = [
  ['aperture','Aperture / slit diameter',10,300,5,'µm','Circular aperture in this model'],
  ['apertureBias','Aperture bias',-200,200,5,'V','To ground. Field overlay only; electrostatic aperture-lens focusing is not solved.'],
  ['lensCurrent','Magnetic lens current',0,.9,.005,'A',''],
  ['workingDistance','Post-plate drift',5,50,1,'mm','Scan plate exit to specimen'],
  ['plateVoltage','X plate offset',-50,50,1,'V','Model alignment offset; separate hardware bias'],
  ['scanAmplitude','Scan amplitude',.01,100,.01,'V','Peak differential plate command; reduce to inspect a smaller area'],
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
const bseConfig = [
  ['detectorOffset','Detector lateral offset',0,40,.5,'mm','Centre to beam axis; move the whole package clear of the scan'],
  ['detectorDistance','Detector centre height',5,30,.5,'mm','Vertical height above the specimen, not line-of-sight distance'],
  ['detectorTilt','Detector face tilt',0,85,.1,'°','0° = horizontal face; positive tilt aims toward the beam axis'],
  ['detectorBias','Diode reverse bias',0,5,.1,'V','K ≈ 0 V; A = −bias. Datasheet interpolation: 0–5 V only'],
  ['tiaResistance','Amplifier feedback resistance',.1,100,.1,'MΩ','Higher resistance raises output voltage; watch clipping'],
  ['tiaCapacitance','Feedback capacitance',.5,30,.5,'pF','Rf × Cf gives an illustrative settling time'],
  ['dwell','Detector pixel dwell',20,1000,10,'µs','Compare with 1% amplifier settling time'],
];
const bseAssumptionConfig = [
  ['detectorMargin','Mounting allowance',0,10,.5,'mm','Extra envelope around the assumed 25 × 11 × 1 mm package'],
  ['detectorBeamAllowance','Beam and alignment allowance',0,5,.05,'mm','Assumed extra radius around all programmed beam-centre paths'],
  ['bseYield','Assumed BSE yield',0,1,.01,'','Fraction of primary electrons returning from specimen'],
  ['bseEnergyFraction','Mean returning energy fraction',.1,1,.05,'','Single-energy approximation; real BSE have a spectrum'],
  ['bseAcceptance','Unobstructed detector acceptance',0,1,.05,'','Additional loss after ideal solid-angle collection'],
];
const programConfig = [
  ['resolution','Pixels per side',2,512,1,'px','N × N samples per frame'],
  ['dwell','Acquisition window',20,100000,10,'µs','Current mode waits for fresh ADS1115 conversions; slower settings extend the frame'],
  ['scanAmplitude','Scan amplitude',.01,100,.01,'V','Peak differential command; hardware DAC steps remain finite'],
  ['amplifierGain','External scan amplifier gain',1,1000,1,'V/V','Must match the physical amplifier; this is not a digital gain control'],
];
const currentConfig=[
  ['currentRf','Feedback resistor',1,1000,1,'MΩ','PCB default 100 MΩ. This control represents replacing Rf.'],
  ['currentCf','Feedback capacitor',1,100,1,'pF','PCB default 10 pF C0G. Recheck stability after replacement.'],
  ['settleTime','Beam-on settling',5,10000,5,'µs','Wait after moving and unblanking; prototype default 5 ms.'],
  ['currentSamples','Conversions per pixel',1,64,1,'','Each conversion is started after settling; more conversions increase time.'],
];
const currentAssumptions=[
  ['secondaryYield','Escaped SE yield',0,2,.01,'','Assumption; material, angle, charging and energy change this value.'],
  ['currentBseYield','Escaped BSE yield',0,1,.01,'','Assumed fraction of incident electrons backscattered away.'],
  ['currentNoiseFloor','Additional RMS noise',0,100,1,'pA','Unmeasured allowance for amplifier, leakage and environment.'],
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
renderControls('#source-sliders',sourceConfig);renderControls('#optics-sliders',opticsConfig);renderControls('#vacuum-sliders',vacuumConfig);renderControls('#detector-sliders',detectorConfig);renderControls('#program-sliders',programConfig);renderControls('#bse-sliders',bseConfig);renderControls('#bse-assumption-sliders',bseAssumptionConfig);
renderControls('#current-sliders',currentConfig);renderControls('#current-assumption-sliders',currentAssumptions);
for(const [key,label,values,unit] of [['currentADCRate','ADS1115 conversion rate',ADC_RATES,'SPS'],['currentADCRange','ADC differential range',ADC_RANGES,'V']]){
  const wrap=document.createElement('label');wrap.className='current-select';wrap.textContent=label;const select=document.createElement('select');select.dataset.currentSelect=key;select.setAttribute('aria-label',label);
  for(const v of values){const option=document.createElement('option');option.value=v;option.textContent=`${key==='currentADCRange'?'±':''}${v} ${unit}`;select.append(option);}select.value=state[key];select.addEventListener('change',()=>setParam(key,Number(select.value)));wrap.append(select);$('#current-sliders').append(wrap);
}
$('#bse-sliders [data-number=detectorTilt]').closest('.control').after($('#aim-detector'));
function syncControls(){
  specimenPicker?.sync(selectedSpecimenId,state.detectorMode);
  $('#scan-dac-select').value=String(state.dacModel);
  const bse=state.detectorMode!=='et';$('#detector-mode').value=state.detectorMode;
  $$('[data-current-select]').forEach(el=>el.value=state[el.dataset.currentSelect]);
  for(const el of $$('[data-param=voltage],[data-number=voltage]')){el.min=bse?3:1;if(el.matches('[data-param]'))el.closest('.control').querySelector('.range-labels span:first-child').textContent=`${el.min} kV`;}

  $$('[data-param]').forEach(el=>{let value=el.dataset.log==='true'?Math.log10(state[el.dataset.param]):state[el.dataset.param];if(!Number.isFinite(value))value=Number(el.min);if(value>Number(el.max)){el.max=value;el.closest('.control').querySelector('.range-labels span:last-child').textContent=value;}if(value<Number(el.min)){el.min=value;el.closest('.control').querySelector('.range-labels span:first-child').textContent=value;}el.value=value;el.style.setProperty('--range',`${100*(value-Number(el.min))/(Number(el.max)-Number(el.min))}%`);});
  $$('[data-number]').forEach(el=>{if(state[el.dataset.number]>Number(el.max))el.max=state[el.dataset.number];if(state[el.dataset.number]<Number(el.min))el.min=state[el.dataset.number];if(document.activeElement!==el)el.value=state[el.dataset.number];});
  $('#detector-mount').value=state.detectorOffset>0?'side':'centred';
  $('#scan-mode').value=state.scanMode;
  $('#roughing-toggle').checked=status.roughing;$('#turbo-toggle').checked=status.turbo;
  $$('#pattern-pills button').forEach(el=>el.classList.toggle('active',el.dataset.pattern===state.scanMode));
}
function setParam(key,value){
  const old=state[key];state[key]=key==='voltage'&&state.detectorMode!=='et'?Math.max(3,value):value;
  if(key.startsWith('current'))state[key]=normalizeCurrent(state)[key];
  if(key==='resolution'&&state.scanMode==='custom'){
    state.scanMode='raster';toast('Resolution changed. Apply your custom program again to rebuild its path.');
  }
  if(['resolution','scanMode','scanAmplitude','amplifierGain','dacModel'].includes(key)) buildPath();
  refresh(true);syncControls();
  if(old!==value){$('#global-status').textContent='Parameters updated. Equations and image respond to the current setup.';document.dispatchEvent(new Event('beam-parameters-changed'));}
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

$('#scan-dac-select').addEventListener('change',event=>{
  Object.assign(state,event.target.value==='4922'?LEGACY_SCAN_HARDWARE:SCAN_HARDWARE_DEFAULTS);
  buildPath();refresh(true);syncControls();renderEditor();document.dispatchEvent(new Event('beam-parameters-changed'));
  toast(`${derived.scanHardware.name} selected for this simulation. Hardware and firmware must match the selected DAC.`);
});
$('#detector-mode').addEventListener('change',event=>{state.detectorMode=event.target.value;state.adcBits=state.detectorMode==='current'?16:12;if(state.detectorMode!=='et')state.voltage=Math.max(3,state.voltage);refresh(true);syncControls();renderGuide();selectComponent('detector');document.dispatchEvent(new Event('beam-parameters-changed'));});
$('#detector-mount').addEventListener('change',event=>{
  Object.assign(state,event.target.value==='side'?SIDE_MOUNT_PRESET:{detectorOffset:0,detectorTilt:0,detectorDistance:5});
  refresh(true);syncControls();selectComponent('detector',true);document.dispatchEvent(new Event('beam-parameters-changed'));
});
$('#aim-detector').addEventListener('click',()=>setParam('detectorTilt',Math.max(0,Math.min(85,Number(derived.bse.placement.aimTilt.toFixed(1))))));
$('#inspect-mount').addEventListener('click',()=>$('#bse-mount-panel').scrollIntoView({block:'center',behavior:'smooth'}));
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
  const data=id==='detector'&&state.detectorMode==='current'?['07 / SPECIMEN CURRENT','LMC662 + ADS1115','The insulated specimen stage sends net current through a sealed feedthrough to the amplifier outside vacuum. No detector HV.','detector']:id==='detector'&&state.detectorMode==='bse'?['07 / DIRECT BSE DETECTION','Hamamatsu S11141-10',state.detectorOffset>0?'The detector sits inside the vacuum chamber, beside the beam. Sealed A/K feedthroughs connect it to the external readout.':'Centred detector: the primary beam uses its 2 mm hole. Finite beam clipping through the hole is not simulated.','detector']:components[id];if(!data)return;
  selectedComponent=id;status.selected=id;
  $('#component-category').textContent=data[0];$('#component-title').textContent=data[1];$('#component-description').textContent=data[2];
  $$('[data-component]').forEach(el=>el.classList.toggle('active',el.dataset.component===id));
  showControl(data[3]);if(zoom){column.focus(id);$('#column-canvas').scrollIntoView({block:'center',behavior:'smooth'});}
  column.update(state,derived,status);
}
const column=new ColumnView($('#column-canvas'),{onSelect:id=>selectComponent(id)});
for(const layer of ['electrons','magnetic','electric','connections'])$('#layer-'+layer).addEventListener('change',event=>column.setLayers({[layer]:event.target.checked}));
$$('[data-component]').forEach(el=>el.addEventListener('click',()=>selectComponent(el.dataset.component,true)));
$('#focus-component').addEventListener('click',()=>selectComponent(selectedComponent,true));
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
  if(name==='electrical')electricalView?.update(state,derived,status,signalSamples,signalWrite);
  column.pause(paused||name!=='lab');
}
$$('[data-page]').forEach(el=>el.addEventListener('click',()=>showPage(el.dataset.page)));
$$('[data-go]').forEach(el=>el.addEventListener('click',()=>{showPage(el.dataset.go);window.scrollTo({top:0,behavior:'smooth'});}));
$('.brand-mark').addEventListener('click',event=>{event.preventDefault();showPage('lab');});$('.wordmark').addEventListener('click',event=>{event.preventDefault();showPage('lab');});
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},4500);}
function updateBeam(){
  const vacuumReady=state.pressure<=1e-4, hot=derived.temperature>1500, emitted=derived.beamCurrent>1e-6;
  status.sourceOn=requestedBeam&&vacuumReady&&hot&&derived.emission>1e-9&&derived.extraction>0;
  status.beamOn=requestedBeam&&vacuumReady&&hot&&emitted;
  $('#beam-state').textContent=!requestedBeam?'Beam blanked':!vacuumReady?'Vacuum interlock':!hot?'Filament cold':state.aperture===0?'Aperture closed':!emitted?'Emission cut off':'Beam active';
  $('#beam-dot').style.background=status.beamOn?'#5e9b65':'#be9b59';
  $('#beam-toggle').textContent=requestedBeam?'Blank beam':'Enable beam';
  $('#scene-status').textContent=paused?'PAUSED':status.beamOn?'BEAM ON':'BEAM BLANKED';
}
$('#auto-focus').addEventListener('click',()=>{state.lensCurrent=Number(derived.focusCurrent.toFixed(5));refresh(true);syncControls();toast('Lens current set to the first modeled focus.');});
$('#beam-toggle').addEventListener('click',()=>{requestedBeam=!requestedBeam;refresh(false);});
function pauseSimulation(value){paused=value;column.pause(paused||currentPage!=='lab');$('#pause').textContent=paused?'▶':'Ⅱ';$('#pause').setAttribute('aria-label',paused?'Resume simulation':'Pause simulation');$('#pause').title=paused?'Resume simulation':'Pause simulation';updateBeam();}
$('#pause').addEventListener('click',()=>pauseSimulation(!paused));
function imagingPreset(){resetPreviewPlayback();for(const key of Object.keys(state))delete state[key];Object.assign(state,DEFAULTS);requestedBeam=true;paused=false;status.roughing=true;status.turbo=true;simulationTime=0;guideCompleted.clear();buildPath();refresh(true);syncControls();column.reset();column.pause(currentPage!=='lab');$('#pause').textContent='Ⅱ';$('#pause').setAttribute('aria-label','Pause simulation');$('#global-status').textContent='Imaging preset loaded. High vacuum and a warm filament are already established.';}
function coldStart(){resetPreviewPlayback();for(const key of Object.keys(state))delete state[key];paused=false;column.pause(currentPage!=='lab');$('#pause').textContent='Ⅱ';$('#pause').setAttribute('aria-label','Pause simulation');Object.assign(state,DEFAULTS,{heaterPower:0,voltage:3,pressure:1013});requestedBeam=false;status.roughing=false;status.turbo=false;simulationTime=0;guideCompleted.clear();buildPath();refresh(true);syncControls();$('#global-status').textContent='Cold start: chamber at atmosphere. Begin with the roughing pump in Vacuum or follow the Operating guide.';showControl('vacuum');}
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
  derived=calculate(state);updateBeam();if(!status.beamOn)bsePreviousPixel=0;derived.electrical=calculateElectrical(state,derived,status);column.update(state,derived,status);
  if(currentPage==='electrical')electricalView?.update(state,derived,status,signalSamples,signalWrite);
  updateDetectorPresentation();
  specimenPicker?.sync(selectedSpecimenId,state.detectorMode);
  const detectorReferenceUrl=state.detectorMode==='current'?'current.html':state.detectorMode==='bse'?'bse.html':`detector.html?current=${encodeURIComponent(derived.electrical.pmtAnodeCurrentuA.toFixed(4))}&dwell=${encodeURIComponent(state.dwell)}`;
  $('#detector-wiring').href=detectorReferenceUrl;$('#electrical-detector-guide').href=detectorReferenceUrl;
  $('#temperature-readout').textContent=`${formatNumber(derived.temperature,0)} K`;
  $('#temperature-bar').style.width=`${Math.min(100,Math.max(0,(derived.temperature-293)/3000*100))}%`;
  $('#pressure-readout').textContent=`${sci(state.pressure)} mbar`;
  $('#vacuum-note').textContent=state.pressure<=1e-4?'Model beam permit: pressure ≤ 1 × 10⁻⁴ mbar.':state.pressure<=.1?'Turbo crossover reached. Enable turbo to reach high vacuum.':'Rough down first. Turbo crossover is 0.1 mbar in this model.';
  $('#field-width').textContent=`${formatNumber(derived.scanFieldWidth*1000,1)} µm`;
  $('#scale-label').textContent=`${formatNumber(derived.scanFieldWidth*1000*.2,1)} µm`;
  $('#frame-time').textContent=scanDuration(derived.frameTime);
  $('#frame-time').title=`${derived.frameTime.toFixed(3)} seconds before transport overhead`;
  $('#preview-time').textContent=`${scanDuration(derived.frameTime/previewRate)} browser playback`;
  $('#preview-speed-note').textContent=previewRate===1?'Preview follows modeled acquisition time.':'Accelerated visualization only. Hardware scan time and detector settings are unchanged.';
  $('#scan-preview-status').textContent=previewComplete?'Frame complete':paused?'Preview paused':!status.beamOn?'Waiting for beam':`${Math.min(100,Math.floor(scanIndex/(state.resolution**2)*100))}% acquired${previewRate>1?` · ${previewRate}× playback`:''}`;
  $('#probe-current').textContent=`${formatNumber(status.beamOn?derived.beamCurrent:0,2)} nA`;
  $('#focus-current').textContent=`${derived.focusCurrent.toFixed(3)} A`;
  const bse=state.detectorMode==='bse',bd=derived.electrical.bse||derived.bse;
  if(state.detectorMode==='current'){
    const cd=derived.electrical.current;
    $('#current-net').textContent=`${formatNumber(cd.netCurrentnA,4)} nA`;
    $('#current-output').textContent=`${formatNumber(cd.outputV,4)} V`;
    $('#current-noise').textContent=`${formatNumber(cd.rmsNoisepA,2)} pA`;
    $('#current-settle').textContent=`${formatNumber(cd.settlingTimeUs/1000,2)} ms`;
    $('#current-adc').textContent=`${formatNumber(cd.adcDifferentialV*1000,3)} mV`;
    $('#current-frame').textContent=`${formatNumber(cd.frameTimeS,2)} s`;
    $('#pmt-gain').textContent=`${formatNumber(cd.outputV,4)} V`;
    const timing=state.settleTime<cd.settlingTimeUs;
    $('#detector-limit').textContent=cd.clipped?'Readout clipping — reduce beam current / Rf or increase ADC range.':timing?'Settling shorter than the ideal 1% response; neighboring pixels can mix.':`${cd.adcCode} raw ADC code · ${formatNumber(cd.inputLSBpA,3)} pA/code (not sensitivity). Synthetic yield contrast; calibrate zero and gain.`;
    $('#detector-limit').classList.toggle('limit-active',cd.clipped||timing);
  }else if(bse){
    updateMountView($('#bse-mount-panel'),state,bd);
    $('#mount-summary').textContent=bd.placement.side?`${formatNumber(bd.placement.clearance,2)} mm estimated side clearance · ${bd.placement.mountClear?'clear':'check mount'}`:bd.placement.status;
    $('.bse-part-tag span').textContent=bd.placement.side?'10 × 10 mm silicon · Ø 2 mm hole; primary beam passes beside the detector':'10 × 10 mm silicon · primary beam uses the Ø 2 mm hole';
    const canAim=bd.placement.aimTilt>=0&&bd.placement.aimTilt<=85;
    $('#aim-detector').disabled=!canAim;
    $('#aim-detector').textContent=canAim?`Aim at scan centre · ${formatNumber(bd.placement.aimTilt,1)}°`:'Scan centre outside the available tilt range';
    if(selectedComponent==='detector')$('#component-description').textContent=bd.placement.side?'The detector sits inside the vacuum chamber, beside the beam. Sealed A/K feedthroughs connect it to the external readout.':'Centred detector: the primary beam uses its 2 mm hole. Finite beam clipping through the hole is not simulated.';
    $('#pmt-gain').textContent=`${formatNumber(bd.rawOutputV,3)} V`;
    $('#bse-adc').textContent=`${formatNumber(bd.adcInputV,3)} V`;$('#bse-noise').textContent=`${formatNumber(Number.isFinite(bd.noiseRmsnA)?bd.noiseRmsnA*1000:NaN,1)} pA`;
    $('#bse-current').textContent=`${formatNumber(bd.incidentCurrentnA,4)} nA`;
    $('#bse-settle').textContent=`${formatNumber(bd.settlingTimeUs,0)} µs`;
    $('#bse-collection').textContent=`${formatNumber(bd.collectionFraction*100,1)}%`;
    $('#bse-energy').textContent=`${formatNumber(bd.meanEnergykeV,2)} keV`;
    const warnings=[];if(!bd.placement.valid||(bd.placement.side&&!bd.placement.mountClear))warnings.push(bd.placement.status);if(!bd.energySupported)warnings.push('Mean energy outside the characterized 1–30 keV range');if(bd.saturated)warnings.push('ADC clipping: reduce gain or beam current');if(state.dwell<bd.settlingTimeUs)warnings.push('Dwell shorter than the modeled 1% settling time');
    $('#detector-limit').textContent=warnings.length?warnings.join(' · '):`In range · ${formatNumber(bd.generatedCurrentnA,2)} nA signal + ${formatNumber(bd.darkCurrentnA,2)} nA dark current. Synthetic material contrast; uncalibrated signal model.`;
    $('#detector-limit').classList.toggle('limit-active',warnings.length>0);
  }else{
    $('#detector-limit').textContent=derived.pmtAnodeCurrent>100?`PMT current exceeds illustrative 100 µA limit; saturation is not modeled.`:`Estimated PMT anode current: ${formatNumber(status.beamOn?derived.pmtAnodeCurrent:0,2)} µA. Normalized synthetic intensity.`;
    $('#detector-limit').classList.toggle('limit-active',derived.pmtAnodeCurrent>100);$('#pmt-gain').textContent=`${sci(derived.pmtGain,1)}×`;
  }
  $('#signal-value').textContent=status.beamOn?formatNumber(derived.snr,1):'0.0';
  $('#scan-count').textContent=state.resolution>imageSize?`${state.resolution}² samples · ${imageSize}² preview`:`${state.resolution} × ${state.resolution} px`;
  const sh=derived.scanHardware;
  $('#scan-hardware-name').textContent=`${sh.name} · ${sh.dacBits}-bit`;
  $('#scan-step-readout').textContent=`${formatNumber(sh.positionStepNm,2)} nm`;
  $('#scan-code-readout').textContent=`${formatNumber(sh.dacStepV*1e6,3)} µV`;
  $('#scan-pitch-readout').textContent=`${formatNumber(derived.scanFieldWidth*1e6/(state.resolution-1),2)} nm`;
  $('#scan-spot-readout').textContent=`${formatNumber(derived.spotSize,1)} nm`;
  $('#scan-position-readout').textContent=`${sh.rasterPositions} / ${state.resolution}`;
  const scanWarning=$('#scan-hardware-status');
  scanWarning.classList.toggle('is-warning',sh.clipped||sh.repeatedRasterPixels>0);
  scanWarning.textContent=sh.clipped?'Scan commands exceed the DAC range and are clipped. Reduce amplitude or correct the physical amplifier gain.':sh.repeatedRasterPixels>0?`${sh.repeatedRasterPixels} requested raster positions per axis share a DAC code. More pixels here repeat beam positions; use a finer physical amplifier range.`:`${sh.name} · ${sh.dacBits}-bit quantization is applied to the trajectory and sampled image. Position increment and spot estimate are separate; neither is measured image resolution.`;
  $('#model-clock').textContent=`SIM TIME ${simulationTime.toFixed(1)} s${state.pressure>1e-4?' · VACUUM 20×':''}`;
  updateEquations();
  if(imageChanged){rebuildSpecimen();restartScan();drawTrajectory();}
}

var presentedDetectorMode=null;
function updateDetectorPresentation(){
  if(presentedDetectorMode===state.detectorMode)return;presentedDetectorMode=state.detectorMode;
  const current=state.detectorMode==='current',bse=state.detectorMode==='bse',et=state.detectorMode==='et';
  document.body.classList.toggle('bse-mode',bse);document.body.classList.toggle('current-mode',current);
  $$('#config-hints .config-hint').forEach(el=>el.hidden=(el.dataset.detectorHint==='current'&&!current)||(el.dataset.detectorHint==='legacy'&&current)||(el.dataset.detectorHint==='bse'&&!bse));
  $('#bse-mount-panel').hidden=!bse;$('#bse-controls').hidden=!bse;$('#et-controls').hidden=!et;$('#bse-readout-grid').hidden=!bse;
  $('#current-controls').hidden=!current;$('#current-readout-grid').hidden=!current;
  $('#detector-heading').textContent=current?'Read the specimen current':bse?'Silicon, straight to signal':'Turn electrons into light';
  $('#detector-intro').textContent=current?'Insulated stage → LMC662 → ADS1115 → ESP32.':bse?'S11141-10 → current amplifier → ADC → ESP32.':'Collection cage → scintillator → light guide → PMT.';
  $('#detector-type-label').textContent=current?'LMC662 / CURRENT':bse?'SILICON / BSE':'ET / PMT';$('#detector-gain-label').textContent=et?'PMT gain':'TIA output';
  $('#active-detector-chain').innerHTML=current?'<span>Stage</span><i>→</i><span>LMC662</span><i>→</i><span>ADS1115</span><i>→</i><span>ESP32</span>':bse?'<span>Si</span><i>→</i><span>TIA</span><i>→</i><span>ADC</span><i>→</i><span>ESP32</span>':'<span>Cage</span><i>→</i><span>Light</span><i>→</i><span>PMT</span><i>→</i><span>ADC</span>';
  $('#return-electron-legend').innerHTML=`<i class="secondary-key"></i> ${current?'Escaped':bse?'Backscattered':'Secondary'} e⁻`;$('#photon-legend').hidden=!et;
  $('.signal-value span').textContent=current?'net-current / noise estimate':bse?'ideal averaged SNR / pixel':'estimated SNR / pixel';
  $('#signal-canvas').setAttribute('aria-label',current?'Simulated specimen-current contrast trace':'Simulated detector contrast trace');
  $('#wiring-card-title').textContent=current?'LMC662: circuit, PCB and commissioning':bse?'S11141-10: a complete signal path':'Scintillator & PMT: from concept to connections';
  $('#wiring-card-description').textContent=current?'Exact connectors, isolated stage, ±5 V rails, zero calibration, editable firmware and fabrication files.':bse?'Diode polarity, reverse bias, amplifier feedback and ADC conditioning.':'Previous ET architecture with separate scintillator HV and PMT readout.';
  $('#bse-physics-note').hidden=!bse;
  if(selectedComponent==='detector'){$('#component-title').textContent=current?'LMC662 + ADS1115':bse?'Hamamatsu S11141-10':'Everhart–Thornley detector';$('#component-description').textContent=current?'The insulated stage is inside vacuum. The shielded amplifier is outside, beside its sealed feedthrough.':bse?'Returning electrons create charge in silicon. The amplifier converts current to voltage.':components.detector[2];}
}

function equationCard(eq){const el=document.createElement('button');el.type='button';el.className='equation-card';el.dataset.equation=eq.id;el.setAttribute('aria-haspopup','dialog');el.setAttribute('aria-label',`${eq.title}: show derivation and sources`);el.innerHTML='<span class="equation-info">ⓘ</span><h3></h3><div class="formula"></div><div class="equation-result"></div><div class="equation-substitution"></div>';el.querySelector('h3').textContent=eq.title;el.querySelector('.formula').textContent=eq.formula;el.addEventListener('pointerenter',()=>{clearTimeout(popoverTimer);if(!popoverPinned)showEquation(eq,el,false);});el.addEventListener('pointerleave',scheduleClose);el.addEventListener('focus',()=>{if(!popoverPinned)showEquation(eq,el,false);});el.addEventListener('blur',scheduleClose);el.addEventListener('click',()=>showEquation(eq,el,true));return el;}
EQUATIONS.forEach(eq=>$('#all-equations').append(equationCard(eq)));
ELECTRICAL_EQUATIONS.filter(eq=>['gunElectricField','apertureElectricField','heaterElectrical','lensElectrical'].includes(eq.id)).forEach(eq=>$('#electrical-equations').append(equationCard(eq)));
const quickCandidates=['speed','wavelength','emission','lens','vacuum','deflection'];
const quickIds=quickCandidates.map(id=>PHYSICS_EQUATIONS.find(eq=>eq.id===id||eq.id.includes(id))).filter(Boolean).slice(0,4);
const quick=quickIds.length===4?quickIds:EQUATIONS.slice(0,4);
quick.forEach(eq=>$('#quick-equations').append(equationCard(eq)));
if($('#current-quick-equations'))CURRENT_EQUATIONS.filter(eq=>['currentBalance','currentTIA','currentADC'].includes(eq.id)).forEach(eq=>$('#current-quick-equations').append(equationCard(eq)));
SCAN_HARDWARE_EQUATIONS.forEach(eq=>$('#scan-equations').append(equationCard(eq)));
if($('#bse-quick-equations'))BSE_EQUATIONS.filter(eq=>['bseCharge','bseTIA','bseTiming'].includes(eq.id)).forEach(eq=>$('#bse-quick-equations').append(equationCard(eq)));
for(const [id,key] of [['mount-collection-source','bseCollection'],['mount-clearance-source','bseClearance']]){const el=$('#'+id),eq=EQUATIONS.find(q=>q.id===key);el.addEventListener('pointerenter',()=>{if(!popoverPinned)showEquation(eq,el,false);});el.addEventListener('pointerleave',scheduleClose);el.addEventListener('focus',()=>showEquation(eq,el,false));el.addEventListener('blur',scheduleClose);el.addEventListener('click',()=>showEquation(eq,el,true));}
function equationContext(eq){if(eq.id==='field'){const p={...state,plateVoltage:state.plateVoltage+state.scanAmplitude*(status.scanPoint?.x||0)};return [p,{...derived,field:p.plateVoltage/(state.plateGap*1e-3)}];}return [state,derived];}
function updateEquations(){
  $$('[data-equation]').forEach(el=>{const bse=state.detectorMode==='bse';el.hidden=(el.dataset.equation.startsWith('bse')&&!bse)||(el.dataset.equation.startsWith('current')&&state.detectorMode!=='current')||(state.detectorMode!=='et'&&['collection','pmtGain','snr','pmtSignalCurrent'].includes(el.dataset.equation))||(state.detectorMode==='current'&&el.dataset.equation==='frameTime');const eq=EQUATIONS.find(x=>x.id===el.dataset.equation);const [p,d]=equationContext(eq);el.querySelector('.equation-result').textContent=eq.result(p,d);el.querySelector('.equation-substitution').textContent=eq.substitution(p,d);});
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

function resetPreviewPlayback(){previewRate=1;singleFramePreview=false;previewComplete=false;$('#preview-speed').value='1';}
function scanDuration(seconds){
  if(seconds>=3600)return `${Math.floor(seconds/3600)} h ${Math.floor(seconds%3600/60)} min`;
  if(seconds>=60)return `${Math.floor(seconds/60)} min ${Math.floor(seconds%60)} s`;
  return `${formatNumber(seconds,seconds<10?2:1)} s`;
}
let imageSize=256;
const specimen=$('#specimen-canvas'),specimenCtx=specimen.getContext('2d');
const texture=document.createElement('canvas');texture.width=texture.height=imageSize;
const textureCtx=texture.getContext('2d',{willReadFrequently:true});
const scanBuffer=document.createElement('canvas');scanBuffer.width=scanBuffer.height=imageSize;
const scanCtx=scanBuffer.getContext('2d');
let signalSamples=new Float32Array(120),signalWrite=0,texturePixels=null,bsePreviousPixel=0;
specimenPicker=mountSpecimenPicker({
  onSelect(id){
    selectedSpecimenId=getSpecimen(id).id;
    signalSamples.fill(0);signalWrite=0;
    refresh(true);syncControls();document.dispatchEvent(new Event('beam-parameters-changed'));
    toast(`${getSpecimen(selectedSpecimenId).name} selected. Scan restarted${paused?' — resume the simulation to acquire':!status.beamOn?' — enable the beam when ready':''}.`);
  },
  onFit(){
    const item=getSpecimen(selectedSpecimenId);
    const fieldAtOneVolt=calculate({...state,scanAmplitude:1}).scanFieldWidth*1000;
    const requestedAmplitude=item.fieldWidthUm/fieldAtOneVolt;
    if(!Number.isFinite(requestedAmplitude)||requestedAmplitude<=0){toast('Set a valid beam voltage and plate geometry before fitting the specimen.');return;}
    const amplitude=Math.max(.01,Math.min(100,derived.scanHardware.maxAmplitude,requestedAmplitude));
    state.plateVoltage=0;state.scanAmplitude=amplitude;
    buildPath();refresh(true);syncControls();document.dispatchEvent(new Event('beam-parameters-changed'));
    toast(`${item.name} centered · ${formatNumber(derived.scanFieldWidth*1000,1)} µm field.${Math.abs(amplitude-requestedAmplitude)>1e-6?' Limited by the available scan range.':''}`);
  }
});
function rebuildSpecimen(){
  const data=textureCtx.createImageData(imageSize,imageSize);
  const sample=createSpecimenSampler(selectedSpecimenId);
  const fieldMap=state.detectorMode==='bse'&&state.detectorOffset>0?collectionField(state):null;
  const field=Math.max(.000001,derived.scanFieldWidth||.000001),scale=field/.35;
  const noise=24/Math.max(state.detectorMode==='bse'?.02:1,derived.snr||0),offset=(derived.deflection||0)/.35;
  for(let y=0;y<imageSize;y++)for(let x=0;x<imageSize;x++){
    const px=(x/(imageSize-1)-.5)*scale+offset,py=(y/(imageSize-1)-.5)*scale;
    let value=sample(px*350,py*350,state.detectorMode==='et');
    const grain=((x*73856093^y*19349663)>>>0)%101/100-.5;
    value+=grain*(9+noise*5)+14*(py+.5);
    if(state.detectorMode==='bse'){
      const b=derived.bse;
      if(fieldMap){const omega=sampleCollectionField(fieldMap,x/(imageSize-1),y/(imageSize-1));value*=fieldMap.centre>0?omega/fieldMap.centre:0;}
      if(!b.energySupported||b.signalVoltageV<=0)value=grain*noise+4;
      else{const demand=b.darkOffsetV+b.signalVoltageV*Math.max(0,value/150);value=150*Math.max(0,Math.min(b.tiaFullScaleV??state.adcFullScale,demand)-b.darkOffsetV)/Math.max(b.signalVoltageV,.000001);}
    }
    if(state.detectorMode==='current'){
      const cd=derived.current;
      // Synthetic 5%-of-incident-current yield modulation; not a depth model.
      const modulation=(value-80)/150*.05*derived.beamCurrent;
      const demanded=(cd.netCurrentnA+modulation)*state.currentRf*.001;
      const differential=cd.zeroDifferentialV-cd.attenuation*demanded;
      const clipped=demanded>4||demanded< -4||Math.abs(differential)>state.currentADCRange;
      const contrastSignal=Math.max(1e-6,.05*derived.beamCurrent*1000);
      value=clipped?245:80+(value-80)*.8+grain*cd.rmsNoisepA/contrastSignal*180;
    }
    const index=(y*imageSize+x)*4;data.data[index]=Math.min(255,Math.max(0,value));data.data[index+1]=Math.min(255,Math.max(0,value+3));data.data[index+2]=Math.min(255,Math.max(0,value+2));data.data[index+3]=255;
  }
  const blur=Math.max(.15,(derived.spotSize||100)/(field*1e6)*imageSize);
  blurLuminance(data.data,imageSize,imageSize,blur);
  textureCtx.putImageData(data,0,0);texturePixels=data.data;
}
function restartScan(){bsePreviousPixel=0;scanIndex=0;frameCount=0;sampleRemainder=0;previewComplete=false;$('#download-scan').disabled=true;scanCtx.fillStyle='#162323';scanCtx.fillRect(0,0,imageSize,imageSize);drawSpecimen();}
$('#acquire').addEventListener('click',()=>{restartScan();toast('New scan started with the current parameters.');});
function buildPath(){
  const nextSize=Math.max(256,state.resolution);
  if(nextSize!==imageSize){imageSize=nextSize;for(const canvas of [texture,scanBuffer,specimen])canvas.width=canvas.height=imageSize;texturePixels=null;}
  mapImagePixel=createImagePixelMapper(state.resolution,imageSize);
  const count=state.resolution**2;
  if(state.scanMode==='custom'&&customPath?.length===count*3)requestedPath=customPath;
  else{requestedPath=new Float32Array(count*3);for(let i=0;i<count;i++){const p=scanPoint(i,state.resolution,state.scanMode==='custom'?'raster':state.scanMode);requestedPath[i*3]=p.x;requestedPath[i*3+1]=p.y;requestedPath[i*3+2]=p.blank?1:0;}}
  path=new Float32Array(requestedPath.length);
  const quantize=createScanQuantizer(state);
  for(let i=0;i<count;i++){path[i*3]=quantize(requestedPath[i*3]).normalized;path[i*3+1]=quantize(requestedPath[i*3+1]).normalized;path[i*3+2]=requestedPath[i*3+2];}
  pathVersion++;scanIndex=0;
}
function advanceScan(dt){
  if(!status.beamOn||!path||paused||previewComplete)return;
  sampleRemainder+=dt*previewRate*state.resolution**2/Math.max(derived.frameTime,1e-6);
  const count=Math.min(8000,Math.floor(sampleRemainder));sampleRemainder-=count;
  const n=state.resolution,total=n*n;
  for(let k=0;k<count;k++){
    if(scanIndex>=total){scanIndex=0;}
    const index=scanIndex*3,x=path[index],y=path[index+1],blank=path[index+2]===1;
    const ix=Math.min(imageSize-1,Math.max(0,Math.round((x+1)*.5*(imageSize-1)))),iy=Math.min(imageSize-1,Math.max(0,Math.round((y+1)*.5*(imageSize-1))));
    const pixel=mapImagePixel(requestedPath[index],requestedPath[index+1]);
    if(!blank){
      if(state.detectorMode!=='et'&&texturePixels){
        const sample=texturePixels[(iy*imageSize+ix)*4];
        const tauUs=state.detectorMode==='current'?derived.current.timeConstantUs:derived.bse.timeConstantUs;
        const alpha=-Math.expm1(-(state.dwell+(state.detectorMode==='current'?state.settleTime:0))/tauUs);
        bsePreviousPixel+=alpha*(sample-bsePreviousPixel);
        const v=Math.round(Math.max(0,Math.min(255,bsePreviousPixel)));scanCtx.fillStyle=`rgb(${v},${v},${v})`;scanCtx.fillRect(pixel.x,pixel.y,pixel.width,pixel.height);
      }else if(texturePixels){const offset=(iy*imageSize+ix)*4;scanCtx.fillStyle=`rgb(${texturePixels[offset]},${texturePixels[offset+1]},${texturePixels[offset+2]})`;scanCtx.fillRect(pixel.x,pixel.y,pixel.width,pixel.height);}
    }
    if(blank&&state.detectorMode!=='et'){const tauUs=state.detectorMode==='current'?derived.current.timeConstantUs:derived.bse.timeConstantUs;bsePreviousPixel*=Math.exp(-state.dwell/tauUs);}
    status.scanPoint={x,y,blank};scanIndex++;
    if(scanIndex===total){frameCount++;$('#download-scan').disabled=false;if(singleFramePreview){previewComplete=true;sampleRemainder=0;break;}}
  }
  if(count&&texturePixels){const px=Math.max(0,Math.min(imageSize-1,Math.round((status.scanPoint.x+1)*.5*(imageSize-1)))),py=Math.max(0,Math.min(imageSize-1,Math.round((status.scanPoint.y+1)*.5*(imageSize-1))));signalSamples[signalWrite++%signalSamples.length]=status.scanPoint.blank?0:state.detectorMode!=='et'?bsePreviousPixel/255:texturePixels[(py*imageSize+px)*4]/255;}
}
function drawSpecimen(){
  const w=specimen.width,h=specimen.height;specimenCtx.imageSmoothingEnabled=true;specimenCtx.fillStyle='#152426';specimenCtx.fillRect(0,0,w,h);specimenCtx.drawImage(scanBuffer,0,0,w,h);
  if(status.beamOn&&!status.scanPoint.blank&&!previewComplete){const x=(status.scanPoint.x+1)*.5*w,y=(status.scanPoint.y+1)*.5*h;specimenCtx.strokeStyle='#c3e9c99c';specimenCtx.lineWidth=.6;specimenCtx.beginPath();specimenCtx.moveTo(x-5,y);specimenCtx.lineTo(x+5,y);specimenCtx.moveTo(x,y-5);specimenCtx.lineTo(x,y+5);specimenCtx.stroke();}
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
[{title:'LMC662 current PCB + ADS1115',body:'Use J1 for the insulated stage and guard, J2 for regulated ±5 V, J3 for AGND / REF3V3 output / SDA21 / SCL22 / optional ALERT. Leave ALERT disconnected when GPIO27 is the scan DAC CS. Current firmware polls ADS readiness. Zero with a blanked beam before start. Rf/Cf changes require physical parts.',url:'https://www.ti.com/lit/ds/symlink/ads1115.pdf'},...CONFIG_HINTS].forEach(hint=>{const el=document.createElement('div');el.className='config-hint';el.dataset.detectorHint=hint.title.startsWith('LMC662')?'current':hint.title==='Silicon BSE readout'?'bse':['Condition the detector signal','Timing and dwell'].includes(hint.title)?'legacy':'all';const h=document.createElement('h3');h.textContent=hint.title;const p=document.createElement('p');p.textContent=hint.body;const a=document.createElement('a');a.textContent='Manufacturer reference ↗';a.href=hint.url;a.target='_blank';a.rel='noopener noreferrer';el.append(h,p,a);$('#config-hints').append(el);});
function saveEditor(){if(activeEditor==='trajectory')trajectoryCode=$('#code-editor').value;else{firmwareCode=$('#code-editor').value;}}
function createFirmware(){return (state.detectorMode==='current'?generateCurrentFirmware:generateFirmware)({...state,settle:state.settleTime,retrace:state.flyback});}
function renderEditor(){
  if(state.scanMode!=='custom'&&(!firmwareCode||!firmwareDirty)){
    try{firmwareCode=createFirmware();}catch(error){$('#program-status').textContent=`Simulation parameters exceed this sketch's configuration bounds: ${error.message}`;$('#program-status').classList.add('error');}
  }
  $('#code-editor').value=activeEditor==='trajectory'?trajectoryCode:firmwareCode;
  $('#editor-language').textContent=activeEditor==='trajectory'?'JAVASCRIPT · WEB WORKER':'ARDUINO C++ · CLASSIC ESP32';
  $('#editor-description').textContent=activeEditor==='trajectory'?'Return a normalized point { x, y, blank } for each pixel. i = sample index, n = resolution, t = frame fraction.':(state.scanMode==='custom'?'Custom JS is active. This is the previous preset sketch; port the custom trajectory to pointAt() before running it on an ESP32. ':'')+'Edit the full sketch. Apply reads supported configuration constants for preview; export to compile with Arduino-ESP32.';
  $('#firmware-notice').hidden=activeEditor!=='firmware';
  if(activeEditor==='firmware'){
    const parsed=parseFirmwareConfig(firmwareCode),keys=['resolution','dwell','scanAmplitude','scanMode','dacModel','dacBits','dacReference','amplifierGain'];
    const different=!parsed.errors.length&&keys.some(key=>parsed.config[key]!==state[key]);
    $('#firmware-notice').textContent=(different?'This saved sketch differs from the current simulation settings. Apply its configuration, or choose a built-in pattern and Reset code to regenerate it. ':'')+'Browser preview reads supported constants only. Edited C++ requires Arduino compilation; it is not executed here.';
  }
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
      customPath=result.points;appliedTrajectoryCode=trajectoryCode;state.scanMode='custom';$('#scan-mode option[value="custom"]').disabled=false;buildPath();refresh(true);syncControls();workspace.markDirty();message.textContent=`${result.count.toLocaleString()} points checked · applied`;toast('Custom trajectory applied to the microscope.');
    }else{
      const parsed=parseFirmwareConfig(firmwareCode);if(parsed.errors.length)throw new Error(parsed.errors.join(' '));
      firmwareAppliedCode=firmwareCode;
      Object.assign(state,parsed.config,{settleTime:parsed.config.settle,flyback:parsed.config.retrace});
      if(parsed.config.currentDetector===1){state.detectorMode='current';state.voltage=Math.max(3,state.voltage);}
      renderGuide();
      buildPath();refresh(true);syncControls();message.textContent=parsed.warnings.length?`Config applied. ${parsed.warnings.join(' ')}`:'Configuration checked and applied. C++ requires compilation.';toast('Firmware configuration applied. Full C++ execution requires hardware.');
    }
  }catch(error){message.textContent=error.message;message.classList.add('error');}
  finally{button.disabled=false;}
});
$('#reset-program').addEventListener('click',()=>{if(activeEditor==='trajectory')trajectoryCode=DEFAULT_PROGRAM;else{if(state.scanMode==='custom'){toast('Choose a built-in pattern before regenerating firmware. Port custom JS to pointAt() manually.');return;}firmwareCode=createFirmware();firmwareDirty=false;}renderEditor();$('#program-status').textContent='Code reset · apply to update preview';$('#program-status').classList.remove('error');});
function download(name,text,type='text/plain'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#download-code').addEventListener('click',()=>{saveEditor();download(activeEditor==='trajectory'?'trajectory.js':'ESP32_scan.ino',activeEditor==='trajectory'?trajectoryCode:firmwareCode);});
$('#export-settings').addEventListener('click',()=>{download('beam-lab-setup.json',JSON.stringify({model:'Beam Lab 4.1 — LMC662 specimen current / silicon BSE / ET',...getSnapshot(),assumptions:'Illustrative educational geometry and detector model; not calibrated hardware.',exportedAt:new Date().toISOString()},null,2),'application/json');toast('Simulation setup exported.');});

const guideSteps=[
  {title:'Prepare the instrument',short:'Check the column and starting state',body:'Start with a cold filament, blanked beam, pumps stopped, and a chamber at atmospheric pressure. Locate the electron gun, aperture, lenses, scan plates, specimen, detector, and pump connection in the cutaway.',observe:'No electron beam is visible. The pressure is 1,013 mbar and estimated filament temperature is near ambient.',hardware:'Select a documented gun and its floating heater supply. Verify the column, feedthroughs, grounding, shielding, vacuum gauges, and hardwired permit system against the engineering report before commissioning HV.',button:'Load cold starting state',action:()=>{coldStart();return 'Cold starting state loaded. Continue to the roughing pump.';}},
  {title:'Rough down the chamber',short:'Start the backing pump',body:'The roughing pump removes the bulk of the gas. Pressure follows the gas-balance model and approaches the backing pump’s floor. Watch pressure fall; simulated time runs at 20× during pump-down.',observe:'The pressure should fall below 0.1 mbar before the turbo can be enabled. Pump-down slows as it approaches the floor.',hardware:'The pump manufacturer sets the permitted turbo inlet and backing pressures. The 0.1 mbar crossover here is a teaching-model threshold, not a universal pump specification.',button:'Start roughing pump',action:()=>{status.roughing=true;syncControls();refresh(false);return 'Roughing pump started. Allow the model to reach ≤ 0.1 mbar before the next step.';}},
  {title:'Establish high vacuum',short:'Enable the turbo and check gas load',body:'Enable the turbomolecular pump once the roughing stage reaches crossover. Effective pumping speed includes the restriction of the connecting line. The final pressure approaches gas load divided by effective speed.',observe:'High-vacuum pressure should settle near Q / S_eff. A large leak can keep it above the 10⁻⁴ mbar model beam-permit threshold.',hardware:'Use a gauge suitable for each pressure range and measure near the gun. Tungsten-gun operation often targets about 10⁻⁵ mbar or better; the actual gun documentation governs.',button:'Enable turbomolecular pump',action:()=>{if(!status.roughing||state.pressure>.1)return 'Waiting: keep the roughing pump running until pressure is ≤ 0.1 mbar, then apply this step again.';status.turbo=true;syncControls();refresh(false);return 'Turbo running. Watch the chamber approach its modeled equilibrium pressure.';}},
  {title:'Warm the filament',short:'Explore temperature and emission',body:'Set illustrative heater power to 3 W. The simulator calculates a steady-state tungsten temperature from radiative and conductive losses, then estimates thermionic emission. The real warm-up transient is not modeled.',observe:'The filament glows and emission rises steeply with temperature. Acceleration voltage is still independent of heater power.',hardware:'Use the actual filament’s rated current, power, and warm-up procedure. The heater supply and controls float near the negative cathode potential; their continuous isolation rating matters.',button:'Set heater to 3 W',action:()=>{if(state.pressure>1e-4)return 'Waiting: establish high vacuum first. The model leaves the filament cold.';state.heaterPower=3;refresh(true);syncControls();return 'Steady-state heater model set to 3 W. Inspect temperature and thermionic emission in Physics & sources.';}},
  {title:'Form the primary beam',short:'Apply acceleration and inspect the aperture',body:'Enable the simulated beam at 3 kV with −150 V Wehnelt bias. Electrons accelerate toward the grounded anode. The aperture clips the angular spread and reduces the transmitted current.',observe:'Electron motion appears in the column. Change the aperture diameter and compare the probe-current and spot-size estimates.',hardware:'Commission the acceleration supply with characterized loads and verified interlocks first. Establish a beam on a suitable Faraday cup or phosphor target before relying on an imaging detector.',button:'Enable 3 kV beam',action:()=>{if(state.pressure>1e-4||derived.temperature<1500)return 'Waiting: high vacuum and a hot filament are required before enabling the beam.';state.voltage=3;state.wehnelt=-150;requestedBeam=true;refresh(true);syncControls();return 'Beam enabled. It is blanked automatically if chamber pressure rises above the model threshold.';}},
  {title:'Focus and calibrate',short:'Match the magnetic lens to the working distance',body:'The axial magnetic field bends electron trajectories into a focus. Adjust lens current so the modeled back focal plane meets the specimen. Lens-to-specimen distance is plate length plus post-plate drift in this ideal geometry. Re-focus when acceleration voltage or working distance changes.',observe:'Use Fields to inspect the magnetic lens. The modeled blur decreases near the calculated focus; shrinking the aperture also reduces current.',hardware:'Calibrate scan gain and astigmatism with a reference specimen. The model’s hard-edge solenoid, source size, aberrations, and schematic column do not predict a built microscope’s resolution.',button:'Set calculated focus current',action:()=>{state.lensCurrent=Number.isFinite(derived.focusCurrent)?Math.min(.9,Math.max(.05,derived.focusCurrent)):.45;refresh(true);syncControls();return `Model focus set to ${state.lensCurrent.toFixed(3)} A. Use the magnetic lens and spot-size equations to inspect the assumptions.`;}},
  {title:'Program the raster',short:'Synchronize plates, blanking, and sampling',body:'Scan a 128 × 128 raster with 40 µs beam-on dwell. Each pixel requires a position command, settling interval, exposure, and ADC sample. Retrace and serial transport add overhead to the ideal frame time.',observe:'Open Scan program to edit an arbitrary JavaScript trajectory. The ESP32 sketch uses an selected dual SPI DAC and separate bipolar scan amplifiers. DAC80502 uses 16-bit data and a buffered 1.25 V center; saved MCP4922 setups retain 12-bit commands.',hardware:'Validate voltages, paired DAC updates, settling time, ADC signal conditioning, blanking polarity, and hardware timing. The sketch starts disarmed; serial s starts acquisition and x stops it.',button:'Apply a 128 × 128 raster',action:()=>{state.resolution=128;state.dwell=40;state.scanMode='raster';buildPath();refresh(true);syncControls();return 'Raster applied. Open Scan program to preview the trajectory or edit the firmware configuration.';}},
  {title:'Collect the first image',short:'Adjust detector gain, then shut down',body:'A positively biased cage collects secondary electrons. They strike a scintillator; light travels to the photomultiplier, whose dynodes amplify the signal. Compare dwell, probe current, collection bias, and PMT gain.',observe:'The synthetic specimen scan fills in. PMT gain changes signal amplification, while photon statistics and excess noise limit signal-to-noise ratio.',hardware:'Set scintillator and PMT supplies to the chosen detector’s specifications. For shutdown, blank the beam, reduce HV and heater, verify discharge, and follow pump and vent procedures. The collection cage is distinct from a current-measuring Faraday cup.',button:'Acquire the first image',action:()=>{state.pmtVoltage=800;state.collectionBias=250;refresh(true);syncControls();return status.beamOn?'Acquisition restarted. Inspect the detector, or blank the beam to explore shutdown.':'Detector set. Enable the beam after establishing high vacuum and heating.';}}
];
const legacyDetectorStep={...guideSteps[7]},legacyRasterStep={...guideSteps[6]};
function renderGuide(){
  Object.assign(guideSteps[6],legacyRasterStep);Object.assign(guideSteps[7],legacyDetectorStep);
  if(state.detectorMode==='current'){
    Object.assign(guideSteps[6],{title:'Program a slow first raster',short:'Move → unblank → settle → fresh ADC conversion',body:'Begin at 32 × 32 pixels, 5 ms settling and a 10 ms acquisition window. ADS1115 performs a fresh differential conversion at every point. Hardware transport adds time.',observe:'A nominal frame takes about 15.4 seconds. A shorter requested dwell is limited by the real ADC conversion rate.',hardware:'Bench-check the amplifier with beam off and known test currents. Measure settling with the actual feedthrough and cable. Use I²C GPIO21/22; leave optional ALERT unconnected because the scan DAC uses GPIO27 as chip select.',button:'Apply 32 × 32 current raster',action:()=>{Object.assign(state,{resolution:32,dwell:10000,settleTime:5000,scanMode:'raster'});buildPath();refresh(true);syncControls();return '32 × 32 raster applied. Current acquisition uses millisecond timing.';}});
    Object.assign(guideSteps[7],{title:'Measure specimen current',short:'Isolate the stage, calibrate zero and gain',body:'Use a conductive test specimen on an electrically insulated stage inside vacuum. Its only signal connection goes through the vacuum feedthrough to J1 of the shielded LMC662 board outside the chamber. The chamber and guard remain at AGND.',observe:'Net charge changes with secondary and backscattered electron escape. This image is a synthetic yield pattern, not a prediction of butterfly-wing depth resolution.',hardware:'Verify ±5 V rails and on-board 3.3 V. Leave J3 reference output disconnected from ESP32 power; power ESP32 separately and share AGND. Measure zero with the beam blanked and calibrate gain with known current. Firmware z measures zero, s starts, x blanks/stops. Start with a conductive reference sample. Charging or a grounded bypass defeats this measurement.',button:'Restart current preview',action:()=>{restartScan();return 'Synthetic current scan restarted. Open the detector guide for exact PCB connectors and commissioning checks.';}});
  }else if(state.detectorMode==='bse'){
    Object.assign(guideSteps[6],{body:'Synchronize the programmable scan with detector settling and ADC acquisition. Begin with 500 µs dwell; measure the real amplifier before increasing speed.',observe:'The settling warning appears when dwell is shorter than the estimated 1% step response. Short dwell creates visible lag along the scan.',action:()=>{state.resolution=128;state.dwell=500;state.scanMode='raster';buildPath();refresh(true);syncControls();return '128 × 128 raster at 500 µs dwell applied. Measure the real TIA and scan-driver settling before faster acquisition.';}});
    Object.assign(guideSteps[7],{title:'Acquire a BSE image',short:'Check dark level, gain and clipping',body:'Place the silicon detector beside the full scan envelope and aim its sensitive face at the specimen. Inspect the metric mount view and allowances, then check TIA gain, conditioning and ESP32 ADC dwell. Centred runs remain available for comparison.',observe:'Compare signal and dark current with the beam blanked and enabled. Avoid clipping and allow amplifier settling. Material contrast is synthetic; BSE yield and energy spectrum are assumptions.',hardware:'Bench-check the quiet diode bias and compensated amplifier first. Confirm A/K contacts and vacuum mounting with Hamamatsu. Verify package, bracket and cable clearance with the full scan field; secure the mount and strain-relieve its leads. Measure dark baseline, calibrated injected current, output headroom and settling. Start with a conductive specimen. For shutdown blank the beam, reduce gun HV/heating and follow verified discharge and pump procedures.',action:()=>{restartScan();return status.beamOn?'BSE acquisition restarted. Check signal headroom and settling before increasing scan speed.':'Enable the beam after high vacuum and heating. The diode dark level remains visible with the beam blanked.';}});
  }else{Object.assign(guideSteps[6],legacyRasterStep);Object.assign(guideSteps[7],legacyDetectorStep);}

  $('#guide-steps').replaceChildren();guideSteps.forEach((step,i)=>{const btn=document.createElement('button');btn.className=`guide-step${i===guideIndex?' active':''}`;btn.innerHTML=`<span class="step-circle">${String(i+1).padStart(2,'0')}</span><span><strong></strong><small></small></span><span class="step-check">${guideCompleted.has(i)?'✓':''}</span>`;btn.querySelector('strong').textContent=step.title;btn.querySelector('small').textContent=step.short;btn.addEventListener('click',()=>{guideIndex=i;renderGuide();});$('#guide-steps').append(btn);});
  const step=guideSteps[guideIndex];$('#guide-number').textContent=`STEP ${String(guideIndex+1).padStart(2,'0')} / 08`;$('#guide-title').textContent=step.title;$('#guide-body').textContent=step.body;$('#guide-observation').textContent=step.observe;$('#guide-hardware').textContent=step.hardware;$('#guide-action').textContent=step.button;$('#guide-feedback').textContent='';$('#guide-next').disabled=guideIndex===guideSteps.length-1;
}
$('#guide-action').addEventListener('click',()=>{const message=guideSteps[guideIndex].action();if(!message.startsWith('Waiting'))guideCompleted.add(guideIndex);renderGuide();$('#guide-feedback').textContent=message;});
$('#guide-next').addEventListener('click',()=>{guideIndex=Math.min(guideIndex+1,guideSteps.length-1);renderGuide();});
$('#guide-start').addEventListener('click',()=>{guideIndex=0;coldStart();renderGuide();$('#guide-feedback').textContent='Cold state loaded. Follow each step to form a beam and acquire an image.';});
$('#guide-electrical').addEventListener('click',()=>{showPage('electrical');electricalView.select(['controller','vacuum','vacuum','heater','hvV','lens','scanX','detector'][guideIndex]);electricalView.focus(guideIndex===1||guideIndex===2||guideIndex===7?'detector':guideIndex===5||guideIndex===6?'scan':'gun');});

electricalView=mountElectricalView($('#page-electrical'),{
  showEquation:(id,anchor)=>{const eq=EQUATIONS.find(item=>item.id===id);if(eq)showEquation(eq,anchor,true);},
  openPart:id=>workspace.openPart(id),
  openColumn:id=>{showPage('lab');selectComponent(id,true);}
});
buildPath();syncControls();renderGuide();renderEditor();refresh(true);showControl('source');
function getSnapshot(){
  saveEditor();
  return {specimenId:selectedSpecimenId,parameters:Object.fromEntries(Object.keys(DEFAULTS).map(key=>[key,state[key]])),operatingState:{roughing:status.roughing,turbo:status.turbo,requestedBeam},trajectoryCode:appliedTrajectoryCode,trajectoryDraft:trajectoryCode,firmwareCode,firmwareAppliedCode};
}
async function applySnapshot(snapshot){
  resetPreviewPlayback();
  const parameters={...DEFAULTS,...LEGACY_SCAN_HARDWARE,detectorMode:'et',detectorOffset:0,detectorTilt:0,...snapshot.parameters};
  const savedDac=parseFirmwareConfig(snapshot.firmwareAppliedCode||snapshot.firmwareCode||'');
  if(!savedDac.errors.length)for(const key of Object.keys(SCAN_HARDWARE_DEFAULTS))if(!(key in (snapshot.parameters||{})))parameters[key]=savedDac.config[key];
  const raisedVoltage=parameters.detectorMode!=='et'&&parameters.voltage<3;if(raisedVoltage)parameters.voltage=3;
  if(!Number.isInteger(parameters.resolution)||parameters.resolution<2||parameters.resolution>512)throw new Error('Saved resolution must be between 2 and 512.');
  const nextTrajectory=snapshot.trajectoryCode??DEFAULT_PROGRAM;
  let nextPath=null;
  if(parameters.scanMode==='custom'){const result=await compileProgram(nextTrajectory,{resolution:parameters.resolution,timeout:1200});nextPath=result.points;}
  pauseSimulation(true);
  for(const key of Object.keys(state))delete state[key];
  Object.assign(state,parameters);customPath=nextPath;appliedTrajectoryCode=nextTrajectory;trajectoryCode=snapshot.trajectoryDraft??nextTrajectory;firmwareCode=snapshot.firmwareCode||'';firmwareAppliedCode=snapshot.firmwareAppliedCode??snapshot.firmwareCode??'';firmwareDirty=!!snapshot.firmwareCode;
  selectedSpecimenId=getSpecimen(snapshot.specimenId).id;
  // Restore supported pin/DAC constants without overriding saved model settings.
  if(firmwareAppliedCode){const parsed=parseFirmwareConfig(firmwareAppliedCode);if(!parsed.errors.length)for(const [key,value]of Object.entries(parsed.config))if(!(key in DEFAULTS))state[key]=value;}
  const operating=snapshot.operatingState||{};status.roughing=operating.roughing??true;status.turbo=operating.turbo??true;requestedBeam=operating.requestedBeam??true;
  status.scanPoint={x:0,y:0,blank:false};simulationTime=0;frameCount=0;sampleRemainder=0;guideCompleted.clear();
  $('#scan-mode option[value="custom"]').disabled=!nextPath;
  buildPath();renderEditor();syncControls();refresh(true);renderGuide();column.reset();pauseSimulation(false);
  const viewRequest=new URLSearchParams(location.search);if(viewRequest.get('view')==='program')showPage('program');if(viewRequest.get('view')==='electrical'){showPage('electrical');electricalView.focus('detector');electricalView.select('detector');}
  if(parameters.scanMode==='custom'&&trajectoryCode!==appliedTrajectoryCode)$('#program-status').textContent='Saved applied trajectory restored · editor contains an unapplied draft';
  $('#global-status').textContent=`${snapshot.name||'BOM setup'} loaded. Parameters and equations now reflect this run.${raisedVoltage?' Acceleration raised to your 3 kV minimum.':''}`;
}
$('#start-bse-preset').addEventListener('click',()=>{imagingPreset();$('#startup-dialog').close();showControl('detector');if(new URLSearchParams(location.search).get('view')==='program')showPage('program');if(new URLSearchParams(location.search).get('view')==='electrical'){showPage('electrical');electricalView.focus('detector');electricalView.select('detector');}});
const workspace=mountWorkspace({getSnapshot,applySnapshot,showPage,pause:pauseSimulation,toast});
async function startButterflyDetail(){
  const preset=createButterflyDetailPreset();
  const trajectory=`// Detailed butterfly raster; one sample per image pixel.\nconst row = Math.floor(i / n);\nconst col = i % n;\nreturn { x: 2 * col / (n - 1) - 1, y: 2 * row / (n - 1) - 1, blank: false };`;
  const firmware=generateCurrentFirmware({...preset.parameters,settle:preset.parameters.settleTime,retrace:preset.parameters.flyback});
  try{
    await workspace.usePreset({...preset,trajectoryCode:trajectory,firmwareCode:firmware,firmwareAppliedCode:firmware});
    previewRate=500;singleFramePreview=true;$('#preview-speed').value='500';restartScan();refresh(false);
    showControl('optics');$('#specimen-canvas').scrollIntoView({block:'center',behavior:'smooth'});
    toast('Detailed butterfly scan: 512 × 512 · 140 µm. Hardware estimate 1 h 49 min; browser preview runs at 500×.');
  }catch(error){toast(`Could not load detailed preset: ${error.message}`);}
}
$('#butterfly-detail').addEventListener('click',startButterflyDetail);
$('#start-butterfly-detail').addEventListener('click',startButterflyDetail);
$('#preview-speed').addEventListener('change',event=>{const rate=Number(event.target.value);previewRate=[1,60,500].includes(rate)?rate:1;refresh(false);});
$('#download-scan').addEventListener('click',()=>{if(frameCount<1)return;const a=document.createElement('a');a.href=scanBuffer.toDataURL('image/png');a.download=`${selectedSpecimenId}-${state.resolution}x${state.resolution}-synthetic.png`;a.click();});
$('#edit-component-bom').addEventListener('click',()=>workspace.openPart(selectedComponent));
for(const selector of ['#auto-focus','#cold-start','#imaging-preset','#vent','#beam-toggle','#guide-action','#guide-start','#pattern-pills button','#reset-program'])$$(selector).forEach(el=>el.addEventListener('click',()=>workspace.markDirty()));
for(const selector of ['#scan-mode','#roughing-toggle','#turbo-toggle','#code-editor'])$(selector).addEventListener('input',()=>workspace.markDirty());
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
