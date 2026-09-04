-- Workspace Core V3
-- Knowledge / Meaning and Evolution / History layers.
--
-- Canonical knowledge is separated from raw source text and future AI inference proposals.
-- External long-form content remains in its authoritative system and is referenced through
-- registry.external_resources.

begin;

create schema if not exists knowledge;
comment on schema knowledge is
  'Canonical semantic knowledge and time-aware evolution history for Workspace Core. Raw source text remains in authoritative external systems.';

revoke all on schema knowledge from public, anon, authenticated;
grant usage on schema knowledge to service_role;

create table if not exists knowledge.relation_types (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into knowledge.relation_types (code, name, description)
values
  ('motivates', 'Motivates', 'The source motivates or creates demand for the target.'),
  ('addresses', 'Addresses', 'The source is intended to address the target problem or need.'),
  ('informs', 'Informs', 'The source materially informs the target.'),
  ('constrains', 'Constrains', 'The source limits or governs the target.'),
  ('supports', 'Supports', 'The source supports the target.'),
  ('contradicts', 'Contradicts', 'The source conflicts with the target.'),
  ('refines', 'Refines', 'The source narrows or improves the target.'),
  ('led_to', 'Led to', 'The source led to the target.'),
  ('derived_from', 'Derived from', 'The source was derived from the target.'),
  ('reusable_for', 'Reusable for', 'The source can be reused for the target.'),
  ('applies_to', 'Applies to', 'The source applies to the target.'),
  ('origin_of', 'Origin of', 'The source is an origin of the target.'),
  ('inspired_by', 'Inspired by', 'The source idea/knowledge was inspired by the target resource or concept.'),
  ('evidenced_by', 'Evidenced by', 'The source claim is evidenced by the target resource.'),
  ('references', 'References', 'The source references the target.'),
  ('realized_by', 'Realized by', 'The source value or goal is realized by the target.'),
  ('enabled_by', 'Enabled by', 'The source is enabled by the target.')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

create table if not exists knowledge.items (
  id uuid primary key default gen_random_uuid(),
  canonical_key text unique,
  kind text not null
    check (kind in ('problem', 'principle', 'insight', 'idea', 'goal', 'value', 'pattern', 'hypothesis', 'constraint')),
  title text not null,
  statement text not null,
  domain_id uuid references platform.domains(id) on delete set null,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'superseded', 'retired')),
  verification_status text not null default 'provisional'
    check (verification_status in ('provisional', 'confirmed')),
  supersedes_item_id uuid references knowledge.items(id) on delete set null,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (supersedes_item_id is null or supersedes_item_id <> id)
);

comment on table knowledge.items is
  'Accepted semantic units such as problems, principles, insights, ideas, goals, values, patterns, hypotheses, and constraints. Raw transcripts and diary bodies are not stored here.';

create table if not exists knowledge.item_relations (
  source_item_id uuid not null references knowledge.items(id) on delete cascade,
  target_item_id uuid not null references knowledge.items(id) on delete cascade,
  relation_type text not null references knowledge.relation_types(code) on delete restrict,
  rationale text,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_item_id, target_item_id, relation_type),
  check (source_item_id <> target_item_id)
);

create table if not exists knowledge.item_products (
  item_id uuid not null references knowledge.items(id) on delete cascade,
  product_id uuid not null references registry.products(id) on delete cascade,
  relation_type text not null references knowledge.relation_types(code) on delete restrict,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, product_id, relation_type)
);

create table if not exists knowledge.item_product_functions (
  item_id uuid not null references knowledge.items(id) on delete cascade,
  product_function_id uuid not null references registry.product_functions(id) on delete cascade,
  relation_type text not null references knowledge.relation_types(code) on delete restrict,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, product_function_id, relation_type)
);

create table if not exists knowledge.item_capabilities (
  item_id uuid not null references knowledge.items(id) on delete cascade,
  capability_id uuid not null references registry.capabilities(id) on delete cascade,
  relation_type text not null references knowledge.relation_types(code) on delete restrict,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, capability_id, relation_type)
);

