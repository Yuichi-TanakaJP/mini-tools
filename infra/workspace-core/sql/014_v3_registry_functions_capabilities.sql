-- Workspace Core V3
-- Registry extension: Product Functions and reusable Capabilities.
--
-- Product Function = a durable, value-flow-significant capability inside a Product.
-- Capability = what the developer/system has learned to do and can potentially reuse.
-- Do not use Product Functions as a source-code function inventory.

begin;

create table if not exists registry.product_functions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references registry.products(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  function_type text not null default 'feature'
    check (function_type in ('feature', 'pipeline', 'workflow', 'interface', 'automation', 'module', 'other')),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('planned', 'experimental', 'active', 'paused', 'retired', 'unknown')),
  is_user_facing boolean not null default false,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  evidence_uri text,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, slug)
);

comment on table registry.product_functions is
  'Value-flow-significant Product sub-capabilities such as ranking acquisition, YouTube stock extraction, or Yutai Dashboard. Not a source-code function inventory.';

create table if not exists registry.capabilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table registry.capabilities is
  'Reusable problem-solving capabilities distinct from technologies. Example: authenticated browser data acquisition, not Playwright itself.';

create table if not exists registry.product_capabilities (
  product_id uuid not null references registry.products(id) on delete cascade,
  capability_id uuid not null references registry.capabilities(id) on delete cascade,
  relation_type text not null
    check (relation_type in ('develops', 'uses', 'demonstrates', 'requires')),
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  evidence_uri text,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, capability_id, relation_type)
);

create table if not exists registry.capability_technologies (
  capability_id uuid not null references registry.capabilities(id) on delete cascade,
  technology_id uuid not null references registry.technologies(id) on delete cascade,
  relation_type text not null
    check (relation_type in ('enabled_by', 'implemented_with', 'learned_with')),
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  evidence_uri text,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (capability_id, technology_id, relation_type)
);

create table if not exists registry.capability_assessments (
  id uuid primary key default gen_random_uuid(),
  capability_id uuid not null references registry.capabilities(id) on delete cascade,
  stage text not null
    check (stage in ('exposed', 'experimental', 'applied', 'repeated', 'standardized', 'reusable', 'productized')),
  assessed_at timestamptz not null default now(),
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  rationale text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table registry.capability_assessments is
  'Time-stamped maturity assessments. Current capability maturity is derived from the latest accepted assessment, not stored as a mutable master value.';

create table if not exists registry.capability_assessment_resources (
  assessment_id uuid not null references registry.capability_assessments(id) on delete cascade,
  resource_id uuid not null references registry.external_resources(id) on delete cascade,
  relation_type text not null default 'evidence'
    check (relation_type in ('evidence', 'reference')),
  notes text,
  created_at timestamptz not null default now(),
  primary key (assessment_id, resource_id, relation_type)
);

create index if not exists product_functions_product_id_idx
  on registry.product_functions(product_id);
create index if not exists product_capabilities_capability_id_idx
  on registry.product_capabilities(capability_id);
create index if not exists capability_technologies_technology_id_idx
  on registry.capability_technologies(technology_id);
create index if not exists capability_assessments_capability_time_idx
  on registry.capability_assessments(capability_id, assessed_at desc);
create index if not exists capability_assessment_resources_resource_id_idx
  on registry.capability_assessment_resources(resource_id);

alter table registry.product_functions enable row level security;
alter table registry.capabilities enable row level security;
alter table registry.product_capabilities enable row level security;
alter table registry.capability_technologies enable row level security;
alter table registry.capability_assessments enable row level security;
alter table registry.capability_assessment_resources enable row level security;

revoke all on registry.product_functions from public, anon, authenticated;
revoke all on registry.capabilities from public, anon, authenticated;
revoke all on registry.product_capabilities from public, anon, authenticated;
revoke all on registry.capability_technologies from public, anon, authenticated;
revoke all on registry.capability_assessments from public, anon, authenticated;
revoke all on registry.capability_assessment_resources from public, anon, authenticated;

grant select, insert, update, delete on registry.product_functions to service_role;
grant select, insert, update, delete on registry.capabilities to service_role;
grant select, insert, update, delete on registry.product_capabilities to service_role;
grant select, insert, update, delete on registry.capability_technologies to service_role;
grant select, insert, update, delete on registry.capability_assessments to service_role;
grant select, insert, update, delete on registry.capability_assessment_resources to service_role;

create trigger product_functions_touch_updated_at
before update on registry.product_functions
for each row execute function platform.touch_updated_at();

create trigger capabilities_touch_updated_at
before update on registry.capabilities
for each row execute function platform.touch_updated_at();

create trigger product_capabilities_touch_updated_at
before update on registry.product_capabilities
for each row execute function platform.touch_updated_at();

create trigger capability_technologies_touch_updated_at
before update on registry.capability_technologies
for each row execute function platform.touch_updated_at();

commit;
