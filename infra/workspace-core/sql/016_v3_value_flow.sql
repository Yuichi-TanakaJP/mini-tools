-- Workspace Core V3
-- Value Flow layer.
--
-- A Value Flow represents an end-to-end user/system journey. As-Is and To-Be are
-- modeled as separate Flow Versions so current reality is never overwritten by a proposal.

begin;

create schema if not exists flow;
comment on schema flow is
  'Versioned end-to-end value delivery and human/system handoff flows for Workspace Core.';

revoke all on schema flow from public, anon, authenticated;
grant usage on schema flow to service_role;

create table if not exists flow.value_flows (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text,
  purpose text,
  domain_id uuid references platform.domains(id) on delete set null,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('planned', 'experimental', 'active', 'paused', 'retired')),
  model_status text not null default 'provisional'
    check (model_status in ('provisional', 'confirmed')),
  importance smallint not null default 2
    check (importance between 0 and 5),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table flow.value_flows is
  'Conceptual end-to-end value journeys. Product/Repository is not the primary unit; flows may cross many products and human actions.';

create table if not exists flow.flow_versions (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flow.value_flows(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  variant_type text not null
    check (variant_type in ('as_is', 'proposed', 'experimental', 'retired')),
  label text not null,
  summary text,
  state text not null default 'draft'
    check (state in ('draft', 'active', 'superseded', 'retired')),
  based_on_version_id uuid references flow.flow_versions(id) on delete set null,
  as_of date,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flow_id, version_number),
  check (based_on_version_id is null or based_on_version_id <> id)
);

create unique index if not exists flow_one_active_as_is_version_uidx
  on flow.flow_versions(flow_id)
  where variant_type = 'as_is' and state = 'active';

create table if not exists flow.flow_steps (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references flow.flow_versions(id) on delete cascade,
  step_key text not null,
  label text not null,
  step_type text not null
    check (step_type in (
      'source', 'signal', 'acquire', 'transform', 'store', 'publish', 'deliver', 'touchpoint',
      'human_action', 'investigate', 'deliberate', 'decision', 'execute', 'record', 'reflect', 'outcome'
    )),
  actor_type text not null default 'system'
    check (actor_type in ('system', 'user', 'external_actor', 'mixed')),
  description text,
  sequence_hint integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version_id, step_key),
  unique (id, version_id)
);

create table if not exists flow.flow_edges (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references flow.flow_versions(id) on delete cascade,
  source_step_id uuid not null,
  target_step_id uuid not null,
  edge_type text not null
    check (edge_type in ('system_data', 'system_handoff', 'human_handoff', 'feedback', 'control')),
  label text,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_step_id, version_id)
    references flow.flow_steps(id, version_id) on delete cascade,
  foreign key (target_step_id, version_id)
    references flow.flow_steps(id, version_id) on delete cascade,
  unique (version_id, source_step_id, target_step_id, edge_type),
  check (source_step_id <> target_step_id)
);

comment on table flow.flow_edges is
  'Typed transitions that distinguish machine/data transfer from human handoff and feedback.';

create table if not exists flow.flow_step_products (
  step_id uuid not null references flow.flow_steps(id) on delete cascade,
  product_id uuid not null references registry.products(id) on delete cascade,
  role text not null default 'participant',
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  primary key (step_id, product_id, role)
);

create table if not exists flow.flow_step_product_functions (
  step_id uuid not null references flow.flow_steps(id) on delete cascade,
  product_function_id uuid not null references registry.product_functions(id) on delete cascade,
  role text not null default 'participant',
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  primary key (step_id, product_function_id, role)
);

create table if not exists flow.flow_step_resources (
  step_id uuid not null references flow.flow_steps(id) on delete cascade,
  resource_id uuid not null references registry.external_resources(id) on delete cascade,
  role text not null default 'reference',
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  primary key (step_id, resource_id, role)
);

create table if not exists flow.flow_step_providers (
  step_id uuid not null references flow.flow_steps(id) on delete cascade,
  provider_id uuid not null references registry.service_providers(id) on delete cascade,
  role text not null default 'participant',
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  primary key (step_id, provider_id, role)
);

create table if not exists flow.flow_knowledge_links (
  flow_id uuid not null references flow.value_flows(id) on delete cascade,
  item_id uuid not null references knowledge.items(id) on delete cascade,
  relation_type text not null references knowledge.relation_types(code) on delete restrict,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  primary key (flow_id, item_id, relation_type)
);

create table if not exists flow.flow_outcomes (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flow.value_flows(id) on delete cascade,
  outcome_type text not null
    check (outcome_type in ('user_value', 'system_result', 'learning', 'business')),
  title text not null,
  description text,
  importance smallint not null default 2
    check (importance between 0 and 5),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flow_versions_flow_variant_idx
  on flow.flow_versions(flow_id, variant_type, state);
create index if not exists flow_steps_version_idx
  on flow.flow_steps(version_id, sequence_hint);
create index if not exists flow_edges_version_source_idx
  on flow.flow_edges(version_id, source_step_id);
create index if not exists flow_edges_version_target_idx
  on flow.flow_edges(version_id, target_step_id);
create index if not exists flow_step_products_product_idx
  on flow.flow_step_products(product_id);
create index if not exists flow_step_functions_function_idx
  on flow.flow_step_product_functions(product_function_id);
create index if not exists flow_step_resources_resource_idx
  on flow.flow_step_resources(resource_id);
create index if not exists flow_step_providers_provider_idx
  on flow.flow_step_providers(provider_id);
create index if not exists flow_knowledge_links_item_idx
  on flow.flow_knowledge_links(item_id, relation_type);
create index if not exists flow_outcomes_flow_idx
  on flow.flow_outcomes(flow_id, outcome_type);

alter table flow.value_flows enable row level security;
alter table flow.flow_versions enable row level security;
alter table flow.flow_steps enable row level security;
alter table flow.flow_edges enable row level security;
alter table flow.flow_step_products enable row level security;
alter table flow.flow_step_product_functions enable row level security;
alter table flow.flow_step_resources enable row level security;
alter table flow.flow_step_providers enable row level security;
alter table flow.flow_knowledge_links enable row level security;
alter table flow.flow_outcomes enable row level security;

revoke all on all tables in schema flow from public, anon, authenticated;
revoke all on all sequences in schema flow from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema flow to service_role;
grant usage, select on all sequences in schema flow to service_role;

alter default privileges for role postgres in schema flow revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema flow grant select, insert, update, delete on tables to service_role;

create trigger flow_value_flows_touch_updated_at
before update on flow.value_flows
for each row execute function platform.touch_updated_at();

create trigger flow_versions_touch_updated_at
before update on flow.flow_versions
for each row execute function platform.touch_updated_at();

create trigger flow_steps_touch_updated_at
before update on flow.flow_steps
for each row execute function platform.touch_updated_at();

create trigger flow_edges_touch_updated_at
before update on flow.flow_edges
for each row execute function platform.touch_updated_at();

create trigger flow_outcomes_touch_updated_at
before update on flow.flow_outcomes
for each row execute function platform.touch_updated_at();

commit;
