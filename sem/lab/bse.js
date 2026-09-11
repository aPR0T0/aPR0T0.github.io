import { detectorPlacement, tiltedDetectorSolidAngle } from './detector-geometry.js';
/** S11141-10 + ideal transimpedance front end. A design estimate, not a circuit solve. */
export const BSE_DEFAULTS = Object.freeze({
  detectorDistance: 5, detectorOffset: 0, detectorTilt: 0, detectorMargin: 2, detectorBeamAllowance: .25, detectorBias: 5, bseYield: .2, bseEnergyFraction: .7,
  bseAcceptance: .8, tiaResistance: 10, tiaCapacitance: 5,
  tiaInputNoise: .1, tiaVoltageNoise: 5, adcFullScale: 3.1,
});
export const BSE_ADC_OFFSET_V = .15;

export const BSE_PARAMETER_SCHEMA = Object.freeze({
  detectorDistance: { min: .1, max: 100, unit: 'mm', label: 'Detector centre height' },
  detectorOffset: { min: 0, max: 50, unit: 'mm', label: 'Detector lateral offset' },
  detectorTilt: { min: 0, max: 85, unit: '°', label: 'Detector face tilt' },
  detectorMargin: { min: 0, max: 10, unit: 'mm', label: 'Mounting allowance' },
  detectorBeamAllowance: { min: 0, max: 5, unit: 'mm', label: 'Beam radius and alignment allowance' },
  detectorBias: { min: 0, max: 5, unit: 'V', label: 'Detector reverse bias' },
  bseYield: { min: 0, max: 1, unit: '', label: 'Assumed BSE yield' },
  bseEnergyFraction: { min: 0, max: 1, unit: '', label: 'Assumed BSE energy fraction' },
  bseAcceptance: { min: 0, max: 1, unit: '', label: 'Unobstructed acceptance' },
  tiaResistance: { min: .01, max: 1000, unit: 'MΩ', label: 'TIA feedback resistance' },
  tiaCapacitance: { min: .1, max: 1000, unit: 'pF', label: 'TIA feedback capacitance' },
  tiaInputNoise: { min: 0, max: 100, unit: 'pA/√Hz', label: 'Assumed amplifier current noise' },
  tiaVoltageNoise: { min: 0, max: 1000, unit: 'nV/√Hz', label: 'Assumed amplifier voltage noise' },
  adcFullScale: { min: .1, max: 10, unit: 'V', label: 'Readout clipping ceiling' },
});

const e = 1.602176634e-19, k = 1.380649e-23;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeBSE(params = {}) {
  const p = { ...params };
  for (const [key, rule] of Object.entries(BSE_PARAMETER_SCHEMA)) {
    p[key] = clamp(finite(params[key], BSE_DEFAULTS[key]), rule.min, rule.max);
  }
  return p;
}

/** On-axis point source: 10×10 mm square minus its centered 2 mm diameter hole. */
export function detectorSolidAngle(distanceMm) {
  if (!Number.isFinite(distanceMm) || distanceMm <= 0) throw new RangeError('Detector distance must be positive.');
  const d = distanceMm, halfSide = 5, holeRadius = 1;
  const square = 4 * Math.atan(halfSide ** 2 / (d * Math.sqrt(d ** 2 + 2 * halfSide ** 2)));
  const hole = 2 * Math.PI * (1 - d / Math.sqrt(d ** 2 + holeRadius ** 2));
  return Math.max(0, square - hole);
}

/**
 * Input current is the primary beam arriving at the specimen, in nA.
 * beamOn=false removes beam signal while leaving biased-detector dark current.
 * null signal/output means the assumed mean electron energy is uncharacterized;
 * it must not be presented as a measured zero or extrapolated detector response.
 */
