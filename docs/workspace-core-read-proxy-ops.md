# Workspace Core read proxy operations

## Phase 0.5 live configuration (2026-10-05)

- Vercel project: `mini-tools`
- project id: `prj_tNiBM0pFIRPWIuCnkkmuQP1aCTbm`
- production origin: `https://mini-tools-rho.vercel.app`
- production env configured:
  - `WORKSPACE_CORE_READ_PROXY_TOKEN` (sensitive)

This endpoint remains limited to the existing Workspace Core read API:
- overview
- product
- provider

The token is server-only and does not grant database credentials directly.

This docs-only commit intentionally triggers a Git-connected production deployment so the newly configured environment variable is picked up.
