# GitHub Issue Cleanup Mutations — 2026-09-11

## Purpose

This log records the **actual GitHub Issue state mutations** performed after the evidence-only inventory audit.

It is separate from:

- `2026-09-08-github-issue-inventory-audit.md` — initial inventory / candidate classification
- `2026-09-11-github-issue-inventory-audit-delta.md` — current-main revalidation and classification corrections

The safety contract used for every mutation was:

> re-fetch current Issue/comments → inspect current code / live DB / successor state → add evidence comment → change Issue state

No bulk close by age or stale checkbox state was performed.

---

## Completed Issues closed — 14

### pc-saas-health-monitor

1. `#25` — M1 Artifact Registry/GCR capacity visibility
   - Roadmap says resolved
   - Artifact Registry collector and threshold alert path verified
   - retained as Motivation/Evolution evidence

2. `#26` — M2 alert path separated from email
   - Roadmap says resolved
   - threshold/state transition + Windows Toast + dashboard alert screen verified

3. `#27` — M3 market_info asset/freshness visibility
   - market_info heartbeat writer/application verified
   - Health Monitor asset table shows size/count/last update/stale
   - broker sites are not directly monitored by Health Monitor

4. `#159` — Supabase Free backup/recovery Step 1
   - Issue acceptance checklist already fully complete
   - native pg_dump + pg_restore-list verification recorded
   - R2/scheduler/restore drill explicitly remain later scope

### market_info

5. `#422` — Naito institutional margin balance acquisition
   - `credit/jsonp_history.py` implementation verified
   - runner/CLI/daily-operation/docs/tests verified
   - target-universe expansion remains in follow-up #430

### mini-tools

6. `#119` — earnings calendar update operations
   - market_info weekly/monthly scheduled pipeline and docs verified
   - mini-tools now reads market-info API rather than manual file-copy as its primary architecture

7. `#142` — economic indicator calendar
   - real `app/tools/econ-calendar` implementation and loader verified

8. `#190` — unify market tools on `MARKET_INFO_API_BASE_URL`
   - shared API loader and current tool loaders verified

9. `#234` — duplicate market-closed response type definitions
   - common type centralized
   - residual JPX/US naming+loader unification remains #243

10. `#240` — US stock-ranking data-loader tests
    - manifest/day loaders cover missing API, success, 404, timeout and network error

### stock-notes

11. `#77` — `market_cap_profile` portfolio aggregation
    - live current classifications exist
    - portfolio decision context now aggregates/returns market-cap buckets

12. `#86` — Portfolio Policy title/version/status separation
    - live policy model separates fields
    - active policy titles no longer embed version/status
    - MiniTools renders version/status separately

13. `#130` — Portfolio Action API title schema mismatch
    - request model, backend write path and live DB all include `title`
    - Portfolio GPT operation set includes action create/list/update

14. `#165` — Architecture Snapshot v2 / Governance Policy v4
    - live architecture has already evolved to v8 active
    - governance policy has evolved to v5 active
    - older versions preserved as history

All 14 were closed with `state_reason=completed` after an evidence comment.

---

## Promoted Ideas closed — 4

These are not marked as “all future features implemented”. They are closed because **the Idea itself has promoted into a Product / Workstream and should no longer be the progress Source of Truth**.

1. `ideas#4` — English material listening app
   - promoted to `test_english`
   - remaining audio/text sync and publication-scope work stays in Product issues such as `test_english#12`

2. `ideas#15` — investment transaction history as source material
   - SBI transaction data discovered and parsed
   - implementation/analysis work distributed to repositories such as `test_trade#41`
   - Nikko expansion remains separate (`ideas#16` / implementation work)

3. `ideas#31` — automated stock data + AI discussion + thesis persistence
   - decomposed into Stock Notes / MiniTools / Market Info phases
   - current progress lives in implementation Issues and Supabase Workstreams

4. `ideas#34` — AI portfolio / investment platform vision
   - promoted into the current Portfolio / Personal Investment Platform program
   - current progress SoT is Portfolio DB + Stock Notes + MiniTools + Market DB + Workstream Registry

All four were closed only after a promotion/evolution comment that explicitly preserves unfinished downstream scope.

---

## Intentionally left open

### `mini-tools#238`

Earlier audit classification was corrected.

`premium-auth.test.ts` exists, but the original Issue asks for more branch coverage than the current test file provides (malformed token parts, future timestamp, tampered signature, password branches, missing-secret behavior, etc.).

Classification: **partial implementation / keep open**.

### `mini-tools#575` / PR #579

Live Observability schema exists, but Git source-of-truth synchronization is not complete.

More importantly, PR #579 adds `014_observability_schema.sql`, while current main now uses `014–028` for Workspace Core V3.

Classification: **keep open / PR unsafe to merge as-is**.

Required follow-up:

- rebase/recreate on current main
- renumber Observability after current V3 migration sequence
- verify fresh-bootstrap order and live-schema parity
- CI/review before merge

Audit comment has been added directly to PR #579.

---

## Snapshot after cleanup

The initial 20-repository audit snapshot was:

- total Issues: **506**
- open: **178**
- closed: **328**

After this cleanup pass, querying the **same 20 repositories** gives:

- total Issues: **532**
- open: **169**
- closed: **363**

The totals did not change only because of this cleanup: new Issues and other completed work were created/closed during the audit period. Therefore the cleanup effect must be tracked by the explicit mutation list above, not inferred from `178 - 169`.

Same-20-repo check was performed in four repository groups and sums to the same result as the current `user:Yuichi-TanakaJP is:issue` search, so no Issue-bearing repository is outside the original audit population at this snapshot.

---

## Next pass

Do **not** continue with broad auto-close.

Next work is Group C reframe/cross-link:

- `stock-notes#1`
- `stock-notes#66`
- `stock-notes#69`
- `stock-notes#127`
- `stock-notes#133`
- `mini-tools#164`
- `mini-tools#396`
- `mini-tools#447`
- `mini-tools#463`
- `mini-tools#464`
- `mini-tools#465`

For these, first clarify the **remaining unique scope** versus the current successor Workstream/Product. Prefer updating/cross-linking over closing when meaningful unfinished scope remains.
