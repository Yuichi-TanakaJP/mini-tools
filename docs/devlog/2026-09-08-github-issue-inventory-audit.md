# GitHub Issue Inventory Audit — 2026-09-08

## Purpose

This document is a **handoff for a later Codex cleanup pass** across Yuichi-TanakaJP repositories.

The goal is not to maximize the number of closed Issues. The goal is to make GitHub Issue state match the current implementation / Workstream state without losing historical context.

This audit was performed by comparing open Issues against, where available:

- current repository code and docs
- later Issues / successor Issues
- merged or open PRs
- live Supabase schema / data
- Workspace Core / Stock Notes Workstream state

The initial cross-repository inventory found roughly 500 historical Issues and about 180 open Issues. The five largest active repositories (`mini-tools`, `market_info`, `pc-saas-health-monitor`, `stock-notes`, `ideas`) contained the large majority of the open backlog. Counts are a snapshot and may change while this audit is in progress; **Codex must re-count immediately before mutation**.

## Safety contract for Codex

Do **not** close an Issue only because it is old, has an implemented-looking title, or has a successor.

Before every close:

1. Re-fetch the Issue body and comments.
2. Check current `main`, not only an old Roadmap / comment.
3. Check linked PR state and merge state.
4. Verify the original acceptance criteria or establish that the scope was explicitly promoted / superseded.
5. If a test or cheap read-only verification exists, run it.
6. Add a final comment explaining why the Issue is being closed and link the implementation / successor.
7. Only then change the Issue state.

If evidence is ambiguous, leave the Issue open and report the ambiguity.

Never modify Stock Master data as part of this cleanup.

## Classification

| Class | Meaning | Default action |
|---|---|---|
| `close_candidate_high` | Original scope is strongly evidenced as complete | Re-verify current state, comment, close as `completed` |
| `verify_then_close` | Most of the scope appears complete but one contract / PR / UI detail still needs checking | Verify missing point first |
| `promoted_or_absorbed` | The Idea/Epic has become a Product, Workstream, or successor Issue and should no longer be progress SoT | Add successor links; close only if history remains traceable |
| `keep_open_active` | Current implementation / research work is still active | Keep open |
| `keep_open_ongoing` | Deliberately recurring operational tracker | Keep open |
| `partially_implemented` | Some acceptance criteria are implemented but meaningful scope remains | Keep open or narrow after review |
| `needs_revalidation` | Could be stale, but current evidence is insufficient | Re-investigate; do not auto-close |

---

# 1. High-confidence close candidates

## pc-saas-health-monitor

### #25 — M1 / GCR capacity original problem

**Classification:** `close_candidate_high`

Audit evidence:

- Health Monitor Roadmap records the original M1 problem as resolved.
- Artifact Registry usage collection / threshold evaluation was implemented in the later Health Monitor system.
- The current Product now exposes the relevant health state rather than relying on the original ad-hoc check.

**Codex action:** verify current main still contains the Artifact Registry collector / threshold path, then close the original M1 Epic as completed. Link the implemented collector / child Issues in the close comment.

### #26 — M2 / important alerts buried in email

**Classification:** `close_candidate_high`

Audit evidence:

- Roadmap marks the original problem resolved.
- Windows toast / threshold-based alerting and dashboard alert presentation were implemented.

**Codex action:** verify the current alert path and close the original problem Epic as completed.

### #27 — M3 / market_info asset freshness / state visibility

**Classification:** `close_candidate_high`

Audit evidence:

- An older Roadmap said “mechanism complete / application pending”, but current code has moved beyond that state.
- `market_info` has heartbeat / state publication support.
- Health Monitor contains an `AssetsSection` / asset-state UI that handles size, count, last update and stale evaluation.

**Important:** use current code, not the old Roadmap sentence, as final evidence.

**Codex action:** verify the `market_info` heartbeat producer and Health Monitor consumer on current main; if intact, close as completed.

### #159 — Backup / Recovery Step 1

**Classification:** `close_candidate_high`

Audit evidence:

- The Issue’s own acceptance criteria were checked complete during the audit.
- A successful manual backup and `pg_restore --list` style verification were recorded.
- Later restore drill / R2 / scheduling work was explicitly outside this Issue’s immediate scope.

