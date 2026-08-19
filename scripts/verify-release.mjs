import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const extensionDir = resolve('.output/chrome-mv3');
const outputDir = resolve('.output');
const packageManifest = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(extensionDir, 'manifest.json'), 'utf8'));

for (const fileName of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']) {
  assert((await stat(resolve(extensionDir, fileName))).size > 0, `${fileName} missing from release`);
}

assert.deepEqual(
  [...(manifest.permissions || [])].sort(),
  ['activeTab', 'scripting', 'storage'],
  'production permissions changed; review docs/CHROME-PERMISSIONS.md before release',
);
assert.deepEqual(
  manifest.optional_host_permissions,
  ['https://*/*'],
  'optional Provider Origin permission changed',
);
assert.equal(manifest.content_scripts, undefined, 'static content scripts are not allowed');
assert.equal(manifest.host_permissions, undefined, 'production build must not request host access');

for (const size of [16, 32, 48, 128]) {
  assert.equal(manifest.icons?.[String(size)], `icons/icon-${size}.png`);
  assert.equal(manifest.action?.default_icon?.[String(size)], `icons/icon-${size}.png`);
  assert((await stat(resolve(extensionDir, `icons/icon-${size}.png`))).size > 0);
}

const textFiles = (await walk(extensionDir)).filter((path) =>
  ['', '.html', '.js', '.json', '.css', '.map', '.md'].includes(extname(path)),
);
const forbidden = [
  { label: 'private key', pattern: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/ },
  { label: 'live-looking API key', pattern: /\b(?:sk|dsk)-[A-Za-z0-9_-]{20,}\b/ },
  { label: 'personal absolute path', pattern: /\/(?:Users|home)\/[A-Za-z0-9._-]+\// },
  { label: 'remote executable script', pattern: /<script[^>]+src=["']https?:\/\//i },
];

for (const path of textFiles) {
  const content = await readFile(path, 'utf8');
  for (const check of forbidden) {
    assert(!check.pattern.test(content), `${check.label} found in ${path}`);
  }
}

const expectedArchive = `textduet-${packageManifest.version}-chrome.zip`;
assert(
  (await readdir(outputDir)).includes(expectedArchive),
  `Chrome release ZIP was not created for package version ${packageManifest.version}`,
);

process.stdout.write(
  `Release verification passed: ${textFiles.length} text assets, ${expectedArchive}\n`,
);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return paths.flat();
}
