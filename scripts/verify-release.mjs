import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const extensionDir = resolve('.output/chrome-mv3');
const outputDir = resolve('.output');
const packageManifest = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
const lockfile = JSON.parse(await readFile(resolve('package-lock.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(extensionDir, 'manifest.json'), 'utf8'));
assert.equal(packageManifest.name, 'textduet', 'package name must remain textduet for release artifact naming');
assert.equal(lockfile.name, packageManifest.name, 'package-lock name must match package.json');
assert.equal(lockfile.packages?.['']?.version, packageManifest.version, 'package-lock root version must match package.json');
const expectedArchive = `${packageManifest.name}-${packageManifest.version}-chrome.zip`;
const archivePath = resolve(outputDir, expectedArchive);

const outputFiles = await readdir(outputDir);
const releaseArchives = outputFiles.filter((fileName) => /^textduet-[0-9]+\.[0-9]+\.[0-9]+-chrome\.zip$/.test(fileName));
assert.deepEqual(releaseArchives, [expectedArchive], 'Output directory must contain exactly one versioned Chrome ZIP');

assert.equal(manifest.version, packageManifest.version, 'Manifest version must match package version');

for (const fileName of [
  'LICENSE',
  'NOTICE',
  'THIRD_PARTY_NOTICES.md',
  'SBOM.cdx.json',
  'THIRD_PARTY_LICENSES.json',
]) {
  assert((await stat(resolve(extensionDir, fileName))).size > 0, `${fileName} missing from release`);
}

const sbom = JSON.parse(await readFile(resolve(extensionDir, 'SBOM.cdx.json'), 'utf8'));
assert.equal(sbom.bomFormat, 'CycloneDX', 'SBOM must use CycloneDX format');
assert.equal(sbom.specVersion, '1.5', 'SBOM spec version must be 1.5');
assert(Array.isArray(sbom.components), 'SBOM components are missing');
assert.equal(sbom.metadata?.component?.version, packageManifest.version, 'SBOM project version mismatch');

const licenseReport = JSON.parse(await readFile(resolve(extensionDir, 'THIRD_PARTY_LICENSES.json'), 'utf8'));
assert.equal(licenseReport.schemaVersion, 1, 'Unsupported third-party license report schema');
assert.equal(licenseReport.project?.version, packageManifest.version, 'License report project version mismatch');
assert(Array.isArray(licenseReport.packages) && licenseReport.packages.length > 0, 'License report is empty');

// Keep the generated development/runtime classification tied to npm's lock
// metadata. In npm v11, dev-only optional peer paths use `devOptional`; a
// report that checks only `dev` silently mislabels those packages as shipped.
for (const entry of licenseReport.packages) {
  const lockPath = findLockPackagePath(entry.name, entry.version);
  const lockInfo = lockfile.packages?.[lockPath];
  assert(lockInfo, `License report package is missing from package-lock.json: ${entry.name}@${entry.version}`);
  const expectedDev = lockInfo.dev === true || lockInfo.devOptional === true;
  assert.equal(entry.dev, expectedDev, `License report development scope is stale for ${entry.name}@${entry.version}`);
}

assert.deepEqual(
  [...(manifest.permissions || [])].sort(),
  ['activeTab', 'contextMenus', 'scripting', 'storage'],
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

// The Translator Script executes in an untrusted webpage context. Keep its
// storage boundary as a build-time contract as well as a source-level one:
// a future bundler change must not pull the trusted extension storage layer
// into this bundle through an indirect/minified alias.
const translatorBundlePath = resolve(extensionDir, 'translator.js');
const translatorBundle = await readFile(translatorBundlePath, 'utf8');
const translatorStorageChecks = [
  {
    label: 'Chrome extension storage API',
    pattern: /\b(?:browser|chrome)\s*\.\s*storage\b/i,
  },
  {
    label: 'aliased extension storage API',
    pattern: /\.\s*storage\s*\.\s*(?:local|session|sync)\b/i,
  },
  {
    label: 'Web Storage API',
    pattern: /\b(?:localStorage|sessionStorage)\b/i,
  },
  {
    label: 'IndexedDB API',
    pattern: /\b(?:indexedDB|openDatabase|IDB(?:Database|Factory|Transaction|ObjectStore|Request|KeyRange))\b/i,
  },
];
const translatorStorageViolations = translatorStorageChecks
  .filter(({ pattern }) => pattern.test(translatorBundle))
  .map(({ label }) => label);
assert.equal(
  translatorStorageViolations.length,
  0,
  `Translator storage boundary violated in ${translatorBundlePath}: ${translatorStorageViolations.join(', ')}. ` +
    'Translator must not access Chrome Storage, Web Storage, or IndexedDB; use the Service Worker message boundary instead.',
);

const forbidden = [
  { label: 'private key', pattern: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/ },
  { label: 'live-looking API key', pattern: /\b(?:sk|dsk)-[A-Za-z0-9_-]{20,}\b/ },
  { label: 'personal absolute path', pattern: /\/(?:Users|home)\/[A-Za-z0-9._-]+\// },
  { label: 'remote executable script', pattern: /<script[^>]+src=["']https?:\/\//i },
  { label: 'dynamic code execution', pattern: /\beval\s*\(|\bnew\s+Function\s*\(/ },
];

for (const path of textFiles) {
  const content = await readFile(path, 'utf8');
  for (const check of forbidden) {
    assert(!check.pattern.test(content), `${check.label} found in ${path}`);
  }
}

const archiveStat = await stat(archivePath);
assert(archiveStat.size > 0, `Chrome release ZIP is missing or empty: ${expectedArchive}`);
const archiveDigest = createHash('sha256').update(await readFile(archivePath)).digest('hex');
const checksumPath = resolve(outputDir, 'SHA256SUMS.txt');
const checksumText = await readFile(checksumPath, 'utf8');
const checksumLine = checksumText.split(/\r?\n/).find((line) => line.trim().endsWith(`  ${expectedArchive}`));
assert.equal(checksumLine, `${archiveDigest}  ${expectedArchive}`, 'SHA256SUMS.txt does not match release ZIP');
for (const fileName of ['SBOM.cdx.json', 'THIRD_PARTY_LICENSES.json']) {
  const fileDigest = createHash('sha256').update(await readFile(resolve(outputDir, fileName))).digest('hex');
  assert(checksumText.split(/\r?\n/).includes(`${fileDigest}  ${fileName}`), `${fileName} checksum is missing or stale`);
}

const buildEntries = (await walk(extensionDir))
  .map((path) => path.slice(extensionDir.length + 1).replaceAll('\\', '/'))
  .sort();
const archiveRecords = readZipEntries(await readFile(archivePath));
const archiveEntries = archiveRecords.map((record) => record.name).sort();
assert.deepEqual(archiveEntries, buildEntries, 'ZIP contents differ from the verified build directory');
assert(!archiveEntries.some((entry) => entry.startsWith('/') || entry.split('/').includes('..')), 'ZIP contains an unsafe path');
await verifyArchiveBytes(archivePath, extensionDir, archiveRecords);

process.stdout.write(
  `Release verification passed: ${textFiles.length} text assets, ${archiveEntries.length} ZIP entries, ${expectedArchive}\n`,
);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return paths.flat();
}

/**
 * Read records from a regular ZIP central directory. WXT's release ZIPs are
 * small enough for the classic EOCD format; the records are then decompressed
 * and compared byte-for-byte with the verified build directory below.
 */
function readZipEntries(buffer) {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const minimumEocdSize = 22;
  const searchStart = Math.max(0, buffer.length - 0xffff - minimumEocdSize);
  let eocdOffset = -1;
  for (let offset = buffer.length - minimumEocdSize; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  assert.notEqual(eocdOffset, -1, 'ZIP end-of-central-directory record is missing');
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  assert(centralOffset + centralSize <= buffer.length, 'ZIP central directory is truncated');

  const entries = [];
  const names = new Set();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(buffer.readUInt32LE(offset), centralSignature, 'Invalid ZIP central directory entry');
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    assert(name && !name.startsWith('/') && !name.split('/').includes('..'), `ZIP contains an unsafe path: ${name}`);
    assert(!names.has(name), `ZIP contains a duplicate entry: ${name}`);
    assert.equal(flags & 1, 0, `ZIP entry is encrypted: ${name}`);
    assert(method === 0 || method === 8, `Unsupported ZIP compression method for ${name}: ${method}`);
    entries.push({ name, flags, method, compressedSize, uncompressedSize, localHeaderOffset });
    names.add(name);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(entries.length, entryCount, 'ZIP entry count mismatch');
  return entries;
}

async function verifyArchiveBytes(archivePathToVerify, buildDirectory, records) {
  const archive = await readFile(archivePathToVerify);
  for (const record of records) {
    const localOffset = record.localHeaderOffset;
    assert(localOffset + 30 <= archive.length, `ZIP local header is truncated: ${record.name}`);
    assert.equal(archive.readUInt32LE(localOffset), 0x04034b50, `Invalid ZIP local header: ${record.name}`);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + record.compressedSize;
    assert(dataEnd <= archive.length, `ZIP entry data is truncated: ${record.name}`);
    const compressed = archive.subarray(dataStart, dataEnd);
    const content = record.method === 0 ? compressed : inflateRawSync(compressed);
    assert.equal(content.length, record.uncompressedSize, `ZIP size mismatch: ${record.name}`);
    const buildPath = resolve(buildDirectory, record.name);
    assert.equal(buildPath.startsWith(`${resolve(buildDirectory)}/`), true, `ZIP path escaped build directory: ${record.name}`);
    const expected = await readFile(buildPath);
    assert(expected.equals(content), `ZIP bytes differ from verified build file: ${record.name}`);
  }
}

function findLockPackagePath(name, version) {
  const direct = `node_modules/${name}`;
  if (lockfile.packages?.[direct]?.version === version) return direct;
  return Object.keys(lockfile.packages ?? {}).find((path) =>
    path.endsWith(`/node_modules/${name}`) && lockfile.packages[path]?.version === version,
  ) ?? direct;
}
