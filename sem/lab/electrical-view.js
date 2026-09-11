import { quantizeScanAxis } from './scan-hardware.js';
import { calculateElectrical } from './electrical.js';

const $ = (root, query) => root.querySelector(query);
const num = (value, unit = '', digits = 2) => value === null || !Number.isFinite(value) ? 'Not modeled' : `${Math.abs(value) > 0 && Math.abs(value) < .001 ? value.toExponential(2) : Number(value.toFixed(digits))}${unit ? ' ' + unit : ''}`;
const regions = {all:[0,0,1000,980],gun:[15,18,970,375],scan:[15,389,970,275],detector:[15,660,970,308]};
const info = {
  supply:{title:'Acceleration supply',tag:'HV POWER',part:'acceleration',column:'anode',region:'gun',eq:'gunElectricField',nets:['hv','power','monitor'],body:'The negative output sets the cathode potential. The anode stays at ground. The 12 V input and low-voltage controller are separate from this kilovolt output.',measure:'The voltage probe spans cathode and grounded anode. Total supply current is not the specimen beam current; bleeder, leakage and other loads are not all modeled.'},
  controller:{title:'Power, permit & control',tag:'REFERENCE CONTROLLER',part:'controller',column:'gun',region:'gun',eq:'umVoltageMonitor',nets:['power','monitor'],body:'The repository’s controller switches module input power, manages permit/enable, programs voltage and current, and buffers monitor outputs. The ESP32 scan controller is a separate subsystem.',measure:'The positive UM6N4 standard voltage-monitor signal is shown as a reference conversion. Its total-load current monitor cannot be inferred from the specimen current.'},
  heater:{title:'Floating filament circuit',tag:'LOCAL HEATER LOOP',part:'heater',column:'gun',region:'gun',eq:'heaterElectrical',nets:['heater','hv'],body:'A low differential voltage drives a large heater current through the filament. The complete heater loop floats near the negative cathode potential; it is not tied to the chassis return.',measure:'Aₕ is in series with the heater. Vₕ spans the filament in parallel. Readouts use selected heater power and an assumed effective hot resistance; the midpoint connection is schematic.'},
  heaterA:{title:'Filament ammeter Aₕ',tag:'SERIES MEASUREMENT',part:'heater',column:'gun',region:'gun',eq:'heaterElectrical',nets:['heater'],body:'The heater ammeter is inside the floating heater loop and measures the same current that heats the filament.',measure:'This current is in amperes. Thermionic emission is a separate electron current, often many orders of magnitude smaller.'},
  heaterV:{title:'Filament voltmeter Vₕ',tag:'PARALLEL MEASUREMENT',part:'heater',column:'gun',region:'gun',eq:'heaterElectrical',nets:['heater'],body:'The voltmeter compares the two ends of the filament, not either terminal against ground.',measure:'The differential voltage can be only a few volts while both meter inputs sit near the kilovolt cathode potential. The displayed sensor is ideal and floating.'},
  hvV:{title:'Cathode voltage probe',tag:'DIFFERENTIAL HV PROBE',part:'acceleration',column:'anode',region:'gun',eq:'gunElectricField',nets:['hv','ground'],body:'This virtual probe measures cathode potential relative to the grounded anode and chamber.',measure:'Negative cathode voltage accelerates electrons toward the anode. It is distinct from the positive low-voltage VMON indication. Meter loading is omitted.'},
  monitor:{title:'Voltage / current monitoring',tag:'BUFFERED MONITOR PORT',part:'acceleration',column:'anode',region:'gun',eq:'umVoltageMonitor',nets:['monitor'],body:'For the UM6N4 standard interface, 0–6 kV maps to a positive 0–4.64 V voltage monitor. A replacement supply needs its own calibration.',measure:'The current monitor measures total external HV load, not incident beam current. Its value remains unspecified here. Monitor return and protective earth are distinct connections.'},
  anode:{title:'Grounded accelerating anode',tag:'ELECTRODE REFERENCE',part:'acceleration',column:'anode',region:'gun',eq:'gunElectricField',nets:['ground','hv'],body:'The anode is at zero potential while the cathode is negative. The gun’s electric field points toward the cathode; the force on an electron points toward the anode.',measure:'Gap-average field is voltage difference divided by the cathode–anode distance. Fringe geometry around the hole is only illustrated.'},
  aperture:{title:'Aperture electrode',tag:'GROUND / OPTIONAL BIAS',part:'aperture',column:'aperture',region:'gun',eq:'apertureElectricField',nets:['aperture','ground'],body:'At zero bias the aperture and anode share the ground reference. Their mean potential-gradient field is zero. Local edge fields can still be present near openings.',measure:'The optional bias source sets aperture potential relative to ground. This field overlay does not recompute electrostatic aperture-lens focusing or transmission.'},
  lens:{title:'Magnetic lens circuit',tag:'CONSTANT-CURRENT DRIVE',part:'lens',column:'lens',region:'scan',eq:'lensElectrical',nets:['lens'],body:'The driver sets coil current. An ammeter is in series with the winding, while a voltmeter spans the winding.',measure:'Voltage is I × R and resistive heating is I²R. The selected resistance is a model assumption; inductance, driver compliance and thermal transients are omitted.'},
  lensA:{title:'Lens ammeter Aₗ',tag:'SERIES MEASUREMENT',part:'lens',column:'lens',region:'scan',eq:'lensElectrical',nets:['lens'],body:'The measured branch current excites the lens coil and sets its modeled magnetic field.',measure:'Reversing current reverses the magnetic field and resistive voltage. I²R heating remains positive.'},
  lensV:{title:'Lens voltmeter Vₗ',tag:'PARALLEL MEASUREMENT',part:'lens',column:'lens',region:'scan',eq:'idealMeterConnections',nets:['lens'],body:'This meter is connected across the coil. Its ideal infinite input impedance leaves the current unchanged.',measure:'A real driver needs enough voltage compliance for winding resistance and current changes. This display is the steady resistive drop.'},
  esp32:{title:'ESP32 scan controller',tag:'PROGRAMMABLE SCANNING',part:'controller',column:'scan',region:'scan',eq:'frameTime',nets:['digital','scan'],body:'The ESP32 sends paired X/Y commands over SPI to an external dual DAC. Bipolar amplifiers translate these into differential plate voltages.',measure:'The code editor controls the trajectory. DAC output and differential plate voltage are different quantities. The separate X+/X− and Y+/Y− conductors lead to the two plate pairs.'},
  scanDac:{title:'Selected X/Y scan DAC',tag:'PRECISION LOW-VOLTAGE COMMANDS',part:'scan-dac',column:'scan',region:'scan',eq:'scanDacStep',nets:['digital','scan','ground'],sources:[{label:'TI DAC80502 transfer function and registers',url:'https://www.ti.com/lit/ds/symlink/dac80502.pdf'}],body:'The new DAC80502 module uses GPIO18 SCLK, GPIO23 SDIN and GPIO27 SYNC. Supply clean 3.3 V and common signal ground. SPI2C is grounded. Firmware sets GAIN = 0x0103 for 0–2.5 V outputs and synchronously loads both channels using a software LDAC command; GPIO26 is unused. A separate buffered 1.25 V center is exported to both external scan amplifiers.',measure:'X and Y below are low-voltage outputs to ground, before amplification. The external amplifier implements Vdiff = gain × (Vdac − Vcenter). The detailed connector map and PCB package are in scan.html. Saved MCP4922 setups use their original wiring and reference; they do not become DAC80502 hardware.'},
  scanX:{title:'X differential plate meter',tag:'V(X+) − V(X−)',part:'scan',column:'scan',region:'scan',eq:'scanDifferentialFields',nets:['scan'],body:'The X voltmeter compares the opposed plates. Its reading includes the live scan command and the X alignment offset.',measure:'Electrostatic plates primarily present a capacitive load. Static current and transient drive current are not inferred without capacitance and amplifier data.'},
  scanY:{title:'Y differential plate meter',tag:'V(Y+) − V(Y−)',part:'scan',column:'scan',region:'scan',eq:'scanDifferentialFields',nets:['scan'],body:'The Y voltmeter compares the second orthogonal pair of plates and follows the programmed Y coordinate.',measure:'Use Scan program to change the path. The coordinate and voltage readouts respond together.'},
  detector:{title:'ET detector & photomultiplier',tag:'ELECTRONS → LIGHT → SIGNAL',part:'detector',column:'detector',region:'detector',eq:'pmtSignalCurrent',nets:['detector','photon','signal'],body:'The collection cage attracts secondary electrons. A scintillator converts their energy to light; the light guide carries photons to the PMT. The PMT anode supplies the signal to a transimpedance amplifier.',measure:'The PMT signal current is distinct from dynode-divider and HV-supply current. The +10 kV scintillator coating bias is an example positive supply referenced to the chamber. See the researched detector wiring for a specific module proposal.'},
  pmtV:{title:'PMT bias voltmeter',tag:'PMT ELECTRODE SPAN',part:'detector',column:'detector',region:'detector',eq:'pmtGain',nets:['detector'],body:'The displayed PMT bias is the magnitude across its photocathode-to-anode supply chain; it is not the signal voltage.',measure:'This diagram uses an abstract bias port because the exact tube and divider polarity are not selected. The anode signal and return need the selected detector’s circuit.'},
  pmtA:{title:'PMT anode signal meter',tag:'SIGNAL CURRENT',part:'detector',column:'detector',region:'detector',eq:'pmtSignalCurrent',nets:['signal'],body:'The virtual current sensor sits in the PMT anode signal path ahead of the transimpedance amplifier.',measure:'The value is estimated photoelectron charge per dwell after gain. It excludes dark current and does not represent PMT HV-divider current.'},
  scope:{title:'Oscilloscope / ADC trace',tag:'SIGNAL OBSERVATION',part:'controller',column:'detector',region:'detector',eq:'snr',nets:['signal','digital'],body:'The scope taps the amplifier output in parallel with the ADC. Its trace follows the same normalized synthetic specimen signal shown in the microscope workspace.',measure:'The trace has no calibrated voltage scale because amplifier gain and electronics bandwidth are not specified. It is not a generated hardware measurement.'},
  vacuum:{title:'Vacuum gauge and pump status',tag:'CHAMBER MEASUREMENT',part:'vacuum',column:'vacuum',region:'detector',eq:'pressure',nets:['vacuum','digital'],body:'A chamber gauge reports modeled pressure; the pump controller reports backing and turbo states. The gauge signal can inform a vacuum-ready contact in the permit chain.',measure:'Choose actual gauge types and ranges from their specifications. This ideal virtual gauge reports the model pressure without sensor response or calibration error.'},
  specimen:{title:'Incident-beam picoammeter',tag:'VIRTUAL FARADAY CUP',part:'detector',column:'specimen',region:'detector',eq:'electricalCurrentBalance',nets:['beam'],body:'This virtual diagnostic represents intercepting the primary beam with an ideal Faraday cup to measure incident current.',measure:'It is a diagnostic branch, not a simultaneous physical cup in the imaging beam. A specimen’s net current differs because secondary and backscattered electrons leave it.'},
};

