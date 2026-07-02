// traxx.js — DJ TRAXX, an interactive robot-mascot easter egg.
//
// A CSS/SVG-drawn robot that "pops out" of the terminal onto the page, roams the
// bottom of the screen, turns to look at you while you type, and can be picked
// up and dragged anywhere — panicking every time you grab him.
//
// Classic script (no ES modules): shares global scope with app.js/content.js and
// borrows their helpers (emit, line) when printing to the terminal. The only
// thing it exports is window.Traxx = { summon, dismiss, toggle }.
//
// Triggered by typing `traxx` or `./traxx` (hooked in app.js runCommand()).

(function () {
  "use strict";

  /* ---------- tiny helpers ---------- */
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var pick = function (a) { return a[(Math.random() * a.length) | 0]; };
  var nowT = function () { return performance.now(); };
  var reduceMotion = function () {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };
  // best-effort print into the site's terminal (helpers are app.js globals)
  var say = function (text, cls) {
    try { if (typeof emit === "function" && typeof line === "function") emit(line(text, cls || "muted")); }
    catch (e) {}
  };

  /* ---------- one-liners ---------- */
  var LINES_HELLO = [
    "yo. DJ TRAXX in the house.",
    "beats loaded. go on, try to pick me up.",
    "who summoned the traxx?",
    "drop the bass... or drop me, i dare you.",
  ];
  var LINES_PANIC = [
    "AAAH put me DOWN!",
    "WOAaaAH!!",
    "i'm FLYING?! this is NOT the vibe!",
    "unhand the traxx!!",
    "eeeeek!",
  ];
  var LINES_LAND = ["phew.", "...never again.", "ok. ok. i'm cool.", "*dizzy*"];
  var LINES_IDLE = ["tss tss tss", "just vibing.", "...", "*scratches record*", "wubwubwub"];

  /* ---------- sprite geometry (viewBox units == px at scale 1) ---------- */
  var BASE_W = 112, BASE_H = 140;
  var W = BASE_W, H = BASE_H;
  var SPEED = 66;      // px/s walking
  var GRAVITY = 2600;  // px/s^2 when dropped

  var SVG_MARKUP =
    '<svg class="tx-svg" viewBox="0 0 112 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DJ TRAXX robot mascot">' +
      // boombox handle
      '<path class="tx-handle" d="M58 22 C 80 4, 104 12, 101 42" fill="none" stroke="#8a8a8e" stroke-width="5" stroke-linecap="round"/>' +
      // yellow speaker module (robot's side)
      '<g class="tx-speaker">' +
        '<rect x="82" y="30" width="20" height="44" rx="6" fill="#f5c518"/>' +
        '<rect x="85" y="35" width="14" height="30" rx="3" fill="#1c1c1e"/>' +
        '<g fill="#f5c518">' +
          '<rect x="88" y="52" width="2.6" height="9" rx="1"/>' +
          '<rect x="92" y="45" width="2.6" height="16" rx="1"/>' +
          '<rect x="96" y="49" width="2.6" height="12" rx="1"/>' +
        '</g>' +
      '</g>' +
      // antenna + knob
      '<rect x="47" y="15" width="10" height="13" rx="2" fill="#2b2b2e"/>' +
      '<circle cx="52" cy="14" r="3.6" fill="#7a6a3a"/>' +
      // arms (pivot from shoulder = top center of each group)
      '<g class="tx-arm-l"><rect x="12" y="70" width="9" height="24" rx="4.5" fill="#2b2b2e"/><circle cx="16.5" cy="96" r="6" fill="#3a3a3f"/></g>' +
      '<g class="tx-arm-r"><rect x="70" y="70" width="9" height="24" rx="4.5" fill="#2b2b2e"/><circle cx="74.5" cy="96" r="6" fill="#3a3a3f"/></g>' +
      // torso
      '<rect x="28" y="74" width="40" height="20" rx="7" fill="#2b2b2e"/>' +
      // legs (pivot from hip = top center of each group)
      '<g class="tx-leg-l">' +
        '<rect x="33" y="92" width="11" height="18" rx="4" fill="#2b2b2e"/>' +
        '<rect x="33" y="108" width="11" height="6" fill="#8a8a8e"/>' +
        '<rect x="33" y="113" width="11" height="14" rx="3" fill="#2b2b2e"/>' +
        '<rect x="29" y="124" width="16" height="9" rx="4" fill="#f5c518"/>' +
      '</g>' +
      '<g class="tx-leg-r">' +
        '<rect x="52" y="92" width="11" height="18" rx="4" fill="#2b2b2e"/>' +
        '<rect x="52" y="108" width="11" height="6" fill="#8a8a8e"/>' +
        '<rect x="52" y="113" width="11" height="14" rx="3" fill="#2b2b2e"/>' +
        '<rect x="51" y="124" width="16" height="9" rx="4" fill="#f5c518"/>' +
      '</g>' +
      // head
      '<rect x="14" y="26" width="70" height="56" rx="12" fill="#2b2b2e"/>' +
      // face screen
      '<rect x="20" y="31" width="50" height="23" rx="4" fill="#e9e6dc"/>' +
      '<rect x="20" y="31" width="50" height="23" rx="4" fill="none" stroke="#cfcabb" stroke-width="1.5"/>' +
      '<g class="tx-eyes" data-kind=""></g>' +
      // lower face: grille + mouth + record light
      '<rect x="22" y="60" width="14" height="5" rx="2" fill="#4a4a4f"/>' +
      '<line class="tx-mouth-idle" x1="41" y1="63" x2="52" y2="63" stroke="#8a8a8e" stroke-width="2.4" stroke-linecap="round"/>' +
      '<circle class="tx-mouth-o" cx="46.5" cy="63.5" r="3.4" fill="none" stroke="#8a8a8e" stroke-width="2.2"/>' +
      '<circle cx="60" cy="63" r="4" fill="#e0574f"/>' +
    '</svg>';

  var EYES = {
    happy: '<path class="tx-eye" d="M31 37 L39 42 L31 47"/><path class="tx-eye" d="M61 37 L53 42 L61 47"/>',
    panic: '<path class="tx-eye" d="M30 37 L40 47 M40 37 L30 47"/><path class="tx-eye" d="M52 37 L62 47 M62 37 L52 47"/>',
    vibe:
      '<g class="tx-eyefill">' +
        '<rect x="30" y="42" width="3.4" height="6" rx="1"/><rect x="35" y="38" width="3.4" height="10" rx="1"/><rect x="40" y="44" width="3.4" height="4" rx="1"/>' +
        '<rect x="52" y="44" width="3.4" height="4" rx="1"/><rect x="57" y="38" width="3.4" height="10" rx="1"/><rect x="62" y="42" width="3.4" height="6" rx="1"/>' +
      '</g>',
    look: '<g class="tx-pupils"><circle class="tx-eyefill" cx="36" cy="42" r="3.6"/><circle class="tx-eyefill" cx="56" cy="42" r="3.6"/></g>',
  };

  /* ---------- styles ---------- */
  var CSS =
    '.tx-root{position:fixed;left:0;top:0;z-index:2147483000;will-change:transform;' +
      'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none;cursor:grab;}' +
    '.tx-root.tx-drag{cursor:grabbing;}' +
    '.tx-facing{position:absolute;inset:0;z-index:1;transform-origin:center bottom;}' +
    '.tx-bob{position:absolute;inset:0;}' +
    '.tx-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;display:block;' +
      'filter:drop-shadow(0 3px 2px rgba(0,0,0,.28));}' +
    '.tx-shadow{position:absolute;left:50%;bottom:2px;width:60%;height:9px;transform:translateX(-50%);' +
      'background:rgba(0,0,0,.30);border-radius:50%;filter:blur(2px);z-index:0;}' +
    '.tx-eye{fill:none;stroke:#26262a;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;}' +
    '.tx-eyefill{fill:#26262a;}' +
    '.tx-eyes,.tx-pupils{transform-box:fill-box;transform-origin:center;}' +
    '.tx-pupils{transition:transform .12s ease-out;}' +
    '.tx-mouth-o{display:none;}' +
    '.tx-root.tx-panic .tx-mouth-o{display:block;}' +
    '.tx-root.tx-panic .tx-mouth-idle{display:none;}' +
    // limb pivots
    '.tx-arm-l,.tx-arm-r,.tx-leg-l,.tx-leg-r{transform-box:fill-box;transform-origin:top center;}' +
    // bob
    '@keyframes tx-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}' +
    '.tx-root.tx-idle .tx-bob{animation:tx-bob 1.9s ease-in-out infinite;}' +
    '.tx-root.tx-walk .tx-bob{animation:tx-bob .5s ease-in-out infinite;}' +
    '.tx-root.tx-panic .tx-bob{animation:tx-bob .12s ease-in-out infinite;}' +
    // walking legs / arms
    '@keyframes tx-step-a{0%,100%{transform:rotate(17deg)}50%{transform:rotate(-17deg)}}' +
    '@keyframes tx-step-b{0%,100%{transform:rotate(-17deg)}50%{transform:rotate(17deg)}}' +
    '.tx-root.tx-walk .tx-leg-l{animation:tx-step-a .5s ease-in-out infinite;}' +
    '.tx-root.tx-walk .tx-leg-r{animation:tx-step-b .5s ease-in-out infinite;}' +
    '@keyframes tx-swing-a{0%,100%{transform:rotate(11deg)}50%{transform:rotate(-11deg)}}' +
    '@keyframes tx-swing-b{0%,100%{transform:rotate(-11deg)}50%{transform:rotate(11deg)}}' +
    '.tx-root.tx-walk .tx-arm-l{animation:tx-swing-a .5s ease-in-out infinite;}' +
    '.tx-root.tx-walk .tx-arm-r{animation:tx-swing-b .5s ease-in-out infinite;}' +
    // panic flail
    '@keyframes tx-flail-a{0%{transform:rotate(38deg)}50%{transform:rotate(-48deg)}100%{transform:rotate(38deg)}}' +
    '@keyframes tx-flail-b{0%{transform:rotate(-38deg)}50%{transform:rotate(48deg)}100%{transform:rotate(-38deg)}}' +
    '.tx-root.tx-panic .tx-arm-l{animation:tx-flail-a .16s linear infinite;}' +
    '.tx-root.tx-panic .tx-arm-r{animation:tx-flail-b .16s linear infinite;}' +
    '.tx-root.tx-panic .tx-leg-l{animation:tx-flail-b .17s linear infinite;}' +
    '.tx-root.tx-panic .tx-leg-r{animation:tx-flail-a .17s linear infinite;}' +
    // blink
    '@keyframes tx-blink{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.12)}}' +
    '.tx-root.tx-blink .tx-eyes{animation:tx-blink .26s ease-in-out;}' +
    // LED name sign
    '.tx-sign{position:absolute;left:50%;top:-12px;transform:translate(-50%,-100%) scale(0);z-index:4;' +
      'transform-origin:center bottom;background:#111;color:#f5c518;font-family:var(--mono,monospace);' +
      'font-weight:600;font-size:13px;letter-spacing:2px;padding:5px 9px;border:2px solid #f5c518;border-radius:3px;' +
      'white-space:nowrap;text-shadow:0 0 5px rgba(245,197,24,.85);box-shadow:0 4px 12px rgba(0,0,0,.4);' +
      'transition:transform .35s cubic-bezier(.2,1.5,.4,1);pointer-events:none;}' +
    '.tx-sign::after{content:"";position:absolute;inset:0;border-radius:2px;pointer-events:none;' +
      'background-image:radial-gradient(rgba(0,0,0,.32) 1px,transparent 1.4px);background-size:3px 3px;}' +
    '.tx-root.tx-signed .tx-sign{transform:translate(-50%,-100%) scale(1);}' +
    '@keyframes tx-flash{0%,100%{opacity:1}50%{opacity:.25}}' +
    '.tx-root.tx-panic.tx-signed .tx-sign{animation:tx-flash .2s steps(1) infinite;}' +
    // speech bubble (themed)
    '.tx-bubble{position:absolute;left:50%;bottom:100%;margin-bottom:6px;transform:translate(-50%,4px) scale(.9);' +
      'z-index:5;max-width:190px;width:max-content;background:var(--panel,#fbf9f4);color:var(--ink,#18181b);' +
      'border:1px solid var(--line,#18181b);padding:6px 9px;font:500 12px/1.45 var(--mono,monospace);border-radius:3px;' +
      'text-align:center;pointer-events:none;opacity:0;transition:transform .18s ease,opacity .18s ease;}' +
    '.tx-bubble.tx-show{opacity:1;transform:translate(-50%,0) scale(1);}' +
    '.tx-bubble::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);' +
      'border:6px solid transparent;border-top-color:var(--line,#18181b);}' +
    // close button
    '.tx-close{position:absolute;top:-7px;right:-7px;z-index:6;width:20px;height:20px;padding:0;' +
      'background:var(--panel,#fbf9f4);color:var(--ink,#18181b);border:1px solid var(--line,#18181b);border-radius:50%;' +
      'font:600 13px/16px var(--mono,monospace);cursor:pointer;opacity:0;transition:opacity .15s;}' +
    '.tx-root:hover .tx-close,.tx-root.tx-drag .tx-close{opacity:1;}' +
    // bye animation handled in JS via scale; reduced-motion kills idle motion
    '@media (prefers-reduced-motion: reduce){.tx-root *{animation:none !important;}}';

  /* ---------- module state ---------- */
  var root = null, facing = null, svg = null, bubbleEl = null, signEl = null;
  var S = null;                 // live state object
  var raf = 0, last = 0;
  var dragging = false;
  var blinkTimer = 0, speakTimer = 0, signTimer = 0;
  var listeners = [];

  function injectStyles() {
    if (document.getElementById("tx-style")) return;
    var st = document.createElement("style");
    st.id = "tx-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function on(target, ev, fn, opts) {
    target.addEventListener(ev, fn, opts || false);
    listeners.push([target, ev, fn, opts || false]);
  }

  /* ---------- geometry helpers ---------- */
  function vw() { return window.innerWidth || document.documentElement.clientWidth; }
  function vh() { return window.innerHeight || document.documentElement.clientHeight; }
  function maxX() { return Math.max(0, vw() - W - 4); }
  function floorY() { return Math.max(0, vh() - H - 6); }

  /* ---------- eyes / mode ---------- */
  function setEyes(kind) {
    var g = svg && svg.querySelector(".tx-eyes");
    if (!g || g.dataset.kind === kind) return;
    g.dataset.kind = kind;
    g.innerHTML = EYES[kind] || EYES.happy;
  }

  function setMode(m) {
    if (!root || S.mode === m) return;
    S.mode = m;
    root.classList.remove("tx-walk", "tx-idle", "tx-look", "tx-panic");
    if (m === "walk") root.classList.add("tx-walk");
    else if (m === "look" || m === "idle" || m === "spawn") root.classList.add("tx-idle");
    else if (m === "drag" || m === "fall") root.classList.add("tx-panic");

    if (m === "drag" || m === "fall") setEyes("panic");
    else if (m === "look") setEyes("look");
    else if (m === "idle" && S._vibe) setEyes("vibe");
    else setEyes("happy");
  }

  /* ---------- speech + sign ---------- */
  function speak(txt, ms) {
    if (!bubbleEl) return;
    root.classList.remove("tx-signed");
    bubbleEl.textContent = txt;
    bubbleEl.classList.add("tx-show");
    clearTimeout(speakTimer);
    speakTimer = setTimeout(function () {
      if (bubbleEl) bubbleEl.classList.remove("tx-show");
    }, ms || 1900);
  }
  function showSign(ms) {
    if (!root) return;
    root.classList.add("tx-signed");
    clearTimeout(signTimer);
    if (ms) signTimer = setTimeout(function () { if (root) root.classList.remove("tx-signed"); }, ms);
  }

  /* ---------- behaviour ---------- */
  function pickWalk() {
    if (reduceMotion()) { setMode("idle"); S.until = Infinity; return; }
    var tx, tries = 0;
    do { tx = rand(4, maxX()); tries++; } while (Math.abs(tx - S.x) < 70 && tries < 8);
    S.targetX = tx;
    S._vibe = false;
    setMode("walk");
  }

  function maybeVibe() {
    S._vibe = Math.random() < 0.4;
    if (S.mode === "idle") setEyes(S._vibe ? "vibe" : "happy");
    if (S._vibe && Math.random() < 0.6) speak(pick(LINES_IDLE), 1500);
  }

  function faceAndTrack() {
    var inp = document.getElementById("cmd");
    if (!inp) return;
    var r = inp.getBoundingClientRect();
    var px = r.left + r.width * 0.12, py = r.top + r.height / 2;
    var cx = S.x + W / 2, cy = S.y + H * 0.30;
    var dx = px - cx, dy = py - cy;
    S.dir = dx >= 0 ? 1 : -1;
    var pupils = svg.querySelector(".tx-pupils");
    if (pupils) {
      var ox = clamp(dx / 55, -4, 4);
      if (S.dir < 0) ox = -ox;              // keep gaze on target after mirror
      var oy = clamp(dy / 70, -2.5, 3);
      pupils.style.transform = "translate(" + ox.toFixed(2) + "px," + oy.toFixed(2) + "px)";
    }
    S.y = floorY();
  }

  function land() {
    S.vy = 0;
    setMode("idle");
    S.until = nowT() + rand(500, 1200);
    if (Math.random() < 0.7) speak(pick(LINES_LAND), 1400);
  }

  /* ---------- main loop ---------- */
  function step(dt, t) {
    switch (S.mode) {
      case "spawn": {
        var p = clamp((t - S.spawnT0) / S.spawnDur, 0, 1);
        if (reduceMotion()) p = 1;
        var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
        S.x = S.spawnFromX + (S.spawnToX - S.spawnFromX) * e;
        var groundY = S.spawnFromY + (floorY() - S.spawnFromY) * e;
        S.y = groundY - Math.sin(Math.PI * p) * 92;
        S.spawnScale = 0.3 + 0.7 * e;
        S.dir = S.spawnToX >= S.spawnFromX ? 1 : -1;
        if (p >= 1) { S.spawnScale = 1; S.y = floorY(); setMode("idle"); S.until = t + 600; }
        break;
      }
      case "walk": {
        var d = S.targetX - S.x;
        S.dir = d >= 0 ? 1 : -1;
        S.x += S.dir * SPEED * dt;
        S.y = floorY();
        if (Math.abs(S.targetX - S.x) <= 2 || S.x <= 2 || S.x >= maxX()) {
          S.x = clamp(S.x, 2, maxX());
          setMode("idle");
          S.until = t + rand(600, 2400);
          maybeVibe();
        }
        break;
      }
      case "idle": {
        S.y = floorY();
        if (t > S.until) pickWalk();
        break;
      }
      case "look": {
        faceAndTrack();
        if (t > S.lookUntil) { setMode("idle"); S.until = t + 400; }
        break;
      }
      case "drag": {
        // position is driven by pointer move; nothing to integrate
        break;
      }
      case "fall": {
        S.vy += GRAVITY * dt;
        S.y += S.vy * dt;
        var fy = floorY();
        if (S.y >= fy) {
          S.y = fy;
          if (S.vy > 250) S.vy = -S.vy * 0.42; // bounce
          else land();
        }
        break;
      }
      case "bye": {
        var bp = clamp((t - S.byeT0) / 320, 0, 1);
        S.spawnScale = 1 - bp;
        S.y += 30 * dt;
        if (bp >= 1) { destroy(); return; }
        break;
      }
    }
  }

  function draw() {
    if (!root) return;
    root.style.transform = "translate3d(" + Math.round(S.x) + "px," + Math.round(S.y) + "px,0)";
    facing.style.transform = "scaleX(" + S.dir + ") scale(" + (S.spawnScale || 1) + ")";
  }

  function tick(t) {
    if (!root) return;
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    step(dt, t);
    if (!root) return; // step() may have torn us down (bye → destroy)
    draw();
    raf = requestAnimationFrame(tick);
  }

  /* ---------- input handlers ---------- */
  function onType() {
    if (!root) return;
    var m = S.mode;
    if (m === "drag" || m === "fall" || m === "bye" || m === "spawn") return;
    S.lookUntil = nowT() + 1500;
    if (m !== "look") setMode("look");
  }

  function onDown(e) {
    if (!root || (e.target && e.target.closest && e.target.closest(".tx-close"))) return;
    e.preventDefault();
    dragging = true;
    try { root.setPointerCapture(e.pointerId); } catch (err) {}
    var r = root.getBoundingClientRect();
    S.grabDX = e.clientX - r.left;
    S.grabDY = e.clientY - r.top;
    S.vx = S.vy = 0;
    setMode("drag");
    root.classList.add("tx-drag");
    showSign(0);
    speak(pick(LINES_PANIC), 1300);
  }
  function onMove(e) {
    if (!dragging || !root) return;
    S.x = clamp(e.clientX - S.grabDX, -W * 0.25, vw() - W * 0.75);
    S.y = clamp(e.clientY - S.grabDY, -H * 0.1, vh() - H * 0.25);
  }
  function onUp() {
    if (!dragging || !root) return;
    dragging = false;
    root.classList.remove("tx-drag", "tx-signed");
    S.vy = 0;
    setMode("fall");
  }
  function onResize() {
    if (!root) return;
    if (S.mode !== "drag") S.y = floorY();
    S.x = clamp(S.x, 2, maxX());
  }
  function onKeyDoc(e) {
    if (e.key === "Escape" && root && S.mode !== "bye") dismiss();
  }

  function scheduleBlink() {
    blinkTimer = setTimeout(function () {
      if (!root) return;
      if (S.mode !== "drag" && S.mode !== "fall") {
        root.classList.add("tx-blink");
        setTimeout(function () { if (root) root.classList.remove("tx-blink"); }, 260);
      }
      scheduleBlink();
    }, rand(2600, 5200));
  }

  /* ---------- lifecycle ---------- */
  function summon() {
    if (root) return;
    injectStyles();

    var small = Math.min(vw(), vh()) < 620;
    var sc = small ? 0.74 : 1;
    W = Math.round(BASE_W * sc);
    H = Math.round(BASE_H * sc);

    root = document.createElement("div");
    root.className = "tx-root tx-idle";
    root.setAttribute("aria-label", "DJ TRAXX mascot");
    root.style.width = W + "px";
    root.style.height = H + "px";
    root.innerHTML =
      '<button class="tx-close" type="button" title="say bye" aria-label="Dismiss DJ TRAXX">\u00d7</button>' +
      '<div class="tx-sign">DJ\u00a0TRAXX</div>' +
      '<div class="tx-bubble"></div>' +
      '<div class="tx-facing"><div class="tx-bob">' + SVG_MARKUP + "</div></div>" +
      '<div class="tx-shadow"></div>';
    document.body.appendChild(root);

    facing = root.querySelector(".tx-facing");
    svg = root.querySelector(".tx-svg");
    bubbleEl = root.querySelector(".tx-bubble");
    signEl = root.querySelector(".tx-sign");
    setEyes("happy");

    // spawn point: center of the terminal → arc out to a random floor spot
    var term = document.getElementById("terminal");
    var tr = term ? term.getBoundingClientRect() : { left: vw() / 2, top: vh() / 2, width: 0, height: 0 };
    S = {
      x: 0, y: 0, vx: 0, vy: 0, dir: 1, spawnScale: 0.3,
      mode: null, targetX: 0, until: 0, lookUntil: 0,
      grabDX: 0, grabDY: 0, _vibe: false,
      spawnFromX: clamp(tr.left + tr.width / 2 - W / 2, 0, maxX()),
      spawnFromY: clamp(tr.top + tr.height / 2 - H / 2, 0, floorY()),
      spawnToX: clamp(rand(20, Math.max(24, maxX() - 20)), 4, maxX()),
      spawnT0: nowT(), spawnDur: 820, byeT0: 0,
    };
    S.x = S.spawnFromX; S.y = S.spawnFromY;
    setMode("spawn");
    showSign(2600);

    // wiring
    on(root, "pointerdown", onDown);
    on(root.querySelector(".tx-close"), "click", function (e) { e.preventDefault(); dismiss(); });
    on(window, "pointermove", onMove);
    on(window, "pointerup", onUp);
    on(window, "pointercancel", onUp);
    on(window, "resize", onResize);
    on(document, "keydown", onKeyDoc);
    var inp = document.getElementById("cmd");
    if (inp) { on(inp, "input", onType); on(inp, "keydown", onType); on(inp, "focus", onType); }

    last = 0;
    raf = requestAnimationFrame(tick);
    scheduleBlink();
    setTimeout(function () { if (root) speak(pick(LINES_HELLO), 2600); }, 1500);
    say("DJ TRAXX online \u2014 he\u2019s roaming your screen. drag him around, or type \u201Ctraxx\u201D to hide him.");
  }

  function destroy() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; last = 0;
    clearTimeout(blinkTimer); clearTimeout(speakTimer); clearTimeout(signTimer);
    for (var i = 0; i < listeners.length; i++) {
      listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2], listeners[i][3]);
    }
    listeners = [];
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = facing = svg = bubbleEl = signEl = null;
    S = null; dragging = false;
  }

  function dismiss() {
    if (!root || (S && S.mode === "bye")) return;
    dragging = false;
    setEyes("panic");
    root.classList.remove("tx-walk", "tx-idle", "tx-look", "tx-drag");
    S.mode = "bye";
    S.byeT0 = nowT();
    say("DJ TRAXX out. (type \u201Ctraxx\u201D to summon him again)");
  }

  function toggle(args) {
    var w = ((args && args[0]) || "").toLowerCase();
    var bye = ["bye", "go", "out", "exit", "quit", "leave", "stop", "sleep", "off"].indexOf(w) !== -1;
    if (root) { dismiss(); return; }
    if (bye) { say("traxx isn\u2019t here. type \u201Ctraxx\u201D to summon him."); return; }
    summon();
  }

  window.Traxx = { summon: summon, dismiss: dismiss, toggle: toggle };
})();
