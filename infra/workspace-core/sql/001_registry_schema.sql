-- Workspace Core V1
--
-- IMPORTANT:
--   This schema is for the future dedicated Workspace Core Supabase project.
--   Do NOT apply it to the existing mini-tools Supabase project.
--
-- Security model (V1):
--   - platform / registry / ops are private custom schemas.
--   - They are not intended to be exposed through the Supabase Data API yet.
--   - anon/authenticated receive no schema privileges.
--   - RLS is enabled as defense in depth; no client policies are created in V1.
--   - service_role / direct database access is the initial integration path.

begin;

create extension if not exists pgcrypto;

create schema if not exists platform;
create schema if not exists registry;
create schema if not exists ops;

comment on schema platform is 'Workspace-wide metadata, source systems, domains, and governance primitives.';
comment on schema registry is 'Structured registry of products, repositories, technologies, services, resources, and their relationships.';
comment on schema ops is 'Synchronization state, import runs, and operational metadata for Workspace Core.';

-- Keep the initial schemas private. If a future UI needs direct Data API access,
-- expose a dedicated API schema or add explicit grants + RLS policies then.
revoke all on schema platform from public, anon, authenticated;
revoke all on schema registry from public, anon, authenticated;
revoke all on schema ops from public, anon, authenticated;

grant usage on schema platform, registry, ops to service_role;

create or replace function platform.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function platform.touch_updated_at() is 'Shared updated_at trigger for Workspace Core tables.';

create table if not exists platform.domains (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('planned', 'active', 'paused', 'retired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table platform.domains is 'Top-level logical domains hosted by Workspace Core. Keeps the project broader than a development-only database.';

create table if not exists platform.source_systems (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  system_type text not null,
  source_of_truth_scope text,
  base_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table platform.source_systems is 'External systems that remain authoritative for their own content, such as GitHub, Notion, and Supabase.';

create table if not exists registry.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  product_type text not null default 'application'
    check (product_type in ('application', 'service', 'automation', 'library', 'infrastructure', 'knowledge', 'experiment', 'other')),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('planned', 'experimental', 'active', 'paused', 'archived', 'unknown')),
  importance smallint not null default 2
    check (importance between 0 and 5),
  domain_id uuid references platform.domains(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table registry.products is 'Human-defined product or durable asset concepts. A product is intentionally not constrained to one repository.';

create table if not exists registry.repositories (
  id uuid primary key default gen_random_uuid(),
  source_system_id uuid not null references platform.source_systems(id) on delete restrict,
  external_id text not null,
  owner_name text not null,
  repo_name text not null,
  full_name text not null,
  visibility text not null default 'private'
    check (visibility in ('public', 'private', 'internal', 'unknown')),
  default_branch text,
  archived boolean not null default false,
  html_url text,
  size_kb bigint,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system_id, external_id),
  unique (source_system_id, full_name)
);

comment on table registry.repositories is 'Repository metadata mirrored from the authoritative SCM. Content, Issues, PRs, and code remain in GitHub.';

create table if not exists registry.product_repositories (
  product_id uuid not null references registry.products(id) on delete cascade,
  repository_id uuid not null references registry.repositories(id) on delete cascade,
  role text not null default 'primary',
  is_primary boolean not null default false,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, repository_id)
);

comment on table registry.product_repositories is 'Many-to-many mapping between products and repositories, including provenance and confidence.';

create table if not exists registry.technologies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  layer text,
  homepage_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists registry.product_technologies (
  product_id uuid not null references registry.products(id) on delete cascade,
  technology_id uuid not null references registry.technologies(id) on delete cascade,
  role text,
  version text,
  source text not null,
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  evidence_uri text,
  last_verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, technology_id)
);

comment on table registry.product_technologies is 'Technology usage with evidence. Auto-detected and manually asserted facts use the same provenance model.';

create table if not exists registry.service_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  homepage_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists registry.service_instances (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references registry.service_providers(id) on delete restrict,
  external_id text,
  name text not null,
  environment text not null default 'production',
  region text,
  url text,
  status text not null default 'active'
    check (status in ('planned', 'active', 'paused', 'retired', 'unknown')),
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, name, environment)
);

create unique index if not exists service_instances_provider_external_id_uidx
  on registry.service_instances(provider_id, external_id)
  where external_id is not null;

comment on table registry.service_instances is 'Concrete projects/deployments/accounts under a provider, e.g. the mini-tools Supabase project.';

create table if not exists registry.product_service_links (
  product_id uuid not null references registry.products(id) on delete cascade,
  service_instance_id uuid not null references registry.service_instances(id) on delete cascade,
  relation_type text not null,
  environment text,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, service_instance_id, relation_type)
);

create table if not exists registry.product_relations (
  source_product_id uuid not null references registry.products(id) on delete cascade,
  target_product_id uuid not null references registry.products(id) on delete cascade,
  relation_type text not null,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_product_id, target_product_id, relation_type),
  check (source_product_id <> target_product_id)
);

comment on table registry.product_relations is 'Directed product dependency/relationship graph such as consumes_api, produces_data_for, or successor_of.';

