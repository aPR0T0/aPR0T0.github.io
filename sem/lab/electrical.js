/** Circuit readouts for the educational model. See ELECTRICAL.md for scope. */
import { CONSTANTS, calculate, normalize } from './physics.js';
import { calculateBSE } from './bse.js';
import { calculateCurrent } from './current.js';

// Teaching assumptions; none is a specification for the user's selected hardware.
export const ELECTRICAL_DEFAULTS = Object.freeze({
  gunGap: 20, anodeApertureGap: 20, apertureBias: 0,
  heaterResistance: 1.5, lensResistance: 8,
});

export const ELECTRICAL_PARAMETER_SCHEMA = Object.freeze({
  gunGap: { type: 'number', unit: 'mm', min: .1, max: 1000, label: 'Cathode–anode gap' },
  anodeApertureGap: { type: 'number', unit: 'mm', min: .1, max: 1000, label: 'Anode–aperture gap' },
  apertureBias: { type: 'number', unit: 'V', min: -2000, max: 2000, label: 'Aperture potential to ground' },
  heaterResistance: { type: 'number', unit: 'Ω', min: .001, max: 1000, label: 'Effective hot filament resistance' },
  lensResistance: { type: 'number', unit: 'Ω', min: .001, max: 10000, label: 'Lens coil resistance' },
});

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const positive = (value) => Math.max(0, finite(value));

export function normalizeElectrical(params = {}) {
  const p = normalize(params);
  // The optics model requires positive beam energy, but a virtual HV-off state
  // must never turn an explicit zero into the default accelerating voltage.
  if (params.voltage === 0) p.voltage = 0;
  for (const [key, rule] of Object.entries(ELECTRICAL_PARAMETER_SCHEMA)) {
    p[key] = clamp(finite(params[key], ELECTRICAL_DEFAULTS[key]), rule.min, rule.max);
  }
  return p;
}

/** Standard-interface UM voltage monitor. The legacy E Out signal is different. */
export function calculateUmMonitor(voltagekV, { ratedVoltagekV = 6 } = {}) {
  if (!Number.isFinite(voltagekV) || !Number.isFinite(ratedVoltagekV)
    || ratedVoltagekV <= 0 || voltagekV < 0 || voltagekV > ratedVoltagekV) return null;
  return 4.64 * voltagekV / ratedVoltagekV;
}

/**
 * +z points from cathode toward specimen. Signed electric fields therefore point
 * upward for a negative cathode; electron force is opposite the field. The
 * aperture field is a gap-average estimate, not a local fringe-field solution.
 * Current readouts are magnitudes. status.sourceOn is upstream of scan blanking.
 */
