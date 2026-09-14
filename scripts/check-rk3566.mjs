/** Verify the public RK3566 snapshot and its portfolio entry points using Node builtins. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lab = path.join(root, 'rk3566');
const origin = 'https://portfolio.invalid';
const baseURL = `${origin}/rk3566/`;
const read = (name) => readFile(path.join(root, name), 'utf8');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const shaPattern = /^[a-f0-9]{64}$/;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function safePath(value, label = 'Public path') {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert(value.length > 0 && !/[\\\0?#]/.test(value) && !path.posix.isAbsolute(value), `${label} is not relative: ${value}`);
  const decoded = decodeURIComponent(value);
  assert(!/[\\\0]/.test(decoded) && !decoded.split('/').some((part) => !part || part === '.' || part === '..'), `${label} contains traversal or empty segments: ${value}`);
  assert.equal(path.posix.normalize(value), value, `${label} must be normalized: ${value}`);
  return value;
}
function routeKey(value) {
  assert.equal(typeof value, 'string');
  assert(value.startsWith('/api/') && !/[\\\0#]/.test(value), `Invalid API route: ${value}`);
  const [pathname] = value.split('?');
  safePath(pathname.slice(1), 'API pathname');
  const url = new URL(value, origin);
  assert.equal(url.origin, origin, `External API route: ${value}`);
  for (const key of ['file', 'id']) {
    for (const item of url.searchParams.getAll(key)) safePath(item, `API ${key}`);
  }
  url.searchParams.sort();
  return url.pathname + url.search;
}

const manifest = JSON.parse(await read('rk3566/publication.json'));
assert.equal(manifest.publication_mode, 'snapshot', 'The publication must identify saved evidence');
assert.equal(typeof manifest.generated_at, 'string', 'Missing publication timestamp');
assert(Number.isFinite(Date.parse(manifest.generated_at)), 'Invalid publication timestamp');
assert.match(manifest.source_sha256, shaPattern, 'Missing PCB source identity');
assert(isRecord(manifest.source_hashes) && Object.keys(manifest.source_hashes).length, 'Missing source hash inventory');
for (const [name, hash] of Object.entries(manifest.source_hashes)) {
  assert(name.length > 0, 'Source hash names must not be empty');
  assert.match(hash, shaPattern, `Invalid source identity: ${name}`);
}
assert(Array.isArray(manifest.files) && manifest.files.length > 0, 'Missing evidence inventory');
const inventory = new Map();
let totalBytes = 0;
for (const entry of manifest.files) {
  safePath(entry.path);
  assert(!inventory.has(entry.path), `Duplicate evidence file: ${entry.path}`);
  assert(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0, `Invalid byte count: ${entry.path}`);
  assert.match(entry.sha256, shaPattern, `Invalid file hash: ${entry.path}`);
  const filename = path.join(lab, entry.path);
  assert((await lstat(filename)).isFile(), `Evidence must be a regular file: ${entry.path}`);
  const bytes = await readFile(filename);
  assert.equal(bytes.length, entry.bytes, `Size mismatch: ${entry.path}`);
  assert.equal(sha256(bytes), entry.sha256, `Hash mismatch: ${entry.path}`);
  if (entry.path.endsWith('.json')) JSON.parse(bytes.toString('utf8'));
  inventory.set(entry.path, entry);
  totalBytes += bytes.length;
}

const publicFiles = [];
async function walk(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    safePath(relative);
    assert(!entry.isSymbolicLink(), `Public symlink: ${relative}`);
    assert(!/(?:^|\/)(?:\.git|node_modules|\.env(?:\..*)?)(?:\/|$)/.test(relative), `Development/private file in publication: ${relative}`);
    if (entry.isDirectory()) await walk(path.join(directory, entry.name), `${relative}/`);
    else {
      assert(entry.isFile(), `Unsupported public file: ${relative}`);
      publicFiles.push(relative);
      if (/^(?:data|artifacts|runs)\//.test(relative)) assert(inventory.has(relative), `Unlisted evidence file: ${relative}`);
    }
  }
}
await walk(lab);
assert(isRecord(manifest.routes) && Object.keys(manifest.routes).length, 'Missing static API routes');
assert(isRecord(manifest.responses), 'Missing API response metadata');
const routes = new Map();
for (const [route, destination] of Object.entries(manifest.routes)) {
  const key = routeKey(route);
  safePath(destination, 'Route destination');
  assert(inventory.has(destination), `Route target is missing from evidence inventory: ${route} -> ${destination}`);
  assert(!routes.has(key) || routes.get(key) === destination, `Conflicting API route: ${route}`);
  routes.set(key, destination);
  const response = manifest.responses[route];
  assert(isRecord(response), `Missing response metadata: ${route}`);
  assert(Number.isInteger(response.status) && response.status >= 200 && response.status < 400, `Unsuccessful exported response: ${route}`);
  assert.equal(typeof response.content_type, 'string', `Missing content type: ${route}`);
  assert(response.content_type.includes('/'), `Invalid content type: ${route}`);
}
const viewRoutes = [
  '/api/state', '/api/export', '/api/board-layout', '/api/workbench-layout', '/api/workbench-data',
  '/api/workbench-status', '/api/section-analysis', '/api/section-status', '/api/model-studies',
  '/api/model-study-status', '/api/professional-review', '/api/time-domain', '/api/electric-field',
  '/api/em-export', '/api/em-report', '/api/handoff', '/api/simulation-video-manifest',
  '/api/simulation-video', '/api/simulation-video-poster',
  '/api/board-magnetic-field', '/api/board-magnetic-status', '/api/board-magnetic-report',
];
for (const route of viewRoutes) assert(routes.has(routeKey(route)), `Missing view evidence route: ${route}`);
for (const prefix of ['/api/model-artifact?', '/api/section-artifact?', '/api/professional-artifact?', '/api/em-artifact?']) {
  assert([...routes.keys()].some((route) => route.startsWith(prefix)), `Missing downloadable evidence: ${prefix}`);
}
const routeJSON = async (route) => JSON.parse(await readFile(path.join(lab, routes.get(routeKey(route))), 'utf8'));
const state = await routeJSON('/api/state');
assert.equal(state.board?.sha256, manifest.source_sha256, 'The state and publication must identify the same PCB');
assert(state.result && Array.isArray(state.iterations) && state.iterations.length, 'State needs a result and saved run history');

let references = 0;
async function checkReference(source, reference, asset = false) {
  if (!reference || /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i.test(reference) || reference.includes('${')) return;
  const url = new URL(reference.replaceAll('&amp;', '&'), `${origin}/${source}`);
  if (url.origin !== origin) return;
  if (url.pathname.startsWith('/api/')) {
    assert(routes.has(routeKey(url.pathname + url.search)), `${source}: missing evidence route ${reference}`);
    references++;
    return;
  }
  const pathname = decodeURIComponent(url.pathname).slice(1);
  if (asset) assert(pathname.startsWith('rk3566/'), `${source}: asset escapes the /rk3566/ publication: ${reference}`);
  let info;
  try { info = await lstat(path.join(root, pathname)); } catch { assert.fail(`${source}: missing local reference ${reference}`); }
  if (info.isDirectory()) await lstat(path.join(root, pathname, 'index.html'));
  references++;
}
for (const file of publicFiles.filter((name) => !/^(?:data|artifacts|runs)\//.test(name))) {
  const source = `rk3566/${file}`;
  if (/\.(?:html|css|js|mjs)$/.test(file)) {
    const text = await read(source);
    if (/\.(?:html|js|mjs)$/.test(file)) {
      for (const match of text.matchAll(/\b(src|href|poster)=["']([^"']+)["']/g)) {
        await checkReference(source, match[2], match[1] !== 'href' || /\.(?:css|js)(?:[?#]|$)/.test(match[2]));
      }
      for (const match of text.matchAll(/\b(?:from\s*|import\s*\(?\s*)["']((?:\.\.?\/|\/)[^"']+)["']/g)) await checkReference(source, match[1], true);
    }
    if (file.endsWith('.css')) for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) await checkReference(source, match[1].trim(), true);
  }
}
const html = await read('rk3566/index.html');
const portfolio = vm.createContext({ window: {} });
vm.runInContext(await read('content.js'), portfolio);
const project = vm.runInContext('getProject("rk3566")', portfolio);
assert(project?.links?.some((link) => new URL(link.href, origin).pathname === '/rk3566/'), 'Portfolio project must link to the circuit lab');
for (const link of project.links) await checkReference('index.html', link.href);
assert([...((await read('index.html')).matchAll(/\bhref=["']([^"']+)["']/g))].some((match) => new URL(match[1], origin).pathname === '/rk3566/'), 'Portfolio navigation must link to /rk3566/');

console.log(`RK3566 publication: ${inventory.size} evidence files (${(totalBytes / 1024 / 1024).toFixed(1)} MiB), ${routes.size} API routes, and ${references} local references verified.`);

assert.equal(manifest.schema_version, 1, 'Unsupported publication schema');
assert.equal(totalBytes, manifest.total_bytes, 'Publication byte total disagrees with its inventory');
assert.equal(manifest.source_inputs_unchanged, true, 'Source inputs changed during the export');
assert.match(manifest.engine_sha256, shaPattern, 'Missing simulation engine identity');
assert.equal(state.engine_sha256, manifest.engine_sha256, 'State and publication identify different engines');
assert(Object.entries(manifest.source_hashes).some(([name, hash]) => name.endsWith('.kicad_pcb') && hash === manifest.source_sha256), 'PCB identity is absent from native source inventory');
for (const name of Object.keys(manifest.source_hashes)) safePath(name, 'Source inventory path');
assert(Array.isArray(manifest.runs) && manifest.runs.length, 'Missing retained run inventory');
assert.equal(new Set(manifest.runs).size, manifest.runs.length, 'Duplicate retained run IDs');
assert.deepEqual(new Set(manifest.runs), new Set(state.iterations.map((entry) => entry.id)), 'The run inventory and visible history disagree');
assert(manifest.runs.includes(manifest.selected_run), 'Selected run is absent from publication');
assert.equal(state.result.id, manifest.selected_run, 'The opening result is not the declared selected run');
assert(isRecord(manifest.compositions), 'Missing selected-run export recipes');
for (const [route, recipe] of Object.entries(manifest.compositions)) {
  const url = new URL(routeKey(route), origin);
  assert.equal(url.pathname, '/api/export', `Unexpected composed route: ${route}`);
  const id = url.searchParams.get('id');
  assert(manifest.runs.includes(id), `Composed export references an unknown run: ${route}`);
  assert.equal(routeKey(recipe.base), '/api/export', `Invalid export base: ${route}`);
  assert.equal(routeKey(recipe.iteration), routeKey(`/api/iteration?id=${encodeURIComponent(id)}`), `Export recipe selects the wrong run: ${route}`);
  for (const reference of [recipe.base, recipe.iteration]) assert(routes.has(routeKey(reference)), `Composed export input is absent: ${reference}`);
}
for (const id of manifest.runs) {
  safePath(id, 'Run ID');
  const route = `/api/iteration?id=${encodeURIComponent(id)}`;
  assert(routes.has(routeKey(route)), `Missing saved iteration: ${id}`);
  assert(manifest.compositions[`/api/export?id=${encodeURIComponent(id)}`], `Missing selected-run export: ${id}`);
  const iteration = await routeJSON(route);
  assert.equal(iteration.result?.id, id, `Iteration route serves the wrong result: ${id}`);
  assert.equal(iteration.board?.sha256, manifest.source_sha256, `Iteration state has a different board identity: ${id}`);
}
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map((match) => new URL(match[1], baseURL).pathname);
const adapterIndex = scripts.indexOf('/rk3566/publication.js');
assert(adapterIndex >= 0 && adapterIndex < scripts.indexOf('/rk3566/app.js'), 'Snapshot transport must load before the application');
assert(/snapshot/i.test(html), 'The page must disclose that it presents a saved snapshot');

// Exercise the shipped transport with filesystem-backed HTTP responses. Any attempt to
// contact a server API is a failure, including unknown routes and mutation requests.
let nativeCalls = 0;
const browser = {
  URL, URLSearchParams, Request, Response, Headers, Blob, DOMException,
  AbortController, setTimeout, clearTimeout,
  document: {
    currentScript: { src: `${baseURL}publication.js` },
    baseURI: baseURL,
    readyState: 'loading',
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  },
  async fetch(input, options = {}) {
    nativeCalls++;
    const url = new URL(typeof input === 'string' ? input : input.url || input.href, baseURL);
    assert.equal(url.origin, origin, `Snapshot attempted an external request: ${url.href}`);
    assert(url.pathname.startsWith('/rk3566/'), `Snapshot attempted a live server request: ${url.href}`);
    assert(['GET', 'HEAD'].includes(String(options.method || input.method || 'GET').toUpperCase()), 'Native fetch must only read files');
    const filename = decodeURIComponent(url.pathname.slice('/rk3566/'.length));
    safePath(filename, 'Requested snapshot file');
    const bytes = await readFile(path.join(lab, filename));
    return new Response(bytes, { headers: { 'Content-Type': filename.endsWith('.json') ? 'application/json' : 'application/octet-stream' } });
  },
};
browser.window = browser;
const runtime = vm.createContext(browser);
vm.runInContext(await read('rk3566/publication.js'), runtime, { filename: 'publication.js' });
const snapshot = browser.RKSnapshot;
assert(snapshot && typeof snapshot.fetch === 'function', 'Missing snapshot transport');
await snapshot.ready;
assert.equal(snapshot.manifest.source_sha256, manifest.source_sha256, 'Transport loaded the wrong publication');
for (const [route, file] of Object.entries(manifest.routes)) {
  const response = await snapshot.fetch(route);
  const metadata = manifest.responses[route];
  assert.equal(response.status, metadata.status, `Wrong HTTP status: ${route}`);
  assert.equal(response.headers.get('content-type'), metadata.content_type, `Wrong media type: ${route}`);
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(body.length, inventory.get(file).bytes, `Transport truncated evidence: ${route}`);
  assert.equal(sha256(body), inventory.get(file).sha256, `Transport returned the wrong evidence: ${route}`);
  assert.equal(snapshot.url(route), new URL(file, baseURL).href, `Download link targets the wrong file: ${route}`);
}
let blockedWrites = 0;
for (const route of ['/api/run', '/api/campaign', '/api/stop', '/api/state']) {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const before = nativeCalls;
    const response = await snapshot.fetch(route, { method, body: '{}' });
    assert.equal(response.status, 405, `${method} ${route} must be refused`);
    assert((await response.json()).error, 'Refused writes need an explanatory error');
    assert.equal(nativeCalls, before, `${method} ${route} reached native fetch`);
    blockedWrites++;
  }
}
for (const input of ['/api/not-published', '/api/iteration?id=missing', '/api/model-artifact?file=../../secret']) {
  const before = nativeCalls;
  assert.equal((await snapshot.fetch(input)).status, 404, `Unknown evidence must be unavailable: ${input}`);
  assert.equal(nativeCalls, before, 'Unknown evidence must not reach native fetch');
}
const request = new Request(`${origin}/api/run`, { method: 'POST', body: '{}' });
assert.equal((await snapshot.fetch(request)).status, 405, 'A Request object must not bypass write protection');
const requestedState = await snapshot.fetch(new Request(`${origin}/api/state`));
assert.equal((await requestedState.json()).result.id, manifest.selected_run, 'GET Request object failed');
const urlState = await snapshot.fetch(new URL(`${origin}/api/state`));
assert.equal((await urlState.json()).result.id, manifest.selected_run, 'GET URL object failed');
const head = await snapshot.fetch('/api/state', { method: 'HEAD' });
assert.equal(head.status, 200, 'HEAD should return recorded metadata');
assert.equal((await head.arrayBuffer()).byteLength, 0, 'HEAD must not return a response body');

const originalExport = await routeJSON('/api/export');
const exportCount = Object.keys(originalExport.all_run_results).length;
assert.equal(exportCount, manifest.runs.length, 'Full evidence export omits retained runs');
for (const id of manifest.runs) {
  const response = await snapshot.fetch(`/api/export?id=${encodeURIComponent(id)}`);
  assert.equal(response.status, 200, `Selected-run export failed: ${id}`);
  const exported = await response.json();
  const original = originalExport.all_run_results[id];
  assert(original, `Full export omits result ${id}`);
  const iteration = await routeJSON(`/api/iteration?id=${encodeURIComponent(id)}`);
  // JSON serialization normalizes signed zero; compare the serializable values.
  assert.equal(sha256(JSON.stringify(exported.result)), sha256(JSON.stringify(iteration.result)), `Selected export changed recorded evidence: ${id}`);
  for (const key of Object.keys(original)) assert.equal(sha256(JSON.stringify(exported.result[key])), sha256(JSON.stringify(original[key])), `Selected export changed retained ${key}: ${id}`);
  assert.equal(exported.board.sha256, manifest.source_sha256, 'Selected export lost board provenance');
  assert.equal(Object.keys(exported.all_run_results).length, exportCount, 'Selected export dropped retained history');
}
assert.equal((await (await snapshot.fetch('/api/state')).json()).result.id, manifest.selected_run, 'Selecting an export must not change the opening snapshot');
console.log(`RK3566 transport: ${routes.size} byte-exact GET routes, ${manifest.runs.length} selected-run exports, and ${blockedWrites + 1} blocked writes verified.`);
