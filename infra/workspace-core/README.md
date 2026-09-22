# Workspace Core Supabase

This directory contains the reproducible schema, evidence-backed seed set, and read model for the dedicated **Workspace Core** Supabase project.

## Current scope and handoff (2026-09-16)

Workspace Core has progressed beyond the original Product Map V1. The V1 API/security contract and historical audit below are retained for reference; their counts and advisor results are **not a current full-system health check**.

| Layer | SQL / role |
|---|---|
| V1 registry and Product Map | `sql/001` through `sql/010` |
| Description and provisional Service layer | `sql/011` through `sql/013` |
| V3 Function / Capability / Knowledge / Evolution / Value Flow foundation | `sql/014` through `sql/020` |
| V3 evidence-backed inventory expansion | `sql/021` through `sql/028` |
| Product Evolution Evidence reader | `sql/029_product_evolution_evidence_reader.sql` |
| System Map reviewed-facts reader | `sql/030_system_map_facts_reader.sql` |
| Controlled origin follow-up for #583 / #588 | `operations/apply_origin_followup.sql`, with private replay input |

The numeric SQL files should be reviewed/applied in order through **030** to reproduce the current V3 baseline. The old 001-010 procedure below reproduces only the original V1 baseline. A clean-database replay of the entire sequence was not re-tested in this follow-up.

The current origin follow-up adds data, not schema. The loader and [read-only checks](operations/verify_origin_followup.sql) are separate from unconditional bootstrap SQL because personal evidence must not be published in this public repository. The replay unit is the public loader plus the immutable private audit snapshot held by the canonical Workstream. Missing input or conflicting definitions abort rather than overwrite data.

See the [origin follow-up handoff and verification record](../../docs/devlog/2026-09-16-workspace-origin-followup-handoff.md) for input retrieval, application boundaries, tests, and remaining review/merge gates.

The canonical existing program is `product-system-inventory-evolution-design-data-strategy` in the **mini-tools** database's `public.stock_notes_workstreams`, not a new Workstream in this project's `coordination` schema. Its broader scope includes map/UIUX, market-data sourcing, thought/chat capture, and issue inventory. Completing the V3 foundation or #583/#588 does not complete that whole program. Preserve the other milestones and existing decisions.

Current project:

- Supabase project: `workspace-core`
- project ref: `vtqceobocbetkkatycxw`
- region: `ap-northeast-1`
- V1 private schemas: `platform`, `registry`, `ops`
- V3 semantic schemas: `knowledge`, `flow` (plus V3 additions to `registry`)
- Product Map read views: narrow `public.workspace_core_*_v` views with browser-role access revoked

Do **not** apply this directory's Workspace Core SQL to the existing `mini-tools` Supabase project. The private Workstream replay-input lookup is a separate, explicitly labelled mini-tools read in the handoff document.

## Boundary

```text
Workspace Core Supabase project (inventory scope)
├─ platform   # source systems, domains, shared metadata/governance primitives
├─ registry   # products, repos, technologies, services, resources, relations, capabilities
├─ knowledge  # V3 goals, principles, hypotheses, provenance, evolution
├─ flow       # V3 value flows, versions, steps, edges
├─ ops        # sync/import state
└─ public     # narrow server-read views required by Product Map
```

Workspace Core is a **catalog and relationship graph**, not a content warehouse. Other Workspace Core domains are outside this inventory-focused bootstrap/handoff.

### Product Evolution Evidence reader