**Codex action:** re-read the Issue comments and close only the Step 1 scope, without implying that all future DR automation is complete.

---

## market_info

### #422 — 内藤証券から制度信用残データを取得する

**Classification:** `close_candidate_high`

Audit evidence:

- Later Issue #430 explicitly assumes that `credit --credit-mode jsonp_history` can obtain per-stock credit balance detail and weekly history.
- That means the core acquisition capability requested by #422 has been implemented; #430 is a follow-up for target/operation refinement rather than evidence that acquisition is missing.

**Codex action:** inspect the current CLI / tests for `jsonp_history`, add a closing comment linking #430 and the implementation, then close #422 as completed.

---

## mini-tools

### #142 — 経済指標カレンダーを追加する

**Classification:** `close_candidate_high`

Audit evidence:

Current main contains a real `/tools/econ-calendar` route. `app/tools/econ-calendar/page.tsx` loads `loadEconCalendarPageData()` and describes previous / forecast / result display and importance filtering. The implementation has exceeded the original Issue’s “minimum scope / data fields / UI direction” planning goal.

**Codex action:** verify the current route builds and the relevant UAT/docs exist; close #142 as completed.

### #234 — `JpxMarketClosedResponse` の重複定義を `_shared` に集約する

**Classification:** `close_candidate_high`

Audit evidence:

Current `app/tools/earnings-calendar/data-loader.ts` imports `JpxMarketClosedResponse` from:

`@/app/tools/_shared/market-calendar-types`

This directly matches the centralization requested by #234.

**Codex action:** search all four original locations for duplicate declarations. If no independent duplicate remains, close #234 as completed.

---

# 2. Verify, then close candidates

## mini-tools

### #190 — market toolsの取得入口を `MARKET_INFO_API_BASE_URL` に統一

**Classification:** `verify_then_close`

Evidence:

- Current decision docs say `MARKET_INFO_API_BASE_URL` is the standard data entrance.
- Current loaders for market tools use the shared market API path.
- Production fallback behavior is already intentionally restricted.

Remaining verification:

- Search for active runtime dependencies on `STOCK_RANKING_DATA_BASE_URL`, `NIKKEI_CONTRIBUTION_DATA_BASE_URL`, `MONTHLY_YUTAI_DATA_BASE_URL`.
- Confirm docs/env examples match current code.

If those legacy runtime dependencies are gone, close #190.

### #164 — R2/S3 direct fetch → market-info-api / BFF design

**Classification:** `verify_then_close`

Evidence:

- The repository has substantially moved to `MARKET_INFO_API_BASE_URL`.
- Later API-unification decisions supersede much of the original “direct fetch” architecture.

Why not auto-close:

The Issue also mentioned generated TypeScript/OpenAPI types, Route Handler/BFF design, cache strategy, and fallback migration. The acquisition-path migration may be complete while some design sub-items were intentionally replaced rather than implemented literally.

**Codex action:** compare #164 acceptance criteria against current architecture. If the original design has been superseded by a documented better architecture, close with a comment explaining the replacement rather than claiming every checkbox was implemented verbatim.

### #575 — Workspace Core Observability V1.1

**Classification:** `verify_then_close`, **blocked by PR #579**

Live DB contract is implemented and tested, but as of this audit **PR #579 is still open and unmerged**. PR #579 explicitly says `Closes #575` and exists to bring the already-live Observability schema/contract back into Git as reproducible source.

**Codex action:** do not close #575 before #579 is reviewed and merged. After merge, confirm repository migration numbering/bootstrap consistency and then let the PR close #575 or close it with evidence.

---

## stock-notes

### #86 — Portfolio Policy title / version / status separation

**Classification:** `verify_then_close`

Evidence:

- Live DB now has an active policy v7 whose title is simply `投資方針`, with status and revision stored structurally.
- MiniTools Portfolio UI reads `versionNumber` and `status` separately and displays policy history based on structured fields.

Remaining verification:

- Confirm Stock Notes create/update API and current AI instructions no longer infer status from title text.
- Confirm docs/OpenAPI reflect this contract.

