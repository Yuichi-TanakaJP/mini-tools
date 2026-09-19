# Workspace Core origin follow-up / scoped handoff

Date: 2026-09-16. Scope: [#583](https://github.com/Yuichi-TanakaJP/mini-tools/issues/583), [#588](https://github.com/Yuichi-TanakaJP/mini-tools/issues/588), and their [delivery PR #656](https://github.com/Yuichi-TanakaJP/mini-tools/pull/656).

## Completion boundary

The initial data operation added 8 knowledge items, 6 evolution events, 8 evidence resources and 1 historical predecessor relation to Workspace Core. Existing Products, Functions, Product Capabilities and Value Flows were not rewritten. The review repair changes the replay/checking code, not those historical source records.

The canonical program remains `product-system-inventory-evolution-design-data-strategy` in the **mini-tools database** `public.stock_notes_workstreams`. Do not clone it into Workspace Core's `coordination` schema. Complete only the `product-origin-followup` milestone after the delivery gate; the program also contains map/UIUX, market-data sourcing, thought/chat capture and issue-inventory work. PR #590 and System Context Map #626/#627 are separate. Old issue counts are historical snapshots, not a current census.

Check PR #656 for the latest CI, independent review, merge SHA and completion state. A committed document is not proof that its PR has merged. The independent review of the original head found genuine conflict-validation and dependency-presentation gaps; successful normal-path tests did not cover those cases.

## Interpretation and preservation

Todo App is an end-to-end learning vehicle, not just a CRUD feature list. Repository creation/commit dates and the user's learning chronology are separate evidence types. Two reusable patterns remain provisional; preferences are not objective tool benchmarks. Workspace-wide learning has no forced single-Product owner. Event precision remains 3 day-level, 1 month-level and 2 unknown dates. Test Antigravity stays archived with importance 0. Personal Log remains the source of personal evidence; no original entry is rewritten.

## Review repairs

1. **Semantic equality:** compare actual scalar fields and complete metadata JSONB, not just stored hash markers. Extra metadata keys also require a reviewed reconciliation. Audit instants are not specified by manifest v1: preserve them and check verification presence, without claiming to prove their exact historical value.
2. **Association equality:** compare exact sets of natural targets, roles, source, confidence, notes and verification presence. Include all outgoing links of batch-owned subjects, even if the source marker changed, plus detached batch-tagged links. Wrong-target and extra links cannot pass by retaining the old total count.
3. **Atomic acceptance:** the complete read-only verifier is embedded as a nested block inside the single apply `DO`. Any exception rolls back earlier inserts in that statement. A parity regression keeps both copies identical. Standalone verification still runs before commit and again through a fresh read afterward.
4. **Predecessor evidence:** require a nonblank immutable GitHub blob URL matching exactly one manifest commit/resource path. Missing/null/blank or unrelated URLs fail before insertion. Verify the stored relation notes, confidence and verification state.
5. **Dependency-facing reads:** `lib/workspace-core/data.ts` filters `predecessor_of` from overview and both detail directions. Canonical DB lineage is retained, but is not fed to the existing dependency renderer. This is a small application read-projection change, unlike the initial data-only stage. No new history UI or layout is added. Generic Product `relationCount` still denotes canonical relationships, not runtime dependencies.

The apply operation remains additive: a genuinely missing row/link may be created from the reviewed manifest, but a conflicting existing record is not overwritten. The standalone verifier is read-only and rejects missing entries. If other work legitimately evolves batch-owned metadata/links, stop and review the reconciliation rather than replaying this frozen historical batch blindly.

## Public/private boundary

This repository is public. Never commit private input, Personal Log row IDs, raw chat, credentials, or production payloads to source, fixtures, PRs or CI logs.

An append-only prepared Update in the canonical private Workstream holds `metadata.replay_manifest`, its `manifest_md5`, the batch key and original loader revision. This is a bounded operation/audit snapshot, not another canonical conversation store. The owner-scoped RLS on Updates and `security_invoker=true` handoff view with no anon SELECT were checked during initial implementation. No grants or exposure policies are changed by this PR.

Retrieve through an authorized **mini-tools database** session:

```sql
select u.id, u.metadata->'replay_manifest' as replay_manifest,
       u.metadata->>'manifest_md5' as manifest_md5
from public.stock_notes_workstream_updates u
join public.stock_notes_workstreams w on w.id=u.workstream_id
where w.code='product-system-inventory-evolution-design-data-strategy'
  and u.metadata->>'batch'='origin-followup-583-588-v1'
  and u.metadata->>'stage'='prepared';
```

Require exactly one snapshot. Compare its saved MD5 with `md5(replay_manifest::text)` in PostgreSQL; do not replace the independent expected digest with a newly computed value merely to accept changed input. This checksum detects accidental mismatch, not malicious authenticity. Use the reviewed loader revision, not the original pre-review revision in the prepared audit record.

## Apply/replay or read-only inspection

On **Workspace Core**, not mini-tools:

1. Begin an explicit `REPEATABLE READ` transaction and set bounded lock/statement timeouts.
2. Bind private JSON as a value to `workspace_core.origin_followup_manifest` and the independently retrieved saved digest to `workspace_core.origin_followup_expected_md5`, with `set_config(..., true)`. Do not interpolate untrusted values as executable SQL or expose them in logs.
3. For read-only inspection, execute only [verify_origin_followup.sql](../../infra/workspace-core/operations/verify_origin_followup.sql), then end the read transaction. It now requires the manifest **and** checksum; it is no longer a count-only standalone check without input.
4. For an explicitly authorized replay, execute [apply_origin_followup.sql](../../infra/workspace-core/operations/apply_origin_followup.sql). Full acceptance is already inside its atomic statement. Run the standalone verifier in the same transaction too.
5. Inspect results **before** deciding to `ROLLBACK` (dry run) or `COMMIT` (authorized apply). Never commit an errored transaction or move acceptance to after commit only.
6. After commit, start a new read transaction, bind both inputs again and verify; session-local settings do not survive the previous transaction. Append actual results and loader revision to the existing Workstream.

No persistent functions, schema or migration history are created. Numeric bootstrap SQL 001-028 is not rerun by this repair. Public code plus the private prepared snapshot is the replay unit; a public checkout alone cannot reconstruct private records.

## Tests and evidence

SQL regressions run through `.github/workflows/workspace-origin-sql.yml` against an isolated PostgreSQL 17 service. The Python standard-library runner uses psql and refuses non-loopback hosts or a DB other than `origin_followup_test`. Use a fresh disposable database for each suite; the fixture intentionally creates its own schemas.

```sh
# Set PGHOST=127.0.0.1, PGDATABASE=origin_followup_test and the disposable service credentials.
python3 infra/workspace-core/tests/test_origin_followup.py
npm run test -- lib/workspace-core/__tests__/relation-projection.test.ts
```

The SQL fixture models relevant columns/keys/FK paths; it is **not** a clean replay of every production migration, RLS policy, trigger or extension. It tests first insertion, same-transaction two passes, independent replay preserving timestamps/content, metadata drift with unchanged markers, all association provenance classes, missing/wrong/extra links, predecessor evidence, and rollback of earlier tentative inserts. Rejections must leave full before/after row fingerprints equal. Application tests exercise the actual loaders, not just the filtering helper. See [Product Map UAT](../uat/product-map.md) for browser and data-contract checks.

Initial implementation evidence (historical): synthetic rollback left no fixture rows; applied data passed two normal-path repetitions; protected 7 table contents unchanged; evidence gaps 0; workspace ownership mistakes 0; all 4 Personal Log sources resolved.

Review-stage live inspection: authorized read-only queries compared the private prepared definitions with 9 target record/link groups using natural identities, complete metadata and provenance. All 9 matched after normalizing numeric scale (`1` and `1.000` are semantically equal). The raw-text fingerprint mismatch before scale normalization was a comparison-format issue, not evidence of modified source data. No production data was changed for this review. This is an independent normalized comparison, **not a claim that the revised full SQL file was replayed on production**.

Record actual CI run IDs, test counts and independent reviewer result in the PR after execution. No local clone/build, full 001-028 fresh bootstrap, desktop/smartphone visual UAT or user-PC Git cleanup is implied. Preview Ready is not visual verification.

## Correction and next gate

Before commit use transaction rollback. Post-commit deletion is deliberately not automatic: inspect incoming references and prefer reviewed correction/supersession to cascade deletion or rewritten history. Keep other workstream milestones/decisions intact. After review and relevant checks pass, merge PR #656 and close only #583/#588 plus this scoped milestone. The UI check adds a projection repair and UAT; it does not authorize redesigning System Context Map or changing the original data policy.
