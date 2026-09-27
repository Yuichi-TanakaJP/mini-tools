# Workspace Core Coordination Reconciliation Manifest

Captured: 2026-09-28 JST  
Workspace Core project ref: `vtqceobocbetkkatycxw`

## Purpose

This manifest records why `031_coordination_current_state_reconciliation.sql`
exists and which live-only schema changes it reconciles into the existing
`infra/workspace-core/sql` lineage.

`031` is a **current-state reconciliation**, not a verbatim reconstruction of
historical migration bodies.

## Existing canonical lineage

The repository already contains the Workspace Core bootstrap/schema lineage
through:

- `001_registry_schema.sql`
- ...
- `029_product_evolution_evidence_reader.sql`
- `030_observability_v2_context.sql`

That lineage remains authoritative. No competing baseline/migrations tree is
introduced.

## Live migration history reconciled by 031

| Supabase migration version | Live migration name | Reconciled object scope |
|---|---|---|
| 20260906130144 | coordination_workstreams_v0_1 | coordination schema, Workstream tables, overview |
| 20260927065632 | workspace_core_workstream_resume_read_model_v1 | public workstream resume view |
| 20260927124439 | chat_orchestration_v0_2_checkpoints | chat checkpoint table + orchestration view |
| 20260927141823 | chat_orchestration_v0_2_attention_class_fix | final orchestration attention precedence |
| 20260927171822 | architecture_alignment_review_v0_read_model | architecture alignment read view |

## 031 repository identity

Path:

`infra/workspace-core/sql/031_coordination_current_state_reconciliation.sql`

Git blob SHA at first reconciliation commit:

`8f5438de7564f6525126bf9cf5be7bf536218701`

The Git blob SHA is recorded for provenance. A content SHA-256 may be added by
the replay environment if/when the file is materialized there; it is not used as
a database identity.

## Live structural verification

Verification query:

`operations/verify_coordination_reconciliation.sql`

Read-only verification was executed against the live Workspace Core project
after creating the repository file.

Observed result:

`coordination-reconciliation-ok | workstream_columns=23 | checkpoint_columns=20`

The verification checks:

- required tables/views exist
- RLS is enabled on Coordination base tables
- public read views and workstream_overview are SECURITY INVOKER
- browser/public roles cannot use/read Coordination
- service_role can use/read the required objects
- constraint set matches the captured current state
- secondary index set matches
- platform.touch_updated_at() dependency and Workstream trigger exist
- Coordination currently has no RLS policies
- chat_checkpoints keeps the narrower service_role CRUD grant and no TRUNCATE

## Executable/security dependency coverage

A full replay must preserve not only tables/views but the executable and
privilege objects already carried by earlier SQL files, including:

- `platform.touch_updated_at()` and dependent triggers
- Observability guard functions/triggers
- `observability_writer` and its memberships
- `product_evolution_evidence_reader` and its memberships/policies
- schema/table/view grants and revokes
- default privileges where defined by prior SQL
- required extensions

`031` does not duplicate those earlier definitions; it depends on the ordered
001-030 bootstrap.

## Replay status

- Live definition verification: **PASS**
- Full 001-031 clean PostgreSQL replay in this ChatGPT runtime: **NOT RUN**
- Reason: no local `psql`, `postgres`, `initdb`, Docker, or Podman is available
  in the current execution environment.
- Paid Supabase branch: **NOT CREATED** (would require cost check and user approval)

A guarded integration test is included in
`tests/test_coordination_reconciliation.py`. It requires:

- PostgreSQL 17+
- loopback `PGHOST`
- `PGDATABASE=workspace_core_replay_test`
- `WORKSPACE_CORE_TEST_DISPOSABLE_CLUSTER=1`

Future Workspace Core schema/read-model changes remain blocked until that clean
replay (or an equivalent staging replay) succeeds.

## Non-goals

- no production DDL in this reconciliation PR
- no data backfill
- no Resume V1.1 selection behavior change
- no Work Unit schema
- no local/external reference contract migration
- no Evolution Event identity migration