create table if not exists knowledge.item_technologies (
  item_id uuid not null references knowledge.items(id) on delete cascade,
  technology_id uuid not null references registry.technologies(id) on delete cascade,
  relation_type text not null references knowledge.relation_types(code) on delete restrict,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, technology_id, relation_type)
);

create table if not exists knowledge.item_resources (
  item_id uuid not null references knowledge.items(id) on delete cascade,
  resource_id uuid not null references registry.external_resources(id) on delete cascade,
  relation_type text not null references knowledge.relation_types(code) on delete restrict,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, resource_id, relation_type)
);

create table if not exists knowledge.evolution_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in (
      'origin', 'problem_discovered', 'idea_formed', 'experiment_started',
      'technology_adopted', 'capability_gained', 'milestone', 'pivot',
      'integration', 'workflow_changed', 'gap_discovered', 'lesson_learned', 'deprecated'
    )),
  title text not null,
  summary text,
  period_start date,
  period_end date,
  time_precision text not null default 'unknown'
    check (time_precision in ('day', 'month', 'quarter', 'year', 'range', 'unknown')),
  verification_status text not null default 'provisional'
    check (verification_status in ('provisional', 'confirmed')),
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (time_precision = 'unknown' and period_start is null and period_end is null)
    or
    (time_precision <> 'unknown' and period_start is not null and period_end is not null and period_end >= period_start)
  )
);

comment on table knowledge.evolution_events is
  'Time-aware development/product evolution events. Approximate dates use bounded periods instead of inventing false exact timestamps.';

create table if not exists knowledge.evolution_event_relations (
  source_event_id uuid not null references knowledge.evolution_events(id) on delete cascade,
  target_event_id uuid not null references knowledge.evolution_events(id) on delete cascade,
  relation_type text not null
    check (relation_type in ('led_to', 'enabled', 'triggered', 'followed_by', 'supersedes', 'blocked_by')),
  rationale text,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_event_id, target_event_id, relation_type),
  check (source_event_id <> target_event_id)
);

create table if not exists knowledge.evolution_event_products (
  event_id uuid not null references knowledge.evolution_events(id) on delete cascade,
  product_id uuid not null references registry.products(id) on delete cascade,
  role text not null default 'subject'
    check (role in ('subject', 'context', 'cause', 'result')),
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  primary key (event_id, product_id, role)
);

create table if not exists knowledge.evolution_event_product_functions (
  event_id uuid not null references knowledge.evolution_events(id) on delete cascade,
  product_function_id uuid not null references registry.product_functions(id) on delete cascade,
  role text not null default 'subject'
    check (role in ('subject', 'context', 'cause', 'result')),
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  primary key (event_id, product_function_id, role)
);

create table if not exists knowledge.evolution_event_capabilities (
  event_id uuid not null references knowledge.evolution_events(id) on delete cascade,
  capability_id uuid not null references registry.capabilities(id) on delete cascade,
  role text not null default 'subject'
    check (role in ('subject', 'context', 'cause', 'result')),
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  primary key (event_id, capability_id, role)
);

create table if not exists knowledge.evolution_event_technologies (
  event_id uuid not null references knowledge.evolution_events(id) on delete cascade,
  technology_id uuid not null references registry.technologies(id) on delete cascade,
  role text not null default 'subject'
    check (role in ('subject', 'context', 'cause', 'result')),
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  primary key (event_id, technology_id, role)
);

create table if not exists knowledge.evolution_event_items (
  event_id uuid not null references knowledge.evolution_events(id) on delete cascade,
  item_id uuid not null references knowledge.items(id) on delete cascade,
  role text not null default 'context'
    check (role in ('subject', 'context', 'cause', 'result')),
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  primary key (event_id, item_id, role)
);

create table if not exists knowledge.evolution_event_resources (
  event_id uuid not null references knowledge.evolution_events(id) on delete cascade,
  resource_id uuid not null references registry.external_resources(id) on delete cascade,
  relation_type text not null default 'evidence'
    check (relation_type in ('evidence', 'origin', 'reference')),
  notes text,
  created_at timestamptz not null default now(),
  primary key (event_id, resource_id, relation_type)
);

