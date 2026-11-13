/* vla/page.js: runtime for the VLA page. One WebGL renderer, one scene live at a time.
   Scrolling picks the stage, pointing at a stage previews its scene, clicking jumps to it. */
(function () {
  'use strict';
  const T = window.THREE, V = window.VLA, defs = V.scenes;
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const stage = $('#stage'), view = $('#view'), canvas = $('#gl');
  const stageNo = $('#stageNo'), stageName = $('#stageName'), stageCap = $('#stageCap');
  const steps = $$('.step'), stepsEl = $('.steps'), railFill = $('.rail i');
  const strip = $$('#strip button'), pauseBtn = $('#pauseBtn'), resetBtn = $('#resetBtn'), orbitBtn = $('#orbitBtn');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = () => innerWidth < 980;

  /* ---------- theme (shared with the rest of the site through localStorage) ---------- */
  const themeBtn = $('#themeBtn');
  const syncThemeBtn = () => { themeBtn.textContent = root.getAttribute('data-theme') === 'dark' ? '[ light ]' : '[ dark ]'; };
  themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncThemeBtn();
    V.setTheme(next);
    if (renderer) renderer.setClearColor(V.col('bg'), 1);
  });
  syncThemeBtn();

  /* ---------- renderer ---------- */
  let renderer = null;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
  if (!renderer) {
    view.classList.add('nogl');
    const p = document.createElement('p'); p.className = 'fallback';
    p.textContent = 'WebGL is not available in this browser, so the 3D scenes cannot run. The article reads fine without them.';
    view.appendChild(p);
  }
  const camera = new T.PerspectiveCamera(40, 1, 0.02, 80);
  camera.layers.enable(1);
  let controls = null;
  if (renderer) {
    renderer.setPixelRatio(Math.min(coarse ? 1.5 : 2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(V.col('bg'), 1);
    controls = new T.OrbitControls(camera, canvas);
    Object.assign(controls, { enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.55, minPolarAngle: 0.12, maxPolarAngle: 1.5 });
    if (coarse) { controls.enabled = false; canvas.style.touchAction = 'pan-y'; }
  }
  if (orbitBtn) {
    orbitBtn.hidden = !coarse || !renderer;
    orbitBtn.addEventListener('click', () => {
      controls.enabled = !controls.enabled;
      canvas.style.touchAction = controls.enabled ? 'none' : 'pan-y';
      orbitBtn.setAttribute('aria-pressed', String(controls.enabled));
      orbitBtn.textContent = controls.enabled ? '[ orbit: on ]' : '[ orbit ]';
    });
  }

  /* ---------- scenes ---------- */
  const lblHost = $('#lblHost'), hudHost = $('#hudHost'), insetHost = $('#insetHost');
  const built = [];
  let active = -1, shown = -1, swapTimer = 0;
  function ensure(i) {
    if (built[i]) return built[i];
    const d = defs[i];
    const labels = new V.Labels(lblHost); labels.show(false);
    const hud = document.createElement('pre'); hud.className = 'hud'; hud.hidden = true; hudHost.appendChild(hud);
    let last = '';
    const ctx = { labels, hud: (s) => { if (s !== last) { last = s; hud.textContent = s; } }, goto: (k) => jumpTo(k) };
    const s = d.build(ctx);
    s.labels = labels; s.hudEl = hud; s.t = 0;
    s.insetEls = (s.insets || []).map((ins) => {
      const f = document.createElement('div'); f.className = 'inset'; f.hidden = true;
      const sp = document.createElement('span'); sp.textContent = ins.label; f.appendChild(sp); insetHost.appendChild(f);
      return f;
    });
    s.scene.updateMatrixWorld(true);
    s.update(0, 1 / 60);
    if (reduce) { s.t = 3.2; s.update(s.t, 1 / 60); }
    built[i] = s;
    return s;
  }
  // scenes are framed for a ~1.18 landscape view; narrower views pull the camera back to keep everything in
  function resetCam() {
    const c = defs[shown].cam;
    size();
    const k = Math.max(1, Math.pow(1.18 / Math.max(0.3, camera.aspect), 0.85));
    controls.target.set(...c.target);
    camera.position.set(...c.pos).sub(controls.target).multiplyScalar(k).add(controls.target);
    camera.fov = c.fov || 40; camera.updateProjectionMatrix();
    controls.update();
  }
  function swapTo(i) {
    const prev = built[shown];
    if (prev) { prev.labels.show(false); prev.hudEl.hidden = true; prev.insetEls.forEach((e) => (e.hidden = true)); if (prev.onHover) prev.onHover(null); }
    const s = ensure(i);
    shown = i;
    s.labels.show(true); s.hudEl.hidden = false; s.insetEls.forEach((e) => (e.hidden = false));
    pickHover = null; canvas.style.cursor = '';
    resetCam();
  }
  function show(i) {
    if (i === active) return;
    active = i;
    const d = defs[i];
    stageNo.textContent = String(i).padStart(2, '0');
    stageName.textContent = d.title + ' · ' + d.sub;
    stageCap.textContent = d.caption;
    stage.dataset.cat = d.cat;
    strip.forEach((b) => b.classList.toggle('on', +b.dataset.go === i));
    steps.forEach((s) => s.classList.toggle('shown', +s.dataset.scene === i));
    if (!renderer) return;
    if (shown < 0) { swapTo(i); return; }
    view.classList.add('swap');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => { swapTo(active); requestAnimationFrame(() => view.classList.remove('swap')); }, 150);
  }

  /* ---------- render loop ---------- */
  let W = 0, H = 0;
  function size() {
    const w = view.clientWidth, h = view.clientHeight;
    if (w !== W || h !== H) {
      const was = camera.aspect;
      W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
      if (shown >= 0 && Math.abs(was - camera.aspect) > 0.02) resetCam();
    }
  }
  function render(s) {
    size();
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    renderer.render(s.scene, camera);
    s.labels.update(camera, W, H);
    if (s.insets && s.insets.length) {
      const iw = Math.round(clamp(W * 0.22, 104, 200)), ih = Math.round(iw * 0.75), m = 10;
      renderer.setScissorTest(true);
      s.insets.forEach((ins, k) => {
        const x = W - m - (k + 1) * iw - k * 8, y = m;
        renderer.setScissor(x, y, iw, ih); renderer.setViewport(x, y, iw, ih);
        if (ins.cam.aspect !== iw / ih) { ins.cam.aspect = iw / ih; ins.cam.updateProjectionMatrix(); }
        renderer.render(s.scene, ins.cam);
        const f = s.insetEls[k].style; f.left = x + 'px'; f.top = H - y - ih + 'px'; f.width = iw + 'px'; f.height = ih + 'px';
      });
      renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    }
  }
  let last = performance.now(), onScreen = true, paused = reduce;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!renderer || !onScreen || document.hidden || shown < 0) return;
    const s = built[shown];
    if (!paused) { s.t += dt; s.update(s.t, dt); }
    controls.update();
    render(s);
  }
  if (renderer) {
    new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }, { threshold: 0 }).observe(stage);
    requestAnimationFrame(frame);
  }
  const syncPause = () => { pauseBtn.textContent = paused ? '[ play ]' : '[ pause ]'; pauseBtn.setAttribute('aria-pressed', String(paused)); };
  pauseBtn.addEventListener('click', () => { paused = !paused; syncPause(); });
  syncPause();
  resetBtn.addEventListener('click', () => { if (renderer && shown >= 0) resetCam(); });

  /* ---------- picking inside the 3D view (overview blocks) ---------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  let pickHover = null, downAt = null;
  canvas.addEventListener('pointermove', (e) => {
    const s = built[shown]; if (!s || !s.pick) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(s.pick, false)[0];
    const idx = hit ? hit.object.userData.idx : null;
    if (idx !== pickHover) { pickHover = idx; s.onHover(idx); canvas.style.cursor = idx === null ? '' : 'pointer'; }
  });
  canvas.addEventListener('pointerleave', () => { const s = built[shown]; if (s && s.onHover) s.onHover(null); pickHover = null; });
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('click', (e) => {
    const s = built[shown];
    if (!s || !s.onPick || pickHover === null || !downAt) return;
    if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6) s.onPick(pickHover);
  });

  /* ---------- the scroll line: scroll position picks the stage, pointing previews ---------- */
  let preview = null, previewTimer = 0, scrollIdx = 0, pinnedPreview = false;
  function activationLine() {
    if (!mobile()) return innerHeight * 0.42;
    const b = stage.getBoundingClientRect().bottom;
    return b + (innerHeight - b) * 0.3;
  }
  function computeScroll() {
    const line = activationLine();
    let idx = 0;
    for (const s of steps) if (s.getBoundingClientRect().top < line) idx = +s.dataset.scene;
    scrollIdx = idx;
    steps.forEach((s) => { const k = +s.dataset.scene; s.classList.toggle('active', k === idx); s.classList.toggle('past', k < idx); });
    const r = stepsEl.getBoundingClientRect();
    railFill.style.height = (clamp((line - r.top) / r.height, 0, 1) * 100).toFixed(2) + '%';
  }
  function resolve() { show(preview === null ? scrollIdx : preview); }
  function setPreview(i, delay = 0) {
    clearTimeout(previewTimer);
    const go = () => { preview = i; steps.forEach((s) => s.classList.toggle('previewing', i !== null && +s.dataset.scene === i && i !== scrollIdx)); resolve(); };
    if (delay) previewTimer = setTimeout(go, delay); else go();
  }
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { ticking = false; computeScroll(); if (preview !== null && !pinnedPreview) setPreview(null); else resolve(); });
  }, { passive: true });
  addEventListener('resize', () => { computeScroll(); resolve(); });

  function jumpTo(k) {
    const el = steps.find((s) => +s.dataset.scene === k); if (!el) return;
    const off = mobile() ? stage.getBoundingClientRect().height + 14 : innerHeight * 0.14;
    setPreview(null);
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - off, behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + el.id);
  }
  // pointing at a stage in the article previews its scene (pointer move, not scroll, so reading isn't jumpy)
  // mouse / pen only: a finger scrolling the article must not swap scenes under it
  const pointing = (e) => e.pointerType === 'mouse' || e.pointerType === 'pen';
  steps.forEach((s) => s.addEventListener('pointermove', (e) => { if (pointing(e) && preview !== +s.dataset.scene) setPreview(+s.dataset.scene, 110); }));
  stepsEl.addEventListener('pointerleave', (e) => { if (pointing(e)) setPreview(null, 60); });
  steps.forEach((s) => {
    const k = +s.dataset.scene;
    $$('.dot, .step-head', s).forEach((el) => el.addEventListener('click', (e) => { if (e.target.closest('a')) return; jumpTo(k); }));
  });
  // the map in section 00 and the strip above the viewport
  const previewers = [...$$('[data-go]')];
  previewers.forEach((el) => {
    const k = +el.dataset.go;
    el.addEventListener('pointerenter', () => { pinnedPreview = true; setPreview(k); });
    el.addEventListener('pointerleave', () => { pinnedPreview = false; setPreview(null, 80); });
    el.addEventListener('focus', () => { pinnedPreview = true; setPreview(k); });
    el.addEventListener('blur', () => { pinnedPreview = false; setPreview(null, 80); });
    el.addEventListener('click', () => { pinnedPreview = false; jumpTo(k); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pinnedPreview = false; jumpTo(k); } });
  });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => V.refreshText());
  computeScroll();
  show(scrollIdx);
  // build (and compile shaders for) the other scenes in idle time, so pointing at a stage swaps instantly
  if (renderer) {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 120));
    let k = 0;
    const next = () => {
      while (k < defs.length && built[k]) k++;
      if (k >= defs.length) return;
      try { const s = ensure(k); renderer.compile(s.scene, camera); } catch (e) { console.error(e); }
      idle(next, { timeout: 1500 });
    };
    setTimeout(() => idle(next, { timeout: 1500 }), 1200);
  }
  // test hook: advance the live scene by `secs` in fixed steps and draw it (used by the page checks)
  V.debug = {
    camera, controls, built, show, jumpTo, get shown() { return shown; },
    release() { pinnedPreview = false; setPreview(null); },
    step(secs = 0, i) {
      if (i !== undefined) { preview = i; pinnedPreview = true; if (i !== shown) { active = -1; show(i); clearTimeout(swapTimer); swapTo(i); } clearTimeout(swapTimer); view.classList.remove('swap'); }
      const s = built[shown]; const n = Math.round(secs * 60);
      for (let k = 0; k < n; k++) { s.t += 1 / 60; s.update(s.t, 1 / 60); }
      controls.update(); render(s); return s.t;
    },
  };
  // ?scene=N&t=S opens one scene frozen at time S (handy for screenshots and for linking a specific moment)
  const qs = new URLSearchParams(location.search);
  if (renderer && qs.has('scene')) {
    const i = clamp(Math.round(+qs.get('scene')) || 0, 0, defs.length - 1);
    const s0 = document.querySelector('.story');
    window.scrollTo(0, s0.getBoundingClientRect().top + scrollY - 12);
    computeScroll();
    paused = true; syncPause();
    V.debug.step(Math.max(0, +qs.get('t') || 3), i);
  }
})();
