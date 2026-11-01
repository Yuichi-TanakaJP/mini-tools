import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const fromPwa = createRequire(require.resolve('@ducanh2912/next-pwa'));
const fromWorkbox = createRequire(fromPwa.resolve('workbox-build'));

test('official glob14 enumerates wildcard assets and exclusions through Workbox', async () => {
  assert.equal(fromPwa('workbox-build/package.json').version, '7.4.1');
  assert.equal(fromWorkbox('glob/package.json').version, '14.0.3');
  assert.equal(createRequire(fromWorkbox.resolve('glob'))('minimatch/package.json').version, '11.0.3');
  const dir = mkdtempSync(path.join(tmpdir(), 'pwa-glob-'));
  try {
    mkdirSync(path.join(dir, 'assets')); mkdirSync(path.join(dir, 'excluded'));
    for (const name of ['index.js', 'assets/app.js', 'assets/app.css', 'shell.html', 'excluded/private.js']) writeFileSync(path.join(dir, name), 'synthetic fixture');
    const glob = fromWorkbox('glob');
    assert.deepEqual(glob.globSync('assets/*.js', { cwd: dir }).map(file => file.split(path.sep).join('/')), ['assets/app.js']);
    const result = await fromPwa('workbox-build').getManifest({ globDirectory: dir, globPatterns: ['**/*.{js,css,html}'], globIgnores: ['excluded/**'] });
    assert.equal(result.count, 4);
    assert.deepEqual(result.manifestEntries.map(entry => entry.url).sort(), ['assets/app.css', 'assets/app.js', 'index.js', 'shell.html']);
    assert.deepEqual(result.warnings, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test('migration coverage rejects omitted public and static assets', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pwa-coverage-'));
  try {
    mkdirSync(path.join(dir, '.next/static/chunks'), { recursive: true });
    mkdirSync(path.join(dir, 'public'));
    writeFileSync(path.join(dir, '.next/static/chunks/[page].js'), 'fixture');
    writeFileSync(path.join(dir, 'public/icon.svg'), 'fixture');
    const validate = require('../tooling/pwa-manifest-coverage.cjs');
    const worker = urls => `self.precacheAndRoute(${JSON.stringify(urls.map(url => ({ url })))});`;
    assert.equal(validate(dir, worker(['/_next/static/chunks/%5Bpage%5D.js', '/icon.svg'])).staticCount, 1);
    for (const urls of [['/icon.svg'], ['/_next/static/chunks/%5Bpage%5D.js']]) assert.throws(() => validate(dir, worker(urls)), /Missing precache assets/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test('preserved Pages entry warms the first-install landing page without an online revisit', async () => {
  const source = readFileSync('tooling/next-pwa-legacy-register.js', 'utf8').replace("import { Workbox } from 'workbox-window'", '');
  for (const redirected of [false, true]) {
    const listeners = new Map();
    const stored = new Map();
    const pending = [];
    const response = new Response('synthetic landing page', { status: 200 });
    Object.defineProperty(response, 'redirected', { value: redirected });
    const sandbox = {
      __PWA_START_URL__: '/', __PWA_SW__: '/sw.js', __PWA_SCOPE__: '/', __PWA_ENABLE_REGISTER__: true, __PWA_CACHE_ON_FRONT_END_NAV__: false, __PWA_RELOAD_ON_ONLINE__: false,
      window: { location: { origin: 'https://synthetic.invalid' }, performance: { getEntriesByType: () => [] }, addEventListener() {} },
      navigator: { serviceWorker: {} }, history: { pushState() {}, replaceState() {} }, Response,
      caches: { has: async () => true, open: async name => ({ put: async (url, value) => stored.set(`${name}:${url}`, await value.text()), add: async () => {} }) },
      fetch: async url => { assert.equal(url, '/'); return response; },
      Workbox: class { addEventListener(name, callback) { listeners.set(name, [...(listeners.get(name) ?? []), callback]); } register() { for (const callback of listeners.get('installed') ?? []) pending.push(callback({ isUpdate: false })); } },
    };
    vm.runInNewContext(source, sandbox);
    await Promise.all(pending);
    assert.equal(stored.get('start-url:/'), 'synthetic landing page');
  }
});
