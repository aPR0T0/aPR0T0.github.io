// traxx.js — a tiny interactive on-page mascot engine.
//
// The ENGINE only; it knows nothing about a specific character. Characters come
// in two flavours, both registered via window.Traxx.define(...):
//
//   • "svg"    — a folder of .svg frames (characters/<id>/idle.svg, ...). Great
//                for hand-drawn mascots (traxx, angry-dario). Works file:// + http.
//   • "sprite" — one PetDex spritesheet (8×9 grid of 192×208 frames) where each
//                row is an animation state. Used by petdex.js to render any of the
//                thousands of community pets by name.
//
// A character pops out of the terminal, roams the screen, turns to face the
// prompt while you type, and panics when picked up and dragged. Pets can also be
// seated on the page's buttons (see seatsOn).
//
// Classic script (no ES modules). Public API:
//   window.Traxx = { define, summon, dismiss, toggle, route, routeName, has, ids,
//                    current, setResolver, setProvider, seats, seatsOff, playState }
//
// Terminal integration lives in app.js runCommand().

(function () {
  "use strict";

  /* ---------- tiny helpers ---------- */
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var pick = function (a) { return a && a.length ? a[(Math.random() * a.length) | 0] : ""; };
  var nowT = function () { return performance.now(); };
  var reduceMotion = function () {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };
  var say = function (text, cls) {
    try { if (typeof emit === "function" && typeof line === "function") emit(line(text, cls || "muted")); }
    catch (e) {}
  };

  /* ---------- registry + config normalization ---------- */
  var registry = {};                 // id -> normalized config
  var injectedCss = {};              // per-character css injected once

  var FALLBACK = {
    idle:  ["idle"], walk: ["walk", "idle"], look: ["look", "idle"],
    panic: ["panic", "idle"], fall: ["fall", "panic", "idle"], land: ["land", "idle"],
    emote: ["emote", "idle"], spawn: ["spawn", "idle"], bye: ["bye", "idle"],
  };
  var DEFAULT_ANIM = {
    idle: "bob-slow", walk: "bob", look: "bob-slow", panic: "shake",
    fall: "shake", land: "none", emote: "bob", spawn: "none", bye: "none",
  };
  // engine mode/state key -> PetDex sprite row id (walk is resolved by direction)
  var SPRITE_KEY = {
    idle: "idle", look: "review", panic: "failed", fall: "failed",
    land: "idle", emote: "waving", spawn: "jumping", bye: "jumping",
  };
  var SPRITE_STATE_IDS = ["idle", "running-right", "running-left", "waving", "jumping", "failed", "waiting", "running", "review"];
  var DISMISS_WORDS = ["bye", "go", "out", "exit", "quit", "stop", "off", "hide", "sleep", "away"];

  function normalize(cfg) {
    if (!cfg || !cfg.id) throw new Error("Traxx.define: config needs an id");
    var c = {};
    c.id = String(cfg.id).toLowerCase();
    c.name = cfg.name || c.id;
    c.path = cfg.path || ("characters/" + c.id + "/");
    if (c.path.charAt(c.path.length - 1) !== "/") c.path += "/";
    c.speed = cfg.speed || 64;
    c.sign = cfg.sign || null;
    c.speech = cfg.speech || {};
    c.css = cfg.css || "";
    c.kind = cfg.kind === "sprite" ? "sprite" : "svg";
    c.submittedBy = cfg.submittedBy || "";

    // Sprite characters (PetDex): one spritesheet, each state = a row.
    if (c.kind === "sprite") {
      var sp = cfg.sprite || {};
      c.sprite = {
        url: sp.url || "",
        sheetW: sp.sheetW || 1536, sheetH: sp.sheetH || 1872,
        fw: sp.fw || 192, fh: sp.fh || 208,
        rows: sp.rows || {},
      };
      c.flip = false;                        // directional rows, no mirroring
      c.aspect = c.sprite.fw / c.sprite.fh;
      c.height = cfg.height || 128;
      c.spawnDur = cfg.spawnDur || 380;      // pop up nearly instantly
      c._states = null; c._frameNames = [];
      return c;
    }

    // SVG characters: frames on disk, states map to frame(s) + a motion anim.
    c.height = cfg.height || 140;
    c.aspect = cfg.aspect || 0.8;
    c.flip = cfg.flip !== false;
    c.spawnDur = cfg.spawnDur || 820;
    var states = cfg.states || {};
    if (!states.idle) states.idle = { frames: "idle" };
    var norm = {}, names = {};
    Object.keys(FALLBACK).forEach(function (key) {
      var def = null, chain = FALLBACK[key];
      for (var i = 0; i < chain.length; i++) { if (states[chain[i]]) { def = states[chain[i]]; break; } }
      if (!def) def = states.idle;
      var fr = def.frames || "idle";
      if (typeof fr === "string") fr = [fr];
      fr.forEach(function (n) { names[n] = 1; });
      norm[key] = {
        frames: fr, fps: def.fps != null ? def.fps : (fr.length > 1 ? 6 : 0),
        anim: def.anim != null ? def.anim : DEFAULT_ANIM[key], lean: !!def.lean,
      };
    });
    c._states = norm;
    c._frameNames = Object.keys(names);
    return c;
  }

  function define(cfg) {
    try { var c = normalize(cfg); registry[c.id] = c; return c.id; }
    catch (e) { say("traxx: bad character config (" + (cfg && cfg.id) + ")", "err"); return null; }
  }

  /* ---------- engine CSS (once) ---------- */
  var ENGINE_CSS =
    '.tx-root{position:fixed;left:0;top:0;z-index:2147483000;will-change:transform;' +
      'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none;cursor:grab;}' +
    '.tx-root.tx-drag{cursor:grabbing;}' +
    '.tx-facing{position:absolute;inset:0;transform-origin:center bottom;}' +
    '.tx-motion{position:absolute;inset:0;}' +
    '.tx-frames{position:absolute;inset:0;}' +
    '.tx-frame{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;' +
      'transition:opacity .09s linear;pointer-events:none;filter:drop-shadow(0 3px 2px rgba(0,0,0,.28));}' +
    '.tx-frame.tx-on{opacity:1;}' +
    '.tx-shadow{position:absolute;left:50%;bottom:2px;width:58%;height:9px;transform:translateX(-50%);' +
      'background:rgba(0,0,0,.30);border-radius:50%;filter:blur(2px);z-index:0;}' +
    // svg motion animations (states reference these by name -> tx-anim-<name>)
    '@keyframes tx-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}' +
    '.tx-anim-bob-slow{animation:tx-bob 1.9s ease-in-out infinite;}' +
    '.tx-anim-bob{animation:tx-bob .5s ease-in-out infinite;}' +
    '@keyframes tx-shake{0%{transform:translate(-2px,0) rotate(-4deg)}25%{transform:translate(2px,-1px) rotate(4deg)}' +
      '50%{transform:translate(-2px,1px) rotate(-3deg)}75%{transform:translate(2px,0) rotate(3deg)}100%{transform:translate(-2px,0) rotate(-4deg)}}' +
    '.tx-anim-shake{animation:tx-shake .16s linear infinite;}' +
    // spritesheet renderer: one image, a row = a state, steps() walks the frames
    '.tx-spritewrap{position:absolute;inset:0;overflow:hidden;}' +
    '.tx-sprite{position:absolute;inset:0;image-rendering:pixelated;background-repeat:no-repeat;' +
      'background-image:var(--sprite-url);background-size:var(--sbw) var(--sbh);' +
      'background-position-x:0;background-position-y:calc(var(--row,0) * -1 * var(--fhk));' +
      'animation:tx-sprite-play var(--dur,1000ms) steps(var(--frames,6)) infinite;}' +
    '@keyframes tx-sprite-play{from{background-position-x:0}to{background-position-x:calc(var(--frames,6) * -1 * var(--fwk))}}' +
    '.tx-sprite.tx-static{animation:none;background-position-x:0;}' +
    // placeholder shown if a sprite sheet fails to load (offline / blocked)
    '.tx-ini{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
      'font-family:var(--mono,monospace);font-weight:700;color:#111;line-height:1;}' +
    '.tx-root.tx-noart .tx-sprite{display:none;}' +
    '.tx-root.tx-noart .tx-spritewrap{background:var(--tx-accent,#9aa);border:2px solid rgba(0,0,0,.4);border-radius:16px;}' +
    '.tx-root.tx-noart .tx-ini{display:flex;}' +
    // LED name sign
    '.tx-sign{position:absolute;left:50%;top:-12px;transform:translate(-50%,-100%) scale(0);z-index:4;' +
      'transform-origin:center bottom;font-family:var(--mono,monospace);font-weight:600;font-size:13px;letter-spacing:2px;' +
      'padding:5px 9px;border-radius:3px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.4);max-width:220px;overflow:hidden;text-overflow:ellipsis;' +
      'transition:transform .35s cubic-bezier(.2,1.5,.4,1);pointer-events:none;}' +
    '.tx-sign::after{content:"";position:absolute;inset:0;border-radius:2px;pointer-events:none;' +
      'background-image:radial-gradient(rgba(0,0,0,.32) 1px,transparent 1.4px);background-size:3px 3px;}' +
    '.tx-root.tx-signed .tx-sign{transform:translate(-50%,-100%) scale(1);}' +
    '@keyframes tx-flash{0%,100%{opacity:1}50%{opacity:.25}}' +
    '.tx-root.tx-panic.tx-signed .tx-sign{animation:tx-flash .2s steps(1) infinite;}' +
    // speech bubble
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
    // button seats
    '.tx-seat{position:fixed;z-index:2147482000;pointer-events:none;will-change:transform;' +
      'filter:drop-shadow(0 2px 1px rgba(0,0,0,.30));}' +
    '.tx-seathop{position:absolute;inset:0;}' +
    '.tx-seatimg{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;}' +
    '@keyframes tx-seatfall{0%{transform:translateY(-72px) rotate(-8deg);opacity:0}12%{opacity:1}' +
      '55%{transform:translateY(0) rotate(0)}70%{transform:translateY(-13px)}82%{transform:translateY(0)}' +
      '90%{transform:translateY(-5px)}100%{transform:translateY(0)}}' +
    '.tx-seathop.tx-fall{animation:tx-seatfall .9s cubic-bezier(.3,.7,.4,1);}' +
    '.tx-seat-bubble{position:absolute;left:50%;bottom:100%;margin-bottom:3px;transform:translate(-50%,4px) scale(.9);' +
      'z-index:2;background:var(--panel,#fbf9f4);color:var(--ink,#18181b);border:1px solid var(--line,#18181b);' +
      'padding:2px 6px;font:600 10px/1.3 var(--mono,monospace);border-radius:3px;white-space:nowrap;max-width:170px;' +
      'overflow:hidden;text-overflow:ellipsis;pointer-events:none;opacity:0;transition:opacity .16s ease,transform .16s ease;}' +
    '.tx-seat-bubble.tx-show{opacity:1;transform:translate(-50%,0) scale(1);}' +
    '@media (prefers-reduced-motion: reduce){.tx-root .tx-motion{animation:none !important;}' +
      '.tx-sprite{animation:none !important;background-position-x:0 !important;}' +
      '.tx-seathop.tx-fall{animation:none !important;}}';

  function injectEngineCss() {
    if (document.getElementById("tx-style")) return;
    var st = document.createElement("style");
    st.id = "tx-style"; st.textContent = ENGINE_CSS;
    document.head.appendChild(st);
  }
  function injectCharCss(c) {
    if (!c || !c.css || injectedCss[c.id]) return;
    var st = document.createElement("style");
    st.id = "tx-style-" + c.id; st.textContent = c.css;
    document.head.appendChild(st);
    injectedCss[c.id] = true;
  }

  /* ---------- live instance state ---------- */
  var cfg = null;
  var root = null, facing = null, motion = null, framesWrap = null, bubbleEl = null, spriteEl = null;
  var frameEls = {};
  var S = null;
  var raf = 0, last = 0, dragging = false;
  var speakTimer = 0, signTimer = 0;
  var listeners = [];
  // pluggable PetDex hooks
  var resolver = null;               // fn(name) -> Promise<config|null>
  var provider = null;               // { list, random, find }
  var resolving = false;
  // seats
  var seatEls = [], seatCfg = null, seatBound = [], seatLoop = 0;

  function on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts || false); listeners.push([target, ev, fn, opts || false]); }
  function vw() { return window.innerWidth || document.documentElement.clientWidth; }
  function vh() { return window.innerHeight || document.documentElement.clientHeight; }
  var W = 112, H = 140;
  function maxX() { return Math.max(0, vw() - W - 4); }
  function floorY() { return Math.max(0, vh() - H - 6); }

  /* ---------- rendering: svg frames + sprite rows ---------- */
  function showImg(img) {
    if (!img || S._cur === img) return;
    if (S._cur) S._cur.classList.remove("tx-on");
    img.classList.add("tx-on"); S._cur = img;
  }
  function setMotion(anim) { motion.className = "tx-motion" + (anim && anim !== "none" ? " tx-anim-" + anim : ""); }

  // k = display px per sprite px, derived from HEIGHT so each row lands exactly.
  function applySpriteSizing(el, c, k) {
    el.style.setProperty("--sprite-url", 'url("' + String(c.sprite.url).replace(/"/g, '\\"') + '")');
    el.style.setProperty("--sbw", (c.sprite.sheetW * k) + "px");
    el.style.setProperty("--sbh", (c.sprite.sheetH * k) + "px");
    el.style.setProperty("--fwk", (c.sprite.fw * k) + "px");
    el.style.setProperty("--fhk", (c.sprite.fh * k) + "px");
  }
  function setSpriteRow(el, c, sid) {
    var rows = c.sprite.rows;
    if (!rows[sid]) sid = rows.idle ? "idle" : Object.keys(rows)[0];
    var r = rows[sid] || { row: 0, frames: 6, duration: 1000 };
    if (!el) return sid;
    el.style.setProperty("--row", r.row);
    el.style.setProperty("--frames", r.frames);
    el.style.setProperty("--dur", (r.duration || 1000) + "ms");
    el.classList.toggle("tx-static", reduceMotion());
    return sid;
  }
  function applyStateSprite(key) {
    setMotion("none");
    var sid = key === "walk" ? (S.dir < 0 ? "running-left" : "running-right") : (SPRITE_KEY[key] || "idle");
    S._sid = setSpriteRow(spriteEl, cfg, sid);
  }
  function applyState(key) {
    if (cfg.kind === "sprite") return applyStateSprite(key);
    var st = cfg._states[key] || cfg._states.idle;
    setMotion(st.anim);
    S.cycle = st.frames.map(function (n) { return frameEls[n] || frameEls[cfg._frameNames[0]]; });
    S.fps = st.fps; S.frameIdx = 0; S.frameAcc = 0; S._leanState = st.lean;
    showImg(S.cycle[0]);
  }
  function stateKeyFor(mode) {
    if (mode === "drag") return "panic";
    if (mode === "fall") return "fall";
    if (mode === "look") return "look";
    if (mode === "spawn") return "spawn";
    if (mode === "bye") return "bye";
    if (mode === "walk") return "walk";
    return S._emote ? "emote" : "idle";
  }
  function setMode(m) {
    if (!root || S.mode === m) return;
    S.mode = m;
    root.classList.toggle("tx-panic", m === "drag" || m === "fall");
    if (m !== "look") S.lean = 0;
    applyState(stateKeyFor(m));
  }

  /* ---------- speech + sign ---------- */
  function speak(txt, ms) {
    if (!bubbleEl || !txt) return;
    root.classList.remove("tx-signed");
    bubbleEl.textContent = txt; bubbleEl.classList.add("tx-show");
    clearTimeout(speakTimer);
    speakTimer = setTimeout(function () { if (bubbleEl) bubbleEl.classList.remove("tx-show"); }, ms || 1900);
  }
  function speakFrom(event, ms) { speak(pick(cfg.speech[event] || []), ms); }
  function showSign(ms) {
    if (!root || !cfg.sign) return;
    root.classList.add("tx-signed");
    clearTimeout(signTimer);
    if (ms) signTimer = setTimeout(function () { if (root) root.classList.remove("tx-signed"); }, ms);
  }

  /* ---------- behaviour ---------- */
  function pickWalk() {
    if (reduceMotion()) { setMode("idle"); S.until = Infinity; return; }
    S.btn = null;
    var tx, tries = 0;
    do { tx = rand(4, maxX()); tries++; } while (Math.abs(tx - S.x) < 70 && tries < 8);
    S.targetX = tx; S.dir = tx >= S.x ? 1 : -1; S._emote = false;
    setMode("walk");
  }
  function enterIdle(t, minMs, maxMs) {
    S._emote = Math.random() < 0.4;
    S.btn = null;
    setMode("idle");
    S.until = t + rand(minMs, maxMs);
    if (S._emote) speakFrom("idle", 1600);
  }
  function faceAndTrack() {
    var inp = document.getElementById("cmd");
    if (!inp) return;
    var r = inp.getBoundingClientRect();
    var px = r.left + r.width * 0.12;
    var cx = S.x + W / 2, dx = px - cx;
    S.dir = dx >= 0 ? 1 : -1;
    S.lean = (cfg._states && cfg._states.look && cfg._states.look.lean) ? clamp(dx / 34, -6, 6) : 0;
    if (cfg.kind === "sprite") setSpriteRow(spriteEl, cfg, "review"); // stay "reviewing" while you type
    S.y = floorY();
  }
  function land() {
    S.vy = 0; S.btn = null; setMode("idle"); S.until = nowT() + rand(500, 1200);
    if (Math.random() < 0.7) speakFrom("land", 1400);
  }

  /* ---------- button visits: the roaming pet hops onto buttons ---------- */
  function visibleButtons() {
    var out = [], nodes = document.querySelectorAll(SEAT_SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.width > 4 && r.height > 4 && r.top >= 0 && r.bottom <= vh() && r.left >= 0 && r.right <= vw()) out.push(nodes[i]);
    }
    return out;
  }
  function pickButton() { var b = visibleButtons(); return b.length ? b[(Math.random() * b.length) | 0] : null; }
  function btnPerch(r) {
    return {
      x: clamp(r.left + r.width / 2 - W / 2, 2, maxX()),
      y: clamp(r.top - H + 6, 2, floorY()), // sit ON TOP: feet on the button's top edge, body above the label
    };
  }
  function pickButtonExcept(cur) { var b = visibleButtons().filter(function (x) { return x !== cur; }); return b.length ? b[(Math.random() * b.length) | 0] : null; }
  // which visible button (if any) the pet is currently over — used for drag-drop
  function buttonUnderPet() {
    var cx = S.x + W / 2, by = S.y + H * 0.72;
    var nodes = document.querySelectorAll(SEAT_SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.width > 4 && cx >= r.left - 12 && cx <= r.right + 12 && by >= r.top - 34 && by <= r.bottom + 22) return nodes[i];
    }
    return null;
  }
  function sitOn(b) {
    S.btn = b;
    var p = btnPerch(b.getBoundingClientRect());
    S.x = p.x; S.y = p.y; S.vy = 0;
    S.mode = "onBtn"; onBtnEnter(nowT(), true); // sticky: stay put where you dropped it
  }
  // visual per kind: sprite pets use rows, hand-drawn pets fall back to a state
  function act(sid, svgKey) {
    if (cfg.kind === "sprite") { setMotion("none"); setSpriteRow(spriteEl, cfg, sid); }
    else applyState(svgKey);
  }
  function nextRoam() {
    if (reduceMotion()) { setMode("idle"); S.until = Infinity; return; }
    S.btn = null;
    if (Math.random() < 0.55) { var b = pickButton(); if (b) { startToBtn(b); return; } }
    pickWalk();
  }
  function startToBtn(b) {
    S.btn = b;
    var r = b.getBoundingClientRect();
    S.targetX = clamp(r.left + r.width / 2 - W / 2, 2, maxX());
    S.dir = S.targetX >= S.x ? 1 : -1;
    S._emote = false;
    setMode("walk"); // walk animation; the walk case climbs on arrival because S.btn is set
  }
  // hop from wherever we are (floor or another button) onto button b
  function beginHop(t, b) {
    if (!b || !b.isConnected) { S.btn = null; enterIdle(t, 500, 1200); return; }
    S.btn = b;
    S.hopFromX = S.x; S.hopFromY = S.y;
    S.hopT0 = t; S.hopDur = 540;
    S.mode = "hopBtn";
    act("jumping", "emote");
  }
  function onBtnEnter(t, sticky) {
    S.until = t + (sticky ? rand(6000, 12000) : rand(2600, 4600));
    act("waving", "emote");
    speak(quipFor(S.btn), 2600);
    clearTimeout(S._sitT);
    S._sitT = setTimeout(function () { if (root && S && S.mode === "onBtn") act("review", "idle"); }, 1000);
  }

  /* ---------- main loop ---------- */
  function step(dt, t) {
    switch (S.mode) {
      case "spawn": {
        var p = clamp((t - S.spawnT0) / S.spawnDur, 0, 1);
        if (reduceMotion()) p = 1;
        var e = 1 - Math.pow(1 - p, 3);
        S.x = S.spawnFromX + (S.spawnToX - S.spawnFromX) * e;
        var groundY = S.spawnFromY + (floorY() - S.spawnFromY) * e;
        S.y = groundY - Math.sin(Math.PI * p) * 92;
        S.spawnScale = 0.3 + 0.7 * e;
        S.dir = S.spawnToX >= S.spawnFromX ? 1 : -1;
        if (p >= 1) { S.spawnScale = 1; S.y = floorY(); enterIdle(t, 400, 900); }
        break;
      }
      case "walk": {
        if (S.btn) { // heading to a button: track it (it may move) or abort if gone
          if (!S.btn.isConnected) { S.btn = null; enterIdle(t, 400, 900); break; }
          var br = S.btn.getBoundingClientRect();
          if (br.width < 4) { S.btn = null; enterIdle(t, 400, 900); break; }
          S.targetX = clamp(br.left + br.width / 2 - W / 2, 2, maxX());
        }
        var d = S.targetX - S.x;
        var nd = d >= 0 ? 1 : -1;
        if (nd !== S.dir) { S.dir = nd; if (cfg.kind === "sprite") applyState("walk"); }
        S.x += S.dir * cfg.speed * dt; S.y = floorY();
        if (Math.abs(S.targetX - S.x) <= 3 || S.x <= 2 || S.x >= maxX()) {
          S.x = clamp(S.x, 2, maxX());
          if (S.btn) beginHop(t, S.btn); else enterIdle(t, 600, 2400);
        }
        break;
      }
      case "hopBtn": {
        if (!S.btn || !S.btn.isConnected) { S.btn = null; setMode("fall"); break; }
        var hr = S.btn.getBoundingClientRect();
        if (hr.width < 4) { S.btn = null; setMode("fall"); break; }
        var perch = btnPerch(hr);
        var hp = clamp((t - S.hopT0) / S.hopDur, 0, 1);
        S.x = S.hopFromX + (perch.x - S.hopFromX) * hp;
        S.y = (S.hopFromY + (perch.y - S.hopFromY) * hp) - Math.sin(Math.PI * hp) * 70;
        S.dir = perch.x >= S.hopFromX ? 1 : -1;
        if (hp >= 1) { S.x = perch.x; S.y = perch.y; S.mode = "onBtn"; onBtnEnter(t); }
        break;
      }
      case "onBtn": {
        if (!S.btn || !S.btn.isConnected) { S.btn = null; setMode("fall"); break; }
        var or = S.btn.getBoundingClientRect();
        if (or.width < 4 || or.bottom < 0 || or.top > vh()) { S.btn = null; setMode("fall"); break; }
        var op = btnPerch(or);
        S.x = op.x; S.y = op.y;               // ride the button (scroll/resize safe)
        if (t > S.until) {
          var nb = Math.random() < 0.6 ? pickButtonExcept(S.btn) : null;
          if (nb) { beginHop(t, nb); }        // hop to another button
          else { S.vy = -140; S.dir = Math.random() < 0.5 ? 1 : -1; S.mode = "offBtn"; act("jumping", "panic"); } // hop down
        }
        break;
      }
      case "offBtn": {
        S.vy += 2600 * dt; S.y += S.vy * dt; S.x = clamp(S.x + S.dir * 50 * dt, 2, maxX());
        if (S.y >= floorY()) { S.y = floorY(); S.btn = null; land(); }
        break;
      }
      case "idle": {
        S.y = floorY();
        if (t > S.until && !(S.holdUntil && t < S.holdUntil)) nextRoam();
        break;
      }
      case "look": {
        faceAndTrack();
        if (t > S.lookUntil) enterIdle(t, 300, 700);
        break;
      }
      case "drag": break;
      case "fall": {
        S.vy += 2600 * dt; S.y += S.vy * dt;
        var fy = floorY();
        if (S.y >= fy) { S.y = fy; if (S.vy > 250) S.vy = -S.vy * 0.42; else land(); }
        break;
      }
      case "bye": {
        var bp = clamp((t - S.byeT0) / 320, 0, 1);
        S.spawnScale = 1 - bp; S.y += 30 * dt;
        if (bp >= 1) { destroy(); return; }
        break;
      }
    }
    // advance svg frame cycle (sprite pets animate purely in CSS)
    if (cfg.kind !== "sprite" && S.cycle && S.cycle.length > 1 && S.fps > 0) {
      S.frameAcc += dt;
      var spf = 1 / S.fps;
      while (S.frameAcc >= spf) {
        S.frameAcc -= spf; S.frameIdx = (S.frameIdx + 1) % S.cycle.length;
        showImg(S.cycle[S.frameIdx]);
      }
    }
  }

  function draw() {
    if (!root) return;
    root.style.transform = "translate3d(" + Math.round(S.x) + "px," + Math.round(S.y) + "px,0)";
    var lean = (S.lean || 0) * S.dir;
    facing.style.transform =
      "scaleX(" + (cfg.flip ? S.dir : 1) + ") scale(" + (S.spawnScale || 1) + ") rotate(" + lean.toFixed(1) + "deg)";
  }
  function tick(t) {
    if (!root) return;
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t; step(dt, t);
    if (!root) return;
    draw(); raf = requestAnimationFrame(tick);
  }

  /* ---------- input ---------- */
  function onType() {
    if (!root) return;
    var m = S.mode;
    if (m === "drag" || m === "fall" || m === "bye" || m === "spawn" || m === "hopBtn" || m === "onBtn" || m === "offBtn") return;
    S.btn = null;                       // stop heading to a button; pay attention to you
    S.lookUntil = nowT() + 1500;
    if (m !== "look") setMode("look");
  }
  function onDown(e) {
    if (!root || (e.target && e.target.closest && e.target.closest(".tx-close"))) return;
    e.preventDefault(); dragging = true;
    S.btn = null; clearTimeout(S._sitT);
    try { root.setPointerCapture(e.pointerId); } catch (err) {}
    var r = root.getBoundingClientRect();
    S.grabDX = e.clientX - r.left; S.grabDY = e.clientY - r.top; S.vx = S.vy = 0;
    root.classList.add("tx-drag"); setMode("drag"); showSign(0); speakFrom("panic", 1300);
  }
  function onMove(e) {
    if (!dragging || !root) return;
    S.x = clamp(e.clientX - S.grabDX, -W * 0.25, vw() - W * 0.75);
    S.y = clamp(e.clientY - S.grabDY, -H * 0.1, vh() - H * 0.25);
  }
  function onUp() {
    if (!dragging || !root) return;
    dragging = false; root.classList.remove("tx-drag", "tx-signed"); S.vy = 0;
    var b = buttonUnderPet();               // dropped onto a button? sit there
    if (b) { root.classList.remove("tx-panic"); sitOn(b); }
    else setMode("fall");                   // otherwise fall to the floor
  }
  function onResize() { if (!root) return; if (S.mode !== "drag") S.y = floorY(); S.x = clamp(S.x, 2, maxX()); }
  function onKeyDoc(e) { if (e.key === "Escape" && root && S.mode !== "bye") dismiss(); }

  /* ---------- lifecycle ---------- */
  function buildDOM() {
    root = document.createElement("div");
    root.className = "tx-root";
    root.setAttribute("data-char", cfg.id);
    root.setAttribute("aria-label", cfg.name + " mascot");
    root.style.width = W + "px"; root.style.height = H + "px";

    var signHtml = "";
    if (cfg.sign) {
      var bg = cfg.sign.bg || "#111", fg = cfg.sign.fg || "#f5c518";
      signHtml = '<div class="tx-sign" style="background:' + bg + ';color:' + fg +
        ';border:2px solid ' + fg + ';text-shadow:0 0 5px ' + fg + '">' +
        String(cfg.name || cfg.id).replace(/ /g, "\u00a0") + "</div>";
    }
    var inner;
    if (cfg.kind === "sprite") {
      inner = '<div class="tx-spritewrap"><div class="tx-sprite"></div><div class="tx-ini"></div></div>';
    } else {
      var imgs = cfg._frameNames.map(function (n) {
        return '<img class="tx-frame" data-name="' + n + '" alt="" draggable="false" src="' + cfg.path + n + '.svg">';
      }).join("");
      inner = '<div class="tx-frames">' + imgs + "</div>";
    }

    root.innerHTML =
      '<button class="tx-close" type="button" title="say bye" aria-label="Dismiss ' + cfg.name + '">\u00d7</button>' +
      signHtml + '<div class="tx-bubble"></div>' +
      '<div class="tx-facing"><div class="tx-motion">' + inner + "</div></div>" +
      '<div class="tx-shadow"></div>';
    document.body.appendChild(root);

    facing = root.querySelector(".tx-facing");
    motion = root.querySelector(".tx-motion");
    bubbleEl = root.querySelector(".tx-bubble");
    if (cfg.kind === "sprite") {
      spriteEl = root.querySelector(".tx-sprite");
      applySpriteSizing(spriteEl, cfg, H / cfg.sprite.fh);
      var wrap = root.querySelector(".tx-spritewrap");
      wrap.style.setProperty("--tx-accent", (cfg.sign && cfg.sign.fg) || "#9aa");
      var ini = root.querySelector(".tx-ini");
      ini.textContent = String(cfg.name || cfg.id).trim().charAt(0).toUpperCase() || "?";
      ini.style.fontSize = Math.round(H * 0.5) + "px";
      var probe = new Image();               // detect blocked sheets + true frame size
      probe.onerror = onSpriteError;
      probe.onload = function () { fitSprite(probe); };
      probe.src = cfg.sprite.url;
      framesWrap = null; frameEls = {};
    } else {
      spriteEl = null;
      framesWrap = root.querySelector(".tx-frames");
      frameEls = {};
      var list = framesWrap.querySelectorAll(".tx-frame");
      for (var i = 0; i < list.length; i++) frameEls[list[i].getAttribute("data-name")] = list[i];
    }
  }

  function summon(id) {
    id = (id || "traxx").toLowerCase();
    var c = registry[id];
    if (!c) { say("traxx: no character named \u201C" + id + "\u201D.", "err"); return; }
    if (root) { if (cfg && cfg.id === id) return; destroy(true); }

    cfg = c;
    injectEngineCss(); injectCharCss(cfg);
    var small = Math.min(vw(), vh()) < 620;
    H = Math.round(cfg.height * (small ? 0.78 : 1));
    W = Math.round(H * cfg.aspect);

    buildDOM();

    var term = document.getElementById("terminal");
    var tr = term ? term.getBoundingClientRect() : { left: vw() / 2, top: vh() / 2, width: 0, height: 0 };
    S = {
      x: 0, y: 0, vx: 0, vy: 0, dir: 1, lean: 0, spawnScale: 0.3,
      mode: null, targetX: 0, until: 0, lookUntil: 0, holdUntil: 0, grabDX: 0, grabDY: 0,
      _emote: false, _cur: null, _sid: null, cycle: [], fps: 0, frameIdx: 0, frameAcc: 0,
      btn: null, hopFromX: 0, hopFromY: 0, hopT0: 0, hopDur: 560, _sitT: 0,
      spawnFromX: clamp(tr.left + tr.width / 2 - W / 2, 0, maxX()),
      spawnFromY: clamp(tr.top + tr.height / 2 - H / 2, 0, floorY()),
      spawnToX: clamp(rand(20, Math.max(24, maxX() - 20)), 4, maxX()),
      spawnT0: nowT(), spawnDur: cfg.spawnDur || 820, byeT0: 0,
    };
    S.x = S.spawnFromX; S.y = S.spawnFromY;
    setMode("spawn"); showSign(2600);

    on(root, "pointerdown", onDown);
    on(root.querySelector(".tx-close"), "click", function (e) { e.preventDefault(); dismiss(); });
    on(window, "pointermove", onMove);
    on(window, "pointerup", onUp);
    on(window, "pointercancel", onUp);
    on(window, "resize", onResize);
    on(document, "keydown", onKeyDoc);
    var inp = document.getElementById("cmd");
    if (inp) { on(inp, "input", onType); on(inp, "keydown", onType); on(inp, "focus", onType); }

    last = 0; raf = requestAnimationFrame(tick);
    setTimeout(function () { if (root) speakFrom("hello", 2600); }, 1200);
    say(cfg.name + " online \u2014 roaming your screen. drag \u2018em around, or type \u201C" + cfg.id + "\u201D to hide.");
  }

  function destroy(silent) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; last = 0;
    clearTimeout(speakTimer); clearTimeout(signTimer); if (S) clearTimeout(S._sitT);
    for (var i = 0; i < listeners.length; i++) listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2], listeners[i][3]);
    listeners = [];
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = facing = motion = framesWrap = bubbleEl = spriteEl = null;
    frameEls = {}; S = null; dragging = false;
    if (!silent) cfg = null;
  }
  function dismiss() {
    if (!root || (S && S.mode === "bye")) return;
    dragging = false;
    var name = cfg.name, id = cfg.id;
    root.classList.remove("tx-drag");
    setMode("bye"); S.byeT0 = nowT();
    say(name + " out. (type \u201C" + id + "\u201D to summon again)");
  }
  function summonToggle(id) { if (root && cfg && cfg.id === id) dismiss(); else summon(id); }
  // re-fit sizing to the sheet's real dimensions (keeps the inferred grid),
  // so uniformly-scaled sheets still land on the right frame instead of empty space
  function fitSprite(img) {
    if (!root || !cfg || cfg.kind !== "sprite" || !spriteEl) return;
    var nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh) return;
    var cols = Math.max(1, Math.round(cfg.sprite.sheetW / cfg.sprite.fw));
    var rows = Math.max(1, Math.round(cfg.sprite.sheetH / cfg.sprite.fh));
    cfg.sprite.sheetW = nw; cfg.sprite.sheetH = nh;
    cfg.sprite.fw = nw / cols; cfg.sprite.fh = nh / rows;
    cfg.aspect = cfg.sprite.fw / cfg.sprite.fh;
    W = Math.round(H * cfg.aspect);
    root.style.width = W + "px";
    applySpriteSizing(spriteEl, cfg, H / cfg.sprite.fh);
  }
  function onSpriteError() {
    if (!root || !cfg || cfg.kind !== "sprite") return;
    root.classList.add("tx-noart");
    if (S && !S._warned) {
      S._warned = true;
      say(cfg.name + "\u2019s sprite is missing (" + cfg.sprite.url + ") \u2014 re-vendor it: node scripts/fetch-pets.mjs " + cfg.id, "err");
    }
  }

  /* ---------- button seats ---------- */
  var SEAT_SELECTOR = ".nav a, #themeBtn, #maxBtn";
  // pets riff on whatever button they're perched on
  var SEAT_QUIPS = {
    about: ["who's this? oh \u2014 it's Alqama.", "nice bio!", "a real human, i checked."],
    projects: ["ooh, robots!", "look at these builds!", "spinny motors!", "wow, hardware."],
    blogs: ["story time!", "read this one.", "words \u2014 good ones."],
    publications: ["fancy papers!", "peer-reviewed, ooh.", "big brain stuff."],
    contact: ["say hi!", "slide in here.", "poke him \u2192"],
    home: ["home base!", "start here.", "back to the top."],
    theme: ["flip the lights!", "dark mode gang.", "ooh, shiny."],
    max: ["big screen!", "zoooom.", "make it huge."],
  };
  var SEAT_WOWS = ["wow!", "neat!", "click it!", "this one's good.", "ooh.", "try me!", "wheee!"];
  function seatOn(t, ev, fn, opts) { t.addEventListener(ev, fn, opts || false); seatBound.push([t, ev, fn, opts || false]); }
  function seatActive(btn) {
    var href = btn.getAttribute && btn.getAttribute("href");
    if (!href || href.charAt(0) !== "#") return false;
    var cur = location.hash.replace(/^#\/?/, "").toLowerCase();
    var tgt = href.replace(/^#\/?/, "").toLowerCase();
    return cur === tgt;
  }
  function seatKey(btn) {
    if (btn.id === "themeBtn") return "theme";
    if (btn.id === "maxBtn") return "max";
    var href = (btn.getAttribute && btn.getAttribute("href")) || "";
    var k = href.replace(/^#\/?/, "").split("/")[0].toLowerCase();
    return k || "home";
  }
  function quipFor(btn) { var a = SEAT_QUIPS[seatKey(btn)]; return a ? pick(a) : pick(SEAT_WOWS); }
  function seatState(rec, sid) {
    if (!rec.sEl || !seatCfg || seatCfg.kind !== "sprite") return;
    setSpriteRow(rec.sEl, seatCfg, sid);
  }
  function seatRevert(rec) { seatState(rec, seatActive(rec.btn) ? "review" : "idle"); }
  function seatSpeak(rec, text, ms) {
    if (!rec.bubble || !text) return;
    rec.bubble.textContent = text;
    rec.bubble.classList.add("tx-show");
    clearTimeout(rec._sp);
    rec._sp = setTimeout(function () { if (rec.bubble) rec.bubble.classList.remove("tx-show"); }, ms || 1800);
  }
  function seatVisible(rec) { return rec.el && rec.el.isConnected && rec.el.style.display !== "none"; }
  function seatFall(rec) {
    if (!rec.hop || !seatVisible(rec)) return;
    seatState(rec, "jumping");
    rec.hop.classList.remove("tx-fall");
    void rec.hop.offsetWidth;              // reflow so the animation retriggers
    rec.hop.classList.add("tx-fall");
    clearTimeout(rec._land);
    rec._land = setTimeout(function () { if (seatVisible(rec)) seatRevert(rec); }, 900);
  }
  function seatEmote(rec) {
    if (!seatVisible(rec)) return;
    var roll = Math.random();
    if (roll < 0.4) { seatFall(rec); seatSpeak(rec, quipFor(rec.btn), 2200); }        // drop onto the button
    else if (roll < 0.7) { seatState(rec, "waving"); seatSpeak(rec, quipFor(rec.btn), 2000); setTimeout(function () { seatRevert(rec); }, 1200); }
    else if (roll < 0.87) { seatState(rec, "jumping"); seatSpeak(rec, pick(SEAT_WOWS), 1500); setTimeout(function () { seatRevert(rec); }, 820); }
    else { seatSpeak(rec, quipFor(rec.btn), 1900); }                                   // just a comment
  }
  function startSeatLoop() {
    clearInterval(seatLoop);
    if (reduceMotion()) return;
    seatLoop = setInterval(function () {
      if (!seatEls.length || document.hidden) return;
      var vis = seatEls.filter(seatVisible);
      if (vis.length) seatEmote(vis[(Math.random() * vis.length) | 0]);
    }, 4200);
  }
  function positionSeats() {
    var W2 = vw(), H2 = vh();
    for (var i = 0; i < seatEls.length; i++) {
      var rec = seatEls[i], r = rec.btn.getBoundingClientRect();
      // hide if the button is missing or scrolled out of view
      if ((r.width === 0 && r.height === 0) || r.bottom < 0 || r.top > H2) { rec.el.style.display = "none"; continue; }
      rec.el.style.display = "";
      var w = rec.el.offsetWidth || 44, h = rec.el.offsetHeight || 44;
      var left = clamp(r.left + r.width / 2 - w / 2, 2, Math.max(2, W2 - w - 2));
      var top = r.top - h + 8;                       // perch on the button's top edge
      if (top < 2) top = Math.min(r.top + 2, H2 - h - 2);  // no room above -> sit overlapping the button
      rec.el.style.left = Math.round(left) + "px";
      rec.el.style.top = Math.round(top) + "px";
    }
  }
  function refreshSeats() { for (var i = 0; i < seatEls.length; i++) seatState(seatEls[i], seatActive(seatEls[i].btn) ? "review" : "idle"); }
  function seatsOff() {
    clearInterval(seatLoop); seatLoop = 0;
    for (var i = 0; i < seatBound.length; i++) seatBound[i][0].removeEventListener(seatBound[i][1], seatBound[i][2], seatBound[i][3]);
    seatBound = [];
    for (var j = 0; j < seatEls.length; j++) { var e = seatEls[j].el; if (e) { clearTimeout(e._sp); if (e.parentNode) e.parentNode.removeChild(e); } }
    seatEls = []; seatCfg = null;
  }
  function seatsOn(c) {
    if (!c) return;
    seatsOff();
    injectEngineCss(); injectCharCss(c);
    seatCfg = c;
    var small = Math.min(vw(), vh()) < 620;
    var seatH = small ? 36 : 46;
    var seatW = Math.round(seatH * (c.aspect || 0.9));
    var btns = document.querySelectorAll(SEAT_SELECTOR);
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        var seat = document.createElement("div");
        seat.className = "tx-seat";
        seat.style.width = seatW + "px"; seat.style.height = seatH + "px";
        var visual = c.kind === "sprite"
          ? '<div class="tx-spritewrap"><div class="tx-sprite"></div></div>'
          : '<img class="tx-seatimg" alt="" src="' + c.path + 'idle.svg">';
        seat.innerHTML = '<div class="tx-seat-bubble"></div><div class="tx-seathop">' + visual + "</div>";
        document.body.appendChild(seat);
        var sEl = seat.querySelector(".tx-sprite");
        if (sEl) applySpriteSizing(sEl, c, seatH / c.sprite.fh);
        var rec = { el: seat, btn: btn, sEl: sEl, hop: seat.querySelector(".tx-seathop"), bubble: seat.querySelector(".tx-seat-bubble") };
        seatEls.push(rec);
        seatState(rec, seatActive(btn) ? "review" : "idle");
        seatOn(btn, "pointerenter", function () { seatState(rec, "waving"); seatSpeak(rec, quipFor(btn), 1600); });
        seatOn(btn, "focus", function () { seatState(rec, "waving"); seatSpeak(rec, quipFor(btn), 1600); });
        seatOn(btn, "pointerleave", function () { seatRevert(rec); });
        seatOn(btn, "blur", function () { seatRevert(rec); });
        seatOn(btn, "click", function () { seatState(rec, "jumping"); seatSpeak(rec, pick(SEAT_WOWS), 1400); clearTimeout(rec._land); rec._land = setTimeout(function () { seatRevert(rec); }, 820); });
      })(btns[i]);
    }
    positionSeats();
    seatOn(window, "resize", positionSeats);
    seatOn(window, "scroll", positionSeats, true);
    seatOn(window, "hashchange", refreshSeats);
    // staggered "raining pets" entrance, then occasional idle antics
    if (!reduceMotion()) seatEls.forEach(function (rec, i) { setTimeout(function () { if (seatVisible(rec)) seatFall(rec); }, 150 + i * 140); });
    startSeatLoop();
  }

  /* ---------- PetDex hooks ---------- */
  function setResolver(fn) { resolver = fn; }
  function setProvider(p) { provider = p; }
  function summonResolved(name) {
    if (!resolver) { say(name + ": unknown command or character.", "err"); return true; }
    if (resolving) { return true; }
    resolving = true;
    say("summoning \u201C" + name + "\u201D\u2026");
    Promise.resolve(resolver(name)).then(function (rc) {
      resolving = false;
      if (!rc) {
        say("\u201C" + name + "\u201D isn\u2019t installed \u2014 use `spawn " + name + "` to fetch it from petdex now.", "err");
        say("or vendor it for offline: node scripts/fetch-pets.mjs " + name + "  \u00b7  `petdex list` shows installed.", "muted");
        return;
      }
      define(rc); summon(rc.id);
    }, function (err) {
      resolving = false;
      say("couldn\u2019t summon \u201C" + name + "\u201D (" + (err && err.message || err) + ")", "err");
    });
    return true;
  }
  function playState(stateId) {
    stateId = String(stateId || "").toLowerCase();
    if (!root || cfg.kind !== "sprite") { say("summon a petdex pet first (e.g. `petdex random`).", "err"); return; }
    if (!cfg.sprite.rows[stateId]) { say("unknown state \u201C" + stateId + "\u201D. try: " + SPRITE_STATE_IDS.join(", "), "err"); return; }
    setMode("idle");
    S._sid = setSpriteRow(spriteEl, cfg, stateId);
    S.until = nowT() + 4000; S.holdUntil = nowT() + 4000;
    say(cfg.name + " \u2192 " + stateId);
  }

  /* ---------- terminal routing ---------- */
  function listChars() {
    var ids = Object.keys(registry);
    say("local characters: " + ids.map(function (i) { return registry[i].name + " (" + i + ")"; }).join("  \u00b7  "));
    say("petdex: `petdex random` \u00b7 `petdex find <q>` \u00b7 `./<slug>` \u00b7 `petdex seats on`.");
  }
  function routeSeats(args) {
    var a = (args[0] || "").toLowerCase();
    if (a === "off" || a === "none" || a === "hide" || a === "clear") { seatsOff(); say("button pets cleared."); return true; }
    if (!a || a === "on") {
      var c = seatCfg || cfg;
      if (!c && provider && typeof provider.defaultConfig === "function") c = provider.defaultConfig();
      if (!c) c = registry["traxx"];
      if (!c) { say("no pet to seat \u2014 try `seats <name>`.", "err"); return true; }
      seatsOn(c); say(c.name + " now sits on the buttons \u2014 `seats off` to clear."); return true;
    }
    if (registry[a]) { seatsOn(registry[a]); say(registry[a].name + " now sits on the buttons."); return true; }
    if (resolver) {
      say("seating \u201C" + a + "\u201D\u2026");
      Promise.resolve(resolver(a)).then(function (rc) {
        if (!rc) { say("no pet named \u201C" + a + "\u201D.", "err"); return; }
        define(rc); seatsOn(rc); say(rc.name + " now sits on the buttons.");
      }, function (e) { say("seat failed: " + (e && e.message || e), "err"); });
      return true;
    }
    say("no pet named \u201C" + a + "\u201D.", "err"); return true;
  }
  function routeTraxx(args) {
    var sub = (args[0] || "").toLowerCase();
    if (sub === "list" || sub === "ls" || sub === "who") { listChars(); return true; }
    if (sub === "seats" || sub === "seat") return routeSeats(args.slice(1));
    if (DISMISS_WORDS.indexOf(sub) !== -1) { if (root) dismiss(); else say("no mascot is out."); return true; }
    if (sub) { if (registry[sub]) summonToggle(sub); else routeName(sub); return true; }
    if (root) dismiss(); else summon("traxx");
    return true;
  }
  function routePetdex(args) {
    var sub = (args[0] || "").toLowerCase();
    if (sub === "seats" || sub === "seat") return routeSeats(args.slice(1));
    if (sub === "state" || sub === "pose" || sub === "expr" || sub === "expression") {
      if (args[1]) playState(args[1]); else say("states: " + SPRITE_STATE_IDS.join(", "));
      return true;
    }
    if (DISMISS_WORDS.indexOf(sub) !== -1) { if (root) dismiss(); else seatsOff(); return true; }
    if (provider) {
      if (!sub || sub === "help") { provider.list(); return true; }
      if (sub === "list" || sub === "ls") { provider.list(args[1]); return true; }
      if (sub === "random" || sub === "rand" || sub === "surprise") { provider.random(); return true; }
      if (sub === "find" || sub === "search") { provider.find(args.slice(1).join(" ")); return true; }
    } else if (!sub || sub === "list" || sub === "random" || sub === "find") {
      say("petdex module not loaded.", "err"); return true;
    }
    return routeName(sub); // `petdex <slug>`
  }
  function routeName(name) {
    var bare = String(name || "").replace(/^\.\//, "").toLowerCase();
    if (!bare) return false;
    if (registry[bare]) { summonToggle(bare); return true; }
    if (resolver) return summonResolved(bare);
    return false;
  }
  // explicit verbs only (traxx / petdex / pet); names fall through to routeName
  function routeSpawn(args) {
    var name = (args || []).join(" ").trim();
    if (!name) { say("usage: spawn <name>  \u2014 fetch a pet from petdex by name", "err"); return true; }
    var bare = name.replace(/^\.\//, "").toLowerCase();
    if (registry[bare]) { summon(bare); return true; }        // already loaded/vendored
    if (provider && typeof provider.spawn === "function") { provider.spawn(bare); return true; }
    if (resolver) return summonResolved(bare);                // local fallback
    say("spawn: pet provider not loaded.", "err");
    return true;
  }
  function route(name, args) {
    var bare = String(name || "").replace(/^\.\//, "").toLowerCase();
    args = args || [];
    if (bare === "traxx") return routeTraxx(args);
    if (bare === "petdex" || bare === "pet" || bare === "pets") return routePetdex(args);
    if (bare === "spawn" || bare === "summon") return routeSpawn(args);
    if (bare === "seats" || bare === "seat") return routeSeats(args);
    return false;
  }

  window.Traxx = {
    define: define, summon: summon, dismiss: dismiss,
    toggle: function (args) { return routeTraxx(args || []); },
    route: route, routeName: routeName,
    has: function (id) { return !!registry[String(id || "").toLowerCase()]; },
    ids: function () { return Object.keys(registry); },
    current: function () { return cfg ? cfg.id : null; },
    setResolver: setResolver, setProvider: setProvider,
    seats: seatsOn, seatsOff: seatsOff, playState: playState,
  };
})();
