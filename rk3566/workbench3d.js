/* Native PCB geometry viewer. This module displays supplied results; it solves no physics. */
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const FRONT = 0;
const BACK = 2;
const DEFAULT_ORDER = [0, 4, 6, 8, 10, 12, 14, 2];
const TAU = Math.PI * 2;
const UNKNOWN = '#526575';
const LAYER_COLORS = ['#c4a071', '#708b83', '#9b9a73', '#7b98a4', '#897ca8', '#8199a6', '#748f80', '#c4a071'];

function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function colorValue(value) {
  const v = value && typeof value === 'object' && !(value instanceof THREE.Color) ? value.color : value;
  if (v === null || v === undefined) return null;
  try { return new THREE.Color(v); } catch { return null; }
}
function mappingValue(mapping, key) { return mapping instanceof Map ? mapping.get(key) : mapping?.[key]; }
function nearest(array, value) {
  let lo = 0, hi = array.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (array[mid] < value) lo = mid + 1; else hi = mid; }
  return lo > 0 && Math.abs(array[lo - 1] - value) <= Math.abs(array[lo] - value) ? lo - 1 : lo;
}

function stackDefinition(layout, order) {
  const proposed = layout.stackup || {};
  const thickness = finite(proposed.thickness_mm) ? proposed.thickness_mm : 1.6;
  const copper = proposed.copper_mm;
  const dielectric = proposed.dielectric_mm;
  const supplied = Array.isArray(copper) && copper.length === order.length && Array.isArray(dielectric) && dielectric.length === order.length - 1;
  const z = {}, notes = [];
  if (supplied) {
    // Anchor each half to its native outer surface; preserve its adjacent-reference spacings.
    // The proposal sums to 1.58 mm versus 1.6 mm nominal. Its 0.02 mm unresolved difference
    // remains in the central display gap; it is never fed back to the field calculation.
    const middle = order.length / 2;
    let depth = 0;
    for (let i = 0; i < middle; i++) { z[order[i]] = thickness / 2 - depth - copper[i] / 2; depth += copper[i] + (dielectric[i] || 0); }
    depth = 0;
    for (let i = order.length - 1; i >= middle; i--) { z[order[i]] = -thickness / 2 + depth + copper[i] / 2; depth += copper[i] + (dielectric[i - 1] || 0); }
    const sum = [...copper, ...dielectric].reduce((a, b) => a + b, 0);
    if (Math.abs(sum - thickness) > 1e-8) notes.push(`Declared thickness ${thickness} mm; layer entries sum to ${sum.toFixed(3)} mm. The ${(thickness - sum).toFixed(3)} mm difference is left in the central display gap only.`);
  } else {
    order.forEach((id, i) => { z[id] = thickness / 2 - .0175 - i * (thickness - .035) / (order.length - 1); });
    notes.push('No detailed stackup supplied: equally spaced copper planes are a display assumption.');
  }
  notes.push(proposed.status || 'Nominal board thickness and depth placement are illustrative, pending fabrication stackup qualification.');
  return { thickness, z, copper: supplied ? copper : order.map(() => .018), notes };
}

function outlinePoints(layout) {
  const remaining = (layout.outline || []).filter(e => e.start && e.end).map(e => ({ start: [...e.start], end: [...e.end] }));
  if (!remaining.length) throw new Error('Native board outline is unavailable.');
  const first = remaining.shift(), points = [first.start, first.end];
  while (remaining.length) {
    const last = points.at(-1);
    const close = p => Math.hypot(p[0] - last[0], p[1] - last[1]) < 1e-5;
    const index = remaining.findIndex(e => close(e.start) || close(e.end));
    if (index < 0) throw new Error('Native outline segments do not form a connected boundary.');
    const edge = remaining.splice(index, 1)[0]; points.push(close(edge.start) ? edge.end : edge.start);
  }
  return points;
}

function bodyProxy(component) {
  const rotation = (component.rotation || 0) * Math.PI / 180;
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const local = p => { const x = p[0] - component.x, y = p[1] - component.y; return [x * cos - y * sin, x * sin + y * cos]; };
  const points = [];
  for (const g of component.graphics || []) {
    if (!/\.Fab$/.test(g.layer_name || '')) continue;
    if (g.start) points.push(local(g.start)); if (g.end) points.push(local(g.end));
    if (g.mid) points.push(local(g.mid));
    if (g.center && finite(g.radius)) for (let n = 0; n < 16; n++) points.push(local([g.center[0] + g.radius * Math.cos(n * TAU / 16), g.center[1] + g.radius * Math.sin(n * TAU / 16)]));
    for (const polygon of g.polygons || []) for (const p of polygon.points || []) points.push(local(p));
  }
  let x, y, width, height, angle;
  if (points.length >= 2) {
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const loX = Math.min(...xs), hiX = Math.max(...xs), loY = Math.min(...ys), hiY = Math.max(...ys);
    const cx = (loX + hiX) / 2, cy = (loY + hiY) / 2;
    x = component.x + cx * cos + cy * sin; y = component.y - cx * sin + cy * cos;
    width = hiX - loX; height = hiY - loY; angle = rotation;
  } else {
    const b = component.bounds;
    x = b.x + b.width / 2; y = b.y + b.height / 2; width = b.width; height = b.height; angle = 0;
  }
  // Heights are schematic aids, never read from a STEP model or claimed as measured.
  const mechanical = /^H\d/.test(component.ref);
  const proxyHeight = component.dnp || mechanical ? .055 : /^J/.test(component.ref) ? 2.4 : /^U/.test(component.ref) ? .95 : /^L/.test(component.ref) ? 1.15 : .38;
  return { x, y, width: Math.max(.1, width), height: Math.max(.1, height), angle, proxyHeight, mechanical, source: points.length >= 2 ? 'native Fab outline bounding proxy' : 'native footprint bounds proxy' };
}

