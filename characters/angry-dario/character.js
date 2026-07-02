// characters/angry-dario/character.js — a second, test character.
// Shows how little it takes to add your own mascot: a folder named after the
// character, a few .svg frames, and this config. Also demonstrates a CUSTOM
// interaction animation ("stomp") supplied via the `css` field.
(function () {
  if (!window.Traxx || !window.Traxx.define) return;
  window.Traxx.define({
    id: "angry-dario",
    name: "ANGRY DARIO",
    path: "characters/angry-dario/",
    height: 132,
    aspect: 112 / 140,
    speed: 52,                            // stomps around a bit slower
    sign: { bg: "#3a0d0a", fg: "#ff5a3c" },

    states: {
      idle:  { frames: "idle",  anim: "bob-slow" },
      walk:  { frames: "idle",  anim: "stomp" },   // <- custom animation (see css)
      look:  { frames: "idle",  anim: "bob-slow", lean: true },
      panic: { frames: "panic", anim: "shake" },
      fall:  { frames: "panic", anim: "shake" },
      land:  { frames: "angry", anim: "shake" },
      emote: { frames: "angry", anim: "bob" },     // grumbles in place when idle
    },

    speech: {
      hello: ["WHAT. who woke me up.", "grr. state your business.", "you AGAIN?!"],
      panic: ["HEY! HANDS OFF!", "PUT ME DOWN, FOOL!", "i will REMEMBER this!", "GRAAAH!"],
      land:  ["...tch.", "don't. do that. again.", "i'm watching you."],
      idle:  ["grr...", "hmph.", "*angry muttering*", "i hate mondays."],
    },

    // Any CSS here is injected once when the character first spawns. Motion
    // classes are named `tx-anim-<name>` and live on the `.tx-motion` element.
    css:
      ".tx-anim-stomp{animation:tx-stomp .32s steps(2,end) infinite;}" +
      "@keyframes tx-stomp{0%{transform:translateY(0) rotate(-3deg)}" +
      "50%{transform:translateY(-2px) rotate(3deg)}100%{transform:translateY(0) rotate(-3deg)}}",
  });
})();
