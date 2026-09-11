import {DEFAULTS} from './physics.js';
import {CURRENT_PARAMETER_SCHEMA, ADC_RANGES, ADC_RATES} from './current.js';
import {ELECTRICAL_PARAMETER_SCHEMA} from './electrical.js';

export class StoreError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

const numeric = (unit, min = 0, max = 1e12, extra = {}) => ({ type: 'number', unit, min, max, ...extra });
// These are supported teaching-model bounds, never a manufacturer's operating rating.
export const PARAMETER_SCHEMA = Object.freeze({
  voltage: numeric('kV', .001, 100), heaterPower: numeric('W', 0, 100), aperture: numeric('µm', 0, 5000),
  wehnelt: numeric('V', -2000, 0), lensCurrent: numeric('A', -20, 20), plateVoltage: numeric('V', -2000, 2000),
  plateGap: numeric('mm', .01, 1000), plateLength: numeric('mm', 0, 1000), workingDistance: numeric('mm', .01, 1000),
  chamberVolume: numeric('L', .001, 1e5), pumpSpeed: numeric('L/s', 0, 1e5), conductance: numeric('L/s', 0, 1e5),
  gasLoad: numeric('mbar L/s', 0, 1e5), pressure: numeric('mbar', 0, 1100), dwell: numeric('µs', 1, 1e6),
  resolution: numeric('pixels/side', 2, 512, { integer: true }), scanAmplitude: numeric('V', 0, 2000),
  dacModel: numeric('model',4922,80502,{integer:true}),dacBits:numeric('bits',12,16,{integer:true}),
  dacReference:numeric('V',.1,3.3),amplifierGain:numeric('V/V',1,1000),
  pmtVoltage: numeric('V', 0, 3000), collectionBias: numeric('V', -1000, 2000),
  scanMode: { type: 'string', unit: '', choices: ['raster','serpentine','spiral','lissajous','custom'] },
  ambientTemperature: numeric('K', 1, 2000), emissivity: numeric('', 0, 1), radiatingArea: numeric('m²', 1e-16, 1),
  thermalConductance: numeric('W/K', 0, 1000), emittingArea: numeric('m²', 0, 1), workFunction: numeric('eV', 0, 20),
  richardsonConstant: numeric('A m⁻² K⁻²', 0, 1e9), apertureBeamSigma: numeric('µm', .001, 1e6),
  lensTurns: numeric('turns', 1, 1e6, { integer: true }), lensLength: numeric('mm', .001, 1e4),
  sourceDiameter: numeric('µm', 0, 1e6), demagnification: numeric('', .001, 1e6), energySpread: numeric('eV', 0, 1e4),
  chromaticCoefficient: numeric('mm', 0, 1e5), sphericalCoefficient: numeric('mm', 0, 1e5),
  gasDiameter: numeric('nm', .001, 100), electronCrossSection: numeric('m²', 0, 1e-10), columnLength: numeric('m', .001, 100),
  secondaryYield: numeric('', 0, 100), photonYield: numeric('photons/electron', 0, 1e5), opticalEfficiency: numeric('', 0, 1),
  quantumEfficiency: numeric('', 0, 1), pmtReferenceGain: numeric('', 0, 1e10), pmtGainExponent: numeric('', 0, 20),
  excessNoiseFactor: numeric('', 1, 100), darkRate: numeric('s⁻¹', 0, 1e12), readNoiseElectrons: numeric('electrons', 0, 1e12),
  flyback: numeric('µs', 0, 1e6), settleTime: numeric('µs', 0, 1e6), roughingSpeed: numeric('L/s', 0, 1e5),
  roughingBase: numeric('mbar', 0, 1100), turboBase: numeric('mbar', 0, 1100), turboCrossover: numeric('mbar', 0, 1100),
  ...ELECTRICAL_PARAMETER_SCHEMA,
  ...CURRENT_PARAMETER_SCHEMA,
  detectorMode:{type:'string',unit:'',choices:['current','bse','et']},
  detectorOffset:numeric('mm',0,50),detectorTilt:numeric('°',0,85),detectorMargin:numeric('mm',0,10),detectorBeamAllowance:numeric('mm',0,5),
  detectorDistance:numeric('mm',.1,100),detectorBias:numeric('V',0,5),
  bseYield:numeric('',0,1),bseEnergyFraction:numeric('',0,1),bseAcceptance:numeric('',0,1),
  tiaResistance:numeric('MΩ',.01,1000),tiaCapacitance:numeric('pF',.1,1000),
  tiaInputNoise:numeric('pA/√Hz',0,100),tiaVoltageNoise:numeric('nV/√Hz',0,1000),adcFullScale:numeric('V',.1,10),
});

