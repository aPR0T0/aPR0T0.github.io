/** Fixed physical domains keep colours comparable as a control changes. */
export const FIELD_SCALES = Object.freeze({
  magnetic: Object.freeze({ min: 0, max: 40, unit: 'mT', label: 'Magnetic flux density' }),
  electric: Object.freeze({ min: 0, max: 20, unit: 'kV/m', label: 'Electric field' }),
});

const STOPS = [[65, 133, 255], [38, 235, 157], [255, 74, 97]];

/** Signed fields share the same magnitude colour; arrows communicate direction. */
export function fieldColor(value, maximum = 40, alpha = 1) {
  const amount = Number.isFinite(Number(value)) ? Math.abs(Number(value)) : 0;
  const t = Math.min(1, Math.max(0, amount / Math.max(1e-9, Number(maximum) || 40)));
  const band = t < 0.5 ? 0 : 1;
  const mix = (t - band * .5) * 2;
  const channels = STOPS[band].map((v, i) => Math.round(v + (STOPS[band + 1][i] - v) * mix));
  return `rgba(${channels.join(', ')}, ${Math.min(1, Math.max(0, Number(alpha) || 0))})`;
}

/** Schematic aperture opening: deliberately enlarged and perceptually spaced. */
export function apertureVisualRadius(diameterUm) {
  const input = Number(diameterUm);
  const diameter = Math.min(300, Math.max(0, Number.isFinite(input) ? input : 100));
  if (diameter <= 10) return diameter * .3;
  return 3 + 26 * Math.pow((diameter - 10) / 290, .72);
}