If yes, close #86.

### #165 — Architecture Snapshot v2 / Governance Policy v4

**Classification:** `verify_then_close` / `superseded-by-later-architecture`

Evidence:

- The Issue was written when Architecture Snapshot v1 was active and proposed v2.
- Later `stock-notes#181` states that **Architecture Snapshot v7 is active** and includes Workstream Registry / Index Intelligence.

This strongly suggests #165’s intended architecture refresh happened and was subsequently evolved several more versions.

**Codex action:** inspect Architecture history/decisions and #165 comments. If the Market / Company Exposure / Company Facts responsibility rules are present in a later active snapshot/policy, close #165 as completed/superseded with a link to the current version. Do not rewrite history.

### #130 — Portfolio Action OpenAPI/backend `title` mismatch

**Classification:** `needs_revalidation`, potentially small close candidate

Evidence:

- Live DB now has `stock_notes_portfolio_actions.title` as a non-null text field.
- This alone does **not** prove the public OpenAPI/client contract is fixed.

**Codex action:** inspect current Pydantic/request schema and `/openapi.json`, then execute a minimal action-create test. Close only if GPT/client can actually send `title` and round-trip it.

---

# 3. Promoted / absorbed Issues — do not treat as unfinished implementation

## ideas

### #4 — 紙の英語教材をスマホに取り込み、音声と同期して学ぶ

**Classification:** `promoted_or_absorbed`

This idea became the `test-english` Product. Workspace Core inventory now records the real flow:

`教材ページ撮影 → Gemini OCR → OCR JSON → vocabulary normalization → lesson combine → book structure → JSON → HTML/PWA build → Cloudflare Pages`

PWA/mobile installation and player functionality were verified; copyrighted source material is intentionally excluded from git.

**Codex action:** verify `test-english` repo and add a successor link. Close the Ideas Issue as promoted/completed at the Idea level; do not imply every ambitious feature in the original brainstorm is implemented.

### #15 — 投資の取引履歴を素材データとして追加する

**Classification:** `promoted_or_absorbed`

The audit found that transaction-history work moved into implementation/research repositories and parsers, rather than remaining an Ideas-only task.

**Codex action:** identify the authoritative current implementation Issues (`test_trade` / related data pipeline), link them, and close #15 as promoted if the source-data ingestion objective is represented there. Keep child #16 open if SMBC日興 integration remains unfinished.

### #31 — 株式データ収集 + AI議論 + 投資仮説保存の統合

**Classification:** `promoted_or_absorbed`

This is no longer an isolated idea. It became the foundation for the current Stock Notes / Market Info / MiniTools investment-analysis system and was decomposed into implementation work across repositories (Stock Notes API/DB, MiniTools UI, Market Info data acquisition).

The current system already has Stock Notes analysis/judgment/history tables, Portfolio DB, Market DB, MiniTools read models, and multiple successor Workstreams.

**Codex action:** add the key successor links and close the Ideas Issue as “promoted to implementation/workstream”, not as “every long-term feature complete”.

### #34 — AIとポートフォリオ全体を相談できる投資プラットフォーム

**Classification:** `promoted_or_absorbed`

This idea is now essentially a **Program / Workstream**, not an unstarted idea. It is represented by the Personal Investment Platform direction and multiple active implementation Issues such as MiniTools Portfolio / Stock Notes / Performance / Income / Exposure work.

**Codex action:** if the current Workstream is clearly linked, close #34 as promoted-to-workstream and make the Workstream/current Epic the progress SoT. Do not close the active child implementation Issues.

### #10 / #37 — personal context / voice context capture

**Classification:** `promoted_or_absorbed`, but **do not auto-close yet**

These Ideas now overlap strongly with the live Personal Log / Context Threads / Chat Checkpoint work and the new Voice/Text Thought Capture direction. However, the newly proposed continuous transcription mobile app is not yet a Product, and Chat export backfill is not yet generalized.

**Codex action:** first map the Ideas to the current Personal Log / Workspace Core Workstream. Close only if there is a clearly named successor Workstream that retains the unresolved capture/backfill scope.

---

## stock-notes

