/** Check the Phased Array Bench page, its vendored three.js, and its portfolio entry points without a server. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFile(path.join(root,name),'utf8');
const page='Phased-arrays/index.html';
const html=await read(page);

// three.js r128 (global build) + OrbitControls are vendored so both 3D views work without a CDN
const VENDOR={
  'Phased-arrays/vendor/three.min.js':'9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2',
  'Phased-arrays/vendor/OrbitControls.js':'02bb4ade710f3e607329e37a21f098bc3ac70eb6e33daf8a65e79f4db785e7b2',
};
for(const [file,sha] of Object.entries(VENDOR)){
  const bytes=await fs.readFile(path.join(root,file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sha,`Hash mismatch: ${file}`);
}
const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(m=>m[1]);
assert.deepEqual(scripts,['vendor/three.min.js','vendor/OrbitControls.js'],'Bench loads only the vendored three.js scripts, in order');

// inline scripts parse, and the bench builds both 3D views
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const code of inline)new vm.Script(code,{filename:page});
const bench=inline.at(-1);
for(const id of ['v3d','vmodel','cPolar','cRect','cArr','cRange','graph','cards','budget'])
  assert.match(html,new RegExp(`id="${id}"`),`Missing #${id}`);
for(const fn of ['function init3D(','function initModel(','function build3D(','function buildModel(','function compute('])
  assert.ok(bench.includes(fn),`Bench script lost ${fn}`);
assert.ok(!/WireframeGeometry/.test(bench),'Mesh lines share the lobe buffer instead of being rebuilt');
assert.ok(!/for\(let it=0;it<40;it\+\+\)\{const allowed/.test(bench),'Range uses the bisection solver');

// theme matches the main site and shares its saved choice
assert.match(html,/localStorage\.getItem\("theme"\)/,'Bench reads the site theme');
assert.match(html,/localStorage\.setItem\("theme"/,'Bench saves the site theme');
assert.match(html,/IBM\+Plex\+Mono/,'Bench uses the site typeface');

// entry points: homepage nav and the blog post
const context=vm.createContext({window:{}});
vm.runInContext(await read('posts.js'),context);
const posts=context.window.BLOG_POSTS;
const post=posts.find(p=>p.slug==='phased-arrays');
assert.ok(post,'Phased arrays post is registered');
assert.ok(post.body.some(b=>b.includes('](/Phased-arrays/)')),'Post links to the bench');
assert.match(await read('index.html'),/href="\.\/Phased-arrays\/"/,'Main navigation includes ./Phased-arrays');

// every local link on the page resolves
let links=0;
const origin='https://portfolio.invalid';
for(const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)){
  const url=new URL(match[1],origin+'/'+page);
  if(url.origin!==origin)continue;
  if(url.hash.startsWith('#blogs/'))assert.ok(posts.some(p=>url.hash==='#blogs/'+p.slug),`Missing article: ${match[1]}`);
  const filename=decodeURIComponent(url.pathname).replace(/^\//,'');
  const stat=await fs.stat(path.join(root,filename)).catch(()=>assert.fail(`${page}: missing ${match[1]}`));
  if(stat.isDirectory())await fs.access(path.join(root,filename,'index.html'));
  links++;
}
console.log(`Phased Array Bench passed: vendored three.js r128 verified, ${inline.length} inline scripts parse, ${links} internal links.`);
