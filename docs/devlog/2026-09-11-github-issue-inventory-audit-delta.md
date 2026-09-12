# GitHub Issue Inventory Audit — 2026-09-11 Delta

## Purpose

This file is a **delta revalidation** against the 2026-09-08 audit report.

The 2026-09-08 report remains the historical audit snapshot. This delta records cases where current `main`, live Supabase, or linked PR state changes the recommended classification.

No GitHub Issue state was changed during this delta pass. One PR audit comment was added to `mini-tools#579` because the current branch has become unsafe to merge as-is.

---

## Classification changes

### Move to Group A — high-confidence close candidate

#### `stock-notes#77` — market_cap_profile portfolio aggregation

Current evidence now satisfies the core requested behavior:

- live `stock_notes_instrument_classifications` has current non-null `market_cap_profile` for 39 classifications
- `app/portfolio_decision_context.py` reads `market_cap_profile`
- it builds both total and allocation `market_cap` buckets
- decision-context response returns `by_market_cap_profile`

The original Issue specifically requested `market_cap_profile` storage plus portfolio-value/count aggregation in the decision context. That is now present.

Recommended final action: re-fetch Issue, run/read the relevant decision-context tests, add evidence comment, close as completed.

#### `stock-notes#130` — Portfolio Action OpenAPI/backend title mismatch

Current implementation is aligned:

- live `stock_notes_portfolio_actions` has `title`
- `PortfolioActionCreateRequest` includes required `title`
- `app/portfolio_actions.py` validates and writes `title`
- Portfolio GPT schema includes `create_portfolio_action`

The original blocking mismatch no longer exists.

Recommended final action: verify generated OpenAPI contains `title` for the request model, run the relevant API test, then close as completed.

#### `stock-notes#165` — Architecture Snapshot v2 / Governance Policy v4

This Issue has been overtaken by later completed architecture versions, not left unfinished.

Live DB on 2026-09-11:

- Architecture Snapshot **v8 active**
- v2 through v7 are preserved as superseded history
- Database Governance Policy **v5 active**
- Policy v4 is preserved as superseded history

Therefore the requested v2/v4 modernization has already been completed and subsequently evolved further.

Recommended final action: close as completed/superseded-by-later-version with links to the current v8 / Policy v5 state. Do not delete historical snapshots/policies.

---

### Remove from Group A — keep open / partial implementation

#### `mini-tools#238` — premium auth unit-test coverage

The previous audit classified this as completed because `lib/__tests__/premium-auth.test.ts` exists. Current source inspection shows that conclusion was too strong.

Current test file covers mainly:

- configured session max age
- valid session through the expiry boundary
- expired session rejection

The original Issue explicitly asks for additional branches including:

- undefined / empty session
- malformed part count
- non-numeric issuedAt
- future timestamp
- tampered signature
- missing secret on creation
- `verifyPremiumPassword` success/failure/unconfigured cases

Those branches are implemented in `lib/premium-auth.ts`, but the requested dedicated unit coverage is not all present in the current test file.

**Reclassification: partial implementation; keep open.**

If the broad checklist is no longer desired, narrow the Issue explicitly rather than closing it as fully implemented.

---

## Group A retained after revalidation

### `mini-tools#240`

`app/tools/us-stock-ranking/__tests__/data-loader.test.ts` now has explicit tests for both manifest and day-data loaders covering:

- API not configured → null / no fetch
- successful API response
- 404 → null
- timeout → null
- network error → null

This matches and exceeds the core original test request. Keep as high-confidence close candidate.

### `mini-tools#234`

The original problem was duplicate `JpxMarketClosedResponse` / `JpxMarketClosedDay` declarations across tool-local type files.

Current main centralizes the declaration in `lib/market-calendar-types.ts`; `app/tools/_shared/market-calendar-types.ts` re-exports it and the tool type files import the shared definition. The duplicate declaration problem is therefore resolved.

A **separate remaining design debt** still exists: `us-market-closed.ts` continues to use the JPX-named response type, and `lib/jpx-market-closed.ts` / `lib/us-market-closed.ts` remain separate. That concern is already represented by `mini-tools#243` and should not keep #234 open if #234 is treated strictly as the duplicate-definition Issue.

Keep #234 as close candidate, with a close comment explicitly pointing remaining generic-name/loader-unification work to #243.

---

## Important blocker discovered: `mini-tools#575` / PR #579

`mini-tools#575` must remain open.