### #133 — Dividend Dashboard / Dividend Growth Analytics

**Classification:** `promoted_or_absorbed`

A large part of the data foundation now exists in the live DB:

- DPS facts / company forecast
- cost basis on portfolio positions
- `stock_notes_portfolio_current_dividend_projection_v`

The active MiniTools implementation Issue **#584** now owns Portfolio Income UI/run-rate/history/attribution work.

**Codex action:** compare #133 requirements with #584. Prefer making #584 the UI implementation SoT and closing #133 as promoted if no unique backend contract remains orphaned. If unique Stock Notes API requirements remain, narrow #133 instead of closing.

### #127 — Cost Basis / Yield on Cost / Dividend History

**Classification:** `partially_implemented` / `promoted_or_absorbed`

Evidence:

- live `portfolio_positions` has `cost_basis`
- company DPS facts and current dividend projection exist
- #584 owns the current Portfolio Income UI/analytics implementation

But #127 also contains historical/dividend-detail and API requirements that may not all be finished.

**Codex action:** do not auto-close. Split remaining unique backend requirements or explicitly absorb them into #584/Financial DB work before closing.

### #66 / #69 — External holdings / combined portfolio context

**Classification:** `partially_implemented` / likely superseded by #87 + #124

Live DB now contains a much richer Account / Instrument / Position / external-reference model, and later Issues #87 and #124 describe the more mature architecture.

**Codex action:** compare #66/#69 acceptance criteria against the live DB/API and #87/#124. If the old Issues have no unique remaining scope, close as superseded/promoted with successor links. Do not delete the historical reasoning.

### #77 — `market_cap_profile`

**Classification:** `partially_implemented`

Evidence:

- live `stock_notes_instrument_classifications.market_cap_profile` exists
- MiniTools #586 explicitly includes `market_cap_profile` as a planned allocation lens

Missing proof:

- the original Stock Notes decision-context aggregation requirement has not yet been proven complete.

**Codex action:** keep open unless the current read model/API already returns the requested aggregate, or explicitly move that scope into #586.

---

# 4. Explicit keep-open examples

These are examples where “cleanup” must **not** close active work.

## market_info

- **#283** — explicitly a continuing/operational tracker → `keep_open_ongoing`
- **#500** and **#509–#512 / #515** — current Market DB / Index / ingestion / source work → `keep_open_active`
- **#507** — Data Source Catalog; Draft PR #508 / Schema 0.2 validation is ongoing → `keep_open_active`
- **#498** — security/debug correctness issue; must remain until the actual defect is verified fixed
- **#464** — timing/history behavior needs current revalidation, not age-based closure

## pc-saas-health-monitor

Keep current Cloud Mirror / Performance / operational follow-ups open, including the current #168 / #174 / #178 family unless their own acceptance criteria have since been completed and verified.

## stock-notes

- **#3** — several Codex review follow-ups remain unchecked → keep open unless code proves they were completed elsewhere
- **#104** — live policy schema audit did not show the proposed major/minor/change_type fields → keep open
- **#181** — current schema-source synchronization work → keep active until repo parity is proven
- **#182** — current Market Series ingestion API work → active
- **#183** — current Company Exposure expansion → active
- **#129** — explicitly a long-term Architecture Vision; do not close as “stale” merely because implementations evolved. Review whether it should remain a reference Epic or be promoted into Architecture/Workstream governance.

## mini-tools

- **#243** — not complete: current earnings loader still imports `@/lib/us-market-closed`, so the proposed generic `market-calendar` library merge is not finished
- **#575** — blocked on open PR #579 as described above
- **#583** — Todo origin + AI development evolution Workspace Core backfill is active
- **#588** — Archived Antigravity origin/evolution backfill is active
- **#584–#589** — current Portfolio / Product DB work, active
- **#465** — Personal Investment Platform direction is strategically current; it should either remain a program Epic or be explicitly promoted to a Workstream, not silently closed

## ideas

Pure ideas such as #2, #8, #11, #30, #35, #36 and other genuinely unstarted experiments should remain as idea backlog unless the user decides to abandon them. “Not implemented yet” is not a cleanup defect.

---