const bseSources = {
  detector: {label:'Hamamatsu S11141-10 · specifications and outline',url:'https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/s11141-10_s11142-10_kspd1083e.pdf'},
  tia: {label:'Hamamatsu · photodiode bias and TIA feedback',url:'https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/si_pd_kspd9001e.pdf#page=9'},
  opamp: {label:'TI OPA140 · supply, pins and layout',url:'https://www.ti.com/lit/gpn/opa140'},
  adc: {label:'Espressif · ESP32 ADC calibration',url:'https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/adc_calibration.html'},
};
const bseInfo = {
  detector:{title:'S11141-10 direct BSE detector',tag:'ELECTRONS → SILICON CURRENT',part:'detector',column:'detector',region:'detector',eq:'bseCharge',nets:['detector','signal','beam'],sources:[bseSources.detector,bseSources.tia],body:'Backscattered electrons create electron–hole pairs directly in silicon. The diode is inside the vacuum chamber, with its sensitive face aimed at the specimen. A side mount keeps the package outside the primary-beam envelope; centred comparison mode uses the central opening. The mechanical controls are in the microscope Detector tab.',measure:'K is the cathode, connected to the amplifier summing input near 0 V. A is the anode, connected to a quiet negative bias. These are functional terminals; verify their physical orientation against the supplier delivery drawing. This mode has no scintillator or PMT supply.'},
  bseBias:{title:'Detector reverse-bias supply',tag:'LOW-VOLTAGE JUNCTION BIAS',part:'detector',column:'detector',region:'detector',eq:'bseBias',nets:['detector','ground'],sources:[bseSources.detector,bseSources.tia],body:'The proposed supply places A at −VR relative to signal 0 V, while the TIA holds K near 0 V. Thus VR = VK − VA is positive. The interface explores 0–5 V reverse bias.',measure:'This junction bias controls capacitance and dark current. It is not a kilovolt electron-acceleration supply. Vᵣ is measured with its positive input at K and negative input at A. A real probe adds capacitance to the sensitive node.'},
  bseA:{title:'Generated-current virtual ammeter',tag:'VIRTUAL SIGNAL DECOMPOSITION',part:'detector',column:'detector',region:'detector',eq:'bseCharge',nets:['signal','beam'],sources:[bseSources.detector,bseSources.tia],body:'This virtual sensor separates the current generated by collected backscattered electrons from the dark current. A physical series ammeter would measure their total, with its own burden and leakage; it cannot directly separate these contributions.',measure:'Conventional detector current flows from the summing node into K and through the detector toward A. The feedback resistor supplies that current, producing a positive TIA output. The simulator omits meter burden; no physical ammeter is required in this sensitive lead.'},
  bseTIA:{title:'OPA140 transimpedance stage',tag:'PROPOSED ANALOG FRONT END',part:'detector',column:'detector',region:'detector',eq:'bseTIA',nets:['signal','power','ground'],sources:[bseSources.tia,bseSources.opamp],body:'Connect K to −IN, +IN to quiet signal 0 V, and Rf in parallel with Cf from OUT back to −IN. The proposed OPA140 uses +5 V and −5 V supply rails. Current leaving the summing node gives VOUT ≈ +(Isignal + Idark)Rf.',measure:'Rf and Cf are adjustable model values, not a validated compensation network. The detector capacitance, cable, leakage and amplifier phase margin require circuit analysis and a measured step response. Matching +5VA / −5VA rail labels are electrical connections.'},
  bseV:{title:'TIA output voltmeter',tag:'PARALLEL VOLTAGE PROBE',part:'detector',column:'detector',region:'detector',eq:'bseTIA',nets:['signal','ground'],sources:[bseSources.tia,bseSources.opamp],body:'The virtual voltmeter spans TIA OUT and signal 0 V. Its readout is the ideal demanded output, including the modeled dark-current offset.',measure:'The ideal demand can exceed the real amplifier rails or ADC range. Such a value is an overload warning, not a physically achievable measured voltage. A real scope should use its high-impedance input at this buffered output.'},
  bseCondition:{title:'ADC buffer, filter and protection',tag:'REQUIRED INTERFACE · DESIGN PENDING',part:'controller',column:'detector',region:'detector',eq:'bseTIA',nets:['signal','digital','ground'],sources:[bseSources.opamp,bseSources.adc],body:'The proposed conditioning stage adds a quiet +0.15 V reference at unity signal gain, then buffers, filters and protects the ESP32 input. The existing firmware expects a conditioned 0.15–3.1 V input on GPIO34.',measure:'The model adds the ideal offset and clips at its selected ceiling. The offset reference, filter, buffer and protection components are not yet selected or validated. Direct connection from a ±5 V op-amp output can exceed the ESP32 input range. Select and calibrate the actual circuit before wiring the ADC.'},
  bseADC:{title:'ESP32 GPIO34 analog input',tag:'ADC1 CHANNEL 6',part:'controller',column:'scan',region:'detector',eq:'bseTIA',nets:['signal','digital','ground'],sources:[bseSources.adc],body:'GPIO34 receives the conditioned voltage and ADC1 digitizes it at each programmed pixel. The scan firmware and X/Y DAC connections remain the existing ESP32 design.',measure:'ADC calibration, analog settling and synchronized acquisition determine useful accuracy. The simulated ceiling does not configure a physical ADC. Keep high-current and switching returns away from the detector input; join references at a deliberate point.'},
  scope:{title:'BSE output oscilloscope',tag:'HIGH-IMPEDANCE OUTPUT TAP',part:'controller',column:'detector',region:'detector',eq:'bseTiming',nets:['signal','ground'],sources:[bseSources.tia],body:'Connect the high-impedance scope input to the TIA output and its return to the defined signal reference. Observe dark baseline, positive signal changes, overload and settling before connecting the ADC.',measure:'This animated trace is a normalized specimen preview. The adjacent voltmeter reports ideal output demand; neither is a live instrument. Evaluate the scope earth connection as part of the single-point grounding design.'},
};
const bseRegions={...regions,all:[0,0,1000,1335],detector:[15,665,970,657]};

