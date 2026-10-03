# GitHub Issue Inventory Audit — 2026-09-08

## Purpose

This is the **Codex handoff** for the cross-repository GitHub Issue cleanup.

The goal is not to maximize closed Issue count. The goal is to make Issue lifecycle state match the current implementation / Product / Workstream state while preserving historical reasoning.

## Audit snapshot

The completed lightweight sweep covered **all 20 repositories** in the inventory.

- Total Issues: **506**
- Open: **178**
- Closed: **328**
- Open Issues in the five largest repositories: **147 (82.6%)**
  - `mini-tools`: 53
  - `market_info`: 27
  - `pc-saas-health-monitor`: 15
  - `stock-notes`: 24
  - `ideas`: 28
- Other repositories reviewed: 31 Open in total
- Issue state mutations during the audit: **0**

Counts above are the audit snapshot, not a permanent truth. **Codex must re-count immediately before mutation.**

The key finding is that Open Issue count is **not** the same as unfinished implementation count. A meaningful subset consists of:

- original problem Epics that stayed open after implementation
- Ideas that became Products / Workstreams
- old design Issues superseded by newer architecture
- intentionally recurring operational trackers
- genuine active research and implementation work

---

# Safety contract for Codex

Do **not** close an Issue only because it is old, looks implemented from its title, or has a newer successor.

Before every close:

1. Re-fetch the Issue body and comments.
2. Check current `main`, not only an old Roadmap or comment.
3. Check linked PR merge state.
4. Verify the original acceptance criteria, or establish that the scope was explicitly promoted / superseded.
5. Run a cheap read-only check / test when available.
6. Add a final comment with evidence and successor links.
7. Only then mutate the Issue state.

If evidence is ambiguous, leave it open and report the ambiguity.

Do not modify Stock Master data as part of Issue cleanup.

For a completed implementation, prefer `state_reason=completed`. Use `duplicate` only for a real duplicate. For a promoted/superseded Idea, explain the promotion in the close comment rather than pretending every brainstorm item was implemented.

---

# Final Gate classification

## Group A — high-confidence close candidates

These 12 Issues had the strongest implementation / acceptance evidence during the audit. Codex should still perform the safety checks above immediately before closing.

| Repo | Issue | Audit conclusion | Final check before close |
|---|---:|---|---|
| pc-saas-health-monitor | #25 | Original M1 / GCR capacity problem is resolved; collector/threshold path implemented | Verify current Artifact Registry collector + threshold path |
| pc-saas-health-monitor | #26 | Original M2 notification problem is resolved; toast/alert/dashboard path implemented | Verify current alert path |
| pc-saas-health-monitor | #27 | Original M3 market_info asset freshness problem is implemented; heartbeat + Assets UI now exist | Verify current `market_info` heartbeat producer and Health Monitor consumer |
| pc-saas-health-monitor | #159 | Backup/Recovery Step 1 acceptance was recorded complete; later DR work was non-scope | Re-read comments; close only Step 1 scope |
| market_info | #422 | Credit balance acquisition exists via current `jsonp_history`; later #430 assumes it | Run/search current `credit --credit-mode jsonp_history`, tests and ops docs |
| mini-tools | #119 | Earnings calendar acquisition/update architecture has been overtaken by the current market-info-api flow | Re-check current operations/docs and confirm no unique unfinished requirement |
| mini-tools | #142 | `/tools/econ-calendar` is implemented with real loader/UI | Build/test route and check docs/UAT |
| mini-tools | #190 | Market tools use `MARKET_INFO_API_BASE_URL` as the standard entry point | Search legacy runtime env dependencies and docs |
| mini-tools | #234 | Shared market calendar type exists and current loader imports it from `_shared` | Search original duplicate declaration locations |
| mini-tools | #238 | Premium auth tests were found implemented during the sweep | Run relevant Vitest suite / inspect test file before close |
| mini-tools | #240 | US stock ranking data-loader tests were found implemented during the sweep | Run relevant data-loader tests before close |
| stock-notes | #86 | Policy version/status/title separation is established in live DB/UI | Verify API/OpenAPI + AI creation rule before close |

### Specific evidence notes

#### market_info #422

Later #430 explicitly works from the premise that per-stock credit detail and weekly history are already obtainable through `credit --credit-mode jsonp_history`. The audit also found current implementation/contract/test/operations evidence. #430 is follow-up refinement, not evidence that #422 remains unimplemented.

#### mini-tools #142

Current main has `app/tools/econ-calendar/page.tsx`, which calls `loadEconCalendarPageData()` and describes importance filtering plus previous / forecast / result display. The original Issue asked to define/implement a minimum economic-indicator calendar; the repository now has the actual tool.

#### mini-tools #234

Current earnings-calendar loader imports:

```ts
import type { JpxMarketClosedResponse } from "@/app/tools/_shared/market-calendar-types";
```

