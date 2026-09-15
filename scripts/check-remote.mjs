import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'remote');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(join(directory, 'publish-manifest.json'), 'utf8'));
assert.equal(manifest.application, 'agent-remote-start');
const allowed = /^(?:assets\/[A-Za-z0-9._-]+\.(?:js|css)|index\.html|agent-remote-laptop\.zip|agent-remote-latest\.apk|update-relay\.py|checksums\.txt|release\.json)$/;
const expected = new Set(['publish-manifest.json']);
for (const file of manifest.files) {
  assert(allowed.test(file.path), `Unexpected public path: ${file.path}`);
  assert(!expected.has(file.path), `Duplicate public path: ${file.path}`);
  expected.add(file.path);
  const path = join(directory, file.path);
  assert((await lstat(path)).isFile(), `Public file must be regular: ${file.path}`);
  const bytes = await readFile(path);
  assert.equal(bytes.length, file.bytes, `Size changed: ${file.path}`);
  assert.equal(hash(bytes), file.sha256, `Hash changed: ${file.path}`);
}
async function walk(path, prefix = '') {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    assert(!entry.isSymbolicLink(), `Public symlink: ${relative}`);
    if (entry.isDirectory()) await walk(join(path, entry.name), `${relative}/`);
    else assert(expected.has(relative), `Unlisted public file: ${relative}`);
  }
}
await walk(directory);
const html = await readFile(join(directory, 'index.html'), 'utf8');
assert(html.includes('Open my workspace'));
assert(!html.includes('type="password"'), 'The public page must not collect keys or passwords');
for (const match of html.matchAll(/(?:src|href)="(\.\/assets\/[^\"]+)"/g)) assert(expected.has(match[1].slice(2)), `Missing relative asset: ${match[1]}`);

const archive = await readFile(join(directory, 'agent-remote-laptop.zip'));
assert((await readFile(join(directory, 'checksums.txt'), 'utf8')).startsWith(`${hash(archive)}  agent-remote-laptop.zip`));
const apk = await readFile(join(directory, 'agent-remote-latest.apk'));
assert.equal(apk.readUInt32LE(0), 0x04034b50, 'Expected an APK archive');
const release = JSON.parse(await readFile(join(directory, 'release.json'), 'utf8'));
const updater = await readFile(join(directory, 'update-relay.py'));
assert.equal(release.updater.sha256, hash(updater));
assert.equal(release.updater.bytes, updater.length);
assert((await readFile(join(directory, 'checksums.txt'), 'utf8')).includes(`${hash(updater)}  update-relay.py`));
assert.equal(release.android.version, release.version, 'APK and laptop kit versions differ');
assert.equal(release.android.sha256, hash(apk));
assert.equal(release.android.bytes, apk.length);
assert((await readFile(join(directory, 'checksums.txt'), 'utf8')).includes(`${hash(apk)}  agent-remote-latest.apk`));
const posts = await readFile(join(root, 'posts.js'), 'utf8');
assert(posts.includes('"slug": "agent-remote-private-ai-workspace"'), 'Missing Agent Remote blog post');
for (const path of ['/remote/agent-remote-latest.apk', '/remote/agent-remote-laptop.zip']) assert(posts.includes(`](${path})`), `Missing direct blog download: ${path}`);
// Inspect standard ZIP central-directory names without installing a build tool on Pages.
const end = archive.length - 22;
assert.equal(archive.readUInt32LE(end), 0x06054b50, 'Expected a standard ZIP end record');
const count = archive.readUInt16LE(end + 10);
assert(count > 0 && count < 1000, 'Unexpected laptop kit entry count');
let offset = archive.readUInt32LE(end + 16);
const entries = new Set();
for (let i = 0; i < count; i++) {
  assert.equal(archive.readUInt32LE(offset), 0x02014b50, 'Invalid ZIP directory entry');
  const length = archive.readUInt16LE(offset + 28);
  const name = archive.toString('utf8', offset + 46, offset + 46 + length);
  const segments = name.split('/');
  assert(name.startsWith('agent-remote/') && !name.includes('\\') && !segments.includes('..'), `Unexpected kit path: ${name}`);
  assert(!segments.some((part) => ['.local', 'data', 'node_modules', 'android', 'test-results', 'connector.json'].includes(part) || part === '.env' || (part.startsWith('.env.') && part !== '.env.example')), `Private/generated kit path: ${name}`);
  assert(!entries.has(name), `Duplicate kit file: ${name}`);
  entries.add(name);
  if (/Start Agent Remote\.(sh|command)$/.test(name)) assert.equal((archive.readUInt32LE(offset + 38) >>> 16) & 0o777, 0o755, 'Unix launcher must retain executable permissions');
  offset += 46 + length + archive.readUInt16LE(offset + 30) + archive.readUInt16LE(offset + 32);
  assert(offset <= end, 'ZIP directory exceeds archive bounds');
}
for (const file of ['launch.mjs', 'Start Agent Remote.cmd', 'Start Agent Remote.command', 'Start Agent Remote.sh', 'dist/index.html', 'dist/setup.html', 'package-manifest.json']) assert(entries.has(`agent-remote/${file}`), `Missing laptop launcher asset: ${file}`);
assert((await readFile(join(root, 'index.html'), 'utf8')).includes('href="./remote/"'), 'Missing portfolio navigation link');
console.log(`Agent Remote: ${expected.size} public files and ${entries.size} clean laptop kit entries verified.`);
