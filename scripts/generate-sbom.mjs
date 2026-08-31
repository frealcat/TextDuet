/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const root = resolve('.');
const packageManifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const lockfile = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
const generatedAt = sourceDateEpoch();

const components = [];
const dependencies = [];
for (const [packagePath, packageInfo] of Object.entries(lockfile.packages ?? {})) {
  if (!packagePath.startsWith('node_modules/') || !packageInfo?.version) continue;
  const name = packageNameFromPath(packagePath);
  const purl = `pkg:npm/${encodePurlName(name)}@${encodeURIComponent(packageInfo.version)}`;
  // npm v11 marks packages reached through dev-only optional peer paths with
  // `devOptional` instead of `dev`. They are still development-only for the
  // release inventory and must not be reported as shipped runtime packages.
  const isDevelopmentOnly = packageInfo.dev === true || packageInfo.devOptional === true;
  const component = {
    type: 'library',
    name,
    version: packageInfo.version,
    purl,
    scope: isDevelopmentOnly ? 'optional' : 'required',
  };
  const license = normalizeLicense(packageInfo.license);
  if (license) component.licenses = [{ expression: license }];
  const integrity = parseIntegrity(packageInfo.integrity);
  if (integrity) component.hashes = [integrity];
  if (packageInfo.resolved) {
    component.externalReferences = [{ type: 'distribution', url: packageInfo.resolved }];
  }
  components.push(component);
  dependencies.push({
    ref: purl,
    dependsOn: Object.keys(packageInfo.dependencies ?? {}).map((dependencyName) => {
      const dependencyPath = resolveDependencyPath(packagePath, dependencyName, lockfile.packages ?? {});
      const dependencyInfo = lockfile.packages?.[dependencyPath];
      return dependencyInfo?.version
        ? `pkg:npm/${encodePurlName(packageNameFromPath(dependencyPath))}@${encodeURIComponent(dependencyInfo.version)}`
        : undefined;
    }).filter(Boolean),
  });
}

if (components.some((component) => !component.licenses?.length)) {
  const missing = components.filter((component) => !component.licenses?.length).map((component) => `${component.name}@${component.version}`);
  throw new Error(`Locked packages without a declared license: ${missing.join(', ')}`);
}

components.sort((left, right) => left.purl.localeCompare(right.purl));
dependencies.sort((left, right) => left.ref.localeCompare(right.ref));