const currentSources = {
  amp:{label:'TI LMC662 · pinout, TIA and guarding',url:'https://www.ti.com/lit/ds/symlink/lmc662.pdf'},
  adc:{label:'TI ADS1115 · differential inputs, PGA and data rate',url:'https://www.ti.com/lit/ds/symlink/ads1115.pdf'},
  esp:{label:'Espressif · ESP32 I²C interface',url:'https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/i2c.html'},
};
const currentInfo = {
  detector:{title:'Specimen-current detector',tag:'SPECIMEN → ELECTRICAL SIGNAL',part:'detector',column:'detector',region:'detector',eq:'currentBalance',nets:['beam','signal','ground'],sources:[currentSources.amp],body:'The conductive specimen and holder form the sensing electrode inside vacuum. An insulating support separates the holder from the grounded stage. Its only intended DC signal return goes through a sealed feedthrough to the LMC662 summing input, held near 0 V by feedback.',measure:'Iabs = Ib − ISE − IBSE, expressed as electron-current magnitudes. There is no silicon detector head, scintillator, collection-cage bias or PMT in this mode. The microscope still needs its separate gun acceleration supply.'},
  specimen:{title:'Electrically isolated specimen holder',tag:'VIRTUAL ZERO · INSULATED SUPPORT',part:'detector',column:'specimen',region:'detector',eq:'currentBalance',nets:['beam','signal'],sources:[currentSources.amp],body:'Conductive coating and contact carry the specimen current to the holder. The holder must not have a second DC path through the grounded mechanical stage; that would bypass the measurement. The chamber and stage retain their protective earth bond.',measure:'Near-zero specimen potential comes from amplifier feedback. It is not a freely floating sample or a direct ground short. Support leakage and specimen charging are not predicted by this simplified model.'},
  currentA:{title:'Net-current virtual ammeter',tag:'CURRENT BALANCE · INFERRED',part:'detector',column:'detector',region:'detector',eq:'currentBalance',nets:['signal'],sources:[currentSources.amp],body:'This current reading is inferred from the ideal sample charge balance. The PCB measures voltage across its feedback network; it does not place a physical multimeter in series with the pA input.',measure:'For positive absorbed electron current, electrons enter the holder and conventional current leaves the summing node toward the specimen. The LMC662 TIA therefore produces a positive output. Emission greater than incidence reverses this sign.'},
  currentTIA:{title:'LMC662 U1A transimpedance amplifier',tag:'100 MΩ ∥ 10 pF · REV A',part:'detector',column:'detector',region:'detector',eq:'currentTIA',nets:['signal','ground','power'],sources:[currentSources.amp],body:'U1A pin 2 is the sensitive inverting input. Pin 3 connects to quiet AGND. Rf and Cf connect from pin 1 OUT back to pin 2. LMC662 pin 8 uses +5 V and pin 4 uses −5 V. A grounded guard surrounds the summing node on the atmospheric PCB.',measure:'Vtia ≈ Iabs × Rf under the stated electron-current sign convention. At 100 MΩ, 1 pA produces 100 µV. RC settling is only a first-order estimate; capacitance, offset, leakage and stability need bench measurement.'},
  currentV:{title:'TIA output voltage probe',tag:'PARALLEL OUTPUT MEASUREMENT',part:'detector',column:'detector',region:'detector',eq:'currentTIA',nets:['signal','ground'],sources:[currentSources.amp],body:'The voltmeter and optional high-impedance oscilloscope tap U1A pin 1 relative to AGND. They do not contact the summing input. The demanded voltage can be bipolar.',measure:'The TIA output must pass through the selected attenuator and offset circuit before the ADC. A predicted rail or ADC overrange invalidates the acquired signal.'},
  currentCondition:{title:'LMC662 U1B ADC conditioner',tag:'ATTENUATION + LEVEL SHIFT',part:'detector',column:'detector',region:'detector',eq:'currentADC',nets:['signal','power','ground'],sources:[currentSources.amp,currentSources.adc],body:'The second amplifier takes Vtia through 40.2 kΩ into pin 6 (−IN), with 10 kΩ feedback from pin 7. Pin 5 (+IN) is 1.32 V, from a filtered 15 kΩ / 10 kΩ divider on quiet 3.3 V. It maps the bipolar TIA output toward the middle of the ADC supply.',measure:'V(A0) ≈ 1.648358 − 0.248756 Vtia. A1 is approximately 1.65 V. The nominal 1.642 mV differential offset and resistor tolerances require zero and gain calibration. This is not a direct ±5 V connection to an ESP32 ADC pin.'},
  currentADC:{title:'ADS1115 external differential ADC',tag:'A0 − A1 · I²C ADDRESS 0x48',part:'controller',column:'detector',region:'detector',eq:'currentADC',nets:['signal','digital','ground'],sources:[currentSources.adc,currentSources.esp],body:'ADS1115 is powered from 3.3 V. A0 receives the protected, filtered conditioned output; A1 receives the 1.65 V reference. ADDR is tied to ground for address 0x48. J3 pin 3 SDA connects to ESP32 GPIO21 and pin 4 SCL to GPIO22 with pull-ups to 3.3 V; pin 1 is AGND. Leave pin 5 ALERT unconnected in the default harness: GPIO27 is scan-DAC CS and firmware polls conversion readiness over I²C.',measure:'Default ±0.256 V differential full scale at 128 samples/s gives a nominal 7.8125 µV/code. That is approximately 0.314 pA/code referred to a 100 MΩ TIA through this attenuator. Quantization is not total measurement accuracy. Each analog input must remain inside its absolute supply limits.'},
  currentSupply:{title:'Low-voltage detector supplies',tag:'ANALOG ±5 V · ADC 3.3 V',part:'detector',column:'detector',region:'detector',eq:'currentADC',nets:['power','ground','signal'],sources:[currentSources.amp,currentSources.adc],body:'The detector front end uses quiet +5 V and −5 V analog rails; its MCP1700 generates 3.3 V for the ADC and references. The ESP32 uses separate USB power and shares AGND. J3 pin 2 is a reference output limited to 20 mA, not an ESP32 supply. All are ordinary low voltages; they are separate from the microscope gun HV supply.',measure:'The chamber and metal readout enclosure remain protectively earthed. Route pump, heater, lens and scan-driver return currents away from AGND, and make the signal-reference bond deliberately at one point.'},
  scope:{title:'Current-readout oscilloscope',tag:'TIA OUTPUT · HIGH IMPEDANCE',part:'detector',column:'detector',region:'detector',eq:'currentTiming',nets:['signal','ground'],sources:[currentSources.amp,currentSources.adc],body:'Observe the buffered TIA output relative to AGND. Measure blanked-beam noise and settling after known current steps before connecting the specimen or shortening pixel dwell.',measure:'The animation is a normalized synthetic trace, not a measured waveform. Keep the real scope ground connection consistent with the chamber and signal-reference bonding plan.'},
};
const currentRegions={...regions,all:[0,0,1000,1335],detector:[15,665,970,657]};