export function calculateBSE(params = {}, { beamCurrentnA = 0, beamOn = true } = {}) {
  const p = normalizeBSE(params);
  const primaryEnergykeV = Math.max(0, finite(p.voltage, 3));
  const meanEnergykeV = primaryEnergykeV * p.bseEnergyFraction;
  const energySupported = meanEnergykeV >= 1 && meanEnergykeV <= 30;
  const placement = detectorPlacement(p);
  // Legacy centred configurations retain their original on-axis collection estimate.
  const solidAngleSr = tiltedDetectorSolidAngle(p, placement.side ? placement.scan.centre : 0, 0);
  const collectionFraction = clamp(solidAngleSr / (2 * Math.PI) * p.bseAcceptance, 0, 1);
  const specimenCurrentnA = beamOn ? Math.max(0, finite(beamCurrentnA, 0)) : 0;
  const incidentCurrentnA = specimenCurrentnA * p.bseYield * collectionFraction;
  // Efficiency is a constant teaching assumption anchored at the 1.5 keV datum.
  // The manufacturer's efficiency curve is energy dependent; it is not fitted here.
  const chargeEfficiency = .72;
  const chargeGain = energySupported ? meanEnergykeV * 1000 / 3.62 * chargeEfficiency : null;
  const generatedCurrentnA = incidentCurrentnA === 0 ? 0 : chargeGain === null ? null : incidentCurrentnA * chargeGain;
  // Explicit interpolation of typical 25°C datasheet anchor points, not a diode fit.
  // At exactly zero applied bias the mean external dark current is zero; Johnson noise remains.
  const darkCurrentnA = p.detectorBias <= .01
    ? .5 * p.detectorBias / .01 : .5 + 4.5 * (p.detectorBias - .01) / 4.99;
  const detectorCapacitancepF = 1700 + (450 - 1700) * p.detectorBias / 5;
  const resistanceOhm = p.tiaResistance * 1e6;
  const feedbackCapacitanceF = p.tiaCapacitance * 1e-12;
  const signalVoltageV = generatedCurrentnA === null ? null : generatedCurrentnA * 1e-9 * resistanceOhm;
  const darkOffsetV = darkCurrentnA * 1e-9 * resistanceOhm;
  const rawOutputV = signalVoltageV === null ? null : signalVoltageV + darkOffsetV;
  // Compatibility estimate only; explicit rawOutputV is the demanded TIA output.
  const outputV = rawOutputV === null ? null : clamp(rawOutputV, 0, p.adcFullScale);
  const adcOffsetV = BSE_ADC_OFFSET_V;
  const adcInputV = rawOutputV === null ? null : rawOutputV + adcOffsetV;
  const adcOutputV = adcInputV === null ? null : clamp(adcInputV, 0, p.adcFullScale);
  const tiaFullScaleV = Math.max(0, p.adcFullScale - adcOffsetV);
  const saturated = adcInputV !== null && adcInputV >= p.adcFullScale;
  const headroomV = adcInputV === null ? null : p.adcFullScale - adcInputV;
  const timeConstantUs = resistanceOhm * feedbackCapacitanceF * 1e6;
  const bandwidthHz = 1 / (2 * Math.PI * resistanceOhm * feedbackCapacitanceF);
  const settlingTimeUs = Math.log(100) * timeConstantUs;
  const dwellUs = Math.max(0, finite(p.dwell, 20));
  const settled = dwellUs >= settlingTimeUs;
  const stepFraction = -Math.expm1(-dwellUs / timeConstantUs);
  // Approximate rectangular noise bandwidth: the smaller of the RC equivalent
  // bandwidth and ideal boxcar averaging bandwidth. No sampled aliasing model.
  const noiseBandwidthHz = Math.min(1 / (4 * resistanceOhm * feedbackCapacitanceF),
    dwellUs > 0 ? 1 / (2 * dwellUs * 1e-6) : Infinity);
  const temperatureK = 298.15;
  // Near-zero-bias estimate 10mV/0.5nA. Held constant here as an explicit assumption.
  const detectorShuntResistanceMOhm = 20;
  const thermalPSD = 4 * k * temperatureK * (1 / resistanceOhm + 1 / (detectorShuntResistanceMOhm * 1e6));
  const amplifierCurrentPSD = (p.tiaInputNoise * 1e-12) ** 2;
  // An incident BSE creates one correlated packet of G charge carriers. Using
  // 2e*Igenerated would falsely treat those carriers as independent events.
  const eventPSD = incidentCurrentnA === 0 ? 0 : chargeGain === null ? null
    : 2 * e * incidentCurrentnA * 1e-9 * chargeGain ** 2;
  const darkPSD = 2 * e * darkCurrentnA * 1e-9;
  const voltageNoiseV = p.tiaVoltageNoise * 1e-9;
  const inputConductance = 1 / resistanceOhm + 1 / (detectorShuntResistanceMOhm * 1e6);
  const inputCapacitanceF = (detectorCapacitancepF + p.tiaCapacitance) * 1e-12;
  const voltageNoiseVarianceA2 = voltageNoiseV ** 2 * (inputConductance ** 2 * noiseBandwidthHz
    + (2 * Math.PI * inputCapacitanceF) ** 2 * noiseBandwidthHz ** 3 / 3);
  const electronicsVarianceA2 = (thermalPSD + amplifierCurrentPSD + darkPSD) * noiseBandwidthHz + voltageNoiseVarianceA2;
  const noiseRmsnA = eventPSD === null ? null : Math.sqrt(electronicsVarianceA2 + eventPSD * noiseBandwidthHz) * 1e9;
  const electronicsNoiseRmsnA = Math.sqrt(electronicsVarianceA2) * 1e9;
  const linearSnr = generatedCurrentnA !== null && noiseRmsnA > 0 && dwellUs > 0 ? generatedCurrentnA / noiseRmsnA : 0;
  // SNR is the modeled linear signal/noise ratio, not a promise of usable image contrast.
  const snr = linearSnr;
  const readoutValid = placement.valid && energySupported && !saturated && settled && dwellUs > 0;
  const incidentElectronsPerPixel = incidentCurrentnA * 1e-9 * dwellUs * 1e-6 / e;
  const notes = [
    'BSE estimate: a point source radiates isotropically into the upper hemisphere; specimen yield, mean energy and obstructions are assumptions. This is not an electron-transport calculation.',
    '72% charge efficiency is held constant as an assumption anchored at 1.5 keV. The real efficiency depends on energy. The 1–30 keV check applies to the assumed mean, not the complete BSE energy distribution.',
    'Dark current and detector capacitance interpolate typical 25°C datasheet anchors over 0–5 V. The 20 MΩ shunt-noise estimate comes from the 10 mV dark-current datum and is held constant.',
    'TIA voltages and RfCf timing assume an ideal stable amplifier. A separate ideal unity-gain conditioner adds +0.15 V before the readout ceiling; it is not a verified hardware interface. Noise uses an approximate finite bandwidth and pixel averaging; cable capacitance, 1/f noise, bias-supply noise, amplifier phase margin and ADC noise/aliasing are omitted.',
  ];
  if (!placement.valid || (placement.side && !placement.mountClear)) notes.push(placement.status + '. Geometry is not a verified assembly; adjust offset, height, tilt or allowances.');
  if (placement.side) notes.push('Side-mounted detector: the full package and bracket must clear the scanned beam. The 25×11×1 mm package envelope and mounting allowance are conservative assumptions; chamber and lens collisions are not solved.');
  if (!energySupported) notes.push('The assumed mean incident energy is outside the characterized 1–30 keV range. Detector gain and illuminated signal are unavailable; no extrapolation is used.');
  if (primaryEnergykeV > 30) notes.push('The primary energy exceeds 30 keV: part of the BSE spectrum can exceed the detector characterization even if its assumed mean is in range.');
  if (!settled) notes.push(`Dwell is shorter than the ideal 1% settling estimate (${settlingTimeUs.toFixed(1)} µs); adjacent pixels can mix.`);
  if (saturated) notes.push('Signal, dark offset and the +0.15 V conditioner reach the configured readout ceiling. Lower Rf or beam current; the ceiling is an assumed readout limit, not a validated amplifier rail or ADC protection circuit.');
  if (p.detectorDistance > Math.max(0, finite(p.workingDistance, 15))) notes.push('The selected detector distance exceeds the final working gap; check lens, scan-plate and detector clearance.');
  return { params: p, beamOn: !!beamOn, primaryEnergykeV, meanEnergykeV, energySupported,
    placement, solidAngleSr, collectionFraction, specimenCurrentnA, incidentCurrentnA, incidentElectronsPerPixel,
    chargeEfficiency, chargeGain, generatedCurrentnA, darkCurrentnA, detectorCapacitancepF,
    detectorShuntResistanceMOhm, signalVoltageV, darkOffsetV, rawOutputV, outputV,
    adcOffsetV, adcInputV, adcOutputV, tiaFullScaleV, saturated, headroomV,
    bandwidthHz, timeConstantUs, settlingTimeUs, settled, stepFraction, noiseBandwidthHz,
    noiseRmsnA, electronicsNoiseRmsnA, linearSnr, snr, readoutValid, notes };
}