create table if not exists registry.external_resources (
  id uuid primary key default gen_random_uuid(),
  source_system_id uuid not null references platform.source_systems(id) on delete restrict,
  external_id text not null,
  resource_type text not null,
  title text,
  url text,
  summary text,
  status text,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system_id, external_id, resource_type)
);

comment on table registry.external_resources is 'Pointers and concise structured metadata for Issues, PRs, Notion pages, docs, decisions, and similar external resources. Full bodies are not copied by default.';

create table if not exists registry.product_resources (
  product_id uuid not null references registry.products(id) on delete cascade,
  resource_id uuid not null references registry.external_resources(id) on delete cascade,
  relation_type text not null default 'reference',
  is_primary boolean not null default false,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, resource_id, relation_type)
);

create table if not exists ops.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_system_id uuid references platform.source_systems(id) on delete set null,
  scope text not null,
  status text not null
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_seen integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists ops.source_sync_state (
  source_system_id uuid not null references platform.source_systems(id) on delete cascade,
  resource_kind text not null,
  cursor text,
  status text not null default 'never_run'
    check (status in ('never_run', 'ok', 'partial', 'error')),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (source_system_id, resource_kind)
);

-- Useful indexes for conversational/agent lookups.
create index if not exists repositories_full_name_idx on registry.repositories(full_name);
create index if not exists products_lifecycle_idx on registry.products(lifecycle_status);
create index if not exists product_service_links_relation_idx on registry.product_service_links(relation_type);
create index if not exists product_relations_type_idx on registry.product_relations(relation_type);
create index if not exists external_resources_url_idx on registry.external_resources(url);
create index if not exists sync_runs_started_at_idx on ops.sync_runs(started_at desc);

-- Defense in depth. Because these schemas are private in V1, no anon/authenticated
-- policies are created; service_role and direct privileged DB connections remain usable.
alter table platform.domains enable row level security;
alter table platform.source_systems enable row level security;
alter table registry.products enable row level security;
alter table registry.repositories enable row level security;
alter table registry.product_repositories enable row level security;
alter table registry.technologies enable row level security;
alter table registry.product_technologies enable row level security;
alter table registry.service_providers enable row level security;
alter table registry.service_instances enable row level security;
alter table registry.product_service_links enable row level security;
alter table registry.product_relations enable row level security;
alter table registry.external_resources enable row level security;
alter table registry.product_resources enable row level security;
alter table ops.sync_runs enable row level security;
alter table ops.source_sync_state enable row level security;

-- Keep client roles explicitly locked out even if schema exposure changes accidentally.
revoke all on all tables in schema platform from public, anon, authenticated;
revoke all on all tables in schema registry from public, anon, authenticated;
revoke all on all tables in schema ops from public, anon, authenticated;
revoke all on all sequences in schema platform from public, anon, authenticated;
revoke all on all sequences in schema registry from public, anon, authenticated;
revoke all on all sequences in schema ops from public, anon, authenticated;
revoke execute on function platform.touch_updated_at() from public, anon, authenticated;

grant select, insert, update, delete on all tables in schema platform to service_role;
grant select, insert, update, delete on all tables in schema registry to service_role;
grant select, insert, update, delete on all tables in schema ops to service_role;
grant usage, select on all sequences in schema platform to service_role;
grant usage, select on all sequences in schema registry to service_role;
grant usage, select on all sequences in schema ops to service_role;
grant execute on function platform.touch_updated_at() to service_role;

alter default privileges for role postgres in schema platform revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema registry revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema ops revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema platform grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema registry grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema ops grant select, insert, update, delete on tables to service_role;

-- updated_at triggers
create trigger domains_touch_updated_at
before update on platform.domains
for each row execute function platform.touch_updated_at();

create trigger source_systems_touch_updated_at
before update on platform.source_systems
for each row execute function platform.touch_updated_at();

create trigger products_touch_updated_at
before update on registry.products
for each row execute function platform.touch_updated_at();

create trigger repositories_touch_updated_at
before update on registry.repositories
for each row execute function platform.touch_updated_at();

create trigger product_repositories_touch_updated_at
before update on registry.product_repositories
for each row execute function platform.touch_updated_at();

create trigger technologies_touch_updated_at
before update on registry.technologies
for each row execute function platform.touch_updated_at();

create trigger product_technologies_touch_updated_at
before update on registry.product_technologies
for each row execute function platform.touch_updated_at();

create trigger service_providers_touch_updated_at
before update on registry.service_providers
for each row execute function platform.touch_updated_at();

create trigger service_instances_touch_updated_at
before update on registry.service_instances
for each row execute function platform.touch_updated_at();

create trigger product_service_links_touch_updated_at
before update on registry.product_service_links
for each row execute function platform.touch_updated_at();

create trigger product_relations_touch_updated_at
before update on registry.product_relations
for each row execute function platform.touch_updated_at();

create trigger external_resources_touch_updated_at
before update on registry.external_resources
for each row execute function platform.touch_updated_at();

create trigger product_resources_touch_updated_at
before update on registry.product_resources
for each row execute function platform.touch_updated_at();

create trigger source_sync_state_touch_updated_at
before update on ops.source_sync_state
for each row execute function platform.touch_updated_at();

commit;