export function validateParameters(parameters, { complete = false } = {}) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new StoreError(400, 'Parameters must be a JSON object.');
  const errors = [];
  for (const [key, value] of Object.entries(parameters)) {
    const rule = Object.hasOwn(PARAMETER_SCHEMA, key) ? PARAMETER_SCHEMA[key] : null;
    if (!rule) { errors.push(`Unknown model parameter: ${key}.`); continue; }
    if (rule.type === 'string') {
      if (!rule.choices.includes(value)) errors.push(`${key} must be ${rule.choices.join(', ')}.`);
    } else if (typeof value !== 'number' || !Number.isFinite(value) || value < rule.min || value > rule.max || (rule.integer && !Number.isInteger(value))) {
      errors.push(`${key} must be ${rule.integer ? 'an integer' : 'a finite number'} from ${rule.min} to ${rule.max} ${rule.unit}.`);
    }
  }
  if ('currentADCRange' in parameters && !ADC_RANGES.includes(parameters.currentADCRange)) errors.push('Select a supported ADS1115 PGA range.');
  if ('currentADCRate' in parameters && !ADC_RATES.includes(parameters.currentADCRate)) errors.push('Select a supported ADS1115 sample rate.');
  if ('currentSamples' in parameters && !Number.isInteger(parameters.currentSamples)) errors.push('ADC sample count must be an integer.');
  if ('dacModel' in parameters && ![4922,80502].includes(parameters.dacModel)) errors.push('DAC model must be 80502 or legacy 4922.');
  if ('dacBits' in parameters && ![12,16].includes(parameters.dacBits)) errors.push('Select 12-bit MCP4922 or 16-bit DAC80502.');
  if (parameters.dacModel===80502 && (('dacBits' in parameters&&parameters.dacBits!==16)||('dacReference' in parameters&&parameters.dacReference!==2.5))) errors.push('DAC80502 module requires 16 bits and configured 2.5 V full scale.');
  if (parameters.dacModel===4922&&'dacBits' in parameters&&parameters.dacBits!==12) errors.push('MCP4922 requires 12 bits.');
  if (complete) for (const key of Object.keys(DEFAULTS)) if (!(key in parameters)) errors.push(`Missing parameter: ${key}.`);
  if (errors.length) throw new StoreError(400, errors.join(' '), errors);
  return { ...parameters };
}

export const ROLES = ['gun','heater','acceleration','aperture','lens','scan','vacuum','detector','controller'];
export const STATUSES = ['assumed','user-defined','verified','needs-research'];

export function presentBom(raw, sourceHash) {
    const issues = [], components = [];
    const mappings = raw.files.find(file => file.id === 'simulation');
    const usedParameters = new Map();
    for (const row of mappings.rows) {
      const id = row.Id, sourceFile = raw.files.find(file => file.id === row.SourceFile);
      const source = sourceFile?.rows.find(source => source.Reference === row.SourceRef);
      const issue = (code, message, severity = 'warning') => issues.push({ componentId: id, code, severity, message });
      let parameters = {}, status = row.Status;
      try { parameters = validateParameters(JSON.parse(row.Parameters)); }
      catch (error) { issue('invalid-parameters', error.message, 'error'); }
      for (const [key, value] of Object.entries(parameters)) {
        if (usedParameters.has(key) && usedParameters.get(key).value !== value) issue('conflicting-parameter', `${key} has different values in ${usedParameters.get(key).id} and ${id}.`, 'error');
        else usedParameters.set(key, { id, value });
      }
      if (!ROLES.includes(row.Role)) issue('invalid-role', `Unsupported model role: ${row.Role}.`, 'error');
      if (!STATUSES.includes(status)) { issue('invalid-status', `Unsupported verification status: ${status}.`, 'error'); status = 'needs-research'; }
      if (row.SourceRef && !source) { issue('missing-source', `Linked source ${row.SourceFile}/${row.SourceRef} was not found.`); status = 'needs-research'; }
      if (source && row.SourceFingerprint && row.SourceFingerprint !== sourceHash(source)) {
        issue('source-changed', 'The linked BOM row changed after this model was reviewed. Review its identity and parameters again.'); status = 'needs-research';
      }
      if (status === 'assumed') issue('model-assumption', 'Illustrative teaching values; they are not specifications of selected hardware.');
      if (status === 'needs-research') issue('needs-research', 'Component identity or model parameters need research or explicit manual review.');
      const mpn = source ? source.MPN || source.MPN_or_procurement_spec || '' : row.MPN;
      if (!mpn && !['assumed','user-defined'].includes(status)) issue('missing-mpn', 'No manufacturer part number is selected. Codex may need a part choice or datasheet.');
      components.push({ id, reference: row.Reference, role: row.Role, name: row.Name,
        manufacturer: source ? source.Manufacturer || row.Manufacturer || '' : row.Manufacturer, mpn,
        datasheet: source ? source.Datasheet || '' : row.Datasheet, status, storedStatus: row.Status,
        parameters, notes: row.Notes, sourceValues:source?{...source}:null, sourceFile: row.SourceFile, sourceRef: row.SourceRef,
        sourceFingerprint: sourceHash(source), sourceStatus: source?.Status || '',
      });
    }
    for (const role of ROLES) if (!components.some(component => component.role === role)) issues.push({ componentId: null, code: 'missing-role', severity: 'error', message: `The BOM has no ${role} model component.` });
    for (const key of Object.keys(DEFAULTS)) if (!usedParameters.has(key)) issues.push({ componentId:null,code:'missing-parameter',severity:'error',message:`The BOM mappings do not define ${key}. Restore or explicitly define this model value.` });
    if (new Set(components.map(component => component.id)).size !== components.length) issues.push({ componentId: null, code: 'duplicate-id', severity: 'error', message: 'Simulation component IDs must be unique.' });
    return { revision: raw.revision,
      files: raw.files.map(({ id, label, path: filePath, columns, rows }) => ({ id, label, path: filePath, columns,
        rows: rows.map((values, index) => ({ id: `row-${index + 1}`, reference: values.Reference || values.Id, values })) })),
      components, issues, parameterSchema: PARAMETER_SCHEMA,
    };
  }
