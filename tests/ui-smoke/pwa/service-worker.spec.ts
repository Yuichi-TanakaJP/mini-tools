import { expect, test } from '@playwright/test';

test('generated service worker activates and serves cached start page offline', async ({ page, context, baseURL }) => {
  let networkBlocked = false;
  let syntheticNetworkHits = 0;
  await context.route('**/*', route => {
    if (networkBlocked) return route.abort();
    const url = new URL(route.request().url());
    if (url.origin !== baseURL) return route.abort();
    if (url.pathname === '/api/pwa-synthetic-probe') {
      syntheticNetworkHits++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ source: 'synthetic-network' }) });
    }
    return route.continue();
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // next-pwa injects auto-registration only into the legacy main.js entry.
  // Explicit registration tests the generated artifact without changing app activation.
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (new URL(request.url).pathname === '/') return true;
      }
    }
    return false;
  })).toBe(true);
  const onlineTitle = await page.title();
  expect(onlineTitle.length).toBeGreaterThan(0);
  const onlineProbe = await page.evaluate(async () => {
    const response = await fetch('/api/pwa-synthetic-probe', { headers: { authorization: 'Bearer synthetic-test-only' } });
    return response.json();
  });
  expect(onlineProbe).toEqual({ source: 'synthetic-network' });
  expect(syntheticNetworkHits).toBeGreaterThan(0);
  // A cacheable successful response must still never be stored by NetworkOnly.
  const storedProbes = await page.evaluate(async () => {
    const matches: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) {
        if (new URL(request.url).pathname === '/api/pwa-synthetic-probe') matches.push(name);
      }
    }
    return matches;
  });
  expect(storedProbes).toEqual([]);
  // Exercise a populated stale cache too: NetworkFirst/CacheFirst must not pass.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    for (const name of [`workbox-runtime-${registration.scope}`, 'apis', 'others']) {
      const cache = await caches.open(name);
      await cache.put(new Request(new URL('/api/pwa-synthetic-probe', location.href), {
        headers: { authorization: 'Bearer synthetic-test-only' },
      }), new Response(JSON.stringify({ source: 'synthetic-stale-cache' }), {
        headers: { 'content-type': 'application/json' },
      }));
    }
  });
  networkBlocked = true;
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(onlineTitle);
  await expect(page.locator('body')).not.toBeEmpty();
  const sensitiveResult = await page.evaluate(async () => {
    try {
      await fetch('/api/pwa-synthetic-probe', { headers: { authorization: 'Bearer synthetic-test-only' } });
      return 'unexpected-response';
    } catch { return 'network-failed'; }
  });
  expect(sensitiveResult).toBe('network-failed');
  expect(errors).toEqual([]);
});
