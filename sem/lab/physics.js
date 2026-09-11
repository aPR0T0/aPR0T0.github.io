import { SIDE_MOUNT_PRESET } from './detector-geometry.js';
/** Fast, deterministic educational SEM model. See PHYSICS.md for units and limits. */
import { BSE_DEFAULTS, normalizeBSE, calculateBSE } from './bse.js';
import { CURRENT_DEFAULTS, normalizeCurrent, calculateCurrent } from './current.js';
import { SCAN_HARDWARE_DEFAULTS, normalizeScanHardware, calculateScanHardware } from './scan-hardware.js';
export const CONSTANTS = Object.freeze({
  e: 1.602176634e-19, m: 9.1093837139e-31, h: 6.62607015e-34,
  c: 299792458, k: 1.380649e-23, sigma: 5.670374419e-8, mu0: 1.25663706127e-6,
});

export const DEFAULTS = Object.freeze({
  ...BSE_DEFAULTS, ...SIDE_MOUNT_PRESET, ...CURRENT_DEFAULTS, ...SCAN_HARDWARE_DEFAULTS, detectorMode: 'current',
  voltage: 3, heaterPower: 3, aperture: 100, wehnelt: -150, lensCurrent: 0.45,
  plateVoltage: 0, plateGap: 10, plateLength: 20, workingDistance: 15,
  chamberVolume: 8, pumpSpeed: 20, conductance: 8, gasLoad: 1e-5,
  pressure: 1e-5, dwell: 10000, resolution: 32, scanAmplitude: 20,
  pmtVoltage: 800, collectionBias: 250, scanMode: 'raster',
  ambientTemperature: 293.15, emissivity: 0.35, radiatingArea: 2.2e-6,
  thermalConductance: 2.5e-4, emittingArea: 1e-10, workFunction: 4.5,
  richardsonConstant: 6e5, apertureBeamSigma: 500, lensTurns: 452,
  lensLength: 20, sourceDiameter: 20, demagnification: 100,
  energySpread: 1, chromaticCoefficient: 20, sphericalCoefficient: 50,
  gasDiameter: 0.37, electronCrossSection: 1e-20, columnLength: 0.3,
  secondaryYield: 0.2, photonYield: 20, opticalEfficiency: 0.1,
  quantumEfficiency: 0.2, pmtReferenceGain: 1e5, pmtGainExponent: 7,
  excessNoiseFactor: 1.4, darkRate: 100, readNoiseElectrons: 2e6,
  flyback: 80, settleTime: 5000, roughingSpeed: 1.2, roughingBase: 1e-2,
  turboBase: 1e-7, turboCrossover: 0.1,
  // Electrical-view geometry and hot winding resistances: illustrative defaults.
  gunGap: 20, anodeApertureGap: 20, apertureBias: 0,
  heaterResistance: 1.5, lensResistance: 8,
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const nonnegative = (v, fallback) => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : fallback;
const positive = (v, fallback) => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback;
const finite = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;

/** Numeric API units match DEFAULTS. Unknown extra keys survive normalization. */
export function normalize(params = {}) {
  const p = { ...DEFAULTS, ...params };
  Object.assign(p,normalizeScanHardware(params));
  for (const key of Object.keys(DEFAULTS)) {
    if (typeof DEFAULTS[key] === 'number') p[key] = finite(p[key], DEFAULTS[key]);
  }
  for (const key of ['voltage','plateGap','workingDistance','chamberVolume','ambientTemperature',
    'radiatingArea','apertureBeamSigma','lensLength','demagnification','gasDiameter']) {
    p[key] = positive(p[key], DEFAULTS[key]);
  }
  for (const key of ['heaterPower','aperture','pumpSpeed','conductance','gasLoad','pressure','dwell',
    'plateLength','emissivity','thermalConductance','emittingArea','workFunction','richardsonConstant',
    'sourceDiameter','energySpread','chromaticCoefficient','sphericalCoefficient','electronCrossSection',
    'columnLength','secondaryYield','photonYield','opticalEfficiency','quantumEfficiency','pmtVoltage',
    'pmtReferenceGain','pmtGainExponent','excessNoiseFactor','darkRate','readNoiseElectrons',
    'flyback','settleTime','roughingSpeed','roughingBase','turboBase','turboCrossover']) {
    p[key] = nonnegative(p[key], DEFAULTS[key]);
  }
  p.emissivity = clamp(p.emissivity, 0, 1);
  p.opticalEfficiency = clamp(p.opticalEfficiency, 0, 1);
  p.quantumEfficiency = clamp(p.quantumEfficiency, 0, 1);
  p.resolution = Math.round(clamp(p.resolution, 1, 4096));
  const bseParams = normalizeBSE(p);
  for (const key of Object.keys(BSE_DEFAULTS)) p[key] = bseParams[key];
  const currentParams = normalizeCurrent(p);
  for (const key of Object.keys(CURRENT_DEFAULTS)) p[key] = currentParams[key];
  p.detectorMode = ['et','bse','current'].includes(p.detectorMode) ? p.detectorMode : 'current';
  return p;
}

/** Radiation + heat flow through supports. Steady state, not a filament rating. */
function filamentTemperature(p) {
  if (p.heaterPower === 0) return p.ambientTemperature;
  const a = p.emissivity * CONSTANTS.sigma * p.radiatingArea;
  if (a === 0 && p.thermalConductance === 0) return Infinity;
  const loss = (t) => a * (t ** 4 - p.ambientTemperature ** 4)
    + p.thermalConductance * (t - p.ambientTemperature);
  let lo = p.ambientTemperature, hi = Math.max(3000, lo * 2);
  while (loss(hi) < p.heaterPower && hi < 1e7) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (loss(mid) < p.heaterPower) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function lensFocusCurrent(p, momentum) {
  // First focus branch: x*tan(x) = lensLength / total post-lens drift, x in (0,pi/2).
  let lo = 0, hi = Math.PI / 2 - 1e-9;
  const ratio = p.lensLength / (p.plateLength + p.workingDistance);
  for (let i = 0; i < 32; i++) {
    const x = (lo + hi) / 2;
    if (x * Math.tan(x) < ratio) lo = x; else hi = x;
  }
  return ((lo + hi) / 2) * 2 * momentum / (CONSTANTS.e * CONSTANTS.mu0 * Math.abs(p.lensTurns || 1));
}

export function calculate(params = {}) {
  const p = normalize(params);
  const {e,m,h,c,k,mu0} = CONSTANTS;
  const volts = p.voltage * 1000, energy = e * volts;
  const gamma = 1 + energy / (m * c * c);
  const momentum = Math.sqrt(energy * (energy + 2 * m * c * c)) / c;
  const speed = momentum / (gamma * m);
  const wavelength = h / momentum * 1e12;
  const temperature = filamentTemperature(p);
  const currentDensity = Number.isFinite(temperature)
    ? p.richardsonConstant * temperature ** 2 * Math.exp(-p.workFunction * e / (k * temperature)) : 0;
  const emission = currentDensity * p.emittingArea * 1e6;
  // Integrate a circularly symmetric Gaussian current profile over the aperture.
  const apertureTransmission = -Math.expm1(-0.5 * (p.aperture / 2 / p.apertureBeamSigma) ** 2);
  // Explicit surrogate, not an electrostatic gun solve or a universal Wehnelt law.
  const extraction = clamp((p.wehnelt + 300) / 300, 0, 1) ** 2;
  const pressurePa = p.pressure * 100, numberDensity = pressurePa / (k * p.ambientTemperature);
  const meanFreePath = numberDensity > 0 ? 1 / (Math.SQRT2 * Math.PI * (p.gasDiameter * 1e-9) ** 2 * numberDensity) : Infinity;
  const electronMeanFreePath = numberDensity * p.electronCrossSection > 0
    ? 1 / (numberDensity * p.electronCrossSection) : Infinity;
  const survival = Math.exp(-p.columnLength / electronMeanFreePath);
  const beamCurrent = emission * 1000 * apertureTransmission * extraction * survival;
  const field = p.plateVoltage / (p.plateGap * 1e-3);
  const plateLength = p.plateLength * 1e-3, drift = p.workingDistance * 1e-3;
  // The ideal plate assembly begins at the lens exit. workingDistance is the gap
  // from plate exit to specimen; magnetic focusing traverses the full L + D.
  const lensDriftDistance = p.plateLength + p.workingDistance;
  const lensDrift = lensDriftDistance * 1e-3;
  // Vd=V(+x plate)-V(-x plate), so E_x=-Vd/g and electron displacement is +x.
  const deflectionPerVolt = e * plateLength * (drift + plateLength / 2)
    / (p.plateGap * 1e-3 * momentum * speed) * 1000;
  const deflection = p.plateVoltage * deflectionPerVolt;
  const scanFieldWidth = 2 * Math.abs(p.scanAmplitude) * deflectionPerVolt;
  const scanHardware = calculateScanHardware(p,deflectionPerVolt);
  const magneticField = mu0 * p.lensTurns * p.lensCurrent / (p.lensLength * 1e-3) * 1000;
  const kappa = e * Math.abs(magneticField * 1e-3) / (2 * momentum);
  const lensPhase = kappa * p.lensLength * 1e-3;
  const sin = Math.sin(lensPhase), cos = Math.cos(lensPhase);
  const focalLength = Math.abs(kappa * sin) > 1e-14 ? 1000 / (kappa * sin) : Infinity;
  const backFocalLength = Math.abs(kappa * sin) > 1e-14 ? 1000 * cos / (kappa * sin) : Infinity;
  const alpha = p.aperture * 1e-6 / (2 * lensDrift);
  const sourceSize = p.sourceDiameter * 1000 / p.demagnification;
  const diffraction = alpha > 0 ? 0.61 * wavelength * 1e-3 / alpha : Infinity;
  const chromatic = p.chromaticCoefficient * 1e6 * alpha * p.energySpread / volts;
  const spherical = 0.5 * p.sphericalCoefficient * 1e6 * alpha ** 3;
  const defocus = p.aperture * 1000 * Math.abs(cos - lensDrift * kappa * sin);
  const spotSize = Math.hypot(sourceSize, diffraction, chromatic, spherical, defocus);
  const effectiveSpeed = p.pumpSpeed > 0 && p.conductance > 0
    ? 1 / (1 / p.pumpSpeed + 1 / p.conductance) : 0;
  const equilibriumPressure = effectiveSpeed ? p.turboBase + p.gasLoad / effectiveSpeed : Infinity;
  const pumpTimeConstant = effectiveSpeed ? p.chamberVolume / effectiveSpeed : Infinity;
  const retraceCount = p.scanMode === 'raster' ? p.resolution : 1;
  let frameTime = (p.resolution ** 2 * (p.dwell + p.settleTime) + retraceCount * p.flyback) * 1e-6;
  const current = calculateCurrent(p, { beamCurrentnA: beamCurrent });
  const exposureTimeUs = p.detectorMode === 'current' ? current.pixelTimeUs : p.dwell;
  const electronCount = beamCurrent * 1e-9 * exposureTimeUs * 1e-6 / e;
  const collectionEfficiency = 0.05 + 0.65 * (1 - Math.exp(-Math.max(0,p.collectionBias) / 100));
  const collectedSecondaries = electronCount * p.secondaryYield * collectionEfficiency;
  const detectedElectrons = collectedSecondaries * p.photonYield * p.opticalEfficiency * p.quantumEfficiency;
  const pmtGain = p.pmtReferenceGain * (p.pmtVoltage / 800) ** p.pmtGainExponent;
  const darkCount = p.darkRate * p.dwell * 1e-6;
  const readNoise = pmtGain > 0 ? p.readNoiseElectrons / pmtGain : Infinity;
  // Compound Poisson: primary -> SE -> scintillator -> photoelectrons. Both stages fluctuate.
  const pePerSecondary = p.photonYield * p.opticalEfficiency * p.quantumEfficiency;
  const countVariance = detectedElectrons * (1 + pePerSecondary);
  const noiseVariance = p.excessNoiseFactor * (countVariance + darkCount) + readNoise ** 2;
  const etSnr = noiseVariance > 0 ? detectedElectrons / Math.sqrt(noiseVariance) : 0;
  const bse = calculateBSE(p, { beamCurrentnA: beamCurrent });
  if (p.detectorMode === 'current') frameTime = current.frameTimeS;
  const snr = p.detectorMode === 'current' ? current.snr : p.detectorMode === 'bse' ? bse.snr : etSnr;
  const pixelPitch = scanFieldWidth > 0 ? scanFieldWidth * 1000 / p.resolution : 0;
  // Fluence is undefined for stationary point exposure; return null, not invented pixel area.
  const dose = pixelPitch > 0 ? electronCount / pixelPitch ** 2 : null;
  const pmtAnodeCurrent = p.dwell > 0 ? detectedElectrons * e * pmtGain / (p.dwell * 1e-6) * 1e6 : 0;
  const notes = [
    'Educational model: field shapes, source geometry and detector efficiencies are assumed; the specimen image is synthetic.',
    'The scan plates generate an electric field. The lens coil generates the magnetic field.',
    'Gas mean free path describes neutral molecules; electron transmission uses a separate assumed cross section.',
  ];
  if (p.pressure > 1e-4) notes.push('Pressure exceeds the demonstration emission permit (10⁻⁴ mbar). Use the pump sequence first.');
  if (temperature > 3000) notes.push('Filament model exceeds 3000 K. Actual filament limits depend on the gun and heater design.');
  if (Math.abs(p.plateVoltage) / volts > 0.1) notes.push('Large plate/acceleration voltage ratio: the small-angle deflection approximation may be inaccurate.');
  if (lensPhase > Math.PI / 2) notes.push('Lens is past its first internal focus; back focal distance may be negative.');
  if (Math.abs(deflection) > scanFieldWidth / 2 && scanFieldWidth > 0) notes.push('Static plate offset moves the beam beyond half of the nominal scan width.');
  if (p.detectorMode === 'et' && pmtAnodeCurrent > 100) notes.push('Illustrative PMT anode current exceeds 100 µA; a real PMT may saturate. Check its specified current and divider limits.');
  if (p.detectorMode === 'bse') notes.push(...bse.notes);
  if (p.detectorMode === 'current') notes.push(...current.notes);
  return { speed,wavelength,temperature,emission,beamCurrent,field,deflection,magneticField,
    focalLength,backFocalLength,spotSize,meanFreePath,survival,effectiveSpeed,equilibriumPressure,
    frameTime,pmtGain,snr,etSnr,bse,current,detectorMode:p.detectorMode,dose,notes,gamma,momentum,kineticEnergy:volts,alpha,scanFieldWidth,
    sourceSize,electronCount,exposureTimeUs,detectedElectrons,collectedSecondaries,collectionEfficiency,
    apertureTransmission,extraction,electronMeanFreePath,pumpTimeConstant,diffraction,
    chromatic,spherical,defocus,kappa,lensPhase,lensDriftDistance,pixelPitch,pmtAnodeCurrent,currentDensity,retraceCount,
    darkCount,noiseVariance,scanHardware,focusCurrent:lensFocusCurrent(p,momentum),params:p,
  };
}

/** Exact constant-coefficient chamber balance over dt seconds; no accelerated clock. */
export function updatePressure(pressure, dt, options = {}) {
  const p = normalize(options);
  const current = nonnegative(pressure, DEFAULTS.pressure);
  const elapsed = nonnegative(dt, 0);
  const turboAvailable = !!options.turbo && !!options.roughing && current <= p.turboCrossover;
  let speed = 0, base = 0;
  if (turboAvailable) {
    speed = p.pumpSpeed > 0 && p.conductance > 0 ? 1 / (1 / p.pumpSpeed + 1 / p.conductance) : 0;
    base = p.turboBase;
  } else if (options.roughing) {
    speed = p.roughingSpeed > 0 && p.conductance > 0 ? 1 / (1 / p.roughingSpeed + 1 / p.conductance) : 0;
    base = p.roughingBase;
  }
  if (speed === 0) return Math.min(1013.25, current + p.gasLoad * elapsed / p.chamberVolume);
  // Do not invent a reverse gas flow from a running pump when chamber is below its base.
  if (current < base) return Math.min(base, current + p.gasLoad * elapsed / p.chamberVolume);
  const equilibrium = base + p.gasLoad / speed;
  return Math.min(1013.25, Math.max(0, equilibrium + (current - equilibrium) * Math.exp(-elapsed * speed / p.chamberVolume)));
}

const f = (v, digits = 3) => v === null ? 'undefined' : !Number.isFinite(v) ? '∞' : (v !== 0 && (Math.abs(v) < 0.001 || Math.abs(v) >= 1e5)) ? v.toExponential(digits-1) : Number(v.toPrecision(digits)).toString();
const S = {
  relativity: {label:'OpenStax · University Physics III §5.9, relativistic energy',url:'https://openstax.org/books/university-physics-volume-3/pages/5-9-relativistic-energy'},
  wavelength: {label:'JEOL · Wavelength of electron, equations and Table 1',url:'https://www.jeol.com/words/emterms/20121023.071258.php'},
  heat: {label:'OpenStax · University Physics II §1.6, radiation and conduction',url:'https://openstax.org/books/university-physics-volume-2/pages/1-6-mechanisms-of-heat-transfer'},
  emission: {label:'Vacuum 77 (2004), pp. 19–26 · Tungsten thermionic hairpin cathode',url:'https://doi.org/10.1016/j.vacuum.2004.07.066'},
  gun: {label:'JEOL · Thermionic-emission gun, cathode and Wehnelt bias',url:'https://www.jeol.com/words/semterms/20121024.071558.php'},
  electric: {label:'OpenStax · University Physics II §7.2, uniform field and voltage',url:'https://openstax.org/books/university-physics-volume-2/pages/7-2-electric-potential-and-potential-difference'},
  solenoid: {label:'OpenStax · University Physics II §12.6, solenoid field',url:'https://openstax.org/books/university-physics-volume-2/pages/12-6-solenoids-and-toroids'},
  lens: {label:'Baartman · CERN CAS 2018 §2.1, Eq. 7, solenoid motion',url:'https://e-publishing.cern.ch/index.php/CYRSP/article/download/640/668/3747#page=4'},
  probe: {label:'JEOL · Electron-probe diameter, quadrature of aberrations',url:'https://www.jeol.com/words/semterms/20121024.063858.php'},
  vacuum: {label:'Pfeiffer · Leak Detection Compendium §2.3.3, Formula 2-2',url:'https://www.pfeiffer-vacuum.com/media/documents/leak-detection-know-how/leak-detection-compendium-pfeiffer-vacuum.pdf#page=13'},
  throughput: {label:'Pfeiffer · Vacuum fundamentals §1.2.7, Q = Sp',url:'https://www.pfeiffervacuum.com/global/en/knowledge/vacuum-technology/knowledge-book/1-introduction/1_2_fundamentals/'},
  gas: {label:'OpenStax · University Physics II §2.2, mean free path',url:'https://openstax.org/books/university-physics-volume-2/pages/2-2-pressure-temperature-and-rms-speed'},
  scattering: {label:'NIST · SRD 64, energy-dependent electron elastic cross sections',url:'https://www.nist.gov/publications/nist-electron-elastic-scattering-cross-section-database-version-40'},
  pmt: {label:'Hamamatsu · PMT catalog, gain and voltage dependence',url:'https://hub.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/etd/PMT_TPMZ1036E.pdf'},
  noise: {label:'Hamamatsu · Guide to Detector Selection, The noise problem, Eq. 4',url:'https://hub.hamamatsu.com/us/en/technical-notes/detector-selection/guide-to-detector-selection.html'},
  detector: {label:'JEOL · ET detector, collector → scintillator → light guide → PMT',url:'https://www.jeol.com/words/semterms/20121024.070858.php'},
};

export const EQUATIONS = [
  {id:'speed',title:'Electron energy & speed',formula:'K = eVₐ; γ = 1 + eVₐ/(mₑc²); v = c√(1 − γ⁻²)',
    substitution:(p,d)=>`Vₐ = ${f(p.voltage*1000)} V; γ = ${f(d.gamma,6)}`,
    result:(p,d)=>`${f(d.speed)} m/s · ${f(d.speed/CONSTANTS.c*100)}% of c`,
    derivation:'Work through the accelerating potential adds eVₐ of kinetic energy. Set eVₐ = (γ − 1)mₑc² and invert γ = 1/√(1 − v²/c²). The cathode is negative; Vₐ is the positive acceleration magnitude.',
    assumptions:'Electron initially at rest; negligible energy loss. The model omits space charge and accelerating-voltage ripple.',sources:[S.relativity]},
  {id:'wavelength',title:'Relativistic de Broglie wavelength',formula:'λ = h/p; p = √[2mₑeVₐ(1 + eVₐ/2mₑc²)]',
    substitution:(p,d)=>`p = ${f(d.momentum)} kg·m/s; h = 6.62607015 × 10⁻³⁴ J·s`,
    result:(p,d)=>`${f(d.wavelength,4)} pm`,
    derivation:'Expand (pc)² = (K + mₑc²)² − (mₑc²)², insert K = eVₐ, then use λ = h/p. This is wavelength, not attainable instrument resolution.',
    assumptions:'Free monoenergetic electron. Thermal energy spread appears separately in the chromatic term.',sources:[S.wavelength]},
  {id:'temperature',title:'Filament heat balance',formula:'Pₕ = εσAᵣ(T⁴ − T₀⁴) + Gₜ(T − T₀)',
    substitution:(p,d)=>`${f(p.heaterPower)} W = ${f(d.params.emissivity)} × σ × ${f(d.params.radiatingArea)} × (T⁴ − ${f(d.params.ambientTemperature)}⁴) + ${f(d.params.thermalConductance)}(T − T₀)`,
    result:(p,d)=>`${f(d.temperature,4)} K`,
    derivation:'At steady state input heater power equals thermal radiation plus conduction through supports. Net Stefan–Boltzmann loss is εσAᵣ(T⁴ − T₀⁴); linear support conductance contributes Gₜ(T − T₀). Solve the monotonic balance numerically.',
    assumptions:'Baseline: 2.2 mm² radiating area, ε = 0.35 and Gₜ = 0.25 mW/K; BOM settings can replace these values. No warm-up transient, temperature-dependent resistance or evaporation. Power is not a gun-specific heater setting.',sources:[S.heat]},
  {id:'emission',title:'Thermionic emission',formula:'J = AᴿT² exp(−φ/kᴮT); Iₑ = J Aₑ',
    substitution:(p,d)=>`J = ${f(d.params.richardsonConstant)} × ${f(d.temperature,4)}² × exp[−${f(d.params.workFunction)} / (${f(CONSTANTS.k/CONSTANTS.e,6)} × ${f(d.temperature,4)})] A/m²; Iₑ = J × ${f(d.params.emittingArea)} m²`,
    result:(p,d)=>`${f(d.emission)} µA emitted`,
    derivation:'Integrating the thermal electron flux whose normal energy exceeds the work function yields the T² exp(−φ/kᴮT) dependence. Multiply current density by the effective emitting area to obtain current. The substitution uses φ in eV and kᴮ in eV/K, so the exponent is dimensionless.',
    assumptions:'Baseline tungsten: Aᴿ = 6 × 10⁵ A·m⁻²·K⁻², φ = 4.5 eV, emitting area 10⁻¹⁰ m²; the substitution uses current BOM values. Surface state, field lowering and space-charge limitation are omitted.',sources:[S.emission]},
  {id:'beamCurrent',title:'Aperture & Wehnelt transmission',formula:'Iᵦ = Iₑ[1 − exp(−rₐ²/2s²)] · w · P₀',
    substitution:(p,d)=>`${f(d.emission)} µA × ${f(d.apertureTransmission)} aperture × ${f(d.extraction)} extraction × ${f(d.survival)} transmission; rₐ = ${f(d.params.aperture/2)} µm, s = ${f(d.params.apertureBeamSigma)} µm`,
    result:(p,d)=>`${f(d.beamCurrent)} nA specimen current`,
    derivation:'Integrate a normalized 2D Gaussian over the circular aperture: ∫₀ʳ ρ exp(−ρ²/2s²)/s² dρ = 1 − exp(−r²/2s²). The current is this fraction of the emission times extraction and gas survival.',
    assumptions:'Baseline Gaussian beam s = 500 µm; the current width comes from the BOM. The fixed w = clamp[(Vw + 300)/300, 0, 1]² is an explicitly invented teaching surrogate, not a cited universal Wehnelt law. JEOL supports the role of bias, not this transfer curve.',sources:[S.gun]},
  {id:'field',title:'Scan-plate electric field',formula:'Eₓ = −Vd/g; Fₓ = −eEₓ',
    substitution:(p,d)=>`Vd = ${f(p.plateVoltage)} V across g = ${f(p.plateGap)} mm`,
    result:(p,d)=>`${f(Math.abs(d.field))} V/m · force toward the positive plate`,
    derivation:'Use E = −∇V between parallel plates. A linear potential drop gives Eₓ = −Vd/g, with Vd defined as the +x plate potential minus the −x plate potential. The electron charge is negative.',
    assumptions:'Uniform quasi-static electric field; edge effects ignored. Scan plates are electrodes; the magnetic field shown in the column comes from the lens coil.',sources:[S.electric]},
  {id:'deflection',title:'Electrostatic scan displacement',formula:'x = eVd L(D + L/2)/(g p v)',
    substitution:(p,d)=>`L = ${f(p.plateLength)} mm; D = ${f(p.workingDistance)} mm; Vd = ${f(p.plateVoltage)} V`,
    result:(p,d)=>`${f(d.deflection)} mm offset · ${f(d.scanFieldWidth*1000)} µm full scan width`,
    derivation:'During transit L/v the transverse impulse is eVdL/(gv), giving θ = eVdL/(gpv). The plate contributes θL/2 and the following drift contributes θD. Their sum is x. Full scan width uses Vd = ±scan amplitude.',
    assumptions:'Paraxial, constant longitudinal momentum, plates followed by field-free drift D. No post-plate lens, fringe field, scan distortion or coupling. At low energy pv ≈ 2eVₐ.',sources:[S.electric,S.relativity]},
  {id:'magneticField',title:'Lens-coil magnetic field',formula:'Bz ≈ μ₀ N I / ℓ',
    substitution:(p,d)=>`μ₀ × ${f(d.params.lensTurns)} turns × ${f(p.lensCurrent)} A / ${f(d.params.lensLength)} mm`,
    result:(p,d)=>`${f(d.magneticField)} mT axial field`,
    derivation:'Apply Ampère’s law to a long solenoid: Bℓ = μ₀NI. Here the result defines the uniform axial field of a simplified lens, including its current polarity.',
    assumptions:'Air-core solenoid approximation. Baseline: 452 turns and 20 mm length; the substitution uses current BOM values. Actual pole pieces, permeability, finite-coil fringe fields and saturation require a measured or solved field map.',sources:[S.solenoid]},
  {id:'focalLength',title:'Magnetic focusing',formula:'κ = e|B|/(2p); f = 1/[κ sin(κℓ)]; b = cot(κℓ)/κ',
    substitution:(p,d)=>`κ = ${f(d.kappa)} m⁻¹; κℓ = ${f(d.lensPhase)} rad`,
    result:(p,d)=>`f = ${f(d.focalLength)} mm · back focus b = ${f(d.backFocalLength)} mm; specimen at ${f(d.lensDriftDistance)} mm`,
    derivation:'Solve r″ + κ²r = 0 in the Larmor frame. A parallel input ray exits at r = r₀ cos(κℓ), r′ = −κr₀ sin(κℓ). Thus f = −r₀/r′ and the following drift to the axis is b = −r/r′. For κℓ ≪ 1, 1/f ≈ e²∫B²dz/(4p²).',
    assumptions:'Hard-edge paraxial transfer, initially parallel beam. The plate assembly starts at the coil exit; specimen distance is plate length + post-plate drift. Effective focal length differs from back focus. Real lens aberrations require field geometry; Cs and Cc are separate assumptions.',sources:[S.lens]},
  {id:'spotSize',title:'Probe-size budget',formula:'d² ≈ d₀² + (0.61λ/α)² + (Csα³/2)² + (CcαΔE/E)² + d𝒇²',
    substitution:(p,d)=>`√(${f(d.sourceSize)}² + ${f(d.diffraction)}² + ${f(d.spherical)}² + ${f(d.chromatic)}² + ${f(d.defocus)}²) nm`,
    result:(p,d)=>`${f(d.spotSize)} nm · illustrative probe diameter`,
    derivation:'Use the conventional quadrature estimate for source, diffraction and lens aberration contributions. Add geometric defocus from the solenoid transfer: d𝒇 = aperture × |cos(κℓ) − Hκsin(κℓ)|. Here H = plate length + post-plate drift and α = aperture/(2H).',
    assumptions:'Baseline: source 20 µm/100 demagnification, Cs = 50 mm, Cc = 20 mm, ΔE = 1 eV; the budget uses current BOM values. An approximate diameter convention, not a predicted SEM resolution; specimen scattering, drift and astigmatism are absent.',sources:[S.probe]},
  {id:'effectiveSpeed',title:'Effective pumping speed',formula:'1/Seff = 1/S + 1/C',
    substitution:(p,d)=>`1/Seff = 1/${f(p.pumpSpeed)} + 1/${f(p.conductance)} (s/L)`,
    result:(p,d)=>`${f(d.effectiveSpeed)} L/s`,
    derivation:'Steady throughput Q is the same through pump and connecting line: Q = Spᵢ = C(pch − pᵢ). Eliminate inlet pressure pᵢ and define Seff = Q/pch.',
    assumptions:'Constant molecular-flow conductance and pump speed; this is the available turbo pumping speed, not the current valve state.',sources:[S.vacuum]},
  {id:'pressure',title:'Pump-down & gas load',formula:'V dp/dt = Q − Seff(p − pb); p∞ = pb + Q/Seff',
    substitution:(p,d)=>`p∞ = ${f(d.params.turboBase)} + ${f(p.gasLoad)}/${f(d.effectiveSpeed)} mbar`,
    result:(p,d)=>`${f(d.equilibriumPressure)} mbar floor · τ = ${f(d.pumpTimeConstant)} s`,
    derivation:'At fixed volume and temperature, gas inventory is proportional to pV. Inflow Q minus pump throughput gives the differential equation. Constant Q and Seff give p(t) = p∞ + (p₀ − p∞)exp(−Seff t/V).',
    assumptions:'Q includes leaks/outgassing. Baseline piecewise pump settings: roughing base 10⁻² mbar, turbo base 10⁻⁷ mbar, crossover 0.1 mbar with backing pump on. BOM settings can replace these teaching assumptions; real desorption takes longer.',sources:[S.throughput]},
  {id:'meanFreePath',title:'Neutral-gas mean free path',formula:'λg = kᴮTg/(√2 π d² p)',
    substitution:(p,d)=>`Tg = ${f(d.params.ambientTemperature)} K; d = ${f(d.params.gasDiameter)} nm; p = ${f(p.pressure*100)} Pa`,
    result:(p,d)=>`${f(d.meanFreePath)} m · neutral molecules`,
    derivation:'Hard-sphere molecules collide over cross section πd². Thermal relative motion introduces √2. Insert ideal-gas number density n = p/(kᴮTg) into λg = 1/(√2πd²n).',
    assumptions:'Baseline: air-like neutral gas with 0.37 nm collision diameter at room temperature. The substitution uses the current gas diameter and ambient temperature. This is not the electron mean free path.',sources:[S.gas]},
  {id:'survival',title:'Electron transmission through gas',formula:'n = p/(kᴮTg); λe = 1/(nσe); P₀ = exp(−Lcol/λe)',
    substitution:(p,d)=>`σe = ${f(d.params.electronCrossSection)} m² assumed; Lcol = ${f(d.params.columnLength)} m`,
    result:(p,d)=>`${f(d.survival*100,4)}% unscattered · λe = ${f(d.electronMeanFreePath)} m`,
    derivation:'For independent collisions, dP₀/dz = −nσeP₀. Integrating over the column gives exponential transmission. The fast beam sees approximately stationary gas targets, so no neutral-gas √2 factor is used.',
    assumptions:'Baseline constant σe = 10⁻²⁰ m²; the current value comes from the BOM and is not sourced from NIST. Real cross sections depend on beam energy and gas species, as the linked NIST database demonstrates; this proxy is not calibrated.',sources:[S.scattering,S.gas]},
  {id:'frameTime',title:'Minimum scan timing',formula:'tmin = N²(tdwell + tsettle) + R tflyback',
    substitution:(p,d)=>`${f(p.resolution)}² × (${f(p.dwell)} + ${f(d.params.settleTime)}) µs + ${f(d.retraceCount)} × ${f(d.params.flyback)} µs`,
    result:(p,d)=>`${f(d.frameTime)} s/frame minimum`,
    derivation:'Count N² sampled points, each with dwell and settling time. Raster adds N line-retrace intervals; other presets add one end-of-frame retrace (R = 1). This is direct lower-bound time accounting.',
    assumptions:'Baseline: 8 µs settling and 80 µs retrace; the substitution uses current BOM timing. Excludes SPI transfers, ADC conversion, software and serial transport. Custom paths use N² timing slots including blank points; actual arbitrary-program duration requires measurement.',sources:[S.detector]},
  {id:'dose',title:'Electron count & fluence',formula:'Ne = Iᵦ texposure/e; D = Ne/(FOV/N)²',
    substitution:(p,d)=>`${f(d.beamCurrent)} nA × ${f(d.exposureTimeUs)} µs / e; pixel pitch ${f(d.pixelPitch)} µm`,
    result:(p,d)=>`${f(d.electronCount)} e⁻/pixel · ${f(d.dose)} e⁻/µm²`,
    derivation:'Current is charge per time. Divide the integrated pixel charge by elementary charge to count primary electrons. Divide by square pixel area for raster fluence.',
    assumptions:'One uniformly sampled square frame. Current mode includes beam-on settling and the ADC-limited acquisition window in exposure; legacy modes use dwell. Blanked points receive no exposure; this uniform estimate assumes unblanked pixels. Revisited positions accumulate additional dose; arbitrary custom trajectories are not necessarily uniform. Zero scan width has undefined areal fluence.',sources:[S.electric]},
  {id:'collection',title:'Secondary-electron signal chain',formula:'Npe = Ne · δSE · ηc · Yγ · ηopt · QE',
    substitution:(p,d)=>`${f(d.electronCount)} × ${f(d.params.secondaryYield)} × ${f(d.collectionEfficiency)} × ${f(d.params.photonYield)} × ${f(d.params.opticalEfficiency)} × ${f(d.params.quantumEfficiency)}`,
    result:(p,d)=>`${f(d.detectedElectrons)} photoelectrons/pixel`,
    derivation:'Count secondary electrons produced, their collected fraction, scintillator photons per collected electron, transmitted light and photocathode quantum efficiency. Multiplying these stages yields mean photoelectron count.',
    assumptions:'Baseline synthetic efficiencies: δSE = 0.2, Yγ = 20, ηopt = 0.1, QE = 0.2; the substitution uses current BOM values. The fixed ηc = 0.05 + 0.65(1 − exp(−max(Vc,0)/100)) is an invented collection trend. The collector cage and scintillator bias are separate from PMT bias; PMT detects light.',sources:[S.detector]},
  {id:'pmtGain',title:'Photomultiplier gain',formula:'G = δdynⁿ ∝ VPMTᵃⁿ; G = G₀(VPMT/800 V)^β',
    substitution:(p,d)=>`${f(d.params.pmtReferenceGain)} × (${f(d.params.pmtVoltage)}/800)^${f(d.params.pmtGainExponent)}; β = ${f(d.params.pmtGainExponent)}`,
    result:(p,d)=>`${f(d.pmtGain)}× gain · ${f(d.pmtAnodeCurrent)} µA mean anode current`,
    derivation:'Each dynode multiplies the incident electrons by δdyn. Cascading n stages gives δdynⁿ. With δdyn proportional to interstage voltage to a power a, a fixed divider gives G proportional to VPMTᵃⁿ. The fitted exponent β = an and reference gain G₀ come from the current BOM settings; 800 V is the fixed reference voltage. Anode current is eGNpe/tdwell.',
    assumptions:'Baseline calibration: G₀ = 10⁵ at 800 V, exponent 7; the substitution uses current gain and exponent settings. Real tube/divider gain, permitted voltage and current require its datasheet. Saturation is flagged but not modeled.',sources:[S.pmt]},
  {id:'snr',title:'Signal-to-noise estimate',formula:'SNR = Npe / √[F{Npe(1 + q) + Nd} + (σread/G)²]',
    substitution:(p,d)=>`${f(d.detectedElectrons)} / √(${f(d.noiseVariance)}); F = ${f(d.params.excessNoiseFactor)}, q = ${f(d.params.photonYield*d.params.opticalEfficiency*d.params.quantumEfficiency)}, Nd = ${f(d.darkCount)}, σread = ${f(d.params.readNoiseElectrons)} e⁻, G = ${f(d.pmtGain)}`,
    result:(p,d)=>`${f(d.snr)} : 1`,
    derivation:'Poisson SE arrivals and Poisson photoelectron yield per SE form a compound process with variance Npe(1 + q). PMT excess noise F scales count variance; dark-count variance adds. Refer amplifier charge noise back through gain, then divide mean signal by RMS noise.',
    assumptions:'Baseline: F = 1.4, dark rate 100/s, output read noise 2 × 10⁶ electrons/sample; the substitution uses current BOM noise settings. Counts, efficiencies and independent fluctuations are assumed. PMT gain reduces read-noise impact; it does not remove shot noise.',sources:[S.noise]},
];
