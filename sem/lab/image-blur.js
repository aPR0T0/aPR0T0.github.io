/** Three separable box passes approximate a Gaussian, with replicated edges.
 * Cost is proportional to texture size even for a spot wider than the field.
 * Sigma is in texture pixels; optical diameter conventions remain approximate.
 */
export function blurLuminance(pixels,width,height,sigma) {
  if(!(sigma>.3))return pixels;
  const radius=Math.min(Math.max(width,height)*4,Math.max(1,Math.round((Math.sqrt(4*sigma*sigma+1)-1)/2)));
  let a=new Float64Array(width*height),b=new Float64Array(a.length);
  for(let i=0;i<a.length;i++)a[i]=pixels[i*4];
  const diameter=2*radius+1;
  for(let pass=0;pass<3;pass++){
    for(let y=0;y<height;y++){
      const start=y*width;let sum=0;
      for(let k=-radius;k<=radius;k++)sum+=a[start+Math.max(0,Math.min(width-1,k))];
      for(let x=0;x<width;x++){b[start+x]=sum/diameter;sum+=a[start+Math.min(width-1,x+radius+1)]-a[start+Math.max(0,x-radius)];}
    }
    for(let x=0;x<width;x++){
      let sum=0;for(let k=-radius;k<=radius;k++)sum+=b[Math.max(0,Math.min(height-1,k))*width+x];
      for(let y=0;y<height;y++){a[y*width+x]=sum/diameter;sum+=b[Math.min(height-1,y+radius+1)*width+x]-b[Math.max(0,y-radius)*width+x];}
    }
  }
  for(let i=0;i<a.length;i++){const before=pixels[i*4];for(let channel=0;channel<3;channel++)pixels[i*4+channel]=Math.max(0,Math.min(255,a[i]+pixels[i*4+channel]-before));}
  return pixels;
}
