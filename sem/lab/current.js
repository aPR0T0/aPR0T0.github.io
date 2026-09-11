/** LMC662 specimen-current prototype. Equations are ideal estimates, not measured performance. */
export const CURRENT_DEFAULTS = Object.freeze({currentRf:100,currentCf:10,currentADCRange:.256,currentADCRate:128,currentSamples:1,currentBseYield:.2,currentNoiseFloor:5});
export const ADC_RANGES = [.256,.512,1.024,2.048,4.096,6.144];
export const ADC_RATES = [8,16,32,64,128,250,475,860];
export const CURRENT_PARAMETER_SCHEMA = Object.freeze({
  currentRf:{type:'number',unit:'MΩ',min:1,max:1000,label:'LMC662 feedback resistance'},
  currentCf:{type:'number',unit:'pF',min:1,max:1000,label:'LMC662 feedback capacitance'},
  currentADCRange:{type:'number',unit:'V',min:.256,max:6.144,label:'ADS1115 differential full scale'},
  currentADCRate:{type:'number',unit:'SPS',min:8,max:860,label:'ADS1115 data rate'},
  currentSamples:{type:'number',unit:'samples',min:1,max:64,label:'Fresh ADC conversions per pixel'},
  currentBseYield:{type:'number',unit:'',min:0,max:1,label:'Assumed escaped BSE yield'},
  currentNoiseFloor:{type:'number',unit:'pA RMS',min:0,max:10000,label:'Assumed additional RMS noise'},
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const nearest=(v,options)=>options.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a);
export function normalizeCurrent(input={}){
  const p={...CURRENT_DEFAULTS,...input};
  for(const [k,s] of Object.entries(CURRENT_PARAMETER_SCHEMA))p[k]=clamp(Number.isFinite(Number(p[k]))?Number(p[k]):CURRENT_DEFAULTS[k],s.min,s.max);
  p.currentADCRange=nearest(p.currentADCRange,ADC_RANGES);p.currentADCRate=nearest(p.currentADCRate,ADC_RATES);p.currentSamples=Math.round(p.currentSamples);
  return p;
}
export function calculateCurrent(input={}, {beamCurrentnA=0,beamOn=true}={}){
  const p=normalizeCurrent(input),rf=p.currentRf*1e6,cf=p.currentCf*1e-12;
  const incident=beamOn?Math.max(0,Number(beamCurrentnA)||0):0;
  const secondaryYield=Math.max(0,Number(p.secondaryYield)||0);
  const netCurrentnA=incident*(1-secondaryYield-p.currentBseYield);
  const idealOutputV=netCurrentnA*1e-9*rf,outputV=clamp(idealOutputV,-4,4);
  const attenuation=10/40.2,zeroVoltageV=(1+attenuation)*1.32,zeroDifferentialV=zeroVoltageV-1.65;
  const adcVoltageV=zeroVoltageV-attenuation*outputV,adcDifferentialV=adcVoltageV-1.65;
  const lsbV=p.currentADCRange/32768,adcCode=clamp(Math.round(adcDifferentialV/lsbV),-32768,32767);
  const inputLSBpA=lsbV/(attenuation*rf)*1e12;
  const tau=rf*cf,bandwidthHz=1/(2*Math.PI*tau),equivalentNoiseBandwidthHz=1/(4*tau);
  const thermalNoisepA=Math.sqrt(4*1.380649e-23*300/rf*equivalentNoiseBandwidthHz)*1e12;
  // A deliberately labelled independent-Poisson benchmark, not a specimen yield distribution.
  const shotNoisepA=Math.sqrt(2*1.602176634e-19*incident*1e-9*(1+secondaryYield+p.currentBseYield)*equivalentNoiseBandwidthHz)*1e12;
  const rmsNoisepA=Math.hypot(thermalNoisepA,shotNoisepA,inputLSBpA/Math.sqrt(12),p.currentNoiseFloor);
  const settlingTimeUs=-Math.log(.01)*tau*1e6,conversionTimeUs=1e6/p.currentADCRate;
  const adcWindowUs=p.currentSamples*conversionTimeUs/.9;
  const acquisitionTimeUs=Math.max(Math.max(0,Number(p.dwell)||0),adcWindowUs);
  const settleUs=Math.max(0,Number(p.settleTime)||0),pixelTimeUs=settleUs+acquisitionTimeUs;
  const n=Math.max(1,Number(p.resolution)||32),retraces=p.scanMode==='raster'?n:1;
  const frameTimeS=(n*n*pixelTimeUs+retraces*Math.max(0,Number(p.flyback)||0))*1e-6;
  const clipped=Math.abs(idealOutputV)>4||adcDifferentialV < -p.currentADCRange||adcDifferentialV > p.currentADCRange-lsbV;
  const notes=['Specimen current measures incident minus escaped charge. SE and BSE yields are assumptions, not a prediction for butterfly wings.',
    'The specimen must conduct to the isolated stage. Any separate ground path bypasses this measurement. This is not an SE detector.',
    'Noise includes an assumed extra floor and an illustrative independent-Poisson benchmark; leakage, charging, drift and stability require measurement.'];
  if(clipped)notes.push('Readout clipping: reduce beam current or feedback resistance, or select a wider ADC range.');
  if(settleUs<settlingTimeUs)notes.push('Settle wait is shorter than the ideal 1% response time; adjacent pixels can mix.');
  if((Number(p.dwell)||0)<adcWindowUs)notes.push('ADC conversion time sets the acquisition window. The displayed frame estimate includes its −10% clock allowance.');
  return {params:p,netCurrentnA,incidentCurrentnA:incident,idealOutputV,outputV,adcVoltageV,adcDifferentialV,adcCode,zeroVoltageV,zeroDifferentialV,attenuation,
    inputLSBpA,lsbV,rmsNoisepA,thermalNoisepA,shotNoisepA,bandwidthHz,equivalentNoiseBandwidthHz,timeConstantUs:tau*1e6,settlingTimeUs,
    conversionTimeUs,acquisitionTimeUs,pixelTimeUs,frameTimeS,clipped,notes,snr:rmsNoisepA>0?Math.abs(netCurrentnA)*1000/rmsNoisepA:0};
}
const S={
  charge:{label:'OpenStax · Kirchhoff’s current law (charge conservation)',url:'https://openstax.org/books/university-physics-volume-2/pages/10-3-kirchhoffs-rules'},
  lmc:{label:'Texas Instruments · LMC662 data sheet, amplifier and guarding guidance',url:'https://www.ti.com/lit/ds/symlink/lmc662.pdf'},
  adc:{label:'Texas Instruments · ADS1115 data sheet, differential PGA, data rates and single-shot mode',url:'https://www.ti.com/lit/ds/symlink/ads1115.pdf'},
  noise:{label:'Texas Instruments · AN-1803, Design Considerations for a Transimpedance Amplifier',url:'https://www.ti.com/lit/an/snoa515a/snoa515a.pdf'},
};
const f=v=>Number.isFinite(v)?Number(v.toPrecision(4)).toString():'—';
const ctx=(p,d)=>d?.electrical?.current||d?.current||calculateCurrent(p,{beamCurrentnA:d?.beamCurrent||0});
export const CURRENT_EQUATIONS=[
  {id:'currentBalance',title:'Net specimen current',formula:'Iabs = Ib(1 − δSE − ηBSE)',substitution:(p,d)=>`Ib=${f(ctx(p,d).incidentCurrentnA)} nA; δ=${f(p.secondaryYield)}; η=${f(p.currentBseYield)}`,result:(p,d)=>`${f(ctx(p,d).netCurrentnA)} nA net deposited-electron equivalent`,derivation:'Count arriving electrons and subtract escaped secondary and backscattered electrons. Multiply net arrival rate by the positive elementary charge. Iabs is positive for net electron deposition; conventional current entering the amplifier is −Iabs. Other escape or leakage paths invalidate this two-yield balance.',assumptions:'Conductive specimen connected only through the current input. Yield values are adjustable assumptions and vary with material, energy, angle and charging. A 3–5 kV beam does not guarantee 100 nm topographic contrast.',sources:[S.charge]},
  {id:'currentTIA',title:'LMC662 current-to-voltage response',formula:'VTIA = Iabs Rf; τ = Rf Cf; f−3dB = 1/(2πτ)',substitution:(p,d)=>`Rf=${f(p.currentRf)} MΩ; Cf=${f(p.currentCf)} pF; τ=${f(ctx(p,d).timeConstantUs)} µs`,result:(p,d)=>`${f(ctx(p,d).outputV)} V; ${f(ctx(p,d).bandwidthHz)} Hz`,derivation:'At the virtual-ground summing node, charge conservation sends the opposite conventional specimen current through the feedback impedance Zf=Rf/(1+sRfCf). Thus Vout=−Iconventional Zf=Iabs Zf. Its single pole has time constant RfCf. Step error exp(−t/τ) reaches 1% at t=−τ ln(0.01).',assumptions:'Ideal closed-loop pole; actual stability also depends on input/cable capacitance and op-amp gain bandwidth. A conservative ±4 V output bound is used on ±5 V supplies. Changing Rf/Cf means fitting different PCB components.',sources:[S.lmc,S.noise]},
  {id:'currentADC',title:'Conditioning, ADC and calibration',formula:'A0 = 1.32(1+a) − aVTIA; ΔV = A0 − 1.65; a = 10/40.2',substitution:(p,d)=>`A0=${f(ctx(p,d).adcVoltageV)} V; ΔV=${f(ctx(p,d).adcDifferentialV)} V; PGA ±${p.currentADCRange} V`,result:(p,d)=>`${ctx(p,d).adcCode} raw code; ${f(ctx(p,d).inputLSBpA)} pA/code`,derivation:'KCL at the second amplifier gives (VTIA−1.32)/40.2k + (A0−1.32)/10k = 0. Solve for A0. Subtract A1=1.65 V. ADS1115 LSB=selected positive full-scale/32768. After measuring a blanked-beam zero code, Iabs=−(code−zero)LSB/(aRf). The nominal differential zero is −1.641791 mV and must not be assumed exactly zero.',assumptions:'Both ADC pins remain within the 3.3 V supply. Reference ratios and gain require calibration. pA/code is quantization scale, not noise floor or accuracy. ESP32 reads I²C, not its internal ADC.',sources:[S.lmc,S.adc]},
  {id:'currentNoise',title:'Illustrative input-referred noise',formula:'B = 1/(4RfCf); σI² = 4kTB/Rf + 2eIb(1+δ+η)B + qI²/12 + σextra²',substitution:(p,d)=>`T=300 K; B=${f(ctx(p,d).equivalentNoiseBandwidthHz)} Hz; assumed extra=${f(p.currentNoiseFloor)} pA RMS`,result:(p,d)=>`${f(ctx(p,d).rmsNoisepA)} pA RMS estimate`,derivation:'Integrate white current-noise density through the ideal feedback pole, whose one-sided equivalent noise bandwidth is 1/(4RfCf). Add independent variances for feedback resistor thermal noise, a deliberately simplified independent arrival/escape Poisson benchmark, quantization, and a user-supplied extra noise floor.',assumptions:'No measured noise spectrum. Correlation in electron yields, op-amp voltage noise through input capacitance, ADC digital filtering, flicker noise and drift are not solved. Extra noise is an assumption. Averaging is not credited with a guaranteed square-root improvement. LMC662 typical bias current is not detection sensitivity.',sources:[S.noise,S.lmc,S.adc]},
  {id:'currentTiming',title:'Fresh conversion at each scan point',formula:'tpixel = tsettle + max(tdwell, Nsamples/(0.9·SPS)); Tframe ≈ N²tpixel + Tretrace',substitution:(p,d)=>`${p.currentADCRate} SPS; ${p.currentSamples} samples; settle=${f(p.settleTime)} µs; acquire=${f(ctx(p,d).acquisitionTimeUs)} µs`,result:(p,d)=>`${f(ctx(p,d).frameTimeS)} s/frame before transport overhead`,derivation:'Move the beam, unblank, wait for the analog stage, then start fresh single-shot ADC conversions and poll completion. Sum conversion times with a 10% slow-clock allowance. Preserve a larger requested acquisition window. Add blanked retraces. Serial output and software overhead can extend this estimate.',assumptions:'Firmware waits for actual ADC readiness. A too-short requested dwell does not increase the ADC data rate. Browser animation is a procedural preview; it does not prove hardware settling.',sources:[S.adc,S.lmc]},
];
