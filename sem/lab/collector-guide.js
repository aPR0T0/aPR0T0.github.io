import {calculateCollector} from './collector-model.js';

const $ = selector => document.querySelector(selector);
const notes = {
  all: ['Three references. One measured current.', 'SUM is the sensitive collector input. FCOM is the elevated local common and guard. PE is the grounded chamber and accessible outer enclosure. The vacuum wall and the electrical insulation boundary are separate.'],
  signal: ['01 · Collector → SUM → amplifier', 'Only the collector connects to SUM. The +Vc supply biases FCOM; amplifier feedback then holds the collector near FCOM. Connecting the collector straight to +Vc would bypass the measurement. Positive net electron deposition gives a positive TIA voltage relative to FCOM.'],
  common: ['02 · Bias + → FCOM and inner guard', 'FCOM connects to amplifier +IN, the battery midpoint, ADC/local-controller common and inner guard. It has one intentional bias reference to PE through the collector supply. Keep guard current out of SUM and place the guard outside the collection opening.'],
  optical: ['03 · Local digitization → fibre → scan controller', 'A floating controller operates the ADC over local I²C. Separate optical channels carry acquisition requests inward and pixel-tagged readings outward. Neither a copper trigger wire nor the grounded ESP32’s I²C may cross this boundary.'],
  earth: ['04 · Chamber, specimen and outer enclosure → PE', 'The accessible chamber, specimen stage and outer electronics enclosure remain grounded. In this collector-only option, a conductive specimen has a ground contact; it is not connected to SUM. An insulating specimen can still charge.'],
};

for (const button of document.querySelectorAll('[data-net-focus]')) {
  button.addEventListener('click', () => {
    const selected = button.dataset.netFocus;
    $('#connection-map').dataset.focus = selected;
    $('#signal-overview').dataset.focus = selected;
    for (const item of document.querySelectorAll('[data-net-focus]')) item.setAttribute('aria-pressed', String(item === button));
    $('#net-title').textContent = notes[selected][0];
    $('#net-detail').textContent = notes[selected][1];
  });
}

const number = (n, digits = 3) => n.toLocaleString('en', {maximumFractionDigits: digits});
const signed = (n, digits = 3) => `${n > 0 ? '+' : ''}${number(n, digits)}`;
const controls = [...document.querySelectorAll('[data-collector-input]')];
function update() {
  const values = {};
  for (const input of controls) {
    if (!input.checkValidity() || input.value.trim() === '') {
      $('#calculation-status').textContent = 'Enter a value within each field’s range. Previous results are hidden until every input is valid.';
      $('#calculation-input-summary').textContent = 'Inputs incomplete or invalid; no current calculation is available.';
      $('#collector-results').hidden = true;
      return;
    }
    values[input.dataset.collectorInput] = input.valueAsNumber;
  }
  let d;
  try { d = calculateCollector(values); }
  catch {
    $('#collector-results').hidden = true;
    $('#calculation-input-summary').textContent = 'Inputs incomplete or invalid; no current calculation is available.';
    $('#calculation-status').textContent = 'Enter valid numerical values to calculate.';
    return;
  }
  $('#collector-results').hidden = false;
  $('#calculation-input-summary').textContent = `Inputs: collector bias ${number(values.biasV)} V; net collected current ${number(values.netCurrentpA)} pA; residual leakage resistance ${number(values.resistanceTOhm)} TΩ; residual capacitance ${number(values.capacitancepF)} pF; ripple ${number(values.ripplemV)} mV peak at ${number(values.frequencyHz)} Hz; individual error target ${number(values.targetpA)} pA. Fixed feedback 100 MΩ / 10 pF, ADC ±0.256 V.`;
  $('#bias-label').textContent = `${number(values.biasV)} V`;
  $('#result-common').textContent = `${signed(d.commonV)} V`;
  $('#result-rails').textContent = `${signed(d.positiveRailV)} V / ${signed(d.negativeRailV)} V`;
  $('#result-tia').textContent = `${signed(d.tiaRelativeV * 1e3)} mV`;
  $('#result-tia-absolute').textContent = `${signed(d.tiaAbsoluteV, 6)} V relative to chamber`;
  $('#result-adc').textContent = `${signed(d.adcChangeV * 1e6)} µV`;
  $('#result-leakage').textContent = `${number(d.leakagepA)} pA DC`;
  $('#result-ripple').textContent = `${number(d.ripplePeakpA)} pA peak`;
  $('#result-resistance').textContent = `For ≤${number(values.targetpA)} pA from each example: ≥${number(d.resistanceForTargetTOhm)} TΩ to chamber; ${d.rippleForTargetmV === null ? 'no ripple-current contribution at the entered zero capacitance or frequency' : `≤${number(d.rippleForTargetmV, 6)} mV peak ripple at the entered capacitance and frequency`}.`;
  $('#collector-results').classList.toggle('overrange', d.clipped);
  $('#calculation-status').textContent = d.clipped
    ? 'The nominal amplifier or ±0.256 V ADC range is exceeded. Displayed voltages are demanded ideal values; real output would clip.'
    : `${d.withinErrorTarget ? 'Both individual interference examples are within' : 'At least one interference example exceeds'} the entered target. DC leakage and AC peak pickup are different quantities, not a combined noise floor. No measured accuracy or sensitivity is inferred.`;
}
controls.forEach(input => input.addEventListener('input', update));
$('#print-guide').addEventListener('click', () => window.print());
update();

// Keep the section index aligned with the reader's position.
const sectionLinks = [...document.querySelectorAll('.section-nav a')];
const observedSections = sectionLinks.map(link => document.querySelector(link.hash));
const visibleSections = new Set();
const sectionObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) visibleSections.add(entry.target);
    else visibleSections.delete(entry.target);
  }
  const current = observedSections.findLast(section => visibleSections.has(section));
  if (!current) return;
  for (const link of sectionLinks) {
    if (link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}, {rootMargin: '-10% 0px -65% 0px'});
observedSections.forEach(section => sectionObserver.observe(section));

// Include the detailed engineering reference in a printed guide.
let printDetails = [];
window.addEventListener('beforeprint', () => {
  printDetails = [...document.querySelectorAll('details')].filter(detail => !detail.open);
  printDetails.forEach(detail => { detail.open = true; });
});
window.addEventListener('afterprint', () => {
  printDetails.forEach(detail => { detail.open = false; });
  printDetails = [];
});

for (const link of document.querySelectorAll('.mobile-toc a')) {
  link.addEventListener('click', () => { document.querySelector('.mobile-toc').open = false; });
}