export const BSE_SOURCES = Object.freeze({
  detector: { label: 'Hamamatsu · S11141-10 datasheet, pp. 1–4: dimensions, energy range, gain and electrical data', url: 'https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/s11141-10_s11142-10_kspd1083e.pdf' },
  solidAngle: { label: 'Crawford · UCRL-1753 (1953), integrated solid angle of a finite rectangular counter', url: 'https://escholarship.org/content/qt58m1f8rr/qt58m1f8rr.pdf' },
  placement: {label:'JEOL · annular and off-axis BSE detector arrangements',url:'https://www.jeol.com/words/semterms/20121023.083357.php'},
  photodiode: { label: 'Hamamatsu · Si photodiodes technical note, noise §2-4 and op-amp connections §3-1', url: 'https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/si_pd_kspd9001e.pdf' },
});
const f = (value, digits = 3) => value === null ? 'uncharacterized' : !Number.isFinite(value) ? 'undefined'
  : value !== 0 && (Math.abs(value) < .001 || Math.abs(value) >= 1e5) ? value.toExponential(digits - 1) : Number(value.toPrecision(digits)).toString();
const context = (p,d) => d?.electrical?.bse || d?.bse || calculateBSE(p, { beamCurrentnA: d?.beamCurrent || 0 });

/** Same hover/citation card interface as physics.js EQUATIONS. */
export const BSE_EQUATIONS = [
  { id: 'bseCollection', title: 'BSE geometry & collection',
    formula: 'Ω = ∫silicon max(0, n·(s−r))/|r−s|³ dA; Iinc = IbηBSE αΩ/(2π)',
    substitution: (p,d) => { const c = context(p,d); return `10×10 mm face − Ø2 mm hole; h = ${f(c.params.detectorDistance)} mm; x = ${f(c.params.detectorOffset)} mm; tilt = ${f(c.params.detectorTilt)}°; ηBSE = ${f(c.params.bseYield)}; α = ${f(c.params.bseAcceptance)}`; },
    result: (p,d) => { const c = context(p,d); return `${f(c.solidAngleSr)} sr · ${f(c.collectionFraction * 100)}% of upward BSEs · ${f(c.incidentCurrentnA)} nA reaches silicon`; },
    derivation: 'A surface patch subtends projected area divided by distance squared: dΩ = cos(ψ)dA/R². Let n point out of the sensitive face toward the specimen s, and r locate the patch. Then cos(ψ) = n·(s−r)/R. Rotate into the detector plane, integrate the rectangle analytically, and subtract the circular hole using 512 equal-area quadrature samples (exact on-axis hole expression). The centred case reduces to the previous square-minus-hole formula. Divide by 2π and multiply the assumed yield and obstruction factor.',
    assumptions: 'Flat 10×10 mm face with a 2 mm hole, one-sided sensitivity, isotropic upper-hemisphere emission and a scalar obstruction factor. Tilt is from horizontal, facing toward the beam axis. Side-mode readouts use the scan centre; image brightness includes geometric variation across the field. A face crossing the specimen plane is invalid and returns no modeled collection. Real angular emission, surface relief and obstruction shadows are not solved.', sources: [BSE_SOURCES.solidAngle, BSE_SOURCES.detector, BSE_SOURCES.placement] },
  {id:'bseClearance',title:'Side-mount beam clearance',
    formula:'cₓ = xD − (12.5 cos θ + 0.5 sin θ) − m − max(0,xscan,max) − b',
    substitution:(p,d)=>{const g=context(p,d).placement;return `xD = ${f(g.offset)} mm; θ = ${f(g.tilt)}°; m = ${f(g.margin)} mm; xscan,max = ${f(g.scan.maxX)} mm; b = ${f(g.beamAllowance)} mm`;},
    result:(p,d)=>{const g=context(p,d).placement;return g.side?`${f(g.clearance)} mm X clearance · ${g.status}`:'Centred: clearance through the hole is not solved';},
    derivation:'Project a 25×11×1 mm rectangular package envelope into X. Its half-width is 12.5 cos θ + 0.5 sin θ. Subtract this, the mounting allowance m and the rightmost scanned beam centre plus allowance b from the detector offset. Scan extrema use the same ideal relativistic plate-deflection equation as the beam model, bounded over the entire final drift. Separately require h − 12.5 sin θ − 0.5 cos θ − m > 0 for specimen-plane clearance.',
    assumptions:'Package-box orientation, bracket allowance and extra beam/alignment radius are project assumptions. Positive clearance is sufficient separation in X for this envelope, not CAD validation. Nonpositive clearance is a warning, not a traced impact. Chamber, lens, cables and hole clipping are not modeled; this check does not trigger beam blanking.',sources:[BSE_SOURCES.detector,BSE_SOURCES.placement]},
  { id: 'bseCharge', title: 'Direct electron-to-charge conversion',
    formula: 'ĒBSE = βEbeam; G ≈ ηq ĒBSE/3.62 eV; Isig = G Iinc',
    substitution: (p,d) => { const c = context(p,d); return `β = ${f(c.params.bseEnergyFraction)}; ĒBSE = ${f(c.meanEnergykeV)} keV; assumed ηq = 0.72; G = ${f(c.chargeGain)}`; },
    result: (p,d) => `${f(context(p,d).generatedCurrentnA)} nA generated signal`,
    derivation: 'The datasheet defines theoretical charge gain as deposited electron energy divided by 3.62 eV per electron–hole pair, and charge efficiency as actual gain divided by that value. Multiply incident electron current by the assumed gain. At 1.5 keV this approximation gives 298, near the published typical gain of 300.',
    assumptions: '72% is measured at 1.5 keV and is held constant here as an explicit approximation, not a measured efficiency over the range. The mean-energy surrogate hides the BSE spectrum. No gain is extrapolated outside 1–30 keV.', sources: [BSE_SOURCES.detector] },
  { id: 'bseBias', title: 'Reverse bias, dark current & capacitance',
    formula: 'VR = VK − VA; A = −VR, K ≈ 0; interpolate ID(VR) and Ct(VR)',
    substitution: (p,d) => { const c = context(p,d); return `VA = −${f(c.params.detectorBias)} V; VK ≈ 0 V; typical ID: 0.5 nA at 10 mV, 5 nA at 5 V`; },
    result: (p,d) => { const c = context(p,d); return `${f(c.darkCurrentnA)} nA dark · ${f(c.detectorCapacitancepF)} pF detector`; },
    derivation: 'Reverse bias makes cathode potential higher than anode potential. Keep the cathode at the TIA virtual ground and drive the anode negative. The simulator linearly interpolates capacitance between 1700 pF at 0 V and 450 pF at 5 V, and dark current between the two tabulated bias points; below 10 mV it approaches zero linearly.',
    assumptions: 'Teaching interpolation at 25°C only, not a fitted semiconductor model. Dark-current variation between devices is large: at 5 V the datasheet maximum is 60 nA. The 20 V absolute maximum is not an operating recommendation.', sources: [BSE_SOURCES.detector, BSE_SOURCES.photodiode] },
  { id: 'bseTIA', title: 'Current amplifier & readout headroom',
    formula: 'Vraw = (Isig + ID)Rf; VADC,in = Vraw + 0.15 V; VADC = clamp(VADC,in, 0, Vmax)',
    substitution: (p,d) => { const c = context(p,d); return `Rf = ${f(c.params.tiaResistance)} MΩ; Isig = ${f(c.generatedCurrentnA)} nA; ID = ${f(c.darkCurrentnA)} nA; Vmax = ${f(c.params.adcFullScale)} V`; },
    result: (p,d) => { const c = context(p,d); return `${f(c.rawOutputV)} V TIA → ${f(c.adcOutputV)} V conditioned ADC${c.saturated ? ' · CLIPPED' : ''}`; },
    derivation: 'Negative feedback holds the cathode near 0 V. Conventional reverse current leaves the summing node toward the negatively biased anode; feedback supplies the same current, so the output rises by IRf. Dark current adds an offset. A separate ideal unity-gain level shifter adds 0.15 V, then the simulation clamps to its configured readout ceiling.',
    assumptions: 'Ideal stable TIA and noiseless bias/offset supplies. The 0.15 V offset is a selected conditioning target, not a photodiode property. Ceiling is a simulation setting, not amplifier output swing or an ESP32 rating. Real level shifting, protection, rail headroom and ADC calibration require validation.', sources: [BSE_SOURCES.photodiode] },
  { id: 'bseTiming', title: 'Feedback bandwidth & pixel settling',
    formula: 'τ = RfCf; f−3dB = 1/(2πτ); t1% = ln(100)τ',
    substitution: (p,d) => { const c = context(p,d); return `Rf = ${f(c.params.tiaResistance)} MΩ; Cf = ${f(c.params.tiaCapacitance)} pF; τ = ${f(c.timeConstantUs)} µs`; },
    result: (p,d) => { const c = context(p,d); return `${f(c.bandwidthHz)} Hz · ${f(c.settlingTimeUs)} µs to 1%${c.settled ? '' : ' · dwell too short'}`; },
    derivation: 'Rf in parallel with Cf has impedance Rf/(1 + sRfCf). An ideal TIA therefore has a first-order response with τ = RfCf and a step error exp(−t/τ). Set the remaining error to 0.01 and solve t = ln(100)τ.',
    assumptions: 'Ideal amplifier and no extra poles. The detector’s 2.5 MHz optical test into 50 Ω is not this circuit’s bandwidth. Ct, stray capacitance, selected op-amp gain bandwidth and phase margin still require stability analysis and measured settling.', sources: [BSE_SOURCES.photodiode, BSE_SOURCES.detector] },
  { id: 'bseNoise', title: 'BSE event noise & amplifier estimate',
    formula: 'σI² ≈ [2e(G²Iinc + ID) + 4kT(1/Rf + 1/Rsh) + in²]B + en²[Y0²B + (2πCΣ)²B³/3]; SNR = Isig/σI',
    substitution: (p,d) => { const c = context(p,d); return `B ≈ ${f(c.noiseBandwidthHz)} Hz; Rsh ≈ 20 MΩ; in = ${f(c.params.tiaInputNoise)} pA/√Hz; en = ${f(c.params.tiaVoltageNoise)} nV/√Hz`; },
    result: (p,d) => { const c = context(p,d); return `${f(c.noiseRmsnA)} nA RMS input noise · ${f(c.snr)} linear SNR estimate`; },
    derivation: 'Each Poisson-distributed incident electron produces a correlated charge packet Ge, giving event noise density 2eG²Iinc. Add independent dark shot noise, feedback/shunt thermal noise and amplifier current noise in variance. Approximate voltage-noise current as en|Y0 + j2πfCΣ|, where Y0 = 1/Rf + 1/Rsh and CΣ = Ct + Cf, and integrate over a rectangular band.',
    assumptions: 'Approximate B = min[1/(4RfCf), 1/(2tdwell)] assumes pixel averaging and omits noise outside that finite band. T = 25°C; Rsh = 10mV/0.5nA is held constant. Fixed charge per BSE ignores energy spread and excess noise; cable, 1/f, ADC and supply noise are omitted. SNR does not correct clipping or insufficient settling.', sources: [BSE_SOURCES.photodiode, BSE_SOURCES.detector] },
];
