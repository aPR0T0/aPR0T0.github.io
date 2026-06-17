/* =====================================================================
   nameSlot.js — toss-&-catch "juggle" name reveal.
   Each letter is tossed up from below, arcs with a slight spin, and is
   "caught" into place (overshoot + squash) left -> right. Words are kept
   intact (wrap at spaces only) so the name reflows cleanly on phones.
   Shared by the desktop HTML hero name and the mobile CSS landing name.
   Pure DOM + CSS classes (.juggle / .word / .ch / .toss / .lock) — no deps.
   ===================================================================== */

/* Split each line (.nl) of `root` into per-word groups of per-character
   cells. Returns the flat list of .ch cells; safe to call once (guarded
   via dataset). dataset.name on each .nl preserves the real text for a11y. */
export function buildSlots(root) {
  if (!root || root.dataset.slotBuilt) return [];
  const lines = root.querySelectorAll('.nl');
  if (!lines.length) return [];
  root.classList.add('juggle');
  const cells = [];
  lines.forEach((line) => {
    const text = (line.dataset.name || line.textContent || '').replace(/\u00a0/g, ' ').trim();
    if (!line.dataset.name) line.dataset.name = text;   // keep accessible label
    line.textContent = '';
    const words = text.split(/\s+/);
    words.forEach((word, wi) => {
      const w = document.createElement('span');
      w.className = 'word';
      for (const chr of word) {
        const ch = document.createElement('span');
        ch.className = 'ch';
        ch.textContent = chr;
        w.appendChild(ch);
        cells.push(ch);
      }
      line.appendChild(w);
      if (wi < words.length - 1) line.appendChild(document.createTextNode(' ')); // breakable gap
    });
  });
  root.dataset.slotBuilt = '1';
  return cells;
}

/* Animate the built cells. With reduced motion, snap straight to placed. */
export function runSlots(cells, { reduced = false } = {}) {
  if (!cells || !cells.length) return;
  if (reduced) { cells.forEach((c) => c.classList.add('lock')); return; }
  const STAGGER = 64;                 // ms between consecutive letter tosses
  cells.forEach((c, i) => {
    c.style.animationDelay = (i * STAGGER) + 'ms';
    c.classList.add('toss');
  });
}

/* Convenience: build + run in one shot. */
export function slotReveal(root, opts) {
  return runSlots(buildSlots(root), opts);
}

/* Friendlier aliases (the effect is a juggle now, not a slot machine). */
export const buildJuggle = buildSlots;
export const runJuggle = runSlots;
export const juggleReveal = slotReveal;