function currentDetectionMarkup(){return `
  ${section(687,'03','SPECIMEN-CURRENT READOUT','100 MΩ LMC662 front end · external ADS1115 · no detector HV')}
  <text class="e-zone-label" x="45" y="730">VACUUM / INSULATED HOLDER</text><text class="e-zone-label" x="345" y="730">AIR / SHIELDED PCB REV A</text>
  <rect class="e-vacuum-zone" x="35" y="745" width="252" height="333" rx="10"/>
  <path class="e-boundary" d="M307 745V1078"/>
  ${wire('M158 766V864','beam')}
  <path class="e-bse-arrow" d="m153 855 5 9 5-9"/><text class="e-tiny" x="177" y="790">Incident beam</text>
  ${wire('M150 863Q95 824 62 850 M168 863Q204 818 264 840','beam')}
  <text class="e-tiny" x="59" y="821">SE / BSE leave</text>
  ${node('specimen',66,865,191,75,'Conductive specimen','Holder held near 0 V',null,'beam')}
  <rect x="98" y="947" width="131" height="15" rx="2" fill="#9cac91" stroke="#d4dfbd"/><text class="e-tiny" x="100" y="988">Insulating support</text>
  ${wire('M61 1014H266V1100H130V1155','ground')}
  <text class="e-tiny" x="71" y="1043">Chamber / stage earth</text>
  ${wire('M257 890H319 M351 890H420V840H455','signal')}
  <rect x="299" y="879" width="16" height="22" rx="3" fill="#bfc6aa" stroke="#e4e5c7"/>
  <text class="e-tiny" x="321" y="940">Sealed feedthrough</text><text class="e-tiny" x="321" y="959">short guarded input</text>
  ${meter('currentA',335,890,'A','currentNet','Net current','signal',343,922)}
  ${wire('M422 840V782H454 M520 782H589V867 M422 782V750H473 M489 750H589V782','signal')}
  <g class="e-feedback" data-node="currentTIA" role="button" tabindex="0"><rect x="454" y="775" width="66" height="14" rx="1"/><path d="M473 741V759M489 741V759"/><text class="e-small-value" x="524" y="744" data-electric="currentCf">—</text><text class="e-small-value" x="440" y="804" data-electric="currentRf">—</text></g>
  <g class="e-opamp" data-node="currentTIA" role="button" tabindex="0"><path class="e-opamp-body" d="M455 817V917L560 867Z"/><text x="465" y="845">−</text><text x="465" y="901">+</text><text class="e-opamp-name" x="478" y="868">LMC662</text><text class="e-tiny" x="478" y="885">U1A</text></g>
  <text class="e-tiny" x="445" y="826">2</text><text class="e-tiny" x="442" y="918">3</text><text class="e-tiny" x="568" y="852">1</text>
  ${wire('M455 896H437V1132 M560 867H621','signal')}
  ${wire('M490 830V811H550 M490 903V925H550','power')}
  <text class="e-tiny" x="546" y="817">+5 V / pin 8</text><text class="e-tiny" x="547" y="929">−5 V / pin 4</text>
  <circle class="e-junction" cx="422" cy="840" r="3"/><circle class="e-junction" cx="422" cy="782" r="3"/><circle class="e-junction" cx="589" cy="782" r="3"/><circle class="e-junction" cx="589" cy="867" r="3"/>
  ${node('currentCondition',621,824,157,88,'U1B conditioner','−0.248756 gain / offset','currentInput','signal')}
  ${wire('M778 867H817','signal')}
  ${node('currentADC',817,824,149,88,'ADS1115','A0 − A1 · 0x48','currentDiff','digital')}
  <text class="e-tiny" x="821" y="940">A1 reference ≈ 1.65 V</text><text class="e-tiny" x="821" y="957" data-electric="currentRate">—</text>
  ${wire('M589 867V973 M589 1005V1132','ground')}
  ${meter('currentV',589,989,'V','currentOutput','TIA output','signal',585,1040)}
  ${wire('M608 867V979H678','signal')}
  <g class="e-node signal" data-node="scope" role="button" tabindex="0"><rect x="678" y="962" width="129" height="91" rx="7"/><text class="e-node-title" x="690" y="984">Scope · high Z</text><path class="e-scope-axis" d="M688 1035H796M697 996V1043"/><path id="electrical-trace" d="M689 1028H796"/></g>
  <text class="e-tiny" x="680" y="1072">Normalized model trace</text>
  ${wire('M890 912V1000','digital')}
  ${node('currentADC',832,1000,133,74,'ESP32','21 SDA / 22 SCL',null,'digital')}
  <text class="e-tiny" x="833" y="1100">USB power · shared AGND</text>
  ${node('currentSupply',334,1060,207,52,'Quiet ±5 V / 3.3 V','Analog + ADC rails',null,'power')}
  ${wire('M437 1112V1132 M130 1155H282V1132H967 M700 912V930H808V1132 M899 1074V1132 M746 1053V1132','ground')}
  <circle class="e-junction" cx="437" cy="1132" r="3"/><circle class="e-junction" cx="589" cy="1132" r="3"/><circle class="e-junction" cx="746" cy="1132" r="3"/>
  <path class="e-wire ground" d="M130 1155V1165M118 1165H142M122 1171H138M126 1177H134"/>
  <text class="e-tiny" x="292" y="1153">AGND · deliberate single-point chamber bond · no stage bypass around TIA</text>
  <text class="e-tiny" x="292" y="1174">PCB input is low voltage. Keep it separate from the cathode and scan-driver wiring.</text>
  <text class="e-tiny" x="292" y="1194">Measure the blanked-beam zero and known-current gain before acquiring an image.</text>
  ${node('specimen',35,1221,230,74,'Net specimen current','Virtual / inferred','currentNet','beam')}
  ${node('vacuum',304,1221,230,74,'Chamber gauge','Ideal pressure readout','pressure','vacuum')}
  ${node('vacuum',573,1221,180,74,'Backing + turbo','Pump controller','pumps','vacuum')}
  ${wire('M534 1257H573 M753 1257H784V1243H814','vacuum')}
  <text class="e-tiny" x="800" y="1233">Vacuum permit</text><text class="e-small-value" x="800" y="1271" data-electric="permit">—</text>
  <text class="e-tiny" x="35" y="1320">Functional connections · open the Rev A design package for full component values, pinout, routing and checks</text>
`;}

