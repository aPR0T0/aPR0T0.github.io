import { DEFAULTS, calculate } from './physics.js';

/** Detailed synthetic-wing scan. Hardware time and preview playback are separate.
 * This preset preserves noise/yield assumptions and fitted detector components;
 * two fresh ADC conversions do not imply a guaranteed improvement in SNR.
 */
export function createButterflyDetailPreset() {
  const parameters = {
    ...DEFAULTS,
    detectorMode:'current', voltage:3, aperture:100,
    resolution:512, scanMode:'raster', dwell:20000, settleTime:5000, flyback:80,
    currentRf:100, currentCf:10, currentADCRange:.256, currentADCRate:128,
    currentSamples:2,
  };
  const oneVolt = calculate({...parameters,scanAmplitude:1});
  // calculate() reports field width in mm; the target field is 140 µm.
  parameters.scanAmplitude = 140 / (oneVolt.scanFieldWidth * 1000);
  parameters.lensCurrent = oneVolt.focusCurrent;
  return {
    name:'Butterfly wing · detailed 512 × 512',
    specimenId:'butterfly-wing', parameters,
    operatingState:{roughing:true,turbo:true,requestedBeam:true},
  };
}