export function calculateElectrical(params = {}, derived, status = {}) {
  const p = normalizeElectrical(params);
  const d = derived || calculate(p);
  const cathodePotentialV = -p.voltage * 1000;
  const anodePotentialV = 0;
  const aperturePotentialV = p.apertureBias;
  const gunFieldVm = -(anodePotentialV - cathodePotentialV) / (p.gunGap * 1e-3);
  const apertureFieldVm = -(aperturePotentialV - anodePotentialV) / (p.anodeApertureGap * 1e-3);
  const heaterPowerW = p.heaterPower;
  const heaterVoltageV = Math.sqrt(heaterPowerW * p.heaterResistance);
  const heaterCurrentA = Math.sqrt(heaterPowerW / p.heaterResistance);
  const lensCurrentA = p.lensCurrent;
  const lensVoltageV = lensCurrentA * p.lensResistance;
  const lensPowerW = lensCurrentA ** 2 * p.lensResistance;
  const sourceOn = p.voltage > 0 && (status.sourceOn ?? status.beamOn ?? true);
  const beamOn = sourceOn && (status.beamOn ?? sourceOn);
  const scanBlanked = !!status.scanPoint?.blank;
  const emittedCurrentuA = sourceOn ? positive(d.emission) : 0;
  const extractedCurrentuA = emittedCurrentuA * clamp(finite(d.extraction), 0, 1);
  const unextractedCurrentuA = emittedCurrentuA - extractedCurrentuA;
  const apertureAcceptedCurrentuA = extractedCurrentuA * clamp(finite(d.apertureTransmission), 0, 1);
  const apertureInterceptedCurrentuA = extractedCurrentuA - apertureAcceptedCurrentuA;
  const gasLostCurrentuA = apertureAcceptedCurrentuA * (1 - clamp(finite(d.survival), 0, 1));
  const transmittedCurrentuA = Math.max(0, apertureAcceptedCurrentuA - gasLostCurrentuA);
  const downstreamOn = sourceOn && beamOn && !scanBlanked;
  const blankedCurrentuA = downstreamOn ? 0 : transmittedCurrentuA;
  const specimenCurrentnA = downstreamOn ? transmittedCurrentuA * 1000 : 0;
  const pmtAnodeCurrentuA = downstreamOn ? positive(d.pmtAnodeCurrent) : 0;
  const bse = calculateBSE(p, { beamCurrentnA: specimenCurrentnA, beamOn: downstreamOn });
  const current = calculateCurrent(p, { beamCurrentnA: specimenCurrentnA, beamOn: downstreamOn });
  const scanX = finite(status.scanPoint?.x), scanY = finite(status.scanPoint?.y);
  const scanXVoltageV = p.plateVoltage + p.scanAmplitude * scanX;
  const scanYVoltageV = p.scanAmplitude * scanY;
  return {
    params: p, sourceOn: !!sourceOn, beamOn: !!beamOn, scanBlanked,
    detectorMode: p.detectorMode, bse, current,
    bseSignalCurrentnA: bse.generatedCurrentnA,
    detectorBiasVoltageV: p.detectorBias,
    detectorAnodePotentialV: -p.detectorBias,
    detectorCathodePotentialV: 0,
    detectorOutputV: p.detectorMode === 'current' ? current.outputV : p.detectorMode === 'bse' ? bse.rawOutputV : null,
    detectorADCVoltageV: p.detectorMode === 'current' ? current.adcVoltageV : p.detectorMode === 'bse' ? bse.adcOutputV : null,
    cathodePotentialV, anodePotentialV, aperturePotentialV,
    wehneltPotentialV: cathodePotentialV + p.wehnelt,
    gunFieldVm, gunFieldkVm: gunFieldVm / 1000,
    apertureFieldVm, apertureFieldkVm: apertureFieldVm / 1000,
    gunForceN: -CONSTANTS.e * gunFieldVm,
    apertureForceN: -CONSTANTS.e * apertureFieldVm,
    heaterVoltageV, heaterCurrentA, heaterPowerW,
    // Midpoint referencing is a stated schematic assumption, not a gun pinout.
    heaterPlusPotentialV: cathodePotentialV + heaterVoltageV / 2,
    heaterMinusPotentialV: cathodePotentialV - heaterVoltageV / 2,
    lensVoltageV, lensCurrentA, lensPowerW,
    emittedCurrentuA, extractedCurrentuA, unextractedCurrentuA,
    apertureAcceptedCurrentuA, apertureInterceptedCurrentuA, gasLostCurrentuA,
    transmittedCurrentuA, blankedCurrentuA, specimenCurrentnA, pmtAnodeCurrentuA,
    // Unknown external loads must not be replaced by emitted or signal current.
    hvSupplyCurrentA: null, pmtBiasCurrentA: null,
    pmtBiasVoltageV: p.pmtVoltage, collectionVoltageV: p.collectionBias,
    scanXVoltageV, scanYVoltageV,
    scanXFieldVm: -scanXVoltageV / (p.plateGap * 1e-3),
    scanYFieldVm: -scanYVoltageV / (p.plateGap * 1e-3),
    umVoltageMonitorV: calculateUmMonitor(p.voltage),
    umMonitorReference: 'Spellman UM6N4 standard V Mon; 6 kV full scale',
    meterModel: 'Ideal voltage sensors in parallel and current sensors in series; loading is omitted.',
    apertureModel: 'Gap-average field from electrode potentials. Equal grounded end potentials give zero average; local fringe magnitude is not solved.',
  };
}

