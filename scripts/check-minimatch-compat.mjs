import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync, linkSync, renameSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { ESLint } from 'eslint';
const require = createRequire(import.meta.url);
const root = process.cwd();
const recipes = JSON.parse(readFileSync('tooling/minimatch-patches.json', 'utf8'));
const temporary = () => mkdtempSync(path.join(tmpdir(), 'minimatch-compat-'));

test('clean-install graph uses real registry minimatch11 and all reviewed sources are prepared', () => {
  execFileSync(process.execPath, ['scripts/install-minimatch-compat.cjs', '--check']);
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const matchers = Object.entries(lock.packages).filter(([name]) => /node_modules\/(minimatch|minimatch-modern)$/.test(name));
  assert.ok(matchers.length >= 2);
  for (const [name, value] of matchers) {
    assert.equal(value.version, '11.0.3', name);
    assert.ok(value.resolved?.startsWith('https://registry.npmjs.org/minimatch/'), name);
  }
  assert.equal(createRequire(require.resolve('@local/minimatch-legacy-bridge'))('minimatch-modern/package.json').version, '11.0.3');
});

test('public ESM config parents load through their actual import entry points', async () => {
  const config = await import('@eslint/config-array');
  assert.equal(typeof config.ConfigArray, 'function');
  assert.equal(typeof (await import('@eslint/eslintrc')).FlatCompat, 'function');
});

