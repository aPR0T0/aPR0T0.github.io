/** Illustrative floating-collector arithmetic. No collection, noise or image prediction. */
export const COLLECTOR_DEFAULTS = Object.freeze({
  biasV: 200, netCurrentpA: 10, resistanceTOhm: 100,
  capacitancepF: 10, ripplemV: 1, frequencyHz: 50, targetpA: 1,
});

export function calculateCollector(input = {}) {
  const p = {...COLLECTOR_DEFAULTS, ...input};
  for (const key of Object.keys(COLLECTOR_DEFAULTS)) {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value) ||
      (key !== 'netCurrentpA' && value < 0) ||
      (['resistanceTOhm', 'targetpA'].includes(key) && value === 0)) {
      throw new RangeError(`Invalid ${key}`);
    }
  }
  const rf = 100e6, gain = 10 / 40.2, tiaRelativeV = p.netCurrentpA * 1e-12 * rf;
  const adcA0V = (1 + gain) * 1.32 - gain * tiaRelativeV;
  const adcDiffV = adcA0V - 1.65;
  const leakagepA = p.biasV / p.resistanceTOhm;
  const ripplePerMillivoltpA = 2 * Math.PI * p.frequencyHz * p.capacitancepF * 1e-3;
  const ripplePeakpA = ripplePerMillivoltpA * p.ripplemV;
  return {
    commonV: p.biasV, positiveRailV: p.biasV + 5, negativeRailV: p.biasV - 5,
    tiaRelativeV, tiaAbsoluteV: p.biasV + tiaRelativeV,
    adcChangeV: -gain * tiaRelativeV, adcDiffV,
    currentPerCodepA: .256 / 32768 / (gain * rf) * 1e12,
    leakagepA, ripplePeakpA,
    resistanceForTargetTOhm: p.biasV / p.targetpA,
    rippleForTargetmV: ripplePerMillivoltpA > 0 ? p.targetpA / ripplePerMillivoltpA : null,
    withinErrorTarget: leakagepA <= p.targetpA && ripplePeakpA <= p.targetpA,
    clipped: Math.abs(tiaRelativeV) > 4 || adcDiffV < -.256 || adcDiffV >= .256 || adcA0V < 0 || adcA0V > 3.3,
  };
}
