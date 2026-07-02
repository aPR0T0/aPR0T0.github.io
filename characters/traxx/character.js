// characters/traxx/character.js — DJ TRAXX, the default mascot.
// A config file: metadata + which SVG frame each interaction shows + speech.
// Registers itself with the engine (traxx.js). Loaded via a <script> tag in
// index.html AFTER traxx.js. Art lives beside this file as plain .svg frames.
(function () {
  if (!window.Traxx || !window.Traxx.define) return;
  window.Traxx.define({
    id: "traxx",
    name: "DJ TRAXX",
    path: "characters/traxx/",   // where the .svg frames live
    height: 140,                 // sprite height in px (desktop); width = height * aspect
    aspect: 112 / 140,
    speed: 66,                   // roaming speed, px/s
    sign: { bg: "#111", fg: "#f5c518" },  // LED name-sign colours (null hides it)

    // interaction -> { frames, anim }.  `frames` is an .svg name (or a list to
    // cycle). `anim` is a built-in motion (bob-slow | bob | shake | none) or a
    // custom one defined in `css`.  `lean:true` makes him tilt toward the prompt.
    states: {
      idle:  { frames: "idle",  anim: "bob-slow" },
      walk:  { frames: "idle",  anim: "bob" },
      look:  { frames: "look",  anim: "bob-slow", lean: true },
      panic: { frames: "panic", anim: "shake" },
      fall:  { frames: "panic", anim: "shake" },
      land:  { frames: "idle",  anim: "none" },
    },

    speech: {
      hello: ["yo. DJ TRAXX in the house.", "beats loaded \u2014 go on, try to pick me up.", "who summoned the traxx?"],
      panic: ["AAAH put me DOWN!", "WOAaaAH!!", "not the vibe!!", "unhand the traxx!!"],
      land:  ["phew.", "...never again.", "ok. ok. i'm cool."],
      idle:  ["tss tss tss", "just vibing.", "*scratches record*", "wubwubwub"],
    },
  });
})();
