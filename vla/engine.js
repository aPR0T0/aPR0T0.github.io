/* vla/engine.js: the small 3D kit every scene on the VLA page shares.
   three.js r128 global build (vendor/three.min.js); no modules, no build step.
   Look: technical-drawing style. Flat fills in the site palette, 1px ink edges, one accent per pipeline stage. */
(function () {
  'use strict';
  const T = window.THREE;
  const VLA = (window.VLA = window.VLA || {});
  const noop = () => {};

  /* ---------- math ---------- */
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeIO = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  Object.assign(VLA, { clamp, lerp, smooth, easeIO, seg, rng, gauss });

  /* ---------- palette (mirrors the site's light / dark tokens) ---------- */
  const PAL = {
    light: {
      bg: '#fbf9f4', body: '#f8f5ee', body2: '#e2dbca', table: '#efe9dc', ink: '#18181b', soft: '#c9c1ae', faint: '#e6dfcf', muted: '#857f73',
      train: '#5a4dc4', trainFill: '#e4e0fa', data: '#1d7a57', dataFill: '#d6ece1', deploy: '#c0571f', deployFill: '#f7e2d4',
      good: '#2f7a4f', bad: '#b8402c', sky: '#ffffff', ground: '#cfc5b0', hemi: 0.8, sun: 0.42, shadow: 0.12,
    },
    dark: {
      bg: '#111113', body: '#2c2c31', body2: '#1f1f23', table: '#18181b', ink: '#e7e7e2', soft: '#3c3c42', faint: '#202024', muted: '#7d7d76',
      train: '#a69cf7', trainFill: '#2b2750', data: '#5fc9a1', dataFill: '#173a2c', deploy: '#f28c59', deployFill: '#45271a',
      good: '#7fcb98', bad: '#f08a7a', sky: '#e4e4ec', ground: '#26262b', hemi: 0.95, sun: 0.5, shadow: 0.42,
    },
  };
  let theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const col = (role) => PAL[theme][role];
  VLA.PAL = PAL; VLA.col = col; VLA.theme = () => theme;

  const texRec = new WeakMap();
  const mats = new Set(), texs = new Set(), fogs = new Set(), lights = new Set(), hooks = new Set();
  function paint(m) {
    const u = m.userData;
    if (u.shadow) { m.opacity = col('shadow'); return; }
    if (u.role) m.color.set(col(u.role));
    if (u.emRole && m.emissive) m.emissive.set(col(u.emRole));
  }
  function reg(m, role) { m.userData.role = role; mats.add(m); paint(m); return m; }
  VLA.role = (m, role) => { m.userData.role = role; paint(m); return m; };
  VLA.glow = (m, role, k) => { m.userData.emRole = role; paint(m); m.emissiveIntensity = k; return m; };

  const sCache = new Map(), lCache = new Map();
  VLA.surf = (role, o) => {
    const k = role + '|' + (o ? JSON.stringify(o) : '');
    let m = sCache.get(k);
    if (!m) { m = reg(new T.MeshLambertMaterial(Object.assign({}, o)), role); sCache.set(k, m); }
    return m;
  };
  VLA.surfNew = (role, o) => reg(new T.MeshLambertMaterial(Object.assign({}, o)), role);
  VLA.flat = (role, o) => reg(new T.MeshBasicMaterial(Object.assign({}, o)), role);
  VLA.line = (role, op = 1) => {
    const k = role + '|' + op;
    let m = lCache.get(k);
    if (!m) { m = reg(new T.LineBasicMaterial({ transparent: op < 1, opacity: op }), role); lCache.set(k, m); }
    return m;
  };
  VLA.lineNew = (role, op = 1) => reg(new T.LineBasicMaterial({ transparent: true, opacity: op }), role);
  VLA.dash = (role, dash = 0.04, gap = 0.03, op = 1) => reg(new T.LineDashedMaterial({ dashSize: dash, gapSize: gap, transparent: op < 1, opacity: op }), role);
  VLA.pointsMat = (role, size, op = 1) => reg(new T.PointsMaterial({ size, sizeAttenuation: true, transparent: op < 1, opacity: op }), role);
  VLA.shadowMat = () => { const m = new T.ShadowMaterial({ opacity: col('shadow') }); m.userData.shadow = true; mats.add(m); return m; };

  /* canvas textures redraw themselves when the theme flips */
  VLA.font = (px, w = 500) => `${w} ${px}px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
  function redrawTex(r) { r.ctx.setTransform(1, 0, 0, 1, 0, 0); r.ctx.clearRect(0, 0, r.w, r.h); r.draw(r.ctx, PAL[theme], r.w, r.h, r.state); r.tex.needsUpdate = true; }
  VLA.canvasTex = (w, h, draw, state) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const tex = new T.CanvasTexture(c); tex.anisotropy = 4;
    const rec = { tex, ctx: c.getContext('2d'), draw, w, h, state: state || {} };
    texRec.set(tex, rec); texs.add(rec); redrawTex(rec);
    return tex;
  };
  VLA.retex = (tex, patch) => { const r = texRec.get(tex); if (patch) Object.assign(r.state, patch); redrawTex(r); };

  VLA.fog = (near, far) => { const f = new T.Fog(col('bg'), near, far); fogs.add(f); return f; };
  VLA.onTheme = (fn) => hooks.add(fn);
  function paintLights(l) {
    if (l.isHemisphereLight) { l.color.set(col('sky')); l.groundColor.set(col('ground')); l.intensity = col('hemi'); }
    else l.intensity = col('sun') * (l.userData.k || 1);
  }
  VLA.setTheme = (t) => {
    theme = t === 'dark' ? 'dark' : 'light';
    mats.forEach(paint); texs.forEach(redrawTex); fogs.forEach((f) => f.color.set(col('bg'))); lights.forEach(paintLights);
    hooks.forEach((fn) => fn(theme));
  };
  VLA.refreshText = () => texs.forEach(redrawTex);

  /* ---------- geometry ---------- */
  const gCache = new Map(), eCache = new Map();
  const geo = (key, make) => { let g = gCache.get(key); if (!g) { g = make(); gCache.set(key, g); } return g; };
  VLA.geo = geo;
  VLA.edges = (mesh, role = 'ink', op = 1) => {
    const g = mesh.geometry;
    let e = eCache.get(g.uuid);
    if (!e) { e = new T.EdgesGeometry(g, 25); eCache.set(g.uuid, e); }
    const l = new T.LineSegments(e, VLA.line(role, op));
    l.raycast = noop; mesh.add(l); return l;
  };
  function finish(m, edge, o) {
    m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false;
    if (edge) VLA.edges(m, edge, o.eop || 1);
    return m;
  }
  VLA.box = (w, h, d, role = 'body', edge = 'ink', o = {}) =>
    finish(new T.Mesh(geo(`b${w},${h},${d}`, () => new T.BoxGeometry(w, h, d)), o.mat || VLA.surf(role)), edge, o);
  VLA.cyl = (rt, rb, h, n = 20, role = 'body', edge = 'ink', o = {}) =>
    finish(new T.Mesh(geo(`c${rt},${rb},${h},${n}`, () => new T.CylinderGeometry(rt, rb, h, n)), o.mat || VLA.surf(role)), edge, o);
  VLA.ball = (r, role = 'body', o = {}) =>
    finish(new T.Mesh(geo(`s${r}`, () => new T.SphereGeometry(r, 18, 12)), o.mat || VLA.surf(role)), null, o);

  VLA.polyline = (pts, mat) => {
    const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), mat);
    if (mat.isLineDashedMaterial) l.computeLineDistances();
    l.raycast = noop; return l;
  };
  VLA.segments = (pts, mat) => { const l = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), mat); l.raycast = noop; return l; };
  // a line whose points change every frame
  VLA.dynLine = (n, mat, Kind = T.Line) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    g.setDrawRange(0, 0);
    const l = new Kind(g, mat); l.frustumCulled = false; l.raycast = noop;
    l.set = (arr, count) => {
      const a = g.attributes.position.array;
      for (let i = 0; i < count; i++) { a[i * 3] = arr[i].x; a[i * 3 + 1] = arr[i].y; a[i * 3 + 2] = arr[i].z; }
      g.attributes.position.needsUpdate = true; g.setDrawRange(0, count);
      if (mat.isLineDashedMaterial) l.computeLineDistances();
    };
    return l;
  };
  // lines are split into short pieces: a single long segment that passes behind the camera gets dropped by some GPUs
  VLA.grid = (size, step, role = 'soft', op = 1) => {
    const p = [], h = size / 2, n = Math.round(size / step);
    for (let i = 0; i <= n; i++) {
      const x = -h + i * step;
      for (let j = 0; j < n; j++) {
        const a = -h + j * step, b = a + step;
        p.push(new T.Vector3(x, 0, a), new T.Vector3(x, 0, b), new T.Vector3(a, 0, x), new T.Vector3(b, 0, x));
      }
    }
    return VLA.segments(p, VLA.line(role, op));
  };
  // a square-ish arrow head (cone) pointing along +Y, for arrows
  VLA.cone = (r, h, role) => { const m = new T.Mesh(geo(`k${r},${h}`, () => new T.ConeGeometry(r, h, 4)), VLA.surf(role)); return m; };
  // orient a unit-height cylinder/box between two points
  const _up = new T.Vector3(0, 1, 0), _d = new T.Vector3();
  VLA.between = (m, a, b) => {
    _d.subVectors(b, a); const len = _d.length();
    m.position.copy(a).addScaledVector(_d, 0.5);
    m.quaternion.setFromUnitVectors(_up, _d.normalize()); m.scale.set(1, len, 1);
  };

  /* table with legs; top surface at y = 0 */
  VLA.table = (w, d, o = {}) => {
    const g = new T.Group();
    const top = VLA.box(w, 0.03, d, o.role || 'table', 'ink'); top.position.y = -0.015; g.add(top);
    const legH = o.legs || 0.5;
    if (legH > 0) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = VLA.box(0.03, legH, 0.03, 'body2', 'ink'); leg.position.set(sx * (w / 2 - 0.04), -0.03 - legH / 2, sz * (d / 2 - 0.04)); g.add(leg);
    }
    g.userData.top = top; return g;
  };
  // an open-top bin; floor surface at y = floor
  VLA.bin = (w, d, h, role = 'body', edge = 'ink') => {
    const g = new T.Group(), t = 0.008;
    const fl = VLA.box(w, t, d, role, edge); fl.position.y = t / 2; g.add(fl);
    for (const s of [-1, 1]) {
      const a = VLA.box(w, h, t, role, edge); a.position.set(0, h / 2, s * (d / 2 - t / 2)); g.add(a);
      const b = VLA.box(t, h, d - 2 * t, role, edge); b.position.set(s * (w / 2 - t / 2), h / 2, 0); g.add(b);
    }
    g.userData.floor = t; return g;
  };

  /* ---------- 6-DoF arm (ViperX / ALOHA-like proportions) with analytic IK ----------
     root frame: base on the table at y = 0, the arm reaches along local +X at yaw 0.
     solve(p, phi, roll): p = world target for the tool point, phi = tool pitch
     (-PI/2 points straight down, 0 points away from the base), roll about the tool axis. */
  VLA.arm = (o = {}) => {
    const s = o.scale || 1, role = o.role || 'body', role2 = o.role2 || 'body2', ink = o.edge || 'ink';
    const L = { h0: 0.11 * s, L1: 0.26 * s, L2: 0.26 * s, L3: 0.105 * s };
    const root = new T.Group();
    const base = VLA.cyl(0.055 * s, 0.06 * s, 0.03 * s, 24, role2, ink); base.position.y = 0.015 * s; root.add(base);
    const yaw = new T.Group(); yaw.position.y = 0.03 * s; root.add(yaw);
    const turret = VLA.box(0.07 * s, 0.05 * s, 0.064 * s, role, ink); turret.position.y = 0.025 * s; yaw.add(turret);
    for (const z of [-1, 1]) { const ear = VLA.box(0.04 * s, 0.05 * s, 0.01 * s, role2, ink); ear.position.set(0, 0.07 * s, z * 0.037 * s); yaw.add(ear); }
    const sh = new T.Group(); sh.position.y = L.h0 - 0.03 * s; yaw.add(sh);
    const hub1 = VLA.cyl(0.028 * s, 0.028 * s, 0.064 * s, 20, role2, ink); hub1.rotation.x = Math.PI / 2; sh.add(hub1);
    const up = VLA.box(L.L1, 0.034 * s, 0.042 * s, role, ink); up.position.x = L.L1 / 2; sh.add(up);
    const el = new T.Group(); el.position.x = L.L1; sh.add(el);
    const hub2 = VLA.cyl(0.024 * s, 0.024 * s, 0.056 * s, 20, role2, ink); hub2.rotation.x = Math.PI / 2; el.add(hub2);
    const fo = VLA.box(L.L2, 0.028 * s, 0.034 * s, role, ink); fo.position.x = L.L2 / 2; el.add(fo);
    const wr = new T.Group(); wr.position.x = L.L2; el.add(wr);
    const hub3 = VLA.cyl(0.02 * s, 0.02 * s, 0.046 * s, 18, role2, ink); hub3.rotation.x = Math.PI / 2; wr.add(hub3);
    const wl = VLA.box(0.045 * s, 0.03 * s, 0.032 * s, role, ink); wl.position.x = 0.0225 * s; wr.add(wl);
    const rl = new T.Group(); rl.position.x = 0.045 * s; wr.add(rl);
    const palm = VLA.box(0.022 * s, 0.032 * s, 0.072 * s, role2, ink); palm.position.x = 0.011 * s; rl.add(palm);
    const fingers = [];
    for (const z of [-1, 1]) {
      const f = VLA.box(0.058 * s, 0.022 * s, 0.009 * s, o.fingerRole || role, ink);
      f.position.set(0.022 * s + 0.029 * s, 0, z * 0.03 * s); f.userData.side = z; rl.add(f); fingers.push(f);
    }
    const tool = new T.Object3D(); tool.position.x = L.L3 - 0.045 * s; rl.add(tool);
    const mount = new T.Object3D(); mount.position.set(0.02 * s, 0.026 * s, 0); wr.add(mount); // wrist-camera mount

    const q = [0, 1.2, -2.2, -0.6, 0, 0.04 * s];
    const tmp = new T.Vector3();
    function apply() {
      yaw.rotation.y = q[0]; sh.rotation.z = q[1]; el.rotation.z = q[2]; wr.rotation.z = q[3]; rl.rotation.x = q[4];
      const hg = q[5];
      for (const f of fingers) f.position.z = f.userData.side * (hg + 0.0045 * s);
    }
    const api = {
      root, tool, mount, fingers, L, s, q,
      solve(p, phi = -Math.PI / 2, roll = 0, g) {
        root.updateMatrixWorld(); tmp.copy(p); root.worldToLocal(tmp);
        const q0 = Math.atan2(-tmp.z, tmp.x), r = Math.hypot(tmp.x, tmp.z);
        const wx = r - L.L3 * Math.cos(phi), wy = tmp.y - L.L3 * Math.sin(phi) - L.h0;
        const D = clamp(Math.hypot(wx, wy), 1e-3, L.L1 + L.L2 - 1e-4);
        const a = Math.atan2(wy, wx);
        const b = Math.acos(clamp((L.L1 * L.L1 + D * D - L.L2 * L.L2) / (2 * L.L1 * D), -1, 1));
        const c = Math.acos(clamp((L.L1 * L.L1 + L.L2 * L.L2 - D * D) / (2 * L.L1 * L.L2), -1, 1));
        q[0] = q0; q[1] = a + b; q[2] = -(Math.PI - c); q[3] = phi - q[1] - q[2]; q[4] = roll;
        if (g !== undefined) q[5] = g * s;
        apply();
      },
      grip(g) { q[5] = g * s; apply(); },
      set(arr) { for (let i = 0; i < 6; i++) q[i] = arr[i]; apply(); },
      // world yaw of the arm's radial direction toward p (lets a cube sit square to the jaws)
      yawTo(p) { root.updateMatrixWorld(); tmp.copy(p); root.worldToLocal(tmp); return Math.atan2(-tmp.z, tmp.x) + root.rotation.y; },
      toolPos(out) { tool.updateWorldMatrix(true, false); return out.setFromMatrixPosition(tool.matrixWorld); },
    };
    apply();
    return api;
  };

  /* ---------- camera rig: body + lens + frustum (frustum lives on layer 1, so insets don't see it) ---------- */
  VLA.camRig = (o = {}) => {
    const s = o.s || 1, fov = o.fov || 60, asp = o.aspect || 4 / 3, len = o.len || 0.25;
    const g = new T.Group();
    const body = VLA.box(0.05 * s, 0.032 * s, 0.03 * s, 'body2', 'ink', { cast: false }); body.position.z = -0.015 * s; g.add(body);
    const lens = VLA.cyl(0.011 * s, 0.011 * s, 0.012 * s, 14, 'ink', null, { cast: false }); lens.rotation.x = Math.PI / 2; lens.position.z = 0.004 * s; g.add(lens);
    const cam = new T.PerspectiveCamera(fov, asp, 0.01, 20); cam.rotation.y = Math.PI; g.add(cam);
    const a = Math.tan((fov * Math.PI) / 360) * len, b = a * asp;
    const c = [[b, a], [-b, a], [-b, -a], [b, -a]].map(([x, y]) => new T.Vector3(x, y, len));
    const pts = [];
    for (let i = 0; i < 4; i++) pts.push(new T.Vector3(), c[i], c[i], c[(i + 1) % 4]);
    const fr = VLA.segments(pts, VLA.line(o.role || 'data', 0.75)); fr.layers.set(1); g.add(fr);
    if (o.hideBody) { body.layers.set(1); lens.layers.set(1); body.children.forEach((k) => k.layers.set(1)); }
    return { group: g, cam, frustum: fr };
  };

  /* ---------- end-effector tracks: keyframes, eased per segment; fields carry over ---------- */
  VLA.track = (keys) => {
    let prev = { p: [0, 0.2, 0], phi: -Math.PI / 2, roll: 0, g: 0.04 };
    const ks = keys.map((k) => (prev = { t: k.t, p: k.p || prev.p, phi: k.phi !== undefined ? k.phi : prev.phi, roll: k.roll !== undefined ? k.roll : prev.roll, g: k.g !== undefined ? k.g : prev.g }));
    const dur = ks[ks.length - 1].t;
    return {
      keys: ks, dur,
      at(t, out) {
        t = clamp(t, 0, dur);
        let i = 0; while (i < ks.length - 2 && t >= ks[i + 1].t) i++;
        const a = ks[i], b = ks[Math.min(i + 1, ks.length - 1)];
        const u = b.t > a.t ? easeIO((t - a.t) / (b.t - a.t)) : 1;
        out.p.set(lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u));
        out.phi = lerp(a.phi, b.phi, u); out.roll = lerp(a.roll, b.roll, u); out.g = lerp(a.g, b.g, u);
        return out;
      },
    };
  };
  VLA.pose = () => ({ p: new T.Vector3(), phi: 0, roll: 0, g: 0.04 });

  /* ---------- loose objects: grabbed by a tool, or falling onto a rest height ---------- */
  VLA.Body = class {
    constructor(mesh, world, rest) { this.m = mesh; this.world = world; this.rest = rest; this.vy = 0; this.held = null; }
    grab(tool) { if (this.held === tool) return; tool.attach(this.m); this.held = tool; this.vy = 0; }
    release() { if (!this.held) return; this.world.attach(this.m); this.held = null; this.vy = 0; }
    place(x, y, z, ry = 0) { if (this.held) this.release(); this.m.position.set(x, y, z); this.m.rotation.set(0, ry, 0); this.vy = 0; }
    step(dt) {
      if (this.held) return;
      const p = this.m.position;
      if (p.y > this.rest + 1e-4 || this.vy > 0) {
        this.vy -= 9.8 * dt; p.y += this.vy * dt;
        this.m.rotation.x *= 0.9; this.m.rotation.z *= 0.9;
        if (p.y <= this.rest) {
          p.y = this.rest; this.vy = Math.abs(this.vy) > 0.5 ? -this.vy * 0.22 : 0;
          if (!this.vy) { this.m.rotation.x = 0; this.m.rotation.z = 0; }
        }
      }
    }
  };

  /* ---------- HTML labels pinned to 3D points ---------- */
  const _v = new T.Vector3();
  VLA.Labels = class {
    constructor(parent) { this.el = document.createElement('div'); this.el.className = 'lbls'; parent.appendChild(this.el); this.items = []; }
    add(text, target, o = {}) {
      const d = document.createElement('div');
      d.className = 'lbl' + (o.cls ? ' ' + o.cls : '');
      if (o.html) d.innerHTML = text; else d.textContent = text;
      this.el.appendChild(d);
      const c = o.cls || '';
      const ax = /\bleft\b/.test(c) ? '0px' : /\bright\b/.test(c) ? '-100%' : '-50%';
      const ay = /\bdown\b/.test(c) ? '6px' : 'calc(-100% - 6px)';
      const it = { d, target, off: new T.Vector3(...(o.off || [0, 0, 0])), hidden: false, text, tail: ` translate(${ax},${ay})` };
      it.set = (txt) => { if (txt !== it.text) { it.text = txt; d.textContent = txt; } };
      it.show = (v) => { it.hidden = !v; };
      this.items.push(it); return it;
    }
    update(cam, w, h) {
      for (const it of this.items) {
        if (it.hidden) { it.d.style.visibility = 'hidden'; continue; }
        if (it.target.isVector3) _v.copy(it.target); else { it.target.updateWorldMatrix(true, false); _v.setFromMatrixPosition(it.target.matrixWorld); }
        _v.add(it.off).project(cam);
        if (_v.z > 1 || _v.z < -1) { it.d.style.visibility = 'hidden'; continue; }
        it.d.style.visibility = '';
        it.d.style.transform = `translate(${((_v.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-_v.y * 0.5 + 0.5) * h).toFixed(1)}px)` + it.tail;
      }
    }
    show(v) { this.el.style.display = v ? '' : 'none'; }
  };

  /* ---------- a scene scaffold: lights, fog, shadow catcher ---------- */
  VLA.makeScene = (o = {}) => {
    const scene = new T.Scene();
    scene.fog = VLA.fog(o.fog ? o.fog[0] : 6, o.fog ? o.fog[1] : 16);
    const hemi = new T.HemisphereLight(0xffffff, 0x888888, 1); lights.add(hemi); paintLights(hemi); scene.add(hemi);
    const sun = new T.DirectionalLight(0xffffff, 1); sun.userData.k = 1;
    sun.position.set(...(o.sun || [1.5, 4, 2.2])); sun.castShadow = o.shadows !== false;
    const r = o.shadowR || 1.2;
    sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.1, far: 14 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.002;
    lights.add(sun); paintLights(sun); scene.add(sun, sun.target);
    if (o.target) sun.target.position.set(...o.target);
    const fill = new T.DirectionalLight(0xffffff, 1); fill.userData.k = 0.35; fill.position.set(-2, 1.5, -1); lights.add(fill); paintLights(fill); scene.add(fill);
    if (o.floor !== undefined) {
      const fl = new T.Mesh(new T.PlaneGeometry(40, 40), VLA.shadowMat()); fl.rotation.x = -Math.PI / 2; fl.position.y = o.floor + 0.001; fl.receiveShadow = true; scene.add(fl);
      const gr = VLA.grid(o.gridSize || 8, o.gridStep || 0.25, 'soft', 0.9); gr.position.y = o.floor; scene.add(gr);
    }
    return scene;
  };

  /* token / card textures */
  VLA.wordTex = (word, o = {}) => VLA.canvasTex(o.w || 256, o.h || 96, (c, P, w, h) => {
    c.fillStyle = P[o.bg || 'body']; c.fillRect(0, 0, w, h);
    c.strokeStyle = P[o.edge || 'ink']; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = P[o.fg || 'ink']; c.font = VLA.font(o.px || 40, 500); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(word, w / 2, h / 2 + 2);
  });
})();
