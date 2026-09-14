/* Display arithmetic for saved samples; this module does not run a field solver. */
"use strict";
window.WorkbenchMath = (() => {
  function nearest(times, value) {
    if (!times.length) return -1;
    let lo = 0, hi = times.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (times[mid] < value) lo = mid + 1; else hi = mid; }
    return lo > 0 && Math.abs(times[lo - 1] - value) <= Math.abs(times[lo] - value) ? lo - 1 : lo;
  }
  function sumMagnetic(grid, currents) {
    const count = grid.nx * grid.ny;
    const bx = new Float32Array(count), by = new Float32Array(count), bz = new Float32Array(count);
    for (const kernel of grid.kernels) {
      const current = currents[kernel.loop_id];
      if (!Number.isFinite(current)) return null;
      for (let i = 0; i < count; i++) {
        bx[i] += kernel.bx_nt_per_a[i] * current / 1000;
        by[i] += kernel.by_nt_per_a[i] * current / 1000;
        bz[i] += kernel.bz_nt_per_a[i] * current / 1000;
      }
    }
    const values = Float32Array.from(bx, (x, i) => Math.hypot(x, by[i], bz[i]));
    return {bx, by, bz, values};
  }
  function knownMaximum(values) {
    const known = values.filter(v => typeof v === "number" && Number.isFinite(v));
    return known.length ? Math.max(...known) : null;
  }
  function range(values, fallback = [0, 1]) {
    let min = Infinity, max = -Infinity;
    for (const v of values) if (typeof v === "number" && Number.isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); }
    if (!Number.isFinite(min)) return fallback;
    const pad = Math.max((max - min) * .08, Math.abs(max) * .02, 1e-6);
    return [min - pad, max + pad];
  }
  const stops = [[39,109,255],[28,212,207],[226,239,75],[250,145,70],[230,80,91]];
  function color(value, min, max) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "#536574";
    const t = Math.max(0, Math.min(1, (value-min)/(max-min || 1))) * (stops.length-1);
    const i = Math.min(stops.length-2, Math.floor(t)), f = t-i;
    return "#" + stops[i].map((v,j)=>Math.round(v+(stops[i+1][j]-v)*f).toString(16).padStart(2,"0")).join("");
  }
  return {nearest, sumMagnetic, knownMaximum, range, color};
})();
