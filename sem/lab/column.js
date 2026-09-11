/* SEM column illustration. All distances on this canvas are schematic. */
import { FIELD_SCALES, fieldColor, apertureVisualRadius } from './field-colors.js';
import { calculateElectrical } from './electrical.js';
export { FIELD_SCALES, fieldColor } from './field-colors.js';
export const GUN_FIELD_MAX_KVM = 500;
const WORLD = { width: 740, height: 700, cx: 331, source: 97, lens: 320, sample: 548 };
const BSE_VACUUM = { wallX: 488, signalY: 521, biasY: 565, readoutShift: 42 };
const PALETTE = {
  bg: '#0b1722', grid: '#19313b', wall: '#253e4d', edge: '#78909d',
  faint: '#314955', text: '#d7e7ed', muted: '#8098a5', dim: '#57727f',
  beam: '#70f9ef', amber: '#ffbb72', electric: '#49cde2', magnetic: '#4ecfce',
  secondary: '#ffcf6f', bse: '#ffc66d', photon: '#d4adff',
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
    this.layers = { electrons: true, magnetic: true, electric: true, connections: true };
    this.beamDrawCount = 0;
    this.fieldDrawStats = { gunFieldLineCount: 0, apertureFieldLineCount: 0 };
    this._magneticLoops = this._makeMagneticLoops();
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

  setLayers(layers = {}) {
    for (const key of ['electrons', 'magnetic', 'electric', 'connections']) {
      if (typeof layers[key] === 'boolean') this.layers[key] = layers[key];
    }
  }

  _bseGeometry() {
    const distance=Math.max(.1,finite(this.params.detectorDistance,5));
    const offset=Math.max(0,finite(this.params.detectorOffset,0)),side=offset>0;
    const angle=finite(this.params.detectorTilt,0)*Math.PI/180;
    const cx=WORLD.cx+clamp(offset*6,0,104);
    const y=WORLD.sample-(side?clamp(35+distance*4,50,145):clamp(24+distance*3,30,57));
    const half=side?45:60,holeRadius=side?8:17;
    const point=(u,v=0)=>[cx+u*Math.cos(angle)-v*Math.sin(angle),y+u*Math.sin(angle)+v*Math.cos(angle)];
    return {y,cx,side,angle,distance,offset,half,holeRadius,left:cx-half,right:cx+half,point,
      regions:[side?{x:cx-half-12,y:y-half-12,w:2*half+24,h:2*half+24}:{x:266,y:y-5,w:130,h:25},{x:463+BSE_VACUUM.readoutShift,y:483,w:225,h:139}]};
  }

  _component(id) {
    if (id === 'detector' && this.params.detectorMode === 'current') return { x: 302, y: 475, w: 424, h: 139, cy: 540, num: '07', label: 'Specimen current + LMC662 readout', regions: [{x:302,y:530,w:87,h:42},{x:507,y:490,w:220,h:120}] };
    if (id !== 'detector' || this.params.detectorMode !== 'bse') return COMPONENTS[id];
    const geometry = this._bseGeometry();
    return { x: geometry.side?345:261, y: geometry.side?390:479, w: geometry.side?385:469, h: geometry.side?239:147, cy: 513, num: '07',
      label: 'Silicon BSE detector + readout', regions: geometry.regions };
  }

  focus(id) {
    const component = this._component(id);
    if (!component) return;
    this.selected = id;
    const zoom = id === 'detector' && ['bse', 'current'].includes(this.params.detectorMode) ? 1.5
      : id === 'detector' || id === 'vacuum' ? 1.9 : 2.3;
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
  getStats() {
    const electrical = calculateElectrical(this.params, this.derived, this.status);
    return {
      fps: Math.round(this.fps), zoom: Number(this.camera.zoom.toFixed(2)),
      beamDrawCount: this.beamDrawCount,
      bseDrawCount: this.bseDrawCount || 0,
      magneticFieldmT: finite(this.derived.magneticField, 0),
      electricFieldkVm: electrical.scanXFieldVm / 1000,
      electricFieldYkVm: electrical.scanYFieldVm / 1000,
      apertureRadius: apertureVisualRadius(this.params.aperture),
      gunFieldkVm: electrical.gunFieldkVm,
      apertureFieldkVm: electrical.apertureFieldkVm,
      ...this.fieldDrawStats,
    };
  }

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
      const c = this._component(id);
      if ((c.regions || [c]).some(region => p.x >= region.x && p.x <= region.x + region.w
        && p.y >= region.y && p.y <= region.y + region.h)) return id;
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
    this._drawConnections();
    this._drawHighlight();
    this._drawFields();
    this._drawBeam();
    this._drawLabels();
    ctx.restore();
    this._drawApertureInset();
    this._drawFieldInfo();
    // Status, scale disclaimer, legend, and zoom controls belong to the surrounding UI.
  }

  _drawGrid() {
    const ctx = this.ctx;
    ctx.fillStyle = '#2a425b';
    const step = 26;
    const ox = ((this.camera.x * .12) % step + step) % step;
    const oy = ((this.camera.y * .12) % step + step) % step;
    for (let x = ox; x < this.width; x += step) {
      for (let y = oy; y < this.height; y += step) ctx.fillRect(x, y, .9, .9);
    }
    const g = ctx.createRadialGradient(this.width * .47, this.height * .44, 0, this.width * .47, this.height * .44, this.width * .65);
    g.addColorStop(0, '#284b654b'); g.addColorStop(.6, '#18304525'); g.addColorStop(1, '#07111a00');
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
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 11, y - 6); ctx.lineTo(x + width + 11, y - 6);
    ctx.lineTo(x + width, y); ctx.closePath(); ctx.fillStyle = '#698391'; ctx.fill();
    ctx.strokeStyle = '#9eb5bc77'; ctx.lineWidth = .7; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + width, y); ctx.lineTo(x + width + 11, y - 6);
    ctx.lineTo(x + width + 11, y + depth - 6); ctx.lineTo(x + width, y + depth); ctx.closePath();
    ctx.fillStyle = '#304957'; ctx.fill(); ctx.strokeStyle = '#78949f66'; ctx.stroke();
    const metal = ctx.createLinearGradient(0, y, 0, y + depth);
    metal.addColorStop(0, '#7f98a4'); metal.addColorStop(.28, '#395563'); metal.addColorStop(1, '#223a48');
    this._rect(x, y, width, depth, metal, '#698796', 2);
    line(ctx, [[x + 1, y + 2], [x + width - 1, y + 2]], '#dcf7fa40');
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
    const silicon = this.params.detectorMode === 'bse';
    const specimenCurrent = this.params.detectorMode === 'current';
    const wideChamber = silicon || specimenCurrent;
    if (silicon) this._drawBSEVacuumChamber();
    if (specimenCurrent) this._drawCurrentVacuumChamber();
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
    // Separate heater feedthrough pins; joining them here would short the
    // filament supply. Its floating cathode reference is shown in the circuit.
    line(ctx, [[319, 49], [319, 37]], '#bdac8c', 2);
    line(ctx, [[342, 49], [342, 37]], '#bdac8c', 2);
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
    const hole = apertureVisualRadius(this.params.aperture);
    const apertureMetal = ctx.createLinearGradient(0, 235, 0, 246);
    apertureMetal.addColorStop(0, '#e0e4cb'); apertureMetal.addColorStop(.34, '#aab8b5'); apertureMetal.addColorStop(1, '#536973');
    this._rect(287, 238, cx - hole - 287, 8, apertureMetal, '#d1d9cb', .5);
    this._rect(cx + hole, 238, 375 - cx - hole, 8, apertureMetal, '#d1d9cb', .5);
    if (hole > 0) {
      line(ctx, [[cx - hole, 237], [cx - hole + Math.min(2, hole), 245]], '#f0efca', 1.5);
      line(ctx, [[cx + hole, 237], [cx + hole - Math.min(2, hole), 245]], '#f0efca', 1.5);
    }
    line(ctx, [[392, 238], [411, 238]], '#667d88', 2);
    this._rect(408, 232, 6, 15, '#304752', '#73909c', 1);

    // Two copper windings around a ferromagnetic magnetic-lens pole piece.
    this._rect(262, 282, 48, 78, '#283640', '#5a7079', 3);
    this._rect(352, 282, 48, 78, '#283640', '#5a7079', 3);
    for (let y = 291; y <= 345; y += 7) {
      const copper = ctx.createLinearGradient(0, y, 0, y + 4);
      copper.addColorStop(0, '#ecc095'); copper.addColorStop(.45, '#af7857'); copper.addColorStop(1, '#6e4334');
      this._rect(267, y, 35, 4, copper, '#dcac80', 1, .7);
      this._rect(360, y, 35, 4, copper, '#c89a72', 1, .7);
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
    const scanYV = finite(this.status.scanPoint?.y, 0) * finite(this.params.scanAmplitude, 20);
    if (Math.abs(scanYV) > 1e-7) {
      // +Y projects toward the front/lower electrode. A positive differential
      // raises that electrode, so E points back/up and electron force forward.
      label(ctx, scanYV > 0 ? '−' : '+', 359, 442, { color: '#c6a6af', size: 9, mono: true });
      label(ctx, scanYV > 0 ? '+' : '−', 359, 458, { color: '#a8bdcd', size: 9, mono: true });
    }
    this._flange(471, 159, 12);

    // Specimen chamber cutaway, base, tilt stage and sample.
    const chamberGradient = ctx.createLinearGradient(239, 0, 437, 0);
    chamberGradient.addColorStop(0, '#203946'); chamberGradient.addColorStop(.12, '#102630'); chamberGradient.addColorStop(.74, '#10232d'); chamberGradient.addColorStop(1, '#263b48');
    if (!wideChamber) this._rect(242, 483, 192, 122, chamberGradient, '#526f7f', 17);
    line(ctx, [[252, 493], [252, 588], [266, 596], [wideChamber ? 476 : 420, 596]], '#91a7ad24', 1);
    ctx.beginPath(); ctx.ellipse(wideChamber ? 365 : 338, 599, wideChamber ? 119 : 90, 11, 0, 0, Math.PI * 2); ctx.fillStyle = '#233b47'; ctx.fill(); ctx.strokeStyle = '#587383'; ctx.lineWidth = 1; ctx.stroke();
    this._rect(319, 561, 26, 30, '#344d58', '#5d7885', 3);
    if (specimenCurrent) {
      this._rect(309, 561, 47, 9, '#b8c4ac', '#e0e4c7', 2);
      for (let x = 312; x < 354; x += 7) line(ctx, [[x, 563], [x + 3, 568]], '#738479', .8);
    }
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

  _drawBSEVacuumChamber() {
    const ctx = this.ctx, { wallX, signalY, biasY } = BSE_VACUUM;
    // The side bay and specimen space are one connected evacuated volume.
    // This enlarged cutaway is illustrative, not a chamber dimension or CAD check.
    ctx.beginPath();
    for (const [i, [x, y]] of [[242,483],[272,483],[272,382],[390,382],[390,350],[wallX,350],[wallX,605],[242,605]].entries()) {
      if (i) ctx.lineTo(x,y); else ctx.moveTo(x,y);
    }
    ctx.closePath(); ctx.fillStyle='#16313d'; ctx.fill();
    ctx.strokeStyle='#77959f'; ctx.lineWidth=1.7; ctx.stroke();
    label(ctx,'VACUUM',455,366,{size:10,minSize:10,color:'#a9ded4',weight:600,align:'center'});
    label(ctx,'AIR',537,366,{size:10,minSize:10,color:'#a8b7c1',weight:600,align:'center'});
    if (ctx.semLabelScale >= .6) {
      line(ctx,[[wallX,391],[511,391]],'#77959f',1);
      label(ctx,'Chamber wall',518,391,{size:9,minSize:9,color:'#9eb7be'});
      label(ctx,'Sealed A / K',518,425,{size:9,minSize:9,color:'#cfdbc9'});
      label(ctx,'feedthroughs',518,439,{size:9,minSize:9,color:'#cfdbc9'});
      line(ctx,[[514,447],[503,457],[503,signalY],[wallX+5,signalY]],'#93a799',.9);
    }
    for (const y of [signalY,biasY]) {
      this._rect(wallX-6,y-9,12,18,'#d3d1b4','#f0ebcb',2);
      line(ctx,[[wallX,y-8],[wallX,y+8]],'#7c8d89',1);
    }
  }

  _drawDetector() {
    if (this.params.detectorMode === 'current') { this._drawCurrentDetector(); return; }
    if (this.params.detectorMode === 'bse') {
      this._drawBSEDetector();
      return;
    }
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
      label(ctx, 'Scintillator +10 kV (example)', 459, 574, { color: '#b4cfa2', size: 10 });
      label(ctx, 'Representative fixed supply', 459, 590, { color: PALETTE.dim, size: 9, detail: true });
    }
    if (this.layers.electrons && this.status.beamOn && !this.status.scanPoint?.blank
      && finite(this.derived.beamCurrent, 0) > 0 && finite(this.params.aperture, 100) > 0) {
      const phase = this.animationTime;
      for (let i = 0; i < 5; i++) {
        const t = (phase * 1.3 + i / 4) % 1;
        const x = 406 + t * 91, y = 511 + (1 - t) * 6;
        ctx.beginPath(); ctx.moveTo(x, y - 2.5); ctx.lineTo(x + 2.5, y); ctx.lineTo(x, y + 2.5); ctx.lineTo(x - 2.5, y); ctx.closePath();
        ctx.fillStyle = PALETTE.photon; ctx.fill();
      }
      const pulse = .35 + Math.sin(phase * 8) * .1;
      ctx.beginPath(); ctx.arc(401, 521, 5, 0, Math.PI * 2); ctx.fillStyle = `rgba(212, 173, 255, ${pulse})`; ctx.fill();
      // Photoelectrons cascade between successive dynodes, shown as cyan dots.
      for (let i = 0; i < 9; i++) {
        const t = (phase * .8 + i * .11) % 1;
        const segment = Math.min(5, Math.floor(t * 6)), local = t * 6 - segment;
        const y1 = segment % 2 === 0 ? 501 : 518, y2 = segment % 2 === 0 ? 518 : 501;
        ctx.beginPath(); ctx.arc(524 + t * 84, y1 + (y2 - y1) * local, .8 + t * .6, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.beam; ctx.fill();
      }
    }
  }

  _drawCurrentVacuumChamber() {
    const ctx = this.ctx;
    this._rect(242, 483, 246, 122, '#16313d', '#77959f', 17, 1.7);
    this._rect(482, 539, 12, 21, '#d3d1b4', '#f0ebcb', 2);
    line(ctx, [[488, 541], [488, 558]], '#7c8d89', 1);
    label(ctx, 'VACUUM', 425, 500, {size:9,minSize:9,color:'#a9ded4',weight:600,align:'center'});
    label(ctx, 'AIR', 523, 500, {size:9,minSize:9,color:'#a8b7c1',weight:600});
    if (ctx.semLabelScale >= .65) {
      label(ctx, 'Insulating support', 402, 580, {size:8,minSize:8,color:'#cfdbc9',align:'center'});
      line(ctx, [[370, 577], [354, 568]], '#a5bcb0', .8);
      label(ctx, 'Sealed signal feedthrough', 550, 638, {size:9,minSize:9,color:'#cfdbc9',align:'center'});
      line(ctx, [[488, 560], [488, 622], [524, 630]], '#93a799', .9);
    }
  }

  _drawCurrentDetector() {
    const ctx = this.ctx, compact = ctx.semLabelScale < .6;
    const d = this.derived.current || this.derived.electrical?.current || {};
    // The specimen is the sensing electrode. The front end stays outside vacuum.
    this._rect(507, 510, 220, 88, '#142c38', '#719087', 7, 1.2);
    label(ctx, 'SHIELDED READOUT', 617, 522, {size:8,minSize:8,color:'#c0d5c8',weight:600,align:'center'});
    for (const [x,w,title,sub] of [[516,68,'LMC662','100 MΩ TIA'],[593,60,'ADS1115','16-bit ADC'],[662,57,'ESP32','I²C / scan']]) {
      this._rect(x, 536, w, 41, '#23433f', '#6b9380', 3);
      label(ctx, title, x+w/2, 549, {size:9,minSize:9,color:'#e0f1e7',weight:600,align:'center'});
      if (!compact) label(ctx, title==='LMC662'?`${Number(finite(this.params.currentRf,100).toPrecision(3))} MΩ TIA`:sub, x+w/2, 567, {size:7.5,minSize:7.5,color:'#a6c3b5',align:'center'});
    }
    if (this.layers.connections) {
      arrow(ctx, 585, 550, 591, 550, '#aebefa', 2.5, 1.1);
      arrow(ctx, 654, 550, 660, 550, '#aebefa', 2.5, 1.1);
    }
    label(ctx, 'Low-voltage detector electronics', 617, 589, {size:8,minSize:8,color:'#bdd0bd',align:'center'});
    if (!compact) {
      const n=Number.isFinite(d.netCurrentnA)?`${Number(d.netCurrentnA.toPrecision(3))} nA`:'—';
      const v=Number.isFinite(d.outputV)?`${Number(d.outputV.toPrecision(3))} V`:'—';
      label(ctx, `Net current ${n}`, 509, 616, {size:9,minSize:9,color:'#bfdaee',mono:true});
      label(ctx, v, 726, 616, {size:9,minSize:9,color:d.clipped?'#f6bc83':'#bfdaee',mono:true,align:'right'});
    }
  }

  _drawBSEDetector() {
    const ctx = this.ctx, geometry = this._bseGeometry();
    const { y, holeRadius, left, right } = geometry;
    const cx = WORLD.cx, compact = ctx.semLabelScale < .6;
    const d = this.derived.electrical?.bse || this.derived.bse || {};
    const signal = '#aebefa', biasColor = '#edc188';
    // Rotated section through one silicon device; the gold face points toward the specimen.
    ctx.save();ctx.translate(geometry.cx,y);ctx.rotate(geometry.angle);
    for(const [u,width] of [[-geometry.half,geometry.half-holeRadius],[holeRadius,geometry.half-holeRadius]]){
      this._rect(u-3,-3,width+6,12,'#445566','#7b91a2',1.5);
      const silicon=ctx.createLinearGradient(0,0,0,8);silicon.addColorStop(0,'#72809e');silicon.addColorStop(.4,'#313b68');silicon.addColorStop(1,'#161e42');
      this._rect(u,0,width,8,silicon,'#a1aed1',1);
      line(ctx,[[u+1,9],[u+width-1,9]],'#efc175',2.2);
    }
    ctx.restore();
    if(!compact&&!geometry.side)label(ctx,'Ø2 mm beam hole',cx,y-16,{size:8.5,minSize:8.5,color:'#bbd0d9',align:'center'});
    if(geometry.side){
      const back=geometry.point(0,-9);
      line(ctx,[back,[back[0]+26,back[1]-16],[BSE_VACUUM.wallX-6,back[1]-16]],'#6a8290',3);
    }
    label(ctx,'S11141-10',geometry.side?432:331,geometry.side?Math.max(389,y-66):y-30,
      {size:10,minSize:10,color:'#d0dcef',weight:500,align:'center'});
    // Air-side readout is a functional block diagram, with no invented board pins.
    ctx.save();ctx.translate(BSE_VACUUM.readoutShift,0);
    this._rect(466, 492, 222, 59, '#122b38', '#587583', 6);
    for (const [x, width, title, subtitle] of [
      [474, 65, 'TIA', 'current → V'],
      [551, 58, 'ADC', 'filtered V'],
      [621, 59, 'ESP32', 'scan sync'],
    ]) {
      this._rect(x, 501, width, 39, '#203c49', '#567380', 3);
      label(ctx, title, x + width / 2, 512, { size: 10, color: '#ddedea', weight: 600, align: 'center' });
      if (!compact) label(ctx, subtitle, x + width / 2, 530, { size: 8, minSize: 8, color: '#9ebbbf', align: 'center' });
    }
    if (this.layers.connections) {
      arrow(ctx, 540, 521, 548, 521, signal, 2.5, 1.1);
      arrow(ctx, 610, 521, 619, 521, signal, 2.5, 1.1);
    }
    label(ctx, 'External readout', 470, 481, { size: 10, minSize: 10, color: '#d0dcef', weight: 500 });
    this._rect(474, 592, 110, 30, '#302d2b', '#877358', 4);
    const bias = clamp(finite(this.params.detectorBias, 5), 0, 5);
    label(ctx, `A  ${bias > 0 ? '−' : ''}${bias.toFixed(1)} V`, 529, 601, { size: 10, minSize: 10, mono: true, color: biasColor, align: 'center' });
    label(ctx, 'quiet reverse bias', 529, 614, { size: 8, minSize: 8, color: '#b3aa95', align: 'center' });
    if (!compact) {
      const current = Number.isFinite(d.generatedCurrentnA) ? `${Number(d.generatedCurrentnA.toPrecision(3))} nA` : 'unmodeled';
      const volts = Number.isFinite(d.rawOutputV) ? `${Number(d.rawOutputV.toPrecision(3))} V` : '—';
      label(ctx, `Signal ${current}`, 475, 565, { size: 10, minSize: 10, mono: true, color: '#bdcbed' });
      label(ctx, `TIA ${volts}`, 687, 565, { size: 10, minSize: 10, mono: true, color: d.saturated ? '#f6bc83' : '#bdcbed', align: 'right' });
      label(ctx, geometry.side?'Side mount · beam bypasses hole':'Schematic section · opening enlarged', 475, 578, { size: 8.5, minSize: 8.5, color: '#819baa' });
      const resistance = Number(finite(this.params.tiaResistance, 10).toPrecision(3));
      const capacitance = Number(finite(this.params.tiaCapacitance, 5).toPrecision(3));
      label(ctx, `Rf ${resistance} MΩ`, 602, 602, { size: 9, minSize: 9, mono: true, color: '#9aafbf' });
      label(ctx, `Cf ${capacitance} pF`, 602, 617, { size: 9, minSize: 9, mono: true, color: '#9aafbf' });
    }
    ctx.restore();
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
      const component = this._component(id);
      if (!component) continue;
      const active = id === this.selected;
      for (const c of component.regions || [component]) {
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
  }

  _drawConnections() {
    if (!this.layers.connections) return;
    const ctx = this.ctx;
    const hv = '#e4a1bb', lowVoltage = '#eac185', current = '#80d4b4', signal = '#9caeee', earth = '#82a2ac';
    const terminal = (x, y, color) => {
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = '#0b1722'; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = color; ctx.stroke();
    };
    const ground = (x, y) => {
      line(ctx, [[x, y], [x, y + 5]], earth, 1);
      for (let i = 0; i < 3; i++) line(ctx, [[x - 6 + i * 2, y + 5 + i * 3], [x + 6 - i * 2, y + 5 + i * 3]], earth, 1);
    };
    ctx.save(); ctx.globalAlpha = this.view === 'fields' ? .6 : .85;
    // Electrical terminals are intentionally sparse. The Electrical view shows the
    // complete supply, meter, return and controller connections as a circuit.
    line(ctx, [[319, 37], [319, 22], [366, 22]], lowVoltage, 1.4);
    line(ctx, [[342, 37], [342, 31], [385, 31]], lowVoltage, 1.4);
    terminal(366, 22, lowVoltage); terminal(385, 31, lowVoltage);
    if (this.view === 'column') label(ctx, 'Floating heater · HV ref.', 398, 25, { color: '#acbac8', size: 9, detail: true });
    line(ctx, [[305, 116], [292, 116], [292, 124]], hv, 1.2);
    terminal(292, 124, hv);
    line(ctx, [[292, 174], [269, 174], [269, 185]], earth, 1.1);
    ground(269, 185);
    const bias = finite(this.params.apertureBias, 0);
    line(ctx, [[374, 242], [403, 242], [403, 253]], Math.abs(bias) > 1e-8 ? hv : earth, 1.1);
    if (Math.abs(bias) < 1e-8) ground(403, 253);
    else terminal(403, 253, hv);
    line(ctx, [[269, 291], [257, 291], [257, 279], [243, 279]], current, 1.3);
    line(ctx, [[269, 346], [253, 346], [253, 358], [242, 358]], current, 1.3);
    terminal(243, 279, current); terminal(242, 358, current);
    line(ctx, [[300, 414], [283, 414], [283, 397], [261, 397]], signal, 1.2);
    line(ctx, [[362, 423], [388, 423], [388, 450], [403, 450]], signal, 1.2);
    terminal(261, 397, signal); terminal(403, 450, signal);
    if (this.params.detectorMode === 'current') {
      line(ctx, [[376, 548], [400, 548], [400, 550], [516, 550]], signal, 1.7);
      terminal(376,548,signal);
      line(ctx, [[488, 588], [470, 588], [470, 641]], earth, 1.1); ground(470,641);
      line(ctx, [[708, 598], [708, 632]], earth, 1.1); ground(708,632);
      line(ctx, [[512, 555], [512, 559], [494, 559]], earth, 1.1);
      if (ctx.semLabelScale > .6) label(ctx, 'signal', 451, 534, {size:8,minSize:8,color:signal,align:'center'});
    } else if (this.params.detectorMode === 'bse') {
      const geometry=this._bseGeometry(),{y,right}=geometry;
      const {wallX,signalY,biasY,readoutShift:dx}=BSE_VACUUM;
      const a=geometry.side?geometry.point(geometry.half,-2):[right,y-2];
      const k=geometry.side?geometry.point(geometry.half,4):[right,y+4];
      line(ctx,[a,[wallX-13,a[1]],[wallX-13,biasY],[wallX+10,biasY],[wallX+10,601],[474+dx,601]],lowVoltage,1.25);
      line(ctx,[k,[wallX-20,k[1]],[wallX-20,signalY],[wallX+10,signalY],[474+dx,521]],signal,1.5);
      terminal(...a,lowVoltage);terminal(...k,signal);
      label(ctx,'A',a[0]+4,a[1]-7,{color:lowVoltage,size:8,minSize:8,mono:true});
      label(ctx,'K',k[0]+4,k[1]+10,{color:signal,size:8,minSize:8,mono:true});
      line(ctx, [[474+dx, 546], [460+dx, 546], [460+dx, 551]], earth, 1);
      ground(460+dx, 551);
      line(ctx, [[584+dx, 614], [593+dx, 614], [593+dx, 628]], earth, 1);
      ground(593+dx, 628);
      line(ctx, [[wallX, 583], [wallX, 631]], earth, 1.1);
      ground(wallX, 631);
    } else {
      line(ctx, [[430, 583], [450, 583], [450, 601]], earth, 1.1);
      ground(450, 601);
      line(ctx, [[629, 532], [629, 551], [647, 551]], hv, 1.2);
      terminal(647, 551, hv);
      line(ctx, [[677, 538], [690, 538], [690, 561]], signal, 1.2);
      terminal(690, 561, signal);
    }
    ctx.restore();
  }

  _electricCurve(start, control, end, signedField, color, width = 1.15) {
    // Points run from larger z (bottom) to smaller z (top). E_z < 0 therefore
    // points along the curve; an electron accelerates in the opposite direction.
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(...start); ctx.quadraticCurveTo(...control, ...end);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    const point = t => [0, 1].map(axis => (1 - t) ** 2 * start[axis]
      + 2 * (1 - t) * t * control[axis] + t ** 2 * end[axis]);
    const a = point(signedField < 0 ? .44 : .6);
    const b = point(signedField < 0 ? .6 : .44);
    arrow(ctx, ...a, ...b, color, 4, width);
  }

  _drawGunAndApertureFields() {
    const ctx = this.ctx, cx = WORLD.cx;
    const e = calculateElectrical(this.params, this.derived, this.status);
    const gun = Math.abs(e.gunFieldkVm), aperture = Math.abs(e.apertureFieldkVm);
    const hole = apertureVisualRadius(this.params.aperture);
    this.fieldDrawStats = { gunFieldLineCount: 0, apertureFieldLineCount: 0 };
    if (gun > 1e-9) {
      const strength = clamp(gun / GUN_FIELD_MAX_KVM, 0, 1);
      const color = fieldColor(gun, GUN_FIELD_MAX_KVM, .6 + .4 * Math.sqrt(strength));
      const halo = ctx.createLinearGradient(0, 106, 0, 176);
      halo.addColorStop(0, fieldColor(gun, GUN_FIELD_MAX_KVM, .025));
      halo.addColorStop(.55, fieldColor(gun, GUN_FIELD_MAX_KVM, .1 + strength * .13));
      halo.addColorStop(1, fieldColor(gun, GUN_FIELD_MAX_KVM, .035));
      ctx.fillStyle = halo; ctx.fillRect(299, 109, 64, 66);
      const curves = [
        [[301, 169], [287, 144], [305, 114]],
        [[317, 169], [313, 144], [310, 134]],
        [[327, 176], [325, 130], [329, 108]],
        [[335, 176], [337, 130], [333, 108]],
        [[345, 169], [349, 144], [352, 134]],
        [[361, 169], [375, 144], [357, 114]],
      ];
      for (const points of curves) this._electricCurve(...points, e.gunFieldkVm, color, 1.15 + strength * .55);
      this.fieldDrawStats.gunFieldLineCount = curves.length;
      // Dotted tails indicate that the anode hole perturbs the field. Their
      // colour does not encode a computed local field: electrode geometry and
      // a boundary-value solution are required for a quantitative fringe map.
      ctx.setLineDash([2, 3]); ctx.strokeStyle = '#a9b9c380'; ctx.lineWidth = .85;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(cx + side * 3, 200);
        ctx.quadraticCurveTo(cx + side * 3, 183, cx + side * 12, 178); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if (aperture > 1e-9) {
      const strength = clamp(aperture / FIELD_SCALES.electric.max, 0, 1);
      const color = fieldColor(aperture, FIELD_SCALES.electric.max, .55 + .45 * Math.sqrt(strength));
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const rim = cx + side * Math.min(42, hole + 4 + i * 5);
          this._electricCurve([rim, 237], [cx + side * (15 + i * 7), 204],
            [cx + side * (14 + i * 7), 180], e.apertureFieldkVm, color, 1 + strength * .5);
          this.fieldDrawStats.apertureFieldLineCount++;
        }
      }
      // A highlight follows the actual schematic opening, so bias and diameter
      // changes are both legible without drawing field inside the metal.
      line(ctx, [[287, 235], [cx - hole, 235]], color, 1.5);
      line(ctx, [[cx + hole, 235], [375, 235]], color, 1.5);
    } else {
      // Equal grounded electrode potentials give zero average gap field in this
      // model. Mark the grounded screen; do not invent a uniform accelerating
      // field or assign an unsupported numerical strength to a local fringe.
      const boundary = '#9baeb97d';
      line(ctx, [[287, 234], [cx - hole, 234]], boundary, 1, [2, 3]);
      line(ctx, [[cx + hole, 234], [375, 234]], boundary, 1, [2, 3]);
    }
    if (this.view !== 'fields' || this.camera?.zoom > 1.35) return;
    const compact = ctx.semLabelScale < .6;
    label(ctx, 'E gun', 430, 122, { color: gun > 0 ? fieldColor(gun, GUN_FIELD_MAX_KVM) : PALETTE.dim, size: 11, weight: 600 });
    if (!compact) label(ctx, `${gun.toFixed(1)} kV/m`, 486, 122, { color: fieldColor(gun, GUN_FIELD_MAX_KVM), size: 10, mono: true });
    label(ctx, gun > GUN_FIELD_MAX_KVM ? 'Colour capped ≥500 kV/m' : gun > 0 ? 'E ↑  ·  electron force ↓' : 'HV off · no gun field', 430, 142, { color: PALETTE.muted, size: 10, detail: true });
    label(ctx, 'Anode 0 V · fringe shape only', 430, 175, { color: '#a5b8c3', size: 9, detail: true });
    label(ctx, 'E aperture', 430, 220, { color: aperture > 0 ? fieldColor(aperture, 20) : '#a5b8c3', size: 11, weight: 600 });
    if (!compact) label(ctx, `${aperture.toFixed(2)} kV/m`, 517, 220, { color: aperture > 0 ? fieldColor(aperture, 20) : '#a5b8c3', size: 10, mono: true });
    const description = aperture > 0
      ? `Bias ${e.aperturePotentialV >= 0 ? '+' : ''}${Math.round(e.aperturePotentialV)} V · E ${e.apertureFieldkVm < 0 ? '↑' : '↓'}`
      : 'Grounded shield · mean gap E = 0';
    label(ctx, description, 430, 240, { color: PALETTE.muted, size: 9, detail: true });
    label(ctx, 'Local fringe magnitude is not solved', 430, 257, { color: PALETTE.dim, size: 9, detail: true });
  }

  _makeMagneticLoops() {
    // A cached schematic family of closed finite-solenoid flux loops, not a field solver.
    const loops = [];
    for (const side of [-1, 1]) {
      for (let ring = 0; ring < 4; ring++) {
        const points = [], weights = [], inner = 2 + ring * 2.5;
        const extent = 38 + ring * 12, height = 37 + ring * 11;
        for (let i = 0; i <= 40; i++) {
          const angle = i / 40 * Math.PI * 2;
          const radius = inner + extent * (1 + Math.sin(angle)) / 2;
          const z = height * Math.cos(angle);
          points.push([WORLD.cx + side * radius, 322 + z]);
          // Spatial falloff is illustrative; the central B comes from the physical model.
          weights.push(1 / (1 + (radius / 39) ** 2) / (1 + (z / 65) ** 2) ** .65);
        }
        loops.push({ points, weights, ring });
      }
    }
    return loops;
  }

  _drawFields() {
    const ctx = this.ctx, cx = WORLD.cx;
    const compact = ctx.semLabelScale < .6;
    const overlayOpacity = this.view === 'fields' ? 1 : this.view === 'trajectory' ? .42 : .76;
    const signedB = finite(this.derived.magneticField, 0);
    const magnitudeB = Math.abs(signedB);
    const hasB = magnitudeB > 1e-6;
    const point = this.status.scanPoint || {};
    const scanVoltage = finite(this.params.plateVoltage, 0) + finite(point.x, 0) * finite(this.params.scanAmplitude, 20);
    const scanVoltageY = finite(point.y, 0) * finite(this.params.scanAmplitude, 20);
    const gapMm = Math.max(.001, finite(this.params.plateGap, 10));
    const electric = Math.abs(scanVoltage / gapMm);
    const electricY = Math.abs(scanVoltageY / gapMm);
    this.fieldDrawStats = { gunFieldLineCount: 0, apertureFieldLineCount: 0 };
    ctx.save();
    ctx.globalAlpha = overlayOpacity;
    if (this.layers.magnetic && hasB) {
      const strength = clamp(magnitudeB / FIELD_SCALES.magnetic.max, 0, 1);
      ctx.save();
      ctx.globalAlpha *= Math.min(1, Math.sqrt(strength) * 1.4);
      const halo = ctx.createRadialGradient(cx, 322, 1, cx, 322, 89);
      halo.addColorStop(0, fieldColor(magnitudeB, 40, .1 + strength * .12));
      halo.addColorStop(.3, fieldColor(magnitudeB * .75, 40, .06 + strength * .1));
      halo.addColorStop(1, fieldColor(0, 40, 0));
      ctx.fillStyle = halo; ctx.fillRect(cx - 90, 232, 180, 180);
      for (const loop of this._magneticLoops) {
        for (let i = 1; i < loop.points.length; i++) {
          line(ctx, [loop.points[i - 1], loop.points[i]],
            fieldColor(magnitudeB * loop.weights[i], 40, .35 + strength * .55),
            loop.ring === 0 ? 1.5 : .9);
        }
        const offset = signedB < 0 ? -this.animationTime * .12 : this.animationTime * .12;
        const index = ((Math.floor((offset + loop.ring * .13) * 40) % 40) + 40) % 40;
        const next = (index + (signedB < 0 ? 39 : 1)) % 40;
        const [x, y] = loop.points[index], [nx, ny] = loop.points[next];
        arrow(ctx, x, y, nx, ny, fieldColor(magnitudeB * loop.weights[index], 40, .9), 3.3, 1.1);
      }
      arrow(ctx, cx, signedB >= 0 ? 306 : 338, cx, signedB >= 0 ? 338 : 306,
        fieldColor(magnitudeB, 40), 5.2, 1.8);
      ctx.restore();
    }
    if (this.layers.electric) {
      this._drawGunAndApertureFields();
      // E points from the positive plate toward the negative plate; electron force is opposite.
      if (electric > 1e-7) {
        const alpha = .12 + .88 * Math.sqrt(clamp(electric / 20, 0, 1));
        const color = fieldColor(electric, 20, alpha);
        const fill = ctx.createLinearGradient(307, 0, 355, 0);
        fill.addColorStop(0, fieldColor(electric, 20, .02));
        fill.addColorStop(.5, fieldColor(electric, 20, .07 + .12 * clamp(electric / 20, 0, 1)));
        fill.addColorStop(1, fieldColor(electric, 20, .02));
        ctx.fillStyle = fill; ctx.fillRect(307, 391, 48, 49);
        const arrowLength = 16 + 22 * Math.sqrt(clamp(electric / 20, 0, 1));
        for (let y = 398; y <= 433; y += 9) {
          const tail = cx + Math.sign(scanVoltage) * arrowLength / 2;
          const head = cx - Math.sign(scanVoltage) * arrowLength / 2;
          arrow(ctx, tail, y, head, y, color, 4, .9 + .7 * clamp(electric / 20, 0, 1));
        }
        for (const y of [392, 438]) {
          ctx.beginPath(); ctx.moveTo(352, y); ctx.quadraticCurveTo(cx, y + (y < 410 ? -9 : 9), 310, y);
          ctx.strokeStyle = fieldColor(electric * .55, 20, alpha * .7); ctx.lineWidth = .8; ctx.stroke();
        }
      }
      if (electricY > 1e-7) {
        const color = fieldColor(electricY, 20, .65);
        // Second pair is projected in depth: its field is perpendicular to the X field.
        for (let x = 316; x <= 346; x += 10) {
          const direction = Math.sign(scanVoltageY);
          arrow(ctx, x - direction * 3, 450 + direction * 5,
            x + direction * 3, 450 - direction * 5, color, 3, .9);
        }
      }
    }
    ctx.restore();
    if (this.view !== 'fields' || this.camera?.zoom > 1.35) return;
    if (this.layers.magnetic) {
      label(ctx, 'B', compact ? 429 : 430, 306, { color: hasB ? fieldColor(magnitudeB) : PALETTE.dim, size: 12, weight: 600, mono: true });
      if (!compact) label(ctx, `${signedB >= 0 ? '+' : ''}${signedB.toFixed(1)} mT`, 448, 306, { color: hasB ? fieldColor(magnitudeB) : PALETTE.dim, size: 10, mono: true });
      label(ctx, magnitudeB > 40 ? 'Colour capped ≥40 mT' : hasB ? 'coil · axial field' : 'coil field off', 430, 325, { color: PALETTE.muted, size: 9, detail: true });
    }
    if (this.layers.electric) {
      label(ctx, 'E', compact ? 429 : 430, 401, { color: electric > 0 ? fieldColor(electric, 20) : PALETTE.dim, size: 12, weight: 600, mono: true });
      if (!compact) label(ctx, `${electric.toFixed(2)} kV/m`, 448, 401, { color: fieldColor(electric, 20), size: 10, mono: true });
      label(ctx, electric > 20 ? 'Colour capped ≥20 kV/m' : 'plates · transverse field', 430, 419, { color: PALETTE.muted, size: 9, detail: true });
    }
  }

  _drawApertureInset() {
    // Screen-space inset remains readable while the selected hardware is enlarged.
    if (!this._showApertureInset()) return;
    const ctx = this.ctx;
    const w = Math.min(164, this.width * .32), h = 159;
    const x = this.width - w - 12, y = 64;
    const diameter = finite(this.params.aperture, 100);
    const radius = apertureVisualRadius(diameter) * 1.1;
    const centerX = x + w / 2, centerY = y + 70;
    ctx.save(); ctx.semLabelScale = 1;
    rounded(ctx, x, y, w, h, 10);
    ctx.fillStyle = '#142633f5'; ctx.fill(); ctx.strokeStyle = '#426173'; ctx.lineWidth = 1; ctx.stroke();
    label(ctx, w < 150 ? 'APERTURE' : 'APERTURE · TOP VIEW', x + 11, y + 16, { size: 10, minSize: 10, mono: true, color: '#afc9d6', weight: 500 });
    const metal = ctx.createRadialGradient(centerX - 12, centerY - 15, 2, centerX, centerY, 40);
    metal.addColorStop(0, '#c8d9d3'); metal.addColorStop(.5, '#7e959c'); metal.addColorStop(.85, '#405c6b'); metal.addColorStop(1, '#819dab');
    ctx.beginPath(); ctx.arc(centerX, centerY, 39, 0, Math.PI * 2); ctx.fillStyle = metal; ctx.fill();
    ctx.strokeStyle = '#b5ccd15c'; ctx.lineWidth = 1; ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2 + .7;
      ctx.beginPath(); ctx.arc(centerX + Math.cos(angle) * 34, centerY + Math.sin(angle) * 34, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = '#172c39'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.fillStyle = '#081b25'; ctx.fill();
    ctx.strokeStyle = '#d2e8dc'; ctx.lineWidth = 1.2; ctx.stroke();
    if (this.layers.electrons && (this.status.beamOn || this.status.sourceOn) && !this.status.scanPoint?.blank) {
      // Electron dots outside the physical opening are intercepted by the aperture.
      for (let i = 0; i < 28; i++) {
        const angle = i * 2.39996323;
        const r = 31 * Math.sqrt((i + .5) / 28);
        const dx = Math.cos(angle) * r, dy = Math.sin(angle) * r;
        const passed = r < radius;
        const opacity = .4 + .45 * (.5 + .5 * Math.sin(this.animationTime * 6 + i));
        ctx.beginPath(); ctx.arc(centerX + dx, centerY + dy, passed ? 1.5 : 1, 0, Math.PI * 2);
        ctx.fillStyle = passed ? `rgba(112, 249, 239, ${opacity})` : '#e9b48b66'; ctx.fill();
      }
    }
    const dimensionY = centerY + 45;
    line(ctx, [[centerX - radius, dimensionY - 4], [centerX - radius, dimensionY + 4]], '#b9cfd7', .7);
    line(ctx, [[centerX + radius, dimensionY - 4], [centerX + radius, dimensionY + 4]], '#b9cfd7', .7);
    line(ctx, [[centerX - radius, dimensionY], [centerX + radius, dimensionY]], '#b9cfd7', .7);
    label(ctx, `Ø ${Math.round(diameter)} µm`, centerX, y + 133, { size: 12, mono: true, weight: 600, align: 'center', color: '#e5f4ef' });
    const caption = diameter <= 0 ? 'Closed aperture' : diameter > 300
      ? (w < 150 ? 'Drawing capped' : 'Drawing capped ≥300 µm')
      : (w < 150 ? 'Enlarged opening' : 'Opening exaggerated');
    label(ctx, caption, centerX, y + 149, { size: 10, minSize: 10, align: 'center', color: '#91aab7' });
    ctx.restore();
  }

  _showApertureInset() {
    if (this.view === 'fields') return false;
    return (this.camera.zoom <= 1.35 && this.width >= 420) || ['aperture', 'gun'].includes(this.selected);
  }

  _drawFieldInfo() {
    if (this.view !== 'fields' || this.camera.zoom <= 1.35) return;
    const ctx = this.ctx, e = calculateElectrical(this.params, this.derived, this.status);
    const electrostatic = ['gun', 'anode', 'aperture'].includes(this.selected);
    const scan = this.selected === 'scan', lens = this.selected === 'lens';
    if (!electrostatic && !scan && !lens) return;
    const compact = this.width < 460;
    const w = Math.min(this.width - 24, compact ? this.width - 24 : 222);
    const h = electrostatic ? (compact ? 162 : 234) : scan ? 168 : 120;
    const x = compact ? 12 : this.width - w - 12;
    const y = compact ? Math.max(54, this.height - h - 38) : 62;
    ctx.save(); ctx.semLabelScale = 1;
    rounded(ctx, x, y, w, h, 10);
    ctx.fillStyle = '#102430f5'; ctx.fill(); ctx.strokeStyle = '#456371'; ctx.lineWidth = 1; ctx.stroke();
    const text = (value, yy, options = {}) => label(ctx, value, x + 13, y + yy, { minSize: 0, size: 10, color: '#a6bcc8', ...options });
    const value = (v, digits = 2) => Number(v.toPrecision(digits)).toString();
    if (electrostatic) {
      const gun = Math.abs(e.gunFieldkVm), aperture = Math.abs(e.apertureFieldkVm);
      if (compact) {
        text('GUN / ANODE', 18, { size: 9, mono: true });
        text(`${value(gun, 4)} kV/m`, 40, { size: 16, weight: 600, color: fieldColor(gun, GUN_FIELD_MAX_KVM) });
        text(gun > 0 ? 'Electric field ↑ · electron force ↓' : 'HV off · no accelerating field', 60);
        line(ctx, [[x + 13, y + 75], [x + w - 13, y + 75]], '#385461', .8);
        text('APERTURE · GAP AVERAGE', 91, { size: 9, mono: true });
        text(`${value(aperture, 4)} kV/m`, 111, { size: 13, weight: 600, color: aperture > 0 ? fieldColor(aperture, 20) : '#c3d4dc' });
        text(aperture > 0 ? `${e.aperturePotentialV > 0 ? '+' : ''}${value(e.aperturePotentialV, 4)} V bias · E ${e.apertureFieldkVm < 0 ? '↑' : '↓'}` : '0 V · grounded shield', 130);
        text('Local fringe strength is not solved.', 149, { size: 9, color: '#819ba9' });
        ctx.restore(); return;
      }
      text('GUN / ACCELERATING ANODE', 18, { size: 9, mono: true });
      text(`${value(gun, 4)} kV/m`, 43, { size: 18, weight: 600, color: fieldColor(gun, GUN_FIELD_MAX_KVM) });
      text(gun > 0 ? 'Electric field ↑  ·  electron force ↓' : 'HV off · no accelerating field', 65, { size: 10 });
      text(`${value(Math.abs(e.cathodePotentialV) / 1000, 4)} kV across ${value(e.params.gunGap, 4)} mm`, 84);
      line(ctx, [[x + 13, y + 99], [x + w - 13, y + 99]], '#385461', .8);
      text('BEAM APERTURE', 116, { size: 9, mono: true });
      text(`${value(aperture, 4)} kV/m · gap average`, 138, { size: 12, weight: 600, color: aperture > 0 ? fieldColor(aperture, 20) : '#c3d4dc' });
      text(aperture > 0 ? `${e.aperturePotentialV > 0 ? '+' : ''}${value(e.aperturePotentialV, 4)} V bias · E ${e.apertureFieldkVm < 0 ? '↑' : '↓'}` : '0 V · grounded shield', 159);
      text(`Opening ${value(finite(this.params.aperture, 100), 4)} µm`, 177);
      text('Fringe shapes are qualitative.', 201, { size: 9, color: '#819ba9' });
      text('Local fringe strength is not solved.', 216, { size: 9, color: '#819ba9' });
    } else if (scan) {
      text('SCAN PLATE FIELDS', 18, { size: 9, mono: true });
      text(`Ex  ${value(e.scanXFieldVm / 1000, 4)} kV/m`, 44, { size: 14, weight: 600, color: fieldColor(e.scanXFieldVm / 1000, 20) });
      text(`Ey  ${value(e.scanYFieldVm / 1000, 4)} kV/m`, 68, { size: 14, weight: 600, color: fieldColor(e.scanYFieldVm / 1000, 20) });
      text('E = −ΔV / gap', 94, { size: 11 });
      text('+X right · +Y forward / down', 116);
      text('Electrons accelerate opposite E.', 143, { size: 9, color: '#819ba9' });
    } else {
      const b = finite(this.derived.magneticField, 0);
      text('MAGNETIC LENS', 18, { size: 9, mono: true });
      text(`${b >= 0 ? '+' : ''}${value(b, 4)} mT`, 46, { size: 18, weight: 600, color: fieldColor(b, 40) });
      text(`Axial B ${b >= 0 ? '↓' : '↑'} · +z toward specimen`, 72);
      text('Flux-loop shapes are illustrative.', 99, { size: 9, color: '#819ba9' });
    }
    ctx.restore();
  }

  _beamGeometry(ray = 0) {
    const cx = WORLD.cx, p = this.params, d = this.derived;
    const point = this.status.scanPoint || {};
    const radius = apertureVisualRadius(p.aperture) * .62;
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
        cx + ray * lensRadius * clamp(cosPhase - focalRatio * zFraction, -3.5, 3.5) + deflection * transverse,
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

  _drawInterceptedElectrons(speedFactor) {
    if (!(finite(this.derived.emission, this.derived.beamCurrent) > 0)
      || !(finite(this.derived.extraction, 1) > 0)) return;
    const ctx = this.ctx, aperture = apertureVisualRadius(this.params.aperture);
    // Incoming electrons still strike a closed aperture; none continue downstream.
    for (let i = 0; i < 16; i++) {
      const radius = (i / 15 - .5) * 54;
      if (Math.abs(radius) <= aperture) continue;
      const f = (this.animationTime * .82 * speedFactor + i * .618) % 1;
      const x = WORLD.cx + radius * f, y = 109 + f * 128;
      line(ctx, [[WORLD.cx + radius * Math.max(0, f - .015), y - 2], [x, y]], '#7cc9cc8c', 1);
      ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#9de5de'; ctx.fill();
      this.beamDrawCount++;
      if (f > .93) {
        ctx.beginPath(); ctx.arc(WORLD.cx + radius, 237, 2.3, 0, Math.PI * 2); ctx.fillStyle = '#ffb76a91'; ctx.fill();
      }
    }
  }

  _drawBeam() {
    const ctx = this.ctx;
    this.beamDrawCount = 0;
    this.bseDrawCount = 0;
    if (!this.layers.electrons) return;
    if (!this.status.beamOn && !this.status.sourceOn) {
      line(ctx, [[WORLD.cx, 182], [WORLD.cx, 528]], '#49697755', .8, [3, 6]);
      return;
    }
    const blank = Boolean(this.status.scanPoint?.blank);
    const speedFactor = clamp(finite(this.derived.speed, 3.25e7) / 3.25e7, .3, 2.2);
    const current = Math.max(0, finite(this.derived.beamCurrent, 0));
    if (!blank) this._drawInterceptedElectrons(speedFactor);
    if (!this.status.beamOn || finite(this.params.aperture, 100) <= 0 || current <= 0) return;
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
    const rayCount = this.view === 'trajectory' ? 11 : 7;
    const rays = [];
    for (let i = 0; i < rayCount; i++) {
      const ray = this._beamGeometry((i / (rayCount - 1) - .5) * 2);
      rays.push(ray);
      line(ctx, ray, this.view === 'trajectory' ? '#70f9ef91' : '#70f9ef3d', this.view === 'trajectory' ? 1 : .7);
    }
    ctx.shadowColor = PALETTE.beam; ctx.shadowBlur = 10;
    line(ctx, center, '#72f6dcaa', 1.1);
    ctx.shadowBlur = 0;
    // Representative dots remain legible at very low current; their count is bounded and normalized.
    const particleCount = Math.round(clamp(22 + 19 * Math.log10(1 + current), 22, 84));
    if (!blank) {
      for (let i = 0; i < particleCount; i++) {
        const fraction = (this.animationTime * .53 * speedFactor + i * .618033989) % 1;
        const ray = rays[i % rays.length];
        const [x, y] = this._pointAlong(ray, fraction);
        const [tailX, tailY] = this._pointAlong(ray, Math.max(0, fraction - .010));
        line(ctx, [[tailX, tailY], [x, y]], '#8cfce4b3', i % 5 ? 1.1 : 1.5);
        ctx.beginPath(); ctx.arc(x, y, i % 5 ? 1.1 : 1.65, 0, Math.PI * 2);
        ctx.fillStyle = i % 5 ? PALETTE.beam : '#e3fffb'; ctx.fill();
        this.beamDrawCount++;
      }
      const hit = center[center.length - 1];
      const spot = ctx.createRadialGradient(hit[0], hit[1], 0, hit[0], hit[1], 12);
      spot.addColorStop(0, '#cefff4c7'); spot.addColorStop(.15, '#86f3cf70'); spot.addColorStop(1, '#63f0ce00');
      ctx.fillStyle = spot; ctx.fillRect(hit[0] - 12, hit[1] - 12, 24, 24);
      ctx.beginPath(); ctx.ellipse(hit[0], hit[1], 2.3, 1.3, -.17, 0, Math.PI * 2); ctx.fillStyle = '#e2fff1'; ctx.fill();
      if (this.params.detectorMode === 'bse') this._drawBSETrajectories(hit);
      else if (this.params.detectorMode === 'current') this._drawCurrentTrajectories(hit);
      else {
        // Representative low-energy secondaries collected by the side detector.
        for (let i = 0; i < 4; i++) {
          const phase = (this.animationTime * .8 + i * .25) % 1;
          const x = hit[0] + (393 - hit[0]) * phase;
          const y = hit[1] + (523 - hit[1]) * phase - Math.sin(phase * Math.PI) * (10 + i * 5);
          const trail = phase - .04;
          if (trail > 0) {
            line(ctx, [[hit[0] + (393 - hit[0]) * trail, hit[1] + (523 - hit[1]) * trail - Math.sin(trail * Math.PI) * (10 + i * 5)], [x, y]], '#ffcf6f78', .8);
          }
          ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fillStyle = PALETTE.secondary; ctx.fill();
        }
      }
    }
    if (this.view === 'trajectory') {
      arrow(ctx, 352, 192, 352, 212, PALETTE.beam, 4, 1);
      label(ctx, 'e⁻', 360, 202, { color: PALETTE.beam, size: 11, mono: true });
      const end = center[center.length - 1];
      line(ctx, [[end[0], end[1] + 21], [end[0], 577], [415, 577]], '#71cebd66', .8, [2, 3]);
      if (this.params.detectorMode === 'et') {
        label(ctx, 'BEAM–SAMPLE INTERACTION', 445, 613, { color: PALETTE.muted, size: 8.5, mono: true, detail: true });
        label(ctx, 'Primary e⁻ → secondary e⁻ → light', 445, 632, { color: '#a8c3c9', size: 9, detail: true });
      }
    }
    ctx.restore();
  }

  _drawCurrentTrajectories(hit) {
    const ctx = this.ctx;
    // SE/BSE leave the specimen and are lost to surrounding grounded surfaces.
    // These are illustrative paths; net absorbed current is read electrically.
    for (let i=0;i<6;i++) {
      const end=i<3?[252+i*11,502-i*4]:[451+(i-3)*10,511-(i-3)*9];
      const phase=(this.animationTime*.75+i*.173)%1;
      const point=t=>[hit[0]+(end[0]-hit[0])*t,hit[1]+(end[1]-hit[1])*t-Math.sin(t*Math.PI)*(i%2?9:20)];
      const [x,y]=point(phase);
      if(this.view==='trajectory') line(ctx,[hit,point(.5),end],'#ffc66d25',.7);
      line(ctx,[point(Math.max(0,phase-.045)),[x,y]],'#ffc66d9a',1);
      ctx.beginPath();ctx.arc(x,y,1.35,0,Math.PI*2);ctx.fillStyle=PALETTE.secondary;ctx.fill();
      this.bseDrawCount++;
    }
  }

  _drawBSETrajectories(hit) {
    const ctx = this.ctx, geometry = this._bseGeometry();
    if(this.derived.bse?.placement&&!this.derived.bse.placement.valid)return;
    // Representative emitted angles, not a Monte Carlo scattering solution.
    // High-energy BSE travel back toward the specimen-facing silicon surface;
    // unlike an ET collector, this small reverse bias does not collect ordinary SE.
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const u=side*(geometry.holeRadius+7+Math.floor(i/2)*(geometry.side?6:8));
      const end=geometry.point(u,9);
      if (this.view === 'trajectory') line(ctx, [hit, end], '#ffc66d35', .8);
      const phase = (this.animationTime * .85 + i * .137) % 1;
      const point = t => [hit[0] + (end[0] - hit[0]) * t, hit[1] + (end[1] - hit[1]) * t];
      const [x, y] = point(phase);
      line(ctx, [point(Math.max(0, phase - .065)), [x, y]], '#ffc66dbb', 1.2);
      ctx.beginPath(); ctx.arc(x, y, i % 3 === 0 ? 1.65 : 1.25, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.bse; ctx.fill();
      this.bseDrawCount++;
    }
  }

  _drawLabels() {
    // Labels use world positions only in overview. At component zoom they
    // would be enlarged and clipped; the explorer and fixed field card remain.
    if (this.camera?.zoom > 1.35) return;
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
    label(ctx, compact ? 'Detector' : this.params.detectorMode === 'current' ? 'Specimen current readout' : this.params.detectorMode === 'bse' ? 'Silicon BSE detection' : 'Detection chain', compact ? 517 : 527, 462, { size: 11, color: selectedDetector ? '#defff6' : '#a9bec9' });
    line(ctx, [[568, 473], [568, 482]], '#46667488', .8);
    if (this.view === 'column' && !compact) {
      const emitterTemperature = finite(this.derived.temperature, 300);
      if (!this._showApertureInset()) {
        label(ctx, `${Math.round(emitterTemperature).toLocaleString()} K`, 426, 96, { size: 10, mono: true, color: emitterTemperature > 1200 ? PALETTE.amber : PALETTE.muted });
        label(ctx, `Cathode −${finite(this.params.voltage, 3).toFixed(1)} kV`, 426, 120, { size: 9.5, color: PALETTE.muted });
        label(ctx, '0 V · ground', 426, 169, { size: 10, mono: true, color: '#afc5d1' });
      }
      label(ctx, `${finite(this.params.aperture, 100).toFixed(0)} µm`, 426, 240, { size: 10, mono: true, color: '#afc5d1' });
      label(ctx, `${finite(this.params.lensCurrent, .45).toFixed(2)} A`, 426, 325, { size: 10, mono: true, color: PALETTE.magnetic });
      label(ctx, 'lens excitation', 426, 341, { size: 9, color: PALETTE.dim, detail: true });
      const scan = this.status.scanPoint || {};
      const vx = finite(this.params.plateVoltage, 0) + finite(scan.x, 0) * finite(this.params.scanAmplitude, 20);
      label(ctx, `${vx >= 0 ? '+' : ''}${vx.toFixed(1)} V`, 426, 419, { size: 10, mono: true, color: '#b7c3ce' });
      label(ctx, 'electrostatic deflection', 426, 435, { size: 9, color: PALETTE.dim, detail: true });
    }
    if (compact || this.params.detectorMode !== 'et') return;
    // A local schematic scale marker conveys orientation without claiming metric scale.
    line(ctx, [[657, 612], [657, 640], [683, 640]], '#527280', 1);
    arrow(ctx, 657, 610, 657, 640, '#527280', 4, 1);
    arrow(ctx, 657, 640, 686, 640, '#527280', 4, 1);
    label(ctx, '+z', 655, 653, { color: PALETTE.dim, size: 10, mono: true, align: 'center' });
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
    ctx.beginPath(); ctx.arc(114, y, 2.7, 0, Math.PI * 2); ctx.fillStyle = this.params.detectorMode === 'bse' ? PALETTE.bse : '#d1e6a7'; ctx.fill();
    label(ctx, this.params.detectorMode === 'bse' ? 'Backscattered e⁻' : 'Secondary e⁻ / light', 123, y, { size: 9, color: '#8fa9b6' });
    if (!small) label(ctx, this.paused ? 'ANIMATION PAUSED' : 'MOTION SLOWED FOR VISIBILITY', this.width - 18, y, { size: 7.5, mono: true, color: '#526e7c', align: 'right' });
  }
}

export default ColumnView;
