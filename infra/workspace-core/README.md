# Workspace Core Supabase

This directory contains the reproducible schema and evidence-backed seed set for the dedicated **Workspace Core** Supabase project.

The project is deliberately **not** named `product-db` or `dev-db`. It can host additional structured domains later without making development inventory the root concept.

Current project:

- Supabase project: `workspace-core`
- project ref: `vtqceobocbetkkatycxw`
- region: `ap-northeast-1`
- V1 schemas: `platform`, `registry`, `ops`

Do **not** apply these files to the existing `mini-tools` Supabase project.

## Boundary

```text
Workspace Core Supabase project
├─ platform   # source systems, domains, shared metadata/governance primitives
├─ registry   # V1: products, repos, technologies, services, resources, relations
├─ ops        # sync/import state
└─ future     # knowledge / automation / research / other domains as needed
```

Only the first three schemas exist in V1. Future schemas should be added only when an actual use case exists.

## Source-of-truth policy

Workspace Core is a **catalog and relationship graph**, not a content warehouse.

- GitHub stays authoritative for code, repositories, Issues, PRs, Actions, and repository metadata.
- Supabase projects stay authoritative for their operational database state.
- Notion can remain a source/archive for long-form text and historical notes when the original lives there.
- Runtime platforms such as Vercel / Google Cloud / Cloudflare remain authoritative for live deployment state.
- ChatGPT / AI agents are expected to be the primary conversational interface across these systems.
- Workspace Core is authoritative for Product identity and cross-system relationships that do not naturally belong to another source system.

Workspace Core stores structured identity, location, relationship, provenance, confidence, and verification metadata so an agent can answer questions such as:

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

Relationship meaning also matters. For example, `monitors_service` is not equivalent to `deployment_target` or `uses_database_platform`.

## Security model (V1)

`platform`, `registry`, and `ops` are private custom schemas.

V1 intentionally does **not** expose them to `anon` or `authenticated` through the Supabase Data API. RLS is enabled as defense in depth, but no client policies are created yet.

Initial access is intended through:

1. Supabase management/database tooling used by ChatGPT or development agents.
2. Server-side service access when a sync/import job is introduced.

If mini-tools later needs browser/client access, prefer a small dedicated `api` schema or server route rather than exposing the entire registry directly.

Never store secrets, API keys, passwords, access tokens, service-role keys, or private credentials in registry metadata.

## SQL files

Apply in numeric order.

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
  - makes the repository seed set independent of live-only discovery state
- `009_finalize_discovery_links.sql`
  - re-applies incremental discovery links after reconciliation
  - ensures an ordered fresh bootstrap reaches the intended final graph

`008` and `009` exist because discovery initially happened interactively against the live registry. They preserve reproducibility without pretending those earlier rows were part of the original bootstrap. A future cleanup may squash these discovery seeds after V1 is stable.

## Reproducible bootstrap order

For a fresh Workspace Core database with the V1 schema:

1. Apply `001_registry_schema.sql`.
2. Apply `002_seed_sources_and_repositories.sql`.
3. Apply `003_seed_products_provisional.sql`.
4. Apply `004_schema_hardening.sql`.
5. Apply `005_add_provider_level_service_discovery.sql`.
6. Apply `006_seed_discovered_assets.sql`.
7. Apply `007_seed_trade_research_discovery.sql`.
8. Apply `008_reconcile_discovery_snapshot.sql`.
9. Apply `009_finalize_discovery_links.sql`.
10. Run acceptance queries and Supabase security/performance advisors.

Discovery seeds use upserts and are intended to be idempotent.

## Current V1 live snapshot

Verified 2026-09-01:

- 18 Products
- 20 GitHub repositories
- 20 Product -> Repository links
- 26 Technologies
- 55 Product -> Technology links
- 15 Service Providers
- 23 Product -> Provider links
- 1 Product -> concrete Service Instance link
- 6 Product -> Product relations

Counts are an audit snapshot, not permanent schema invariants. Repository discovery can legitimately increase them later.

Evidence audit:

- GitHub-derived Product -> Technology links missing `evidence_uri`: 0
- GitHub-derived Product -> Provider links missing `evidence_uri`: 0
- unverified Product -> Repository links: 0
- unverified Product -> Product relations: 0

## Validation performed

The dedicated `workspace-core` project was created and the base DDL/schema bootstrap was applied successfully during V1 construction.

Before merge:

- live-state counts were reconciled with the repository seed set;
- the dependency-order issue in 006/007 was corrected by 008/009;
- `006` -> `009` were then re-run unchanged against the live database;
- all four seed files completed successfully;
- all counts remained unchanged after the replay, confirming the discovery seed layer is idempotent;
- the feature branch was synchronized with the latest `main` and is behind by 0 commits;
- Vercel status for the merge candidate succeeded.

A fully isolated Supabase branch replay was considered. The organization reported a branch cost of `$0.01344/hour`; no paid branch was created because the live DDL execution history, dependency audit, exact discovery-seed replay, and state reconciliation were sufficient for the V1 merge gate.

## Advisor state

Security advisor:

- ERROR/WARN: none
- INFO: `rls_enabled_no_policy` on private schemas, intentional in the V1 access model
- remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Performance advisor:

- ERROR/WARN: none
- INFO: unused reverse indexes on the new database; retained for intended graph traversal
- remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Acceptance checks

```sql
select count(*) from registry.repositories;          -- 20
select count(*) from registry.products;              -- 18
select count(*) from registry.product_repositories;  -- 20
select count(*) from registry.technologies;          -- 26
select count(*) from registry.product_technologies;  -- 55
select count(*) from registry.service_providers;     -- 15
select count(*) from registry.product_service_provider_links; -- 23
select count(*) from registry.product_service_links; -- 1
select count(*) from registry.product_relations;     -- 6
```

## Non-goals for V1

- Copying all Notion page bodies into Supabase.
- Copying all GitHub Issue / PR bodies into Supabase.
- Storing secrets.
- Two-way sync with every provider.
- A generic EAV database for arbitrary future data.
- Treating a monitoring target as a runtime dependency.
- Exposing the whole registry directly to a browser client.

## Next stage

V1 bootstrap and the first evidence-backed discovery pass are complete enough to move from construction to usage.

Next work should focus on:

1. defining read/query contracts for common Product-map questions;
2. deciding between a mini-tools server route and a dedicated read-only `api` schema;
3. implementing the first Product Map / Development Map using only evidenced relations;
4. adding recurring repository/provider synchronization only after the read model proves useful.