function wire(d,net,extra=''){return `<path class="e-wire ${net}" data-net="${net}" d="${d}" ${extra}/>`;}
function node(id,x,y,w,h,title,sub,key,net='power'){
  return `<g class="e-node ${net}" data-node="${id}" role="button" tabindex="0" aria-label="Inspect ${info[id]?.title||title}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/><text class="e-node-title" x="${x+12}" y="${y+22}">${title}</text><text class="e-node-sub" x="${x+12}" y="${y+41}">${sub}</text>${key?`<text class="e-value" x="${x+12}" y="${y+h-13}" data-electric="${key}">—</text>`:''}</g>`;
}
function meter(id,x,y,symbol,key,label,net,valueX=x,valueY=y+38){const left=Math.min(x-22,valueX-38),top=Math.min(y-36,valueY-15),right=Math.max(x+22,valueX+38),bottom=Math.max(y+22,valueY+7);return `<g class="e-meter ${net}" data-node="${id}" role="button" tabindex="0" aria-label="Inspect ${info[id]?.title||label}"><rect class="e-hit" x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="transparent" pointer-events="all"/><circle cx="${x}" cy="${y}" r="16"/><text x="${x}" y="${y+5}" text-anchor="middle">${symbol}</text><text class="e-meter-name" x="${x}" y="${y-26}" text-anchor="middle">${label}</text><text class="e-value" x="${valueX}" y="${valueY}" text-anchor="middle" data-electric="${key}">—</text></g>`;}
function section(y,num,title,sub){return `<text class="e-section" x="34" y="${y}">${num} / ${title}</text><text class="e-section-sub" x="966" y="${y}" text-anchor="end">${sub}</text><path class="e-divider" d="M34 ${y+14}H966"/>`;}
function markup(mode = 'et'){const height = mode !== 'et' ? 1335 : 980;return `<svg id="electrical-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${height}" aria-label="Interactive electrical connections and virtual meters" preserveAspectRatio="xMidYMid meet">
  <defs><pattern id="circuit-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#2a434d"/></pattern></defs><rect x="-2000" y="-2000" width="5000" height="5000" fill="#0d1d28"/><rect x="-2000" y="-2000" width="5000" height="5000" fill="url(#circuit-grid)"/>
  <defs><clipPath id="electrical-clip"><rect id="electrical-clip-rect" x="0" y="0" width="1000" height="${height}"/></clipPath></defs><g clip-path="url(#electrical-clip)">
  ${section(35,'01','SOURCE & ACCELERATION','HV, local heater loop, and electrode references')}
  ${wire('M180 110H230 M420 110H490','power')}
  ${wire('M640 110H715V199H749','hv')}
  ${wire('M686 110V174 M686 206V348H940','hv')}
  ${wire('M540 165V201H465V151H420','monitor')}
  ${wire('M465 201V221H325V270H305','monitor')}
  <text class="e-wire-label" x="187" y="97">12 V</text><text class="e-wire-label" x="428" y="97">power / enable</text><text class="e-wire-label monitor" x="365" y="193">VMON / IMON</text>
  ${node('controller',35,77,145,76,'LV supply','12 V nominal',null)}
  ${node('controller',230,77,190,88,'Protection + permit','V / I programming · relays',null)}
  ${node('supply',490,77,150,88,'Negative HV','K → gun', 'cathode','hv')}
  ${meter('hvV',686,190,'V','cathode','Vₖ relative to ground','hv')}
  <g class="e-floating"><rect x="749" y="65" width="215" height="246" rx="10"/><text x="762" y="87">FLOATING HEATER DOMAIN</text><text class="e-floating-note" x="762" y="296" data-electric="floating">—</text></g>
  ${wire('M804 133H869 M901 133H936V143 M936 174V225H785V188','heater')}
  ${wire('M912 133V174H875 M843 174H826V225','heater')}
  ${wire('M749 199H759 M759 199V214H773','hv')}
  <path class="e-wire hv reference" d="M773 214H781"/><text class="e-tiny" x="763" y="240">K · midpoint reference</text>
  ${node('heater',765,111,65,77,'Heater','local',null,'heater')}
  ${meter('heaterA',885,133,'A','heaterA','','heater',902,110)}
  ${meter('heaterV',859,174,'V','heaterV','','heater',917,214)}
  <path class="e-filament" d="M936 143l-6 5 12 7-12 7 12 7-6 5"/><text class="e-tiny" x="909" y="252">Filament</text>
  <text class="e-tiny" x="765" y="272">Wehnelt</text><text class="e-small-value" x="947" y="272" text-anchor="end" data-electric="wehnelt">—</text>
  ${node('monitor',35,236,270,87,'Reference monitor / isolated readout','UM6N4 standard VMON', 'monitor','monitor')}
  <text class="e-tiny" x="49" y="341">IMON: total load unspecified</text>
  ${node('anode',354,257,129,66,'Anode','Grounded',null,'ground')}
  ${node('aperture',509,257,135,66,'Aperture','Optional bias','aperture','aperture')}
  ${wire('M418 323V364H940 M577 323V346','ground')}
  <g class="e-bias-source"><circle cx="577" cy="354" r="8"/><text x="577" y="358" text-anchor="middle">±</text></g>${wire('M577 362V364','ground')}
  <text class="e-tiny" x="710" y="380">Grounded anode / chamber</text><path class="e-wire ground" d="M940 348V379M925 379H955M930 385H950M936 391H944"/>

  ${section(420,'02','LENS & SCAN ELECTRONICS','Series A · parallel V · differential plate pairs')}
  ${node('lens',35,460,145,74,'Lens driver','Constant current',null,'lens')}
  ${wire('M180 483H226 M258 483H311 M427 483H447V581H190V517H180','lens')}
  ${wire('M307 483V550H337 M369 550H447','lens')}
  ${meter('lensA',242,483,'A','lensA','Aₗ','lens')}
  ${meter('lensV',353,550,'V','lensV','','lens',353,611)}
  <g class="e-node lens" data-node="lens" role="button" tabindex="0" aria-label="Inspect magnetic lens winding"><rect x="311" y="457" width="116" height="52" rx="6"/><path class="e-coil" d="M321 483q0-24 12-24q12 0 12 24q0-24 12-24q12 0 12 24q0-24 12-24q12 0 12 24q0-24 12-24q12 0 12 24"/><text class="e-tiny" x="369" y="530" text-anchor="middle">Coil · Rₗ assumed</text></g>
  <text class="e-small-value" x="92" y="560" data-electric="lensW">—</text><text class="e-tiny" x="92" y="577">resistive heating</text>
  ${node('esp32',505,460,128,74,'ESP32','SPI + blanking',null,'digital')}
  ${node('scanDac',669,460,120,74,'DAC80502','16-bit / 2.5 V',null,'digital')}
  ${node('esp32',825,460,139,74,'Bipolar drivers','X± / Y±',null,'scan')}
  ${wire('M633 485H669','digital')}${wire('M789 480H807V475H825 M789 497H815V497H825','scan')}
  <rect x="503" y="544" width="116" height="60" rx="5" fill="#254943" stroke="#739082"/><text class="e-tiny" x="514" y="563">Buffered midpoint</text><text class="e-small-value" x="514" y="587" data-electric="dacCentre">1.25 V</text>
  ${wire('M619 570H799V524H825','scan')}
  ${wire('M845 534V542H638V590 M861 534V550H700V590 M919 534V558H829V590 M939 534V566H891V590','scan')}
  <text class="e-tiny" x="620" y="569">X+</text><text class="e-tiny" x="697" y="569">X−</text><text class="e-tiny" x="809" y="578">Y+</text><text class="e-tiny" x="892" y="578">Y−</text>
  ${wire('M638 590H653M685 590H700M829 590H844M876 590H891','scan')}
  <path class="e-plates" d="M638 576V607M700 576V607M829 576V607M891 576V607"/>
  ${meter('scanX',669,590,'V','scanX','X plates','scan')}
  ${meter('scanY',860,590,'V','scanY','Y plates','scan')}
  <text class="e-tiny" x="505" y="645">Each voltmeter spans its two plates. Driver grounding and output stages are conceptual.</text>

  ${mode === 'current' ? currentDetectionMarkup() : mode === 'bse' ? bseDetectionMarkup() : etDetectionMarkup()}
  </g></svg>`;}

function etDetectionMarkup(){return `
  ${section(687,'03','DETECTION & DIAGNOSTICS','Optical path, signal electronics, and chamber measurements')}
  ${node('detector',35,746,135,79,'Collection cage','Bias to chamber', 'cage','detector')}
  ${node('detector',215,746,135,79,'Scintillator','+10 kV example',null,'detector')}
  ${node('detector',398,746,135,79,'PMT','Light → electrons',null,'detector')}
  ${wire('M170 783H215','beam')}${wire('M350 783H398','photon')}
  <text class="e-tiny" x="178" y="769">SE</text><text class="e-tiny" x="355" y="769">light</text>
  ${wire('M427 746V722H449 M481 722H509V746','detector')}
  ${meter('pmtV',465,722,'V','pmtV','PMT bias span','detector',548,727)}
  ${wire('M533 783H560 M592 783H624 M708 783H727V851H924V825 M727 783H746','signal')}
  ${meter('pmtA',576,783,'A','pmtA','Signal','signal')}
  ${node('scope',624,755,84,70,'TIA','I → V',null,'signal')}
  <g class="e-node signal" data-node="scope" role="button" tabindex="0" aria-label="Inspect oscilloscope"><rect x="746" y="751" width="100" height="77" rx="7"/><text class="e-node-title" x="758" y="773">Scope</text><path class="e-scope-axis" d="M755 805H837M766 782V819"/><path id="electrical-trace" d="M756 803H836"/><text class="e-tiny" x="752" y="844">normalized</text></g>
  ${node('scope',884,755,80,70,'ADC','to ESP32',null,'digital')}
  <text class="e-tiny" x="745" y="741">Parallel signal tap</text>
  ${node('specimen',35,875,230,74,'Faraday-cup diagnostic','Incident beam · virtual','specimen','beam')}
  ${node('vacuum',304,875,230,74,'Chamber gauge','Ideal pressure readout','pressure','vacuum')}
  ${node('vacuum',573,875,180,74,'Backing + turbo','Pump controller','pumps','vacuum')}
  ${wire('M534 911H573 M753 911H784V897H814','vacuum')}
  <text class="e-tiny" x="800" y="887">Vacuum permit</text><text class="e-small-value" x="800" y="925" data-electric="permit">—</text>
`;}

