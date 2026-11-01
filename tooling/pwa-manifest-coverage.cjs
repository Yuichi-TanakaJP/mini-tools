'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const fromEspree = createRequire(require.resolve('espree'));
const { parse } = fromEspree('acorn');
const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  if (entry.name.startsWith('.')) return [];
  const file = path.join(directory, entry.name);
  if (entry.isSymbolicLink()) throw new Error('Unreviewed linked PWA asset');
  return entry.isDirectory() ? files(file) : entry.isFile() ? [file] : [];
});
module.exports = function validateManifest(directory, worker) {
  const manifests = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'precacheAndRoute') manifests.push(node.arguments[0]);
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
  };
  visit(parse(worker.toString(), { ecmaVersion: 'latest' }));
  if (manifests.length !== 1 || manifests[0].type !== 'ArrayExpression') throw new Error('Unreviewed precache manifest shape');
  const urls = manifests[0].elements.map(entry => {
    const value = entry?.properties?.find(property => (property.key.name ?? property.key.value) === 'url')?.value;
    if (value?.type !== 'Literal' || typeof value.value !== 'string' || !value.value.startsWith('/') || value.value.startsWith('//')) throw new Error('Unreviewed precache URL');
    return decodeURIComponent(value.value);
  });
  const inventory = new Set(urls);
  const staticRoot = path.join(directory, '.next/static');
  const staticUrls = files(staticRoot).map(file => '/_next/static/' + path.relative(staticRoot, file).split(path.sep).join('/')).filter(url => ![/\/_next\/static\/.*(?<!\.p)\.woff2/, /\.map$/, /^manifest.*\.js$/].some(exclude => exclude.test(url.slice('/_next/'.length))));
  const publicRoot = path.join(directory, 'public');
  const publicUrls = files(publicRoot).map(file => '/' + path.relative(publicRoot, file).split(path.sep).join('/')).filter(url => !url.startsWith('/noprecache/') && !/^\/(sw\.js(?:\.map)?|(?:workbox|fallback|swe-worker|worker)-.*\.js(?:\.map)?)$/.test(url));
  if (!staticUrls.length || !publicUrls.length) throw new Error('Empty PWA asset coverage');
  const missing = [...staticUrls, ...publicUrls].filter(url => !inventory.has(url));
  if (missing.length) throw new Error('Missing precache assets: ' + missing.join(', '));
  return { urls, staticCount: staticUrls.length, publicCount: publicUrls.length };
};