# 5. MiniTools Issues that need targeted revalidation

These should be checked in a later Codex pass, but are not safe auto-close targets from this audit alone.

| Issue | Current read |
|---|---|
| #38 / #92 / #104 | Yutai memo UI ideas; user’s UI/UX learning process has evolved, so re-evaluate under current Pattern Catalog rather than close by age |
| #119 | Earnings Calendar update operation has evolved to market-info-api + fallback, but scheduling/ops contract must be checked |
| #160 | Treemap rerender optimization may be partly addressed; benchmark actual hover/layout recomputation before closing |
| #396 | Cross-device sync is partly enabled by DB-backed private tools but broad “all functions” scope is not proven complete |
| #413 | likely small docs-index cleanup; inspect current docs index before closure |
| #447 | giant Dividend/Investment umbrella; many parts have become Stock Notes / #584–#587 work. Prefer promotion/decomposition over claiming completion |
| #448 | concrete Central Warehouse price correctness bug; verify live data before any close |
| #463 | Investment Origin overlaps Stock Notes #105; likely promote/absorb after checking unique UI scope |
| #464 | old Market Info industry knowledge has since evolved into broader Taxonomy/Knowledge architecture; map current successor before closing |
| #570/#572/#573 | theme-color work may conflict with the newer evidence-first UI/UX Pattern Catalog philosophy; re-evaluate scope rather than auto-close |

---

# 6. Recommended Codex execution sequence

## Phase A — no-risk closures

Start only with `close_candidate_high`.

Suggested first batch:

1. `pc-saas-health-monitor#25`
2. `pc-saas-health-monitor#26`
3. `pc-saas-health-monitor#27`
4. `pc-saas-health-monitor#159`
5. `market_info#422`
6. `mini-tools#142`
7. `mini-tools#234`

For each, re-verify current main, post an evidence comment, then close.

## Phase B — contract verification closures

Next verify:

- `mini-tools#190`
- `mini-tools#164`
- `stock-notes#86`
- `stock-notes#130`
- `stock-notes#165`

Do not include `mini-tools#575` until PR #579 is merged.

## Phase C — promoted / superseded cleanup

Handle Ideas and old umbrella Issues separately. These require a different closing comment:

> This Issue is being closed because its role as an Idea/Epic has been promoted to the following Product/Workstream/implementation Issues. This does not mean all future features described in the brainstorm are complete.

Candidates:

- `ideas#4`
- `ideas#15`
- `ideas#31`
- `ideas#34`
- possibly `stock-notes#133`, `#66`, `#69` after successor mapping

## Phase D — re-count and second audit

After the safe closures:

1. re-count open Issues per repository
2. inspect only the remaining older / high-level Issues
3. avoid spending time line-by-line on every currently active implementation Issue
4. update the Product DB Workstream snapshot with the final counts and cleanup decisions

---

# 7. Required closing comment template

For an implemented Issue:

```md
棚卸し再確認の結果、現在の main / DB / 後続実装で本Issueの完了条件が満たされていることを確認したためcloseします。

確認根拠:
- <file / PR / test / DB evidence>
- <successor issue if any>

残件がある場合は <successor> で管理します。
```

For a promoted Idea/Epic:

```md
このIssueは未着手のまま放棄されたのではなく、後続のProduct / Workstreamへ昇格しています。
進捗SoTを二重化しないため、Idea/Epicとしてはcloseします。

後続:
- <workstream / repo / issue>

このcloseは、本文に書かれた将来拡張がすべて実装済みという意味ではありません。
```

---

# 8. Audit conclusion

The main cleanup problem is **not a large pile of abandoned work**. The larger pattern is that implementation and architecture evolved faster than old Issue state:

- original problem Epics stayed open after implementation
- Ideas became Products / Workstreams but remained open as if they were the progress SoT
- early design Issues were superseded by more mature architecture
- recurring operational trackers correctly remain open

Therefore the correct cleanup strategy is:

> **close verified completed scopes, promote historical Ideas out of progress-SoT status, preserve ongoing operational trackers, and never use Issue age as the primary criterion.**

This file is an audit handoff, not authorization to bulk-close without re-verification.
