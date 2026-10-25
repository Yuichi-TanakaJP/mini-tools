# 2026-10 security dependency update

Production deployment and default-branch merge require explicit approval.

## Acceptance checks

- Use the patched Node.js 22 runtime and install from the committed npm lockfile.
- Run the repository lint, tests (where defined), and production build in an isolated checkout without production environment files or database credentials.
- Start on 127.0.0.1 only and verify the root page returns HTTP 200. This does not validate production data or all browser interactions.
- For ISN, use synthetic local CSV data only: anonymous protected APIs return 401, an ordinary user cannot manage users (403), and an admin reaches the dynamic user handler (404 for a nonexistent synthetic user). Run npm test for async params and authorization regression coverage.
- For MiniTools, verify the production build still emits the PWA service worker. Review remaining next-pwa toolchain advisories separately; do not downgrade next-pwa automatically.
- For Data Gallery, verify the lockfile resolves sharp 0.35.5 and postcss 8.5.23. Do not submit votes to live storage for testing.

## Rollback and release gate

Keep the existing production revision until approval. If deployment is later approved and regression occurs, roll back to the previously deployed artifact/revision; restoring vulnerable dependency versions is an emergency measure and requires renewed security assessment. No database migration or configuration change is part of this patch.

Local checks do not establish Linux/glibc runtime coverage, live database correctness, browser UAT, or production deployment. These must remain explicit release limitations.