This directly matches the intended type centralization. Codex should confirm no duplicate type remains elsewhere.

#### stock-notes #86

Live DB currently has versioned policy rows with structured `version_number` and `status`; active v7 uses the simple title `投資方針`. MiniTools reads/displays version and status structurally. The only remaining gate is confirming API/OpenAPI/AI instructions do the same.

---

## Group B — promoted Ideas; close after promotion comment

These are no longer useful as the progress Source of Truth. Their value should remain as **origin / evolution evidence**.

| Repo | Issue | Promotion state | Codex action |
|---|---:|---|---|
| ideas | #4 | Became the `test-english` Product | Link successor Product/repo; close Idea-level scope |
| ideas | #15 | Transaction-history work moved into implementation/research pipelines | Link authoritative current implementation; keep child #16 if Nikko ingestion remains |
| ideas | #31 | Became cross-repo Stock Notes / MiniTools / Market Info investment-analysis system | Link successor implementation Issues / Workstream; close as promoted |
| ideas | #34 | Became the Personal Investment Platform Program / Workstream | Link current Workstream and Portfolio successor Issues; close as promoted-to-workstream |

### Promotion close wording

Do **not** say all future features in the original Idea are implemented. Use wording like:

```md
このIssueは未着手のまま放棄されたのではなく、後続のProduct / Workstreamへ昇格しています。
進捗SoTを二重化しないため、Idea/Epicとしてはcloseします。

後続:
- <workstream / repo / issue>

このcloseは、本文に書かれた将来拡張がすべて実装済みという意味ではありません。
```

### ideas #4 note

Workspace Core now records the actual Test English flow:

`教材ページ撮影 → Gemini OCR → OCR JSON → vocabulary normalization → lesson combine → book structure → JSON → HTML/PWA build → Cloudflare Pages`

The PWA/mobile install and player exist; copyrighted source material is intentionally excluded from Git. Close the Idea as promoted, not because every optional feature from the brainstorm exists.

---

## Group C — reframe / cross-link; do not bulk-close

These Issues have been partly implemented or absorbed by a more mature architecture, but still contain potentially unique requirements. Codex should map remaining scope first.

| Repo | Issue | Current interpretation |
|---|---:|---|
| stock-notes | #1 | Phase 1 core API/DB was implemented, but original Cloud Run / Custom GPT / MCP completion must be re-verified |
| stock-notes | #66 | External-holdings design largely superseded by richer Account/Instrument/Position model |
| stock-notes | #69 | Combined portfolio context largely absorbed into later Portfolio architecture |
| stock-notes | #77 | `market_cap_profile` exists in live schema; aggregation/read-model requirement may remain |
| stock-notes | #127 | cost basis + DPS foundation exists; broader YOC/dividend-history scope moved toward Portfolio Income work |
| stock-notes | #133 | Dividend dashboard/data work largely promoted to MiniTools #584 and Financial DB |
| mini-tools | #164 | Direct R2/S3 access migration has largely happened, but original BFF/type/cache design was not necessarily implemented literally |
| mini-tools | #396 | DB-backed cross-device behavior exists in parts; broad “all functions” scope is not proven |
| mini-tools | #447 | Huge dividend/investment umbrella decomposed into current Stock Notes / Portfolio work |
| mini-tools | #463 | Investment-origin concept overlaps current Stock Notes Investment Origin work |
| mini-tools | #464 | Old industry-knowledge reuse concept has evolved into broader Taxonomy/Knowledge architecture |
| mini-tools | #465 | Personal Investment Platform direction is still strategically current and should become/remain a Program Workstream rather than be treated as stale |

### Group C rule

Prefer one of these outcomes:

1. Keep open but narrow the body to the unique remaining scope.
2. Link the current successor and close as superseded/promoted.
3. Promote the Issue into the Workstream relation graph and stop using the old Issue as the current progress SoT.

Never close simply to reduce the count.

---

## Group D — keep open / active / ongoing / needs revalidation

Representative keep-open examples from the audit:

### market_info

- #283 — deliberate ongoing operation tracker
- #464 — **keep open**: current Task Scheduler remains fixed Thursday 16:30; automatic holiday-shift handling was not proven
- #507 — Data Source Catalog active; Draft PR #508 / Schema 0.2 validation ongoing
- #509 / #510 / #511 / #512 — current Market DB/index ingestion work

### mini-tools

- #160 — treemap performance needs actual current benchmark/revalidation
- #243 — not complete; current earnings loader still imports `@/lib/us-market-closed`
- #250 — explicit JSON prune operation not proven done
- #413 — docs-index cleanup needs current docs re-check
- #491 — Company Network Program/Epic
- #498 — Supabase migration/source-of-truth follow-up
- #550 — Company Network UI Phase B
- #562 — Portfolio Industry / Structural Exposure
- #575 — **keep open until PR #579 merges**
- #583 — Todo App origin + AI development Evolution backfill
- #584 / #585 / #586 / #587 — current Portfolio work
- #588 — Archived Antigravity origin/evolution backfill
- #589 — Instrument analysis UI

