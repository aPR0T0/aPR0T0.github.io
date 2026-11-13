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
          if (on) { path.getPointAt(clamp(u, 0, 1), tmp); pulse.position.copy(tmp); hist.push(tmp.clone()); }
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
          if (fpulse.visible) fpath.getPointAt(clamp(fu, 0, 1), fpulse.position);
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

  /* ================= 01 · VLM pretraining ================= */
  S[1] = {
    id: 'vlm', cat: 'train', title: 'VLM pretraining', sub: 'internet image + text',
    cam: { pos: [-0.7, 1.95, 4.95], target: [-0.74, 0.62, 0], fov: 42 },
    caption: 'An image is cut into patches, the vision encoder turns them into tokens, and the language model reads them next to the caption and predicts the next word. Billions of these pairs teach it what things are.',
    build(ctx) {
      const scene = V.makeScene({ floor: -0.12, fog: [6, 13], shadowR: 3.2, sun: [1.5, 6, 3.5], gridSize: 9, gridStep: 0.5 });
      const ENC = { x: -1.05, n: 3, gap: 0.34, w: 1.12, d: 0.46 }, LLM = { x: 0.62, n: 6, gap: 0.3, w: 1.34, d: 0.56 };
      const enc = [], llm = [];
      for (let i = 0; i < ENC.n; i++) { const f = R.floor(ENC.w, ENC.d); f.position.set(ENC.x, i * ENC.gap, 0); scene.add(f); enc.push(f); }
      for (let i = 0; i < LLM.n; i++) { const f = R.floor(LLM.w, LLM.d); f.position.set(LLM.x, i * LLM.gap, 0); scene.add(f); llm.push(f); }
      ctx.labels.add('vision encoder · ViT', vec(ENC.x, (ENC.n - 1) * ENC.gap + 0.12, -0.2), { cls: 'train' });
      ctx.labels.add('language model · decoder', vec(LLM.x, (LLM.n - 1) * LLM.gap + 0.12, -0.2), { cls: 'train' });

      const texs = IMAGES.map((im) => V.canvasTex(256, 256, im.draw));
      const imgMat = new T.MeshBasicMaterial({ map: texs[0], transparent: true });
      const card = new T.Mesh(V.geo('p0.9,0.9', () => new T.PlaneGeometry(0.9, 0.9)), imgMat);
      V.edges(card, 'ink'); card.position.set(-2.3, 0.62, 0.15); card.rotation.y = 0.22; scene.add(card); card.updateMatrixWorld();
      ctx.labels.add('web image + caption', vec(-2.3, 1.14, 0.15));
      // 9 patch tiles share the image texture through their UVs
      const tileMat = new T.MeshBasicMaterial({ map: texs[0], side: T.DoubleSide });
      const tiles = [];
      for (let i = 0; i < 9; i++) {
        const r = Math.floor(i / 3), c = i % 3;
        const g = new T.PlaneGeometry(1, 1), uv = g.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (c + uv.getX(k)) / 3, (2 - r + uv.getY(k)) / 3);
        const m = new T.Mesh(g, tileMat); V.edges(m, 'ink'); scene.add(m);
        const from = card.localToWorld(vec((c - 1) * 0.3, (1 - r) * 0.3, 0.004));
        tiles.push({ m, from, r, c });
      }
      // caption words
      const words = [0, 1, 2, 3, 4].map((i) => {
        const tex = V.canvasTex(256, 96, (cx, P, w, h, st) => {
          cx.fillStyle = P.body; cx.fillRect(0, 0, w, h); cx.strokeStyle = P.ink; cx.lineWidth = 5; cx.strokeRect(2.5, 2.5, w - 5, h - 5);
          cx.fillStyle = P.ink; cx.font = V.font(42, 500); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(st.word || '', w / 2, h / 2 + 2);
        }, { word: '' });
        const m = R.card(0.2, 0.075, tex, null); scene.add(m);
        return { m, tex, from: vec(-2.73 + i * 0.215, 0.05, 0.3) };
      });
      const predTex = V.canvasTex(256, 96, (cx, P, w, h, st) => {
        cx.fillStyle = P.trainFill; cx.fillRect(0, 0, w, h); cx.strokeStyle = P.train; cx.lineWidth = 6; cx.strokeRect(3, 3, w - 6, h - 6);
        cx.fillStyle = P.train; cx.font = V.font(44, 600); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(st.word || '', w / 2, h / 2 + 2);
      }, { word: '' });
      const pred = R.card(0.26, 0.095, predTex, null); scene.add(pred);
      const predLbl = ctx.labels.add('', pred, { off: [-0.16, 0, 0], cls: 'train right' });
      // causal attention arcs on the current layer
      const arcs = V.dynLine(14 * 3 * 9 * 2, V.lineNew('train', 0.55), T.LineSegments); scene.add(arcs);
      const arcPts = [];
      // token slots
      const encSlot = (k) => vec(ENC.x + (k - 4) * 0.114, 0.07, 0.02);
      const llmSlot = (k) => (k < 9 ? vec(LLM.x - 0.448 + k * 0.112, 0.07, -0.12) : vec(LLM.x - 0.432 + (k - 9) * 0.216, 0.065, 0.13));
      const CYCLE = 7.4;
      let cur = -1, nWords = 0, sample = 1023988;
      const p = vec(0, 0, 0);
      function setImage(k) {
        const im = IMAGES[k]; imgMat.map = texs[k]; tileMat.map = texs[k]; imgMat.needsUpdate = tileMat.needsUpdate = true;
        nWords = im.words.length;
        words.forEach((w, i) => { V.retex(w.tex, { word: im.words[i] || '' }); w.m.visible = i < nWords; });
        V.retex(predTex, { word: im.next });
      }
      return {
        scene,
        update(t) {
          const cyc = Math.floor(t / CYCLE), lt = t % CYCLE, k = cyc % IMAGES.length;
          if (cyc !== cur) { cur = cyc; setImage(k); sample += 512; }
          const fadeIn = smooth(lt / 0.35), fadeOut = 1 - smooth((lt - 6.85) / 0.45);
          imgMat.opacity = 0.35 + 0.65 * fadeIn * fadeOut;
          // tiles: card -> encoder floor 0 -> up the encoder -> llm floor 0 -> up the llm
          tiles.forEach((tl, i) => {
            const a = easeIO(seg(lt, 0.4 + i * 0.04, 1.4 + i * 0.04));
            const up = seg(lt, 1.6, 2.8) * (ENC.n - 1) * ENC.gap;
            const b = easeIO(seg(lt, 2.85 + i * 0.03, 3.55 + i * 0.03));
            const climb = seg(lt, 3.7, 5.5) * (LLM.n - 1) * LLM.gap;
            p.copy(tl.from).lerp(encSlot(i), a); p.y += up * (1 - b);
            if (b > 0) { const s = encSlot(i); s.y += (ENC.n - 1) * ENC.gap; p.copy(s).lerp(llmSlot(i), b); p.y += Math.sin(b * PI) * 0.35 + climb; }
            tl.m.position.copy(p);
            tl.m.rotation.y = lerp(card.rotation.y, 0, a);
            const sz = lerp(0.3, 0.095, a);
            tl.m.scale.set(sz, sz, 1);
            tl.m.visible = lt < 6.9;
          });
          words.forEach((w, i) => {
            if (i >= nWords) return;
            const b = easeIO(seg(lt, 2.7 + i * 0.05, 3.5 + i * 0.05));
            const climb = seg(lt, 3.7, 5.5) * (LLM.n - 1) * LLM.gap;
            p.copy(w.from).lerp(llmSlot(9 + i), b); p.y += Math.sin(b * PI) * 0.3 + climb;
            w.m.position.copy(p); w.m.visible = lt < 6.9 && lt > 0.15;
          });
          // layer flashes
          enc.forEach((f, i) => R.flash(f, 'train', 0.4 * Math.max(0, 1 - Math.abs(lt - (1.6 + i * 0.6)) / 0.35)));
          llm.forEach((f, i) => R.flash(f, 'train', 0.4 * Math.max(0, 1 - Math.abs(lt - (3.7 + i * 0.36)) / 0.3)));
          // attention arcs at the layer the tokens are on
          arcPts.length = 0;
          if (lt > 3.7 && lt < 5.6) {
            const lay = Math.min(LLM.n - 1, Math.floor((lt - 3.7) / 0.36));
            const rr = rng(cyc * 31 + lay * 7 + 1), n = 9 + nWords, y0 = 0.1 + seg(lt, 3.7, 5.5) * (LLM.n - 1) * LLM.gap;
            for (let q = 1; q < n; q++) for (let e = 0; e < 2; e++) {
              const j = Math.floor(rr() * q), A = llmSlot(q), B = llmSlot(j), hgt = 0.05 + 0.03 * (q - j) * 0.35;
              let prev = null;
              for (let s = 0; s <= 6; s++) {
                const u = s / 6, P = vec(lerp(A.x, B.x, u), y0 + Math.sin(u * PI) * hgt, lerp(A.z, B.z, u));
                if (prev) arcPts.push(prev, P); prev = P;
              }
            }
          }
          arcs.set(arcPts, arcPts.length);
          arcs.material.opacity = 0.45;
          // prediction
          const pr = smooth(seg(lt, 5.55, 6.1));
          pred.visible = pr > 0 && lt < 6.95;
          const last = llmSlot(8 + nWords); last.y += (LLM.n - 1) * LLM.gap;
          pred.position.set(Math.min(last.x + 0.1, LLM.x + 0.5), last.y + 0.1 + 0.3 * pr, last.z);
          const loss = 1.15 + 1.7 * Math.exp(-cyc / 5) + 0.12 * Math.sin(cyc * 2.1);
          predLbl.set('next token · loss ' + loss.toFixed(2));
          predLbl.show(pred.visible);
          ctx.hud(`objective  next-token prediction\ndata       image–text pairs from the web\nsample     ${sample.toLocaleString('en-US')}\nloss       ${loss.toFixed(2)}`);
        },
      };
    },
  };

  /* ================= 03 · VLA pretraining: action expert + flow matching ================= */
  S[3] = {
    id: 'vla', cat: 'train', title: 'VLA pretraining', sub: 'add action head',
    cam: { pos: [-0.3, 1.95, 4.65], target: [-0.28, 0.84, 0], fov: 42 },
    caption: 'Robot episodes from many embodiments become tokens next to the instruction. A small action expert reads the backbone layer by layer and integrates a noisy 50-step action chunk into a smooth motion (flow matching).',
    build(ctx) {
      const scene = V.makeScene({ floor: -0.12, fog: [6, 13], shadowR: 3.4, sun: [1.5, 6, 3.5], gridSize: 9, gridStep: 0.5 });
      const BB = { x: -0.45, n: 5, gap: 0.3, w: 1.6, d: 0.46 }, EX = { x: 0.95, n: 5, w: 0.62, d: 0.46 };
      const bb = [], ex = [];
      for (let i = 0; i < BB.n; i++) {
        const f = R.floor(BB.w, BB.d); f.position.set(BB.x, i * BB.gap, 0); scene.add(f); bb.push(f);
        const e = R.floor(EX.w, EX.d, 'deployFill', 'deploy'); e.position.set(EX.x, i * BB.gap, 0); scene.add(e); ex.push(e);
      }
      ctx.labels.add('VLM backbone · ~3B', vec(BB.x, (BB.n - 1) * BB.gap + 0.12, -0.2), { cls: 'train' });
      ctx.labels.add('action expert · ~300M', vec(EX.x, -0.04, 0.24), { cls: 'deploy down' });
      // embodiments feeding the mixture
      const minis = [];
      const MX = -1.88;
      const plinth = (z) => { const p = V.box(0.5, 0.06, 0.4, 'body2', 'ink'); p.position.set(MX, -0.09, z); scene.add(p); return p; };
      plinth(-0.62); plinth(0); plinth(0.62);
      const a1 = V.arm({ scale: 0.75 }); a1.root.position.set(MX - 0.17, -0.06, -0.62); scene.add(a1.root); minis.push(a1);
      const b1 = V.arm({ scale: 0.5 }), b2 = V.arm({ scale: 0.5 });
      b1.root.position.set(MX - 0.21, -0.06, 0); b2.root.position.set(MX + 0.21, -0.06, 0); b2.root.rotation.y = PI; scene.add(b1.root, b2.root); minis.push(b1, b2);
      const base = V.box(0.32, 0.08, 0.24, 'body', 'ink'); base.position.set(MX, -0.01, 0.62); scene.add(base);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = V.cyl(0.035, 0.035, 0.03, 16, 'body2', 'ink'); w.rotation.x = PI / 2; w.position.set(MX + sx * 0.11, -0.04, 0.62 + sz * 0.13); scene.add(w); }
      const m1 = V.arm({ scale: 0.55 }); m1.root.position.set(MX - 0.07, 0.03, 0.62); scene.add(m1.root); minis.push(m1);
      ctx.labels.add('single-arm · bimanual · mobile data', vec(MX, 0.5, -0.62), { cls: 'data' });
      // tokens: 6 image, 4 words, 1 state on the backbone; 5 noisy action tokens on the expert
      const img = [], wordsM = [], act = [];
      for (let i = 0; i < 6; i++) { const m = V.box(0.07, 0.07, 0.07, 'train', 'ink'); scene.add(m); img.push(m); }
      ['pick', 'up', 'the', 'cube'].forEach((w) => { const m = R.card(0.17, 0.066, V.wordTex(w, { px: 44 }), null); scene.add(m); wordsM.push(m); });
      const state = V.box(0.07, 0.07, 0.07, 'data', 'ink'); scene.add(state);
      ctx.labels.add('q_t', state, { off: [0, 0.07, 0], cls: 'data' });
      for (let i = 0; i < 5; i++) { const m = V.box(0.065, 0.065, 0.065, 'deploy', 'ink'); scene.add(m); act.push(m); }
      const slot = (k) => (k < 6 ? vec(BB.x - 0.71 + k * 0.1, 0.075, 0.02) : k < 10 ? vec(BB.x - 0.04 + (k - 6) * 0.185, 0.068, 0.02) : vec(BB.x + 0.7, 0.075, 0.02));
      const aslot = (k) => vec(EX.x - 0.2 + k * 0.1, 0.075, 0.02);
      const packets = [];
      for (let i = 0; i < 11; i++) { const m = V.box(0.04, 0.04, 0.04, 'data', null); scene.add(m); packets.push({ m, from: vec(MX, 0.25, [-0.62, 0, 0.62][i % 3]) }); }
      // cross-attention lines between the two towers
      const xatt = V.dynLine(5 * 3 * 2, V.lineNew('deploy', 0.6), T.LineSegments); scene.add(xatt);
      // action chunk box
      const BOX = { x: 0.95, y: 1.78, z: 0, w: 0.9, h: 0.6, d: 0.5 };
      const frame = V.segments([], V.line('soft', 1));
      const bx = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(BOX.w, BOX.h, BOX.d)), V.line('muted', 0.8)); bx.position.set(BOX.x, BOX.y, BOX.z); scene.add(bx, frame);
      const H = 50, pts = [], noise = [], goal = [];
      for (let i = 0; i < H; i++) { pts.push(vec(0, 0, 0)); noise.push(vec(0, 0, 0)); goal.push(vec(0, 0, 0)); }
      const dots = V.dynLine(H, V.pointsMat('deploy', 0.035), T.Points); scene.add(dots);
      const curve = V.dynLine(H, V.lineNew('deploy', 0.9)); scene.add(curve);
      ctx.labels.add('action chunk · H = 50', vec(BOX.x - BOX.w / 2, BOX.y + BOX.h / 2, -BOX.d / 2), { cls: 'deploy left' });
      const stepLbl = ctx.labels.add('', vec(BOX.x + BOX.w / 2, BOX.y - BOX.h / 2, BOX.d / 2), { cls: 'right down' });
      const CYCLE = 8.6;
      let cur = -1;
      const P = vec(0, 0, 0), tmp = [];
      function newChunk(c) {
        const r = rng(c * 97 + 3), ph = r() * 2 * PI, side = r() < 0.5 ? -1 : 1, depth = 0.24 + r() * 0.1;
        for (let i = 0; i < H; i++) {
          const u = i / (H - 1);
          goal[i].set(BOX.x - 0.36 + 0.72 * u, BOX.y + 0.17 - depth * 0.9 * Math.exp(-Math.pow((u - 0.52) / 0.17, 2)) + 0.05 * u, BOX.z + side * 0.13 * Math.sin(PI * u + ph * 0.2));
          noise[i].set(BOX.x + gauss(r) * 0.19, BOX.y + gauss(r) * 0.15, BOX.z + gauss(r) * 0.12);
        }
      }
      return {
        scene,
        update(t) {
          const cyc = Math.floor(t / CYCLE), lt = t % CYCLE;
          if (cyc !== cur) { cur = cyc; newChunk(cyc); }
          const climb = seg(lt, 1.3, 3.3) * (BB.n - 1) * BB.gap;
          packets.forEach((pk, i) => {
            const a = easeIO(seg(lt, 0.1 + i * 0.05, 1.0 + i * 0.05));
            P.copy(pk.from).lerp(slot(i), a); P.y += Math.sin(a * PI) * 0.5;
            pk.m.position.copy(P); pk.m.visible = a > 0 && a < 1;
          });
          const showTok = lt > 1.0 && lt < 8.3;
          img.forEach((m, i) => { m.position.copy(slot(i)); m.position.y += climb; m.visible = showTok; });
          wordsM.forEach((m, i) => { m.position.copy(slot(6 + i)); m.position.y += climb; m.visible = showTok; });
          state.position.copy(slot(10)); state.position.y += climb; state.visible = showTok;
          act.forEach((m, i) => {
            m.position.copy(aslot(i)); m.position.y += climb;
            const j = (1 - seg(lt, 3.4, 6.6)) * 0.02; m.position.x += Math.sin(t * 23 + i * 5) * j; m.position.z += Math.cos(t * 19 + i * 3) * j;
            m.visible = showTok;
          });
          bb.forEach((f, i) => R.flash(f, 'train', 0.4 * Math.max(0, 1 - Math.abs(lt - (1.3 + i * 0.5)) / 0.3)));
          ex.forEach((f, i) => R.flash(f, 'deploy', 0.35 * Math.max(0, 1 - Math.abs(lt - (1.3 + i * 0.5)) / 0.3)));
          tmp.length = 0;
          if (lt > 1.3 && lt < 3.4) {
            const y = 0.075 + climb, r = rng(Math.floor((lt - 1.3) / 0.5) + cyc * 11);
            for (let i = 0; i < 5; i++) for (let e = 0; e < 3; e++) { const k = Math.floor(r() * 11); const a = slot(k); a.y = y; const b = aslot(i); b.y = y; tmp.push(a, b); }
          }
          xatt.set(tmp, tmp.length);
          // flow matching: x_tau = (1 - tau) * noise + tau * goal, integrated in 10 steps
          const prog = seg(lt, 3.4, 6.6) * 10, k = Math.min(10, Math.floor(prog)), tau = (k + easeIO(prog - k)) / 10;
          const fade = 1 - smooth(seg(lt, 8.1, 8.6));
          for (let i = 0; i < H; i++) pts[i].copy(noise[i]).lerp(goal[i], lt < 3.4 ? 0 : tau);
          dots.set(pts, H); curve.set(pts, H);
          dots.material.opacity = fade; dots.material.transparent = true;
          curve.material.opacity = 0.9 * smooth(tau * 1.4 - 0.4) * fade;
          stepLbl.set(lt < 3.4 ? 'noise ~ N(0, I)' : `flow step ${Math.min(10, Math.ceil(prog) || 1)}/10 · τ ${tau.toFixed(2)}`);
          minis.forEach((a, i) => a.set([Math.sin(t * 0.9 + i) * 0.6, 1.0 + Math.sin(t * 1.3 + i * 2) * 0.25, -2.0 + Math.sin(t * 1.1 + i) * 0.3, -0.7 + Math.sin(t * 1.7 + i) * 0.3, 0, 0.03]));
          ctx.hud(`inputs   2 cams · "pick up the cube" · q_t\noutput   50 future actions (1 s @ 50 Hz)\nloss     flow matching: ‖v_θ(x_τ, τ) − (a − ε)‖²\nmix      many robots + some web data`);
        },
      };
    },
  };

  /* ================= 04 · post-training: towel folding on the target robot ================= */
  S[4] = {
    id: 'post', cat: 'train', title: 'post-training', sub: 'target robot + task',
    cam: { pos: [0.1, 1.36, 1.22], target: [0.05, 0.1, -0.18], fov: 42 },
    caption: 'The generalist is fine-tuned on high-quality demos of one robot doing one task family. The frozen backbone gets small trainable adapters; success climbs as the fold goes from missing the corner to dropping it to a clean fold.',
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
      // the model being fine-tuned
      const MS = { x: 0.42, z: -0.56 }, fl = [], ad = [];
      for (let i = 0; i < 6; i++) {
        const frozen = i < 4;
        const f = R.floor(0.36, 0.24, frozen ? 'faint' : 'trainFill', frozen ? 'muted' : 'train', 0.028); f.position.set(MS.x, 0.06 + i * 0.08, MS.z); scene.add(f); fl.push(f);
        if (frozen) { const a = R.floor(0.07, 0.24, 'trainFill', 'train', 0.028); a.position.set(MS.x + 0.23, 0.06 + i * 0.08, MS.z); scene.add(a); ad.push(a); }
      }
      ctx.labels.add('frozen VLM layers', vec(MS.x - 0.18, 0.12, MS.z + 0.12), { cls: 'right' });
      ctx.labels.add('LoRA + action expert: trained', vec(MS.x + 0.06, 0.56, MS.z), { cls: 'train' });
      const grads = [0, 1, 2].map(() => { const m = V.box(0.03, 0.03, 0.03, 'train', null); scene.add(m); return m; });
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
          // gradients flow down the trainable path while training
          grads.forEach((m, i) => { const u = ((t * 0.7 + i / 3) % 1); m.position.set(MS.x + 0.23, 0.5 - u * 0.44, MS.z + 0.14); });
          ad.forEach((a, i) => R.flash(a, 'train', 0.3 + 0.2 * Math.sin(t * 4 + i)));
          fl.forEach((f, i) => { if (i >= 4) R.flash(f, 'train', 0.3 + 0.2 * Math.sin(t * 4 + i)); });
          // chart: grows up to this episode's step count
          const kNow = lerp(e === 0 ? 0 : EPS[e - 1].k, ep.k, smooth(seg(lt, 0, 1.2)));
          const cpts = []; for (let i = 0; i <= 63; i++) { const x = (i / 63) * kNow; cpts.push(cp(x)); }
          chart.set(cpts, 64); dot.position.copy(cp(kNow));
          valLbl.set(`${Math.round(SR(kNow) * 100)}%`);
          const status = ep.fail === 'miss' ? 'missed the corner' : ep.fail === 'drop' ? 'dropped mid-fold' : 'clean fold';
          ctx.hud(`task      "fold the towel"\ncheckpoint ${String(ep.k).padStart(2, ' ')}k steps · LoRA r = 32\nattempt   ${lt > 4.2 ? status : '…'}`);
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