function ringPoints(cx, cy, rx, ry, rotation = 0, segments = 24) {
  const points = [], cos = Math.cos(rotation), sin = Math.sin(rotation);
  for (let n = 0; n < segments; n++) { const a = TAU * n / segments, x = rx * Math.cos(a), y = ry * Math.sin(a); points.push([cx + x * cos - y * sin, cy + x * sin + y * cos]); }
  return points;
}

function padPolygons(pad) {
  if (pad.polygons?.length) return pad.polygons.map(p => ({ points: p.points, holes: p.holes || [] }));
  const w = pad.width, h = pad.height;
  const angle = (pad.svg_rotation || 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const convert = ([x, y]) => [pad.x + x * cos - y * sin, pad.y + x * sin + y * cos];
  let points = [];
  if (pad.shape === 'circle') points = ringPoints(0, 0, w / 2, h / 2);
  else if (pad.shape === 'oval' || pad.shape === 'roundrect') {
    const radius = pad.shape === 'oval' ? Math.min(w, h) / 2 : Math.min(pad.corner_radius || 0, w / 2, h / 2);
    const corners = [[w / 2 - radius, h / 2 - radius, 0], [-w / 2 + radius, h / 2 - radius, Math.PI / 2], [-w / 2 + radius, -h / 2 + radius, Math.PI], [w / 2 - radius, -h / 2 + radius, Math.PI * 1.5]];
    for (const [cx, cy, start] of corners) for (let n = 0; n <= 5; n++) { const a = start + n * Math.PI / 10; points.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]); }
  } else points = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  const holes = [];
  if (pad.through_hole && pad.drill?.width > 0 && pad.drill?.height > 0) holes.push(ringPoints(0, 0, pad.drill.width / 2, pad.drill.height / 2).map(convert));
  return [{ points: points.map(convert), holes }];
}

class CopperBatch {
  constructor(toWorld, baseColor) { this.toWorld = toWorld; this.baseColor = baseColor; this.positions = []; this.ranges = []; this.mesh = null; }
  polygon(points, holes, meta) {
    if (!points || points.length < 3) return;
    const contour = points.map(p => new THREE.Vector2(...this.toWorld(p)));
    const voids = (holes || []).filter(h => h.length >= 3).map(h => h.map(p => new THREE.Vector2(...this.toWorld(p))));
    const combined = [...contour, ...voids.flat()], triangles = THREE.ShapeUtils.triangulateShape(contour, voids);
    const start = this.positions.length / 3;
    for (const triangle of triangles) for (const index of triangle) { const p = combined[index]; this.positions.push(p.x, p.y, 0); }
    this.ranges.push({ start, count: this.positions.length / 3 - start, ...meta });
  }
  track(track) {
    const points = track.shape === 'arc' && track.mid ? arcPoints(track.start, track.mid, track.end) : [track.start, track.end];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 1e-9) continue;
      const dx = (b[0] - a[0]) / length, dy = (b[1] - a[1]) / length, r = track.width / 2;
      const angle = Math.atan2(dy, dx), polygon = [];
      for (let j = 0; j <= 8; j++) { const t = angle - Math.PI / 2 + j * Math.PI / 8; polygon.push([b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)]); }
      for (let j = 0; j <= 8; j++) { const t = angle + Math.PI / 2 + j * Math.PI / 8; polygon.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)]); }
      this.polygon(polygon, [], { net: track.net });
    }
  }
  finish(material) {
    if (!this.positions.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(this.positions.length), 3));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    this.mesh = new THREE.Mesh(geometry, material); this.positions = null; return this.mesh;
  }
  recolor(colors, active, selectedNet = null) {
    if (!this.mesh) return;
    const buffer = this.mesh.geometry.attributes.color, cache = new Map();
    for (const range of this.ranges) {
      let color = cache.get(range.net);
      if (!color) { color = colorValue(mappingValue(colors, range.net)) || new THREE.Color(active ? UNKNOWN : this.baseColor); cache.set(range.net, color); }
      if (selectedNet && selectedNet === range.net) color = new THREE.Color('#ffe3a0');
      for (let i = range.start; i < range.start + range.count; i++) buffer.setXYZ(i, color.r, color.g, color.b);
    }
    buffer.needsUpdate = true;
  }
}

