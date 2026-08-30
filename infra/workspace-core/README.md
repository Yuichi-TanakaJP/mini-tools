# Workspace Core Supabase

This directory contains the bootstrap design for the **future second Supabase project** used as a personal structured control plane.

It is deliberately **not** named `product-db` or `dev-db`. The project should be able to host additional domains later without making development inventory the root concept.

## Boundary

```text
Workspace Core Supabase project
├─ platform   # source systems, domains, shared metadata/governance primitives
├─ registry   # V1: products, repos, technologies, services, resources, relations
├─ ops        # sync/import state
└─ future     # knowledge / automation / research / other domains as needed
```

Only the first three schemas are created in V1. Future schemas should be added only when an actual use case exists.

## Source-of-truth policy

Workspace Core is a **catalog and relationship graph**, not a content warehouse.

- GitHub stays authoritative for code, repositories, Issues, PRs, Actions, and repository metadata.
- Supabase projects stay authoritative for their operational database state.
- Notion can remain a source/archive for long-form text and historical notes when the original lives there, but it is not required to be the daily human UI.
- Runtime platforms such as Vercel / Google Cloud / Cloudflare remain authoritative for their live deployment configuration.
- ChatGPT is expected to become the primary conversational interface that traverses these systems.

Workspace Core stores structured identity, location, relationship, provenance, confidence, and sync metadata so an agent can answer questions such as:

- Which products use Supabase?
- Which repositories belong to this product?
- What consumes the Market Info API?
- Which services would be affected if a provider is unavailable?
- Where is the original design note / Issue / decision for this product?

## Security model (V1)

`platform`, `registry`, and `ops` are private custom schemas.

V1 intentionally does **not** expose them to `anon` or `authenticated` through the Supabase Data API. RLS is enabled as defense in depth, but no client policies are created yet.

Initial access is intended through:

1. Supabase management/database tooling used by ChatGPT or development agents.
2. Server-side service access when a sync/import job is introduced.

If mini-tools later needs browser/client access, prefer a small dedicated `api` schema or server route rather than exposing the entire registry directly.

Never store secrets, API keys, passwords, access tokens, service-role keys, or private credentials in registry metadata.

## Files

- `sql/001_registry_schema.sql`
  - creates `platform`, `registry`, and `ops`
  - creates the V1 tables, constraints, indexes, RLS, and private grants
- `sql/002_seed_sources_and_repositories.sql`
  - seeds source systems / service providers
  - records the verified existing mini-tools Supabase service instance
  - imports the 20 GitHub repositories discovered on 2026-08-30
- `sql/003_seed_products_provisional.sql`
  - creates an initial Product layer separately from repository facts
  - explicitly marks Product classifications as provisional
  - links known multi-repository products (`todo-app`, `market-info`)
  - adds verified mini-tools relationships supported by current repository configuration

## Bootstrap order

Do not apply these files to the existing `mini-tools` Supabase project.

After the dedicated Workspace Core project is explicitly created:

1. Apply `001_registry_schema.sql`.
2. Verify schemas/tables and run Supabase security/performance advisors.
3. Apply `002_seed_sources_and_repositories.sql`.
4. Verify exactly 20 GitHub repository rows are present.
5. Review provisional Product classification.
6. Apply `003_seed_products_provisional.sql`.
7. Verify Product ↔ Repository and Product ↔ Service relations.
8. Only then begin technology/service auto-discovery.

## V1 acceptance checks

```sql
select count(*) from registry.repositories;
-- expected: 20 immediately after the initial GitHub seed

select count(*) from registry.products;
-- expected: 18 after provisional product seed

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
```

## Non-goals for V1

- Copying all Notion page bodies into Supabase.
- Copying all GitHub Issue / PR bodies into Supabase.
- Storing secrets.
- Two-way sync with every provider.
- A generic EAV database for arbitrary future data.
- Building a separate UI before the registry proves useful through agent queries.

## Next implementation step

After database bootstrap, implement the first discovery loop:

1. GitHub repository sync.
2. Manifest/config inspection (`package.json`, lockfiles, Python dependency files, Dockerfiles, workflows, env examples).
3. Evidence-backed `product_technologies` / service link upserts.
4. Optional mini-tools Product Map UI once the graph contains enough useful relations.