test('legacy enumeration includes files for relative and native absolute glob paths', async () => {
  const dir = temporary();
  try {
    mkdirSync(path.join(dir, 'src'));
    for (const name of ['view.tsx', 'helper.ts']) writeFileSync(path.join(dir, 'src', name), 'alert("fixture")');
    writeFileSync(path.join(dir, 'src', 'style.css'), 'body{}');
    const { LegacyESLint } = require('eslint/use-at-your-own-risk');
    const eslint = new LegacyESLint({ cwd: dir, useEslintrc: false, overrideConfig: { parserOptions: { ecmaVersion: 2020 }, rules: { 'no-alert': 'error' } } });
    for (const pattern of ['src/**/*.{ts,tsx}', path.join(dir, 'src', '**', '*.{ts,tsx}')]) {
      const results = await eslint.lintFiles([pattern]);
      assert.equal(results.length, 2);
      assert.ok(results.every(result => result.messages.some(message => message.ruleId === 'no-alert')));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('existing Next hook/accessibility policy still reports violations', async () => {
  const eslint = new ESLint();
  const [result] = await eslint.lintText('"use client"; import { useState } from "react"; export default function Probe({ flag }) { if(flag) useState(0); return <img src="/fixture.png" />; }', { filePath: 'app/probe.tsx' });
  assert.ok(result.messages.some(message => message.ruleId === 'react-hooks/rules-of-hooks' && message.severity === 2));
  assert.ok(result.messages.some(message => message.ruleId === 'jsx-a11y/alt-text' && message.severity === 1));
});

test('legacy callable matcher is exercised by a real React plugin rule', async () => {
  const eslint = new ESLint({ overrideConfig: [{ rules: { 'react/forbid-component-props': ['error', { forbid: [{ propNamePattern: 'data-*', allowedForPatterns: ['Allowed*'] }] }] } }] });
  for (const [component, expected] of [['DeniedWidget', 1], ['AllowedWidget', 0]]) {
    const [result] = await eslint.lintText(`export default function Probe() { return <${component} data-secret="fixture" />; }`, { filePath: 'app/probe.tsx' });
    assert.equal(result.messages.filter(message => message.ruleId === 'react/forbid-component-props').length, expected);
  }
});

test('unsupported RegExp rule is currently off and fails closed if enabled', async () => {
  const config = await new ESLint().calculateConfigForFile('app/page.tsx');
  assert.ok(!config.rules['import/no-internal-modules'] || config.rules['import/no-internal-modules'][0] === 0);
  const eslint = new ESLint({ overrideConfig: [{ rules: { 'import/no-internal-modules': ['error', { forbid: ['**/private/**'] }] } }] });
  await assert.rejects(eslint.lintText('import value from "fixture/private/file"; console.log(value);', { filePath: 'app/probe.tsx' }), /MINIMATCH_LEGACY_REGEXP_UNSUPPORTED/);
});


function withInstallerFixture(action) {
  const dir = temporary();
  try {
    mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    mkdirSync(path.join(dir, 'tooling'), { recursive: true });
    writeFileSync(path.join(dir, 'scripts/install-minimatch-compat.cjs'), readFileSync('scripts/install-minimatch-compat.cjs'));
    writeFileSync(path.join(dir, 'tooling/minimatch-patches.json'), JSON.stringify(recipes));
    cpSync('tooling/minimatch-bridge-hashes.json', path.join(dir, 'tooling/minimatch-bridge-hashes.json'));
    for (const recipe of recipes) {
      const file = path.join(dir, recipe.file);
      mkdirSync(path.dirname(file), { recursive: true });
      const pkg = path.join(dir, 'node_modules', recipe.package, 'package.json');
      mkdirSync(path.dirname(pkg), { recursive: true });
      writeFileSync(pkg, JSON.stringify({ version: recipe.version }));
      writeFileSync(file, readFileSync(path.join(root, recipe.file)));
    }
    for (const target of ['tooling/minimatch-legacy-bridge', 'node_modules/@local/minimatch-legacy-bridge']) {
      cpSync(path.join(root, 'tooling/minimatch-legacy-bridge'), path.join(dir, target), { recursive: true });
    }
    const backend = path.join(dir, 'node_modules/minimatch-modern');
    mkdirSync(backend, { recursive: true });
    writeFileSync(path.join(backend, 'package.json'), JSON.stringify({ name: 'minimatch', version: '11.0.3', main: 'index.cjs' }));
    // This stub exercises installer loading only; matching uses real installed parents above.
    writeFileSync(path.join(backend, 'index.cjs'), 'exports.Minimatch = class {};');
    action(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('installer rejects altered dependency source before writing any files', () => withInstallerFixture(dir => {
    const first = path.join(dir, recipes[0].file);
    const originalFirst = readFileSync(first, 'utf8').replaceAll('@local/minimatch-legacy-bridge', 'minimatch');
    writeFileSync(first, originalFirst);
    const file = path.join(dir, recipes.at(-1).file);
    const tampered = readFileSync(file, 'utf8') + '\n// synthetic modification\n';
    writeFileSync(file, tampered);
    const child = spawnSync(process.execPath, [path.join(dir, 'scripts/install-minimatch-compat.cjs')], { encoding: 'utf8' });
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /Unreviewed dependency source/);
    assert.equal(readFileSync(file, 'utf8'), tampered);
    assert.equal(readFileSync(first, 'utf8'), originalFirst);
}));

test('legacy dot-parent patterns do not broaden ignored files through CJS and ESM parents', async () => {
  for (const { ConfigArray } of [require('@eslint/config-array'), await import('@eslint/config-array')]) {
    const configs = new ConfigArray([{ files: ['**/*.js'] }, { ignores: ['fixtures/../*.js'] }], { basePath: root });
    configs.normalizeSync();
    assert.equal(configs.getConfigStatus(path.join(root, 'main.js')), 'matched');
  }
});

test('missing bridge or backend fails before changing original or prepared parents', () => {
  for (const missing of ['@local/minimatch-legacy-bridge', 'minimatch-modern']) {
    for (const prepared of [false, true]) withInstallerFixture(dir => {
      const first = path.join(dir, recipes[0].file);
      if (!prepared) writeFileSync(first, readFileSync(first, 'utf8').replaceAll('@local/minimatch-legacy-bridge', 'minimatch'));
      const before = readFileSync(first);
      rmSync(path.join(dir, 'node_modules', missing), { recursive: true });
      const child = spawnSync(process.execPath, [path.join(dir, 'scripts/install-minimatch-compat.cjs'), ...(prepared ? ['--check'] : [])], { encoding: 'utf8' });
      assert.notEqual(child.status, 0);
      assert.match(child.stderr, /MODULE_NOT_FOUND/);
      assert.deepEqual(readFileSync(first), before);
    });
  }
});

test('shared hard-linked source is rejected without modifying either installation', () => withInstallerFixture(dir => {
  const first = path.join(dir, recipes[0].file);
  const original = readFileSync(first, 'utf8').replaceAll('@local/minimatch-legacy-bridge', 'minimatch');
  writeFileSync(first, original);
  const shared = path.join(dir, 'other-install.cjs');
  linkSync(first, shared);
  const child = spawnSync(process.execPath, [path.join(dir, 'scripts/install-minimatch-compat.cjs')], { encoding: 'utf8' });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Shared dependency source/);
  assert.equal(readFileSync(shared, 'utf8'), original);
  assert.equal(readFileSync(first, 'utf8'), original);
}));

test('an omitted development graph is a no-op, never a passing check', () => withInstallerFixture(dir => {
  rmSync(path.join(dir, 'node_modules'), { recursive: true });
  const script = path.join(dir, 'scripts/install-minimatch-compat.cjs');
  assert.equal(spawnSync(process.execPath, [script]).status, 0);
  assert.notEqual(spawnSync(process.execPath, [script, '--check']).status, 0);
}));


test('modern POSIX classes fail closed through both legacy parent entry points', async () => {
  for (const { ConfigArray } of [require('@eslint/config-array'), await import('@eslint/config-array')]) {
    for (const pattern of ['[[:alpha:]]*.js', '[x[:alpha:]]*.js', '[![:digit:]]*.js', '[a[:digit:]]*.js']) {
      const configs = new ConfigArray([{ files: ['**/*.js'] }, { ignores: [pattern] }], { basePath: root });
      configs.normalizeSync();
      assert.throws(() => configs.getConfigStatus(path.join(root, 'main.js')), /MINIMATCH_LEGACY_POSIX_UNSUPPORTED/);
    }
  }
});

test('a bridge altered in both source and install is rejected by independent digests', () => withInstallerFixture(dir => {
  for (const target of ['tooling/minimatch-legacy-bridge', 'node_modules/@local/minimatch-legacy-bridge']) {
    const file = path.join(dir, target, 'index.cjs');
    writeFileSync(file, readFileSync(file, 'utf8').replace('return new Minimatch(pattern, options).match(file);', 'return true;'));
  }
  const child = spawnSync(process.execPath, [path.join(dir, 'scripts/install-minimatch-compat.cjs'), '--check'], { encoding: 'utf8' });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Unreviewed minimatch bridge/);
}));

test('a redirected installation root is rejected before changing shared sources', () => withInstallerFixture(dir => {
  const modules = path.join(dir, 'node_modules');
  const shared = path.join(dir, 'shared-modules');
  renameSync(modules, shared);
  symlinkSync(shared, modules, process.platform === 'win32' ? 'junction' : 'dir');
  const first = path.join(modules, recipes[0].file.slice('node_modules/'.length));
  const original = readFileSync(first, 'utf8').replaceAll('@local/minimatch-legacy-bridge', 'minimatch');
  writeFileSync(first, original);
  const child = spawnSync(process.execPath, [path.join(dir, 'scripts/install-minimatch-compat.cjs')], { encoding: 'utf8' });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Redirected node_modules root/);
  assert.equal(readFileSync(first, 'utf8'), original);
}));


test('altered exports cannot select an unreviewed entry beside approved bridge files', () => withInstallerFixture(dir => {
  const slot = path.join(dir, 'node_modules/@local/minimatch-legacy-bridge');
  const alternate = path.join(slot, 'alternate');
  mkdirSync(alternate);
  for (const file of ['package.json', 'index.cjs', 'index.mjs']) cpSync(path.join(slot, file), path.join(alternate, file));
  writeFileSync(path.join(alternate, 'unreviewed.cjs'), 'console.log("UNREVIEWED_ENTRY_EXECUTED");module.exports = require("./index.cjs");');
  const pkg = JSON.parse(readFileSync(path.join(slot, 'package.json'), 'utf8'));
  pkg.exports['.'].require = './alternate/unreviewed.cjs';
  writeFileSync(path.join(slot, 'package.json'), JSON.stringify(pkg));
  const child = spawnSync(process.execPath, [path.join(dir, 'scripts/install-minimatch-compat.cjs'), '--check'], { encoding: 'utf8' });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Unreviewed minimatch bridge/);
  assert.doesNotMatch(child.stdout, /UNREVIEWED_ENTRY_EXECUTED/);
}));