### pc-saas-health-monitor

- #68 / #87 / #88 / #165 — current backlog/operational work
- #168 — Cloud Mirror workstream
- #174 — Portfolio Performance collection/monitoring work

### stock-notes

- #104 — proposed policy major/minor version contract not present in the live schema audit
- #181 — current Workstream Registry / schema-source sync work
- #182 — Market Series ingestion API work
- #183 — Company Exposure work

### claude-skills / test_ISN

- `claude-skills#6` — current System Map skill/workstream
- `claude-skills#7` — current UI/UX Pattern Catalog workstream
- `test_ISN#12` — production secret fallback security concern; must remain until fixed

### Needs-revalidation examples

- `stock-notes#136`
- `market-info-api#38`
- `portfolio_x_post#15`
- `claude-skills#3`
- `mini-tools#570 / #572 / #573`

For the MiniTools theme/color Issues, do not auto-close or blindly execute them: the newer UI/UX philosophy is evidence-first (observe → classify → trial → use → review → promote), so their scope should be checked against the current Pattern Catalog before action.

---

# Special gate: mini-tools #575 / PR #579

As of this audit:

- Workspace Core live Supabase already has the Observability V1.1-equivalent schema/contract and it was transaction-tested.
- PR **#579** exists to return that live final state to Git as reproducible source.
- PR #579 is currently **open, unmerged**.
- Its body explicitly says `Closes #575`.
- Codex review was still a merge prerequisite.

Therefore:

> **Do not manually close #575 before #579 is reviewed and merged.**

After merge, confirm bootstrap/migration numbering consistency and allow the PR to close #575 or close it with the merge evidence.

---

# Other-repository sweep conclusion

The 31 Open Issues outside the five major repositories were also lightly reviewed.

Findings:

- `test_trade`: mostly legitimate research / forward experiment backlog; generally keep open.
- `test_english`: real unfinished work remains (including audio population/sync/access themes); do not treat the Product as “fully done” merely because ideas#4 can be closed as promoted.
- `market-info-api#38`: destructive R2-delete topic; requires current-state revalidation before any mutation.
- `claude-skills#6/#7`: current System Map / UIUX work.
- `test_ISN#12`: security-sensitive production secret fallback issue; keep open.
- No large hidden cluster of obvious forgotten-close Issues was found in the small repos.

---

# Recommended Codex execution order

## Phase A — close Group A only

Recommended first batch:

1. `pc-saas-health-monitor#25`
2. `pc-saas-health-monitor#26`
3. `pc-saas-health-monitor#27`
4. `pc-saas-health-monitor#159`
5. `market_info#422`
6. `mini-tools#119`
7. `mini-tools#142`
8. `mini-tools#190`
9. `mini-tools#234`
10. `mini-tools#238`
11. `mini-tools#240`
12. `stock-notes#86`

For each: re-fetch → verify current code/test/DB → add evidence comment → close.

## Phase B — promotion cleanup

Handle:

- `ideas#4`
- `ideas#15`
- `ideas#31`
- `ideas#34`

Add successor/workstream relations first. Then close the old Idea as a historical origin record, not as the current progress SoT.

## Phase C — reframe Group C

Do not bulk-close. Determine the unique residual scope and either narrow, cross-link, or close as superseded.

## Phase D — re-count

After mutations:

1. Re-count all 20 repos.
2. Save the new snapshot to the Product System Inventory Workstream.
3. Record every closed/promoted Issue as an append-only cleanup event.
4. Continue to Chat/Ideas backfill only after Issue lifecycle state is coherent.

---

# Closing comment templates

## Implemented

```md
棚卸し再確認の結果、現在の main / DB / 後続実装で本Issueの完了条件が満たされていることを確認したためcloseします。

確認根拠:
- <file / PR / test / DB evidence>
- <successor issue if any>

残件がある場合は <successor> で管理します。
```

## Promoted / superseded

```md
このIssueは未着手のまま放棄されたのではなく、後続のProduct / Workstreamへ昇格しています。
進捗SoTを二重化しないため、Idea/Epicとしてはcloseします。

後続:
- <workstream / repo / issue>

このcloseは、本文に書かれた将来拡張がすべて実装済みという意味ではありません。
```

---

# Final conclusion

The Issue inventory problem is primarily a **lifecycle / Source-of-Truth synchronization problem**, not simply an excessive backlog problem.

The correct cleanup rule is:

> **Close verified completed scopes; promote old Ideas out of progress-SoT status; preserve ongoing operational/research trackers; reframe partially absorbed architecture Issues; never use age as the primary close criterion.**

This report authorizes no blind bulk close. It is the evidence-based handoff for Codex to perform the final mutation pass safely.
