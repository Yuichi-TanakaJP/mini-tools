import { expect, test } from '@playwright/test';

test('ordinary App Router navigation preserves the original registration boundary', async ({ page, context, request, baseURL }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await request.post('/__pwa_test_network/on');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const phase of ['old', 'new']) {
    await request.post(`/__pwa_test_phase/${phase}`);
    expect((await page.goto('/', { waitUntil: 'domcontentloaded' }))?.status()).toBe(200);
    await page.getByRole('button', { name: /^表示テーマ:/ }).click();
    await page.getByRole('group', { name: '表示テーマを選択' }).getByRole('button', { name: 'ダーク', exact: true }).click();
    await expect(page.getByRole('button', { name: '表示テーマ: ダーク', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    expect(await page.evaluate(async () => ({ registrations: (await navigator.serviceWorker.getRegistrations()).length, controlled: Boolean(navigator.serviceWorker.controller), workbox: 'workbox' in window }))).toEqual({ registrations: 0, controlled: false, workbox: false });
  }
});

test('the original generated worker upgrades in place without using sensitive stale caches', async ({ page, context, request, baseURL }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await request.post('/__pwa_test_network/on');
  await request.post('/__pwa_test_phase/old');
  const initial = await (await request.get('/__pwa_test_state')).json();
  expect(initial.oldSha).not.toBe(initial.newSha);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(async () => (await fetch('/api/pwa-synthetic-probe', { headers: { authorization: 'Bearer synthetic-only' } })).json())).toEqual({ source: 'old-network' });
  await page.evaluate(async asset => {
    // Identical application assets are intentional; make one absent to observe new installation.
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const entry of await cache.keys()) if (new URL(entry.url).pathname === asset) await cache.delete(entry);
    }
    for (const name of ['apis', 'others']) {
      const cache = await caches.open(name);
      await cache.put('/api/pwa-synthetic-probe', new Response(JSON.stringify({ source: 'stale-synthetic' }), { headers: { 'content-type': 'application/json' } }));
    }
    const oldController = navigator.serviceWorker.controller;
    const state = window as typeof window & { pwaChanged?: Promise<boolean> };
    state.pwaChanged = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(navigator.serviceWorker.controller !== oldController), { once: true }));
  }, initial.newOnly);
  expect(await page.evaluate(async asset => {
    for (const name of await caches.keys()) for (const entry of await (await caches.open(name)).keys()) if (new URL(entry.url).pathname === asset) return true;
    return false;
  }, initial.newOnly)).toBe(false);
  await request.post('/__pwa_test_phase/new');
  const changed = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    return (window as typeof window & { pwaChanged?: Promise<boolean> }).pwaChanged;
  });
  expect(changed).toBe(true);
  const state = await (await request.get('/__pwa_test_state')).json();
  expect(state.servedWorkers.some((worker: { sha: string }) => worker.sha === state.oldSha)).toBe(true);
  expect(state.servedWorkers.some((worker: { sha: string }) => worker.sha === state.newSha)).toBe(true);
  await expect.poll(() => page.evaluate(async asset => {
    for (const name of await caches.keys()) for (const entry of await (await caches.open(name)).keys()) if (new URL(entry.url).pathname === asset) return true;
    return false;
  }, state.newOnly)).toBe(true);
  expect(await page.evaluate(async () => (await fetch('/api/pwa-synthetic-probe', { headers: { authorization: 'Bearer synthetic-only' } })).json())).toEqual({ source: 'new-network' });
  await page.evaluate(async () => fetch('/api/pwa-synthetic-probe?fresh=1', { headers: { authorization: 'Bearer synthetic-only' } }));
  expect(await page.evaluate(async () => Boolean(await caches.match('/api/pwa-synthetic-probe?fresh=1')))).toBe(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const title = await page.title();
  await request.post('/__pwa_test_network/off');
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(title);
  for (const query of ['utm_source=fixture', 'fbclid=fixture']) {
    expect(await page.evaluate(async ({ asset, query }) => {
      try { const response = await fetch(`${asset}?${query}`, { headers: { authorization: 'Bearer synthetic-only' } }); return { kind: 'response', status: response.status }; }
      catch { return { kind: 'network-failed' }; }
    }, { asset: state.newOnly, query })).toEqual({ kind: 'network-failed' });
  }
  expect(await page.evaluate(async () => {
    try {
      const response = await fetch('/api/pwa-synthetic-probe', { headers: { authorization: 'Bearer synthetic-only' } });
      return { kind: 'response', status: response.status, body: await response.text() };
    } catch { return { kind: 'network-failed' }; }
  })).toEqual({ kind: 'network-failed' });
});
