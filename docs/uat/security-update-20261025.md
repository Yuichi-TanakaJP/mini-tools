# 2026-10 security dependency update

Production deployment and default-branch merge require explicit approval.

## Acceptance checks

- Use the patched Node.js 22 runtime and install from the committed npm lockfile.
- Run the repository lint, tests (where defined), and production build in an isolated checkout without production environment files or database credentials.
- Start on 127.0.0.1 only and verify the root page returns HTTP 200. This does not validate production data or all browser interactions.
- For ISN, use synthetic local CSV data only: anonymous protected APIs return 401, an ordinary user cannot manage users (403), and an admin reaches the dynamic user handler (404 for a nonexistent synthetic user). Run npm test for async params and authorization regression coverage.
- For MiniTools, verify the production build still emits the PWA service worker. Run npm run test:pwa after npm run build in an isolated checkout without environment files. It checks worker activation, offline cached start-page loading, and failure of a synthetic authenticated API fetch while offline. Run npm test for the actual consumer-path serializer regression cases. Do not downgrade next-pwa automatically.
- For Data Gallery, verify the lockfile resolves sharp 0.35.5 and postcss 8.5.23. Do not submit votes to live storage for testing.

## Rollback and release gate

Keep the existing production revision until approval. If deployment is later approved and regression occurs, roll back to the previously deployed artifact/revision; restoring vulnerable dependency versions is an emergency measure and requires renewed security assessment. No database migration or configuration change is part of this patch.

Local checks do not establish Linux/glibc runtime coverage, live database correctness, browser UAT, or production deployment. These must remain explicit release limitations.

The follow-up security dependency policy is recorded in docs/decision-log/2026-10-25-pwa-security-pins.md. Browser cache tests do not cover all installed mobile clients or every historical service-worker upgrade path.

Known existing integration limitation: next-pwa 5.6.0 injects registration into legacy main.js, while this application uses App Router. The PWA artifact test explicitly registers /sw.js in its disposable browser context and reloads online before testing offline behavior. It does not establish application auto-registration. This patch does not activate previously inactive client caches; repairing App Router auto-registration is a separate change requiring its own cache/privacy assessment.

NetworkOnly regression coverage uses an online synthetic HTTP 200 response, asserts that it is not persisted, seeds stale responses in matching runtime cache names, then blocks network traffic before repeating the authenticated fetch. The test was also checked against a temporary NetworkFirst mutation of the disposable generated worker; the mutation failed the test and the restored worker passed. No production artifact was altered.

Follow-up dependency cleanup uses Vitest/coverage/mocker 4.1.12, Babel 7.29.7, humanfs 0.16.8 and patched Ajv versions; all npm audit severities must be zero. The manual-production-release decision log defines the main-branch deployment guard and before/after production readback required for a merge without publication.
