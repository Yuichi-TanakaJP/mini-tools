# 2026-10-25: PWA build dependency security pins

The security patch keeps next-pwa 5.6.0, its generated /sw.js path, automatic registration, skipWaiting setting and runtime caching rules. Replacing the PWA integration or accepting npm audit's next-pwa 2.0.2 downgrade would unnecessarily change application behavior.

Use the root override serialize-javascript=7.1.3 for both rollup-plugin-terser and terser-webpack-plugin. This crosses their older declared major ranges deliberately: the patched release retains the CommonJS callable API, while requiring Node >=20. The actual consumer resolution paths are covered by serialization regression tests, a production PWA build, and a production-mode browser test for worker activation/offline start-page behavior and NetworkOnly failure for a synthetic authenticated request.

Update flatted, js-yaml, vite and zod within their existing allowed major ranges. Vite 8.3 requires Node ^20.19 or >=22.12; the development runtime is 22.23.4. CI now uses 22.23.4 and npm ci --ignore-scripts so it tests the reviewed lockfile. Trigger, branch, concurrency and required job behavior are unchanged.

Do not remove the serializer override until upstream consumers depend on safe versions and the same consumer-path tests, production build, browser checks and audit pass. npm audit High/Critical=0 is a point-in-time registry result, not proof of absence of vulnerabilities. Moderate/Low findings are tracked separately.

The patch remains on the draft PR. Production deployment and default-branch merge require explicit user approval. Rollback restores a previously deployed artifact in an emergency; restoring vulnerable dependency versions requires renewed security review. No live DB, auth contract, scheduler or production setting is changed.

Known existing integration limitation: next-pwa 5.6.0 injects registration into legacy main.js, while this application uses App Router. The PWA artifact test explicitly registers /sw.js in its disposable browser context and reloads online before testing offline behavior. It does not establish application auto-registration. This patch does not activate previously inactive client caches; repairing App Router auto-registration is a separate change requiring its own cache/privacy assessment.

NetworkOnly regression coverage uses an online synthetic HTTP 200 response, asserts that it is not persisted, seeds stale responses in matching runtime cache names, then blocks network traffic before repeating the authenticated fetch. The test was also checked against a temporary NetworkFirst mutation of the disposable generated worker; the mutation failed the test and the restored worker passed. No production artifact was altered.
