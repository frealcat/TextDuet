/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from 'node:http';
import { realpath, readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../tests/fixtures/pages/', import.meta.url)));
const rootRealPath = await realpath(root);
const port = parsePort(process.env.TEXTDUET_FIXTURE_PORT || '8765');
const host = process.env.TEXTDUET_FIXTURE_HOST || '127.0.0.1';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Method Not Allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}`).pathname);
  } catch {
    sendText(response, 400, 'Bad Request');
    return;
  }

  const relativePath = pathname.replace(/^\/+/, '');
  if (!relativePath || relativePath.includes('\0')) {
    sendText(response, 404, 'Not Found');
    return;
  }

  const candidate = resolve(rootRealPath, relativePath);
  const candidateRelative = relative(rootRealPath, candidate);
  if (candidateRelative === '..' || candidateRelative.startsWith(`..${sep}`) || candidateRelative.includes(`..${sep}`)) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  let fileInfo;
  try {
    const canonicalPath = await realpath(candidate);
    const canonicalRelative = relative(rootRealPath, canonicalPath);
    if (canonicalRelative === '..' || canonicalRelative.startsWith(`..${sep}`)) {
      sendText(response, 403, 'Forbidden');
      return;
    }
    fileInfo = await stat(canonicalPath);
    if (!fileInfo.isFile()) {
      sendText(response, 404, 'Not Found');
      return;
    }
    const body = request.method === 'HEAD' ? undefined : await readFile(canonicalPath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': fileInfo.size,
      'Content-Type': contentTypes[extname(canonicalPath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(body);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      sendText(response, 404, 'Not Found');
      return;
    }
    console.error('Fixture request failed:', error);
    sendText(response, 500, 'Internal Server Error');
  }
});

server.on('error', (error) => {
  console.error(`Fixture server could not listen on ${host}:${port}:`, error);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Serving browser fixtures from ${rootRealPath} at http://${host}:${port}/`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

function parsePort(value) {
  if (!/^\d+$/.test(value)) throw new Error('TEXTDUET_FIXTURE_PORT must be an integer');
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error('TEXTDUET_FIXTURE_PORT must be between 1 and 65535');
  }
  return parsed;
}

function sendText(response, status, text) {
  const body = `${text}\n`;
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}
