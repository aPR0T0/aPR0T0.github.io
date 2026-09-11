import {calculate} from './physics.js';
import {SCAN_HARDWARE_DEFAULTS,LEGACY_SCAN_HARDWARE,quantizeScanAxis} from './scan-hardware.js';
const $=s=>document.querySelector(s),fmt=(v,n=2)=>v.toLocaleString('en-IN',{maximumFractionDigits:n});
function update(){
 const p={...($('#calc-dac').value==='4922'?LEGACY_SCAN_HARDWARE:SCAN_HARDWARE_DEFAULTS),voltage:Number($('#calc-voltage').value),scanAmplitude:Number($('#calc-amplitude').value),amplifierGain:Number($('#calc-gain').value),resolution:Number($('#calc-pixels').value)};
 if(!Number.isFinite(p.scanAmplitude)||p.scanAmplitude<=0||p.scanAmplitude>100||!Number.isFinite(p.amplifierGain)||p.amplifierGain<1||p.amplifierGain>1000){$('#sampling-status').textContent='Use a positive amplitude up to100 V and amplifier gain1–1000.';return;}
 const d=calculate(p),q=d.scanHardware;$('#voltage-value').value=`${fmt(p.voltage,1)} kV`;
 $('#calc-step').textContent=`${fmt(q.positionStepNm)} nm`;$('#calc-field').textContent=`${fmt(d.scanFieldWidth*1000)} µm`;$('#calc-pitch').textContent=`${fmt(d.scanFieldWidth*1e6/(p.resolution-1))} nm`;$('#calc-unique').textContent=`${q.rasterPositions} / ${p.resolution}`;
 const status=$('#sampling-status');status.className=q.clipped||q.repeatedRasterPixels?'warning':'';status.textContent=q.clipped?'DAC range exceeded: commands clip. Reduce amplitude or correct the physical driver gain.':q.repeatedRasterPixels?`${q.repeatedRasterPixels} raster samples per axis repeat a DAC code. Increasing pixels does not create more beam positions here.`:'Every raster command selects a distinct DAC code. Beam blur, specimen interaction, noise and drift still limit the image.';
 const c=$('#scan-samples'),ctx=c.getContext('2d'),w=c.width;ctx.clearRect(0,0,w,c.height);ctx.font='12px system-ui';ctx.fillStyle='#60796a';ctx.fillText('Requested',0,30);ctx.fillText('DAC positions',0,92);
 for(let i=0;i<p.resolution;i++){const x=2*i/(p.resolution-1)-1,a=110+(x+1)/2*(w-125),b=110+(Math.max(-1,Math.min(1,quantizeScanAxis(x,p).normalized))+1)/2*(w-125);ctx.fillStyle='#91a68e';ctx.fillRect(a,17,1,23);ctx.fillStyle='#297963';ctx.fillRect(b,76,1.5,24);}
}
for(const id of ['calc-dac','calc-voltage','calc-amplitude','calc-gain','calc-pixels'])$('#'+id).addEventListener('input',update);update();
const svg=$('#scan-circuit'),views={all:[0,0,1120,430],dac:[255,35,360,330],driver:[640,65,460,320]};let box=[...views.all];const render=()=>svg.setAttribute('viewBox',box.join(' '));
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{box=[...views[b.dataset.view]];render();for(const other of document.querySelectorAll('[data-view]'))other.classList.toggle('active',other===b);});
function zoom(f){const w=Math.max(230,Math.min(1600,box[2]*f)),h=w*box[3]/box[2];box=[box[0]+(box[2]-w)/2,box[1]+(box[3]-h)/2,w,h];render();}
$('#zoom-in').addEventListener('click',()=>zoom(.8));$('#zoom-out').addEventListener('click',()=>zoom(1.25));$('#zoom-reset').addEventListener('click',()=>{box=[...views.all];render();});
svg.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();zoom(e.deltaY>0?1.1:.9);},{passive:false});