function bseDetectionMarkup(){return `
  ${section(687,'03','DIRECT BSE DETECTION','Proposed circuit · silicon → current → voltage → ADC')}
  <text class="e-zone-label" x="45" y="730">VACUUM / S11141-10</text><text class="e-zone-label" x="333" y="730">AIR / LOW-NOISE READOUT</text>
  <rect class="e-vacuum-zone" x="35" y="741" width="272" height="274" rx="10"/>
  <path class="e-boundary" d="M317 741V1015"/><text class="e-tiny" x="330" y="985">Sealed feedthrough</text><text class="e-tiny" x="330" y="1000">short, shielded lead</text>
  ${node('detector',58,800,214,103,'S11141-10','Direct BSE · 10 × 10 mm',null,'detector')}
  <text class="e-terminal" x="67" y="869">A</text><text class="e-terminal" x="248" y="837">K</text>
  <circle class="e-terminal-dot" cx="58" cy="864" r="3"/><circle class="e-terminal-dot" cx="272" cy="832" r="3"/>
  <circle class="e-junction" cx="291" cy="832" r="3"/>
  <text class="e-tiny" x="91" y="890" data-electric="bseMount">Mount geometry</text>
  ${wire('M58 864H46V1020H95V1040','detector')}
  ${wire('M46 864V767H164 M196 767H291V832H319 M351 832H454','signal')}
  ${wire('M272 832H319','signal')}
  ${meter('bseBias',180,767,'V','bseBias','Vᵣ = Vₖ − Vₐ','detector',226,788)}
  <text class="e-terminal" x="148" y="759">−</text><text class="e-terminal" x="204" y="759">+</text>
  ${meter('bseA',335,832,'A','bseA','Signal only','signal',351,900)}
  <path class="e-current-arrow" d="M388 846H365m6-5-6 5 6 5"/><text class="e-tiny" x="367" y="874">K ≈ 0 V</text>
  ${wire('M167 941Q125 923 120 904 M183 941Q224 923 218 904','beam')}
  <path class="e-bse-arrow" d="m116 911 4-7 5 6m91 1 2-7 6 4"/>
  <text class="e-tiny" x="159" y="930">BSE</text>
  ${node('specimen',75,941,183,55,'Specimen','Ground reference',null,'beam')}

  ${wire('M410 832V782H450 M513 782H593V859 M410 782V750H471 M486 750H593V782','signal')}
  <g class="e-feedback" data-node="bseTIA" role="button" tabindex="0" aria-label="Inspect feedback resistance and capacitance"><rect x="450" y="775" width="63" height="14" rx="1"/><path d="M471 741V759M486 741V759"/><text class="e-small-value" x="520" y="741" data-electric="bseCf">—</text><text class="e-small-value" x="435" y="802" data-electric="bseRf">—</text></g>
  <g class="e-opamp" data-node="bseTIA" role="button" tabindex="0" aria-label="Inspect OPA140 transimpedance stage"><path class="e-opamp-body" d="M454 809V909L559 859Z"/><text x="463" y="838">−</text><text x="463" y="894">+</text><text class="e-opamp-name" x="477" y="860">OPA140</text><text class="e-tiny" x="476" y="874">candidate</text></g>
  ${wire('M454 888H430V1018H333V1154 M559 859H640','signal')}
  ${wire('M490 826V815H535 M490 892V916H535','power')}
  <text class="e-tiny" x="537" y="818">+5VA</text><text class="e-tiny" x="537" y="906">−5VA</text>
  <circle class="e-junction" cx="410" cy="832" r="3"/><circle class="e-junction" cx="410" cy="782" r="3"/><circle class="e-junction" cx="593" cy="782" r="3"/><circle class="e-junction" cx="593" cy="859" r="3"/>
  <text class="e-tiny" x="354" y="947">+IN → signal 0 V</text>
  ${node('bseCondition',640,820,154,86,'Buffer + filter','+0.15 V / filter / protect','bseRange','signal')}
  ${wire('M794 859H834','signal')}
  ${node('bseADC',834,820,130,86,'ESP32 ADC1','GPIO34 · channel 6','bseADC','digital')}
  <text class="e-tiny" x="842" y="928">Calibrate at each setting</text>
  ${wire('M593 859V934 M593 966V1020H648 M930 906V1154 M648 906V1154','ground')}
  <circle class="e-junction" cx="648" cy="1020" r="3"/>
  ${meter('bseV',593,950,'V','bseOutput','TIA ideal demand','signal',593,997)}
  ${wire('M615 859V932H756V947','signal')}
  <circle class="e-junction" cx="615" cy="859" r="3"/>
  <g class="e-node signal" data-node="scope" role="button" tabindex="0" aria-label="Inspect BSE output oscilloscope"><rect x="665" y="947" width="153" height="85" rx="7"/><text class="e-node-title" x="677" y="969">Scope · high Z</text><path class="e-scope-axis" d="M675 1014H806M686 980V1022"/><path id="electrical-trace" d="M676 1007H806"/><text class="e-tiny" x="671" y="1051">normalized specimen preview</text></g>
  ${wire('M818 996H826V1154','ground')}

  ${node('bseBias',50,1040,255,89,'Quiet negative bias','A → −Vᵣ · return → signal 0 V','bseNegative','detector')}
  ${wire('M170 1129V1154','ground')}
  ${node('bseTIA',352,1040,282,89,'Quiet analog supply','+5VA / −5VA → op-amp power pins',null,'power')}
  <text class="e-tiny" x="365" y="1110">Decouple locally · rail labels are connected nets</text>
  ${wire('M492 1129V1154','ground')}
  <text class="e-tiny" x="674" y="1083">Conditioning is a required design block.</text><text class="e-tiny" x="674" y="1100">Verify limits before connecting GPIO34.</text><text class="e-tiny" x="674" y="1117">No ADC protection circuit is simulated.</text>
  ${wire('M170 1154H952V1172','ground')}
  <path class="e-wire ground" d="M938 1172H966M942 1178H962M948 1184H956"/>
  <circle class="e-junction" cx="333" cy="1154" r="3"/><circle class="e-junction" cx="492" cy="1154" r="3"/><circle class="e-junction" cx="593" cy="1154" r="3"/><circle class="e-junction" cx="648" cy="1154" r="3"/><circle class="e-junction" cx="826" cy="1154" r="3"/><circle class="e-junction" cx="930" cy="1154" r="3"/>
  <text class="e-tiny" x="171" y="1176">Signal 0 V · low-voltage returns join here; keep pump / scan currents out of this path</text>
  <text class="e-tiny" x="171" y="1194">Chamber / enclosure → separate protective earth bond · plan the signal-reference bond</text>
  ${node('specimen',35,1221,230,74,'Faraday-cup diagnostic','Incident beam · virtual','specimen','beam')}
  ${node('vacuum',304,1221,230,74,'Chamber gauge','Ideal pressure readout','pressure','vacuum')}
  ${node('vacuum',573,1221,180,74,'Backing + turbo','Pump controller','pumps','vacuum')}
  ${wire('M534 1257H573 M753 1257H784V1243H814','vacuum')}
  <text class="e-tiny" x="800" y="1233">Vacuum permit</text><text class="e-small-value" x="800" y="1271" data-electric="permit">—</text>
  <text class="e-tiny" x="35" y="1320">Functional connection proposal · physical lead orientation, PCB compensation and protection still require verification</text>
`;}

