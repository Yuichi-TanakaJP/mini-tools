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

All discovery seeds are designed to be idempotent through upserts.

## Current V1 live snapshot

As of the V1 discovery audit:

- 18 Products
- 20 GitHub repositories
- 26 Technologies
- 55 Product -> Technology links
- 15 Service Providers
- 23 Product -> Provider links
- 6 Product -> Product relations

Counts are an audit snapshot, not permanent schema invariants. Repository discovery can legitimately increase them later.

## Acceptance checks

```sql
select count(*) from registry.repositories;
-- initial inventory expectation: 20

select count(*) from registry.products;
-- V1 product expectation: 18

select count(*) from registry.product_repositories;
-- expectation: all 20 repositories mapped to a Product in the current V1 inventory

select p.slug, r.full_name, pr.role, pr.confidence
from registry.product_repositories pr
join registry.products p on p.id = pr.product_id
join registry.repositories r on r.id = pr.repository_id
order by p.slug, pr.is_primary desc, r.full_name;

select src.slug as source_product,
       rel.relation_type,
       dst.slug as target_product,
       rel.source,
       rel.confidence
from registry.product_relations rel
join registry.products src on src.id = rel.source_product_id
join registry.products dst on dst.id = rel.target_product_id
order by src.slug, rel.relation_type, dst.slug;

select p.slug as product,
       sp.slug as provider,
       l.relation_type,
       l.confidence,
       l.evidence_uri
from registry.product_service_provider_links l
join registry.products p on p.id = l.product_id
join registry.service_providers sp on sp.id = l.provider_id
order by p.slug, sp.slug, l.relation_type;

select sp.slug as provider,
       si.account_scope,
       si.name,
       si.environment,
       si.external_id,
       si.region
from registry.service_instances si
join registry.service_providers sp on sp.id = si.provider_id
order by sp.slug, si.account_scope, si.name, si.environment;
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

The database bootstrap and first repository discovery pass are sufficiently populated to support the next layer.

Before Product Map UI implementation:

1. keep PR #552 unmerged until the repository/live-state audit is complete and the requested code review path is resolved;
2. keep discovery evidence-backed and incremental rather than trying to reach artificial 100% coverage;
3. then build a read-oriented Product Map / Development Map in mini-tools using Product, Repository, Technology, Provider, and Product Relation data.