Live Workspace Core already has the Observability V1.1-equivalent schema, but PR #579 is the Git source-of-truth synchronization PR and is still open/unmerged.

A stronger blocker now exists:

- PR #579 adds `infra/workspace-core/sql/014_observability_schema.sql`
- its base is the older main around `26f5ced...`
- current main already uses migration numbers **014–028** for Workspace Core V3
  - `014_v3_registry_functions_capabilities.sql`
  - ...
  - `028_seed_v3_diagram_pattern_knowledge.sql`

Therefore PR #579 must **not** merge as-is. It needs latest-main rebase/recreation and an Observability migration number after the current V3 sequence (029+ at the time of this audit; re-check the actual next number at implementation time).

Audit comment added to PR #579 on 2026-09-11 documenting this blocker and the required rebase/renumber/bootstrap revalidation.

---

## Stock Notes Group C revalidation

### `stock-notes#66`

The original simple external-holding API design has substantially evolved into a richer external-asset pipeline:

- `preview_external_assets`
- `commit_external_assets`
- `list_external_assets`
- `summarize_external_assets`
- external-reference snapshots
- account / instrument / position model
- idempotency and unresolved-instrument handling

This is strong implementation evidence, but the Issue should not be auto-closed as a literal completion without checking the original upsert/history semantics. Preferred outcome: mark as **superseded/absorbed by the richer Portfolio Asset architecture** (#87/#124) or close with an evolution note after that mapping is explicit.

### `stock-notes#69`

Current `portfolio_decision_context.py` can return an `external_assets` summary alongside the official decision context, but the full combined-analysis contract described later in #124 is not proven complete. Keep in Group C / successor architecture; do not mark implemented-complete yet.

### `stock-notes#127`

Foundation is real:

- portfolio positions contain `cost_basis`
- live DB has many positions with cost basis
- `stock_notes_company_metric_values` contains substantial DPS history
- `stock_notes_portfolio_current_dividend_projection_v` provides actual/forecast DPS, annual projection, dividend-rate effect and YoY/change type

But repository search does not show a completed `yield_on_cost` analysis/API contract matching the broad acceptance list. Keep as **partially implemented / superseded in parts by current Portfolio Income work**, not as a close candidate yet.

### `stock-notes#133`

The Financial DB / dividend projection foundation now exists, but the Portfolio-wide Dividend Growth Dashboard/attribution UI is the active scope of `mini-tools#584`. Treat #133 as an upstream requirements/source Issue that should be cross-linked or superseded after #584 responsibility is made explicit. Do not call the full dashboard implemented yet.

### `stock-notes#1`

The core Stock Notes API/DB implementation is long established, and the current docs define Custom GPT Actions usage. However the original completion wording also included Cloud Run / Custom GPT / MCP details that have changed substantially over time. Keep as Group C until the old Phase-1 completion contract is rewritten or closed with an explicit evolution note; do not pretend the original architecture was implemented literally.

---

## Updated Group A recommendation

Starting from the 2026-09-08 Group A list:

Add:

- `stock-notes#77`
- `stock-notes#130`
- `stock-notes#165`

Remove:

- `mini-tools#238` (partial test coverage)

This yields **14 high-confidence close candidates** before the final per-Issue safety check:

1. `pc-saas-health-monitor#25`
2. `pc-saas-health-monitor#26`
3. `pc-saas-health-monitor#27`
4. `pc-saas-health-monitor#159`
5. `market_info#422`
6. `mini-tools#119`
7. `mini-tools#142`
8. `mini-tools#190`
9. `mini-tools#234`
10. `mini-tools#240`
11. `stock-notes#77`
12. `stock-notes#86`
13. `stock-notes#130`
14. `stock-notes#165`

No Issue should be closed from this list without the existing safety contract: re-fetch current Issue/comments → inspect current main/DB/linked PR → evidence comment → state mutation.

---

## Audit lesson

The revalidation itself demonstrates why the audit must be evidence-driven rather than snapshot-driven:

- #238 looked complete because a test file existed, but its requested branch coverage is still partial.
- #77 looked partial in the older audit, but current decision-context code now proves the requested aggregation exists.
- #165 looked current, but live Architecture has already advanced from requested v2/v4 to v8/v5.
- #575 looked like a simple unmerged-PR gate, but later Workspace Core V3 migrations created a migration-number collision that makes the old PR unsafe to merge as-is.

The lifecycle rule remains:

> Re-evaluate the current implementation and current Source of Truth immediately before every Issue mutation.