`sql/029_product_evolution_evidence_reader.sql` adds a dedicated, NO-BYPASSRLS database principal for pc-saas-health-monitor. It can read only the key/status/timestamps of active `product-evolution-review-*` rows from `knowledge.items`; it cannot read Review statements/metadata, write Workspace Core, or access other private schemas. The migration is fail-closed: unexpected role membership, object ownership, direct ACL, or role-targeted policy state aborts instead of being silently preserved. The reader has both a PERMISSIVE allow policy and a matching RESTRICTIVE policy, so a future broad PERMISSIVE/PUBLIC policy cannot widen its row visibility. PostgreSQL 17's automatic creator ADMIN membership is allowed only with `ADMIN TRUE / INHERIT FALSE / SET FALSE`; the Health Monitor principal gets the capability with `ADMIN FALSE / INHERIT TRUE / SET FALSE`. The login password is configured out-of-band and stored only in the Health Monitor OS Credential Store. Privileged catalog verification lives in `operations/verify_product_evolution_evidence_reader.sql`; actual-principal allow/deny tests live in `operations/uat_product_evolution_evidence_reader.sql`; password initialization, rotation, emergency revoke, and recovery are documented in `operations/product_evolution_evidence_reader_runbook.md`.


### System Map reviewed-facts reader

`sql/030_system_map_facts_reader.sql` adds a second, deliberately separate
Health Monitor database principal for Issue
`pc-saas-health-monitor#326`. It does **not** extend the Product Evolution
principal from migration 029, because 029 intentionally fail-closes on any
unexpected membership or private-schema access.

The System Map principal can read only selected identity/status columns from
`registry.products`, `registry.product_relations`, `flow.value_flows`, and
`flow.flow_versions`. It cannot read free-text descriptions, metadata,
relation notes/source text, Flow purpose/summary, Flow steps/edges, Knowledge,
or another private table, and it cannot write. RLS limits visible rows to the
lifecycle/model/relation vocabularies reviewed on 2026-09-23 so a newly added
status or relation type is fail-closed until the contract is reviewed.

The login password is configured out-of-band under the separate Health Monitor
credential `WORKSPACE_CORE_SYSTEM_MAP_DB_URL`. Privileged catalog checks live
in `operations/verify_system_map_facts_reader.sql`; actual-login allow/deny
tests live in `operations/uat_system_map_facts_reader.sql`; credential
initialization, rotation, emergency revoke, and recovery are documented in
`operations/system_map_facts_reader_runbook.md`.

## Source-of-truth policy

- GitHub stays authoritative for code, repositories, Issues, PRs, Actions, and repository metadata.
- Supabase projects stay authoritative for their operational database state.
- Notion can remain a source/archive for long-form text and historical notes when the original lives there.
- Runtime platforms such as Vercel / Google Cloud / Cloudflare remain authoritative for live deployment state.
- ChatGPT / AI agents are expected to be the primary conversational interface across these systems.
- Workspace Core is authoritative for Product identity and cross-system relationships that do not naturally belong to another source system.

Workspace Core stores identity, relationship, provenance, confidence, and verification metadata so an agent or the mini-tools Product Map can answer questions such as:

- Which products use Supabase?
- Which repositories belong to this product?
- What consumes Market Info data or APIs?
- Which services would be affected if a provider is unavailable?
- Which repositories use Python + Playwright?
- Which service relationships are runtime dependencies versus monitoring targets?

## Relationship model

Provider and concrete instance are deliberately separate.

- `service_providers`: Supabase, Vercel, Cloudflare, Google Cloud, Neon, etc.
- `service_instances`: a concrete project/deployment when its stable identity is known.
- `product_service_links`: Product -> concrete service instance.
- `product_service_provider_links`: Product -> provider when usage is evidence-backed but the concrete instance has not yet been identified.

Do not invent placeholder instances merely to represent provider usage.

Relationship meaning also matters. `monitors_service` is a monitoring target and must not be treated as a runtime dependency such as `deployment_target` or `uses_database_platform`. Likewise, `predecessor_of` is historical lineage, not an operational dependency.

## Product Map V1 security model

`platform`, `registry`, and `ops` remain private custom schemas.

