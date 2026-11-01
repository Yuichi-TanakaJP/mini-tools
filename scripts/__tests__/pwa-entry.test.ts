import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const rootRequire = createRequire(import.meta.url);
const preserve = rootRequire('../../tooling/preserve-pwa-entry.cjs');
describe('PWA registration entry boundary', () => {
  it('does not wrap the disabled development PWA configuration', () => {
    const output = execFileSync(process.execPath, ['-e', `process.env.NODE_ENV='development'; const config=require('./next.config.js'); console.log(config.webpack.toString().includes('preserveAppRouterEntry'));`], { encoding: 'utf8' });
    expect(output.trim()).toBe('false');
  });
  it('retains Pages registration and the App Router application but removes the new fork entry', async () => {
    const pwa = '/synthetic/sw-entry.js';
    const config = preserve({ entry: async () => ({ 'main-app': [pwa, '/app-client.js'], 'main.js': [pwa, '/pages-client.js'] }) }, pwa);
    expect(await config.entry()).toEqual({ 'main-app': ['/app-client.js'], 'main.js': [pwa, '/pages-client.js'] });
  });
  it('rejects an unknown main-app entry shape', async () => {
    await expect(preserve({ entry: { 'main-app': '/app-client.js' } }, '/sw-entry.js').entry()).rejects.toThrow('Unreviewed PWA');
  });
  it('never removes the only application entry', async () => {
    await expect(preserve({ entry: { 'main-app': ['/sw-entry.js'] } }, '/sw-entry.js').entry()).rejects.toThrow('remove the application entry');
  });
});