export function mountElectricalView(root,api){
  const surface=$(root,'#electrical-surface'),jump=$(root,'#electrical-jump');
  let svg,readouts=[],mode='et',entries=info,regionMap=regions,currentRegion='all';
  let selected='supply',bounds=[...regions.all],down=null,latest=null;
  const sourceList=document.createElement('div');sourceList.className='electrical-connection-sources';
  $(root,'#electrical-inspector-measurement').after(sourceList);
  function render(nextMode){
    mode=nextMode;entries=mode==='current'?{...info,...currentInfo}:mode==='bse'?{...info,...bseInfo}:info;regionMap=mode==='current'?currentRegions:mode==='bse'?bseRegions:regions;
    if(mode!=='et'){delete entries.pmtA;delete entries.pmtV;}
    if(!entries[selected])selected='detector';
    surface.innerHTML=markup(mode);svg=$(root,'#electrical-svg');readouts=[...root.querySelectorAll('[data-electric]')];
    jump.innerHTML='<option value="">Zoom to a component…</option>'+Object.entries(entries).map(([id,entry])=>`<option value="${id}">${entry.title}</option>`).join('');
    surface.dataset.detectorMode=mode;
    root.dataset.detectorMode=mode;
    const legend=root.querySelector('.circuit-legend');
    if(legend){const entries=[...legend.children];entries[0].lastChild.textContent=mode==='bse'?' HV / low-voltage bias':' HV / bias';entries.at(-1).hidden=mode!=='et';}
    bindInteractive();select(selected,false);focus(currentRegion);
  }
  function view(){
    svg.setAttribute('viewBox',bounds.join(' '));
    const clip=$(root,'#electrical-clip-rect');['x','y','width','height'].forEach((key,i)=>clip.setAttribute(key,bounds[i]));
    $(root,'#electrical-zoom-readout').textContent=`${Math.round(1000/bounds[2]*100)}%`;
  }
  function focus(region){
    currentRegion=region;bounds=[...(regionMap[region]||regionMap.all)];
    surface.classList.toggle('circuit-focused',region!=='all');
    surface.style.setProperty('--circuit-aspect',`${bounds[2]} / ${bounds[3]}`);view();
    root.querySelectorAll('[data-circuit-region]').forEach(button=>{button.classList.toggle('active',button.dataset.circuitRegion===region);button.setAttribute('aria-pressed',button.dataset.circuitRegion===region);});
  }
  function focusComponent(id){
    const entry=entries[id]||entries.supply;
    let area=entry.part==='heater'?[735,55,245,265]:['supply','hvV'].includes(id)?[475,65,275,320]:['anode','aperture'].includes(id)?[340,240,320,150]:entry.region==='gun'?[20,60,635,285]:entry.part==='lens'?[20,440,445,195]:entry.region==='scan'?[490,445,490,210]:id==='specimen'?[20,860,265,105]:id==='vacuum'?[290,860,695,105]:id==='scope'?[610,735,370,135]:[385,685,235,155];
    if(mode==='bse'&&entry.region==='detector'){
      area=id==='vacuum'?[290,1200,695,110]:id==='specimen'?[20,1200,265,110]:id==='detector'?[25,735,300,395]:id==='bseBias'?[25,735,300,425]:id==='bseA'?[250,790,245,160]:id==='scope'?[575,910,395,280]:id==='bseADC'?[625,800,355,360]:id==='bseCondition'?[575,800,405,390]:id==='bseV'?[550,825,330,365]:[325,725,665,485];
    }
    if(mode==='current'&&entry.region==='detector') area=id==='vacuum'?[290,1200,695,110]:['specimen','detector'].includes(id)?[25,735,300,465]:id==='currentADC'?[800,800,185,330]:id==='scope'?[560,950,260,145]:id==='currentSupply'?[310,1045,665,160]:[310,725,680,490];
    focus(entry.region);bounds=area;surface.style.setProperty('--circuit-aspect',`${bounds[2]} / ${bounds[3]}`);view();
  }
  function select(id,refresh=true){
    selected=entries[id]?id:'detector';id=selected;jump.value=id;const entry=entries[id]||entries.supply;
    root.querySelectorAll('[data-node]').forEach(node=>{node.classList.toggle('selected',node.dataset.node===id);node.setAttribute('aria-pressed',node.dataset.node===id);});
    root.querySelectorAll('[data-net]').forEach(line=>line.classList.toggle('highlight',entry.nets.includes(line.dataset.net)));
    $(root,'#electrical-inspector-tag').textContent=entry.tag;
    $(root,'#electrical-inspector-title').textContent=entry.title;
    $(root,'#electrical-inspector-description').textContent=entry.body;
    $(root,'#electrical-inspector-measurement').textContent=entry.measure;
    $(root,'#electrical-equation').onclick=event=>api.showEquation(entry.eq,event.currentTarget);
    $(root,'#electrical-part').onclick=()=>api.openPart(entry.part);
    $(root,'#electrical-column').onclick=()=>api.openColumn(entry.column);
    $(root,'#electrical-focus-selected').onclick=()=>focusComponent(id);
    sourceList.innerHTML=entry.sources?'<span>Connection references</span>'+entry.sources.map(source=>`<a href="${source.url}" target="_blank" rel="noreferrer">${source.label} ↗</a>`).join('')+`<a href="${id==='scanDac'?'scan.html#wiring':mode==='current'?'current.html#connections':'BSE_CONNECTIONS.md'}" target="_blank" rel="noreferrer">Detailed connection schedule ↗</a>`:'';
    if(latest&&refresh)update(...latest);
  }
  function zoom(factor){const next=Math.max(220,Math.min(1400,bounds[2]*factor)),ratio=next/bounds[2],h=bounds[3]*ratio;bounds=[bounds[0]+(bounds[2]-next)/2,bounds[1]+(bounds[3]-h)/2,next,h];view();}
  function bindInteractive(){
    root.querySelectorAll('[data-node]').forEach(node=>{
      node.setAttribute('aria-label',`Inspect ${entries[node.dataset.node]?.title||node.dataset.node}`);
      node.addEventListener('click',()=>{if(!down?.moved)select(node.dataset.node);});
      node.addEventListener('dblclick',()=>focusComponent(node.dataset.node));
      node.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();select(node.dataset.node);}});
    });
    svg.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY>0?1.1:.9);},{passive:false});
    svg.addEventListener('pointerdown',event=>{if(event.button!==0)return;down={x:event.clientX,y:event.clientY,bounds:[...bounds],moved:false};if(!event.target.closest('[data-node]'))svg.setPointerCapture(event.pointerId);});
    svg.addEventListener('pointermove',event=>{if(!down)return;const dx=event.clientX-down.x,dy=event.clientY-down.y;if(Math.hypot(dx,dy)>5)down.moved=true;if(down.moved){const scale=Math.min(svg.clientWidth/down.bounds[2],svg.clientHeight/down.bounds[3]);bounds=[down.bounds[0]-dx/scale,down.bounds[1]-dy/scale,...down.bounds.slice(2)];view();}});
    svg.addEventListener('pointerup',()=>{setTimeout(()=>{down=null;},0);});svg.addEventListener('pointercancel',()=>{down=null;});
  }
  jump.addEventListener('change',()=>{if(jump.value){select(jump.value);focusComponent(jump.value);}});
  root.querySelectorAll('[data-circuit-region]').forEach(button=>button.addEventListener('click',()=>{const region=button.dataset.circuitRegion,representative={detector:'detector',gun:'supply',scan:'lens'}[region];if(representative)select(representative);focus(region);}));
  $(root,'#electrical-zoom-in').onclick=()=>zoom(.8);$(root,'#electrical-zoom-out').onclick=()=>zoom(1.25);$(root,'#electrical-reset').onclick=()=>focus('all');
  function update(p,d,s,samples,write=0){
    latest=[p,d,s,samples,write];const nextMode=['current','bse'].includes(p.detectorMode)?p.detectorMode:'et';if(nextMode!==mode)render(nextMode);const e=d.electrical||calculateElectrical(p,d,s);
    const values={cathode:num(e.cathodePotentialV/1000,'kV',3),heaterA:num(e.heaterCurrentA,'A',3),heaterV:num(e.heaterVoltageV,'V',3),floating:`Midpoint K = ${num(e.cathodePotentialV/1000,'kV',3)}`,wehnelt:num(e.wehneltPotentialV/1000,'kV',3),monitor:e.umVoltageMonitorV===null?'Outside 6 kV reference':num(e.umVoltageMonitorV,'V',3),aperture:num(e.aperturePotentialV,'V'),lensA:num(e.lensCurrentA,'A',3),lensV:num(e.lensVoltageV,'V',3),lensW:num(e.lensPowerW,'W',3),scanX:num(e.scanXVoltageV,'V',2),scanY:num(e.scanYVoltageV,'V',2),cage:num(e.collectionVoltageV,'V'),pmtV:num(e.pmtBiasVoltageV,'V'),pmtA:num(e.pmtAnodeCurrentuA,'µA',3),specimen:num(e.specimenCurrentnA,'nA',3),pressure:`${p.pressure.toExponential(2)} mbar`,pumps:`Backing ${s.roughing?'ON':'OFF'} · Turbo ${s.turbo?'ON':'OFF'}`,permit:p.pressure<=1e-4?'MODEL READY':'WAITING'};
    const sh=d.scanHardware, qx=quantizeScanAxis(s.scanPoint?.x||0,p),qy=quantizeScanAxis(s.scanPoint?.y||0,p);
    values.dacCentre=num(sh?.centreV,'V',3);
    const dacNode=root.querySelector('[data-node="scanDac"]');if(dacNode){dacNode.querySelector('.e-node-title').textContent=sh?.name||'DAC';dacNode.querySelector('.e-node-sub').textContent=`${sh?.dacBits}-bit / ${sh?.dacReference} V`;}
    const current=d.current||e.current;
    if(mode==='current') Object.assign(values,{currentNet:num(current?.netCurrentnA,'nA',3),currentOutput:num(current?.outputV,'V',4),currentInput:num(current?.adcVoltageV,'V',4),currentDiff:num(current?.adcDifferentialV,'V',5),currentRf:`Rf ${num(p.currentRf,'MΩ',2)}`,currentCf:`Cf ${num(p.currentCf,'pF',2)}`,currentRate:`${p.currentADCRate||128} SPS · ±${p.currentADCRange||.256} V PGA`});
    const bse=e.bse||d.bse;
    if(mode==='bse')Object.assign(values,{
      bseBias:num(p.detectorBias,'V',2),bseNegative:`A = ${num(-p.detectorBias,'V',2)}`,
      bseA:num(bse?.generatedCurrentnA,'nA',3),bseOutput:num(bse?.rawOutputV,'V',3),
      bseADC:num(bse?.adcOutputV,'V',3),bseRange:'0.15–3.1 V target',bseMount:p.detectorOffset>0?`Side ${num(p.detectorOffset,'mm')} · tilt ${num(p.detectorTilt,'°')}`:'Centred · beam through hole',
      bseRf:`Rf ${num(p.tiaResistance,'MΩ',2)}`,bseCf:`Cf ${num(p.tiaCapacitance,'pF',2)}`,
    });
    for(const el of readouts){const value=values[el.dataset.electric]??'Not modeled';if(el.textContent!==value)el.textContent=value;}
    const selectedValues={supply:['Cathode',values.cathode,'HV total current','Not modeled'],controller:['UM reference VMON',values.monitor,'Current monitor','Not modeled'],monitor:['UM reference VMON',values.monitor,'Current monitor','Not modeled'],heater:['Filament voltage',values.heaterV,'Heater current',values.heaterA],heaterA:['Heater current',values.heaterA,'Heating power',num(p.heaterPower,'W')],heaterV:['Differential voltage',values.heaterV,'Cathode midpoint',values.cathode],hvV:['Cathode to ground',values.cathode,'Mean gun E',num(e.gunFieldkVm,'kV/m')],anode:['Anode potential','0 V','Mean gun E',num(e.gunFieldkVm,'kV/m')],aperture:['Aperture to ground',values.aperture,'Mean gap E',num(e.apertureFieldkVm,'kV/m')],lens:['Coil current',values.lensA,'Coil voltage',values.lensV],lensA:['Coil current',values.lensA,'Resistive power',values.lensW],lensV:['Coil voltage',values.lensV,'Coil resistance',num(p.lensResistance,'Ω')],esp32:['X differential',values.scanX,'Y differential',values.scanY],scanX:['X differential',values.scanX,'X field',num(e.scanXFieldVm/1000,'kV/m')],scanY:['Y differential',values.scanY,'Y field',num(e.scanYFieldVm/1000,'kV/m')],detector:['Anode signal',values.pmtA,'PMT bias magnitude',values.pmtV],pmtA:['Anode signal',values.pmtA,'HV divider current','Not modeled'],pmtV:['Bias magnitude',values.pmtV,'HV divider current','Not modeled'],scope:['Signal scale','Normalized','Frame minimum',num(d.frameTime,'s',3)],vacuum:['Chamber pressure',values.pressure,'Vacuum permit',values.permit],specimen:['Incident beam',values.specimen,'Aperture intercepted',num(e.apertureInterceptedCurrentuA,'µA',3)]};
    if(mode==='bse')Object.assign(selectedValues,{
      detector:['Generated signal',values.bseA,'Junction reverse bias',values.bseBias],
      bseA:['Generated signal',values.bseA,'Dark current model',num(bse?.darkCurrentnA,'nA',3)],
      bseBias:['Reverse bias Vₖ − Vₐ',values.bseBias,'Anode to signal 0 V',num(-p.detectorBias,'V',2)],
      bseTIA:['Ideal TIA demand',values.bseOutput,'Feedback values',`${values.bseRf} / ${values.bseCf}`],
      bseV:['Ideal TIA demand',values.bseOutput,'ADC status',bse?.saturated?'OVER RANGE':bse?.rawOutputV==null?'UNSUPPORTED ENERGY':'Within model range'],
      bseCondition:['Before ADC limiting',num(bse?.adcInputV,'V',3),'ADC model output',values.bseADC],
      bseADC:['ADC model voltage',values.bseADC,'GPIO34 target',bse?.adcInputV>3.1?'Over 3.1 V target':'0.15–3.1 V'],
      scope:['Ideal TIA demand',values.bseOutput,'1% settling estimate',num(bse?.settlingTimeUs,'µs',1)],
    });
    if(mode==='current')Object.assign(selectedValues,{detector:['Net specimen current',values.currentNet,'TIA output',values.currentOutput],specimen:['Net specimen current',values.currentNet,'Incident beam',values.specimen],currentA:['Net specimen current',values.currentNet,'RMS current noise',num(current?.rmsNoisepA,'pA',3)],currentTIA:['TIA output',values.currentOutput,'Feedback',`${values.currentRf} / ${values.currentCf}`],currentV:['TIA output',values.currentOutput,'Overrange',current?.clipped?'CLIPPED':'Within model range'],currentCondition:['ADC A0',values.currentInput,'ADC differential',values.currentDiff],currentADC:['A0 − A1',values.currentDiff,'ADC code',num(current?.adcCode,'',0)],currentSupply:['Analog supplies','+5 / −5 V','ADC supply','3.3 V'],scope:['TIA output',values.currentOutput,'1% RC settling',num(current?.settlingTimeUs,'µs',1)]});
    selectedValues.scanDac=['X DAC to ground',num(qx.voltage,'V',6),'Y DAC to ground',num(qy.voltage,'V',6)];
    const display=selectedValues[selected]||selectedValues.supply;
    for(let i=0;i<4;i++){const el=$(root,`#electric-reading-${i}`);if(el.textContent!==display[i])el.textContent=display[i];}
    $(root,'#electrical-live-status').textContent=s.beamOn?'BEAM ACTIVE':'BEAM BLANKED';
    if(samples?.length){let path='';const traceX=mode==='current'?689:mode==='bse'?676:756,traceY=mode==='current'?1035:mode==='bse'?1014:813,step=mode==='current'?2.7:mode==='bse'?3.3:2.05;for(let i=0;i<40;i++){const value=s.beamOn?samples[(write+i*3)%samples.length]:0;path+=`${i?'L':'M'}${traceX+i*step},${traceY-Math.max(0,Math.min(1,value))*27}`;}$(root,'#electrical-trace').setAttribute('d',path);}
  }
  render('et');return {update,focus,select};
}
