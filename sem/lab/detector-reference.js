/** Researched candidate, not a selected BOM part or a calibrated detector model. */
export const SOURCES = {
  pmt:{title:'Hamamatsu H10722 · July 2026 datasheet, pp. 1–4',url:'https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/etd/H10722_TPMO1063E.pdf'},
  product:{title:'Hamamatsu H10722-110 · product specifications',url:'https://www.hamamatsu.com/eu/en/product/optical-sensors/pmt/pmt-module/voltage-output-type/H10722-110.html'},
  et:{title:'JEOL · Everhart–Thornley detector',url:'https://www.jeol.com/words/semterms/20121024.070858.php'},
  crystal:{title:'Crytur · YAP:Ce material data',url:'https://www.crytur.com/materials/yap-ce/'},
  coating:{title:'Crytur · scintillation screens and conductive coatings',url:'https://www.crytur-usa.com/products/scintillation-screens/'},
  assembly:{title:'Crytur · electron microscopy detection units',url:'https://www.crytur-usa.com/products/detection-units-for-electron-microscopy/'},
  hv:{title:'Spellman · example separate scintillator / collector outputs',url:'https://www.spellmanhv.com/-/media/en/Products/EBM-TEG.pdf'},
  feedthrough:{title:'Kurt J. Lesker · feedthrough selection',url:'https://www.lesker.com/feedthroughs-viewports.cfm?section=feedthrough-selection-guides'},
  adc:{title:'Texas Instruments ADS8681 · input and supply ranges',url:'https://www.ti.com/product/ADS8681'},
  power:{title:'OpenStax · electric potential energy',url:'https://openstax.org/books/university-physics-volume-2/pages/7-2-electric-potential-and-potential-difference'},
  filter:{title:'Analog Devices MT-002 · Nyquist and sampling',url:'https://www.analog.com/media/en/training-seminars/tutorials/MT-002.pdf'},
  settling:{title:'Analog Devices · exponential settling and time constants',url:'https://www.analog.com/jp/resources/interactive-design-tools/settle-multiplexers.html'},
};
export const PMT_WIRING = [
  {id:'positive',wire:'Red',color:'#d5686e',function:'+5 V input',to:'Regulated +5 V rail',note:'Relative to black. Do not substitute +10 kV or an ESP32 GPIO.'},
  {id:'negative',wire:'Green',color:'#65ba9c',function:'−5 V input',to:'Regulated −5 V rail',note:'A real negative rail relative to black; this is not ground.'},
  {id:'return',wire:'Black',color:'#7793a2',function:'0 V return',to:'Bipolar supply midpoint / signal reference',note:'Provide the intended low-voltage return; keep the HV return path out of the signal cable.'},
  {id:'control',wire:'White',color:'#e4e9ed',function:'Vcont input',to:'Stable +0.5…+1.1 V source, referenced to black',note:'Gain control, not the PMT electrode voltage. Start at +0.5 V; do not exceed +1.1 V.'},
  {id:'reference',wire:'Blue',color:'#72a8fa',function:'+1.2 V reference OUTPUT',to:'Insulate if using an external control-voltage source',note:'Not a power input. For the manufacturer’s 10 kΩ pot method, monitor the wiper and keep it ≤1.1 V.'},
  {id:'signal',wire:'RG-174/U coax',color:'#d9b877',function:'Voltage signal',to:'High-impedance scope input, initially 1 MΩ, DC coupled',note:'Center is signal, shield is signal return. No 50 Ω terminator; do not connect unconditioned output to the ESP32 ADC.'},
];
export const HV_CONNECTIONS = [
  ['SC-HV positive output','Rated HV cable → rated vacuum feedthrough → conductive scintillator coating/contact','Manufacturer-defined coating contact; not the optical glass, PMT supply or signal coax.'],
  ['SC-HV return','Defined chamber-reference point','Use the HV supply’s documented return. Protective earth and low-voltage signal return are separate functions.'],
  ['Collector-bias positive output','Separate insulated feedthrough → collector cage','A few hundred positive volts is the ET teaching example; use the chosen assembly’s rating.'],
  ['Collector-bias return','Same defined chamber-reference point','The cage is not shorted to the scintillator coating or chamber.'],
  ['Chamber / exposed conductive enclosure','Protective-earth bond','Provide a real PE bond; a BNC shield is not the protective-earth conductor.'],
  ['Scintillator optical exit','Insulating light guide → sealed optical boundary → PMT window in air','This is an optical connection, not an electrical return. The mechanical assembly must withstand the scintillator potential.'],
];
export const PARTS = [
  ['PMT/readout','Hamamatsu H10722-110','Specific researched candidate: integrated HV + amplifier. 230–700 nm response, 8 mm active area.','pmt'],
  ['Scintillator','Conductively coated YAP:Ce, custom ET assembly','Candidate material: 370 nm emission and 25 ns decay. Diameter, thickness, coating, contact and HV standoff require a drawing/quote.','crystal'],
  ['Light guide / vacuum boundary','Matched ET light-guide assembly','Optical throughput at 370 nm, light-tight PMT coupling, vacuum seal and electrical insulation must be specified together.','assembly'],
  ['Scintillator HV','Regulated positive HV supply','Provision for the assembly-approved bias, typically around +10 kV for this architecture; current limit, inhibit, monitor, stored energy and discharge specified. No MPN selected.','hv'],
  ['Collector supply','Adjustable positive bias supply','Separate collector output and return; select range and rating from the detector drawing. No MPN selected.','et'],
  ['LV supplies / gain control','Regulated +5 V, −5 V and bounded control voltage','Use a stable bench source for first checks. A gain-control DAC is a later implementation, with a hardware-limited output.','pmt'],
  ['Acquisition','1 MΩ oscilloscope; ADS8681 as a later ADC candidate','ADC candidate supports a ±5.12 V range, 5 V analog supply and 3.3 V logic. A board, protection, layout and SPI driver still need implementation.','adc'],
  ['HV mechanics / instrumentation','Matched HV cables, feedthroughs and rated probe','Connector family, flange, pressure range and voltage rating must match the actual assembly. Ordinary BNC is not the scintillator HV connector.','feedthrough'],
];
export function checkDetector({currentuA=1,dwellUs=100,scintillatorkV=10,controlV=.5}={}){
  for(const value of [currentuA,dwellUs,scintillatorkV,controlV])if(!Number.isFinite(value))throw new TypeError('Detector inputs must be finite.');
  if(currentuA<0||dwellUs<=0||scintillatorkV<0)throw new RangeError('Current/bias must be nonnegative and dwell positive.');
  const idealOutputV=currentuA; // H10722 standard amplifier: 1 V/µA, sign shown as output magnitude.
  const bandwidthHz=20000,tauUs=1e6/(2*Math.PI*bandwidthHz),settle1PercentUs=-Math.log(.01)*tauUs;
  return {idealOutputV,overOutput:idealOutputV>4,atOutputLimit:idealOutputV>=4,headroomV:4-idealOutputV,
    controlValid:controlV>=.5&&controlV<=1.1,landingEnergykeV:scintillatorkV,
    tauUs,settle1PercentUs,periodicSampleRate:1e6/dwellUs,
    slowEnoughForStep:dwellUs>=settle1PercentUs,
    warning:idealOutputV>=4?'Output headroom exhausted. Reduce collected light or PMT gain; the clipped waveform is not modeled.':idealOutputV>2?'Below the nominal limit, with limited headroom. Aim around 0.2–2 V for initial checks.':'Illustrative output has headroom; verify gain, dark offset and measured linearity.'};
}
