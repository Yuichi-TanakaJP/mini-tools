import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

// Production-mode PWA checks must never load a developer's real env files.
for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  if (fs.existsSync(name)) throw new Error(`Use an isolated checkout without ${name}`);
}
const port = 38220;
const baseURL = `http://127.0.0.1:${port}`;
const childEnv: Record<string, string> = Object.fromEntries(Object.keys(process.env).map(key => [key, '']));
Object.assign(childEnv, { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' });
// Preserve Windows environment key casing so an empty alias cannot mask SystemRoot.
const systemKeys = new Set(['SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'PATH', 'PATHEXT', 'COMSPEC', 'TEMP', 'TMP', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA']);
for (const [key, value] of Object.entries(process.env)) {
  if (systemKeys.has(key.toUpperCase()) && value) childEnv[key] = value;
}
export default defineConfig({
  testDir: './tests/ui-smoke/pwa',
  testIgnore: ['**/migration/**'],
  timeout: 45_000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '.tmp/pwa-test-results',
  use: { baseURL, serviceWorkers: 'allow', trace: 'retain-on-failure' },
  webServer: {
    command: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    env: childEnv,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
