/* SEM column illustration. All distances on this canvas are schematic. */
const WORLD = { width: 740, height: 700, cx: 331, source: 97, lens: 320, sample: 548 };
const PALETTE = {
  bg: '#101f25', grid: '#19313b', wall: '#1b303c', edge: '#4a6472',
  faint: '#314955', text: '#d7e7ed', muted: '#8098a5', dim: '#57727f',
  beam: '#64efd2', amber: '#ffbb72', electric: '#f39b82', magnetic: '#b0a1ff',
};
const COMPONENTS = {
  gun: { x: 255, y: 59, w: 152, h: 85, label: 'Electron gun', cy: 100, num: '01' },
  anode: { x: 251, y: 148, w: 160, h: 45, label: 'Accelerating anode', cy: 170, num: '02' },
  aperture: { x: 258, y: 221, w: 146, h: 36, label: 'Beam aperture', cy: 239, num: '03' },
  lens: { x: 250, y: 283, w: 162, h: 83, label: 'Magnetic lens', cy: 325, num: '04' },
  scan: { x: 267, y: 386, w: 128, h: 71, label: 'X / Y scan plates', cy: 421, num: '05' },
  specimen: { x: 244, y: 485, w: 193, h: 118, label: 'Specimen chamber', cy: 549, num: '06' },
  detector: { x: 446, y: 477, w: 251, h: 95, label: 'Scintillator + PMT', cy: 517, num: '07' },
  vacuum: { x: 54, y: 562, w: 179, h: 104, label: 'Vacuum system', cy: 610, num: '08' },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function rounded(ctx, x, y, width, height, radius = 5) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function line(ctx, points, color, width = 1, dash = []) {
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke(); ctx.setLineDash([]);
}

function arrow(ctx, x1, y1, x2, y2, color, size = 4, width = 1) {
  line(ctx, [[x1, y1], [x2, y2]], color, width);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(angle - .5) * size, y2 - Math.sin(angle - .5) * size);
  ctx.lineTo(x2 - Math.cos(angle + .5) * size, y2 - Math.sin(angle + .5) * size);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function label(ctx, text, x, y, options = {}) {
  const scale = ctx.semLabelScale || 1;
  if (options.detail && scale < .8) return;
  const baseSize = options.size || 11;
  const minScreenSize = options.minSize ?? (baseSize >= 9.5 ? 10 : 0);
  const size = Math.max(baseSize, minScreenSize / scale);
  ctx.fillStyle = options.color || PALETTE.text;
  ctx.font = `${options.weight || 400} ${size}px ${options.mono ? '"SFMono-Regular", Consolas, monospace' : 'Inter, system-ui, sans-serif'}`;
  ctx.textAlign = options.align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export class ColumnView {
  constructor(canvas, { onSelect = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.onSelect = onSelect;
    this.params = {};
    this.derived = {};
    this.status = { beamOn: false, roughing: false, turbo: false, scanPoint: { x: 0, y: 0, blank: false } };
    this.view = 'column';
    this.selected = '';
    this.hovered = '';
    this.paused = false;
    this.camera = { zoom: 1, x: 0, y: 0 };
    this.target = { ...this.camera };
    this.animationTime = 0;
    this.lastFrame = 0;
    this.fps = 60;
    this.destroyed = false;
    this.drag = null;
    this._events = [];
    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'grab';
    this.canvas.setAttribute('aria-label', 'Interactive electron microscope cutaway. Select a component, drag to pan, or use the zoom buttons.');
    this._bindEvents();
    this.resizeObserver = new ResizeObserver(() => this._resize());
    this.resizeObserver.observe(canvas);
    this._resize();
    this._tick = now => {
      if (this.destroyed) return;
      this.draw(now);
      this.animationId = requestAnimationFrame(this._tick);
    };
    this.animationId = requestAnimationFrame(this._tick);
  }

  update(params = {}, derived = {}, status = {}) {
    this.params = params;
    this.derived = derived;
    this.status = { ...this.status, ...status };
    if (typeof status.selected === 'string') this.selected = status.selected;
  }

  setView(view) {
    if (['column', 'fields', 'trajectory'].includes(view)) this.view = view;
  }

  focus(id) {
    const component = COMPONENTS[id];
    if (!component) return;
    this.selected = id;
    const zoom = id === 'detector' || id === 'vacuum' ? 1.9 : 2.3;
    this.target = {
      zoom,
      x: -(component.x + component.w / 2 - WORLD.width / 2) * this.baseScale * zoom,
      y: -(component.y + component.h / 2 - WORLD.height / 2) * this.baseScale * zoom,
    };
  }

  zoom(factor) {
    const oldZoom = this.target.zoom;
    const zoom = clamp(oldZoom * finite(factor, 1), .65, 4);
    this.target.x *= zoom / oldZoom;
    this.target.y *= zoom / oldZoom;
    this.target.zoom = zoom;
  }

  reset() { this.target = { zoom: 1, x: 0, y: 0 }; }
  pause(value) { this.paused = Boolean(value); }
  getStats() { return { fps: Math.round(this.fps), zoom: Number(this.camera.zoom.toFixed(2)) }; }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    for (const [name, handler, options] of this._events) this.canvas.removeEventListener(name, handler, options);
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width || this.canvas.clientWidth || 650);
    this.height = Math.max(1, rect.height || this.canvas.clientHeight || 600);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    const oldScale = this.baseScale;
    this.baseScale = Math.min(this.width / WORLD.width, this.height / WORLD.height) * .96;
    if (oldScale && oldScale !== this.baseScale) {
      const ratio = this.baseScale / oldScale;
      this.camera.x *= ratio; this.camera.y *= ratio;
      this.target.x *= ratio; this.target.y *= ratio;
    }
  }

  _local(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  _world(point) {
    const scale = this.baseScale * this.camera.zoom;
    return {
      x: (point.x - this.width / 2 - this.camera.x) / scale + WORLD.width / 2,
      y: (point.y - this.height / 2 - this.camera.y) / scale + WORLD.height / 2,
    };
  }

  _hit(point) {
    const p = this._world(point);
    // Small items in front of the chamber win hit testing.
    for (const id of ['detector', 'vacuum', 'gun', 'anode', 'aperture', 'lens', 'scan', 'specimen']) {
      const c = COMPONENTS[id];
      if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) return id;
      if (c.num <= '06' && p.x >= 27 && p.x <= 243 && Math.abs(p.y - c.cy) < 17) return id;
    }
    return '';
  }

  _bindEvents() {
    const listen = (name, handler, options) => {
      this.canvas.addEventListener(name, handler, options);
      this._events.push([name, handler, options]);
    };
    listen('pointerdown', event => {
      if (event.button !== 0) return;
      const p = this._local(event);
      this.drag = { x: p.x, y: p.y, startX: p.x, startY: p.y, moved: false, pointer: event.pointerId };
      this.canvas.setPointerCapture(event.pointerId);
      this.target = { ...this.camera };
      this.canvas.style.cursor = 'grabbing';
    });
    listen('pointermove', event => {
      const p = this._local(event);
      if (this.drag) {
        if (Math.hypot(p.x - this.drag.startX, p.y - this.drag.startY) > 4) this.drag.moved = true;
        this.target.x += p.x - this.drag.x;
        this.target.y += p.y - this.drag.y;
        this.camera.x = this.target.x; this.camera.y = this.target.y;
        this.drag.x = p.x; this.drag.y = p.y;
      } else {
        this.hovered = this._hit(p);
        this.canvas.style.cursor = this.hovered ? 'pointer' : 'grab';
      }
    });
    listen('pointerup', event => {
      const drag = this.drag;
      if (!drag || drag.pointer !== event.pointerId) return;
      this.drag = null;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      if (!drag.moved) {
        const id = this._hit(this._local(event));
        if (id) { this.selected = id; this.onSelect(id); }
      }
      this.canvas.style.cursor = this.hovered ? 'pointer' : 'grab';
    });
    listen('pointercancel', () => { this.drag = null; this.canvas.style.cursor = 'grab'; });
    listen('pointerleave', () => { this.hovered = ''; });
    listen('dblclick', event => {
      const id = this._hit(this._local(event));
      if (id) this.focus(id);
      else this.reset();
    });
    listen('wheel', event => {
      event.preventDefault();
      const p = this._local(event);
      const oldZoom = this.target.zoom;
      const zoom = clamp(oldZoom * Math.exp(-clamp(event.deltaY, -120, 120) * .0035), .65, 4);
      const ratio = zoom / oldZoom;
      this.target.x = p.x - this.width / 2 - (p.x - this.width / 2 - this.target.x) * ratio;
      this.target.y = p.y - this.height / 2 - (p.y - this.height / 2 - this.target.y) * ratio;
      this.target.zoom = zoom;
    }, { passive: false });
  }

  draw(now = performance.now()) {
    const ctx = this.ctx;
    if (!ctx || !this.width || !this.height) return;
    const dt = this.lastFrame ? clamp((now - this.lastFrame) / 1000, 0, .1) : 1 / 60;
    this.lastFrame = now;
    if (dt > .001 && dt < .08) this.fps += (1 / dt - this.fps) * .035;
    if (!this.paused) this.animationTime += dt;
    const smooth = 1 - Math.exp(-dt * 12);
    for (const key of ['zoom', 'x', 'y']) this.camera[key] += (this.target[key] - this.camera[key]) * smooth;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = PALETTE.bg; ctx.fillRect(0, 0, this.width, this.height);
    this._drawGrid();
    ctx.save();
    ctx.semLabelScale = this.baseScale * this.camera.zoom;
    ctx.translate(this.width / 2 + this.camera.x, this.height / 2 + this.camera.y);
    ctx.scale(this.baseScale * this.camera.zoom, this.baseScale * this.camera.zoom);
    ctx.translate(-WORLD.width / 2, -WORLD.height / 2);
    this._drawColumn();
    this._drawHighlight();
    this._drawFields();
    this._drawBeam();
    this._drawLabels();
    ctx.restore();
    // Status, scale disclaimer, legend, and zoom controls belong to the surrounding UI.
  }

  _drawGrid() {
    const ctx = this.ctx;
    ctx.fillStyle = '#17303a';
    const step = 26;
    const ox = ((this.camera.x * .12) % step + step) % step;
    const oy = ((this.camera.y * .12) % step + step) % step;
    for (let x = ox; x < this.width; x += step) {
      for (let y = oy; y < this.height; y += step) ctx.fillRect(x, y, .9, .9);
    }
    const g = ctx.createRadialGradient(this.width * .47, this.height * .44, 0, this.width * .47, this.height * .44, this.width * .65);
    g.addColorStop(0, '#16344230'); g.addColorStop(1, '#07111a00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.width, this.height);
  }

  _rect(x, y, w, h, fill = PALETTE.wall, stroke = PALETTE.edge, radius = 4, width = 1) {
    const ctx = this.ctx;
    rounded(ctx, x, y, w, h, radius);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }

  _flange(y, width = 157, depth = 12) {
    const ctx = this.ctx, cx = WORLD.cx, x = cx - width / 2;
    this._rect(x, y, width, depth, '#233945', '#58717e', 2);
    line(ctx, [[x + 1, y + 3], [x + width - 1, y + 3]], '#7f97a333');
    for (const px of [x + 9, x + 22, x + width - 22, x + width - 9]) {
      ctx.beginPath(); ctx.arc(px, y + depth / 2, 1.75, 0, Math.PI * 2);
      ctx.fillStyle = '#0b1922'; ctx.fill();
      ctx.strokeStyle = '#6d8792'; ctx.lineWidth = .7; ctx.stroke();
    }
    // A narrow opening exposes the optical axis through each flange.
    ctx.fillStyle = '#0c1a23'; ctx.fillRect(cx - 22, y - 1, 44, depth + 2);
    line(ctx, [[cx - 22, y], [cx - 22, y + depth]], '#3e5662');
    line(ctx, [[cx + 22, y], [cx + 22, y + depth]], '#3e5662');
  }

  _drawColumn() {
    const ctx = this.ctx, cx = WORLD.cx;
    ctx.save();
    if (this.view === 'trajectory') ctx.globalAlpha = .48;
    // Optical axis and the transparent central vacuum bore.
    this._rect(278, 75, 106, 434, '#0d1d2700', '#2a4453', 9);
    const bore = ctx.createLinearGradient(281, 0, 381, 0);
    bore.addColorStop(0, '#20394477'); bore.addColorStop(.26, '#13273122'); bore.addColorStop(.7, '#14283222'); bore.addColorStop(1, '#223b4877');
    this._rect(281, 83, 100, 418, bore, null, 5);
    line(ctx, [[cx, 40], [cx, 590]], '#5f84912d', .9, [3, 5]);
    // Housing sections leave the interior visible.
    this._rect(272, 87, 20, 380, '#20333f', '#3d5665', 3);
    this._rect(370, 87, 20, 380, '#1a2b36', '#3d5665', 3);
    line(ctx, [[276, 95], [276, 459]], '#738b9533', 2);
    line(ctx, [[386, 95], [386, 459]], '#06121b', 2);

    // Vacuum flange and high-voltage ceramic feedthrough at the source.
    this._rect(308, 49, 46, 18, '#2b393c', '#8e9a93', 3);
    for (let y = 53; y < 65; y += 4) line(ctx, [[309, y], [353, y]], '#73847b', 1);
    line(ctx, [[319, 49], [319, 37], [342, 37], [342, 49]], '#bdac8c', 2);
    this._flange(69, 143, 12);
    this._rect(304, 83, 8, 28, '#384247', '#747e7b', 1);
    this._rect(350, 83, 8, 28, '#384247', '#747e7b', 1);
    line(ctx, [[308, 85], [308, 98], [317, 98], [326, 106], [331, 94], [336, 106], [345, 98], [354, 98], [354, 85]], '#927050', 2.8);
    const temperature = finite(this.derived.temperature, 300);
    const heat = clamp((temperature - 600) / 1900, 0, 1);
    if (heat > 0) {
      ctx.shadowColor = PALETTE.amber; ctx.shadowBlur = heat * 15;
      line(ctx, [[317, 98], [326, 106], [331, 94], [336, 106], [345, 98]], `rgba(255, ${Math.round(110 + heat * 85)}, ${Math.round(58 + heat * 75)}, ${.3 + heat * .7})`, 2.8);
      ctx.shadowBlur = 0;
    }
    // Wehnelt cup / electron extraction opening.
    line(ctx, [[304, 111], [309, 132], [322, 136]], '#8a938f', 3);
    line(ctx, [[358, 111], [353, 132], [340, 136]], '#8a938f', 3);
    label(ctx, 'W', 387, 103, { color: PALETTE.amber, size: 9, mono: true });
    this._flange(150, 160, 11);
    this._rect(290, 170, 31, 9, '#7e8888', '#b0b4a6', 1);
    this._rect(341, 170, 31, 9, '#7e8888', '#b0b4a6', 1);
    line(ctx, [[cx - 7, 170], [cx + 7, 170]], '#8dcfca33', .7, [2, 3]);

    // Adjustable beam aperture, with a deliberately enlarged opening.
    this._flange(219, 147, 10);
    const hole = clamp(Math.sqrt(Math.max(1, finite(this.params.aperture, 100))) * .61, 3, 17);
    this._rect(287, 238, cx - hole - 287, 6, '#839093', '#b2b9ad', .5);
    this._rect(cx + hole, 238, 375 - cx - hole, 6, '#839093', '#b2b9ad', .5);
    line(ctx, [[392, 238], [411, 238]], '#667d88', 2);
    this._rect(408, 232, 6, 15, '#304752', '#73909c', 1);

    // Two copper windings around a ferromagnetic magnetic-lens pole piece.
    this._rect(262, 282, 48, 78, '#283640', '#5a7079', 3);
    this._rect(352, 282, 48, 78, '#283640', '#5a7079', 3);
    for (let y = 291; y <= 345; y += 7) {
      this._rect(267, y, 35, 4, '#86674f', '#b58a66', 1, .7);
      this._rect(360, y, 35, 4, '#796049', '#a88261', 1, .7);
    }
    line(ctx, [[309, 284], [313, 311], [318, 317]], '#96a4a3', 2.4);
    line(ctx, [[353, 284], [349, 311], [344, 317]], '#96a4a3', 2.4);
    line(ctx, [[309, 359], [313, 332], [318, 326]], '#96a4a3', 2.4);
    line(ctx, [[353, 359], [349, 332], [344, 326]], '#96a4a3', 2.4);
    this._flange(364, 162, 10);

    // Orthogonal pairs of electrostatic scan electrodes.
    this._rect(299, 391, 7, 48, '#805356', '#d68c87', 2);
    this._rect(356, 391, 7, 48, '#385f72', '#70a5c1', 2);
    this._rect(309, 440, 44, 5, '#624d57', '#b38498', 1);
    this._rect(309, 455, 44, 5, '#345966', '#6c99b0', 1);
    line(ctx, [[295, 409], [280, 409]], '#ba7d79', 1);
    line(ctx, [[366, 419], [382, 419]], '#6b98b0', 1);
    const scanV = finite(this.params.plateVoltage, 0) + finite(this.status.scanPoint?.x, 0) * finite(this.params.scanAmplitude, 20);
    label(ctx, scanV >= 0 ? '−' : '+', 297, 385, { color: '#c6a6af', size: 11 });
    label(ctx, scanV >= 0 ? '+' : '−', 357, 385, { color: '#a8bdcd', size: 11 });
    this._flange(471, 159, 12);

    // Specimen chamber cutaway, base, tilt stage and sample.
    const chamberGradient = ctx.createLinearGradient(239, 0, 437, 0);
    chamberGradient.addColorStop(0, '#203946'); chamberGradient.addColorStop(.12, '#102630'); chamberGradient.addColorStop(.74, '#10232d'); chamberGradient.addColorStop(1, '#263b48');
    this._rect(242, 483, 192, 122, chamberGradient, '#526f7f', 17);
    line(ctx, [[252, 493], [252, 588], [266, 596], [420, 596]], '#91a7ad24', 1);
    ctx.beginPath(); ctx.ellipse(338, 599, 90, 11, 0, 0, Math.PI * 2); ctx.fillStyle = '#233b47'; ctx.fill(); ctx.strokeStyle = '#587383'; ctx.lineWidth = 1; ctx.stroke();
    this._rect(319, 561, 26, 30, '#344d58', '#5d7885', 3);
    this._rect(289, 581, 91, 9, '#2c4654', '#607b88', 2);
    this._rect(299, 590, 73, 8, '#243d48', '#4d6571', 2);
    line(ctx, [[280, 601], [280, 615]], '#69808a', 3);
    line(ctx, [[397, 601], [397, 615]], '#69808a', 3);
    ctx.save(); ctx.translate(331, 548); ctx.rotate(-.17);
    ctx.beginPath(); ctx.ellipse(0, 5, 50, 17, 0, 0, Math.PI * 2); ctx.fillStyle = '#344a51'; ctx.fill(); ctx.strokeStyle = '#8c9b99'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 50, 17, 0, 0, Math.PI * 2); ctx.fillStyle = '#778f90'; ctx.fill(); ctx.strokeStyle = '#c0c8b6'; ctx.stroke();
    this._rect(-24, -10, 48, 16, '#adb69d', '#d4d9b9', 1);
    // Fine etched specimen pattern gives the beam a visible target.
    for (let x = -19; x <= 17; x += 7) line(ctx, [[x, -7], [x + 2, 3]], '#6e8775', .7);
    for (let y = -5; y <= 2; y += 4) line(ctx, [[-19, y], [21, y]], '#6e877555', .5);
    ctx.restore();

    this._drawDetector();
    this._drawPumps();
    ctx.restore();
  }

  _drawDetector() {
    const ctx = this.ctx;
    const compact = ctx.semLabelScale < .6;
    // Collector cage faces the specimen inside the chamber; light guide exits through a port.
    line(ctx, [[388, 529], [414, 510], [445, 510]], '#38545f', 16);
    line(ctx, [[388, 529], [414, 510], [448, 510]], '#879587', 1);
    ctx.save(); ctx.translate(392, 525); ctx.rotate(-.59);
    this._rect(-7, -15, 13, 30, '#63796755', '#c6d6a4', 2);
    for (let y = -12; y <= 12; y += 6) line(ctx, [[-7, y], [6, y]], '#a6c58f', .6);
    this._rect(7, -12, 5, 24, '#b2d991', '#deefb6', 1);
    ctx.restore();
    this._rect(430, 493, 12, 36, '#314852', '#69828f', 2);
    this._rect(444, 501, 53, 20, '#284939', '#638c6b', 3);
    line(ctx, [[450, 505], [491, 505]], '#bdd99455', 1);
    this._rect(498, 490, 143, 42, '#1e323e', '#708a96', 7);
    this._rect(502, 494, 12, 34, '#4a6571', '#a1b3b8', 2);
    // Dynode chain is exposed in a small PMT cutaway.
    for (let i = 0; i < 7; i++) {
      const x = 524 + i * 14, y = i % 2 === 0 ? 503 : 520;
      line(ctx, [[x - 4, y], [x + 4, y - 4]], '#9cabc0', 2);
      if (i < 6) line(ctx, [[x + 3, y - 2], [x + 10, i % 2 === 0 ? 519 : 503]], '#91cce13b', .75, [2, 2]);
    }
    line(ctx, [[642, 511], [667, 511], [667, 530]], '#8095a4', 2);
    this._rect(658, 532, 19, 12, '#243c4a', '#66858f', 2);
    if (!compact) {
      label(ctx, `Cage +${Math.round(finite(this.params.collectionBias, 250))} V`, 427, 551, { color: '#aabfc2', size: 9.5, align: 'center' });
      label(ctx, 'Light guide', 475, 481, { color: PALETTE.muted, size: 9, minSize: 9, align: 'center' });
      label(ctx, `PMT ${Math.round(finite(this.params.pmtVoltage, 800))} V`, 582, 551, { color: '#aabfc2', size: 9.5, align: 'center' });
      label(ctx, 'Scintillator +10 kV', 459, 574, { color: '#b4cfa2', size: 10 });
      label(ctx, 'Representative fixed supply', 459, 590, { color: PALETTE.dim, size: 9, detail: true });
    }
    if (this.status.beamOn && !this.status.scanPoint?.blank) {
      const phase = this.animationTime;
      for (let i = 0; i < 4; i++) {
        const t = (phase * 1.3 + i / 4) % 1;
        ctx.beginPath(); ctx.arc(406 + t * 91, 511 + (1 - t) * 6, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#d3efb2'; ctx.fill();
      }
      const pulse = .35 + Math.sin(phase * 8) * .1;
      ctx.beginPath(); ctx.arc(394, 523, 4, 0, Math.PI * 2); ctx.fillStyle = `rgba(202, 238, 155, ${pulse})`; ctx.fill();
    }
  }

  _drawPumps() {
    const ctx = this.ctx;
    const compact = ctx.semLabelScale < .6;
    line(ctx, [[243, 576], [206, 576], [206, 588]], '#526c78', 14);
    line(ctx, [[243, 576], [206, 576], [206, 588]], '#1f3946', 10);
    this._rect(229, 567, 8, 18, '#2a4552', '#75929f', 1);
    // Turbo pump with alternating stator / rotor blades.
    this._rect(184, 589, 44, 49, '#294250', '#688592', 5);
    ctx.beginPath(); ctx.ellipse(206, 589, 22, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#385666'; ctx.fill(); ctx.strokeStyle = '#8ba1ac'; ctx.stroke();
    this._rect(190, 595, 32, 35, '#102732', '#466674', 1);
    const rotor = this.status.turbo ? this.animationTime * 20 : 0;
    for (let i = 0; i < 5; i++) {
      const y = 600 + i * 6;
      const skew = this.status.turbo ? Math.sin(rotor + i * .3) * 3 : 3;
      line(ctx, [[193, y - skew], [219, y + skew]], this.status.turbo ? '#80bebc' : '#668991', 1.7);
    }
    line(ctx, [[184, 620], [154, 620], [154, 616], [138, 616]], '#49636f', 9);
    line(ctx, [[184, 620], [154, 620], [154, 616], [138, 616]], '#193541', 5);
    // Compact rotary backing pump, motor fins and exhaust.
    this._rect(69, 598, 42, 36, '#314958', '#6c8996', 6);
    this._rect(109, 603, 29, 29, '#233c49', '#66828e', 4);
    this._rect(62, 633, 83, 6, '#29414e', '#59727e', 1);
    for (let x = 75; x <= 103; x += 5) line(ctx, [[x, 604], [x, 628]], '#738c963f', 1);
    line(ctx, [[122, 602], [122, 590], [111, 590]], '#6c8390', 4);
    ctx.beginPath(); ctx.arc(94, 614, 2.2, 0, Math.PI * 2); ctx.fillStyle = this.status.roughing ? PALETTE.beam : '#65747e'; ctx.fill();
    if (compact) {
      label(ctx, 'Pumps', 85, 579, { size: 11, color: '#a9bec9' });
    } else {
      label(ctx, 'Backing pump', 104, 652, { size: 9.5, color: this.status.roughing ? '#b5ccd0' : PALETTE.dim, align: 'center' });
      label(ctx, 'Turbo', 207, 652, { size: 9.5, color: this.status.turbo ? '#b5ccd0' : PALETTE.dim, align: 'center' });
      label(ctx, '08', 60, 579, { size: 10, mono: true, color: PALETTE.dim });
      label(ctx, 'Vacuum system', 85, 579, { size: 11, color: PALETTE.muted });
    }
    if (this.status.roughing || this.status.turbo) {
      for (let i = 0; i < 3; i++) {
        const t = (this.animationTime * .6 + i / 3) % 1;
        ctx.beginPath(); ctx.arc(242 - t * 34, 576, 1.4, 0, Math.PI * 2); ctx.fillStyle = '#85a5b4'; ctx.fill();
      }
    }
  }

  _drawHighlight() {
    const ctx = this.ctx;
    for (const id of [this.hovered, this.selected]) {
      const c = COMPONENTS[id];
      if (!c) continue;
      const active = id === this.selected;
      rounded(ctx, c.x - 6, c.y - 6, c.w + 12, c.h + 12, 9);
      ctx.fillStyle = active ? '#64efd207' : '#ffffff04'; ctx.fill();
      ctx.strokeStyle = active ? '#64efd276' : '#809eac66'; ctx.lineWidth = 1;
      ctx.setLineDash(active ? [] : [3, 4]); ctx.stroke(); ctx.setLineDash([]);
      const x = c.x - 6, y = c.y - 6, w = c.w + 12, h = c.h + 12;
      const color = active ? '#83e0cf' : '#7c9ba8';
      for (const [xx, yy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
        line(ctx, [[xx + sx * 10, yy], [xx, yy], [xx, yy + sy * 10]], color, 1.4);
      }
    }
  }

  _drawFields() {
    if (this.view !== 'fields') return;
    const ctx = this.ctx, cx = WORLD.cx;
    const compact = ctx.semLabelScale < .6;
    const signedCurrent = finite(this.params.lensCurrent, .45);
    const lensCurrent = Math.abs(signedCurrent);
    const lensStrength = lensCurrent < 1e-7 ? 0 : clamp(lensCurrent / .8, .12, .95);
    ctx.save();
    ctx.globalAlpha = lensStrength;
    // Closed axial magnetic field loops generated by the lens coil.
    for (let i = 0; i < 4; i++) {
      const spread = 11 + i * 13;
      const tall = 36 + i * 7;
      ctx.beginPath();
      ctx.ellipse(cx, 322, spread, tall, 0, 0, Math.PI * 2);
      ctx.strokeStyle = PALETTE.magnetic; ctx.lineWidth = i === 0 ? 1.5 : .85; ctx.stroke();
      arrow(ctx, cx + spread, 323, cx + spread - .5, signedCurrent >= 0 ? 314 : 332, PALETTE.magnetic, 3.5, .9);
    }
    arrow(ctx, cx, signedCurrent >= 0 ? 306 : 337, cx, signedCurrent >= 0 ? 337 : 306, PALETTE.magnetic, 5, 1.4);
    ctx.restore();
    label(ctx, 'B', compact ? 429 : 419, 306, { color: PALETTE.magnetic, size: 12, weight: 600, mono: true });
    if (!compact) label(ctx, `${finite(this.derived.magneticField, 0).toFixed(1)} mT`, 435, 306, { color: PALETTE.magnetic, size: 10, mono: true });
    label(ctx, 'lens coil', 419, 323, { color: PALETTE.muted, size: 9, detail: true });
    // Transverse electric field between the electrodes (not a magnetic field).
    const point = this.status.scanPoint || {};
    const scanVoltage = finite(this.params.plateVoltage, 0) + finite(point.x, 0) * finite(this.params.scanAmplitude, 20);
    const direction = scanVoltage < 0 ? -1 : 1;
    const hasE = Math.abs(scanVoltage) > .001;
    ctx.save(); ctx.globalAlpha = hasE ? .82 : .22;
    for (let y = 400; y <= 433; y += 11) {
      arrow(ctx, direction > 0 ? 348 : 314, y, direction > 0 ? 314 : 348, y, PALETTE.electric, 4, 1);
    }
    for (const y of [394, 440]) {
      ctx.beginPath(); ctx.moveTo(350, y); ctx.quadraticCurveTo(cx, y + (y < 410 ? -8 : 8), 311, y);
      ctx.strokeStyle = PALETTE.electric; ctx.lineWidth = .8; ctx.stroke();
    }
    ctx.restore();
    label(ctx, 'E', compact ? 429 : 419, 407, { color: PALETTE.electric, size: 12, weight: 600, mono: true });
    if (!compact) label(ctx, `${(scanVoltage / Math.max(.001, finite(this.params.plateGap, 10) / 1000) / 1000).toFixed(2)} kV/m`, 435, 407, { color: PALETTE.electric, size: 10, mono: true });
    label(ctx, 'scan plates', 419, 424, { color: PALETTE.muted, size: 9, detail: true });
  }

  _beamGeometry(ray = 0) {
    const cx = WORLD.cx, p = this.params, d = this.derived;
    const point = this.status.scanPoint || {};
    const radius = clamp(Math.sqrt(Math.max(1, finite(p.aperture, 100))) * .34, 2, 12);
    const lensRadius = radius * 1.4;
    const workingDistance = Math.max(1, finite(d.lensDriftDistance,
      finite(p.plateLength, 20) + finite(p.workingDistance, 15)));
    // Match the physical model's solenoid transfer matrix when available. In particular,
    // a solenoid's back focal distance differs from its effective focal length.
    const phase = finite(d.lensPhase, 0);
    const cosPhase = Number.isFinite(d.lensPhase) ? Math.cos(phase) : 1;
    const kappa = Math.max(0, finite(d.kappa, 0));
    const focalRatio = Number.isFinite(d.kappa)
      ? workingDistance * .001 * kappa * Math.sin(phase)
      : (Number.isFinite(d.backFocalLength) && d.backFocalLength !== 0 ? workingDistance / d.backFocalLength : 0);
    const spreadFactor = clamp(cosPhase - focalRatio, -3.5, 3.5);
    const specimenSpread = lensRadius * spreadFactor * ray;
    const staticDeflection = finite(d.deflection, 0);
    // Diagram displacement is deliberately enlarged for inspection. Scan point is normalized ±1.
    const scanHalfWidth = Math.max(0, finite(d.scanFieldWidth, .334)) / 2;
    const scanX = clamp(finite(point.x, 0), -1, 1) * clamp(scanHalfWidth * 54, 0, 30);
    const scanY = clamp(finite(point.y, 0), -1, 1) * clamp(scanHalfWidth * 17, 0, 10);
    const deflection = clamp(staticDeflection * 54 + scanX, -58, 58);
    const points = [
      [cx + ray * 1.1, 108],
      [cx + ray * radius * .8, 173],
      [cx + ray * radius, 238],
      [cx + ray * lensRadius, 287],
      [cx + ray * lensRadius * cosPhase, 321],
    ];
    // The transverse trajectory is parabolic inside the ideal plates, then straight
    // in the drift region. The drawing expands the hardware for inspection.
    const plateLength = Math.max(.001, finite(p.plateLength, 20));
    const postPlateDrift = Math.max(0, finite(p.workingDistance, 15));
    const exitFraction = plateLength / (2 * postPlateDrift + plateLength);
    for (const y of [389, 407, 425, 443, 461]) {
      const fraction = clamp((y - 389) / 72, 0, 1);
      const zFraction = (y - 321) / (WORLD.sample - 321);
      const transverse = fraction ** 2 * exitFraction;
      points.push([
        cx + ray * lensRadius * (cosPhase - focalRatio * zFraction) + deflection * transverse,
        y + (scanY - deflection * .17) * transverse,
      ]);
    }
    points.push([cx + specimenSpread + deflection, WORLD.sample + scanY - deflection * .17]);
    return points;
  }

  _pointAlong(points, fraction) {
    // Monotonic z progression avoids an allocation-heavy path-length calculation per particle.
    const y = points[0][1] + fraction * (points[points.length - 1][1] - points[0][1]);
    for (let i = 1; i < points.length; i++) {
      if (y <= points[i][1]) {
        const a = points[i - 1], b = points[i];
        const t = clamp((y - a[1]) / (b[1] - a[1]), 0, 1);
        return [a[0] + (b[0] - a[0]) * t, y];
      }
    }
    return points[points.length - 1];
  }

  _drawBeam() {
    const ctx = this.ctx;
    if (!this.status.beamOn) {
      line(ctx, [[WORLD.cx, 182], [WORLD.cx, 528]], '#49697755', .8, [3, 6]);
      return;
    }
    const blank = Boolean(this.status.scanPoint?.blank);
    const center = this._beamGeometry(0);
    const outerL = this._beamGeometry(-1), outerR = this._beamGeometry(1);
    ctx.save();
    if (blank) ctx.globalAlpha = .15;
    ctx.beginPath();
    outerL.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    outerR.slice().reverse().forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, 108, 0, 560);
    fill.addColorStop(0, '#64efd21c'); fill.addColorStop(.3, '#64efd20b'); fill.addColorStop(.7, '#64efd222'); fill.addColorStop(1, '#64efd210');
    ctx.fillStyle = fill; ctx.fill();
    const rayCount = this.view === 'trajectory' ? 9 : 5;
    const rays = [];
    for (let i = 0; i < rayCount; i++) {
      const ray = this._beamGeometry((i / (rayCount - 1) - .5) * 2);
      rays.push(ray);
      line(ctx, ray, this.view === 'trajectory' ? '#64efd281' : '#64efd234', this.view === 'trajectory' ? .9 : .6);
    }
    ctx.shadowColor = PALETTE.beam; ctx.shadowBlur = 10;
    line(ctx, center, '#72f6dcaa', 1.1);
    ctx.shadowBlur = 0;
    const speedFactor = clamp(finite(this.derived.speed, 3.25e7) / 3.25e7, .3, 2.2);
    const particleCount = 43;
    if (!blank) {
      for (let i = 0; i < particleCount; i++) {
        const fraction = (this.animationTime * .53 * speedFactor + i * .618033989) % 1;
        const ray = rays[i % rays.length];
        const [x, y] = this._pointAlong(ray, fraction);
        const [tailX, tailY] = this._pointAlong(ray, Math.max(0, fraction - .010));
        line(ctx, [[tailX, tailY], [x, y]], '#8cfce4b3', i % 5 ? 1.1 : 1.5);
        ctx.beginPath(); ctx.arc(x, y, i % 5 ? 1.1 : 1.65, 0, Math.PI * 2);
        ctx.fillStyle = i % 5 ? PALETTE.beam : '#c3fff0'; ctx.fill();
      }
      const hit = center[center.length - 1];
      const spot = ctx.createRadialGradient(hit[0], hit[1], 0, hit[0], hit[1], 12);
      spot.addColorStop(0, '#cefff4c7'); spot.addColorStop(.15, '#86f3cf70'); spot.addColorStop(1, '#63f0ce00');
      ctx.fillStyle = spot; ctx.fillRect(hit[0] - 12, hit[1] - 12, 24, 24);
      ctx.beginPath(); ctx.ellipse(hit[0], hit[1], 2.3, 1.3, -.17, 0, Math.PI * 2); ctx.fillStyle = '#e2fff1'; ctx.fill();
      // Representative low-energy secondaries collected by the side detector.
      for (let i = 0; i < 4; i++) {
        const phase = (this.animationTime * .8 + i * .25) % 1;
        const x = hit[0] + (393 - hit[0]) * phase;
        const y = hit[1] + (523 - hit[1]) * phase - Math.sin(phase * Math.PI) * (10 + i * 5);
        ctx.beginPath(); ctx.arc(x, y, 1.25, 0, Math.PI * 2); ctx.fillStyle = '#d1e6a7'; ctx.fill();
      }
    }
    if (this.view === 'trajectory') {
      arrow(ctx, 352, 192, 352, 212, PALETTE.beam, 4, 1);
      label(ctx, 'e⁻', 360, 202, { color: PALETTE.beam, size: 11, mono: true });
      const end = center[center.length - 1];
      line(ctx, [[end[0], end[1] + 21], [end[0], 577], [415, 577]], '#71cebd66', .8, [2, 3]);
      label(ctx, 'BEAM–SAMPLE INTERACTION', 445, 613, { color: PALETTE.muted, size: 8.5, mono: true, detail: true });
      label(ctx, 'Primary e⁻ → secondary e⁻ → light', 445, 632, { color: '#a8c3c9', size: 9, detail: true });
    }
    ctx.restore();
  }

  _drawLabels() {
    const ctx = this.ctx;
    const compact = ctx.semLabelScale < .6;
    for (const [id, c] of Object.entries(COMPONENTS)) {
      if (c.num > '06') continue;
      const active = this.selected === id || this.hovered === id;
      const textColor = active ? '#defff6' : '#a9bec9';
      const leaderStart = 211, end = c.x - 10;
      if (!compact) label(ctx, c.num, 29, c.cy, { size: 9.5, mono: true, color: active ? PALETTE.beam : '#466674' });
      const compactNames = {gun: 'Gun', anode: 'Anode', aperture: 'Aperture', lens: 'Lens', scan: 'Scan plates', specimen: 'Specimen'};
      const name = compact ? compactNames[id] : c.label;
      label(ctx, name, 55, c.cy, { size: 11, color: textColor, weight: active ? 500 : 400 });
      line(ctx, [[leaderStart, c.cy], [end, c.cy]], active ? '#64efd275' : '#46667466', .8);
      ctx.beginPath(); ctx.arc(end, c.cy, 1.6, 0, Math.PI * 2); ctx.fillStyle = active ? PALETTE.beam : '#5b7a89'; ctx.fill();
    }
    const selectedDetector = this.selected === 'detector' || this.hovered === 'detector';
    if (!compact) label(ctx, '07', 501, 462, { size: 9.5, mono: true, color: selectedDetector ? PALETTE.beam : '#466674' });
    label(ctx, compact ? 'Detector' : 'Detection chain', compact ? 517 : 527, 462, { size: 11, color: selectedDetector ? '#defff6' : '#a9bec9' });
    line(ctx, [[568, 473], [568, 482]], '#46667488', .8);
    if (this.view === 'column' && !compact) {
      const emitterTemperature = finite(this.derived.temperature, 300);
      label(ctx, `${Math.round(emitterTemperature).toLocaleString()} K`, 426, 96, { size: 10, mono: true, color: emitterTemperature > 1200 ? PALETTE.amber : PALETTE.muted });
      label(ctx, `Cathode −${finite(this.params.voltage, 3).toFixed(1)} kV`, 426, 120, { size: 9.5, color: PALETTE.muted });
      label(ctx, '0 V · ground', 426, 169, { size: 10, mono: true, color: '#afc5d1' });
      label(ctx, `${finite(this.params.aperture, 100).toFixed(0)} µm`, 426, 240, { size: 10, mono: true, color: '#afc5d1' });
      label(ctx, `${finite(this.params.lensCurrent, .45).toFixed(2)} A`, 426, 325, { size: 10, mono: true, color: PALETTE.magnetic });
      label(ctx, 'lens excitation', 426, 341, { size: 9, color: PALETTE.dim, detail: true });
      const scan = this.status.scanPoint || {};
      const vx = finite(this.params.plateVoltage, 0) + finite(scan.x, 0) * finite(this.params.scanAmplitude, 20);
      label(ctx, `${vx >= 0 ? '+' : ''}${vx.toFixed(1)} V`, 426, 419, { size: 10, mono: true, color: '#b7c3ce' });
      label(ctx, 'electrostatic deflection', 426, 435, { size: 9, color: PALETTE.dim, detail: true });
    }
    if (compact) return;
    // A local schematic scale marker conveys orientation without claiming metric scale.
    line(ctx, [[657, 612], [657, 640], [683, 640]], '#527280', 1);
    arrow(ctx, 657, 640, 657, 610, '#527280', 4, 1);
    arrow(ctx, 657, 640, 686, 640, '#527280', 4, 1);
    label(ctx, 'z', 657, 600, { color: PALETTE.dim, size: 10, mono: true, align: 'center' });
    label(ctx, 'x', 696, 640, { color: PALETTE.dim, size: 10, mono: true });
  }

  _drawHud() {
    const ctx = this.ctx;
    // Screen-space text stays readable when the assembly is magnified.
    const small = this.width < 480;
    label(ctx, this.view === 'fields' ? 'FIELD OVERLAY' : this.view === 'trajectory' ? 'ELECTRON OPTICS' : 'COLUMN CUTAWAY', 20, 22, { size: 8.5, mono: true, color: '#718c99', weight: 500 });
    label(ctx, 'SCHEMATIC · NOT TO SCALE', this.width - 18, 22, { size: small ? 7 : 8, mono: true, color: '#526e7c', align: 'right' });
    const y = this.height - 20;
    ctx.beginPath(); ctx.arc(22, y, 2.7, 0, Math.PI * 2); ctx.fillStyle = PALETTE.beam; ctx.fill();
    label(ctx, 'Primary e⁻', 31, y, { size: 9, color: '#8fa9b6' });
    ctx.beginPath(); ctx.arc(114, y, 2.7, 0, Math.PI * 2); ctx.fillStyle = '#d1e6a7'; ctx.fill();
    label(ctx, 'Secondary e⁻ / light', 123, y, { size: 9, color: '#8fa9b6' });
    if (!small) label(ctx, this.paused ? 'ANIMATION PAUSED' : 'MOTION SLOWED FOR VISIBILITY', this.width - 18, y, { size: 7.5, mono: true, color: '#526e7c', align: 'right' });
  }
}

export default ColumnView;