const rootRef = `pkg:npm/${encodePurlName(packageManifest.name)}@${encodeURIComponent(packageManifest.version)}`;
const serialHex = createHash('sha256').update(`${packageManifest.name}@${packageManifest.version}`).digest('hex').slice(0, 32);
const serialUuid = `${serialHex.slice(0, 8)}-${serialHex.slice(8, 12)}-${serialHex.slice(12, 16)}-${serialHex.slice(16, 20)}-${serialHex.slice(20)}`;
const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${serialUuid}`,
  version: 1,
  metadata: {
    tools: [{ vendor: 'frealcat', name: 'TextDuet release tooling', version: packageManifest.version }],
    component: {
      type: 'application',
      name: packageManifest.name,
      version: packageManifest.version,
      purl: rootRef,
      licenses: [{ expression: packageManifest.license }],
    },
    properties: [
      { name: 'textduet:lockfileVersion', value: String(lockfile.lockfileVersion) },
      { name: 'textduet:nodeEngine', value: packageManifest.engines?.node ?? '' },
    ],
  },
  components,
  dependencies: [{ ref: rootRef, dependsOn: components.filter((component) => component.scope === 'required').map((component) => component.purl) }, ...dependencies],
};

// Keep release artifacts reproducible. A release process that needs a recorded
// generation time can set SOURCE_DATE_EPOCH to the reviewed artifact's epoch.
if (generatedAt) bom.metadata.timestamp = generatedAt;

const licenseReport = {
  schemaVersion: 1,
  project: {
    name: packageManifest.name,
    version: packageManifest.version,
    license: packageManifest.license,
  },
  packages: components.map((component) => ({
    name: component.name,
    version: component.version,
    license: component.licenses?.[0]?.expression ?? 'UNKNOWN',
    source: component.externalReferences?.[0]?.url ?? null,
    integrity: lockfile.packages[findLockPath(component.name, component.version)]?.integrity ?? null,
    dev: (() => {
      const info = lockfile.packages[findLockPath(component.name, component.version)];
      return info?.dev === true || info?.devOptional === true;
    })(),
  })),
};

if (generatedAt) licenseReport.generatedAt = generatedAt;

const sbomText = `${JSON.stringify(bom, null, 2)}\n`;
const licenseReportText = `${JSON.stringify(licenseReport, null, 2)}\n`;
await mkdir(dirname(resolve(root, 'SBOM.cdx.json')), { recursive: true });
await mkdir(resolve(root, '.output'), { recursive: true });
await Promise.all([
  writeFile(resolve(root, 'SBOM.cdx.json'), sbomText, 'utf8'),
  writeFile(resolve(root, 'THIRD_PARTY_LICENSES.json'), licenseReportText, 'utf8'),
  writeFile(resolve(root, '.output/SBOM.cdx.json'), sbomText, 'utf8'),
  writeFile(resolve(root, '.output/THIRD_PARTY_LICENSES.json'), licenseReportText, 'utf8'),
]);
process.stdout.write(`Generated SBOM (${components.length} locked packages) and third-party license report.\n`);

function encodePurlName(name) {
  return name.startsWith('@')
    ? name.split('/').map((part) => encodeURIComponent(part)).join('/')
    : encodeURIComponent(name);
}

function packageNameFromPath(packagePath) {
  const marker = '/node_modules/';
  const start = packagePath.lastIndexOf(marker);
  const packageRoot = start >= 0 ? packagePath.slice(start + marker.length) : packagePath.slice('node_modules/'.length);
  if (packageRoot.startsWith('@')) {
    const [scope, name] = packageRoot.split('/');
    return name ? `${scope}/${name}` : packageRoot;
  }
  return packageRoot.split('/')[0] ?? packageRoot;
}

function normalizeLicense(value) {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  // package-lock license values are SPDX IDs in npm's current lock format.
  return value.trim();
}

function parseIntegrity(integrity) {
  if (typeof integrity !== 'string') return undefined;
  const match = /^(sha\d+)-(.+)$/.exec(integrity);
  if (!match) return undefined;
  const algorithm = match[1].toLowerCase() === 'sha512' ? 'SHA-512' : match[1].toLowerCase() === 'sha256' ? 'SHA-256' : match[1].toUpperCase();
  return { alg: algorithm, content: Buffer.from(match[2], 'base64').toString('hex') };
}

function findLockPath(name, version) {
  const direct = `node_modules/${name}`;
  if (lockfile.packages[direct]?.version === version) return direct;
  return Object.keys(lockfile.packages).find((path) => path.endsWith(`/node_modules/${name}`) && lockfile.packages[path]?.version === version) ?? direct;
}

function resolveDependencyPath(packagePath, dependencyName, packages) {
  let parentPath = packagePath;
  while (true) {
    const candidate = `${parentPath}/node_modules/${dependencyName}`;
    if (packages[candidate]) return candidate;
    if (!parentPath) break;
    const parentIndex = parentPath.lastIndexOf('/node_modules/');
    if (parentIndex < 0) {
      parentPath = '';
    } else {
      parentPath = parentPath.slice(0, parentIndex);
    }
  }
  return `node_modules/${dependencyName}`;
}

function sourceDateEpoch() {
  const value = process.env.SOURCE_DATE_EPOCH;
  if (value === undefined || value === '') return undefined;
  if (!/^\d+$/.test(value)) throw new Error('SOURCE_DATE_EPOCH must be an integer Unix timestamp');
  const timestamp = Number(value) * 1000;
  if (!Number.isSafeInteger(timestamp) || !Number.isFinite(timestamp)) {
    throw new Error('SOURCE_DATE_EPOCH is outside JavaScript\'s supported timestamp range');
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) throw new Error('SOURCE_DATE_EPOCH is not a valid timestamp');
  return date.toISOString();
}
