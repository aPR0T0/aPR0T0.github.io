/** Place one acquired sample into the nearest logical image pixel.
 * All trajectories share the N×N output grid; unvisited pixels remain empty.
 * Exact cell edges avoid dark seams when N does not divide the canvas size.
 */
export function createImagePixelMapper(resolution,size) {
  const n=Math.max(2,Math.round(resolution)),extent=Math.max(1,Math.round(size));
  const starts=new Int32Array(n),widths=new Int32Array(n);
  for(let cell=0;cell<n;cell++){
    const start=Math.min(extent-1,Math.floor(cell*extent/n));
    starts[cell]=start;widths[cell]=Math.min(extent,Math.max(start+1,Math.floor((cell+1)*extent/n)))-start;
  }
  const axis=value=>{
    const normalized=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;
    return Math.round((normalized+1)*.5*(n-1));
  };
  return (x,y)=>{const col=axis(x),row=axis(y);return {x:starts[col],y:starts[row],width:widths[col],height:widths[row]};};
}