function arcPoints(a, m, b) {
  const d = 2 * (a[0] * (m[1] - b[1]) + m[0] * (b[1] - a[1]) + b[0] * (a[1] - m[1]));
  if (Math.abs(d) < 1e-10) return [a, m, b];
  const aa = a[0] ** 2 + a[1] ** 2, mm = m[0] ** 2 + m[1] ** 2, bb = b[0] ** 2 + b[1] ** 2;
  const x = (aa * (m[1] - b[1]) + mm * (b[1] - a[1]) + bb * (a[1] - m[1])) / d;
  const y = (aa * (b[0] - m[0]) + mm * (a[0] - b[0]) + bb * (m[0] - a[0])) / d;
  const start = Math.atan2(a[1] - y, a[0] - x), mid = Math.atan2(m[1] - y, m[0] - x), end = Math.atan2(b[1] - y, b[0] - x);
  const mod = value => (value % TAU + TAU) % TAU;
  const ccw = mod(mid - start) <= mod(end - start), span = ccw ? mod(end - start) : -mod(start - end), radius = Math.hypot(a[0] - x, a[1] - y);
  const n = Math.max(4, Math.ceil(Math.abs(span) * radius / .2));
  return Array.from({ length: n + 1 }, (_, i) => [x + radius * Math.cos(start + span * i / n), y + radius * Math.sin(start + span * i / n)]);
}

function fieldColor(fraction) {
  const stops = [[39, 109, 255], [28, 212, 207], [226, 239, 75], [250, 145, 70], [230, 80, 91]].map(rgb => rgb.map(v => v / 255));
  const p = THREE.MathUtils.clamp(fraction, 0, 1) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(p)), f = p - i;
  return new THREE.Color().setRGB(...stops[i].map((v, n) => v + (stops[i + 1][n] - v) * f), THREE.SRGBColorSpace);
}