export const ELECTRICAL_SOURCES = Object.freeze({
  field: { label: 'OpenStax · University Physics II §7.4, field from potential', url: 'https://openstax.org/books/university-physics-volume-2/pages/7-4-determining-field-from-potential' },
  conductor: { label: 'OpenStax · University Physics II §7.5, conductors and equipotentials', url: 'https://openstax.org/books/university-physics-volume-2/pages/7-5-equipotential-surfaces-and-conductors' },
  power: { label: 'OpenStax · University Physics II §9.5, electrical power', url: 'https://openstax.org/books/university-physics-volume-2/pages/9-5-electrical-energy-and-power' },
  meters: { label: 'OpenStax · College Physics 2e §21.4, voltmeters and ammeters', url: 'https://openstax.org/books/college-physics-2e/pages/21-4-dc-voltmeters-and-ammeters' },
  charge: { label: 'OpenStax · University Physics II §10.3, Kirchhoff’s rules', url: 'https://openstax.org/books/university-physics-volume-2/pages/10-3-kirchhoffs-rules' },
  gun: { label: 'JEOL · Thermionic-emission gun, three-electrode structure', url: 'https://www.jeol.com/words/semterms/20121024.071558.php' },
  floating: { label: 'Kimball Physics · FRA-2X1-2/EGPS-1011, floating source and grid supplies', url: 'https://www.kimballphysics.com/wp-content/uploads/2022/11/FRA-2X1-2_EGPS-1011_current-2.pdf' },
  um: { label: 'Spellman · UM datasheet, pp. 2–3, standard V Mon and UM6 rating', url: 'https://www.spellmanhv.com/-/media/en/Products/UM.pdf#page=3' },
  pmt: { label: 'Hamamatsu · PMT handbook, §5.1.3 divider current and linearity', url: 'https://www.hamamatsu.com/resources/pdf/etd/PMT_handbook_v4E.pdf#page=88' },
});

const f = (v, digits = 3) => v === null ? 'unknown' : !Number.isFinite(v) ? 'undefined'
  : v !== 0 && (Math.abs(v) < .001 || Math.abs(v) >= 1e5) ? v.toExponential(digits - 1) : Number(v.toPrecision(digits)).toString();
const context = (p, d) => d?.electrical || calculateElectrical(p, d, d?.electricalStatus || {});

