/* vla/scenes-train.js: scenes 00 (pipeline overview), 01 VLM pretraining, 03 VLA pretraining,
   04 post-training and 05 RL. Each build(ctx) returns { scene, update(t, dt), insets?, pick?, onHover?, onPick? }. */
(function () {
  'use strict';
  const T = THREE, V = VLA, R = V.R, PI = Math.PI, DOWN = R.DOWN, HALF = R.HALF;
  const { clamp, lerp, smooth, easeIO, seg, rng, gauss } = V;
  const vec = (x, y, z) => new T.Vector3(x, y, z);
  const S = V.scenes;

  /* ================= 00 · the pipeline, as a 3D node graph ================= */
  S[0] = {
    id: 'overview', cat: 'all', title: 'the pipeline', sub: '8 stages',
    cam: { pos: [0, 6.6, 4.4], target: [0, -0.15, 0.2], fov: 40 },
    caption: 'The whole recipe as a graph. A pulse runs the pipeline; the dashed loop sends failures from the edge build back to evaluation. Hover a block, click to jump to its stage.',
    build(ctx) {
      const scene = V.makeScene({ floor: -0.1, fog: [8, 17], shadowR: 3.6, sun: [1.5, 6, 3], gridSize: 8, gridStep: 0.5 });
      const NW = 1.42, NH = 0.2, ND = 0.8, XS = [-2.37, -0.79, 0.79, 2.37], ZS = [-0.82, 0.82];
      const nodes = V.STAGES.map((st, i) => {
        const x = XS[i % 4], z = ZS[i >> 2];
        const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
        const m = new T.Mesh(V.geo(`b${NW},${NH},${ND}`, () => new T.BoxGeometry(NW, NH, ND)), V.surfNew(st.cat + 'Fill'));
        m.castShadow = m.receiveShadow = true; V.edges(m, st.cat); g.add(m);
        const tex = V.canvasTex(600, 336, (c, P, w, h) => {
          c.fillStyle = P[st.cat + 'Fill']; c.fillRect(0, 0, w, h);
          c.fillStyle = P.muted; c.font = V.font(30, 500); c.textBaseline = 'top'; c.fillText(String(i + 1).padStart(2, '0'), 24, 20);
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillStyle = P.ink; c.font = V.font(52, 600); c.fillText(st.t, w / 2, h / 2 - 14);
          c.fillStyle = P[st.cat]; c.font = V.font(36, 500); c.fillText(st.s, w / 2, h / 2 + 48);
        });
        const top = new T.Mesh(V.geo('ptop', () => new T.PlaneGeometry(NW - 0.03, ND - 0.03)), new T.MeshBasicMaterial({ map: tex }));
        top.rotation.x = -PI / 2; top.position.y = NH / 2 + 0.002; g.add(top);
        m.userData.idx = i; top.userData.idx = i;
        return { g, m, top, x, z, lift: 0, hover: 0 };
      });
      // connectors
      const ink = V.line('muted', 1);
      const arrow = (p, dir) => { const c = V.cone(0.035, 0.09, 'muted'); c.position.copy(p); c.quaternion.setFromUnitVectors(vec(0, 1, 0), dir); scene.add(c); };
      for (let i = 0; i < 7; i++) {
        if (i === 3) continue;
        const a = nodes[i], b = nodes[i + 1];
        scene.add(V.polyline([vec(a.x + NW / 2, 0, a.z), vec(b.x - NW / 2 - 0.05, 0, b.z)], ink));
        arrow(vec(b.x - NW / 2 - 0.045, 0, b.z), vec(1, 0, 0));
      }
      scene.add(V.polyline([vec(2.37, 0, -0.82 + ND / 2), vec(2.37, 0, 0), vec(-2.37, 0, 0), vec(-2.37, 0, 0.82 - ND / 2 - 0.05)], ink));
      arrow(vec(-2.37, 0, 0.82 - ND / 2 - 0.045), vec(0, 0, 1));
      // dashed feedback: optimize-for-edge -> evaluation
      const fb = [vec(0.6, NH / 2, 0.82), vec(0.6, 0.62, 0.82), vec(-0.6, 0.62, 0.82), vec(-0.6, NH / 2 + 0.06, 0.82)];
      scene.add(V.polyline(fb, V.dash('deploy', 0.07, 0.05)));
      const fbHead = V.cone(0.035, 0.09, 'deploy'); fbHead.position.set(-0.6, NH / 2 + 0.05, 0.82); fbHead.rotation.z = PI; scene.add(fbHead);
      ctx.labels.add('failures feed back', vec(0, 0.62, 0.82), { cls: 'deploy up' });

      // pulse along the main path
      const path = new T.CurvePath(), via = [[-2.37, -0.82], [-0.79, -0.82], [0.79, -0.82], [2.37, -0.82], [2.37, 0], [-2.37, 0], [-2.37, 0.82], [-0.79, 0.82], [0.79, 0.82], [2.37, 0.82]].map(([x, z]) => vec(x, 0.03, z));
      for (let i = 0; i < via.length - 1; i++) path.add(new T.LineCurve3(via[i], via[i + 1]));
      const lens = path.getCurveLengths(), total = path.getLength();
      const nodeU = [0, 1, 2, 3, 6, 7, 8, 9].map((k) => (k === 0 ? 0 : lens[k - 1]) / total);
      const pulse = V.box(0.07, 0.07, 0.07, 'ink', null); scene.add(pulse);
      const trail = V.dynLine(24, V.line('ink', 0.5)); scene.add(trail);
      const hist = [];
      const fpath = new T.CurvePath(); for (let i = 0; i < fb.length - 1; i++) fpath.add(new T.LineCurve3(fb[i], fb[i + 1]));
      const fpulse = V.box(0.06, 0.06, 0.06, 'deploy', null); scene.add(fpulse);
      const PERIOD = 11;
      let hovered = -1;
      const tmp = vec(0, 0, 0);
      return {
        scene,
        pick: nodes.flatMap((n) => [n.m, n.top]),
        onHover(i) { hovered = i === null || i === undefined ? -1 : i; },
        onPick(i) { ctx.goto(i + 1); },
        update(t, dt) {
          const u = (t % PERIOD) / (PERIOD - 1.2);
          const on = u <= 1;
          pulse.visible = on;
          if (on) { tmp.copy(path.getPointAt(clamp(u, 0, 1))); pulse.position.copy(tmp); hist.push(tmp.clone()); }  // r128 CurvePath ignores the target arg
          if (hist.length > 24 || (!on && hist.length)) hist.shift();
          trail.set(hist, hist.length);
          nodes.forEach((n, i) => {
            const near = on ? Math.max(0, 1 - Math.abs(u - nodeU[i]) * total / 0.9) : 0;
            n.hover += ((hovered === i ? 1 : 0) - n.hover) * Math.min(1, dt * 10);
            const k = Math.max(smooth(near), n.hover);
            n.g.position.y = 0.06 * k;
            V.glow(n.m.material, V.STAGES[i].cat, 0.35 * k);
          });
          // feedback pulse runs backwards once the main pulse has passed "optimize for edge"
          const fu = (u - nodeU[6]) / 0.12;
          fpulse.visible = on && fu > 0 && fu < 1;
          if (fpulse.visible) fpulse.position.copy(fpath.getPointAt(clamp(fu, 0, 1)));
        },
      };
    },
  };

  /* ---------- procedural "internet images" for scene 01 ---------- */
  const IMAGES = [
    {
      words: ['a', 'red', 'mug', 'on', 'a'], next: 'desk',
      draw(c, P, w, h) {
        c.fillStyle = P.body; c.fillRect(0, 0, w, h);
        c.strokeStyle = P.ink; c.lineWidth = 5;
        c.fillStyle = P.body2; c.fillRect(0, 186, w, h - 186); c.beginPath(); c.moveTo(0, 186); c.lineTo(w, 186); c.stroke();
        c.fillStyle = P.deploy; c.beginPath(); c.moveTo(78, 92); c.lineTo(164, 92); c.lineTo(158, 182); c.quadraticCurveTo(121, 196, 84, 182); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.ellipse(121, 92, 43, 10, 0, 0, 2 * PI); c.stroke();
        c.beginPath(); c.arc(170, 132, 22, -PI / 2.2, PI / 2.2); c.stroke();
        c.lineWidth = 3; for (const x of [104, 122, 140]) { c.beginPath(); c.moveTo(x, 74); c.bezierCurveTo(x - 9, 60, x + 9, 50, x, 34); c.stroke(); }
      },
    },
    {
      words: ['a', 'banana', 'in', 'a'], next: 'bowl',
      draw(c, P, w, h) {
        c.fillStyle = P.body; c.fillRect(0, 0, w, h);
        c.strokeStyle = P.ink; c.lineWidth = 5;
        c.fillStyle = P.body2; c.fillRect(0, 196, w, h - 196); c.beginPath(); c.moveTo(0, 196); c.lineTo(w, 196); c.stroke();
        c.fillStyle = '#e2b437'; c.beginPath(); c.moveTo(62, 102); c.quadraticCurveTo(128, 168, 200, 92); c.quadraticCurveTo(204, 84, 196, 84); c.quadraticCurveTo(128, 136, 70, 92); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = P.trainFill; c.beginPath(); c.moveTo(40, 120); c.lineTo(216, 120); c.quadraticCurveTo(206, 194, 128, 196); c.quadraticCurveTo(50, 194, 40, 120); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(34, 120); c.lineTo(222, 120); c.stroke();
      },
    },
    {
      words: ['the', 'top', 'drawer', 'is'], next: 'open',
      draw(c, P, w, h) {
        c.fillStyle = P.body; c.fillRect(0, 0, w, h);
        c.strokeStyle = P.ink; c.lineWidth = 5;
        c.fillStyle = P.body2; c.fillRect(54, 60, 148, 170); c.strokeRect(54, 60, 148, 170);
        c.strokeRect(66, 150, 124, 66); c.beginPath(); c.moveTo(112, 183); c.lineTo(144, 183); c.stroke();
        c.fillStyle = P.dataFill; c.beginPath(); c.moveTo(40, 82); c.lineTo(216, 82); c.lineTo(230, 140); c.lineTo(26, 140); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(66, 82); c.lineTo(66, 72); c.lineTo(190, 72); c.lineTo(190, 82); c.stroke();
        c.beginPath(); c.moveTo(108, 112); c.lineTo(148, 112); c.stroke();
      },
    },
  ];

  /* ================= 01 · VLM pretraining: the top row of the VLA figure, with nothing frozen yet ================= */
  S[1] = {
    id: 'vlm', cat: 'train', title: 'VLM pretraining', sub: 'internet image + text',
    cam: { pos: [0.4, 0.8, 5.4], target: [0.0, -0.1, 0], fov: 40 },
    caption: 'The top row of the VLA figure, before any robot, as a short guided tour: a web image and its caption become tokens, the VLM predicts the next word, and the loss sends gradients (dashed) back into the VLM and vision encoder. Nothing is frozen yet. Click a step number to jump; drag to look around.',
    build(ctx) {
      const scene = V.makeScene({ floor: -1.32, fog: [5, 12], shadowR: 2.2, sun: [1.2, 4, 5], target: [0, -0.4, 0], gridSize: 8, gridStep: 0.5 });
      const D = V.D, P = D.mapper(330, 640, 190, 1.45), L = P.L, Ly = P.Ly;
      const add = (o) => { scene.add(o); return o; };
      const lbl = (text, p, cls, html) => ctx.labels.add(text, p, { cls: 'plain ' + (cls || ''), html });
      // a small stack of web image–caption pairs, the current one in front
      const texs = IMAGES.map((im) => V.canvasTex(256, 256, im.draw));
      const back = [2, 1].map((k) => { const m = add(R.card(L(230), L(230), texs[k], 'soft')); m.position.copy(P(142 + k * 14, 128 - k * 14, -0.1 * k)); return m; });
      const imgMat = new T.MeshBasicMaterial({ map: texs[0], transparent: true });
      const img = add(new T.Mesh(V.geo('p' + L(230) + ',' + L(230), () => new T.PlaneGeometry(L(230), L(230))), imgMat)); V.edges(img, 'ink'); img.position.copy(P(142, 128, 0.02));
      lbl('web image + caption', P(142, 0), 'small');
      const cap = lbl('', P(150, 318), 'big mid');
      const venc = D.block({ c: P(408, 131), w: L(173), h: Ly(213), kind: 'plain', lines: ['Vision', 'Encoder'] }); add(venc.mesh);
      const tokz = D.block({ c: P(408, 318), w: L(173), h: Ly(95), kind: 'plain', lines: ['Text', 'Tokenizer'] }); add(tokz.mesh);
      const vlm = D.block({ c: P(810, 200), w: L(187), h: Ly(370), kind: 'train', lines: ['VLM'] }); add(vlm.mesh);
      lbl('being trained', P(810, 392), 'small down');
      const PY = [42, 71, 100, 129, 158, 187, 216], TY = [270, 299, 328, 357, 386];
      const column = (x) => ({ img: PY.map((y) => { const m = add(D.token('tokImg')); m.position.copy(P(x, y)); return m; }), txt: TY.map((y) => { const m = add(D.token('tokTxt')); m.position.copy(P(x, y)); return m; }) });
      const colA = column(615), colB = column(990);
      add(D.arrow([P(282, 128), P(321, 128)])); add(D.arrow([P(300, 318), P(321, 318)]));
      add(D.arrow([P(496, 130), P(585, 130)])); add(D.arrow([P(496, 318), P(585, 318)]));
      // the prediction for the next word, and the loss
      const predTex = V.canvasTex(256, 96, (cx, Pl, w, h, st) => {
        cx.fillStyle = Pl.trainFill; cx.fillRect(0, 0, w, h); cx.strokeStyle = Pl.train; cx.lineWidth = 6; cx.strokeRect(3, 3, w - 6, h - 6);
        cx.fillStyle = Pl.train; cx.font = V.font(46, 600); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(st.word || '', w / 2, h / 2 + 2);
      }, { word: '' });
      const pred = add(R.card(0.42, 0.16, predTex, null));
      const nextLbl = lbl('next token', P(0, 0), 'small');
      const lossLbl = lbl('', P(0, 0), 'big down train');
      const predArrow = add(new T.Group());
      // gradients: from the loss back into the VLM and the vision encoder (dashed, over the top)
      const gPath = [P(1200, 300), P(1200, -10), P(408, -10), P(408, 22)], gPath2 = [P(810, -10), P(810, 12)];
      add(D.arrow(gPath, { dash: 0.03, role: 'train' })); add(D.arrow(gPath2, { dash: 0.03, role: 'train' }));
      lbl('gradients', P(1010, -10), 'small');
      const flow = new D.Flow(scene);
      flow.add([P(282, 128), P(321, 128)], 0.25, 0.35, 'ink');
      flow.add([P(300, 318), P(321, 318)], 0.3, 0.35, 'ink');
      flow.add(gPath, 3.3, 0.9, 'train', 0.05);
      flow.add([...gPath.slice(0, 2), P(810, -10), P(810, 12)], 3.3, 0.75, 'train', 0.05);
      const shot = (cx, cy, d) => { const t = P(cx, cy); t.y -= 0.08 * d; return { target: t, pos: t.clone().add(vec(0.1 * d, 0.15 * d, d)) }; };
      const STEPS = [
        { t: 0, s: shot(330, 215, 3.7), title: 'A web image and its caption', text: 'Pretraining uses billions of image–caption pairs from the web. The image goes through a vision encoder and the caption through a tokenizer, so both become tokens.' },
        { t: 3.8, s: shot(800, 215, 3.6), title: 'The VLM reads the tokens', text: 'The VLM reads the image tokens (purple) and word tokens (blue) as one sequence, the same way a language model reads text.' },
        { t: 7.6, s: shot(1080, 300, 3.4), title: 'Predict the next word', text: '' },
        { t: 11.2, s: shot(650, 210, 5.6), title: 'Learn from the mistake', text: 'Gradients flow back from the loss into the VLM and the vision encoder (dashed), nudging their weights. Nothing is frozen yet: this model later becomes the VLA\'s backbone.' },
      ];
      const CYCLE = 15.4, MOVE = 1.5;
      flow.items.forEach((it, k) => { it.t0 = [0.7, 0.8, 11.5, 11.5][k]; it.dur = [0.5, 0.5, 1.4, 1.1][k]; });
      let cur = -1, nW = 0, sample = 1023988, predY = 0;
      const self = {
        scene, shot: { pos: vec(0, 0, 0), target: vec(0, 0, 0) }, _t: 0,
        seek(i) { return Math.floor(self._t / CYCLE) * CYCLE + STEPS[i].t + 0.001; },
        update(t) {
          self._t = t;
          const cyc = Math.floor(t / CYCLE), lt = t % CYCLE, bump = D.bump, im = IMAGES[cyc % IMAGES.length];
          if (cyc !== cur) {
            cur = cyc; sample += 512; nW = im.words.length;
            imgMat.map = texs[cyc % IMAGES.length]; imgMat.needsUpdate = true;
            back.forEach((m, k) => { m.material.map = texs[(cyc + 2 - k) % IMAGES.length]; m.material.needsUpdate = true; });
            cap.d.innerHTML = '“' + im.words.join(' ') + ' …”'; cap.text = '';
            V.retex(predTex, { word: im.next });
            predY = TY[nW - 1];
            while (predArrow.children.length) predArrow.remove(predArrow.children[0]);
            predArrow.add(D.arrow([P(1015, predY), P(1125, predY)], { role: 'train' }));
            pred.position.copy(P(1200, predY, 0.01)); nextLbl.target.copy(P(1200, predY - 34)); lossLbl.target.copy(P(1200, predY + 34));
          }
          const loss = 1.15 + 1.7 * Math.exp(-cyc / 5) + 0.12 * Math.sin(cyc * 2.1);
          const i = STEPS.findIndex((x, k) => lt >= x.t && (k === STEPS.length - 1 || lt < STEPS[k + 1].t)), st = STEPS[i];
          const prev = STEPS[(i + STEPS.length - 1) % STEPS.length].s, u = easeIO((lt - st.t) / MOVE);
          self.shot.pos.copy(prev.pos).lerp(st.s.pos, u); self.shot.target.copy(prev.target).lerp(st.s.target, u);
          const text = i === 2 ? `It guesses the next word of the caption: “${im.next}”. The loss (${loss.toFixed(2)} here) measures how far that guess is from the real word; it falls as training goes on.` : st.text;
          ctx.narrate({ i, n: STEPS.length, title: st.title, text, titles: STEPS.map((x) => x.title) });
          const fade = 1 - smooth(seg(lt, CYCLE - 0.5, CYCLE));
          imgMat.opacity = smooth(seg(lt, 0, 0.4)) * (0.3 + 0.7 * fade);
          flow.update(lt);
          venc.glow(0.32 * Math.max(bump(lt, 1.0, 2.4), bump(lt, 12.4, 13.8)));
          tokz.glow(0.3 * bump(lt, 1.1, 2.4));
          const show = (m, s) => { m.visible = s > 0.002; m.scale.setScalar(Math.max(0.001, s)); };
          colA.img.forEach((m, k) => show(m, smooth(seg(lt, 1.8 + k * 0.05, 2.2 + k * 0.05)) * (1 - smooth(seg(lt, 4.6, 5.4)))));
          colA.txt.forEach((m, k) => show(m, k < nW ? smooth(seg(lt, 2.0 + k * 0.05, 2.4 + k * 0.05)) * (1 - smooth(seg(lt, 4.6, 5.4))) : 0));
          [...colA.img, ...colA.txt].forEach((m) => { m.position.x = P(615 + 75 * smooth(seg(lt, 4.5, 5.4)), 0).x; });
          vlm.glow(0.32 * Math.max(bump(lt, 4.8, 6.6), bump(lt, 12.2, 13.8)));
          colB.img.forEach((m, k) => show(m, smooth(seg(lt, 5.8 + k * 0.05, 6.2 + k * 0.05)) * fade));
          colB.txt.forEach((m, k) => show(m, k < nW ? smooth(seg(lt, 6.0 + k * 0.05, 6.4 + k * 0.05)) * fade : 0));
          const pr = smooth(seg(lt, 8.2, 8.8)) * fade;
          pred.visible = pr > 0.01; pred.scale.setScalar(Math.max(0.001, pr)); predArrow.visible = pr > 0.01;
          nextLbl.show(pr > 0.5); lossLbl.show(pr > 0.5);
          lossLbl.set('loss ' + loss.toFixed(2));
          void sample;
        },
      };
      return self;
    },
  };

  /* ================= 03 · VLA pretraining, laid out like the GR00T N1 figure ================= */
  // the camera frame fed to the vision encoder: top view of the table, cube, bin and both grippers
  const camFrame = (c, P, w, h) => {
    c.fillStyle = P.body2; c.fillRect(0, 0, w, h);
    c.fillStyle = P.table; c.strokeStyle = P.ink; c.lineWidth = 4;
    c.beginPath(); c.moveTo(w * 0.1, h * 0.12); c.lineTo(w * 0.9, h * 0.12); c.lineTo(w * 1.02, h * 1.02); c.lineTo(-w * 0.02, h * 1.02); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = P.body; c.fillRect(w * 0.6, h * 0.22, w * 0.2, h * 0.24); c.strokeRect(w * 0.6, h * 0.22, w * 0.2, h * 0.24); c.strokeRect(w * 0.63, h * 0.26, w * 0.14, h * 0.16);
    c.fillStyle = P.deploy; c.fillRect(w * 0.43, h * 0.52, w * 0.08, w * 0.08); c.strokeRect(w * 0.43, h * 0.52, w * 0.08, w * 0.08);
    c.fillStyle = P.muted;
    for (const s of [-1, 1]) {
      c.save(); c.translate(s < 0 ? 0 : w, h * 0.8); c.scale(s < 0 ? 1 : -1, 1);
      c.fillRect(0, -h * 0.05, w * 0.24, h * 0.1); c.fillRect(w * 0.24, -h * 0.1, w * 0.06, h * 0.2);
      c.fillStyle = P.ink; c.fillRect(w * 0.3, -h * 0.1, w * 0.07, h * 0.045); c.fillRect(w * 0.3, h * 0.055, w * 0.07, h * 0.045);
      c.restore(); c.fillStyle = P.muted;
    }
  };

  S[3] = {
    id: 'vla', cat: 'train', title: 'VLA pretraining', sub: 'add action head',
    cam: { pos: [1.2, 1.5, 10.0], target: [0.07, 0.05, 0], fov: 40 },
    caption: 'GR00T N1\'s architecture in 3D, as a guided tour. The camera follows each step while the subtitle explains it: image and instruction become tokens, the frozen VLM reads them, robot-specific encoders embed the state and noisy actions, DiT blocks denoise them, and after K = 4 passes the robot moves. Click a step number to jump; drag to look around.',
    build(ctx) {
      const scene = V.makeScene({ floor: -2.75, fog: [9, 22], shadowR: 4.6, sun: [1.6, 6, 7], target: [0, -0.8, 0], gridSize: 14, gridStep: 0.5 });
      const D = V.D, P = D.mapper(300, 1200, 580, 1.15), L = P.L, Ly = P.Ly, TOK = 0.085;
      const add = (o) => { scene.add(o); return o; };
      const lbl = (text, p, cls, html) => ctx.labels.add(text, p, { cls: 'plain ' + (cls || ''), html });
      const token = (role, x, y) => { const m = add(D.token(role, TOK)); m.position.copy(P(x, y)); m.userData.home = m.position.clone(); return m; };
      // ---- vision-language side
      const img = add(R.card(L(260), L(190), V.canvasTex(320, 230, camFrame), 'ink')); img.position.copy(P(150, 140));
      lbl('camera image', P(150, 32), 'small');
      lbl('“put the cube<br>in the bin”', P(150, 360), 'big mid', true);
      const venc = D.block({ c: P(470, 140), w: L(190), h: Ly(220), kind: 'frozen', lines: ['Vision', 'Encoder'] }); add(venc.mesh);
      const tokz = D.block({ c: P(470, 360), w: L(190), h: Ly(100), kind: 'plain', lines: ['Text', 'Tokenizer'] }); add(tokz.mesh);
      const vlm = D.block({ c: P(820, 228), w: L(200), h: Ly(430), kind: 'frozen', lines: ['Eagle-2', 'VLM'] }); add(vlm.mesh);
      const PY = [50, 80, 110, 140, 170, 200, 230], TY = [315, 345, 375, 405];
      const colA = [...PY.map((y) => token('tokImg', 640, y)), ...TY.map((y) => token('tokTxt', 640, y))];
      const colB = [...PY.map((y) => token('tokImg', 1000, y)), ...TY.map((y) => token('tokTxt', 1000, y))];
      add(D.arrow([P(282, 140), P(373, 140)])); add(D.arrow([P(282, 360), P(373, 360)]));
      add(D.arrow([P(567, 140), P(612, 140)])); add(D.arrow([P(567, 360), P(612, 360)]));
      const wire1 = [P(1030, 228), P(1180, 228), P(1180, 562)], wire2 = [P(1180, 228), P(1490, 228), P(1490, 562)];
      add(D.arrow(wire1, { role: 'ink' })); add(D.arrow(wire2, { role: 'ink' }));
      lbl('VLM tokens', P(1330, 228), 'small');
      // legend
      const lg = D.block({ c: P(1880, 110), w: L(60), h: L(60), kind: 'embod', d: 0.06 }); add(lg.mesh);
      const snowTex = V.canvasTex(128, 128, (c, Pl, w, h) => D.drawSnow(c, w / 2, h / 2, w * 0.4, Pl.frozen, 9));
      const snow = add(new T.Mesh(V.geo('p0.2,0.2', () => new T.PlaneGeometry(0.2, 0.2)), new T.MeshBasicMaterial({ map: snowTex, transparent: true, depthWrite: false })));
      snow.position.copy(P(1880, 205));
      lbl('Embodiment-specific module', P(1935, 110), 'big left mid legend');
      lbl('Pre-trained and frozen', P(1935, 205), 'big left mid legend');
      // ---- robot side
      lbl('Robot state', P(150, 600), 'big mid');
      lbl('q<sub>t</sub>', P(362, 600), 'big mid math', true);
      add(D.arrow([P(405, 600), P(513, 600)]));
      const senc = D.block({ c: P(620, 600), w: L(210), h: Ly(130), kind: 'embod', lines: ['State', 'Encoder'] }); add(senc.mesh);
      add(D.arrow([P(727, 600), P(800, 600)]));
      const stA = [585, 615].map((y) => token('tokState', 830, y));
      add(D.arrow([P(860, 600), P(1098, 600)]));
      lbl('Noised action', P(150, 870), 'big mid');
      add(D.dashRect(P(380, 870), L(120), Ly(330)));
      [['a<sub>t</sub>', 740], ['a<sub>t+1</sub>', 805], ['⋮', 885], ['a<sub>t+H−1</sub>', 975]].forEach(([s, y]) => lbl(s, P(380, y), 'big mid math', true));
      add(D.arrow([P(442, 870), P(513, 870)]));
      const aenc = D.block({ c: P(620, 870), w: L(210), h: Ly(300), kind: 'embod', lines: ['Action', 'Encoder'] }); add(aenc.mesh);
      add(D.arrow([P(727, 870), P(800, 870)]));
      const AY = [750, 780, 810, 840, 870, 900, 930, 960, 990];
      const acA = AY.map((y) => token('tokNoise', 830, y));
      add(D.arrow([P(860, 870), P(1098, 870)]));
      // ---- DiT blocks
      const shell = D.block({ c: P(1390, 790, -0.11), w: L(580), h: Ly(500), kind: 'shell', d: 0.05, r: 0.14 }); add(shell.mesh);
      const bars = [[1180, 'Cross-Attention'], [1290, 'Self-Attention'], [1490, 'Cross-Attention'], [1600, 'Self-Attention']].map(([x, s]) => {
        const b = D.block({ c: P(x, 790, 0), w: L(80), h: Ly(450), kind: 'bar', lines: [s], vertical: true, d: 0.14, font: 0.1, r: 0.05 }); add(b.mesh); return b;
      });
      add(V.polyline([P(1220, 790, 0.03), P(1250, 790, 0.03)], V.line('ink', 1)));
      add(V.polyline([P(1330, 790, 0.03), P(1450, 790, 0.03)], V.dash('ink', 0.04, 0.035, 1)));
      add(V.polyline([P(1530, 790, 0.03), P(1560, 790, 0.03)], V.line('ink', 1)));
      lbl('× N', P(1390, 1062), 'big mid');
      lbl('DiT blocks', P(1390, 1098), 'big mid');
      add(D.arrow([P(1682, 790), P(1724, 790)]));
      const stB = [585, 615].map((y) => token('tokState', 1750, y));
      const acB = AY.map((y) => token('tokNoise', 1750, y));
      const adec = D.block({ c: P(1920, 790), w: L(200), h: Ly(470), kind: 'embod', lines: ['Action', 'Decoder'] }); add(adec.mesh);
      add(D.arrow([P(2022, 790), P(2058, 790)]));
      add(D.dashRect(P(2120, 790), L(120), Ly(330)));
      [['a<sub>t</sub>', 660], ['a<sub>t+1</sub>', 725], ['⋮', 805], ['a<sub>t+H−1</sub>', 895]].forEach(([s, y]) => lbl(s, P(2120, y), 'big mid math', true));
      add(D.arrow([P(2182, 790), P(2238, 790)]));
      // ---- robot
      const base = P(2345, 905);
      const plinth = add(V.box(0.66, 0.05, 0.42, 'body2', 'ink')); plinth.position.copy(base);
      const top = base.y + 0.025;
      const armL = V.arm({ scale: 0.66 }), armR = V.arm({ scale: 0.66 });
      armL.root.position.set(base.x - 0.23, top, 0); armR.root.position.set(base.x + 0.23, top, 0); armR.root.rotation.y = PI;
      add(armL.root); add(armR.root);
      const cube = add(V.box(0.034, 0.034, 0.034, 'deploy', 'ink'));
      lbl('Motor action', P(2345, 950), 'big down');
      // ---- K iterations loop
      const loop = [P(2120, 957), P(2120, 1150), P(380, 1150), P(380, 1037)];
      add(D.arrow(loop, { dash: 0.026, role: 'ink' }));
      const kLbl = lbl('', P(1250, 1172), 'big down');

      // ---- the tour: what happens, where the camera looks, what the subtitle says
      const shot = (cx, cy, d) => { const t = P(cx, cy); t.y -= 0.07 * d; return { target: t, pos: t.clone().add(vec(0.1 * d, 0.16 * d, d)) }; };
      const STEPS = [
        { t: 0, s: shot(470, 215, 4.7), title: 'Image and instruction become tokens', text: 'The robot\'s camera image goes through a vision encoder and the instruction through a text tokenizer. Image patches become purple tokens, words become blue ones.' },
        { t: 4.2, s: shot(790, 240, 4.6), title: 'The VLM reads both', text: 'The pretrained VLM (Eagle-2) reads the image and word tokens together and outputs one sequence that captures the scene and the task. It stays frozen ❄: it already knows what a cube and a bin are.' },
        { t: 8.4, s: shot(480, 800, 5.3), title: 'Robot state and noisy actions', text: 'The joint state q_t and a chunk of H = 16 random actions go through small robot-specific encoders (green). Only these change from one robot body to another.' },
        { t: 12.6, s: shot(1250, 610, 6.0), title: 'Cross-attention: what to do', text: 'In each DiT block, cross-attention lets the action tokens read the VLM tokens. This is where the scene and the instruction steer the motion.' },
        { t: 16.6, s: shot(1390, 800, 4.6), title: 'Self-attention: stay consistent', text: 'Self-attention mixes the state and action tokens with each other, so the 16 actions agree with one another and with the arm\'s current pose.' },
        { t: 20.4, s: shot(1900, 800, 4.7), title: 'Decode a cleaner chunk', text: 'The action decoder turns the tokens back into actions. That is one flow-matching step: the chunk moves a little from noise toward a clean trajectory.' },
        { t: 24.4, s: shot(1330, 800, 9.6), title: 'Repeat K = 4 times', text: 'The output goes back in as the next input (dotted loop). Each pass removes more noise; after K = 4 passes the chunk is smooth (amber).' },
        { t: 30.6, s: shot(2290, 860, 3.2), title: 'Act', text: 'The final 16 actions go to the motors. On a real robot the next chunk is already being computed while this one runs.' },
        { t: 34.4, s: shot(1210, 600, 10.6), title: 'The whole picture', text: 'Frozen VLM on top, robot-specific modules in green, a DiT that denoises actions in between. That is GR00T N1; π0 follows the same idea with PaliGemma and a ~300M action expert.' },
      ];
      const CYCLE = 38.4, K = 4, MOVE = 1.6;
      const stepAt = (lt) => { let i = 0; while (i < STEPS.length - 1 && lt >= STEPS[i + 1].t) i++; return i; };
      const flow = new D.Flow(scene);
      flow.add([P(282, 140), P(373, 140)], 0.8, 0.5, 'ink');
      flow.add([P(282, 360), P(373, 360)], 0.9, 0.5, 'ink');
      flow.add([P(405, 600), P(513, 600)], 9.0, 0.5, 'tokState');
      flow.add([P(442, 870), P(513, 870)], 10.1, 0.5, 'ink');
      flow.add([P(860, 600), P(1098, 600)], 13.0, 0.5, 'tokState');
      flow.add([P(860, 870), P(1098, 870)], 13.0, 0.5, 'tokNoise');
      flow.add(wire1, 13.4, 0.8, 'tokImg', 0.05);
      flow.add([P(1030, 228), ...wire2], 14.3, 0.9, 'tokImg', 0.05);
      flow.add([P(1682, 790), P(1724, 790)], 20.7, 0.4, 'tokAct');
      flow.add([P(2022, 790), P(2058, 790)], 22.0, 0.4, 'tokAct');
      // later passes, fast: back round the loop, through the encoder, the DiT and the decoder
      const PASS0 = 25.2, PASS = 1.75;
      for (let k = 0; k < K - 1; k++) {
        const t0 = PASS0 + k * PASS;
        flow.add(loop, t0, 0.6, 'tokAct', 0.05);
        flow.add([P(860, 870), P(1098, 870)], t0 + 0.75, 0.25, 'tokNoise');
        flow.add([P(1682, 790), P(1724, 790)], t0 + 1.2, 0.2, 'tokAct');
      }
      flow.add([P(2182, 790), P(2238, 790)], 31.0, 0.5, 'tokAct');
      const passStart = (k) => (k === 0 ? 12.6 : PASS0 + (k - 1) * PASS);  // pass k (0-based)
      const kDoneAt = (lt) => (lt < 21.0 ? 0 : 1 + clamp(Math.floor((lt - PASS0 - 1.3) / PASS) + 1, 0, K - 1));
      const cN = new T.Color(), cA = new T.Color(), tmp = new T.Color();
      const pose = V.pose(), mid = vec(base.x, top + 0.18, 0);
      const self = {
        scene, shot: { pos: vec(0, 0, 0), target: vec(0, 0, 0) },
        seek(i) { return Math.floor(self._t / CYCLE) * CYCLE + STEPS[i].t + 0.001; },
        _t: 0,
        update(t) {
          self._t = t;
          const lt = t % CYCLE, bump = D.bump, i = stepAt(lt), st = STEPS[i];
          // camera: glide from the previous shot to this step's shot
          const prev = STEPS[(i + STEPS.length - 1) % STEPS.length].s, u = easeIO((lt - st.t) / MOVE);
          self.shot.pos.copy(prev.pos).lerp(st.s.pos, u); self.shot.target.copy(prev.target).lerp(st.s.target, u);
          ctx.narrate({ i, n: STEPS.length, title: st.title, text: st.text, titles: STEPS.map((x) => x.title) });
          flow.update(lt);
          const fadeAll = 1 - smooth(seg(lt, CYCLE - 0.6, CYCLE - 0.05));
          const show = (m, v) => { m.visible = v > 0.002; m.scale.setScalar(Math.max(0.001, v)); };
          // 1 · encoders
          venc.glow(0.32 * bump(lt, 1.1, 2.6)); tokz.glow(0.3 * bump(lt, 1.2, 2.6));
          colA.forEach((m, j) => {
            show(m, smooth(seg(lt, 1.9 + j * 0.05, 2.3 + j * 0.05)) * (1 - smooth(seg(lt, 5.0, 5.8))));
            m.position.x = P(640 + 80 * smooth(seg(lt, 4.8, 5.8)), 0).x;
          });
          // 2 · VLM
          vlm.glow(0.32 * bump(lt, 5.0, 7.2));
          colB.forEach((m, j) => show(m, smooth(seg(lt, 6.2 + j * 0.05, 6.6 + j * 0.05)) * fadeAll));
          // 3 · state + noise encoders
          senc.glow(0.32 * bump(lt, 9.3, 10.5));
          stA.forEach((m) => show(m, smooth(seg(lt, 10.1, 10.5)) * fadeAll));
          let ag = bump(lt, 10.5, 11.8);
          for (let k = 0; k < K - 1; k++) ag = Math.max(ag, bump(lt, PASS0 + k * PASS + 0.55, PASS0 + k * PASS + 1.0));
          aenc.glow(0.32 * ag);
          const kDone = kDoneAt(lt), doneF = kDone / K, jit = 0.016 * (1 - doneF);
          cN.set(V.col('tokNoise')); cA.set(V.col('tokAct'));
          acA.forEach((m, j) => {
            show(m, smooth(seg(lt, 11.2 + j * 0.04, 11.6 + j * 0.04)) * fadeAll);
            m.position.copy(m.userData.home); m.position.x += Math.sin(t * 21 + j * 2.3) * jit; m.position.y += Math.cos(t * 17 + j * 1.7) * jit;
            m.material.color.copy(tmp.copy(cN).lerp(cA, doneF));
          });
          // 4-5 · DiT blocks: slow on the first pass, quick on the rest
          bars.forEach((b, j) => {
            let v = j === 0 ? bump(lt, 13.9, 15.2) : j === 2 ? bump(lt, 15.0, 16.4) : j === 1 ? bump(lt, 17.0, 18.4) : bump(lt, 18.2, 19.6);
            for (let k = 0; k < K - 1; k++) { const a = PASS0 + k * PASS + 0.85 + j * 0.08; v = Math.max(v, bump(lt, a, a + 0.3)); }
            b.glow(0.5 * v);
          });
          // 6 · decoder
          let dg = bump(lt, 21.0, 22.4);
          for (let k = 0; k < K - 1; k++) dg = Math.max(dg, bump(lt, PASS0 + k * PASS + 1.25, PASS0 + k * PASS + 1.65));
          adec.glow(0.32 * dg);
          const outOn = kDone > 0 ? fadeAll : 0;
          stB.forEach((m) => show(m, outOn));
          acB.forEach((m) => { show(m, outOn); m.material.color.copy(tmp.copy(cN).lerp(cA, doneF)); });
          // 8 · the robot runs the final chunk
          const run = smooth(seg(lt, 31.4, 31.9)) * (1 - smooth(seg(lt, CYCLE - 1.0, CYCLE - 0.2)));
          const w = (lt - 31.4) * 3.0;
          for (const [arm, sd] of [[armL, -1], [armR, 1]]) {
            pose.p.set(base.x + sd * 0.12, top + 0.16, 0.05);
            pose.p.lerp(vec(mid.x + sd * (0.05 + 0.03 * Math.cos(w)), mid.y + 0.05 * Math.sin(w), 0.06 * Math.sin(w * 0.5)), run);
            arm.solve(pose.p, lerp(DOWN, 0, run), 0, 0.04 - 0.018 * run);
          }
          cube.position.set(base.x, top + 0.017 + 0.18 * run, 0.07 * (1 - run));
          const kShow = lt < 12.6 ? 0 : lt < PASS0 ? 1 : Math.min(K, 2 + Math.floor((lt - PASS0) / PASS));
          kLbl.set(`K iterations · pass ${kShow} / ${K}`);
          void passStart;
        },
      };
      return self;
    },
  };

  /* ================= 04 · post-training: towel folding on the target robot ================= */
  S[4] = {
    id: 'post', cat: 'train', title: 'post-training', sub: 'target robot + task',
    cam: { pos: [0.1, 1.36, 1.22], target: [0.05, 0.1, -0.18], fov: 42 },
    caption: 'The generalist is fine-tuned on high-quality demos of one robot doing one task family. Behind the table, the same figure in miniature: the VLM stays frozen while gradients update the robot-specific encoders, DiT and decoder. Success climbs as the fold goes from missing the corner to dropping it to a clean fold.',
    build(ctx) {
      const scene = V.makeScene({ floor: -0.58, fog: [2.4, 6.5], shadowR: 1.1, target: [0.2, 0, -0.1] });
      const r = R.rig(); scene.add(r.world);
      // towel: far half folds over the near half along z = zc
      const W = 0.4, D = 0.3, zc = 0.03, NX = 24, NZ = 18;
      const tex = V.canvasTex(256, 192, (c, P, w, h) => {
        c.fillStyle = P.trainFill; c.fillRect(0, 0, w, h);
        c.fillStyle = P.train; c.globalAlpha = 0.22;
        for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 16 : 0; x < w; x += 32) c.fillRect(x, y, 16, 16);
        c.globalAlpha = 1; for (const y of [10, 22, h - 28, h - 16]) c.fillRect(0, y, w, 6);
        c.strokeStyle = P.train; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
      });
      const tg = new T.PlaneGeometry(W, D, NX, NZ); tg.rotateX(-PI / 2);
      const base = tg.attributes.position.array.slice();
      const towel = new T.Mesh(tg, V.surfNew('body', { map: tex, side: T.DoubleSide })); V.role(towel.material, 'body');
      towel.material.color.set('#ffffff'); towel.material.userData.role = null;
      towel.position.set(0, 0.002, zc + 0.0); towel.receiveShadow = true; towel.castShadow = true; scene.add(towel);
      const S2 = D / 2;
      function fold(theta, sag) {
        const a = tg.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) {
          const x = base[i], z = base[i + 2];
          if (z < 0) {
            const s = -z, u = (x + W / 2) / W;
            const y = s * Math.sin(theta) + 0.006 * smooth(theta / PI) - sag * Math.sin(PI * u) * (s / S2) * Math.sin(theta);
            a[i + 1] = Math.max(0, y); a[i + 2] = -s * Math.cos(theta);
          } else { a[i + 1] = 0; a[i + 2] = z; }
        }
        tg.attributes.position.needsUpdate = true; tg.computeVertexNormals();
      }
      const corner = (side, theta) => vec(side * 0.18, S2 * Math.sin(theta) + 0.012, zc - S2 * Math.cos(theta));
      // the model being fine-tuned, drawn like the GR00T figure: VLM frozen, robot-specific parts + DiT trained
      const DG = V.D, MB = vec(0.46, 0.24, -0.64), K_ = 0.82;
      const at = (x, y) => vec(MB.x + x * K_, MB.y + y * K_, MB.z);
      const blk = (o) => { const b = DG.block(Object.assign({ d: 0.06 }, o, { w: o.w * K_, h: o.h * K_, font: o.font * K_ })); scene.add(b.mesh); return b; };
      const mVlm = blk({ c: at(-0.16, 0.14), w: 0.27, h: 0.12, kind: 'frozen', lines: ['VLM'], font: 0.05 });
      const mEnc = blk({ c: at(-0.16, -0.07), w: 0.27, h: 0.12, kind: 'embod', lines: ['State + action', 'encoders'], font: 0.034 });
      const mDit = blk({ c: at(0.1, 0.035), w: 0.13, h: 0.33, kind: 'bar', lines: ['DiT'], font: 0.045 });
      const mDec = blk({ c: at(0.27, 0.035), w: 0.12, h: 0.33, kind: 'embod', lines: ['Action decoder'], vertical: true, font: 0.034 });
      const ar = (p0, p1) => scene.add(DG.arrow([p0, p1], { role: 'ink', headSize: 0.026 }));
      ar(at(-0.02, 0.14), at(0.035, 0.14)); ar(at(-0.02, -0.07), at(0.035, -0.07)); ar(at(0.165, 0.035), at(0.21, 0.035));
      ctx.labels.add('frozen ❄', at(-0.16, 0.2), { cls: 'plain small' });
      ctx.labels.add('trained', at(0.06, -0.17), { cls: 'train down' });
      // gradients run backwards through the trainable path only
      const gradPath = new T.CurvePath();
      [[at(0.27, -0.155), at(0.1, -0.155)], [at(0.1, -0.155), at(-0.16, -0.155)], [at(-0.16, -0.155), at(-0.16, -0.13)]].forEach(([p0, p1]) => gradPath.add(new T.LineCurve3(p0, p1)));
      scene.add(V.polyline([at(0.27, -0.155), at(-0.16, -0.155), at(-0.16, -0.13)], V.dash('train', 0.015, 0.012, 1)));
      const grads = [0, 1, 2].map(() => { const m = V.box(0.02, 0.02, 0.02, 'train', null); scene.add(m); return m; });
      // success-rate chart on a board behind the table
      const CH = { x: -0.3, y: 0.1, z: -0.56, w: 0.56, h: 0.36 };
      const board = V.box(CH.w + 0.12, CH.h + 0.12, 0.012, 'body', 'soft'); board.position.set(CH.x, CH.y + CH.h / 2, CH.z - 0.008); scene.add(board);
      const axes = V.polyline([vec(CH.x - CH.w / 2, CH.y + CH.h, CH.z), vec(CH.x - CH.w / 2, CH.y, CH.z), vec(CH.x + CH.w / 2, CH.y, CH.z)], V.line('ink', 1)); scene.add(axes);
      const gl = []; for (const f of [0.25, 0.5, 0.75, 1]) gl.push(vec(CH.x - CH.w / 2, CH.y + f * CH.h, CH.z), vec(CH.x + CH.w / 2, CH.y + f * CH.h, CH.z));
      scene.add(V.segments(gl, V.line('faint', 1)));
      const SR = (x) => 0.06 + 0.84 * (1 - Math.exp(-x / 9));   // success vs k-steps (illustrative)
      const chart = V.dynLine(64, V.lineNew('train', 1)); scene.add(chart);
      const dot = V.box(0.02, 0.02, 0.02, 'train', null); scene.add(dot);
      const cp = (x) => vec(CH.x - CH.w / 2 + (x / 30) * CH.w, CH.y + SR(x) * CH.h, CH.z + 0.004);
      ctx.labels.add('success rate', vec(CH.x - CH.w / 2, CH.y + CH.h + 0.035, CH.z), { cls: 'left' });
      ctx.labels.add('fine-tune steps →', vec(CH.x + CH.w / 2, CH.y - 0.04, CH.z), { cls: 'right down' });
      const valLbl = ctx.labels.add('', dot, { off: [0, 0.03, 0], cls: 'train' });
      // three attempts at increasing fine-tune step
      const EPS = [{ k: 2, fail: 'miss' }, { k: 10, fail: 'drop' }, { k: 30, fail: null }];
      const DUR = 7.2;
      const pose = V.pose();
      let theta = 0, vth = 0;
      return {
        scene,
        update(t, dt) {
          const e = Math.floor(t / DUR) % 3, lt = t % DUR, ep = EPS[e];
          const reach = easeIO(seg(lt, 0.2, 1.3)), lower = easeIO(seg(lt, 1.3, 1.8)), close = seg(lt, 1.8, 2.1);
          const foldP = easeIO(seg(lt, 2.3, 4.6)), lift = easeIO(seg(lt, 4.8, 5.2)), back = easeIO(seg(lt, 5.4, 6.4));
          const DROP_T = 3.4, thV = PI * 0.985 * foldP, thDrop = PI * 0.985 * easeIO(seg(DROP_T, 2.3, 4.6));
          const dropped = ep.fail === 'drop' && lt >= DROP_T;
          const cmd = dropped ? thDrop : thV;            // the fold angle the policy is commanding
          if (lt < 0.1) { theta = 0; vth = 0; }
          if (ep.fail === 'miss') theta = 0;              // jaws closed on air: the towel never moves
          else if (dropped) { vth -= 14 * dt; theta = Math.max(0, theta + vth * dt); }
          else if (close >= 1) { theta = cmd; vth = 0; }
          if (!ep.fail && lt > DUR - 0.5) theta = PI * 0.985 * (1 - smooth(seg(lt, DUR - 0.5, DUR)));
          fold(theta, 0.03);
          for (const [arm, side] of [[r.L, -1], [r.R, 1]]) {
            const home = vec(side * 0.24, 0.2, 0.0);
            const off = ep.fail === 'miss' ? vec(-side * 0.05, 0, 0.05) : vec(0, 0, 0);
            const c0 = corner(side, 0).add(off), above = c0.clone(); above.y = 0.1;
            pose.p.copy(home).lerp(above, reach);
            if (lower > 0) pose.p.lerp(c0, lower);
            if (lt > 2.1) pose.p.copy(corner(side, cmd)).add(off);
            let g = lerp(0.04, ep.fail === 'miss' ? 0.006 : 0.012, close);
            if (dropped) g = lerp(g, 0.04, seg(lt, DROP_T, DROP_T + 0.15));
            if (lt > 4.6) g = lerp(g, 0.04, seg(lt, 4.6, 4.8));
            pose.p.y += 0.07 * lift;
            if (lt > 5.4) pose.p.lerp(home, back);
            arm.solve(pose.p, DOWN, 0, g);
          }
          // gradients flow back through the trainable path while training
          grads.forEach((m, i) => m.position.copy(gradPath.getPointAt((t * 0.45 + i / 3) % 1)));
          const pulse = 0.25 + 0.2 * Math.sin(t * 4);
          mEnc.glow(pulse); mDit.glow(0.25 + 0.2 * Math.sin(t * 4 + 1)); mDec.glow(0.25 + 0.2 * Math.sin(t * 4 + 2));
          // chart: grows up to this episode's step count
          const kNow = lerp(e === 0 ? 0 : EPS[e - 1].k, ep.k, smooth(seg(lt, 0, 1.2)));
          const cpts = []; for (let i = 0; i <= 63; i++) { const x = (i / 63) * kNow; cpts.push(cp(x)); }
          chart.set(cpts, 64); dot.position.copy(cp(kNow));
          valLbl.set(`${Math.round(SR(kNow) * 100)}%`);
          const status = ep.fail === 'miss' ? 'missed the corner' : ep.fail === 'drop' ? 'dropped mid-fold' : 'clean fold';
          ctx.hud(`task       "fold the towel"\ncheckpoint ${String(ep.k).padStart(2, ' ')}k steps · VLM frozen ❄\nattempt    ${lt > 4.2 ? status : '…'}`);
        },
      };
    },
  };

  /* ================= 05 · RL: parallel sim environments ================= */
  S[5] = {
    id: 'rl', cat: 'train', title: 'RL / refinement', sub: 'optional, rising',
    cam: { pos: [0.05, 1.7, 1.8], target: [0, 0.02, -0.12], fov: 42 },
    caption: 'The policy practises in nine parallel simulations with a sparse reward: +1 if the cube ends on the pad. Failures flash, the update favours what worked, and the success rate per iteration climbs on the board behind.',
    build(ctx) {
      const scene = V.makeScene({ floor: -0.02, fog: [3.2, 7], shadowR: 1.5, sun: [1, 5, 2.5], gridSize: 8, gridStep: 0.25 });
      const SC = 0.6, envs = [];
      const rr = rng(5);
      for (let i = 0; i < 9; i++) {
        const g = new T.Group(); g.scale.setScalar(SC);
        g.position.set(((i % 3) - 1) * 0.52, 0, (Math.floor(i / 3) - 1) * 0.4); scene.add(g);
        const top = V.box(0.66, 0.03, 0.5, 'table', 'ink'); top.position.y = -0.015; g.add(top);
        const frame = V.polyline([vec(-0.35, 0.002, -0.27), vec(0.35, 0.002, -0.27), vec(0.35, 0.002, 0.27), vec(-0.35, 0.002, 0.27), vec(-0.35, 0.002, -0.27)], V.lineNew('soft', 1));
        g.add(frame);
        const arm = V.arm(); arm.root.position.set(-0.24, 0, 0); g.add(arm.root);
        const pad = V.polyline([vec(-0.035, 0.001, -0.035), vec(0.035, 0.001, -0.035), vec(0.035, 0.001, 0.035), vec(-0.035, 0.001, 0.035), vec(-0.035, 0.001, -0.035)], V.line('data', 1)); g.add(pad);
        const cube = R.cube(g);
        const run = new R.Runner({ A: arm }, cube, () => HALF);
        envs.push({ g, arm, pad, cube, run, frame, res: null, flash: 0, delay: rr() * 0.6 });
      }
      // success-per-iteration bars behind the grid
      const NB = 14, bars = [];
      for (let i = 0; i < NB; i++) { const b = V.box(0.06, 1, 0.06, 'train', 'ink'); b.position.set(-0.68 + i * 0.105, 0, -0.78); b.visible = false; scene.add(b); bars.push(b); }
      const baseLine = V.polyline([vec(-0.74, 0, -0.78), vec(0.74, 0, -0.78)], V.line('ink', 1)); scene.add(baseLine);
      ctx.labels.add('success rate per iteration', vec(0.74, 0.52, -0.78), { cls: 'right train' });
      const hist = [];
      const ROUND = 6.0;
      let cur = -1;
      const toWorld = (g) => (p) => g.localToWorld(p);
      const pSucc = (it) => 0.22 + 0.72 * (1 - Math.exp(-it / 4.5));
      function round(it, t0) {
        const r = rng(it * 131 + 7), p = pSucc(it);
        envs.forEach((e) => {
          const cx = -0.01 + r() * 0.12, cz = (r() - 0.5) * 0.2, pz = cz > 0 ? -0.13 : 0.13, px = 0.03 + r() * 0.05;
          const ok = r() < p, fail = ok ? null : r() < 0.5 ? 'miss' : 'drop';
          e.pad.position.set(px, 0, pz);
          const w = e.g.localToWorld(vec(cx, HALF, cz));
          e.cube.place(cx, HALF, cz, e.arm.yawTo(w) - 0);
          e.cube.rest = HALF;
          e.run.start(R.pickPlaceTask({ cx, cz, px, pz, fail }), t0 + e.delay);
          e.res = null; e.ok = ok; e.delay = r() * 0.6;
        });
      }
      return {
        scene,
        update(t, dt) {
          const it = Math.floor(t / ROUND);
          if (it !== cur) {
            if (cur >= 0) { const s = envs.filter((e) => e.ok).length / 9; hist.push(s); if (hist.length > NB) hist.shift(); }
            cur = it; round(it, it * ROUND);
          }
          envs.forEach((e) => {
            const lt = e.run.drive(Math.max(t, e.run.t0), 0, null, toWorld(e.g));
            e.cube.step(dt);
            if (e.run.done && e.res === null) { e.res = e.ok; e.flash = 1; V.role(e.frame.material, e.ok ? 'good' : 'bad'); }
            if (e.res === null) V.role(e.frame.material, 'soft');
            e.frame.material.opacity = e.res === null ? 1 : 0.5 + 0.5 * e.flash;
            e.flash = Math.max(0.4, e.flash - dt * 0.8);
          });
          bars.forEach((b, i) => {
            const v = hist[i];
            b.visible = v !== undefined;
            if (v !== undefined) { const h = Math.max(0.01, v * 0.5); b.scale.y = h; b.position.y = h / 2; }
          });
          const done = envs.filter((e) => e.res !== null), wins = done.filter((e) => e.res).length;
          const avg = hist.length ? hist.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, hist.length) : 0;
          ctx.hud(`iteration ${String(it + 1).padStart(3, '0')} · 9 parallel envs\nreward    +1 if the cube ends on the pad\nthis iter ${wins}/${done.length} succeeded\nlast 5    ${(avg * 100).toFixed(0)}% success`);
        },
      };
    },
  };
})();
