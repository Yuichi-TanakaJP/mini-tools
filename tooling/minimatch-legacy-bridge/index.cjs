'use strict';
const modern = require('minimatch-modern');

// The reviewed v3 consumers normalize Windows separators unless explicitly escaped.
const optionsForLegacy = options => ({
  ...options,
  optimizationLevel: options?.optimizationLevel ?? 0,
  windowsPathsNoEscape: options?.windowsPathsNoEscape ?? (process.platform === 'win32' && options?.allowWindowsEscape !== true),
});
const unsupportedRegExp = () => {
  throw new Error('MINIMATCH_LEGACY_REGEXP_UNSUPPORTED: update the rule to a matcher API before enabling RegExp-based matching');
};
class Minimatch extends modern.Minimatch {
  constructor(pattern, options) {
    // Modern POSIX classes broaden legacy ignores; reject before selecting files.
    if (typeof pattern === 'string' && pattern.includes('[[:')) throw new Error('MINIMATCH_LEGACY_POSIX_UNSUPPORTED: use a reviewed legacy character range');
    super(typeof pattern === 'string' ? pattern.trim() : pattern, optionsForLegacy(options));
  }
  makeRe() { return unsupportedRegExp(); }
}
function minimatch(file, pattern, options) {
  return new Minimatch(pattern, options).match(file);
}
function match(files, pattern, options) {
  const matcher = new Minimatch(pattern, options);
  const matches = files.filter(file => matcher.match(file));
  return matches.length || !options?.nonull ? matches : [pattern];
}
// RegExp compilation would reintroduce unsafe or broadened legacy semantics.
Object.assign(minimatch, { Minimatch, match, filter: (pattern, options) => file => minimatch(file, pattern, options), makeRe: unsupportedRegExp, GLOBSTAR: modern.GLOBSTAR });
module.exports = minimatch;
