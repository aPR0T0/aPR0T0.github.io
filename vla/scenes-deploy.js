/* vla/scenes-deploy.js: scenes 02 (teleop data collection), 06 evaluation, 07 optimize for edge, 08 deployment. */
(function () {
  'use strict';
  const T = THREE, V = VLA, R = V.R, PI = Math.PI, DOWN = R.DOWN, HALF = R.HALF;
  const { clamp, lerp, smooth, easeIO, seg, rng, gauss } = V;
  const vec = (x, y, z) => new T.Vector3(x, y, z);
  const S = V.scenes;
  const pad = (n, k) => String(n).padStart(k, '0');

  function binSetup(world, bx, bz) {
    const bin = V.bin(0.13, 0.13, 0.06); bin.position.set(bx, 0, bz); world.add(bin);
    return (p) => (Math.abs(p.x - bx) < 0.06 && Math.abs(p.z - bz) < 0.06 ? 0.008 + HALF : HALF);
  }
  // Wilson score interval, 95%
  function wilson(k, n) {
    if (!n) return [0, 1];
    const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
    return [Math.max(0, c - h), Math.min(1, c + h)];
  }
  V.wilson = wilson;

  /* ================= 02 · robot data: leader-follower teleoperation ================= */
  S[2] = {
    id: 'data', cat: 'data', title: 'robot data', sub: 'teleop demos',
    cam: { pos: [1.42, 1.22, 1.72], target: [-0.08, 0.16, -0.36], fov: 42 },
    caption: 'An operator moves two small leader arms; the follower arms copy their joint angles at 50 Hz. Every step logs the three camera images (two shown bottom-right), the joint state and the commanded action, and the episode goes on the dataset stack.',
    build(ctx) {
      const scene = V.makeScene({ floor: -0.58, fog: [2.6, 7], shadowR: 1.4, target: [0, 0, -0.3] });
      const F = R.rig(); scene.add(F.world);
      const bx = -0.2, bz = -0.13, restAt = binSetup(F.world, bx, bz);
      const cube = R.cube(F.world);
      const run = new R.Runner(F.arms, cube, restAt);
      // leader station behind the follower table
      const desk = V.table(0.82, 0.34, { legs: 0.55 }); desk.position.set(0, 0, -0.74); scene.add(desk);
      const LS = 0.6, lead = { L: V.arm({ scale: LS, role: 'dataFill', role2: 'body2', edge: 'data' }), R: V.arm({ scale: LS, role: 'dataFill', role2: 'body2', edge: 'data' }) };
      lead.L.root.position.set(-0.25, 0, -0.74); lead.R.root.position.set(0.25, 0, -0.74); lead.R.root.rotation.y = PI;
      scene.add(lead.L.root, lead.R.root);
      const op = R.operator(); op.group.position.set(0, -0.58, -1.08); op.group.scale.setScalar(0.9); scene.add(op.group);
      ctx.labels.add('leader arms (operator)', vec(0, 0.2, -0.74), { cls: 'data' });
      ctx.labels.add('follower arms', vec(0.42, 0.3, 0.1), { cls: '' });
      // cameras
      const top = R.gantry(F.world, { z: -0.36, lookZ: 0.04 });
      const wl = R.wristCam(F.L), wr = R.wristCam(F.R);
      ctx.labels.add('cam_high', top.group, { off: [0, 0.05, 0], cls: 'data' });
      // recorded trajectories
      const NTR = 140, trail = { L: [], R: [] }, lines = { L: V.dynLine(NTR, V.line('data', 0.9)), R: V.dynLine(NTR, V.line('data', 0.9)) };
      scene.add(lines.L, lines.R);
      // dataset stack on the table corner
      const plates = [];
      for (let i = 0; i < 12; i++) { const p = V.box(0.11, 0.007, 0.08, 'dataFill', 'data'); p.position.set(-0.52, 0.0035 + i * 0.0095, 0.25); p.visible = false; F.world.add(p); plates.push(p); }
      const stackLbl = ctx.labels.add('', vec(-0.52, 0.13, 0.25), { cls: 'data' });
      const flyer = V.box(0.11, 0.007, 0.08, 'data', null); flyer.visible = false; scene.add(flyer);
      const rnd = rng(11);
      let ep = 23, t0 = 0, shown = 0, fly = -1;
      const jit = (p, k, t) => { const s = k === 'L' ? 1.7 : 0.3; p.x += 0.006 * Math.sin(t * 5.3 + s) + 0.003 * Math.sin(t * 11.7 + s); p.y += 0.004 * Math.sin(t * 6.1 + s * 2); p.z += 0.006 * Math.sin(t * 4.7 + s * 3); };
      const P = vec(0, 0, 0), tp = vec(0, 0, 0), hands = [vec(0, 0, 0), vec(0, 0, 0)];
      function next(t) {
        const cx = 0.1 + rnd() * 0.1, cz = -0.06 + rnd() * 0.16;
        cube.place(cx, HALF, cz, F.R.yawTo(vec(cx, HALF, cz)));
        cube.rest = HALF;
        run.start(R.transferTask({ cx, cz, bx, bz }), t); t0 = t; ep++;
        trail.L.length = 0; trail.R.length = 0;
      }
      next(0);
      return {
        scene,
        insets: [{ cam: top.cam, label: 'cam_high' }, { cam: wl.cam, label: 'cam_left_wrist' }],
        update(t, dt) {
          if (run.done) { fly = t; next(t); }
          // leaders follow the operator's hands now; followers copy their joint angles ~80 ms later
          const lt = run.drive(t, 0, jit);
          for (const k of ['L', 'R']) { lead[k].set(F.arms[k].q); lead[k].grip(F.arms[k].q[5] / F.arms[k].s); }
          run.drive(t, 0.08, jit);
          cube.step(dt);
          lead.L.toolPos(hands[0]); lead.R.toolPos(hands[1]);
          hands[0].y += 0.02; hands[1].y += 0.02;
          op.reach(hands);
          for (const k of ['L', 'R']) {
            F.arms[k].toolPos(tp); const tr = trail[k];
            tr.push(tp.clone()); if (tr.length > NTR) tr.shift();
            lines[k].set(tr, tr.length);
          }
          // the finished episode flies onto the stack
          const fu = fly >= 0 ? seg(t - fly, 0, 0.8) : 1;
          const n = Math.min(12, (ep - 24) % 13);
          const stackN = fu < 1 ? Math.max(0, n - 1) : n;
          plates.forEach((p, i) => (p.visible = i < stackN));
          flyer.visible = fu < 1 && n > 0;
          if (flyer.visible) {
            P.set(0, 0.3, 0).lerp(vec(-0.52, 0.0035 + (n - 1) * 0.0095, 0.25), easeIO(fu)); P.y += Math.sin(fu * PI) * 0.15;
            flyer.position.copy(P);
          }
          stackLbl.set(`dataset · ${ep - 1} episodes`);
          const rec = Math.floor(t * 2) % 2 ? '●' : '○';
          ctx.hud(`${rec} REC  episode ${pad(ep, 3)} · t ${lt.toFixed(2).padStart(5, '0')} s\nrate   50 Hz\nobs    cam_high + 2 wrist cams · 14 joint pos\naction 14 target joint positions (leader)\nlabel  "put the cube in the bin"`);
        },
      };
    },
  };

  /* ================= 06 · evaluation: sim and real trials ================= */
  S[6] = {
    id: 'eval', cat: 'deploy', title: 'evaluation', sub: 'sim + real trials',
    cam: { pos: [0.02, 1.38, 2.5], target: [0, 0.16, -0.1], fov: 42 },
    caption: 'The same checkpoint runs 20 trials in simulation (left, wireframe) and on the real rig (right) with randomized cube positions. Each square is a trial; the interval shows how little 20 trials can tell you. Failures go back as data.',
    build(ctx) {
      const scene = V.makeScene({ floor: -0.46, fog: [3, 7], shadowR: 1.5, gridSize: 8 });
      const SC = 0.8, sides = [];
      for (const [k, x, sim] of [['sim', -0.6, true], ['real', 0.6, false]]) {
        const ao = sim ? { role: 'bg', role2: 'bg', edge: 'muted' } : {};
        const rg = R.rig({ legs: 0.55, arm: ao, tableRole: sim ? 'bg' : undefined });
        rg.world.scale.setScalar(SC); rg.world.position.x = x; scene.add(rg.world);
        if (sim) { const g = V.grid(1.2, 0.05, 'soft', 0.8); g.position.y = 0.001; g.scale.set(1.08, 1, 0.6); rg.world.add(g); }
        const bx = -0.2, bz = -0.13, restAt = binSetup(rg.world, bx, bz);
        const cube = R.cube(rg.world, sim ? 'bg' : 'deploy', sim ? 'deploy' : 'ink');
        const run = new R.Runner(rg.arms, cube, restAt);
        // tally board: 20 trials
        const board = new T.Group(); board.position.set(x, 0.5, -0.38); scene.add(board);
        const sq = [];
        for (let i = 0; i < 20; i++) {
          const m = V.box(0.042, 0.042, 0.008, 'faint', 'soft', { cast: false }); m.material = V.surfNew('faint'); m.position.set(-0.27 + (i % 10) * 0.06, (i < 10 ? 0.035 : -0.035), 0);
          const xm = V.segments([vec(-0.014, -0.014, 0.006), vec(0.014, 0.014, 0.006), vec(-0.014, 0.014, 0.006), vec(0.014, -0.014, 0.006)], V.line('ink', 1)); xm.visible = false; m.add(xm);
          board.add(m); sq.push({ m, xm });
        }
        const lbl = ctx.labels.add('', vec(x, 0.44, -0.38), { cls: 'down ' + (sim ? '' : 'deploy') });
        ctx.labels.add(sim ? 'simulation' : 'real robot', vec(x, 0.0, 0.34 * SC), { cls: 'down' });
        sides.push({ k, sim, rg, cube, run, sq, lbl, n: 0, wins: 0, res: [], p: sim ? 0.88 : 0.68, rnd: rng(sim ? 3 : 9), bx, bz, speed: sim ? 1.35 : 1.15, x });
      }
      const pk = V.box(0.035, 0.035, 0.035, 'deploy', null); pk.visible = false; scene.add(pk);
      const pkTrail = V.dynLine(30, V.dash('deploy', 0.03, 0.02, 1)); scene.add(pkTrail);
      let pkT = -1; const pkFrom = vec(0, 0, 0), pkTo = vec(-1.55, 1.1, -0.9), pkPts = [];
      const fbLbl = ctx.labels.add('failure → triage → new data / RL', pkTo, { cls: 'deploy' }); fbLbl.show(false);
      function start(sd, t) {
        const r = sd.rnd, cx = 0.1 + r() * 0.1, cz = -0.08 + r() * 0.17;
        const ok = r() < sd.p, fail = ok ? null : r() < 0.55 ? 'drop' : 'miss';
        sd.rg.world.updateMatrixWorld();
        sd.cube.place(cx, HALF, cz, sd.rg.R.yawTo(sd.rg.world.localToWorld(vec(cx, HALF, cz))));
        sd.cube.rest = HALF;
        sd.run.start(R.transferTask({ cx, cz, bx: sd.bx, bz: sd.bz, fail }), t);
        sd.ok = ok;
      }
      const toW = (sd) => (p) => sd.rg.world.localToWorld(p);
      sides.forEach((sd) => start(sd, 0));
      return {
        scene,
        update(t, dt) {
          sides.forEach((sd) => {
            const st = t * sd.speed;
            sd.run.drive(st, 0, null, toW(sd));
            sd.cube.step(dt * sd.speed);
            if (sd.run.done) {
              if (sd.n >= 20) { sd.n = 0; sd.wins = 0; sd.res.length = 0; sd.sq.forEach((q) => { V.role(q.m.material, 'faint'); q.xm.visible = false; }); }
              const i = sd.n++; if (sd.ok) sd.wins++;
              V.role(sd.sq[i].m.material, sd.ok ? 'good' : 'bad'); sd.sq[i].xm.visible = !sd.ok;
              if (!sd.ok && !sd.sim && pkT < 0) { pkT = t; sd.sq[i].m.getWorldPosition(pkFrom); }
              start(sd, st);
            }
            const [lo, hi] = wilson(sd.wins, sd.n);
            sd.lbl.set(sd.n ? `${sd.k} ${sd.wins}/${sd.n} = ${Math.round((sd.wins / sd.n) * 100)}% · 95% CI ${Math.round(lo * 100)}–${Math.round(hi * 100)}%` : `${sd.k} 0/0`);
          });
          // a failure packet flies off toward the data stage
          if (pkT >= 0) {
            const u = seg(t - pkT, 0, 1.4);
            const P = pkFrom.clone().lerp(pkTo, easeIO(u)); P.y += Math.sin(u * PI) * 0.35;
            pk.position.copy(P); pk.visible = u < 1;
            pkPts.push(P); if (pkPts.length > 30) pkPts.shift();
            pkTrail.set(pkPts, pkPts.length);
            fbLbl.show(u > 0.5 && t - pkT < 3.2);
            if (t - pkT > 3.2) { pkT = -1; pkPts.length = 0; pkTrail.set(pkPts, 0); }
          }
          const s = sides[0], r = sides[1];
          ctx.hud(`checkpoint  post-train · 30k steps\ntask        "put the cube in the bin"\nsim  ${s.wins}/${s.n}    real ${r.wins}/${r.n}\nmetric      success rate + 95% Wilson interval`);
        },
      };
    },
  };

  /* ================= 07 · optimize for edge: quantize, fuse, ship ================= */
  S[7] = {
    id: 'edge', cat: 'deploy', title: 'optimize for edge', sub: 'compress + compile',
    cam: { pos: [0.42, 1.85, 3.05], target: [0.34, 0.1, 0.12], fov: 42 },
    caption: 'Each column is one weight. bf16 values snap to 16 int4 levels and take a quarter of the memory; the Q, K and V projections fuse into one kernel; the compiled engine drops onto the robot\'s edge computer. Numbers are illustrative.',
    build(ctx) {
      const scene = V.makeScene({ floor: -0.03, fog: [4, 9], shadowR: 2, gridSize: 10, gridStep: 0.25 });
      const N = 8, NB = 3, names = ['W_q', 'W_k', 'W_v'], r = rng(4);
      const geo = new T.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
      const mat = V.surfNew('train');
      const inst = new T.InstancedMesh(geo, mat, N * N * NB); inst.castShadow = true; inst.receiveShadow = true; inst.frustumCulled = false; scene.add(inst);
      const vals = [];
      for (let i = 0; i < N * N * NB; i++) vals.push(clamp(0.13 + 0.07 * gauss(r), 0.015, 0.3));
      const q = (v) => Math.round(v / 0.02) * 0.02; // 16 levels over 0..0.3
      const blockOut = [];
      for (let b = 0; b < NB; b++) {
        const o = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)), V.lineNew('train', 1)); o.geometry.translate(0, 0.5, 0); scene.add(o); blockOut.push(o);
        ctx.labels.add(names[b], o, { off: [0, 0.42, 0], cls: 'train' });
      }
      const fuseBox = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)), V.lineNew('deploy', 1)); fuseBox.geometry.translate(0, 0.5, 0); scene.add(fuseBox);
      const fuseLbl = ctx.labels.add('fused QKV kernel · TensorRT engine', fuseBox, { off: [0, 0.42, 0], cls: 'deploy' });
      // the edge computer
      const jet = R.edgeBox(3.2); jet.position.set(1.12, 0, 0.62); scene.add(jet);
      ctx.labels.add('edge computer (Jetson-class)', jet, { off: [0, 0.22, 0], cls: 'deploy' });
      const phaseLbl = ctx.labels.add('', vec(-0.15, 0.0, 0.5), { cls: 'down deploy' });
      const M = new T.Matrix4(), Q = new T.Quaternion(), Pv = vec(0, 0, 0), Sv = vec(1, 1, 1);
      const CYCLE = 10.5;
      return {
        scene,
        update(t) {
          const lt = t % CYCLE;
          const qz = easeIO(seg(lt, 1.6, 3.2)), fu = easeIO(seg(lt, 3.8, 5.4)), go = easeIO(seg(lt, 6.0, 7.6)), back = smooth(seg(lt, 9.6, 10.4));
          const pitch = lerp(0.1, 0.05, qz), foot = lerp(0.088, 0.044, qz);
          const span = N * pitch;
          const centers = [0, 1, 2].map((b) => lerp((b - 1) * 1.05, (b - 1) * span, fu));
          V.role(mat, qz > 0.5 ? 'deploy' : 'train');
          // shrink into the edge box
          const sc = lerp(1, 0.18, go) * (1 - back) + back;
          const shift = vec(0.0, 0, 0).lerp(vec(1.12, 0.2, 0.62), go).multiplyScalar(1 - back);
          let i = 0;
          for (let b = 0; b < NB; b++) {
            for (let a = 0; a < N; a++) for (let c = 0; c < N; c++, i++) {
              const v = lerp(vals[i], q(vals[i]), qz) + (qz < 0.01 ? 0.004 * Math.sin(t * 3 + i) : 0);
              Pv.set((centers[b] + (a - (N - 1) / 2) * pitch) * sc + shift.x, shift.y, ((c - (N - 1) / 2) * pitch) * sc + shift.z);
              Sv.set(foot * sc, Math.max(0.002, v * sc), foot * sc);
              M.compose(Pv, Q, Sv); inst.setMatrixAt(i, M);
            }
            const o = blockOut[b];
            o.position.set(centers[b] * sc + shift.x, shift.y, shift.z); o.scale.set(span * sc + 0.02, 0.33 * sc, span * sc + 0.02);
            o.visible = fu < 0.5 && go < 0.95;
            V.role(o.material, qz > 0.5 ? 'deploy' : 'train');
          }
          inst.instanceMatrix.needsUpdate = true;
          fuseBox.visible = fu >= 0.5 && go < 0.95;
          fuseBox.position.set(shift.x, shift.y, shift.z); fuseBox.scale.set(3 * span * sc + 0.03, 0.33 * sc, span * sc + 0.03);
          fuseLbl.show(fuseBox.visible);
          ctx.labels.items.forEach((it) => { if (names.includes(it.text)) it.show(fu < 0.5 && go < 0.6); });
          inst.visible = go < 0.98 || back > 0.02;
          const led = jet.userData.led; V.role(led, lt > 7.6 && lt < 9.6 && Math.floor(lt * 6) % 2 ? 'deploy' : 'soft');
          const ph = lt < 1.6 ? 'bf16 · 16 bits per weight' : lt < 3.8 ? 'quantize → int4 · 16 levels, ¼ the memory' : lt < 6 ? 'compile · fuse Q, K, V into one kernel' : lt < 7.6 ? 'ship the engine to the robot' : 'running on the edge computer';
          phaseLbl.set(ph);
          ctx.hud(`model      3.3B params (π0-sized, illustrative)\nweights    bf16 6.6 GB → int4 ≈ 1.9 GB\ncompute    fewer flow steps · cached prefix\ntarget     one chunk well under the 0.5 s budget`);
        },
      };
    },
  };

  /* ================= 08 · deployment: the bimanual control loop ================= */
  S[8] = {
    id: 'deploy', cat: 'deploy', title: 'deployment', sub: 'robot control loop',
    cam: { pos: [0.3, 0.88, 1.4], target: [-0.02, 0.2, -0.08], fov: 44 },
    caption: 'The finished policy on the robot. Every 0.5 s the VLA reads the cameras and joints and predicts the next 50 actions (the dotted path ahead of each gripper); the arms execute them at 50 Hz while the next chunk is computed.',
    build(ctx) {
      const scene = V.makeScene({ floor: -0.58, fog: [2.2, 6], shadowR: 0.95 });
      const r = R.rig(); scene.add(r.world);
      const bx = -0.2, bz = -0.13, restAt = binSetup(r.world, bx, bz);
      const cube = R.cube(r.world);
      const run = new R.Runner(r.arms, cube, restAt);
      const top = R.gantry(r.world, { z: -0.33 });
      const wl = R.wristCam(r.L, { role: 'deploy' }), wr = R.wristCam(r.R, { role: 'deploy' });
      const jet = R.edgeBox(1); jet.position.set(-0.5, 0, -0.26); jet.rotation.y = 0.35; r.world.add(jet);
      ctx.labels.add('1 · observe (3 cams + joints)', top.group, { off: [-0.05, -0.01, 0], cls: 'deploy right down' });
      ctx.labels.add('2 · infer (VLA on edge)', jet, { off: [0, 0.06, 0], cls: 'deploy' });
      const actLbl = ctx.labels.add('3 · act @ 50 Hz', r.R.tool, { off: [0, 0.07, 0], cls: 'deploy' });
      const H = 50, DTA = 0.02, REPLAN = 0.5;
      const chunk = {}, line = {}, exec = {}, execL = {};
      for (const k of ['L', 'R']) {
        chunk[k] = []; for (let i = 0; i < H; i++) chunk[k].push(vec(0, 0, 0));
        line[k] = V.dynLine(H, V.pointsMat('deploy', 0.017), T.Points); scene.add(line[k]);
        line[k].path = V.dynLine(H, V.lineNew('deploy', 0.45)); scene.add(line[k].path);
        exec[k] = []; execL[k] = V.dynLine(60, V.line('ink', 0.35)); scene.add(execL[k]);
      }
      const rnd = rng(21);
      let ep = 0, nchunk = 0, lastPlan = -1;
      const pose = V.pose(), tp = vec(0, 0, 0);
      function next(t) {
        const cx = 0.1 + rnd() * 0.1, cz = -0.08 + rnd() * 0.17;
        cube.place(cx, HALF, cz, r.R.yawTo(vec(cx, HALF, cz))); cube.rest = HALF;
        run.start(R.transferTask({ cx, cz, bx, bz }), t); ep++;
      }
      next(0);
      function plan(t) {
        nchunk++;
        const lt = t - run.t0, cr = rng(nchunk * 17 + 5);
        for (const k of ['L', 'R']) {
          const d = vec(gauss(cr), gauss(cr) * 0.6, gauss(cr));
          for (let i = 0; i < H; i++) {
            run.task.tracks[k].at(lt + i * DTA, pose);
            const u = Math.pow(i / H, 1.6) * 0.016;
            chunk[k][i].copy(pose.p).addScaledVector(d, u);
          }
          line[k].set(chunk[k], H); line[k].path.set(chunk[k], H);
        }
        lastPlan = t;
      }
      return {
        scene,
        insets: [{ cam: top.cam, label: 'cam_high' }, { cam: wr.cam, label: 'cam_right_wrist' }],
        update(t, dt) {
          if (run.done) { next(t); lastPlan = -1; }
          if (lastPlan < 0 || t - lastPlan >= REPLAN) plan(t);
          run.drive(t);
          cube.step(dt);
          for (const k of ['L', 'R']) {
            r.arms[k].toolPos(tp); const e = exec[k]; e.push(tp.clone()); if (e.length > 60) e.shift(); execL[k].set(e, e.length);
          }
          const flash = t - lastPlan < 0.12;
          V.role(jet.userData.led, flash ? 'deploy' : 'soft');
          const since = Math.min(H, Math.round((t - lastPlan) / DTA));
          ctx.hud(`› "put the cube in the bin"\nepisode ${pad(ep, 3)} · chunk #${pad(nchunk, 4)} · step ${pad(since, 2)}/25\ninference every 0.5 s · control 50 Hz\nchunk H = 50 (1 s) · execute 25, replan`);
        },
      };
    },
  };
})();
