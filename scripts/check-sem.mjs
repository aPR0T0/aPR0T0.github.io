/** Check the published simulator and its portfolio entry points without a server. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFile(path.join(root,name),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(await read('posts.js'),context);
vm.runInContext(await read('content.js'),context);
const posts=context.window.BLOG_POSTS;
assert.equal(new Set(posts.map(post=>post.slug)).size,posts.length,'Blog slugs must be unique');
const post=posts.find(post=>post.slug==='building-a-simple-electron-microscope');
assert.ok(post,'Beam Lab article is registered');
const project=vm.runInContext('getProject("sem")',context);
assert.ok(project.links.some(link=>link.href==='/sem/lab/'),'Project links to simulator');
assert.ok(project.links.some(link=>link.href==='/#blogs/'+post.slug),'Project links to journal');
assert.match(await read('index.html'),/href="\.\/sem\/lab\/"/,'Main navigation includes lab');
assert.match(await read('sem/index.html'),/href="(?:\.\/)?lab\/"/,'SEM plan links to lab');

let links=0;
const origin='https://portfolio.invalid';
async function checkLink(source,reference){
  if(!reference||/^(?:data:|mailto:|tel:|javascript:)/i.test(reference))return;
  const url=new URL(reference,origin+'/'+source);
  if(url.origin!==origin)return;
  if(url.hash.startsWith('#blogs/'))assert.ok(posts.some(p=>url.hash==='#blogs/'+p.slug),`Missing article: ${reference}`);
  const filename=decodeURIComponent(url.pathname).replace(/^\//,'');
  assert.ok(!filename.split('/').includes('..'),'Links stay within the site');
  let stat;
  try{stat=await fs.stat(path.join(root,filename));}catch{assert.fail(`${source}: missing ${reference}`);}
  if(stat.isDirectory())await fs.access(path.join(root,filename,'index.html'));
  if(url.hash&&url.pathname.startsWith('/sem/')){
    const html=await read(filename+(stat.isDirectory()?'index.html':''));
    const id=decodeURIComponent(url.hash.slice(1));
    assert.ok([...html.matchAll(/\bid=["']([^"']+)["']/g)].some(match=>match[1]===id),`${source}: missing anchor ${reference}`);
  }
  links++;
}
for(const source of ['index.html','sem/index.html']){
  for(const match of (await read(source)).matchAll(/\b(?:href|src)=["']([^"']+)["']/g))await checkLink(source,match[1]);
}
for(const body of post.body)for(const match of body.matchAll(/\]\(([^\s)]+)\)/g))await checkLink('index.html',match[1]);
for(const link of project.links)await checkLink('index.html',link.href);
const manifest=JSON.parse(await read('sem/lab/build-manifest.json'));
assert.equal(manifest.basePath,'/sem/lab/');
assert.equal(manifest.blogURL,'/#blogs/'+post.slug);
assert.match(await read('sem/lab/index.html'),/data-hosting="static"/);
for(const entry of manifest.files){
  assert.ok(!/(?:^|\/)(?:data|\.git|node_modules)(?:\/|$)|previous-session\.json|\.test\.mjs$/.test(entry.path),`Private/development asset: ${entry.path}`);
  const bytes=await fs.readFile(path.join(root,'sem/lab',entry.path));
  assert.equal(bytes.length,entry.bytes,`Size mismatch: ${entry.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,`Hash mismatch: ${entry.path}`);
  if(entry.path.endsWith('.html')){
    for(const match of bytes.toString().matchAll(/\b(?:href|src)=["']([^"']+)["']/g))await checkLink('sem/lab/'+entry.path,match[1]);
  }
  if(entry.path.endsWith('.js')){
    for(const match of bytes.toString().matchAll(/\b(?:from\s*|import\s*\(?\s*)["'](\.[^"']+)["']/g))await checkLink('sem/lab/'+entry.path,match[1]);
  }
}
console.log(`SEM integration passed: ${posts.length} blog posts, ${manifest.files.length} verified assets, ${links} internal links/imports.`);
