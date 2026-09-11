/** Millimetres, specimen z=0, beam axis x=y=0, detector above specimen at +z.
 * Tilt is from a horizontal face: positive tilt aims its normal toward −x/−z.
 * The package envelope and mounting allowance are clearance estimates, not CAD.
 */
export const SIDE_MOUNT_PRESET = Object.freeze({detectorOffset:16, detectorDistance:14, detectorTilt:48.8});
const rad = Math.PI / 180;
const finite = (x,d) => Number.isFinite(Number(x)) ? Number(x) : d;
const cache = new Map();
const disk = Array.from({length:512},(_,i)=>{
  const radius=Math.sqrt((Math.floor(i/64)+.5)/8), angle=(i%64+.5)*2*Math.PI/64;
  return [radius*Math.cos(angle),radius*Math.sin(angle)];
});

export function beamScanEnvelope(p={}) {
  const voltage=Math.max(1,finite(p.voltage,3)*1000), gamma=1+voltage/510998.95;
  const length=finite(p.plateLength,20), drift=finite(p.workingDistance,15), gap=Math.max(.001,finite(p.plateGap,10));
  const perVolt=length*(drift+length/2)/(gap*voltage*(gamma+1)/gamma);
  const halfWidth=Math.abs(finite(p.scanAmplitude,20))*perVolt, centre=finite(p.plateVoltage,0)*perVolt;
  return {perVolt,halfWidth,centre,maxX:centre+halfWidth,minX:centre-halfWidth,
    radius:Math.hypot(Math.abs(centre)+halfWidth,halfWidth)};
}

/** Exact rectangular solid angle minus a 512-point equal-area disk integral.
 * The disk is the physical 2 mm diameter hole, still present off axis.
 * Exact centred expression retains previous snapshot values.
 */
export function tiltedDetectorSolidAngle(p={},sx=0,sy=0) {
  const h=finite(p.detectorDistance,5), offset=finite(p.detectorOffset,0), angle=finite(p.detectorTilt,0)*rad;
  const key=[h,offset,angle,sx,sy].join(',');
  if(cache.has(key))return cache.get(key);
  const sin=Math.sin(angle),cos=Math.cos(angle);
  const d=(offset-sx)*sin+h*cos, u=(sx-offset)*cos+h*sin;
  // No response through the back face. Invalid specimen intersections are flagged
  // separately, rather than presented as a verified mechanical arrangement.
  let omega=0;
  if(d>1e-9 && h-5*sin>0){
    const F=(x,y)=>Math.atan2(x*y,d*Math.hypot(d,x,y));
    const square=F(5-u,5-sy)-F(-5-u,5-sy)-F(5-u,-5-sy)+F(-5-u,-5-sy);
    const hole=Math.abs(u)+Math.abs(sy)<1e-10
      ? 2*Math.PI*(1-d/Math.hypot(d,1))
      : disk.reduce((sum,[x,y])=>sum+d/Math.hypot(d,x-u,y-sy)**3,0)*Math.PI/disk.length;
    omega=Math.max(0,Math.min(2*Math.PI,square-hole));
  }
  if(cache.size>=512)cache.clear();cache.set(key,omega);return omega;
}

export function detectorPlacement(p={}) {
  const offset=finite(p.detectorOffset,0),height=finite(p.detectorDistance,5),tilt=finite(p.detectorTilt,0);
  const angle=tilt*rad,sin=Math.sin(angle),cos=Math.cos(angle),scan=beamScanEnvelope(p);
  const margin=finite(p.detectorMargin,2),beamAllowance=finite(p.detectorBeamAllowance,.25);
  // Conservative X separation over the full final drift, not just at detector centre.
  // 25×11×1 mm package box is an assumed envelope based on the device outline.
  const packageHalfX=12.5*cos+.5*sin;
  const clearance=offset-packageHalfX-margin-Math.max(0,scan.maxX)-beamAllowance;
  const minFaceHeight=height-5*sin, minPackageHeight=height-12.5*sin-.5*cos-margin;
  const side=offset>0;
  const aimTilt=Math.atan2(offset-scan.centre,height)/rad;
  const aimError=tilt-aimTilt;
  const incidenceCos=((offset-scan.centre)*sin+height*cos)/Math.hypot(offset-scan.centre,height);
  const valid=minFaceHeight>0&&incidenceCos>0;
  let status=side?'Side clearance estimated':'Centred hole · clearance not solved';
  if(!valid)status='Invalid face position or orientation';
  else if(side&&clearance<=0)status='Beam envelope / mount overlap';
  else if(side&&minPackageHeight<=0)status='Package / specimen-plane overlap';
  return {offset,height,tilt,side,scan,clearance,minFaceHeight,minPackageHeight,aimTilt,aimError,
    incidenceCos,valid,status,mountClear:side&&valid&&clearance>0&&minPackageHeight>0,
    range:Math.hypot(offset-scan.centre,height),packageHalfX,margin,beamAllowance};
}

/** A coarse field map, rebuilt only when controls change, for brightness variation. */
export function collectionField(p,n=9) {
  const scan=beamScanEnvelope(p),values=new Float64Array(n*n);
  const centre=tiltedDetectorSolidAngle(p,scan.centre,0);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)values[y*n+x]=tiltedDetectorSolidAngle(p,
    scan.centre+(2*x/(n-1)-1)*scan.halfWidth,(2*y/(n-1)-1)*scan.halfWidth);
  return {n,values,centre};
}
export function sampleCollectionField(field,x,y) {
  const gx=Math.max(0,Math.min(1,x))*(field.n-1),gy=Math.max(0,Math.min(1,y))*(field.n-1);
  const ix=Math.min(field.n-2,Math.floor(gx)),iy=Math.min(field.n-2,Math.floor(gy)),a=gx-ix,b=gy-iy,v=field.values,n=field.n;
  return (v[iy*n+ix]*(1-a)+v[iy*n+ix+1]*a)*(1-b)+(v[(iy+1)*n+ix]*(1-a)+v[(iy+1)*n+ix+1]*a)*b;
}
