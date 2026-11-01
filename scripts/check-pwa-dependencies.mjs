import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
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
