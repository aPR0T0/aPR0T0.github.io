/** Nominal scan-DAC quantization. This does not model analog noise or accuracy. */
export const SCAN_HARDWARE_DEFAULTS = Object.freeze({dacModel:80502,dacBits:16,dacReference:2.5,amplifierGain:100});
export const LEGACY_SCAN_HARDWARE = Object.freeze({dacModel:4922,dacBits:12,dacReference:3.3,amplifierGain:100});
export function normalizeScanHardware(values={}) {
  const legacy=values.dacModel===4922||(values.dacModel===undefined&&values.dacBits===12);
  const defaults=legacy?LEGACY_SCAN_HARDWARE:SCAN_HARDWARE_DEFAULTS;
  return {...defaults,dacReference:legacy&&Number.isFinite(values.dacReference)&&values.dacReference>0?values.dacReference:defaults.dacReference,
    amplifierGain:Number.isFinite(values.amplifierGain)&&values.amplifierGain>0?values.amplifierGain:100};
}
export function quantizeScanAxis(normalized,parameters={}) {
  return createScanQuantizer(parameters)(normalized);
}
export function createScanQuantizer(parameters={}) {
  const p=normalizeScanHardware(parameters),levels=2**p.dacBits;
  const amplitude=Math.max(0,Number(parameters.scanAmplitude)||0),centre=p.dacReference/2;
  return normalized=>{
  const input=Number.isFinite(normalized)?Math.max(-1,Math.min(1,normalized)):0;
  const requested=centre+input*amplitude/p.amplifierGain;
  const code=Math.max(0,Math.min(levels-1,Math.round(requested/p.dacReference*levels)));
  const voltage=code*p.dacReference/levels,plateVoltage=(voltage-centre)*p.amplifierGain;
  return {code,voltage,plateVoltage,normalized:amplitude>0?plateVoltage/amplitude:0,
    clipped:requested<0||requested>(levels-1)*p.dacReference/levels};
  };
}
export function calculateScanHardware(parameters={},deflectionPerVoltMm=0) {
  const p=normalizeScanHardware(parameters),levels=2**p.dacBits;
  const resolution=Math.max(2,Math.min(512,Math.round(parameters.resolution)||32));
  const codes=new Set();
  const quantize=createScanQuantizer(parameters);
  for(let i=0;i<resolution;i++)codes.add(quantize(Math.fround(2*i/(resolution-1)-1)).code);
  const dacStepV=p.dacReference/levels,plateStepV=dacStepV*p.amplifierGain;
  const first=quantizeScanAxis(-1,parameters),last=quantizeScanAxis(1,parameters);
  return {...p,name:p.dacModel===80502?'DAC80502':'MCP4922',levels,centreV:p.dacReference/2,dacStepV,plateStepV,
    positionStepNm:Math.abs(deflectionPerVoltMm)*plateStepV*1e6,
    rasterPositions:codes.size,repeatedRasterPixels:resolution-codes.size,
    maxAmplitude:p.dacReference*p.amplifierGain*(.5-1/levels),clipped:first.clipped||last.clipped};
}
const source={label:'TI DAC80502 · §8.3.1 transfer function; §8.3.2 reference; §8.6 registers',url:'https://www.ti.com/lit/ds/symlink/dac80502.pdf#page=20'};
const legacySource={label:'Microchip MCP4922 · Equation 4-1',url:'https://ww1.microchip.com/downloads/en/DeviceDoc/22250A.pdf'};
const fmt=(v,n=3)=>Number.isFinite(v)?Number(v.toPrecision(n)).toString():'—';
export const SCAN_HARDWARE_EQUATIONS=[
  {id:'scanDacStep',title:'DAC voltage increment',formula:'ΔVDAC = VFS / 2ᴺ; ΔVplates = A × ΔVDAC',
    substitution:(p,d)=>`${d.scanHardware.name}: ${fmt(d.scanHardware.dacReference)} V / 2^${d.scanHardware.dacBits}; amplifier gain ${fmt(d.scanHardware.amplifierGain)}`,
    result:(p,d)=>`${fmt(d.scanHardware.dacStepV*1e6,5)} µV/code → ${fmt(d.scanHardware.plateStepV*1000,5)} mV/code at plates`,
    derivation:'The DAC divides its selected output range into 2^N code intervals. The largest code is 2^N−1, so its output is one interval below full scale. Subtracting the buffered midpoint makes a bipolar command; the external amplifier multiplies each voltage increment by A. DAC80502 at 3.3 V uses a divided 2.5 V internal reference and ×2 output buffers (GAIN=0x0103), giving a nominal 2.5 V full-scale range.',
    assumptions:'Nominal quantization only. Offset, gain error, nonlinearity, noise, reference drift, amplifier error and measured settling are not modeled. MCP4922 is retained for old setups.',sources:[source,legacySource]},
  {id:'scanPositionStep',title:'Nominal beam-position increment',formula:'Δx = [e L (D + L/2) / (g p v)] × A VFS / 2ᴺ',
    substitution:(p,d)=>`At ${fmt(p.voltage)} kV, ${fmt(p.plateLength)} mm plates, ${fmt(p.workingDistance)} mm drift, ${fmt(p.plateGap)} mm gap; ${d.scanHardware.dacBits}-bit DAC`,
    result:(p,d)=>`${fmt(d.scanHardware.positionStepNm,4)} nm / DAC code`,
    derivation:'A differential plate voltage V creates transverse force eV/g. During transit L/v, transverse momentum grows by eVL/(gv). Integrating inside the plates and then drifting distance D gives x/V = eL(D+L/2)/(gpv), using relativistic longitudinal momentum p and speed v. Multiplying this sensitivity by one amplified DAC increment gives the nominal position step.',
    assumptions:'Ideal paraxial parallel plates, no fringing or cross coupling. This is a commanded position increment, not measured positioning accuracy, beam spot size, or image resolution. The source and lens blur remain separate.',sources:[source,{label:'OpenStax · electric force F = qE',url:'https://openstax.org/books/university-physics-volume-2/pages/5-4-electric-field'}]},
];
