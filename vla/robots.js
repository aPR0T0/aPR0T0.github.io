/* vla/robots.js: robot-scene helpers shared by several scenes:
   the ALOHA-style bimanual rig, the scripted "transfer cube" task, the episode runner,
   cameras, the edge computer, the teleoperator and transformer "floors". */
(function () {
  'use strict';
  const T = THREE, V = VLA, PI = Math.PI, DOWN = -PI / 2;
  const R = (V.R = {});
  const CUBE = 0.045, HALF = CUBE / 2;
  Object.assign(R, { CUBE, HALF, DOWN });
  V.scenes = V.scenes || [];
  V.STAGES = [
    { t: 'VLM pretraining', s: 'Internet image + text', cat: 'train' },
    { t: 'Robot data', s: 'Teleop demos', cat: 'data' },
    { t: 'VLA pretraining', s: 'Add action head', cat: 'train' },
    { t: 'Post-training', s: 'Target robot + task', cat: 'train' },
    { t: 'RL / refinement', s: 'Optional, rising', cat: 'train' },
    { t: 'Evaluation', s: 'Sim + real trials', cat: 'deploy' },
    { t: 'Optimize for edge', s: 'Compress + compile', cat: 'deploy' },
    { t: 'Deployment', s: 'Robot control loop', cat: 'deploy' },
  ];

  /* two arms facing each other across a table, ALOHA layout; table top at y = 0 */
  R.rig = (o = {}) => {
    const world = new T.Group();
    const table = V.table(o.tw || 1.3, o.td || 0.72, { legs: o.legs === undefined ? 0.55 : o.legs, role: o.tableRole });
    world.add(table);
    const ao = o.arm || {};
    const Ra = V.arm(ao); Ra.root.position.set(0.42, 0, 0); Ra.root.rotation.y = PI; world.add(Ra.root);
    const La = V.arm(ao); La.root.position.set(-0.42, 0, 0); world.add(La.root);
    return { world, table, L: La, R: Ra, arms: { L: La, R: Ra } };
  };
  R.cube = (world, role = 'deploy', edge = 'ink') => {
    const m = V.box(CUBE, CUBE, CUBE, role, edge); world.add(m);
    return new V.Body(m, world, HALF);
  };

  /* Right arm picks the cube, hands it over mid-air, left arm drops it in the bin.
     fail: 'miss' (right jaws close beside the cube) or 'drop' (left never closes). */
  R.transferTask = (o) => {
    const { cx, cz, bx, bz } = o, miss = o.fail === 'miss', drop = o.fail === 'drop';
    const gx = miss ? cx - 0.05 : cx;
    const Rt = V.track([
      { t: 0, p: [0.24, 0.2, 0], phi: DOWN, roll: 0, g: 0.04 },
      { t: 0.9, p: [gx, 0.12, cz] },
      { t: 1.45, p: [gx, HALF, cz] },
      { t: 1.75, g: miss ? 0.006 : 0.027 },
      { t: 2.35, p: [gx, 0.16, cz] },
      { t: 3.3, p: [0.012, 0.2, 0], phi: 0 },
      { t: 4.2 },
      { t: 4.45, g: 0.04 },
      { t: 5.05, p: [0.17, 0.21, 0] },
      { t: 5.95, p: [0.24, 0.2, 0], phi: DOWN },
      { t: 7.9 },
    ]);
    const Lt = V.track([
      { t: 0, p: [-0.24, 0.2, 0], phi: DOWN, roll: 0, g: 0.04 },
      { t: 2.45 },
      { t: 3.3, p: [-0.15, 0.2, 0], phi: 0, roll: PI / 2 },
      { t: 3.9, p: [-0.012, 0.2, 0] },
      { t: 4.1, g: drop ? 0.034 : 0.027 },
      { t: 4.5 },
      { t: 5.05, p: [-0.17, 0.22, 0] },
      { t: 5.85, p: [bx, 0.17, bz], phi: DOWN },
      { t: 6.3, p: [bx, 0.085, bz] },
      { t: 6.5, g: 0.045 },
      { t: 7.0, p: [bx, 0.19, bz] },
      { t: 7.9, p: [-0.24, 0.2, 0], roll: 0 },
    ]);
    const ev = [];
    if (!miss) ev.push({ t: 1.75, k: 'grab', arm: 'R' });
    if (!miss && !drop) ev.push({ t: 4.12, k: 'grab', arm: 'L' });
    ev.push({ t: 4.4, k: 'release', arm: 'R' });
    ev.push({ t: 6.5, k: 'release', arm: 'L' });
    return { tracks: { R: Rt, L: Lt }, ev, dur: 7.9, fail: o.fail || null };
  };

  /* single arm, base at (-0.24, 0, 0): pick the cube and place it on the pad */
  R.pickPlaceTask = (o) => {
    const { cx, cz, px, pz } = o, miss = o.fail === 'miss', drop = o.fail === 'drop';
    const gx = miss ? cx - 0.045 : cx;
    const A = V.track([
      { t: 0, p: [-0.06, 0.18, 0], phi: DOWN, roll: 0, g: 0.04 },
      { t: 0.8, p: [gx, 0.11, cz] },
      { t: 1.3, p: [gx, HALF, cz] },
      { t: 1.55, g: miss ? 0.006 : 0.027 },
      { t: 2.1, p: [gx, 0.15, cz] },
      { t: 3.1, p: [px, 0.13, pz] },
      { t: 3.5, p: [px, HALF + 0.008, pz] },
      { t: 3.7, g: 0.04 },
      { t: 4.2, p: [px, 0.16, pz] },
      { t: 5.0, p: [-0.06, 0.18, 0] },
    ]);
    const ev = [];
    if (!miss) ev.push({ t: 1.55, k: 'grab', arm: 'A' });
    ev.push({ t: drop ? 2.55 : 3.7, k: 'release', arm: 'A' });
    return { tracks: { A }, ev, dur: 5.0, fail: o.fail || null };
  };

  /* drives arms along a task's tracks and fires grab / release events in order */
  R.Runner = class {
    constructor(arms, body, restAt) { this.arms = arms; this.body = body; this.restAt = restAt; this.pose = V.pose(); this.task = null; this.local = new T.Vector3(); }
    start(task, t0) { this.task = task; this.t0 = t0; this.i = 0; this.done = false; }
    drive(t, lag = 0, jitter, toWorld) {
      const task = this.task, lt = t - this.t0 - lag;
      for (const k in task.tracks) {
        task.tracks[k].at(lt, this.pose);
        if (jitter) jitter(this.pose.p, k, t);
        if (toWorld) toWorld(this.pose.p);
        this.arms[k].solve(this.pose.p, this.pose.phi, this.pose.roll, this.pose.g);
      }
      while (this.i < task.ev.length && task.ev[this.i].t <= lt) {
        const e = task.ev[this.i++], tool = this.arms[e.arm].tool;
        if (e.k === 'grab') this.body.grab(tool);
        else if (this.body.held === tool) { this.body.release(); this.body.rest = this.restAt(this.body.m.position); }
      }
      this.done = lt >= task.dur;
      return lt;
    }
  };

  /* overhead camera on a gantry */
  R.gantry = (world, o = {}) => {
    const z = o.z === undefined ? -0.33 : o.z, h = o.h || 0.78, w = o.w || 0.6;
    for (const s of [-1, 1]) { const p = V.box(0.022, h, 0.022, 'body2', 'ink'); p.position.set(s * w, h / 2, z); world.add(p); }
    const bar = V.box(2 * w + 0.022, 0.022, 0.022, 'body2', 'ink'); bar.position.set(0, h, z); world.add(bar);
    const c = V.camRig({ fov: 62, len: o.len || 0.24, role: o.role || 'data' });
    c.group.position.set(0, h - 0.03, z + 0.04); world.add(c.group);
    c.group.lookAt(new T.Vector3(0, 0, o.lookZ === undefined ? 0.03 : o.lookZ).applyMatrix4(world.matrixWorld));
    return c;
  };
  /* camera on the wrist, looking along the jaws */
  R.wristCam = (arm, o = {}) => {
    const tilt = new T.Group(); tilt.rotation.z = -0.3; arm.mount.add(tilt);
    const c = V.camRig({ s: 0.55 * arm.s, fov: 84, len: 0.06 * arm.s, role: o.role || 'data' });
    c.group.rotation.y = PI / 2; tilt.add(c.group);
    return c;
  };

  /* Jetson-class edge computer: carrier board, heatsink fins, status LED */
  R.edgeBox = (s = 1) => {
    const g = new T.Group();
    const board = V.box(0.17 * s, 0.014 * s, 0.13 * s, 'body2', 'ink'); board.position.y = 0.007 * s; g.add(board);
    const mod = V.box(0.11 * s, 0.01 * s, 0.09 * s, 'body', 'ink'); mod.position.y = 0.019 * s; g.add(mod);
    for (let i = 0; i < 8; i++) { const f = V.box(0.004 * s, 0.026 * s, 0.09 * s, 'body', 'ink'); f.position.set((-0.049 + i * 0.014) * s, 0.037 * s, 0); g.add(f); }
    for (let i = 0; i < 3; i++) { const p = V.box(0.022 * s, 0.012 * s, 0.014 * s, 'body', 'ink'); p.position.set((-0.05 + i * 0.03) * s, 0.02 * s, 0.065 * s); g.add(p); }
    const ledMat = V.flat('soft');
    const led = new T.Mesh(V.geo('led', () => new T.BoxGeometry(0.014, 0.008, 0.008)), ledMat); led.scale.setScalar(s);
    led.position.set(0.07 * s, 0.018 * s, 0.062 * s); g.add(led);
    g.userData.led = ledMat;
    return g;
  };

  /* a boxy teleoperator; hands follow two target points */
  R.operator = () => {
    const g = new T.Group();
    for (const s of [-1, 1]) { const leg = V.box(0.1, 0.56, 0.12, 'body', 'ink'); leg.position.set(s * 0.075, 0.28, 0); g.add(leg); }
    const torso = V.box(0.32, 0.5, 0.17, 'body', 'ink'); torso.position.y = 0.81; g.add(torso);
    const neck = V.box(0.07, 0.06, 0.07, 'body2', 'ink'); neck.position.y = 1.09; g.add(neck);
    const head = V.box(0.17, 0.2, 0.18, 'body', 'ink'); head.position.y = 1.22; g.add(head);
    const limbs = [];
    for (const s of [-1, 1]) {
      const up = V.cyl(0.032, 0.032, 1, 12, 'body', 'ink'), lo = V.cyl(0.028, 0.028, 1, 12, 'body', 'ink');
      const hand = V.box(0.06, 0.05, 0.07, 'body2', 'ink');
      g.add(up, lo, hand); limbs.push({ s, up, lo, hand });
    }
    const S = new T.Vector3(), E = new T.Vector3(), H = new T.Vector3(), d = new T.Vector3(), bend = new T.Vector3();
    return {
      group: g,
      reach(handsWorld) { // [left, right] world points
        g.updateMatrixWorld();
        limbs.forEach((l, i) => {
          S.set(l.s * 0.19, 1.04, 0); H.copy(handsWorld[i]); g.worldToLocal(H);
          const a = 0.32, b = 0.32;
          d.subVectors(H, S); const dist = Math.min(d.length(), a + b - 1e-3); d.normalize();
          const along = (a * a - b * b + dist * dist) / (2 * dist), hh = Math.sqrt(Math.max(0, a * a - along * along));
          bend.set(l.s * 0.8, -1, -0.2); bend.addScaledVector(d, -bend.dot(d)).normalize();
          E.copy(S).addScaledVector(d, along).addScaledVector(bend, hh);
          H.copy(S).addScaledVector(d, dist);
          V.between(l.up, S, E); V.between(l.lo, E, H); l.hand.position.copy(H);
        });
      },
    };
  };

  /* a transformer layer drawn as a thin floor slab with its own (glowable) material */
  R.floor = (w, d, fill = 'trainFill', edge = 'train', h = 0.04) => {
    const m = new T.Mesh(V.geo(`b${w},${h},${d}`, () => new T.BoxGeometry(w, h, d)), V.surfNew(fill));
    m.castShadow = true; m.receiveShadow = true; V.edges(m, edge);
    m.material.emissive = new T.Color(0); m.userData.fill = fill;
    return m;
  };
  R.flash = (floorMesh, cat, k) => { V.glow(floorMesh.material, cat, k); };

  /* card with a texture (image patch / word) and an outline */
  R.card = (w, h, map, edge = 'ink') => {
    const m = new T.Mesh(V.geo(`p${w},${h}`, () => new T.PlaneGeometry(w, h)), new T.MeshBasicMaterial({ map, side: T.DoubleSide, transparent: true }));
    if (edge) V.edges(m, edge);
    return m;
  };
})();
