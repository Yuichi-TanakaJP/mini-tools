'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const recipes = require('../tooling/minimatch-patches.json');
const checkOnly = process.argv.includes('--check');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const matcherImport = /(require\(['"]|from ['"])minimatch(['"]\)?)/g;
const parents = [...new Set(recipes.map(recipe => recipe.package))];
const present = parents.filter(name => fs.existsSync(path.join(root, 'node_modules', name, 'package.json')));
if (present.length === 0 && !checkOnly) {
  console.log('Minimatch compatibility: lint dependencies omitted');
} else {
  if (present.length !== parents.length) throw new Error('Incomplete reviewed lint dependency graph');
  const modules = fs.realpathSync(path.join(root, 'node_modules')) + path.sep;
  // Validate every original before changing any dependency source.
  const changes = recipes.map(recipe => {
    const file = path.join(root, recipe.file);
    if (!fs.realpathSync(file).startsWith(modules)) throw new Error('Dependency path escaped node_modules');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', recipe.package, 'package.json'), 'utf8'));
    if (pkg.version !== recipe.version) throw new Error(`Unreviewed parent version: ${recipe.package}`);
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
