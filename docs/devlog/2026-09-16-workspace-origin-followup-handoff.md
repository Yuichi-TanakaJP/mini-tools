# Workspace Core origin follow-up / scoped handoff

Date: 2026-09-16. Scope: [#583](https://github.com/Yuichi-TanakaJP/mini-tools/issues/583) and [#588](https://github.com/Yuichi-TanakaJP/mini-tools/issues/588).

## Result and completion boundary

The additive data follow-up was applied to Workspace Core: 8 knowledge items, 6 evolution events, 8 evidence resources, and 1 historical Product predecessor relation. Existing Functions, Capabilities, Products, and Value Flows were not edited.

**Data applied does not mean the PR is merged or the whole program is complete.** Independent review, repository-wide release checks, and merge remain outstanding. Keep the two Issues open until the delivery gate passes. No application/API/UI behavior was changed or visually tested in this work.

The canonical program is the existing `product-system-inventory-evolution-design-data-strategy` in the original **mini-tools** database's `public.stock_notes_workstreams`. Do not clone it into Workspace Core's `coordination.workstreams`.

The prior continuation summary understated the remaining scope. The program also includes System Map / UIUX work, Market Data Source Catalog, thought/chat capture, and issue inventory. V3 foundation completion is not whole-program completion. [PR #590](https://github.com/Yuichi-TanakaJP/mini-tools/pull/590) remains a separate draft/open issue-inventory handoff as checked on this date; its historical issue counts are not a fresh census. System Context Map #626/#627 is outside this change.

## Data interpretation

- Todo App is a learning vehicle for an end-to-end Web application, not merely a CRUD feature list.
- Repository creation/commit dates and the user's approximate learning chronology are separate evidence types.
- Two reusable-pattern candidates remain `provisional`; a reported preference is not a general tool-performance benchmark.
- AI-learning context is workspace-level: 2 knowledge items and 2 events have no forced Product ownership.
- Event precision is 3 day-level, 1 month-level, and 2 unknown. Unknown dates remain NULL, not invented timestamps.
- Test Antigravity remains `archived` with importance 0. `predecessor_of` points from the experiment to Sensoria Portfolio and is explicitly historical, not a runtime dependency or proof of a code-for-code migration.
- Personal Log records remain the underlying personal evidence. No original log was rewritten.

## Public/private boundary and replay

This repository is public. Therefore the replay **payload is not committed** here. No raw chat, Personal Log row IDs, or private source content is included in the SQL files.

The immutable prepared Update in the canonical private Workstream stores `metadata.replay_manifest`, its `manifest_md5`, the batch key, and the loader revision. This is a bounded operation/audit snapshot of normalized records, not a new source of truth for raw conversations. Source facts remain in their original Personal Log/GitHub records. The private Update tables have owner-scoped RLS; the handoff view uses `security_invoker=true` and has no anon SELECT grant, checked on this date.

Retrieve the input through an authorized connection to the **mini-tools database**, not Workspace Core:

```sql
select u.id, u.metadata->'replay_manifest' as replay_manifest,
       u.metadata->>'manifest_md5' as manifest_md5
from public.stock_notes_workstream_updates u
join public.stock_notes_workstreams w on w.id=u.workstream_id
where w.code='product-system-inventory-evolution-design-data-strategy'
  and u.metadata->>'batch'='origin-followup-583-588-v1'
  and u.metadata->>'stage'='prepared';
```

Require exactly one matching prepared snapshot and verify its JSONB-text checksum. Never print its payload to a public PR, CI log, Issue, or committed fixture. Use a local/authorized private session to bind it into `workspace_core.origin_followup_manifest` with `set_config(..., true)`.

Then, on the **Workspace Core database**:

1. Start an explicit `BEGIN ISOLATION LEVEL REPEATABLE READ` transaction. Use bounded lock/statement timeouts.
2. Bind the private JSON as a value; do not interpolate it as executable SQL. Check its checksum against the private prepared Update.
3. Execute [apply_origin_followup.sql](../../infra/workspace-core/operations/apply_origin_followup.sql).
4. Inspect the result. For a dry run, `ROLLBACK`; for an authorized apply after verification, `COMMIT`.
5. Run [verify_origin_followup.sql](../../infra/workspace-core/operations/verify_origin_followup.sql) and append the actual verification outcome to the existing Workstream.

The operation uses existing schema only. It is deliberately separate from numeric schema/bootstrap SQL: it cannot reconstruct private data from a public checkout alone. The public loader **plus the private immutable snapshot** is the replay unit. Missing input or conflicting existing definitions abort; replay does not silently overwrite newer knowledge.

## Verification performed

| Check | Result |
|---|---|
| Synthetic SQL fixture, two passes, then ROLLBACK | Passed; no fixture rows or relation remained |
| Actual private payload matches prepared snapshot checksum | Passed |
| Actual apply, two passes in one transaction | Passed; complete row fingerprints identical after pass 1 and pass 2 |
| Protected inventory content fingerprints | Unchanged for Products, Functions, Product Capabilities, Flows, Versions, Steps, Edges |
| Scoped records | 8 knowledge / 6 events / 8 resources / 1 predecessor relation |
| Knowledge-to-Product / knowledge-to-evidence links | 8 / 9 |
| Event-to-Product / event-to-evidence / event-to-knowledge links | 6 / 10 / 9 |
| Knowledge or events without evidence | 0 / 0 |
| Incorrect Product ownership for workspace-level knowledge | 0 |
| Provisional patterns / unknown-date events | 2 / 2 |
| Referenced original Personal Log rows | All 4 resolve and are not deleted |
| Archived experiment status and importance | Preserved |

The synthetic rollback test is not presented as a fresh bootstrap or a dry run of all historical seeds. The actual-data two-pass check occurred atomically during the authorized apply. A separate read verified committed counts and semantic classification afterward.

Not performed: clean-database bootstrap of 001-028, full repository lint/test/build, independent Codex/Claude review, browser UAT, or production UI inspection. Do not report these as passed.

## Safety and correction

There is no DDL, privilege change, broad UPDATE, DELETE, or main-branch direct commit in this operation. Before commit, transaction rollback was tested. Post-commit deletion is intentionally not automatic: inspect incoming references before any reviewed corrective change; do not cascade-delete knowledge or rewrite historical evidence merely to restore a count. A superseding/corrective record is preferable when the meaning of a historical statement changes.

## Next gate

Review the public loader, the private evidence mapping through authorized access, the historical-vs-runtime relation meaning, and repository-required checks. Merge only after the gate passes, then close #583/#588 and mark only the origin-follow-up milestone complete. Preserve other in-progress program milestones and their original decisions. No new schema or map rewrite is required for this follow-up.

Decision-log assessment: this implements existing Issues and existing governance/source boundaries; it does not adopt a new product/architecture policy. This dated devlog records the implementation and scope correction; existing versioned decisions remain untouched.
