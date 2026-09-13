// Electrical contract for the two integrated-power prototypes.
// Connector pins are checked against each exported native KiCad netlist.
import { designChecks } from './power-check-data.js';

const sources = [
  {label:'TI LMR51420 · 9–30 V input buck',url:'https://www.ti.com/lit/ds/symlink/lmr51420.pdf'},
  {label:'RECOM R05P09D/P · isolated bipolar supply',url:'https://www.recom-power.com/pdf/Econoline/RxxPxx.pdf'},
  {label:'TI TPS7A49 · positive regulator',url:'https://www.ti.com/lit/ds/symlink/tps7a49.pdf'},
  {label:'TI TPS7A30 · negative regulator',url:'https://www.ti.com/lit/ds/symlink/tps7a30.pdf'},
  {label:'TI LMC662 · amplifier and guarding',url:'https://www.ti.com/lit/ds/symlink/lmc662.pdf'},
  {label:'TI ADS1115 · differential ADC',url:'https://www.ti.com/lit/ds/symlink/ads1115.pdf'},
];
const pin=(connector,pin,net,to,note,group='signal')=>({connector,pin,net,from:`${connector}.${pin} · ${net}`,to,note,group});
const files=(project)=>{
  const base=`detector-integrated/${project}/`;
  return {
    image:base+'exports/board-top.png',schematic:base+`exports/${project}_analog.svg`,
    packageURL:base+'detector-design.zip',sourceLabel:`${project}.kicad_pcb`,
    imageCaption:`${project==='current12'?'170 × 100':'220 × 140'} mm · two copper layers. KiCad copper and package-envelope view; some component bodies are omitted. Open the full image or assembly drawing for pin detail.`,
    schematicCaption:'Analog measurement sheet. Download the complete schematic PDF for the overview, power converters, regulators and collector readout / bias sheets.',
    downloads:[
      {label:'Complete schematic · PDF',url:base+'exports/schematic.pdf'},
      {label:'PCB · editable KiCad',url:base+`kicad/${project}.kicad_pcb`},
      {label:'Assembly drawing · SVG',url:base+'exports/assembly.svg'},
      {label:'Parts list · CSV',url:base+'bom.csv'},
      {label:'Connections & commissioning',url:base+'README.md'},
      {label:'CAD verification · JSON',url:base+'verification/check-summary.json'},
      {label:'Prototype fabrication files · ZIP',url:base+'fabrication.zip'},
    ],
  };
};
const commonPower=[
  {title:'12 V or 24 V DC',detail:'Regulated 9–30 V at J2. Fuse and reverse-polarity diode protect the input.',reference:'J2 · input protection'},
  {title:'Onboard 5 V buck',detail:'LMR51420 switches at 500 kHz. A 10 µH inductor and output capacitors produce about 5.09 V.',reference:'LMR51420XFDDCR'},
  {title:'Quiet local rails',detail:'R05P09D/P creates raw ±9 V. RC filters and TPS7A49 / TPS7A30 regulate local ±5 V; the ADC gets its own 3.3 V supply.',reference:'Isolated DC/DC → filters → linear regulators'},
];
const commonLimits=[
  'Unbuilt prototype: noise, leakage, stability, gain, load regulation and discharge still require measurement. No pA resolution or image performance is established.',
  'The buck and isolated supply are onboard; the collector version also has an onboard HV converter. The isolated and HV converters are packaged modules.',
  'Use a regulated 9–30 V source, including transients. This is not an automotive input. The scan ESP32 and electron gun retain their own supplies.',
  'The 100 MΩ / 10 pF front end needs a short, clean guarded input. Onboard switching can couple into the measurement; compare blanked-beam noise with converter and UART activity.',
  'BOM prices have not been quoted. The regulated HV module may dominate the collector-board cost; the earlier low-cost detector estimate does not cover this board.',
];
export const designs={
  current:{
    ...files('current12'),title:'Specimen-current board',revision:'Current12 · B0 · unbuilt',
    input:'12 / 24 V · regulated 9–30 V',rails:'±5 V analog · 3.3 V ADC',bias:'Specimen held near 0 V',dataInterface:'Direct 3.3 V I²C → ESP32',
    summary:'One DC input powers the existing LMC662 / ADS1115 measurement circuit. Connect the insulated conductive specimen holder to SUM. The amplifier common and chamber share one deliberate ground reference.',
    powerSteps:commonPower,
    signalSteps:[
      {title:'Insulated specimen → SUM',detail:'Only the conductive specimen holder connects to J1.1. The chamber and outer shield are grounded.',reference:'J1.1 → LMC662 pin 2'},
      {title:'Current → voltage → ADC',detail:'100 MΩ feedback converts current to voltage. The level-shift stage feeds ADS1115 A0−A1.',reference:'LMC662 → ADS1115 · 128 SPS'},
      {title:'Direct I²C → scan ESP32',detail:'J3 SDA / SCL go to GPIO21 / GPIO22. J3 ground joins ESP32 ground. Use the existing specimen-current scan sketch.',reference:'J3 → grounded ESP32'},
    ],
    isolationTitle:'The specimen holder is insulated. The amplifier is grounded.',
    isolationDetail:'The DC/DC secondary common is deliberately bonded to primary / chamber ground. This board does not float at collector bias. A second wire from the specimen holder to ground would bypass the measured current.',
    connections:[
      pin('J2',1,'VIN','DC source +12 V or +24 V','Use regulated 9–30 V; verify polarity before applying power.','power'),
      pin('J2',2,'PGND','DC source negative','Primary return; bonded to local analog ground on this board.','power'),
      pin('J1',1,'SUM','Insulated conductive specimen holder','Feedthrough centre only. No second ground connection to the specimen holder.'),
      pin('J1',2,'AGND','Input guard / shield','Grounded-reference guard. Keep the signal conductor insulated from it.','earth'),
      pin('J3',1,'AGND','ESP32 GND','Reference for the direct I²C signals.','data'),
      pin('J3',2,'+3V3','Leave open','ADC reference OUTPUT; do not feed or power an ESP32 through this pin.','power'),
      pin('J3',3,'SDA','ESP32 GPIO21','3.3 V I²C data. Both devices must be powered while connected; coordinate power or disconnect before separate power cycling.','data'),
      pin('J3',4,'SCL','ESP32 GPIO22','3.3 V I²C clock.','data'),
      pin('J3',5,'RDY','Leave open with the supplied polling sketch','Optional ADC conversion-ready output.','data'),
      pin('J4',1,'PGND','Chamber / enclosure ground star','Use a separate mechanically secure protective-earth bond for accessible metal; PCB wiring is not that bond.','earth'),
      pin('J4',2,'PGND','Same ground star / shield return','Duplicate PGND terminal; internally connected to J4.1.','earth'),
    ],checks:designChecks.current,sources,limits:[...commonLimits,'Direct I²C requires both the detector and ESP32 powered while connected. Use coordinated power; disconnect the data cable before separately power-cycling either side. This interface has no powered-off bus isolation.'],
  },
  collector:{
    ...files('collector12'),title:'Biased-collector board',revision:'Collector12 · B0 · unbuilt',
    input:'12 / 24 V · regulated 9–30 V',rails:'±5 V around FCOM · local 3.3 V',bias:'0–200 V raw · ≈199.6 V filtered',dataInterface:'Two optocouplers · 38,400 baud UART',
    summary:'A separate metal collector measures net arriving electron current. The bias converter raises FCOM, which is the common for the amplifier, ADC and local MCU. Two onboard optocouplers connect that floating section to the grounded scan ESP32.',
    powerSteps:[...commonPower,
      {title:'5 V → positive collector bias',detail:'CA02P-5 generates 0–200 V. TPS2553-1 limits its input current and latches off on a sustained short. TPS3808 checks the actual module supply and holds the programming clamp for 180–420 ms after it becomes valid.',reference:'CA02P-5 · TPS2553-1 · TPS3808G50'},
      {title:'Filter → floating common',detail:'Two 10 kΩ stages, 100 nF and 1 µF filter the bias. FCOM rises to about +199.6 V at 200 V raw. The detector rails stay ±5 V relative to FCOM.',reference:'Internal bias connection → FCOM'},
      {title:'Return & passive discharge',detail:'Converter return, case, outer shield and chamber remain at ground. Raw and final bias nodes have permanent bleeders; measure the full discharge time.',reference:'PGND / chamber · independent FCOM bleeder'},
    ],
    signalSteps:[
      {title:'Metal collector → SUM',detail:'Collector goes only to J1.1. Feedback holds it near FCOM while measuring current. Bias must not be wired straight to SUM.',reference:'J1.1 → LMC662 pin 2'},
      {title:'Local ADC → local MCU',detail:'ADS1115 converts A0−A1 at 128 SPS. An ATmega328P at 3.3 V / 8 MHz requests a fresh conversion for each sample.',reference:'LMC662 → ADS1115 → ATmega328P'},
      {title:'Optical UART → scan ESP32',detail:'One optocoupler carries requests and one returns CRC-checked readings. All J3 signal pins belong to the grounded side.',reference:'2 × VO2611-X016 · J3.3 / J3.4'},
    ],
    isolationTitle:'FCOM floats. The chamber and host remain grounded.',
    isolationDetail:'SUM → collector; FCOM → inner guard; PGND → grounded host and outer enclosure. The rated isolated DC/DC, two optocouplers and intentional filtered bias path cross the boundary. The PCB uses a 5 mm separation rule between primary and floating copper, with a separate 2 mm rule around grounded-side HV routes. No grounded USB, programmer or oscilloscope lead may connect to the floating island while biased.',
    connections:[
      pin('J2',1,'VIN','DC source +12 V or +24 V','Use regulated 9–30 V; this powers detector electronics and bias only.','power'),
      pin('J2',2,'PGND','DC source negative','Ground-side return.','power'),
      pin('J1',1,'SUM','Separate metal collector','Insulated feedthrough centre. Never connect the bias output directly to this pin.'),
      pin('J1',2,'FCOM','Inaccessible inner guard','Floats near +200 V. Keep the outer cable shield and enclosure separately grounded.','earth'),
      pin('J3',1,'PGND','ESP32 GND','All J3 pins are on the grounded side.','data'),
      pin('J3',2,'HOST_VIO','ESP32 3.3 V rail','Required interface supply INPUT, ≤19 mA planning allowance. Using the host’s rail removes the board-powered LED/pull-up injection path; leakage and hot-plug behavior remain unverified.','power'),
      pin('J3',3,'HOST_TX','ESP32 GPIO17 · UART TX','Host → optocoupler → floating MCU RX.','data'),
      pin('J3',4,'HOST_RX','ESP32 GPIO16 · UART RX','Floating MCU TX → optocoupler → host.','data'),
      pin('J3',5,'HV_ENABLE','ESP32 GPIO32','LOW by default. HIGH enables the current-limited bias supply; actual rail qualification still holds the command clamp.','data'),
      pin('J3',6,'PGM_RELEASE','ESP32 GPIO33','LOW clamps programming to zero. HIGH only after startup; hardware also requires the actual module rail to pass its delayed check.','data'),
      pin('J3',7,'HV_FAULT_N','ESP32 GPIO34 · input','Active-LOW current-limiter fault; board pulls up to HOST_VIO. A fault blanks acquisition and disables bias.','data'),
      pin('J3',8,'PGND','ESP32 GND / optional duplicate return','Same ground-side net as J3.1.','data'),
      pin('J4',1,'PGND','Chamber / enclosure ground star','Ground the specimen in this collector-only arrangement. Accessible metal also needs its own secure earth bond.','earth'),
      pin('J4',2,'PGND','Same ground star / shield return','Duplicate PGND terminal; keep this separate from the floating inner guard.','earth'),
      pin('J5',1,'MISO','AVR programmer MISO · only with bias discharged','Standard 2×3 ICSP; remove every programmer lead before bias operation.','data'),
      pin('J5',2,'+3V3D','Programmer target-voltage sense','3.3 V logic only; do not back-power the island.','power'),
      pin('J5',3,'SCK','AVR programmer SCK','Configure an external 8 MHz crystal and suitable ICSP clock.','data'),
      pin('J5',4,'MOSI','AVR programmer MOSI','Commission with HV disabled and verified discharged.','data'),
      pin('J5',5,'RESET','AVR programmer RESET','Not a ground-side control signal.','data'),
      pin('J5',6,'FCOM','AVR programmer ground · commissioning only','Disconnect programmer entirely before collector bias is enabled.','earth'),
    ],
    checks:designChecks.collector,
    sources:[...sources,{label:'XP Power CA02P-5 · bias module and startup',url:'https://www.xppower.com/portals/0/pdfs/SF_CA_Series.pdf'},{label:'TI TPS2553-1 · latch-off current limiter',url:'https://www.ti.com/lit/ds/symlink/tps2553-1.pdf'},{label:'TI TPS3808 · supply qualification and delay',url:'https://www.ti.com/lit/ds/symlink/tps3808.pdf'},{label:'Vishay VO2611-X016 · optical UART',url:'https://www.vishay.com/docs/84732/6n137.pdf'}],
    limits:[...commonLimits,
      'Net collector current can contain secondary electrons, backscattered electrons and chamber background. Acceleration does not multiply charge on a plain metal collector. Uncoated insulators still charge.',
      'The isolated converter is rated 250 VAC rms basic working insulation; its 6.4 kV figure is a short test rating. Assembly insulation and leakage need verification.',
      'Collector mounting: use nylon / PEEK fasteners and standoffs only. The 3.2 mm holes reserve a 6.4 mm diameter insulating washer envelope; grounded metal must not enter the floating section or approach its copper.',
      'The final 1 µF capacitor alone stores 20 mJ at 200 V. Module internal capacitance is unspecified: a delay or an OFF command does not prove discharge.',
      'TPS2553-1 limits the bias-module input to a calculated 262–342 mA range and latches off on sustained overcurrent. Startup compatibility and fault shutdown need bench validation. GPIO controls are not a certified beam interlock.',
    ],
  },
};
