// A fresh dedicated worker is terminated after every compile, including timeout.
// User functions run here, never on the page's animation/event thread.
self.onmessage = ({ data }) => {
  try {
    const { source, resolution: n } = data;
    if (typeof source !== 'string' || source.length > 24000 || !Number.isInteger(n) || n < 2 || n > 512) {
      throw new Error('Invalid scan program or resolution.');
    }
    const count = n * n;
    const points = new Float32Array(count * 3);
    const run = new Function('i', 'n', 't', '"use strict";\n' + source);
    for (let i = 0; i < count; i++) {
      let point;
      try { point = run(i, n, i / (count - 1)); }
      catch (error) { throw new Error(`Sample ${i}: ${error.message || error}`); }
      if (!point || typeof point !== 'object' || typeof point.then === 'function') throw new Error(`Sample ${i}: return {x, y, blank}; async functions are not supported.`);
      const { x, y, blank = false } = point;
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Sample ${i}: x and y must be finite numbers.`);
      if (Math.abs(x) > 1 || Math.abs(y) > 1) throw new Error(`Sample ${i}: x and y must stay between −1 and 1.`);
      if (typeof blank !== 'boolean' && blank !== 0 && blank !== 1) throw new Error(`Sample ${i}: blank must be true or false.`);
      points[i * 3] = x;
      points[i * 3 + 1] = y;
      points[i * 3 + 2] = blank ? 1 : 0;
    }
    self.postMessage({ points, count }, [points.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || String(error) });
  }
};
