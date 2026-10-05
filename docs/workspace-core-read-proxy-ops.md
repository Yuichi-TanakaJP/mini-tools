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

The earlier Phase 0.5 docs-only commit triggered a Git-connected production deployment so the configured environment variable was picked up. This paragraph is historical, not a claim that the Control Center rollout is complete.

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
- Workstream counts use all active/blocked/paused rows; only the rendered item list is bounded to 12.
- Confirmed Evolution Events are paginated through the full fixed projection before semantic-date ranking and the final 8-item cap.
- Architecture counts are registry-wide and do not depend on Product↔Repository links.
- `observed_at` and `mirrored_at` are separate; source-level mirror watermarks are preserved.

## Review decision: complete fixed reads before display caps

Background: PR #693 review found that an unpaged select can undercount Workstreams and Current States, and that ranging Evolution without ordering does not define stable pages. This is a correction to the existing contract, not a new schema or permission design; the rationale is kept here with that contract rather than in another parallel specification.

All three collections now use fixed selected columns, exact count, and ascending stable order before range: Evolution by `event_id`, Workstream by `workstream_code`, Current State by `source_key, subject_key (nulls first), metric_key`. Workstream retains its fixed active/blocked/paused filter. No request parameter selects a relation, column, ordering, or SQL fragment.

Requests ask for up to 1000 rows and advance by the number actually returned, so a lower server cap is not mistaken for completion. Missing exact count, count drift, incomplete pages, inconsistent sizes, or page errors fail the entire read rather than reporting a partial success. The API still returns its generic failure response. Separate page requests are not an atomic DB snapshot; same-count changes during a read are not fully detected. Transactionally consistent snapshots would require a separate reviewed DB contract and are not claimed here.

The existing response shape and bounded display lists are unchanged. There is no DB migration, new credential, new public access, or Workstream mutation in this repair.

## Acceptance and evidence

Use the permanent [Control Center UAT procedure](./uat/workspace-control-center.md), also linked from the [UAT index](./uat/index.md). This endpoint uses `private, no-store`, not the common 300-second cache note in that index. Record actual test/UAT results and remaining gates in the PR body, not as checked items in the procedure.
