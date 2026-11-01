'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const recipes = require('../tooling/minimatch-patches.json');
const bridgeDigests = require('../tooling/minimatch-bridge-hashes.json');
const checkOnly = process.argv.includes('--check');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const matcherImport = /(require\(['"]|from ['"])minimatch(['"]\)?)/g;
const parents = [...new Set(recipes.map(recipe => recipe.package))];
const present = parents.filter(name => fs.existsSync(path.join(root, 'node_modules', name, 'package.json')));
if (present.length === 0 && !checkOnly) {
  console.log('Minimatch compatibility: lint dependencies omitted');
} else {
  if (present.length !== parents.length) throw new Error('Incomplete reviewed lint dependency graph');
  const installRoot = path.join(root, 'node_modules');
  const resolvedModules = fs.realpathSync(installRoot);
  if (fs.lstatSync(installRoot).isSymbolicLink() || path.relative(path.join(fs.realpathSync(root), 'node_modules'), resolvedModules) !== '') throw new Error('Redirected node_modules root');
  const modules = resolvedModules + path.sep;
  // Reject partial or substituted bridges before touching any parent source.
  const rootRequire = createRequire(path.join(root, 'package.json'));
  const bridge = rootRequire.resolve('@local/minimatch-legacy-bridge');
  const bridgeDirectory = path.dirname(bridge);
  for (const name of ['package.json', 'index.cjs', 'index.mjs']) {
    // Git checkouts differ in line endings; pin the reviewed text independently.
    const canonical = fs.readFileSync(path.join(bridgeDirectory, name), 'utf8').replace(/\r\n/g, '\n');
    if (digest(canonical) !== bridgeDigests[name]) throw new Error('Unreviewed minimatch bridge');
  }
  for (const parent of parents) {
    const fromParent = createRequire(path.join(root, 'node_modules', parent, 'package.json'));
    if (fs.realpathSync(fromParent.resolve('@local/minimatch-legacy-bridge')) !== fs.realpathSync(bridge)) throw new Error('Unexpected parent bridge resolution');
  }
  const fromBridge = createRequire(bridge);
  const backend = fromBridge('minimatch-modern/package.json');
  if (backend.name !== 'minimatch' || backend.version !== '11.0.3' || !fs.realpathSync(fromBridge.resolve('minimatch-modern')).startsWith(modules)) throw new Error('Unexpected minimatch backend');
  const loaded = rootRequire('@local/minimatch-legacy-bridge');
  if (typeof loaded !== 'function' || typeof loaded.Minimatch !== 'function') throw new Error('Invalid minimatch bridge exports');
  // Validate every original before changing any dependency source.
  const changes = recipes.map(recipe => {
    const file = path.join(root, recipe.file);
    if (!fs.realpathSync(file).startsWith(modules)) throw new Error('Dependency path escaped node_modules');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', recipe.package, 'package.json'), 'utf8'));
    if (pkg.version !== recipe.version) throw new Error(`Unreviewed parent version: ${recipe.package}`);
    if (fs.statSync(file).nlink !== 1) throw new Error(`Shared dependency source: ${recipe.file}`);
    const data = fs.readFileSync(file);
    if (digest(data) === recipe.afterSha256) return null;
    if (checkOnly || digest(data) !== recipe.beforeSha256) throw new Error(`Unreviewed dependency source: ${recipe.file}`);
    const patched = data.toString('utf8').replace(matcherImport, '$1@local/minimatch-legacy-bridge$2');
    if (digest(patched) !== recipe.afterSha256) throw new Error(`Unexpected compatibility patch: ${recipe.file}`);
    return { file, patched };
  });
  for (const change of changes) if (change) fs.writeFileSync(change.file, change.patched);
  console.log('Reviewed minimatch compatibility sources: PASS');
}
