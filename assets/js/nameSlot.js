/* =====================================================================
   nameSlot.js — slot-machine "juggle" name reveal.
   Each character spins through random glyphs, then locks left -> right.
   Shared by the desktop HTML hero name and the mobile CSS landing name.
   Pure DOM + CSS classes (.juggle / .ch / .spin / .lock) — no deps.
   ===================================================================== */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%*<>/';
const rndGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

/* Split each line (.nl) of `root` into per-character cells. Width is reserved
   by a hidden final glyph (.cf) while a spinning overlay (.cs) animates on top.
   Returns the list of cells; safe to call once (guarded via dataset). */
export function buildSlots(root) {
  if (!root || root.dataset.slotBuilt) return [];
  const lines = root.querySelectorAll('.nl');
  if (!lines.length) return [];
  root.classList.add('juggle');
  const cells = [];
  lines.forEach((line) => {
    const text = (line.dataset.name || line.textContent || '').replace(/\u00a0/g, ' ');
    line.textContent = '';
    for (const chr of text) {
      const ch = document.createElement('span');
      ch.className = 'ch';
      if (chr === ' ') {
        ch.classList.add('space');
        ch.innerHTML = '&nbsp;';
        line.appendChild(ch);
        continue;
      }
      const cf = document.createElement('span'); cf.className = 'cf'; cf.textContent = chr;      // width sizer + final glyph
      const cs = document.createElement('span'); cs.className = 'cs'; cs.textContent = rndGlyph(); // spinning overlay
      ch.append(cf, cs);
      line.appendChild(ch);
      cells.push({ ch, cs });
    }
  });
  root.dataset.slotBuilt = '1';
  return cells;
}

/* Animate the built cells. With reduced motion, snap straight to locked. */
export function runSlots(cells, { reduced = false } = {}) {
  if (!cells || !cells.length) return;
  if (reduced) { cells.forEach((c) => c.ch.classList.add('lock')); return; }
  const START = 140, STAGGER = 90, STEP = 55;
  cells.forEach((c, i) => {
    c.ch.classList.add('spin');
    const iv = setInterval(() => { c.cs.textContent = rndGlyph(); }, STEP);
    setTimeout(() => {
      clearInterval(iv);
      c.ch.classList.remove('spin');
      c.ch.classList.add('lock');
    }, START + i * STAGGER + 360);
  });
}

/* Convenience: build + run in one shot. */
export function slotReveal(root, opts) {
  return runSlots(buildSlots(root), opts);
}
