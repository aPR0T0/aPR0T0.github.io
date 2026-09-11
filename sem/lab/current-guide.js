import {appURL} from './hosting.js';
const $ = selector => document.querySelector(selector);
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
const source = {
  kcl:'<a href="https://openstax.org/books/university-physics-volume-2/pages/10-3-kirchhoffs-rules" target="_blank" rel="noopener">OpenStax, University Physics 2 §10.3: charge conservation and Kirchhoff’s junction rule</a>',
  rc:'<a href="https://openstax.org/books/university-physics-volume-2/pages/10-5-rc-circuits" target="_blank" rel="noopener">OpenStax, University Physics 2 §10.5: exponential RC response</a>',
  amp:'<a href="https://www.ti.com/lit/ds/symlink/lmc662.pdf" target="_blank" rel="noopener">TI LMC662 datasheet: current-to-voltage application and feedback</a>',
  adc:'<a href="https://www.ti.com/lit/ds/symlink/ads1115.pdf" target="_blank" rel="noopener">TI ADS1115 datasheet: full-scale range, conversion codes and data rates</a>',
};
const formulas = {
  balance:{title:'Net absorbed electron current',summary:'At steady state, incident electrons are divided between those remaining in the specimen and those emitted. The amplifier carries the compensating return current.',body:`<code>Iabs = Ib − ISE − IBSE\nISE = δ Ib, IBSE = η Ib\nIabs = Ib (1 − δ − η)</code><p>This uses positive electron-current magnitudes for Ib, ISE and IBSE. Iabs can be negative when total emission exceeds incidence. Charge accumulation, transmission through a thin sample and additional leakage paths are omitted. Conventional current in the wire has the opposite sign to electron flow.</p><p>This expression is a charge-balance derivation for our model, using ${source.kcl}. It is not a specimen-yield prediction.</p>`},
  tia:{title:'Current-to-voltage conversion',summary:'Feedback holds the summing input near zero. The feedback resistor must carry the specimen’s return current, creating a proportional output voltage.',body:`<code>Vtia / Rf = Iabs\nVtia = Iabs Rf\n(1 pA)(100 MΩ) = 100 µV</code><p>For positive absorbed electron current, conventional current leaves the summing node toward the specimen. This gives a positive TIA output. Finite input offset, bias current, leakage and output swing add errors.</p><p>Derivation by Kirchhoff’s current law for the feedback circuit; see ${source.amp}.</p>`},
  conditioner:{title:'Bipolar TIA to ADC differential voltage',summary:'The second amplifier combines an inverting gain with a small reference voltage. The ADC compares that output with a separate 1.65 V reference.',body:`<code>g = 10 kΩ / 40.2 kΩ = 0.248756\nVref = 3.3 × 10 / (15 + 10) = 1.32 V\nA0 = (1 + g) Vref − g Vtia\nA0 = 1.648358 − 0.248756 Vtia\nA0 − A1 = −1.642 mV − 0.248756 Vtia</code><p>The reference and resistor ratios are this design’s selected values. The final relation follows from the current sum at U1B’s inverting input. Actual divider ratios, amplifier offsets and ADC errors require calibration.</p><p>Principle: ${source.kcl}. Input limits: ${source.adc}.</p>`},
  resolution:{title:'Nominal current per ADC code',summary:'Divide the ADC voltage step by the attenuator gain and TIA resistance. This gives quantization only; it does not include electronic noise, drift or effective resolution.',body:`<code>LSB = FSR / 32768\nΔIcode = LSB / (g Rf)\nFSR = 0.256 V → LSB = 7.8125 µV\nRf = 100 MΩ → ΔIcode = 0.3141 pA</code><p>The ADC uses signed differential codes. A larger PGA range increases current per code. The selected PGA range does not permit either input pin to exceed the ADC’s supply limits.</p><p>Code and range definitions: ${source.adc}.</p>`},
  timing:{title:'RC settling and conversion time',summary:'A one-pole step error falls exponentially. Waiting 4.605 time constants reduces that error to 1%; the ADC then needs its own conversion interval.',body:`<code>τ = Rf Cf\nError / initial error = exp(−t / τ)\nt1% = −ln(0.01) Rf Cf = 4.605 Rf Cf\n100 MΩ × 10 pF → τ = 1 ms\nt1% = 4.605 ms; 1 / 128 SPS = 7.8125 ms</code><p>This RC response is an approximation. Op-amp bandwidth, detector lead capacitance, scan-driver response and ADC filtering add behavior. The model must not equate this time constant with validated circuit stability.</p><p>${source.rc}; conversion rate: ${source.adc}.</p>`},
  calibration:{title:'Signed ADC code and real calibration',summary:'The nominal ADC code includes the reference offset even at zero input current. Subtract a measured blanked baseline and use a measured current-to-code gain.',body:`<code>code ≈ round[(A0 − A1) / LSB]\ncalibrated current = (code − measured_zero) / measured_gain</code><p>The code can saturate at the PGA limit. The displayed current-per-code value does not account for resistor tolerance, ADC gain error, amplifier offset or environmental leakage. Measure at least a zero and a known current of the intended polarity; check a second current to test linearity.</p><p>Signed conversion definition: ${source.adc}. Calibration procedure is an engineering requirement of this prototype.</p>`},
};
function formatV(v){return Math.abs(v)<.1?`${(v*1e3).toFixed(3)} mV`:`${v.toFixed(4)} V`;}
function calculate(){
  const i=Number($('#calc-current').value)*1e-12,r=Number($('#calc-rf').value)*1e6,fsr=Number($('#calc-range').value),g=10/40.2;
  const tia=i*r,a0=(1+g)*1.32-g*tia,diff=a0-1.65,lsb=fsr/32768,clipped=Math.abs(diff)>=fsr||Math.abs(tia)>4||a0<0||a0>3.3;
  $('#calc-current-label').textContent=`${Number($('#calc-current').value)} pA`;
  $('#calc-tia').textContent=formatV(tia);$('#calc-diff').textContent=formatV(diff);
  $('#calc-resolution').textContent=`${(lsb/g/r*1e12).toFixed(3)} pA / code`;
  $('#calc-timing').textContent=`${(-Math.log(.01)*r*10e-12*1e3).toFixed(2)} ms`;
  $('#calc-code').textContent=`${clamp(Math.round(diff/lsb),-32768,32767).toLocaleString()}${clipped?' · clipped':''}`;
  $('#calc-status').classList.toggle('overrange',clipped);
  $('#calc-status').textContent=clipped?'The demanded signal exceeds a modeled amplifier or ADC range. Lower the current gain or select a suitable wider PGA range.':'Within the selected ideal range. The nominal zero includes a −1.642 mV divider offset; calibrate the actual board before interpreting codes as current.';
}
for(const id of ['calc-current','calc-rf','calc-range'])$('#'+id).addEventListener('input',calculate);
calculate();
const dialog=$('#current-formula-dialog'),tooltip=$('#current-formula-tooltip');
let tooltipTimer;
function hideTooltip(){clearTimeout(tooltipTimer);tooltip.hidden=true;}
function scheduleHide(){clearTimeout(tooltipTimer);tooltipTimer=setTimeout(hideTooltip,180);}
tooltip.addEventListener('mouseenter',()=>clearTimeout(tooltipTimer));
tooltip.addEventListener('mouseleave',scheduleHide);
for(const button of document.querySelectorAll('[data-formula]')){
  const f=formulas[button.dataset.formula];
  button.setAttribute('aria-haspopup','dialog');
  button.addEventListener('click',()=>{hideTooltip();$('#current-formula-title').textContent=f.title;$('#current-formula-detail').innerHTML=f.body;dialog.showModal();});
  button.addEventListener('mouseenter',()=>{if(window.innerWidth<650)return;clearTimeout(tooltipTimer);tooltip.innerHTML=`<strong>${f.title}</strong>${f.body}`;tooltip.hidden=false;const rect=button.getBoundingClientRect();const w=tooltip.offsetWidth,h=tooltip.offsetHeight;tooltip.style.left=`${clamp(rect.left,12,window.innerWidth-w-12)}px`;tooltip.style.top=`${rect.top-h-10>12?rect.top-h-10:Math.min(rect.bottom+10,window.innerHeight-h-12)}px`;});
  button.addEventListener('mouseleave',scheduleHide);button.addEventListener('blur',hideTooltip);
}
$('.current-dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
window.addEventListener('scroll',hideTooltip,{passive:true});
const circuit=$('#current-circuit'),views={all:[0,0,1080,490],specimen:[0,22,350,390],tia:[292,70,345,330],adc:[618,157,462,268]};let view=[...views.all],drag=null;
function updateView(){circuit.setAttribute('viewBox',view.join(' '));$('#current-zoom-label').textContent=`${Math.round(1080/view[2]*100)}%`;}
function zoom(f){const w=clamp(view[2]*f,250,1300),ratio=w/view[2],h=view[3]*ratio;view=[view[0]+(view[2]-w)/2,view[1]+(view[3]-h)/2,w,h];updateView();}
for(const button of document.querySelectorAll('[data-circuit-focus]'))button.addEventListener('click',()=>{view=[...views[button.dataset.circuitFocus]];updateView();document.querySelectorAll('[data-circuit-focus]').forEach(b=>b.classList.toggle('active',b===button));});
$('#current-zoom-in').addEventListener('click',()=>zoom(.8));$('#current-zoom-out').addEventListener('click',()=>zoom(1.25));
circuit.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.1:.9);},{passive:false});
circuit.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,view:[...view]};circuit.setPointerCapture(e.pointerId);});
circuit.addEventListener('pointermove',e=>{if(!drag)return;const scale=Math.min(circuit.clientWidth/drag.view[2],circuit.clientHeight/drag.view[3]);view=[drag.view[0]-(e.clientX-drag.x)/scale,drag.view[1]-(e.clientY-drag.y)/scale,...drag.view.slice(2)];updateView();});
for(const event of ['pointerup','pointercancel'])circuit.addEventListener(event,()=>{drag=null;});
function safeFileURL(value){if(typeof value!=='string')return null;try{const base=new URL(appURL('detector-pcb/')),url=new URL(value.startsWith('/')?appURL(value):value,base);return url.origin===base.origin&&url.pathname.startsWith(base.pathname)?url.href:null;}catch{return null;}}
async function loadPackage(){
  try{
    const response=await fetch(appURL('detector-pcb/manifest.json'),{cache:'no-store'});if(!response.ok)throw new Error('Package index unavailable');
    const data=await response.json(),files=Array.isArray(data)?data:Array.isArray(data.files)?data.files:Array.isArray(data.artifacts)?data.artifacts:[];
    const list=$('#current-design-files');let count=0;
    for(const entry of files){const object=typeof entry==='string'?{path:entry}:entry;const url=safeFileURL(object.url||object.path||object.name||object.file);if(!url)continue;if(count===0)list.replaceChildren();const link=document.createElement('a');link.href=url;link.textContent=object.label||object.title||object.name||object.path||object.file;link.target='_blank';link.rel='noopener';const arrow=document.createElement('span');arrow.textContent='↗';link.append(arrow);list.append(link);count++;}
    const preview=safeFileURL(data.boardPreview||data.preview||data.previewUrl||files.find(f=>typeof f==='object'&&(f.kind==='preview'||f.type==='preview'))?.path);
    if(preview){const img=$('#current-board-preview');img.addEventListener('load',()=>{img.hidden=false;$('#current-board-placeholder').hidden=true;},{once:true});img.src=preview;}
    $('#current-design-status').textContent=count?`${count} design files · ${data.status||'Rev A prototype; verify the included checks and assembly notes.'}`:'Open the package index for the available Rev A artifacts.';
  }catch{$('#current-design-status').textContent='Open the local package index for the design files. Package metadata is not available in this server session.';}
}
loadPackage();
