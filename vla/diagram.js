/* vla/diagram.js: a kit for drawing model architectures as upright 3D block diagrams
   (the GR00T N1 figure style): rounded labeled modules, token columns, arrows, dashed boxes
   and packets that travel along the wires. Coordinates come from the reference figure in px. */
(function () {
  'use strict';
  const T = THREE, V = VLA, PI = Math.PI;
  const D = (V.D = {});
  const vec = (x, y, z) => new T.Vector3(x, y, z);

  /* px on the 2000 x 1000 reference figure -> world units (y flips, figure stands in the XY plane) */
  D.mapper = (S = 330, ox = 990, oy = 505, ky = 1) => {
    const P = (x, y, z = 0) => vec((x - ox) / S, ((oy - y) / S) * ky, z);
    P.L = (px) => px / S;            // widths
    P.Ly = (px) => (px / S) * ky;    // heights
    return P;
  };

  function rrShape(w, h, r) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  const rrCache = new Map();
  function rrGeo(w, h, d, r) {
    const k = [w, h, d, r].map((v) => v.toFixed(3)).join(',');
    let g = rrCache.get(k);
    if (!g) { g = new T.ExtrudeGeometry(rrShape(w, h, r), { depth: d, bevelEnabled: false, curveSegments: 5 }); g.translate(0, 0, -d / 2); rrCache.set(k, g); }
    return g;
  }

  /* a six-armed snowflake, the "pre-trained and frozen" mark */
  D.drawSnow = (c, x, y, r, color, lw) => {
    c.save(); c.translate(x, y); c.strokeStyle = color; c.lineWidth = lw || Math.max(2, r * 0.16); c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      c.rotate(PI / 3);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r); c.stroke();
      c.beginPath(); c.moveTo(0, -r * 0.55); c.lineTo(-r * 0.28, -r * 0.8); c.moveTo(0, -r * 0.55); c.lineTo(r * 0.28, -r * 0.8); c.stroke();
    }
    c.restore();
  };

  const KIND = {
    frozen: { fill: 'faint', edge: 'ink', glow: 'frozen', snow: true },
    plain: { fill: 'faint', edge: 'ink', glow: 'train' },
    embod: { fill: 'dataFill', edge: 'data', glow: 'data' },
    train: { fill: 'trainFill', edge: 'train', glow: 'train' },
    bar: { fill: 'body2', edge: 'ink', glow: 'train' },
    shell: { fill: 'faint', edge: 'ink', glow: null },
  };

  /* a labeled, rounded module standing in the figure plane. lines: text lines; vertical: rotate text 90° */
  D.block = (o) => {
    const k = KIND[o.kind || 'plain'];
    const w = o.w, h = o.h, d = o.d || 0.2;
    const mat = V.surfNew(k.fill); mat.emissive = new T.Color(0);
    const m = new T.Mesh(rrGeo(w, h, d, o.r === undefined ? Math.min(w, h) * 0.12 : o.r), mat);
    m.castShadow = true; m.receiveShadow = true; V.edges(m, k.edge);
    m.position.copy(o.c);
    if (o.lines && o.lines.length) {
      const res = 520, cw = Math.round(o.vertical ? res * w / h : res), ch = Math.round(o.vertical ? res : res * h / w);
      const tex = V.canvasTex(Math.max(32, cw), Math.max(32, ch), (c, P, W, H) => {
        const span = o.vertical ? H : W, other = o.vertical ? W : H, unitPx = span / (o.vertical ? h : w);
        let px = (o.font || 0.108) * unitPx;
        c.font = V.font(px, 500);
        const widest = Math.max(...o.lines.map((s) => c.measureText(s).width));
        if (widest > span * 0.86) px *= (span * 0.86) / widest;
        c.save(); c.translate(W / 2, H / 2); if (o.vertical) c.rotate(PI / 2);
        c.fillStyle = P.ink; c.font = V.font(px, 500); c.textAlign = 'center'; c.textBaseline = 'middle';
        const lh = px * 1.22, top = -((o.lines.length - 1) * lh) / 2;
        o.lines.forEach((s, i) => c.fillText(s, 0, top + i * lh));
        c.restore();
        if (k.snow) { const r = Math.min(W, H) * 0.075; D.drawSnow(c, W - r * 1.6, r * 1.6, r, P.frozen); }
        void other;
      });
      const face = new T.Mesh(V.geo(`p${w * 0.96},${h * 0.96}`, () => new T.PlaneGeometry(w * 0.96, h * 0.96)), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      face.position.z = d / 2 + 0.003; face.raycast = () => {}; m.add(face);
    }
    return { mesh: m, mat, glow: (v) => { if (k.glow) V.glow(mat, k.glow, v); } };
  };

  /* a square token with an ink outline; own material so it can change colour */
  D.token = (role, s = 0.066) => {
    const mat = V.surfNew(role);
    const m = new T.Mesh(V.geo(`b${s},${s},${s}`, () => new T.BoxGeometry(s, s, s)), mat);
    m.castShadow = true; V.edges(m, 'ink');
    return m;
  };

  /* polyline with a cone arrowhead at the end */
  D.arrow = (pts, o = {}) => {
    const g = new T.Group(), role = o.role || 'muted', hh = o.head === false ? 0 : (o.headSize || 0.06);
    const a = pts[pts.length - 2], b = pts[pts.length - 1], dir = b.clone().sub(a).normalize();
    const end = b.clone().addScaledVector(dir, -hh);
    const line = V.polyline([...pts.slice(0, -1), end], o.dash ? V.dash(role, o.dash, o.dash, 1) : V.line(role, o.op || 1));
    g.add(line);
    if (hh) {
      const c = new T.Mesh(V.geo('ahead', () => new T.ConeGeometry(0.024, 0.06, 12)), V.surf(role));
      c.scale.setScalar(hh / 0.06);
      c.position.copy(b).addScaledVector(dir, -hh / 2); c.quaternion.setFromUnitVectors(vec(0, 1, 0), dir); g.add(c);
    }
    return g;
  };

  /* dashed rectangle in the figure plane */
  D.dashRect = (c, w, h, role = 'ink') => {
    const x0 = c.x - w / 2, x1 = c.x + w / 2, y0 = c.y - h / 2, y1 = c.y + h / 2, z = c.z;
    return V.polyline([vec(x0, y0, z), vec(x1, y0, z), vec(x1, y1, z), vec(x0, y1, z), vec(x0, y0, z)], V.dash(role, 0.035, 0.025, 1));
  };

  /* packets that run along wires inside time windows */
  D.Flow = class {
    constructor(scene) { this.scene = scene; this.items = []; }
    add(pts, t0, dur, role = 'ink', size = 0.04) {
      const path = new T.CurvePath();
      for (let i = 0; i < pts.length - 1; i++) path.add(new T.LineCurve3(pts[i], pts[i + 1]));
      const m = new T.Mesh(V.geo(`b${size},${size},${size}`, () => new T.BoxGeometry(size, size, size)), V.surf(role));
      m.visible = false; this.scene.add(m);
      const it = { path, t0, dur, m }; this.items.push(it); return it;
    }
    update(t) {
      for (const it of this.items) {
        const u = (t - it.t0) / it.dur;
        it.m.visible = u >= 0 && u <= 1;
        if (it.m.visible) it.m.position.copy(it.path.getPointAt(Math.min(1, Math.max(0, u))));  // r128 CurvePath ignores the target arg
      }
    }
  };

  /* 0 -> 1 -> 0 hump inside [a, b] */
  D.bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * PI));
})();
