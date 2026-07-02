// traxx.js — a tiny interactive on-page mascot engine.
//
// This is the ENGINE only; it knows nothing about a specific character. Each
// character is defined by a config file that calls window.Traxx.define(...) and
// ships its artwork as plain .svg files in a folder of the same name, e.g.:
//
//   characters/traxx/character.js      -> Traxx.define({ id:"traxx", ... })
//   characters/traxx/idle.svg          -> a sprite frame
//   characters/traxx/look.svg          -> another expression
//   characters/traxx/panic.svg
//
// Frames are drawn with <img> (so it works from file:// AND http — no fetch, no
// build step). Interactions map to "states" (idle / walk / look / panic / fall /
// land / emote); each state picks a frame (or a list of frames to cycle) plus a
// CSS motion animation (bob / shake / a custom one from the character's `css`).
//
// A character pops out of the terminal, roams the screen, turns to face the
// prompt while you type, and panics whenever it is picked up and dragged.
//
// Classic script (no ES modules): shares global scope with app.js/content.js and
// borrows emit()/line() when it prints to the terminal. Public API:
//   window.Traxx = { define, summon, dismiss, toggle, route, has, ids, current }
//
// Triggered from the terminal (see the hook in app.js runCommand()).

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

  /* ---------- character registry ---------- */
  var registry = {};                 // id -> normalized config
  var injectedCss = {};              // per-character css injected once

  // state keys and how they fall back if a character doesn't define them
  var FALLBACK = {
    idle:  ["idle"],
    walk:  ["walk", "idle"],
    look:  ["look", "idle"],
    panic: ["panic", "idle"],
    fall:  ["fall", "panic", "idle"],
    land:  ["land", "idle"],
    emote: ["emote", "idle"],
    spawn: ["spawn", "idle"],
    bye:   ["bye", "idle"],
  };
  var DEFAULT_ANIM = {
    idle: "bob-slow", walk: "bob", look: "bob-slow", panic: "shake",
    fall: "shake", land: "none", emote: "bob", spawn: "none", bye: "none",
  };

  function normalize(cfg) {
    if (!cfg || !cfg.id) throw new Error("Traxx.define: config needs an id");
    var c = {};
    c.id = String(cfg.id).toLowerCase();
    c.name = cfg.name || c.id;
    c.path = cfg.path || ("characters/" + c.id + "/");
    if (c.path.charAt(c.path.length - 1) !== "/") c.path += "/";
    c.height = cfg.height || 140;
    c.aspect = cfg.aspect || 0.8;         // width / height
    c.speed = cfg.speed || 64;            // walk px/s
    c.sign = cfg.sign || null;            // {bg, fg} LED name-sign, or null to hide
    c.flip = cfg.flip !== false;          // mirror sprite to indicate direction
    c.speech = cfg.speech || {};
    c.css = cfg.css || "";

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
        frames: fr,
        fps: def.fps != null ? def.fps : (fr.length > 1 ? 6 : 0),
        anim: def.anim != null ? def.anim : DEFAULT_ANIM[key],
        lean: !!def.lean,
      };
    });
    c._states = norm;
    c._frameNames = Object.keys(names);
    return c;
  }

  function define(cfg) {
    try {
      var c = normalize(cfg);
      registry[c.id] = c;
      return c.id;
    } catch (e) {
      say("traxx: bad character config (" + (cfg && cfg.id) + ")", "err");
      return null;
    }
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
    // motion animations (states reference these by name -> tx-anim-<name>)
    '@keyframes tx-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}' +
    '.tx-anim-bob-slow{animation:tx-bob 1.9s ease-in-out infinite;}' +
    '.tx-anim-bob{animation:tx-bob .5s ease-in-out infinite;}' +
    '@keyframes tx-shake{0%{transform:translate(-2px,0) rotate(-4deg)}25%{transform:translate(2px,-1px) rotate(4deg)}' +
      '50%{transform:translate(-2px,1px) rotate(-3deg)}75%{transform:translate(2px,0) rotate(3deg)}100%{transform:translate(-2px,0) rotate(-4deg)}}' +
    '.tx-anim-shake{animation:tx-shake .16s linear infinite;}' +
    // LED name sign
    '.tx-sign{position:absolute;left:50%;top:-12px;transform:translate(-50%,-100%) scale(0);z-index:4;' +
      'transform-origin:center bottom;font-family:var(--mono,monospace);font-weight:600;font-size:13px;letter-spacing:2px;' +
      'padding:5px 9px;border-radius:3px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.4);' +
      'transition:transform .35s cubic-bezier(.2,1.5,.4,1);pointer-events:none;}' +
    '.tx-sign::after{content:"";position:absolute;inset:0;border-radius:2px;pointer-events:none;' +
      'background-image:radial-gradient(rgba(0,0,0,.32) 1px,transparent 1.4px);background-size:3px 3px;}' +
    '.tx-root.tx-signed .tx-sign{transform:translate(-50%,-100%) scale(1);}' +
    '@keyframes tx-flash{0%,100%{opacity:1}50%{opacity:.25}}' +
    '.tx-root.tx-panic.tx-signed .tx-sign{animation:tx-flash .2s steps(1) infinite;}' +
    // speech bubble (themed to the site)
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
    '@media (prefers-reduced-motion: reduce){.tx-root .tx-motion{animation:none !important;}}';

  function injectEngineCss() {
    if (document.getElementById("tx-style")) return;
    var st = document.createElement("style");
    st.id = "tx-style";
    st.textContent = ENGINE_CSS;
    document.head.appendChild(st);
  }
  function injectCharCss(cfg) {
    if (!cfg.css || injectedCss[cfg.id]) return;
    var st = document.createElement("style");
    st.id = "tx-style-" + cfg.id;
    st.textContent = cfg.css;
    document.head.appendChild(st);
    injectedCss[cfg.id] = true;
  }

  /* ---------- live instance state ---------- */
  var cfg = null;                    // active character config
  var root = null, facing = null, motion = null, framesWrap = null, bubbleEl = null;
  var frameEls = {};                 // name -> <img>
  var S = null;
  var raf = 0, last = 0, dragging = false;
  var speakTimer = 0, signTimer = 0;
  var listeners = [];

  function on(target, ev, fn, opts) {
    target.addEventListener(ev, fn, opts || false);
    listeners.push([target, ev, fn, opts || false]);
  }
  function vw() { return window.innerWidth || document.documentElement.clientWidth; }
  function vh() { return window.innerHeight || document.documentElement.clientHeight; }
  var W = 112, H = 140;
  function maxX() { return Math.max(0, vw() - W - 4); }
  function floorY() { return Math.max(0, vh() - H - 6); }

  /* ---------- frames / states ---------- */
  function showImg(img) {
    if (!img || S._cur === img) return;
    if (S._cur) S._cur.classList.remove("tx-on");
    img.classList.add("tx-on");
    S._cur = img;
  }
  function setMotion(anim) {
    motion.className = "tx-motion" + (anim && anim !== "none" ? " tx-anim-" + anim : "");
  }
  function applyState(key) {
    var st = cfg._states[key] || cfg._states.idle;
    setMotion(st.anim);
    S.cycle = st.frames.map(function (n) { return frameEls[n] || frameEls[cfg._frameNames[0]]; });
    S.fps = st.fps;
    S.frameIdx = 0;
    S.frameAcc = 0;
    S._leanState = st.lean;
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
    bubbleEl.textContent = txt;
    bubbleEl.classList.add("tx-show");
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
    var tx, tries = 0;
    do { tx = rand(4, maxX()); tries++; } while (Math.abs(tx - S.x) < 70 && tries < 8);
    S.targetX = tx;
    S._emote = false;
    setMode("walk");
  }
  function enterIdle(t, minMs, maxMs) {
    S._emote = Math.random() < 0.4;
    setMode("idle");
    S.until = t + rand(minMs, maxMs);
    if (S._emote) speakFrom("idle", 1600);
  }
  function faceAndTrack() {
    var inp = document.getElementById("cmd");
    if (!inp) return;
    var r = inp.getBoundingClientRect();
    var px = r.left + r.width * 0.12, py = r.top + r.height / 2;
    var cx = S.x + W / 2, cy = S.y + H * 0.30;
    var dx = px - cx;
    S.dir = dx >= 0 ? 1 : -1;
    S.lean = cfg._states.look.lean ? clamp(dx / 34, -6, 6) : 0;
    void py;
    S.y = floorY();
  }
  function land() {
    S.vy = 0;
    setMode("idle");
    S.until = nowT() + rand(500, 1200);
    if (Math.random() < 0.7) speakFrom("land", 1400);
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
        var d = S.targetX - S.x;
        S.dir = d >= 0 ? 1 : -1;
        S.x += S.dir * cfg.speed * dt;
        S.y = floorY();
        if (Math.abs(S.targetX - S.x) <= 2 || S.x <= 2 || S.x >= maxX()) {
          S.x = clamp(S.x, 2, maxX());
          enterIdle(t, 600, 2400);
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
        if (t > S.lookUntil) enterIdle(t, 300, 700);
        break;
      }
      case "drag": break;
      case "fall": {
        S.vy += 2600 * dt;
        S.y += S.vy * dt;
        var fy = floorY();
        if (S.y >= fy) { S.y = fy; if (S.vy > 250) S.vy = -S.vy * 0.42; else land(); }
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
    // advance frame cycle (multi-frame states)
    if (S.cycle && S.cycle.length > 1 && S.fps > 0) {
      S.frameAcc += dt;
      var spf = 1 / S.fps;
      while (S.frameAcc >= spf) {
        S.frameAcc -= spf;
        S.frameIdx = (S.frameIdx + 1) % S.cycle.length;
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
    last = t;
    step(dt, t);
    if (!root) return;
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
    root.classList.add("tx-drag");
    setMode("drag");
    showSign(0);
    speakFrom("panic", 1300);
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
  function onKeyDoc(e) { if (e.key === "Escape" && root && S.mode !== "bye") dismiss(); }

  /* ---------- lifecycle ---------- */
  function buildDOM() {
    root = document.createElement("div");
    root.className = "tx-root";
    root.setAttribute("data-char", cfg.id);
    root.setAttribute("aria-label", cfg.name + " mascot");
    root.style.width = W + "px";
    root.style.height = H + "px";

    var signHtml = "";
    if (cfg.sign) {
      var bg = cfg.sign.bg || "#111", fg = cfg.sign.fg || "#f5c518";
      signHtml = '<div class="tx-sign" style="background:' + bg + ';color:' + fg +
        ';border:2px solid ' + fg + ';text-shadow:0 0 5px ' + fg + '">' +
        (cfg.name || cfg.id).replace(/ /g, "\u00a0") + "</div>";
    }
    var imgs = cfg._frameNames.map(function (n) {
      return '<img class="tx-frame" data-name="' + n + '" alt="" draggable="false" src="' +
        cfg.path + n + '.svg">';
    }).join("");

    root.innerHTML =
      '<button class="tx-close" type="button" title="say bye" aria-label="Dismiss ' + cfg.name + '">\u00d7</button>' +
      signHtml +
      '<div class="tx-bubble"></div>' +
      '<div class="tx-facing"><div class="tx-motion"><div class="tx-frames">' + imgs + "</div></div></div>" +
      '<div class="tx-shadow"></div>';
    document.body.appendChild(root);

    facing = root.querySelector(".tx-facing");
    motion = root.querySelector(".tx-motion");
    framesWrap = root.querySelector(".tx-frames");
    bubbleEl = root.querySelector(".tx-bubble");
    frameEls = {};
    var list = framesWrap.querySelectorAll(".tx-frame");
    for (var i = 0; i < list.length; i++) frameEls[list[i].getAttribute("data-name")] = list[i];
  }

  function summon(id) {
    id = (id || "traxx").toLowerCase();
    var c = registry[id];
    if (!c) { say("traxx: no character named \u201C" + id + "\u201D. try \u201Ctraxx list\u201D.", "err"); return; }
    if (root) { if (cfg && cfg.id === id) return; destroy(true); }

    cfg = c;
    injectEngineCss();
    injectCharCss(cfg);

    var small = Math.min(vw(), vh()) < 620;
    H = Math.round(cfg.height * (small ? 0.78 : 1));
    W = Math.round(H * cfg.aspect);

    buildDOM();

    var term = document.getElementById("terminal");
    var tr = term ? term.getBoundingClientRect() : { left: vw() / 2, top: vh() / 2, width: 0, height: 0 };
    S = {
      x: 0, y: 0, vx: 0, vy: 0, dir: 1, lean: 0, spawnScale: 0.3,
      mode: null, targetX: 0, until: 0, lookUntil: 0, grabDX: 0, grabDY: 0,
      _emote: false, _cur: null, cycle: [], fps: 0, frameIdx: 0, frameAcc: 0,
      spawnFromX: clamp(tr.left + tr.width / 2 - W / 2, 0, maxX()),
      spawnFromY: clamp(tr.top + tr.height / 2 - H / 2, 0, floorY()),
      spawnToX: clamp(rand(20, Math.max(24, maxX() - 20)), 4, maxX()),
      spawnT0: nowT(), spawnDur: 820, byeT0: 0,
    };
    S.x = S.spawnFromX; S.y = S.spawnFromY;
    setMode("spawn");
    showSign(2600);

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
    setTimeout(function () { if (root) speakFrom("hello", 2600); }, 1500);
    say(cfg.name + " online \u2014 roaming your screen. drag \u2018em around, or type \u201C" + cfg.id + "\u201D to hide.");
  }

  function destroy(silent) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; last = 0;
    clearTimeout(speakTimer); clearTimeout(signTimer);
    for (var i = 0; i < listeners.length; i++) {
      listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2], listeners[i][3]);
    }
    listeners = [];
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = facing = motion = framesWrap = bubbleEl = null;
    frameEls = {}; S = null; dragging = false;
    if (!silent) cfg = null;
  }

  function dismiss() {
    if (!root || (S && S.mode === "bye")) return;
    dragging = false;
    var name = cfg.name, id = cfg.id;
    root.classList.remove("tx-drag");
    setMode("bye");
    S.byeT0 = nowT();
    say(name + " out. (type \u201C" + id + "\u201D to summon again)");
  }

  /* ---------- terminal command routing ---------- */
  function listChars() {
    var ids = Object.keys(registry);
    if (!ids.length) { say("no characters registered.", "err"); return; }
    say("characters: " + ids.map(function (i) { return registry[i].name + " (" + i + ")"; }).join("  \u00b7  "));
    say("summon with ./<name> or `traxx <name>` \u00b7 hide with `traxx bye`.");
  }
  // returns true if the command was handled by the mascot engine
  function route(name, args) {
    var bare = String(name || "").replace(/^\.\//, "").toLowerCase();
    args = args || [];
    if (bare === "traxx") {
      var sub = (args[0] || "").toLowerCase();
      if (sub === "list" || sub === "ls" || sub === "who") { listChars(); return true; }
      if (["bye", "go", "out", "exit", "quit", "stop", "off", "hide", "sleep"].indexOf(sub) !== -1) {
        if (root) dismiss(); else say("no mascot is out. type a name to summon one.");
        return true;
      }
      if (sub && registry[sub]) { summon(sub); return true; }
      if (sub) { say("traxx: no character named \u201C" + sub + "\u201D. try \u201Ctraxx list\u201D.", "err"); return true; }
      if (root) dismiss(); else summon("traxx");   // bare `traxx` toggles default
      return true;
    }
    if (registry[bare]) {                          // `./<id>` or `<id>`
      if (root && cfg && cfg.id === bare) dismiss(); else summon(bare);
      return true;
    }
    return false;
  }

  window.Traxx = {
    define: define,
    summon: summon,
    dismiss: dismiss,
    toggle: function (args) { return route("traxx", args || []); },
    route: route,
    has: function (id) { return !!registry[String(id || "").toLowerCase()]; },
    ids: function () { return Object.keys(registry); },
    current: function () { return cfg ? cfg.id : null; },
  };
})();