function create(container, layout, callbacks = {}) {
  if (!(container instanceof HTMLElement)) throw new Error('A viewport container is required.');
  if (!layout?.components?.length || !layout?.bounds || !layout.source_sha256) throw new Error('Current native PCB geometry is required.');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }); }
  catch (error) { callbacks.onError?.(error); throw new Error('WebGL is unavailable. The native 2D board view remains available.'); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor('#101823', 1);
  renderer.domElement.className = 'workbench3d-canvas'; renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  renderer.domElement.setAttribute('aria-label', 'Interactive native PCB placement with schematic package heights. Drag to orbit, wheel to zoom, right-drag to pan.');
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);
  const note = document.createElement('div'); note.className = 'workbench3d-provenance';
  note.style.cssText = 'position:absolute;left:12px;bottom:10px;max-width:calc(100% - 24px);pointer-events:none;font:10px/1.45 system-ui,sans-serif;color:#bac8d6;background:rgba(10,17,27,.72);padding:5px 8px;border-radius:4px;';
  note.textContent = 'Native placement and routed copper · package heights are schematic proxies · copper zone fills omitted'; container.appendChild(note);
  const positionBefore = container.style.position;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

  const scene = new THREE.Scene(), width = layout.bounds.width, height = layout.bounds.height;
  const toWorld = p => [p[0] - layout.bounds.x - width / 2, height / 2 - (p[1] - layout.bounds.y)];
  const camera = new THREE.PerspectiveCamera(37, 1, .05, 3000); camera.up.set(0, 1, 0);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .12; controls.minDistance = 6; controls.maxDistance = 350; controls.zoomSpeed = .8; controls.panSpeed = .7;
  const ambient = new THREE.HemisphereLight('#d9e7fc', '#4a5568', 2.5); scene.add(ambient);
  const key = new THREE.DirectionalLight('#ffffff', 2.5); key.position.set(-25, 40, 80); scene.add(key);
  const fill = new THREE.DirectionalLight('#a9caff', 1.5); fill.position.set(45, -20, -70); scene.add(fill);
  const order = layout.copper_layer_order || DEFAULT_ORDER, stack = stackDefinition(layout, order);
  const layers = new Map(), batches = [], bodies = [], bodyLookup = new Map(), viaMeshes = [];
  const settings = { visibleLayerIds: [...order], showComponents: true, showTracks: true, showPads: true, showVias: true, showSubstrate: true, explode_mm: 0 };
  const copperMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .55, roughness: .42, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  const copperScalarMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  // Instanced color is independent from per-vertex color. Box/Cylinder geometries
  // have no color attribute, so enabling vertexColors here would multiply instance
  // colors by an unset attribute and turn the resulting diffuse colors dark.
  const bodyMaterial = new THREE.MeshStandardMaterial({ metalness: .16, roughness: .65 });
  const bodyScalarMaterial = new THREE.MeshBasicMaterial();
  const ghostMaterial = new THREE.MeshStandardMaterial({ transparent: true, opacity: .26, wireframe: true, depthWrite: false });
  const ghostScalarMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: .26, wireframe: true, depthWrite: false });
  const viaMaterial = new THREE.MeshStandardMaterial({ metalness: .5, roughness: .5, side: THREE.DoubleSide });
  const viaScalarMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const ownedMaterials = [copperMaterial, copperScalarMaterial, bodyMaterial, bodyScalarMaterial, ghostMaterial, ghostScalarMaterial, viaMaterial, viaScalarMaterial];
  const outline = outlinePoints(layout), shape = new THREE.Shape(outline.map(p => new THREE.Vector2(...toWorld(p))));
  for (const component of layout.components) for (const pad of component.pads || []) {
    if (!pad.through_hole || !(pad.drill?.width > 0)) continue;
    const hole = new THREE.Path(); const [x, y] = toWorld([pad.x, pad.y]);
    hole.absellipse(x, y, pad.drill.width / 2, pad.drill.height / 2, 0, TAU, true, (pad.rotation || 0) * Math.PI / 180); shape.holes.push(hole);
  }
  const substrateGeometry = new THREE.ExtrudeGeometry(shape, { depth: stack.thickness, bevelEnabled: false, curveSegments: 20 }); substrateGeometry.translate(0, 0, -stack.thickness / 2);
  const substrate = new THREE.Mesh(substrateGeometry, new THREE.MeshStandardMaterial({ color: '#163b43', metalness: .08, roughness: .78, transparent: true, opacity: .86 })); scene.add(substrate);
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), vector = new THREE.Vector3(), scale = new THREE.Vector3();

  for (let i = 0; i < order.length; i++) {
    const id = order[i], group = new THREE.Group(); group.position.z = stack.z[id]; scene.add(group);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline.map(p => new THREE.Vector3(...toWorld(p), 0))), new THREE.LineBasicMaterial({ color: LAYER_COLORS[i], transparent: true, opacity: .5 })); group.add(line);
    const kinds = {};
    for (const kind of ['tracks', 'pads', 'vias']) { const batch = new CopperBatch(toWorld, kind === 'pads' ? '#c2ad84' : LAYER_COLORS[i]); batches.push({ id, kind, batch }); kinds[kind] = batch; }
    for (const track of layout.tracks || []) if (track.layer === id) kinds.tracks.track(track);
    for (const component of layout.components) for (const pad of component.pads || []) {
      if (!(pad.layers || []).includes(id)) continue;
      for (const polygon of padPolygons(pad)) kinds.pads.polygon(polygon.points, polygon.holes, { net: pad.net, ref: component.ref });
    }
    for (const via of layout.vias || []) {
      if (!(via.layers || []).includes(id)) continue;
      const diameter = via.diameters?.[id] ?? via.diameter;
      kinds.vias.polygon(ringPoints(via.x, via.y, diameter / 2, diameter / 2, 0, 16), via.drill > 0 ? [ringPoints(via.x, via.y, via.drill / 2, via.drill / 2, 0, 16)] : [], { net: via.net });
    }
    // Draw the visible copper face outside the substrate surface, not underneath it.
    const surfaceOffset = (id === BACK ? -1 : 1) * (stack.copper[i] / 2 + .002);
    for (const batch of Object.values(kinds)) { const mesh = batch.finish(copperMaterial); if (mesh) { mesh.position.z = surfaceOffset; group.add(mesh); } }
    layers.set(id, { group, line, kinds });
  }

  for (const side of ['F', 'B']) for (const ghost of [false, true]) {
    const layerId = side === 'F' ? FRONT : BACK;
    const components = layout.components.filter(c => c.side === side && Boolean(c.dnp || /^H\d/.test(c.ref)) === ghost);
    if (!components.length) continue;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), ghost ? ghostMaterial : bodyMaterial, components.length);
    mesh.userData.componentReferences = components.map(c => c.ref); mesh.userData.ghost = ghost; layers.get(layerId).group.add(mesh);
    components.forEach((component, index) => {
      const proxy = bodyProxy(component), [x, y] = toWorld([proxy.x, proxy.y]);
      const z = (side === 'F' ? 1 : -1) * (proxy.proxyHeight / 2 + .035);
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), proxy.angle);
      matrix.compose(vector.set(x, y, z), quaternion, scale.set(proxy.width, proxy.height, proxy.proxyHeight)); mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, new THREE.Color(ghost ? '#8795a4' : /^U/.test(component.ref) ? '#263a49' : /^J/.test(component.ref) ? '#75808b' : /^L/.test(component.ref) ? '#6b6561' : '#777067'));
      bodyLookup.set(component.ref, { component, proxy, mesh, index, layerId, matrix: matrix.clone() });
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); bodies.push(mesh);
  }

  // Native drill radius and native connected layer span. Copper plating thickness is
  // not available: the barrel is a zero-thickness cylindrical surface, not a solid via.
  const nativeVias = (layout.vias || []).filter(v => v.layers?.length > 1 && v.drill > 0);
  if (nativeVias.length) {
    const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), viaMaterial, nativeVias.length);
    scene.add(mesh); viaMeshes.push({ mesh, vias: nativeVias });
  }

  const selection = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#ffe19a', depthTest: false })); selection.visible = false; selection.renderOrder = 5; scene.add(selection);
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let selected = null, selectedNet = null, overlay = { refs: {}, nets: {}, mode: 'neutral', label: '' }, field = null, fieldGroup = null, fieldMesh = null, destroyed = false, animation = 0, pointerDown = null, hoverRef = null, lastHover = 0;
  const fieldResources = [];

  function status() {
    const info = { source_sha256: layout.source_sha256, footprint_count: layout.components.length, layer_count: order.length, trace_count: layout.tracks?.length || 0, via_count: layout.vias?.length || 0,
      package_heights: 'schematic proxies; no STEP package bodies were loaded', copper_zones: 'not included in source geometry export', stackup_notes: stack.notes,
      explode_mm: settings.explode_mm, field_visible: Boolean(fieldGroup?.visible), field_suspended_reason: field && settings.explode_mm > 0 ? 'Field hidden while copper layers are visually exploded.' : null,
      note: field && settings.explode_mm > 0 ? 'Quantitative field hidden during layer explosion.' : 'Native XY placement; schematic package heights; proposed stackup; copper zone fills omitted.',
      notes: ['Native XY is shared top-view for both sides; B-side XY is not mirrored again.', 'Via barrel surfaces use native drill radius and connected layer span; plating thickness is unavailable.', 'Body dimensions bound native Fab geometry where available; heights are schematic proxies.'] };
    callbacks.onStatus?.(info); return info;
  }

  function recolor() {
    const active = !['neutral', 'none', 'geometry', 'placement', 'magnetic'].includes(overlay.mode);
    for (const { batch } of batches) { batch.recolor(overlay.nets, active, selectedNet); if (batch.mesh) batch.mesh.material = active ? copperScalarMaterial : copperMaterial; }
    for (const [ref, body] of bodyLookup) {
      const fallback = active ? UNKNOWN : body.component.dnp || body.proxy.mechanical ? '#8795a4' : /^U/.test(ref) ? '#263a49' : /^J/.test(ref) ? '#75808b' : /^L/.test(ref) ? '#6b6561' : '#777067';
      body.mesh.setColorAt(body.index, colorValue(mappingValue(overlay.refs, ref)) || new THREE.Color(fallback));
    }
    for (const mesh of bodies) { mesh.material = active ? mesh.userData.ghost ? ghostScalarMaterial : bodyScalarMaterial : mesh.userData.ghost ? ghostMaterial : bodyMaterial; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    for (const { mesh, vias } of viaMeshes) { mesh.material = active ? viaScalarMaterial : viaMaterial; vias.forEach((v, i) => mesh.setColorAt(i, colorValue(mappingValue(overlay.nets, v.net)) || new THREE.Color(active ? UNKNOWN : '#b89464'))); mesh.instanceColor.needsUpdate = true; }
  }

  function updateSelection() {
    const body = bodyLookup.get(selected);
    selection.visible = Boolean(body && settings.showComponents && settings.visibleLayerIds.includes(body.layerId));
    if (!body) return;
    selection.matrixAutoUpdate = false; selection.matrix.copy(body.matrix);
    selection.matrix.elements[14] += layers.get(body.layerId).group.position.z; selection.matrixWorldNeedsUpdate = true;
  }

  function updateLayers() {
    const gap = THREE.MathUtils.clamp(Number(settings.explode_mm) || 0, 0, 10); settings.explode_mm = gap;
    const ids = new Set(settings.visibleLayerIds.map(Number));
    order.forEach((id, i) => { const item = layers.get(id); item.group.position.z = stack.z[id] + ((order.length - 1) / 2 - i) * gap; item.group.visible = ids.has(id); item.line.visible = gap > 0 || !settings.showSubstrate;
      for (const [kind, batch] of Object.entries(item.kinds)) if (batch.mesh) batch.mesh.visible = settings[{ tracks: 'showTracks', pads: 'showPads', vias: 'showVias' }[kind]];
    });
    substrate.visible = settings.showSubstrate && gap === 0;
    for (const mesh of bodies) mesh.visible = settings.showComponents;
    for (const { mesh, vias } of viaMeshes) {
      mesh.visible = settings.showVias;
      vias.forEach((via, i) => {
        const top = via.top_layer ?? via.layers[0], bottom = via.bottom_layer ?? via.layers.at(-1);
        const a = layers.get(top)?.group.position.z, b = layers.get(bottom)?.group.position.z;
        const visible = finite(a) && finite(b) && via.layers.some(id => ids.has(id));
        const [x, y] = toWorld([via.x, via.y]); quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        matrix.compose(vector.set(x, y, visible ? (a + b) / 2 : 0), quaternion, scale.set(visible ? via.drill / 2 : 0, visible ? Math.abs(a - b) : 0, visible ? via.drill / 2 : 0)); mesh.setMatrixAt(i, matrix);
      }); mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    }
    if (fieldGroup) fieldGroup.visible = gap === 0;
    note.textContent = gap > 0 ? 'Exploded display spacing only · fields hidden · package heights are schematic proxies · copper zone fills omitted' : 'Native placement and routed copper · package heights are schematic proxies · copper zone fills omitted';
    updateSelection(); status();
  }

  function setSelection(ref) { selected = bodyLookup.has(ref) ? ref : null; updateSelection(); }
  function setOverlay(colorsByRef = {}, options = {}) { overlay = { refs: colorsByRef || {}, nets: options.colorsByNet || {}, mode: options.mode || 'neutral', label: options.label || '' }; recolor(); }
  function setLayers(options = {}) {
    if (options.visibleLayerIds) settings.visibleLayerIds = [...options.visibleLayerIds].map(Number).filter(id => layers.has(id));
    for (const key of ['showComponents', 'showTracks', 'showPads', 'showVias', 'showSubstrate']) if (key in options) settings[key] = Boolean(options[key]);
    if ('explode_mm' in options) settings.explode_mm = options.explode_mm;
    updateLayers();
  }

  function setCamera(preset = 'isometric') {
    controls.target.set(0, 0, 0); const distance = Math.max(width, height) * 1.95 + settings.explode_mm * 5;
    if (preset === 'front') { camera.position.set(0, 0, distance); camera.up.set(0, 1, 0); }
    else if (preset === 'back') { camera.position.set(0, 0, -distance); camera.up.set(0, 1, 0); }
    else if (preset === 'fit') { camera.position.copy(controls.target).add(camera.position.clone().sub(controls.target).normalize().multiplyScalar(distance)); }
    else { camera.position.set(distance * .30, -distance * .35, distance * .93); camera.up.set(0, 1, 0); }
    camera.lookAt(controls.target); controls.update();
  }

  function disposeField() {
    if (fieldGroup) { fieldGroup.traverse(object => { if (object.isInstancedMesh) object.dispose(); }); scene.remove(fieldGroup); }
    for (const resource of fieldResources.splice(0)) resource.dispose(); fieldGroup = null; fieldMesh = null;
  }

  function setField(input) {
    field = input || null; disposeField();
    if (!input) { status(); return; }
    const { x_mm: xs, y_mm: ys, z_mm: z, values } = input;
    if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length < 2 || ys.length < 2 || !finite(z) || !(z > 0) || !values || values.length !== xs.length * ys.length) throw new Error('Field data require actual x/y coordinates, positive B.Cu-center height and a matching flattened value grid.');
    if (xs.some((x, i) => !finite(x) || i > 0 && x <= xs[i - 1]) || ys.some((y, i) => !finite(y) || i > 0 && y <= ys[i - 1])) throw new Error('Field coordinate arrays must be finite and strictly increasing.');
    fieldGroup = new THREE.Group(); scene.add(fieldGroup); fieldGroup.position.z = stack.z[BACK] - z; fieldGroup.visible = settings.explode_mm === 0;
    const min = input.range?.[0] ?? 0, max = input.range?.[1] ?? Math.max(...Array.from(values).filter(finite));
    const span = max > min ? max - min : 1, nx = xs.length, ny = ys.length, points = [], colors = [], indices = [];
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      points.push(...toWorld([xs[ix], ys[iy]]), 0);
      const value = values[iy * nx + ix], color = finite(value) ? fieldColor((value - min) / span) : new THREE.Color(UNKNOWN); colors.push(color.r, color.g, color.b);
      if (ix < nx - 1 && iy < ny - 1) { const a = iy * nx + ix, b = a + 1, c = a + nx, d = c + 1; if ([values[a], values[b], values[c], values[d]].every(finite)) indices.push(a, c, b, b, c, d); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: input.mode === 'vectors' ? 0 : finite(input.opacity) ? THREE.MathUtils.clamp(input.opacity, .05, 1) : .82, depthWrite: false });
    // Keep a transparent picking plane in vectors-only mode; it does not add a heatmap.
    fieldMesh = new THREE.Mesh(geometry, material); fieldMesh.userData.isField = true; fieldGroup.add(fieldMesh); fieldResources.push(geometry, material);
    const mode = input.mode || 'heatmap';
    if (['vectors', 'both'].includes(mode) && input.bx?.length === values.length && input.by?.length === values.length && input.bz?.length === values.length) {
      const stride = Math.max(1, Math.ceil(Math.max(nx, ny) / 16)), positions = [];
      for (let iy = 0; iy < ny; iy += stride) for (let ix = 0; ix < nx; ix += stride) positions.push(iy * nx + ix);
      const shaftGeometry = new THREE.CylinderGeometry(.016, .016, 1, 5), headGeometry = new THREE.ConeGeometry(.065, .18, 6), arrowMaterial = new THREE.MeshBasicMaterial({ color: '#e7efff' });
      const shafts = new THREE.InstancedMesh(shaftGeometry, arrowMaterial, positions.length), heads = new THREE.InstancedMesh(headGeometry, arrowMaterial, positions.length);
      const alongY = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3(), p = new THREE.Vector3();
      const arrowLength = Math.max(.15, Math.min(.7, (xs.at(-1) - xs[0]) / 20));
      positions.forEach((index, i) => {
        const b = [input.bx[index], input.by[index], input.bz[index]], valid = b.every(finite) && Math.hypot(...b) > 1e-20;
        direction.set(valid ? b[0] : 0, valid ? -b[1] : 1, valid ? -b[2] : 0).normalize(); quaternion.setFromUnitVectors(alongY, direction);
        const iy = Math.floor(index / nx), ix = index % nx; p.set(...toWorld([xs[ix], ys[iy]]), 0);
        matrix.compose(p.clone().addScaledVector(direction, arrowLength * .36), quaternion, scale.set(valid ? 1 : 0, valid ? arrowLength * .72 : 0, valid ? 1 : 0)); shafts.setMatrixAt(i, matrix);
        matrix.compose(p.clone().addScaledVector(direction, arrowLength * .84), quaternion, scale.set(valid ? 1 : 0, valid ? 1 : 0, valid ? 1 : 0)); heads.setMatrixAt(i, matrix);
      });
      shafts.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; fieldGroup.add(shafts, heads); fieldResources.push(shaftGeometry, headGeometry, arrowMaterial);
    }
    status();
  }

  function visible(object) { for (let p = object; p; p = p.parent) if (!p.visible) return false; return true; }
  function hits(event) {
    const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects([...bodies, ...(fieldMesh ? [fieldMesh] : [])], false).filter(hit => visible(hit.object));
  }
  function fieldProbe(hit) {
    if (!field) return;
    const ix = nearest(field.x_mm, hit.point.x + width / 2 + layout.bounds.x), iy = nearest(field.y_mm, height / 2 - hit.point.y + layout.bounds.y);
    callbacks.onFieldProbe?.({ index: iy * field.x_mm.length + ix, x_mm: field.x_mm[ix], y_mm: field.y_mm[iy], z_mm: field.z_mm });
  }
  function down(event) { pointerDown = { x: event.clientX, y: event.clientY, button: event.button }; }
  function up(event) {
    if (!pointerDown || pointerDown.button !== 0 || Math.hypot(pointerDown.x - event.clientX, pointerDown.y - event.clientY) > 5) { pointerDown = null; return; }
    pointerDown = null; const hit = hits(event)[0];
    if (hit?.object.userData.isField) { fieldProbe(hit); return; }
    const ref = hit ? hit.object.userData.componentReferences?.[hit.instanceId] : null; setSelection(ref); callbacks.onSelect?.(ref || null);
  }
  function move(event) {
    if (event.buttons || performance.now() - lastHover < 60) return; lastHover = performance.now();
    const hit = hits(event)[0], ref = hit ? hit.object.userData.componentReferences?.[hit.instanceId] : null;
    renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    if ((ref || null) !== hoverRef) { hoverRef = ref || null; callbacks.onHover?.(hoverRef); }
  }
  function leave() { hoverRef = null; callbacks.onHover?.(null); }
  function resize() { if (destroyed) return; const rect = container.getBoundingClientRect(); const w = Math.max(1, rect.width), h = Math.max(1, rect.height); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function loop() { if (destroyed) return; animation = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); }
  function lost(event) { event.preventDefault(); callbacks.onError?.(new Error('WebGL context was lost; reopen the 3D view to recreate it.')); }
  renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerleave', leave); renderer.domElement.addEventListener('webglcontextlost', lost);
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; observer?.observe(container);
  function destroy() {
    if (destroyed) return; destroyed = true; cancelAnimationFrame(animation); observer?.disconnect(); controls.dispose(); disposeField();
    renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerleave', leave); renderer.domElement.removeEventListener('webglcontextlost', lost);
    const geometries = new Set(), materials = new Set(ownedMaterials); scene.traverse(object => { if (object.isInstancedMesh) object.dispose(); if (object.geometry) geometries.add(object.geometry); if (object.material) for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); renderer.domElement.remove(); note.remove(); container.style.position = positionBefore;
  }
  resize(); setCamera('isometric'); recolor(); updateLayers(); loop();
  return { setOverlay, setLayers, setSelection, setCamera, setField, resize, destroy, status,
    capture(options = {}) {
      if (destroyed) throw new Error('The 3D viewport has been closed.');
      renderer.render(scene, camera);
      const imageWidth = renderer.domElement.width, imageHeight = renderer.domElement.height;
      if (![imageWidth, imageHeight].every(n => Number.isInteger(n) && n > 0)) throw new Error('The viewport must have a finite, nonzero size before export.');
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('A 2D canvas is required to create the annotated PNG.');
      const pixelRatio = renderer.getPixelRatio();
      const ratio = Math.min(finite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1, imageWidth / 240);
      const padding = 12 * ratio, fontSize = 11 * ratio, lineHeight = 15 * ratio, contentWidth = imageWidth - 2 * padding;
      const font = `${fontSize}px sans-serif`;
      ctx.font = font;
      // Wrap long labels and uninterrupted identifiers too; never shrink text with
      // fillText(maxWidth) or clip provenance to the original viewport height.
      function wrap(text, available = contentWidth) {
        const lines = [];
        for (const paragraph of String(text).split(/\r?\n/)) {
          let line = '';
          for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
            if (line && ctx.measureText(`${line} ${word}`).width <= available) { line += ` ${word}`; continue; }
            if (line) { lines.push(line); line = ''; }
            if (ctx.measureText(word).width <= available) { line = word; continue; }
            for (const character of word) {
              if (line && ctx.measureText(line + character).width > available) { lines.push(line); line = ''; }
              line += character;
            }
          }
          lines.push(line);
        }
        return lines;
      }
      const paragraphs = [
        `PCB ${layout.source_sha256} · native XY placement · schematic package heights · copper zone fills omitted`,
        options.label || overlay.label || 'Geometry display'
      ];
      if (fieldGroup?.visible) paragraphs.push(`${field.label || 'Local conditional magnetic field'} · height ${field.z_mm} mm outward from the B.Cu copper center plane · ${field.unit || 'unit not supplied'}`);
      if (settings.explode_mm > 0) paragraphs.push('Exploded spacing is a visualization; the quantitative field is hidden.');
      paragraphs.push(...stack.notes);
      const lines = paragraphs.filter(Boolean).flatMap(text => wrap(text));
      let legend = null;
      if (options.legend) {
        const { range, unit, colors } = options.legend;
        if (!Array.isArray(range) || range.length !== 2 || !range.every(finite) || range[1] < range[0] || !Array.isArray(colors) || colors.length < 2 || !colors.every(c => typeof c === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c))) throw new Error('The export legend needs a finite ordered range and at least two hexadecimal colors.');
        const numberLabel = value => value === 0 ? '0' : Number(value.toPrecision(5)).toString();
        legend = { colors, heading: wrap(`Fixed color scale${unit ? ` · ${String(unit)}` : ''}`), minimum: numberLabel(range[0]), maximum: numberLabel(range[1]), unknown: wrap('Gray = unknown', contentWidth - 18 * ratio) };
        legend.separateEndpoints = ctx.measureText(legend.minimum).width + ctx.measureText(legend.maximum).width + 12 * ratio > contentWidth;
      }
      const legendHeight = legend ? 10 * ratio + (legend.heading.length + legend.unknown.length + (legend.separateEndpoints ? 2 : 1)) * lineHeight + 16 * ratio : 0;
      const footerHeight = Math.ceil(2 * padding + lines.length * lineHeight + legendHeight);
      const outputHeight = imageHeight + footerHeight;
      if (!Number.isSafeInteger(outputHeight) || outputHeight > 32767 || imageWidth > 32767) throw new Error('The annotated PNG exceeds supported canvas dimensions.');
      canvas.width = imageWidth; canvas.height = outputHeight;
      ctx.drawImage(renderer.domElement, 0, 0);
      ctx.fillStyle = '#080f18'; ctx.fillRect(0, imageHeight, imageWidth, footerHeight);
      ctx.font = font; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = '#d7e3f0';
      let y = imageHeight + padding;
      for (const line of lines) { ctx.fillText(line, padding, y); y += lineHeight; }
      if (legend) {
        y += 10 * ratio;
        for (const line of legend.heading) { ctx.fillText(line, padding, y); y += lineHeight; }
        const gradient = ctx.createLinearGradient(padding, 0, imageWidth - padding, 0);
        legend.colors.forEach((color, index) => gradient.addColorStop(index / (legend.colors.length - 1), color));
        ctx.fillStyle = gradient; ctx.fillRect(padding, y, contentWidth, 10 * ratio); y += 16 * ratio;
        ctx.fillStyle = '#d7e3f0'; ctx.fillText(legend.minimum, padding, y);
        if (legend.separateEndpoints) y += lineHeight;
        ctx.textAlign = 'right'; ctx.fillText(legend.maximum, imageWidth - padding, y); ctx.textAlign = 'left'; y += lineHeight;
        ctx.fillStyle = UNKNOWN; ctx.fillRect(padding, y + ratio, 10 * ratio, 10 * ratio);
        ctx.fillStyle = '#d7e3f0';
        for (const line of legend.unknown) { ctx.fillText(line, padding + 18 * ratio, y); y += lineHeight; }
      }
      return canvas.toDataURL('image/png');
    },
    getSelected() { return selected; },
    getComponentInfo(ref) { const b = bodyLookup.get(ref); return b ? { ref, proxy_height_mm: b.proxy.proxyHeight, xy_source: b.proxy.source, side: b.component.side, dnp: b.component.dnp, geometry_only: true } : null; }
  };
}

window.Workbench3D = { create };
window.dispatchEvent(new CustomEvent('workbench3d-ready'));
export { create };
