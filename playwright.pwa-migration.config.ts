import { defineConfig } from '@playwright/test';
import base from './playwright.pwa.config';
import path from 'node:path';
import fs from 'node:fs';
const baseline = process.env.PWA_BASELINE_DIR;
if (!baseline || !fs.existsSync(path.join(baseline, '.next/BUILD_ID'))) throw new Error('Build an isolated baseline and set PWA_BASELINE_DIR first');
const server = base.webServer as Exclude<typeof base.webServer, undefined | unknown[]>;
const env = { ...server.env, PWA_BASELINE_DIR: path.resolve(baseline) };
export default defineConfig({
  ...base,
  testDir: './tests/ui-smoke/pwa/migration',
  testIgnore: [],
  timeout: 90_000,
  use: { ...base.use, baseURL: 'http://127.0.0.1:38221' },
  webServer: [
    server,
    { command: 'node scripts/run-pwa-baseline-server.mjs', url: 'http://127.0.0.1:38222', reuseExistingServer: false, env, timeout: 60_000 },
    { command: 'node scripts/pwa-migration-proxy.mjs', url: 'http://127.0.0.1:38221/__pwa_test_state', reuseExistingServer: false, env, timeout: 60_000 },
  ],
});
