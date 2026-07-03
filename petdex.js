// petdex.js — LOCAL pet provider.
//
// Pets are vendored into this repo by scripts/fetch-pets.mjs (spritesheets under
// pets/<slug>/sprite.webp, indexed by pets/manifest.js -> window.PETS). This file
// hands those local sprites to the mascot engine (traxx.js). Nothing is fetched
// from petdex.dev at runtime, so it's blocker-proof, works offline, and works
// over file:// too — everything is same-origin.
//
// To add pets: `node scripts/fetch-pets.mjs <name...>` then commit. Each PetDex
// spritesheet is an 8x9 grid of 192x208 frames; each row is an animation state.

(function () {
  "use strict";
  if (!window.Traxx || !window.Traxx.setResolver) return;

  // Canonical PetDex grid + row map (petdex src/lib/pet-states.ts).
  var SHEET = { sheetW: 1536, sheetH: 1872, fw: 192, fh: 208 };
  var ROWS = {
    idle: { row: 0, frames: 6, duration: 1100 },
    "running-right": { row: 1, frames: 8, duration: 1060 },
    "running-left": { row: 2, frames: 8, duration: 1060 },
    waving: { row: 3, frames: 4, duration: 700 },
    jumping: { row: 4, frames: 5, duration: 840 },
    failed: { row: 5, frames: 8, duration: 1220 },
    waiting: { row: 6, frames: 6, duration: 1010 },
    running: { row: 7, frames: 6, duration: 820 },
    review: { row: 8, frames: 6, duration: 1030 },
  };

  /* ---------- helpers ---------- */
  var pick = function (a) { return a && a.length ? a[(Math.random() * a.length) | 0] : ""; };
  function say(text, cls) {
    try { if (typeof emit === "function" && typeof line === "function") emit(line(text, cls || "muted")); }
    catch (e) {}
  }
  function slugify(s) {
    s = String(s || "");
    try { s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function normName(s) {
    return String(s || "").trim().toLowerCase().replace(/^\.\//, "").replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "");
  }
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return "hsl(" + (h % 360) + ",90%,64%)"; }
  function preload(url) { try { var im = new Image(); im.decoding = "async"; im.src = url; } catch (e) {} }

  /* ---------- local index (from window.PETS) ---------- */
  var slugMap = {}, aliasMap = {}, list = [];
  (function build() {
    var data = (window.PETS && window.PETS.pets) || [];
    for (var i = 0; i < data.length; i++) {
      var p = data[i];
      if (!p || !p.slug || !p.file) continue;
      if (slugMap[p.slug]) continue;
      slugMap[p.slug] = p;
      list.push(p.slug);
      var a = slugify(p.name || "");
      if (a && a !== p.slug && !aliasMap[a] && !slugMap[a]) aliasMap[a] = p.slug;
    }
  })();
  var installed = list.length;

  function matchSlug(name) {
    var n = normName(name);
    if (!n) return null;
    if (slugMap[n]) return n;
    if (aliasMap[n]) return aliasMap[n];
    var hits = list.filter(function (s) { return s.indexOf(n) === 0; });
    if (hits.length === 1) return hits[0];
    return null;
  }
  function makeConfig(slug, url, displayName, by) {
    var name = displayName || slug;
    return {
      id: slug, name: name, kind: "sprite",
      height: 132, speed: 58, spawnDur: 380,
      sign: { bg: "#111", fg: hue(slug) },
      sprite: { url: url, sheetW: SHEET.sheetW, sheetH: SHEET.sheetH, fw: SHEET.fw, fh: SHEET.fh, rows: ROWS },
      submittedBy: by || "",
      speech: {
        hello: [name + " reporting.", "beep \u2014 " + name + " online.", name + " says hi."],
        panic: ["put me down!", "whoa!!", "eep!", "not the pixels!"],
        land: ["oof.", "\u2026ok.", "we cool."],
        idle: ["\u2026", "*idle beeps*", by ? "made by " + by : "a petdex pet"],
      },
    };
  }
  function toConfig(slug) {
    var p = slugMap[slug];
    return p ? makeConfig(slug, p.file, p.name, p.by) : null;
  }

  // engine resolver: name -> config | null (synchronous; all local)
  function resolve(name) {
    var slug = matchSlug(name);
    if (!slug) return null;
    var c = toConfig(slug);
    if (c) preload(c.sprite.url);
    return c;
  }

  /* ---------- commands ---------- */
  function summonSlug(slug) {
    var c = toConfig(slug);
    if (!c) return;
    preload(c.sprite.url);
    window.Traxx.define(c);
    window.Traxx.summon(slug);
  }
  function names() {
    return list.map(function (s) { var d = slugMap[s].name; return d && slugify(d) !== s ? s + " (" + d + ")" : s; });
  }
  function list_(filter) {
    if (!installed) { say("no pets installed yet. add some: `node scripts/fetch-pets.mjs boba dalek pixel-panda`", "err"); return; }
    var l = names();
    if (filter) { var f = normName(filter); l = l.filter(function (s) { return s.indexOf(f) >= 0; }); }
    say(installed + " pet" + (installed === 1 ? "" : "s") + " installed:");
    say(l.join("  \u00b7  "));
    say("summon with ./<name> \u00b7 add more with `node scripts/fetch-pets.mjs <name>`.");
  }
  function find(q) {
    q = (q || "").trim();
    if (!q) { say("usage: petdex find <query>", "err"); return; }
    var qs = normName(q), qr = q.toLowerCase();
    var hits = list.filter(function (s) { return s.indexOf(qs) >= 0 || String(slugMap[s].name || "").toLowerCase().indexOf(qr) >= 0; });
    if (!hits.length) { say("no installed pet matches \u201C" + q + "\u201D. vendor it: `node scripts/fetch-pets.mjs " + qs + "`", "err"); return; }
    say(hits.length + " match" + (hits.length === 1 ? "" : "es") + ":");
    say(hits.map(function (s) { var d = slugMap[s].name; return d && slugify(d) !== s ? s + " (" + d + ")" : s; }).join("  \u00b7  "));
  }
  function random() {
    if (!installed) { say("no pets installed. run `node scripts/fetch-pets.mjs boba dalek scoop` first.", "err"); return; }
    var s = pick(list); if (s) { say("petdex roll \u2192 " + s); summonSlug(s); }
  }

  /* ---------- remote spawn (network) — only via the explicit `spawn <name>` ---------- */
  var REMOTE_URLS = [
    "https://assets.petdex.dev/manifests/petdex-v1.json",
    "https://petdex.dev/api/manifest",
  ];
  var RKEY = "petdex.remote.v1", RTTL = 24 * 3600 * 1000;
  var remoteIdx = null, remoteLoading = null;

  function fetchOne(url) {
    var ctl = ("AbortController" in window) ? new AbortController() : null;
    var to = ctl ? setTimeout(function () { ctl.abort(); }, 9000) : 0;
    return fetch(url, { mode: "cors", credentials: "omit", signal: ctl ? ctl.signal : undefined }).then(
      function (r) { if (to) clearTimeout(to); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); },
      function (e) { if (to) clearTimeout(to); throw e; }
    );
  }
  function buildRemote(pets) {
    var slugM = {}, aliasM = {}, ls = [];
    for (var i = 0; i < pets.length; i++) {
      var p = pets[i], u = p.spritesheetUrl || p.url;
      if (!p.slug || !u || slugM[p.slug]) continue;
      slugM[p.slug] = { u: u, d: p.displayName || p.slug, by: p.submittedBy || "" };
      ls.push(p.slug);
      var a = slugify(p.displayName || "");
      if (a && a !== p.slug && !aliasM[a] && !slugM[a]) aliasM[a] = p.slug;
    }
    return { slugM: slugM, aliasM: aliasM, list: ls, at: Date.now() };
  }
  function readRemoteCache() {
    try {
      var o = JSON.parse(localStorage.getItem(RKEY) || "null");
      if (!o || o.v !== 1 || !Array.isArray(o.pets) || Date.now() - o.at > RTTL) return null;
      var pets = o.pets.map(function (a) { return { slug: a[0], spritesheetUrl: a[1], displayName: a[2], submittedBy: a[3] }; });
      var idx = buildRemote(pets); idx.at = o.at; return idx;
    } catch (e) { return null; }
  }
  function writeRemoteCache(idx) {
    try {
      var pets = idx.list.map(function (s) { var e = idx.slugM[s]; return [s, e.u, e.d, e.by]; });
      localStorage.setItem(RKEY, JSON.stringify({ v: 1, at: idx.at || Date.now(), pets: pets }));
    } catch (e) {}
  }
  function ensureRemote() {
    if (remoteIdx) return Promise.resolve(remoteIdx);
    if (remoteLoading) return remoteLoading;
    var c = readRemoteCache();
    if (c) { remoteIdx = c; return Promise.resolve(c); }
    remoteLoading = fetchOne(REMOTE_URLS[0]).catch(function () { return fetchOne(REMOTE_URLS[1]); }).then(
      function (j) { var pets = (j && j.pets) || j; if (!Array.isArray(pets)) throw new Error("bad manifest"); remoteIdx = buildRemote(pets); writeRemoteCache(remoteIdx); remoteLoading = null; return remoteIdx; },
      function (e) { remoteLoading = null; throw e; }
    );
    return remoteLoading;
  }
  function remoteMatch(name) {
    var n = normName(name);
    if (!n) return null;
    if (remoteIdx.slugM[n]) return n;
    if (remoteIdx.aliasM[n]) return remoteIdx.aliasM[n];
    var hits = remoteIdx.list.filter(function (s) { return s.indexOf(n) === 0; });
    return hits.length === 1 ? hits[0] : null;
  }
  // spawn <name>: summon a vendored pet instantly, else fetch it from PetDex now.
  function spawn(name) {
    name = String(name || "").trim();
    if (!name) { say("usage: spawn <name>  \u2014 fetches a pet from petdex and summons it", "err"); return; }
    var localSlug = matchSlug(name);
    if (localSlug) { summonSlug(localSlug); return; }
    say("spawning \u201C" + name + "\u201D from petdex\u2026");
    ensureRemote().then(function () {
      var slug = remoteMatch(name);
      if (!slug) { say("no petdex pet named \u201C" + name + "\u201D \u2014 check the slug at petdex.dev.", "err"); return; }
      var e = remoteIdx.slugM[slug];
      var c = makeConfig(slug, e.u, e.d, e.by);
      preload(c.sprite.url);
      window.Traxx.define(c);
      window.Traxx.summon(slug);
      say("tip: vendor it so it loads offline next time \u2014 node scripts/fetch-pets.mjs " + slug, "muted");
    }, function (err) {
      say("couldn\u2019t reach petdex (" + (err && err.message || err) + ") \u2014 offline or blocked. vendor it instead: node scripts/fetch-pets.mjs " + normName(name), "err");
    });
  }

  function defaultConfig() { return installed ? toConfig(list[0]) : null; }

  window.Traxx.setResolver(resolve);
  window.Traxx.setProvider({ list: list_, find: find, random: random, spawn: spawn, defaultConfig: defaultConfig });
})();
