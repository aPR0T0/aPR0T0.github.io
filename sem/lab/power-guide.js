/**
 * Source of truth: ./power-design-data.js exports `designs`, keyed `current`
 * and `collector`. No circuit values or check results are invented here.
 *
 * Each design has the following plain-text fields:
 * title, revision, input, rails, bias, dataInterface, summary,
 * image (image URL), schematic (image/PDF/source URL), packageURL,
 * downloads: [{label, url}],
 * connections: [{connector, pin, from, to, note}],
 * powerSteps: [{title, detail, reference}],
 * signalSteps: [{title, detail, reference}],
 * checks: [{label, value}], limits: [string], sources: [{label, url}].
 *
 * Optional plain-text fields: sourceLabel (PCB source filename), imageCaption,
 * schematicCaption, isolationTitle, isolationDetail. Source provenance and
 * isolation descriptions should be supplied by the design author.
 * URLs resolve relative to power.html. Values are rendered as text, not HTML.
 */

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const METHODS = {current: 'Specimen current', collector: 'Biased collector'};
let designs = {};
let selectedMethod = 'current';
let currentConnections = [];
let printDetails = [];
let printFilter = 'all';

function plain(value, fallback = 'Not specified in design data') {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function items(value) { return Array.isArray(value) ? value : []; }

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeURL(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}

function setLink(node, value) {
  const url = safeURL(value);
  if (url) node.href = url;
  else node.removeAttribute('href');
  return Boolean(url);
}

function makeLink(label, url, className = '') {
  const node = element('a', className, plain(label, 'Design file'));
  if (!setLink(node, url)) return null;
  return node;
}

function requestedMethod() {
  const method = new URL(window.location.href).searchParams.get('method');
  return Object.hasOwn(METHODS, method) ? method : 'current';
}

function updateURL(method) {
  const url = new URL(window.location.href);
  url.searchParams.set('method', method);
  if (url.href !== window.location.href) window.history.pushState({method}, '', url);
}

function showUnavailable(message) {
  $('#design-content').hidden = true;
  $('#loading-status').hidden = false;
  $('#loading-status').className = 'unavailable';
  $('#loading-status').textContent = message;
  document.title = `${METHODS[selectedMethod]} · Detector board data unavailable · Beam Lab`;
}

function renderFacts(design) {
  const facts = [
    ['DC input', design.input], ['Local rails', design.rails],
    ['Detector bias', design.bias], ['Data connection', design.dataInterface],
  ];
  $('#design-facts').replaceChildren(...facts.map(([label, value]) => {
    const row = element('div');
    row.append(element('dt', '', label), element('dd', '', plain(value)));
    return row;
  }));
}

function renderSteps(target, value) {
  const steps = items(value);
  // Three columns keep labels readable; ordered numbers preserve sequence
  // when a longer path wraps. Mobile always uses one continuous vertical path.
  const columns = Math.min(3, steps.length || 1);
  target.style.setProperty('--step-columns', columns);
  target.replaceChildren(...steps.map((step, index) => {
    const node = element('li', (index + 1) % columns === 0 ? 'flow-row-end' : '');
    node.append(
      element('span', 'step-number', String(index + 1).padStart(2, '0')),
      element('h4', '', plain(step.title, 'Unnamed stage')),
      element('p', '', plain(step.detail)),
    );
    if (step.reference) node.append(element('div', 'step-reference', String(step.reference)));
    return node;
  }));
  if (!steps.length) target.append(element('li', '', 'Path details are not supplied in this revision’s metadata.'));
}

function renderBoard(design) {
  const imageURL = safeURL(design.image);
  $('#board-image-unavailable').textContent = 'Board image is not supplied in this revision’s metadata.';
  $('#board-image-unavailable').hidden = Boolean(imageURL);
  $('#board-image-link').hidden = !imageURL;
  const image = $('#board-image');
  image.removeAttribute('src');
  image.alt = `${plain(design.title, METHODS[selectedMethod])}, ${plain(design.revision, 'selected revision')}: PCB view. Match connector references with the pin schedule below.`;
  image.onerror = () => {
    $('#board-image-link').hidden = true;
    $('#board-image-unavailable').hidden = false;
    $('#board-image-unavailable').textContent = 'The board image could not be loaded. Open the PCB source in the design files below.';
  };
  if (imageURL) {
    image.src = imageURL;
    $('#board-image-link').href = imageURL;
    $('#board-image-link').setAttribute('aria-label', 'Open the full-size PCB image');
  }
  $('#board-caption').textContent = plain(design.imageCaption, design.sourceLabel ? `Source: ${design.sourceLabel}. Connector references match this source revision.` : 'Image supplied with this design. Open the matching PCB source to inspect connector references and pin numbers.');
  $('#board-figure-revision').textContent = plain(design.revision, 'Revision not specified');
  const pcbSource = items(design.downloads).find(file => /\.kicad_pcb(?:[?#]|$)/i.test(file.url || ''));
  if (!setLink($('#board-source-link'), pcbSource?.url)) $('#board-source-link').href = '#files';

  const schematicURL = safeURL(design.schematic);
  const content = $('#schematic-content');
  content.replaceChildren();
  if (!schematicURL) {
    content.append(element('p', 'asset-unavailable', 'No schematic URL is supplied in this revision’s metadata.'));
    return;
  }
  const link = makeLink('Open the full schematic ↗', schematicURL, 'schematic-link');
  content.append(link);
  if (/\.(svg|png|jpe?g|webp)(?:[?#]|$)/i.test(schematicURL)) {
    const schematicImage = element('img', 'schematic-image');
    schematicImage.alt = `${plain(design.title, METHODS[selectedMethod])}: source schematic. Use the full schematic link for detailed pin labels.`;
    schematicImage.src = schematicURL;
    schematicImage.loading = 'lazy';
    schematicImage.onerror = () => { schematicImage.hidden = true; };
    content.append(schematicImage);
  }
  content.append(element('p', 'schematic-caption', plain(design.schematicCaption, 'Schematic supplied for the selected design revision. Open the original file for legible net names and complete pin detail.')));
}

function renderConnectorIndex() {
  const groups = new Map();
  for (const connection of currentConnections) {
    const name = plain(connection.connector, 'Unlabelled connector');
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(connection);
  }
  const select = $('#connector-filter');
  select.replaceChildren(element('option', '', 'All connectors'));
  select.firstElementChild.value = 'all';
  $('#connector-index').replaceChildren(...[...groups].map(([name, pins]) => {
    const option = element('option', '', name);
    option.value = name;
    select.append(option);
    const link = element('a', 'connector-jump');
    link.href = '#connections';
    const pinText = pins.map(pin => plain(pin.pin, '?')).join(' / ');
    const content = element('span');
    content.append(element('small', '', `Pins ${pinText}`));
    // From/to are electrical endpoints, so they stay in the wiring schedule;
    // the index contains only exact connector names and actual pin numbers.
    link.append(element('strong', '', name), content, element('span', '', '↗'));
    link.setAttribute('aria-label', `Show ${name} connections, pins ${pinText}`);
    link.addEventListener('click', () => {
      select.value = name;
      renderConnections();
    });
    return link;
  }));
  if (!groups.size) $('#connector-index').append(element('p', 'index-note', 'No connector schedule supplied.'));
  select.disabled = !groups.size;
  $('#reset-filter').hidden = true;
}

function renderConnections() {
  const filter = $('#connector-filter').value;
  const connections = currentConnections.filter(connection => filter === 'all' || plain(connection.connector, 'Unlabelled connector') === filter);
  $('#connection-rows').replaceChildren(...connections.map(connection => {
    const row = element('tr');
    const name = element('td', '', plain(connection.connector, 'Unlabelled connector'));
    name.dataset.label = 'BOARD CONNECTOR / PIN';
    name.append(element('span', 'pin-label', `Pin ${plain(connection.pin, 'not specified')}`));
    row.append(name);
    for (const [label, value] of [['FROM', connection.from], ['TO', connection.to], ['CONNECTION DETAIL', connection.note]]) {
      const cell = element('td', '', plain(value));
      cell.dataset.label = label;
      row.append(cell);
    }
    return row;
  }));
  $('#connections-empty').hidden = Boolean(connections.length);
  $('.table-shell').hidden = !connections.length;
  $('#reset-filter').hidden = filter === 'all';
  $('#connection-count').textContent = `${connections.length} PIN CONNECTION${connections.length === 1 ? '' : 'S'}${filter === 'all' ? '' : ` / ${filter}`}`;
}

function renderFiles(design) {
  const hasPackage = setLink($('#package-download'), design.packageURL);
  $('#package-download').hidden = !hasPackage;
  $('#download-list').replaceChildren(...items(design.downloads).map(file => {
    const link = makeLink('', file.url);
    if (!link) return null;
    link.textContent = '';
    link.setAttribute('download', '');
    link.append(element('span', '', plain(file.label, 'Design file')), element('span', '', '↓'));
    return link;
  }).filter(Boolean));
  $('#download-empty').hidden = hasPackage || $('#download-list').childElementCount > 0;
  $('#download-list').hidden = !$('#download-list').childElementCount;
  $('#files-revision').textContent = plain(design.revision, 'Revision not specified');
}

function renderChecks(design) {
  const checks = items(design.checks);
  $('#verification-checks').replaceChildren(...checks.map(check => {
    const row = element('div');
    row.append(element('dt', '', plain(check.label, 'Unnamed check')), element('dd', '', plain(check.value, 'No result supplied')));
    return row;
  }));
  $('#verification-checks').hidden = !checks.length;
  $('#checks-empty').hidden = Boolean(checks.length);
  const limits = items(design.limits);
  $('#design-limits').replaceChildren(...limits.map(limit => element('li', '', plain(limit))));
  $('#limits-panel').hidden = !limits.length;
  $('#source-list').replaceChildren(...items(design.sources).map(source => {
    const link = makeLink(source.label, source.url);
    if (!link) return null;
    const row = element('li');
    row.append(link);
    return row;
  }).filter(Boolean));
  $('#sources').hidden = !$('#source-list').childElementCount;
}

function renderDesign(method, pushURL = false) {
  selectedMethod = Object.hasOwn(METHODS, method) ? method : 'current';
  for (const input of $$('input[name="method"]')) input.checked = input.value === selectedMethod;
  if (pushURL) updateURL(selectedMethod);
  const design = designs[selectedMethod];
  if (!design || typeof design !== 'object') {
    showUnavailable(`The ${METHODS[selectedMethod].toLowerCase()} board’s design data is not available. Its source files, power paths, connector pins and verification values cannot be shown until the metadata is supplied.`);
    return;
  }
  document.title = `${plain(design.title, METHODS[selectedMethod])} · 12 / 24 V board · Beam Lab`;
  $('#design-method').textContent = `${selectedMethod === 'current' ? '01' : '02'} / ${METHODS[selectedMethod].toUpperCase()}`;
  $('#design-title').textContent = plain(design.title, METHODS[selectedMethod]);
  $('#design-revision').textContent = plain(design.revision, 'Revision not specified');
  $('#design-summary').textContent = plain(design.summary, 'No design summary supplied.');
  renderFacts(design);
  $('#topology-image').src = `power-topology-${selectedMethod}.svg`;
  $('#topology-link').href = `power-topology-${selectedMethod}.svg`;
  $('#collector-firmware-link').hidden = selectedMethod !== 'collector';
  const startup = selectedMethod === 'collector' ? [
    'With HV disabled and verified discharged, inspect and power the rails. Measure floating supplies against FCOM and primary supplies against PGND.',
    'Program the local 8 MHz ATmega328P, then remove every ICSP lead. Wire J3 ground, HOST_VIO from ESP32 3.3 V, UART, both control lines and HV_FAULT_N to GPIO34.',
    'Start with the bias pot at minimum and the beam blanked. Send b: verify optical response, enable CA power, hold zero command ≥100 ms, then request ramp release. Hardware waits for the actual module rail plus a 180–420 ms delay. Keep the 10 s initial settling policy; confirm actual bias and settling with a rated instrument.',
    'At a fixed, settled bias, send z for a blanked dark zero, then s to scan. Repeat zero after every bias change. Compare blanked and blocked-beam scans to find pickup.',
    'Send x to abort and disable bias. Verify raw HV and FCOM have discharged before touching the island or reconnecting a programmer.',
  ] : [
    'Inspect the input polarity and component values. Power at a current limit with the specimen disconnected; check the 5 V bus, raw ±9 V, regulated ±5 V and 3.3 V reference.',
    'Bond PGND / AGND to the chamber star. Both the ESP32 and detector must be powered while direct I²C is connected; coordinate power or disconnect before separate power cycling. Leave J3.2 reference output open.',
    'Inject known current locally to establish gain, offset, polarity, noise and settling. Then connect the insulated conductive specimen holder to SUM.',
    'Acquire a blanked baseline and slow scans. Compare repeat scans and incident beam current before reducing dwell time.',
  ];
  $('#startup-steps').replaceChildren(...startup.map(step => element('li', '', step)));
  $('#topology-image').alt = selectedMethod === 'collector'
    ? 'Collector board: the 5 V bus branches to isolated detector power and the CA02P-5 bias module. Filtered bias goes to FCOM; collector goes to SUM. Two optocouplers cross the floating boundary.'
    : 'Specimen-current board: input to 5 V buck, isolated raw rails and quiet regulators. Insulated specimen to SUM, amplifier and ADC, then direct I²C to a grounded ESP32.';
  $('#topology-caption').textContent = selectedMethod === 'collector'
    ? 'Two branches share the 5 V bus. The bias branch raises FCOM; the isolated branch powers electronics relative to FCOM. Gold lines are power; green lines carry the measurement and data.'
    : 'The detector gets its rails from the DC input. AGND and PGND are deliberately bonded; only the conductive specimen holder is insulated from the grounded stage.';
  renderSteps($('#power-steps'), design.powerSteps);
  renderSteps($('#signal-steps'), design.signalSteps);
  $('#collector-module-note').hidden = selectedMethod !== 'collector';
  $('#isolation-title').textContent = plain(design.isolationTitle, 'Follow this revision’s reference connections.');
  $('#isolation-detail').textContent = plain(design.isolationDetail, 'The design metadata does not include an isolation description. Check the power return, signal common, earth, guard and data connections in the source schematic before making connections.');
  renderBoard(design);
  currentConnections = items(design.connections);
  renderConnectorIndex();
  renderConnections();
  renderFiles(design);
  renderChecks(design);
  $('#design-content').hidden = false;
  $('#selection-status').textContent = `Showing ${plain(design.title, METHODS[selectedMethod])}, ${plain(design.revision, 'revision not specified')}. All paths, pins and files below are for this board.`;
  $('#loading-status').hidden = true;
  $('#loading-status').className = 'loading-status';
  // The browser's initial fragment jump happens before the imported design is
  // visible. Restore it after rendering; method switches preserve scroll.
  if (!pushURL && window.location.hash) {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { id = ''; }
    const destination = document.getElementById(id);
    if (destination) requestAnimationFrame(() => destination.scrollIntoView({behavior:'instant',block:'start'}));
  }
}

for (const input of $$('input[name="method"]')) {
  input.addEventListener('change', () => { if (input.checked) renderDesign(input.value, true); });
}
$('#connector-filter').addEventListener('change', renderConnections);
$('#reset-filter').addEventListener('click', () => { $('#connector-filter').value = 'all'; renderConnections(); });
$('#print-guide').addEventListener('click', () => window.print());
window.addEventListener('popstate', () => {
  // Fragment navigation also fires popstate. Keep the connector selection
  // unless history actually changes which board is being displayed.
  const method = requestedMethod();
  if (method !== selectedMethod) renderDesign(method);
});

for (const link of $$('.mobile-toc a')) link.addEventListener('click', () => { $('.mobile-toc').open = false; });

if ('IntersectionObserver' in window) {
  const links = $$('.section-nav a');
  const sections = links.map(link => $(link.hash)).filter(Boolean);
  const visible = new Set();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target);
    const current = sections.findLast(section => visible.has(section));
    if (!current) return;
    for (const link of links) {
      if (link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }, {rootMargin: '-10% 0px -60% 0px'});
  sections.forEach(section => observer.observe(section));
}

window.addEventListener('beforeprint', () => {
  printFilter = $('#connector-filter').value;
  $('#connector-filter').value = 'all';
  renderConnections();
  printDetails = $$('#design-content details').filter(detail => !detail.open);
  printDetails.forEach(detail => { detail.open = true; });
});
window.addEventListener('afterprint', () => {
  $('#connector-filter').value = printFilter;
  renderConnections();
  printDetails.forEach(detail => { detail.open = false; });
  printDetails = [];
});

selectedMethod = requestedMethod();
for (const input of $$('input[name="method"]')) input.checked = input.value === selectedMethod;
try {
  const module = await import('./power-design-data.js');
  if (!module.designs || typeof module.designs !== 'object') throw new Error('No designs export');
  designs = module.designs;
  renderDesign(requestedMethod());
} catch (error) {
  showUnavailable('The board design data could not be loaded. The guide cannot show source-backed power paths, connector pins, downloads or verification results until power-design-data.js is available.');
  console.error('Detector board guide: unable to load design metadata.', error);
}
