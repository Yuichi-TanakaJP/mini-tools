import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const rootRequire = createRequire(import.meta.url);
// Exercise the module resolved by each real PWA minifier, not just a root alias.
for (const consumer of ['rollup-plugin-terser', 'terser-webpack-plugin']) {
  const consumerRequire = createRequire(rootRequire.resolve(consumer));
  const serialize = consumerRequire('serialize-javascript');
  describe(`${consumer} serializer compatibility`, () => {
    it('round-trips worker options, functions and regular expressions', () => {
      const options = {
        matcher: function (request: { method: string }) { return request.method === 'GET'; },
        pattern: /^\/api\//i,
        compress: { passes: 2 },
      };
      const restored = vm.runInNewContext(`(${serialize(options)})`);
      expect(restored.matcher({ method: 'GET' })).toBe(true);
      expect(restored.matcher({ method: 'POST' })).toBe(false);
      expect(restored.pattern.test('/API/probe')).toBe(true);
      expect(restored.compress.passes).toBe(2);
    });
    it('escapes an HTML script terminator at the end of a function', () => {
      const fn = function () {};
      fn.toString = () => 'function () {} //</script';
      expect(serialize({ fn }, { space: 2 }).toLowerCase()).not.toContain('</script');
    });
    it('does not mutate build options when omitting functions', () => {
      const fn = () => true;
      const options = { fn, values: [fn] };
      const restored = JSON.parse(serialize(options, { ignoreFunction: true }));
      expect(options.fn).toBe(fn);
      expect(options.values[0]).toBe(fn);
      expect(restored.values).toEqual([null]);
    });
  });
}