/** Same card/hover contract as physics.js EQUATIONS; accepts optional live status. */
export const ELECTRICAL_EQUATIONS = [
  { id: 'gunElectricField', title: 'Accelerating-anode electric field',
    formula: 'Ēz = −(VA − VK)/gKA; Fz = −eĒz',
    substitution: (p,d) => { const c = context(p,d); return `VK = ${f(c.cathodePotentialV)} V; VA = 0 V; gKA = ${f(c.params.gunGap)} mm`; },
    result: (p,d) => { const c = context(p,d); return `${f(c.gunFieldkVm)} kV/m · electron force ${f(c.gunForceN)} N`; },
    derivation: 'Integrating Ez = −dV/dz over the cathode–anode gap gives the average −ΔV/g. For electron charge −e, Fz = −eEz. The positive axis follows the beam toward the specimen, so the accelerating electric field points toward the cathode.',
    assumptions: 'Gap-average estimate. The drawn field bends schematically near electrodes; space charge, Wehnelt geometry and actual fringe fields require an electrostatic solution.', sources: [ELECTRICAL_SOURCES.field, ELECTRICAL_SOURCES.gun] },
  { id: 'apertureElectricField', title: 'Aperture potential & gap field',
    formula: 'Ēz = −(Vap − VA)/gA,ap; ∫Ez dz = −ΔV',
    substitution: (p,d) => { const c = context(p,d); return `VA = 0 V; Vap = ${f(c.aperturePotentialV)} V; gap = ${f(c.params.anodeApertureGap)} mm`; },
    result: (p,d) => `${f(context(p,d).apertureFieldkVm)} kV/m gap average`,
    derivation: 'Apply the potential-difference integral between the anode and aperture. Equal grounded endpoint potentials make the gap average zero. Local edge fields can still exist; their signed integral cancels and is not a uniform extra accelerating field.',
    assumptions: 'A grounded aperture is the default. Aperture bias is an exploratory electrode-potential overlay; this model does not recompute lensing, electron energy or transmission from that bias. Rim shapes are illustrative; local magnitudes are not solved.', sources: [ELECTRICAL_SOURCES.field, ELECTRICAL_SOURCES.conductor] },
  { id: 'scanDifferentialFields', title: 'Live X/Y plate voltages & fields',
    formula: 'ΔVX = Voffset + A·x; ΔVY = A·y; EX,Y = −ΔVX,Y/g',
    substitution: (p,d) => { const c = context(p,d); return `X+:X− = ${f(c.scanXVoltageV)} V; Y+:Y− = ${f(c.scanYVoltageV)} V; plate gap = ${f(c.params.plateGap)} mm`; },
    result: (p,d) => { const c = context(p,d); return `EX = ${f(c.scanXFieldVm / 1000)} kV/m · EY = ${f(c.scanYFieldVm / 1000)} kV/m`; },
    derivation: 'The programmed normalized coordinates scale the scan amplitude; the X pair also includes its alignment offset. Each differential voltage is V(positive-coordinate plate) minus V(negative-coordinate plate). The gap-average field is the negative voltage gradient, and electron force points opposite that field.',
    assumptions: 'These are differential plate voltages, not individual DAC outputs or plate potentials to ground. Plate common mode, fringing, amplifier response and capacitive drive current are not modeled. The values follow the current scan coordinate, including blanked positions.', sources: [ELECTRICAL_SOURCES.field] },
  { id: 'heaterElectrical', title: 'Floating heater voltage & current',
    formula: 'Vh = √(PhRh); Ih = √(Ph/Rh)',
    substitution: (p,d) => { const c = context(p,d); return `Ph = ${f(c.heaterPowerW)} W; Rh = ${f(c.params.heaterResistance)} Ω`; },
    result: (p,d) => { const c = context(p,d); return `${f(c.heaterVoltageV)} V differential · ${f(c.heaterCurrentA)} A`; },
    derivation: 'Combine Ohm’s law V = IR with P = VI to obtain P = V²/R = I²R, then take positive roots. The displayed small voltage is across the filament; its midpoint is assumed to float at cathode potential.',
    assumptions: 'Rh is an assumed effective hot resistance. No resistance-temperature curve, lead loss or heater transient is modeled. The midpoint reference is a drawing convention, not an identified physical terminal.', sources: [ELECTRICAL_SOURCES.power, ELECTRICAL_SOURCES.floating] },
  { id: 'lensElectrical', title: 'Lens coil electrical load',
    formula: 'VL = ILRL; PL = IL²RL',
    substitution: (p,d) => { const c = context(p,d); return `IL = ${f(c.lensCurrentA)} A; RL = ${f(c.params.lensResistance)} Ω`; },
    result: (p,d) => { const c = context(p,d); return `${f(c.lensVoltageV)} V · ${f(c.lensPowerW)} W`; },
    derivation: 'For a steady current, the resistive voltage drop is IR. Multiplying by current gives I²R heating. Reversing current reverses voltage and magnetic field while leaving the resistive power unchanged.',
    assumptions: 'The coil resistance is an assumption. Inductance, driver compliance, temperature rise and switching transients are omitted.', sources: [ELECTRICAL_SOURCES.power] },
  { id: 'electricalCurrentBalance', title: 'Beam current accounting',
    formula: 'Iext = Iap,hit + Igas + Iblank + Ispec',
    substitution: (p,d) => { const c = context(p,d); return `${f(c.extractedCurrentuA)} µA = ${f(c.apertureInterceptedCurrentuA)} + ${f(c.gasLostCurrentuA)} + ${f(c.blankedCurrentuA)} + ${f(c.specimenCurrentnA / 1000)} µA`; },
    result: (p,d) => `${f(context(p,d).specimenCurrentnA)} nA incident on specimen`,
    derivation: 'Partition the extracted electron stream into aperture interception, modeled gas loss, blanker interception and specimen arrival. These nonnegative current magnitudes sum to the extracted stream. The scan blanker is downstream of the aperture.',
    assumptions: 'The incoming specimen beam is not the net current of a real specimen, which also depends on secondary and backscattered electrons. HV supply total current includes unknown external loads and is not inferred from emission.', sources: [ELECTRICAL_SOURCES.charge] },
  { id: 'umVoltageMonitor', title: 'UM6N4 voltage monitor reference',
    formula: 'VMon = 4.64 V × |VHV|/(6 kV)',
    substitution: (p,d) => `|VHV| = ${f(Math.abs(context(p,d).cathodePotentialV) / 1000)} kV; reference full scale = 6 kV`,
    result: (p,d) => { const v = context(p,d).umVoltageMonitorV; return v === null ? 'Outside the UM6N4 reference range' : `${f(v)} V positive monitor output`; },
    derivation: 'Spellman specifies a positive standard V Mon output of 0–4.64 V across 0–100% rated output. Scaling the UM6 family’s 6 kV range gives this relation; a 3 kV negative HV output corresponds to +2.32 V V Mon.',
    assumptions: 'Reference for the BOM’s UM6N4 family, conditional on that module and standard interface. Another BOM supply needs its own transfer function. Legacy E Out is a separate signal. Supply current remains unknown.', sources: [ELECTRICAL_SOURCES.um] },
  { id: 'idealMeterConnections', title: 'Voltmeter & ammeter loading',
    formula: 'IV = ΔV/RV → 0; VA = IRA → 0',
    substitution: (p,d) => `Lens branch: ΔV = ${f(context(p,d).lensVoltageV)} V; I = ${f(context(p,d).lensCurrentA)} A`,
    result: () => 'Ideal probes: RV → ∞, RA → 0',
    derivation: 'A voltmeter compares two nodes in parallel; its input resistance draws an additional V/R current. An ammeter is in series and adds an IR voltage drop. The ideal limits avoid altering the modeled circuit.',
    assumptions: 'These are virtual probes with no loading. A real instrument requires specified input impedance, burden voltage, common-mode range and insulation. No live hardware measurements are being made.', sources: [ELECTRICAL_SOURCES.meters] },
  { id: 'pmtSignalCurrent', title: 'PMT signal current vs bias current',
    formula: 'IA,signal = eG × Npe/tdwell; Idivider = VPMT/Rdivider',
    substitution: (p,d) => { const c = context(p,d); return `G = ${f(d.pmtGain)}; VPMT = ${f(c.pmtBiasVoltageV)} V; Rdivider is unspecified`; },
    result: (p,d) => `${f(context(p,d).pmtAnodeCurrentuA)} µA signal · bias current unknown`,
    derivation: 'Photoelectrons are multiplied by gain G. Their total output charge divided by dwell time gives the modeled signal current. A passive dynode divider separately draws V/R from the HV supply.',
    assumptions: 'The PMT anode signal is not the HV supply current. The actual divider resistance, topology, other loads and saturation behavior are unspecified. Displayed signal current follows beam blanking and excludes dark current.', sources: [ELECTRICAL_SOURCES.pmt] },
];
