import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import validateManifest from '../tooling/pwa-manifest-coverage.cjs';
const baseline = process.env.PWA_BASELINE_DIR;
if (!baseline) throw new Error('PWA_BASELINE_DIR is required');
const readWorker = directory => fs.readFileSync(path.join(directory, 'public/sw.js'));
const oldWorker = readWorker(baseline);
const newWorker = readWorker(process.cwd());
const hash = value => createHash('sha256').update(value).digest('hex');
const oldCoverage = validateManifest(baseline, oldWorker);
const newCoverage = validateManifest(process.cwd(), newWorker);
const urls = value => [...value.toString().matchAll(/url:["']([^"']+)/g)].map(match => match[1]);
const oldUrls = new Set(urls(oldWorker));
const newOnly = urls(newWorker).find(url => url.startsWith('/_next/static/') && !oldUrls.has(url)) ?? urls(newWorker).find(url => url.startsWith('/_next/static/'));
if (!newOnly || hash(oldWorker) === hash(newWorker)) throw new Error('Old and new builds must have distinct generated workers and a precache asset');
let phase = 'old';
let probes = 0;
let networkEnabled = true;
const servedWorkers = [];
const json = (response, value) => { response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(value)); };
http.createServer((request, response) => {
  if (request.headers.host !== '127.0.0.1:38221') { response.writeHead(400); response.end(); return; }
  if (request.headers.origin && request.headers.origin !== 'http://127.0.0.1:38221') { response.writeHead(403); response.end(); return; }
  const url = new URL(request.url, 'http://127.0.0.1:38221');
  if (url.pathname === '/__pwa_test_state' && request.method === 'GET') return json(response, { phase, probes, servedWorkers, coverage: { old: oldCoverage, new: newCoverage }, oldSha: hash(oldWorker), newSha: hash(newWorker), newOnly });
  if (url.pathname.startsWith('/__pwa_test_phase/') && request.method === 'POST') {
    const next = url.pathname.split('/').at(-1);
    if (!['old', 'new'].includes(next)) { response.writeHead(400); response.end(); return; }
    phase = next; return json(response, { phase });
  }
  if (url.pathname.startsWith('/__pwa_test_network/') && request.method === 'POST') {
    networkEnabled = url.pathname.endsWith('/on'); return json(response, { networkEnabled });
  }
  if (!networkEnabled) { request.socket.destroy(); return; }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  if (url.pathname === '/api/pwa-synthetic-probe') { probes++; return json(response, { source: `${phase}-network` }); }
  const port = phase === 'old' ? 38222 : 38220;
  const headers = { ...request.headers, host: `127.0.0.1:${port}` };
  delete headers['accept-encoding'];
  const upstream = http.request({ hostname: '127.0.0.1', port, path: request.url, method: request.method, headers }, result => {
    const outputHeaders = { ...result.headers };
    if (url.pathname === '/sw.js' || /^\/(workbox|worker|swe-worker)-.*\.js$/.test(url.pathname)) {
      outputHeaders['cache-control'] = 'no-store'; outputHeaders['service-worker-allowed'] = '/';
    }
    response.writeHead(result.statusCode ?? 502, outputHeaders);
    if (url.pathname === '/sw.js') {
      const chunks = []; result.on('data', data => chunks.push(data));
      result.on('end', () => { const data = Buffer.concat(chunks); servedWorkers.push({ phase, sha: hash(data) }); response.end(data); });
    } else result.pipe(response);
  });
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
  request.pipe(upstream);
}).listen(38221, '127.0.0.1');
