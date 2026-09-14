/** Independent public-data/physics checks for the conditional whole-board B map. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lab = path.join(root, 'rk3566');
const json = async (name) => JSON.parse(await readFile(path.join(lab, name), 'utf8'));
const [data, layout, state, manifest] = await Promise.all([
  json('data/board-magnetic-field.json'), json('data/board-layout.json'),
  json('data/state.json'), json('publication.json'),
]);
const magnetic = data.magnetic;
const run = state.result;
const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const vector = (v) => Array.isArray(v) && v.length === 3 && v.every(finite);
const close = (actual, expected, label, relative = 1e-9, absolute = 1e-8) => {
  assert(finite(actual) && finite(expected), `${label}: nonfinite value`);
  assert(Math.abs(actual - expected) <= absolute + relative * Math.abs(expected), `${label}: ${actual} != ${expected}`);
};
const closeVector = (actual, expected, label, relative, absolute) => {
  assert(vector(actual) && vector(expected), `${label}: malformed vector`);
  actual.forEach((v, axis) => close(v, expected[axis], `${label} axis ${axis}`, relative, absolute));
};
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a.reduce((n, v, i) => n + v*b[i], 0);

// Endpoint-vector closed form, independent of the generator's tangent/radius
// projection algorithm. Positions are mm; 1e5 converts (mu0/4pi)/mm to nT/A.
// See Oregon State's finite-wire derivation:
// https://books.physics.oregonstate.edu/GSF/wire.html
function endpointWire(start, end, position) {
  const r1 = position.map((v, i) => v-start[i]);
  const r2 = position.map((v, i) => v-end[i]);
  const n1 = Math.hypot(...r1), n2 = Math.hypot(...r2);
  const product = cross(r1, r2);
  if (Math.hypot(...product) === 0) return [0, 0, 0];
  const denominator = n1*n2*(n1*n2 + dot(r1, r2));
  assert(denominator > 0, 'Independent kernel sample must be off the filament');
  const scale = 1e5*(n1+n2)/denominator;
  return product.map((v) => v*scale);
}
function endpointLoop(segments, position) {
  const result = [0, 0, 0];
  for (const segment of segments) endpointWire(segment.start, segment.end, position).forEach((v, i) => { result[i] += v; });
  return result;
}
// Analytic straight-wire orientation, linearity and closed square-loop limits.
const symmetricWire = endpointWire([0, 0, -10], [0, 0, 10], [3, 0, 0]);
closeVector(symmetricWire, [0, 200000/3 * 10/Math.sqrt(109), 0], 'finite straight wire');
closeVector(endpointWire([0, 0, 10], [0, 0, -10], [3, 0, 0]), symmetricWire.map((v) => -v), 'reversed wire');
const square = [[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]].map((start, i, points) => ({ start, end: points[(i+1)%4] }));
closeVector(endpointLoop(square, [0,0,0]), [0,0,4e5*Math.SQRT2], 'closed square loop');

assert.equal(data.schema_version, 1);
assert.equal(data.status, 'conditional');
for (const flag of ['source_current','model_current','input_current']) assert.equal(data[flag], true, `Published ${flag} must be current`);
assert.equal(data.source_sha256, manifest.source_sha256);
assert.equal(data.source_sha256, layout.source_sha256);
assert.equal(data.source_sha256, run.source_sha256);
assert.equal(data.engine_sha256, run.engine_sha256);
assert.equal(data.engine_sha256, manifest.engine_sha256);
assert.equal(data.selected_run_id, run.id);
assert.match(data.calculation_sha256, /^[a-f0-9]{64}$/);
assert.equal(data.model_code_sha256, data.input_hashes['simulation/board_magnetic.py']);
assert.equal(data.input_hashes['simulation/engine.py'], data.engine_sha256);
assert.match(magnetic.coordinates, /B[.]Cu center plane/);
assert.match(magnetic.coordinates, /regardless of actual component side or routing layer/);
assert.equal(magnetic.observation_side, 'back');
assert.equal(magnetic.forward_plane_z_mm, 0);
close(magnetic.assumed_return_z_mm, -0.1015, 'declared copper-center return depth');
assert.equal(magnetic.units, 'nT/A');
assert.match(data.coverage.signal_currents, /unknown and excluded/);
assert.match(data.coverage.load_current_distribution, /no current assigned to an individual component/);
assert(data.limitations.some((note) => /unlocated.*not assigned zero/.test(note)), 'Unlocated currents must remain physically unknown');
assert(magnetic.validation.checks.every((check) => check.status === 'pass'), 'Generator validation failure');

const loops = magnetic.loops;
const ids = loops.map((loop) => loop.id);
assert.equal(new Set(ids).size, ids.length, 'A rail current must not be duplicated');
assert.equal(data.coverage.rail_count, run.rails.length);
assert.equal(data.coverage.modeled_rail_count, loops.length);
assert.deepEqual(new Set(data.coverage.included_rails), new Set(ids));
const unsupported = data.coverage.unsupported_rails;
assert(unsupported.every((row) => typeof row.reason === 'string' && row.reason.length > 20));
assert.deepEqual(new Set([...ids, ...unsupported.map((row) => row.net)]), new Set(run.rails.map((rail) => rail.net)));
assert.equal(ids.length + unsupported.length, run.rails.length, 'Rails must be included or explicitly unlocated once');
assert(unsupported.some((row) => row.net === 'VCC3V3_SD'), 'Capacitor-only SD rail must not acquire an invented steady-load location');
for (const rail of ['5V_SOC','VCC_3V3_SBC','VDD_CPU','VDD_GPU','VCC_DDR','WIFI_VBAT','CAM_1V5','CAM_1V8','CAM_2V8','3V3_PER','3V3_AUDIO']) assert(ids.includes(rail), `Missing board region current: ${rail}`);
assert.deepEqual(data.waveforms.time_ms, run.waveforms.time_ms, 'Current time axis must retain saved samples exactly');
assert(data.waveforms.time_ms.every((v, i, times) => finite(v) && (!i || v > times[i-1])));
const savedRows = new Map(run.waveforms.series.map((row) => [row.name, row]));
const rows = new Map(data.waveforms.series.map((row) => [row.name, row]));
assert.equal(rows.size, loops.length, 'There must be exactly one saved current waveform per included rail');
const parts = new Map(layout.components.map((part) => [part.ref, part]));
const rails = new Map(run.rails.map((rail) => [rail.net, rail]));
function checkAnchor(anchor, net) {
  const part = parts.get(anchor.ref);
  assert(part && !part.dnp, `${net}: missing populated native anchor ${anchor.ref}`);
  assert.equal(anchor.side, part.side);
  assert.equal(anchor.net, net);
  const pads = [...new Map(part.pads.filter((pad) => pad.net === net && pad.number).map((pad) => [JSON.stringify([String(pad.number),pad.x,pad.y]), pad])).values()];
  assert(pads.length > 0, `${net}: anchor must have a native terminal on this net`);
  assert.deepEqual(anchor.pad_numbers, [...new Set(pads.map((pad) => String(pad.number)))].sort());
  assert.deepEqual(anchor.pad_positions_mm, pads.map((pad) => [pad.x,pad.y]));
  closeVector(anchor.position_mm, [pads.reduce((n,p) => n+p.x, 0)/pads.length, pads.reduce((n,p) => n+p.y, 0)/pads.length, 0], `${net} projected native anchor`);
  assert.equal(anchor.provenance, 'native_terminal_xy_centroid');
}
for (const loop of loops) {
  assert.equal(loop.id, loop.net);
  assert.equal(loop.current_series, `${loop.net} current`);
  const row = rows.get(loop.current_series);
  assert(row && row.net === loop.net && row.unit === 'A', `${loop.net}: current mapping/units`);
  assert.deepEqual(row, savedRows.get(loop.current_series), `${loop.net}: current samples must not be fabricated/rescaled`);
  assert(row.values.every(finite) && row.values.length === data.waveforms.time_ms.length);
  const rail = rails.get(loop.net);
  assert.equal(loop.source_anchor.ref, rail.kind === 'buck' ? rail.inductor_ref : rail.source_ref, `${loop.net}: source must be the rail output terminal`);
  checkAnchor(loop.source_anchor, loop.net);
  assert(loop.load_anchors.length > 0);
  assert.equal(new Set(loop.load_anchors.map((anchor) => anchor.ref)).size, loop.load_anchors.length, 'One geometric anchor per load package');
  loop.load_anchors.forEach((anchor) => checkAnchor(anchor, loop.net));
  closeVector(loop.aggregate_load_position_mm, [0,1,2].map((axis) => loop.load_anchors.reduce((n,anchor) => n+anchor.position_mm[axis], 0)/loop.load_anchors.length), `${loop.net} virtual aggregate sink`);
  assert.equal(loop.geometry_status, 'hypothetical_planar_closed_loop');
  assert.equal(loop.segments.length, 4);
  for (const [i, segment] of loop.segments.entries()) {
    assert(vector(segment.start) && vector(segment.end));
    closeVector(segment.end, loop.segments[(i+1)%4].start, `${loop.net}: closed loop`);
    assert(segment.provenance.startsWith('assumed_'), `${loop.net}: hypothetical route must not claim native copper`);
    assert(segment.detail.length > 20);
  }
  closeVector(loop.segments[0].start, loop.source_anchor.position_mm, `${loop.net}: forward source`);
  closeVector(loop.segments[0].end, loop.aggregate_load_position_mm, `${loop.net}: forward load`);
  close(loop.segments[2].start[2], magnetic.assumed_return_z_mm, `${loop.net}: return plane`);
  close(loop.segments[2].end[2], magnetic.assumed_return_z_mm, `${loop.net}: return plane`);
}

const keys = ['bx_nt_per_a','by_nt_per_a','bz_nt_per_a'];
let compared = 0;
assert.deepEqual(magnetic.field_grids.map((grid) => grid.z_mm), [1,2,5]);
for (const grid of magnetic.field_grids) {
  assert.equal(grid.extent, 'whole_board');
  for (const [axis, origin, size] of [['x',layout.bounds.x,layout.bounds.width],['y',layout.bounds.y,layout.bounds.height]]) {
    const values = grid[`${axis}_mm`];
    assert.equal(values.length, grid[`n${axis}`]);
    close(values[0], origin, `${axis} whole-board beginning`);
    close(values.at(-1), origin+size, `${axis} whole-board end`);
    const step = size/(values.length-1);
    assert(step > 0 && step <= 0.5, 'Field grid spacing must retain the validated spatial resolution');
    values.forEach((value, i) => close(value, origin+i*step, `${axis} uniform grid`));
  }
  assert.deepEqual(grid.kernels.map((kernel) => kernel.loop_id), ids);
  for (const [loopIndex, kernel] of grid.kernels.entries()) {
    const loop = loops[loopIndex];
    keys.forEach((key) => assert(kernel[key].length === grid.nx*grid.ny && kernel[key].every(finite), `${kernel.loop_id}: finite full-grid vector ${key}`));
    const points = new Set([0, grid.nx-1, (grid.ny-1)*grid.nx, grid.nx*grid.ny-1, Math.floor(grid.ny/2)*grid.nx+Math.floor(grid.nx/2)]);
    for (const position of [loop.source_anchor.position_mm, loop.aggregate_load_position_mm, loop.source_anchor.position_mm.map((v,i) => (v+loop.aggregate_load_position_mm[i])/2)]) {
      const ix = Math.min(grid.nx-1, Math.max(0, Math.round((position[0]-grid.x_mm[0])/grid.spacing_mm[0])));
      const iy = Math.min(grid.ny-1, Math.max(0, Math.round((position[1]-grid.y_mm[0])/grid.spacing_mm[1])));
      points.add(iy*grid.nx+ix);
    }
    for (const index of points) {
      const position = [grid.x_mm[index%grid.nx],grid.y_mm[Math.floor(index/grid.nx)],grid.z_mm];
      closeVector(keys.map((key) => kernel[key][index]), endpointLoop(loop.segments, position), `${loop.net} grid kernel at ${position}`, 1e-6, 1e-5);
      compared++;
    }
  }
}
for (const probe of magnetic.probes) {
  assert.deepEqual(probe.coefficients.map((row) => row.loop_id), ids);
  for (const [i, coefficient] of probe.coefficients.entries()) closeVector(keys.map((key) => coefficient[key]), endpointLoop(loops[i].segments, probe.position_mm), `${loops[i].net} direct probe`, 1e-8, 1e-5);
}

// Exercise the actual shipped display arithmetic: vector signs and nT-to-uT
// conversion matter, and absent currents must never silently become zero.
const sandbox = { window: {} };
vm.runInNewContext(await readFile(path.join(lab, 'workbench-math.js'), 'utf8'), sandbox);
const math = sandbox.window.WorkbenchMath;
assert.equal(typeof math?.sumMagnetic, 'function');
assert.equal(typeof math?.boardSourceMatches, 'function');
assert.equal(math.boardSourceMatches(data, layout, state), true, 'The actual published dataset must pass the displayed-source guard');
const validSource = { ...data, source_current:true, model_current:true, input_current:true };
assert.equal(math.boardSourceMatches(validSource, layout, state), true, 'Matching saved field/current inputs should be available');
for (const flag of ['source_current','model_current','input_current']) {
  for (const value of [false, undefined, null]) assert.equal(math.boardSourceMatches({ ...validSource, [flag]:value }, layout, state), false, `${flag}: absent/stale data must disable fields`);
}
for (const field of ['source_sha256','engine_sha256']) {
  for (const value of ['', undefined, null, 'mismatched']) assert.equal(math.boardSourceMatches({ ...validSource, [field]:value }, layout, state), false, `${field}: missing or mismatched identity must disable fields`);
}
assert.equal(math.boardSourceMatches(validSource, { ...layout, source_current:false }, state), false, 'Stale native geometry must disable fields');
assert.equal(math.boardSourceMatches(validSource, layout, { ...state, source_current:false }), false, 'Stale board source must disable fields');
assert.equal(math.boardSourceMatches(validSource, layout, { ...state, engine_sha256:undefined }), false, 'Unknown engine identity must disable fields');
assert.equal(math.boardSourceMatches(validSource, layout, { ...state, board:{} }), false, 'Unknown board identity must disable fields');
assert.equal(math.boardSourceMatches(null, layout, state), false, 'Missing field dataset must disable fields');
// This view intentionally retains its named saved run when another history row
// is selected; it must not silently substitute that other row's current samples.
assert.equal(math.boardSourceMatches(validSource, layout, { ...state, result:{ ...run, id:'another-saved-run' } }), true);
const sample = data.waveforms.time_ms.length-1;
const finalCurrents = Object.fromEntries(loops.map((loop) => [loop.id, rows.get(loop.current_series).values[sample]]));
const finalGrid = magnetic.field_grids[0], finalField = math.sumMagnetic(finalGrid, finalCurrents);
assert(finalField, 'Actual saved current channels must produce a field');
for (const index of [0, finalGrid.nx-1, Math.floor(finalGrid.ny/2)*finalGrid.nx+Math.floor(finalGrid.nx/2), finalGrid.nx*finalGrid.ny-1]) {
  const position = [finalGrid.x_mm[index%finalGrid.nx], finalGrid.y_mm[Math.floor(index/finalGrid.nx)], finalGrid.z_mm];
  const expected = [0,0,0];
  for (const loop of loops) endpointLoop(loop.segments, position).forEach((v, axis) => { expected[axis] += v*finalCurrents[loop.id]/1000; });
  closeVector([finalField.bx[index],finalField.by[index],finalField.bz[index]], expected, 'Actual saved-current vector superposition', 2e-6, 1e-5);
  close(finalField.values[index], Math.hypot(...expected), 'Actual saved-current magnitude after superposition', 2e-6, 1e-5);
}
const synthetic = { nx: 1, ny: 1, kernels: [
  { loop_id:'a', bx_nt_per_a:[3000], by_nt_per_a:[4000], bz_nt_per_a:[0] },
  { loop_id:'b', bx_nt_per_a:[-3000], by_nt_per_a:[-4000], bz_nt_per_a:[0] },
] };
close(math.sumMagnetic(synthetic, { a:1, b:0 }).values[0], 5, 'nT/A to uT vector magnitude');
close(math.sumMagnetic(synthetic, { a:1, b:1 }).values[0], 0, 'opposing vector contributions cancel');
close(math.sumMagnetic(synthetic, { a:-2, b:0 }).values[0], 10, 'negative current retains vector sign');
for (const currents of [{ a:1 },{ a:1,b:null },{ a:1,b:NaN },{ a:1,b:'0' }]) assert.equal(math.sumMagnetic(synthetic, currents), null, 'Unknown current must make the field unavailable');
for (const value of [0, 0.00001, 1, 79.123, 160, 999]) {
  const index = math.nearest(data.waveforms.time_ms, value);
  const distance = Math.abs(data.waveforms.time_ms[index]-value);
  assert(data.waveforms.time_ms.every((time) => Math.abs(time-value) >= distance-1e-12), 'Source time must use a nearest saved sample');
}
console.log(`Whole-board magnetic data: ${loops.length}/${run.rails.length} rail contributions, ${magnetic.field_grids.length} full-board heights, ${compared} independent kernel samples, native anchors, exact current provenance, and display vector arithmetic verified.`);
