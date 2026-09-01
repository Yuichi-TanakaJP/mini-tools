# Workspace Core Supabase

This directory contains the reproducible schema, evidence-backed seed set, and read model for the dedicated **Workspace Core** Supabase project.

Current project:

- Supabase project: `workspace-core`
- project ref: `vtqceobocbetkkatycxw`
- region: `ap-northeast-1`
- private schemas: `platform`, `registry`, `ops`
- Product Map read views: narrow `public.workspace_core_*_v` views with browser-role access revoked

Do **not** apply these files to the existing `mini-tools` Supabase project.

## Boundary

```text
Workspace Core Supabase project
├─ platform   # source systems, domains, shared metadata/governance primitives
├─ registry   # products, repos, technologies, services, resources, relations
├─ ops        # sync/import state
└─ public     # only narrow server-read views required by Product Map
```

Workspace Core is a **catalog and relationship graph**, not a content warehouse.

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

Relationship meaning also matters. `monitors_service` is a monitoring target and must not be treated as a runtime dependency such as `deployment_target` or `uses_database_platform`.

## Security model

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
- `009_finalize_discovery_links.sql`
  - re-applies incremental discovery links after reconciliation
  - ensures an ordered fresh bootstrap reaches the intended final graph
- `010_product_map_read_model.sql`
  - creates the Product Map read contract as six `SECURITY INVOKER` views
  - keeps the private registry hidden from browser roles
  - revokes direct `public` / `anon` / `authenticated` access to the read views

`008` and `009` exist because discovery initially happened interactively against the live registry. They preserve reproducibility without pretending those earlier rows were part of the original bootstrap.

## Reproducible bootstrap order

For a fresh Workspace Core database:

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

Discovery seeds use upserts and are intended to be idempotent.

## Current live snapshot

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

Counts are audit snapshots, not permanent schema invariants.

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

## Advisor state

After the Product Map read model migration:

Security advisor:

- ERROR/WARN: none
- INFO: `rls_enabled_no_policy` on private schemas, intentional in the current access model
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

select count(*) from public.workspace_core_product_summary_v;    -- 18
select count(*) from public.workspace_core_product_repository_v; -- 20
select count(*) from public.workspace_core_product_technology_v; -- 55
select count(*) from public.workspace_core_product_provider_v;   -- 23
select count(*) from public.workspace_core_product_instance_v;   -- 1
select count(*) from public.workspace_core_product_relation_v;   -- 6
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
