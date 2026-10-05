# Workspace Core read proxy operations

## Phase 0.5 live configuration (2026-10-05)

- Vercel project: `mini-tools`
- project id: `prj_tNiBM0pFIRPWIuCnkkmuQP1aCTbm`
- production origin: `https://mini-tools-rho.vercel.app`
- production env configured:
  - `WORKSPACE_CORE_READ_PROXY_TOKEN` (sensitive)

The endpoint is limited to these fixed Workspace Core read modes:
- `overview` — Product / Repository / Technology / Provider / Service overview
- `product` — one validated Product slug
- `provider` — one validated Provider slug
- `control-center` — bounded Workstream / Remote Observability / confirmed Evolution / Architecture summary

`control-center` reads only reviewed fixed public projections. It does not accept a table, schema, column, SQL fragment, or arbitrary query input. Raw Observability `message` is intentionally excluded.

The token is server-only and does not grant database credentials directly. It only authorizes this fixed GET API capability.

This docs-only commit intentionally triggers a Git-connected production deployment so the newly configured environment variable is picked up.


## Control Center V1 contract (2026-10-05)

Fixed projections:
- `workspace_core_workstream_resume_v`
- `workspace_core_observability_current_v`
- `workspace_core_observability_event_v`
- `workspace_core_evolution_summary_v`
- `workspace_core_architecture_counts_v`

Operational rules:
- Current State attention is bounded to 20 after severity ordering.
- Status Events are bounded to 12 newest events.
- Workstream counts use all active/blocked/paused rows; only the rendered item list is bounded.
- Confirmed Evolution Events are paginated through the full fixed projection before semantic-date ranking and the final 8-item cap.
- Architecture counts are registry-wide and do not depend on Product↔Repository links.
- `observed_at` and `mirrored_at` are separate; source-level mirror watermarks are preserved.