- RLS is enabled as defense in depth.
- `public`, `anon`, and `authenticated` are explicitly revoked from the private registry tables.
- Product Map does not query the registry directly from the browser.
- `010_product_map_read_model.sql` creates only the six read views required by the UI.
- Every Product Map view uses `security_invoker = true`.
- `public`, `anon`, and `authenticated` are explicitly revoked from those views after creation.
- mini-tools reads the views with a **server-only** Supabase secret/service-role client.
- The secret is never put in a `NEXT_PUBLIC_*` variable and is never returned to the browser.
- The browser talks only to the premium-protected Next.js route `/api/premium/workspace-core`.

Runtime path:

```text
Browser
  ↓ premium cookie + JSON request
mini-tools / Vercel
  ↓ Next.js Route Handler (server-only secret)
public.workspace_core_*_v
  ↓ SECURITY INVOKER
private registry
```

Never store secrets, API keys, passwords, access tokens, service-role keys, or private credentials in registry metadata. The origin follow-up changes no grants, RLS policies, API exposure, or application authorization.

## Original V1 SQL files

This detailed list describes the original V1 baseline. For the V3 ranges, see the current-scope section above.

- `001_registry_schema.sql`
  - creates `platform`, `registry`, and `ops`
  - creates V1 tables, constraints, indexes, RLS, private grants
- `002_seed_sources_and_repositories.sql`
  - seeds source systems / initial service providers
  - records the verified existing mini-tools Supabase service instance
  - imports the 20 GitHub repositories discovered on 2026-08-30
- `003_seed_products_provisional.sql`
  - creates Product concepts separately from repository facts
  - links known multi-repository products (`todo-app`, `market-info`)
  - adds verified initial mini-tools relationships
- `004_schema_hardening.sql`
  - adds provider account/team scope to service instances
  - hardens uniqueness and reverse-FK indexes
  - adds operational counter checks
- `005_add_provider_level_service_discovery.sql`
  - adds evidence-backed Product -> Provider relations when a concrete instance is unknown
- `006_seed_discovered_assets.sql`
  - adds discovered technologies/providers/relations from repository evidence
- `007_seed_trade_research_discovery.sql`
  - adds the evidence-backed AI Trade Research Lab / market-data discovery set
- `008_reconcile_discovery_snapshot.sql`
  - reconciles technology/provider masters and discovery rows that were first found interactively
- `009_finalize_discovery_links.sql`
  - re-applies incremental discovery links after reconciliation
  - ensures an ordered fresh bootstrap reaches the intended final graph
- `010_product_map_read_model.sql`
  - creates the Product Map read contract as six `SECURITY INVOKER` views
  - keeps the private registry hidden from browser roles
  - revokes direct `public` / `anon` / `authenticated` access to the read views

`008` and `009` exist because discovery initially happened interactively against the live registry. They preserve reproducibility without pretending those earlier rows were part of the original bootstrap.

## Historical V1 bootstrap order (001-010 only)

For reproducing the original Product Map V1 baseline, not the complete current V3:

1. Apply `001_registry_schema.sql`.
2. Apply `002_seed_sources_and_repositories.sql`.
3. Apply `003_seed_products_provisional.sql`.
4. Apply `004_schema_hardening.sql`.
5. Apply `005_add_provider_level_service_discovery.sql`.
6. Apply `006_seed_discovered_assets.sql`.
7. Apply `007_seed_trade_research_discovery.sql`.
8. Apply `008_reconcile_discovery_snapshot.sql`.
9. Apply `009_finalize_discovery_links.sql`.
10. Apply `010_product_map_read_model.sql`.
11. Run acceptance queries and Supabase security/performance advisors.

Discovery seeds use upserts and are intended to be idempotent. The controlled origin operation instead uses create-only conflict handling to avoid overwriting newer knowledge.

## Historical Product Map V1 snapshot

Verified during Product Map V1 implementation:

- 18 Products
- 20 GitHub repositories
- 20 Product -> Repository links
- 26 Technologies
- 55 Product -> Technology links
- 15 Service Providers
- 23 Product -> Provider links
- 1 Product -> concrete Service Instance link
- 6 Product -> Product relations

The Product Map read views independently returned:

- `workspace_core_product_summary_v`: 18
- `workspace_core_product_repository_v`: 20
- `workspace_core_product_technology_v`: 55
- `workspace_core_product_provider_v`: 23
- `workspace_core_product_instance_v`: 1
- `workspace_core_product_relation_v`: 6

Counts are historical audit snapshots, not permanent schema invariants or current expected totals after later additions.

Evidence audit from V1:

- GitHub-derived Product -> Technology links missing `evidence_uri`: 0
- GitHub-derived Product -> Provider links missing `evidence_uri`: 0
- unverified Product -> Repository links: 0
- unverified Product -> Product relations: 0

## Product Map application contract

mini-tools owns the presentation/API boundary; no separate Cloud Run API is required in V1.

Server-only environment variables:

```env
WORKSPACE_CORE_SUPABASE_URL=
WORKSPACE_CORE_SUPABASE_SECRET_KEY=
```

`WORKSPACE_CORE_SUPABASE_SECRET_KEY` should use a modern Supabase `sb_secret_...` key where available. The implementation also accepts `WORKSPACE_CORE_SUPABASE_SERVICE_ROLE_KEY` as a legacy fallback, but secrets must never be committed.

Next.js read API:

- `GET /api/premium/workspace-core?mode=overview`
- `GET /api/premium/workspace-core?mode=product&slug=<product-slug>`
- `GET /api/premium/workspace-core?mode=provider&slug=<provider-slug>`

The route:

- requires the existing mini-tools premium session;
- returns `private, no-store` responses;
- creates a separate `@supabase/supabase-js` server client, not the cookie-sharing SSR client used by the original mini-tools Supabase project;
- returns only the read-contract JSON required by Product Map.

UI route:

- `/premium/product-map`

V1 UI includes Product search/filtering, Product detail, Repository/Technology/Provider evidence, provider impact, and a selected-Product 1-hop relation view. `monitors_service` is shown in a separate monitoring section rather than dependency impact.

## Historical V1 advisor state

These results were recorded after the Product Map read model migration. They are not a fresh advisor run for the origin follow-up.

Security advisor:

- ERROR/WARN: none
- INFO: `rls_enabled_no_policy` on private schemas, intentional in the current access model
- remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Performance advisor:

- ERROR/WARN: none
- INFO: unused reverse indexes on the new database; retained for intended graph traversal
- remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Historical V1 acceptance queries

The comments below are the original snapshot counts, not immutable acceptance conditions for the current database. Use the scoped operation checks for the new follow-up.

```sql
select count(*) from registry.repositories;          -- V1: 20
select count(*) from registry.products;              -- V1: 18
select count(*) from registry.product_repositories;  -- V1: 20
select count(*) from registry.technologies;          -- V1: 26
select count(*) from registry.product_technologies;  -- V1: 55
select count(*) from registry.service_providers;     -- V1: 15
select count(*) from registry.product_service_provider_links; -- V1: 23
select count(*) from registry.product_service_links; -- V1: 1
select count(*) from registry.product_relations;     -- V1: 6

select count(*) from public.workspace_core_product_summary_v;    -- V1: 18
select count(*) from public.workspace_core_product_repository_v; -- V1: 20
select count(*) from public.workspace_core_product_technology_v; -- V1: 55
select count(*) from public.workspace_core_product_provider_v;   -- V1: 23
select count(*) from public.workspace_core_product_instance_v;   -- V1: 1
select count(*) from public.workspace_core_product_relation_v;   -- V1: 6
```

## Non-goals for Product Map V1

- Copying Notion or GitHub Issue bodies into Workspace Core.
- Storing secrets in the registry.
- Browser-side direct database writes.
- Exposing the entire private registry to the Supabase Data API.
- A giant all-node graph as the default UI.
- Treating monitoring targets as runtime dependencies.
- Creating a separate API service solely for this UI.
- Automatic provider/repository synchronization before the read model proves useful.