create index if not exists knowledge_items_kind_status_idx
  on knowledge.items(kind, lifecycle_status);
create index if not exists knowledge_item_relations_target_idx
  on knowledge.item_relations(target_item_id, relation_type);
create index if not exists knowledge_item_products_product_idx
  on knowledge.item_products(product_id, relation_type);
create index if not exists knowledge_item_functions_function_idx
  on knowledge.item_product_functions(product_function_id, relation_type);
create index if not exists knowledge_item_capabilities_capability_idx
  on knowledge.item_capabilities(capability_id, relation_type);
create index if not exists knowledge_item_technologies_technology_idx
  on knowledge.item_technologies(technology_id, relation_type);
create index if not exists knowledge_item_resources_resource_idx
  on knowledge.item_resources(resource_id, relation_type);
create index if not exists evolution_events_period_idx
  on knowledge.evolution_events(period_start, period_end);
create index if not exists evolution_event_products_product_idx
  on knowledge.evolution_event_products(product_id);
create index if not exists evolution_event_functions_function_idx
  on knowledge.evolution_event_product_functions(product_function_id);
create index if not exists evolution_event_capabilities_capability_idx
  on knowledge.evolution_event_capabilities(capability_id);
create index if not exists evolution_event_technologies_technology_idx
  on knowledge.evolution_event_technologies(technology_id);
create index if not exists evolution_event_items_item_idx
  on knowledge.evolution_event_items(item_id);
create index if not exists evolution_event_resources_resource_idx
  on knowledge.evolution_event_resources(resource_id);

alter table knowledge.relation_types enable row level security;
alter table knowledge.items enable row level security;
alter table knowledge.item_relations enable row level security;
alter table knowledge.item_products enable row level security;
alter table knowledge.item_product_functions enable row level security;
alter table knowledge.item_capabilities enable row level security;
alter table knowledge.item_technologies enable row level security;
alter table knowledge.item_resources enable row level security;
alter table knowledge.evolution_events enable row level security;
alter table knowledge.evolution_event_relations enable row level security;
alter table knowledge.evolution_event_products enable row level security;
alter table knowledge.evolution_event_product_functions enable row level security;
alter table knowledge.evolution_event_capabilities enable row level security;
alter table knowledge.evolution_event_technologies enable row level security;
alter table knowledge.evolution_event_items enable row level security;
alter table knowledge.evolution_event_resources enable row level security;

revoke all on all tables in schema knowledge from public, anon, authenticated;
revoke all on all sequences in schema knowledge from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema knowledge to service_role;
grant usage, select on all sequences in schema knowledge to service_role;

alter default privileges for role postgres in schema knowledge revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema knowledge grant select, insert, update, delete on tables to service_role;

create trigger knowledge_relation_types_touch_updated_at
before update on knowledge.relation_types
for each row execute function platform.touch_updated_at();

create trigger knowledge_items_touch_updated_at
before update on knowledge.items
for each row execute function platform.touch_updated_at();

create trigger knowledge_item_relations_touch_updated_at
before update on knowledge.item_relations
for each row execute function platform.touch_updated_at();

create trigger knowledge_item_products_touch_updated_at
before update on knowledge.item_products
for each row execute function platform.touch_updated_at();

create trigger knowledge_item_product_functions_touch_updated_at
before update on knowledge.item_product_functions
for each row execute function platform.touch_updated_at();

create trigger knowledge_item_capabilities_touch_updated_at
before update on knowledge.item_capabilities
for each row execute function platform.touch_updated_at();

create trigger knowledge_item_technologies_touch_updated_at
before update on knowledge.item_technologies
for each row execute function platform.touch_updated_at();

create trigger knowledge_item_resources_touch_updated_at
before update on knowledge.item_resources
for each row execute function platform.touch_updated_at();

create trigger knowledge_evolution_events_touch_updated_at
before update on knowledge.evolution_events
for each row execute function platform.touch_updated_at();

create trigger knowledge_evolution_event_relations_touch_updated_at
before update on knowledge.evolution_event_relations
for each row execute function platform.touch_updated_at();

commit;
