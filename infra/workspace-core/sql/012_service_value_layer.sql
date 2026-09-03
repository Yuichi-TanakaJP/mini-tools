-- Workspace Core V2
-- Service / user-value layer.
--
-- IMPORTANT TERMINOLOGY:
--   registry.service_offerings = a user-value delivery unit composed from one or more Products.
--   registry.service_providers / service_instances = infrastructure/SaaS providers and runtime instances.
--   These concepts are intentionally separate.

begin;

create table if not exists registry.service_offerings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text,
  target_user text,
  user_job text,
  value_proposition text,
  expected_outcome text,
  stage text not null default 'idea'
    check (stage in ('idea', 'prototype', 'internal', 'public', 'monetizing', 'retired')),
  importance smallint not null default 2
    check (importance between 0 and 5),
  model_status text not null default 'provisional'
    check (model_status in ('provisional', 'confirmed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table registry.service_offerings is
  'User-value delivery units. A Service is defined by who receives what value, and may be composed from multiple Products. Do not confuse with infrastructure service providers.';

create table if not exists registry.service_products (
  service_id uuid not null references registry.service_offerings(id) on delete cascade,
  product_id uuid not null references registry.products(id) on delete cascade,
  role text not null,
  contribution text,
  is_primary boolean not null default false,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  evidence_uri text,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (service_id, product_id)
);

comment on table registry.service_products is
  'Many-to-many mapping from value-delivery Services to Products, with each Product contribution role and provenance.';

create table if not exists registry.service_delivery_modes (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references registry.service_offerings(id) on delete cascade,
  product_id uuid references registry.products(id) on delete set null,
  mode text not null,
  label text not null,
  description text,
  touchpoint text,
  is_user_facing boolean not null default true,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  evidence_uri text,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, mode, product_id)
);

comment on table registry.service_delivery_modes is
  'How a Service reaches its user, such as Web/Dashboard, API/Data, Automation, Content, Internal Tool, Template, or AI Workflow.';

create index if not exists service_products_product_id_idx
  on registry.service_products(product_id);
create index if not exists service_delivery_modes_service_id_idx
  on registry.service_delivery_modes(service_id);
create index if not exists service_delivery_modes_product_id_idx
  on registry.service_delivery_modes(product_id)
  where product_id is not null;

alter table registry.service_offerings enable row level security;
alter table registry.service_products enable row level security;
alter table registry.service_delivery_modes enable row level security;

revoke all on registry.service_offerings from public, anon, authenticated;
revoke all on registry.service_products from public, anon, authenticated;
revoke all on registry.service_delivery_modes from public, anon, authenticated;

grant select, insert, update, delete on registry.service_offerings to service_role;
grant select, insert, update, delete on registry.service_products to service_role;
grant select, insert, update, delete on registry.service_delivery_modes to service_role;

create trigger service_offerings_touch_updated_at
before update on registry.service_offerings
for each row execute function platform.touch_updated_at();

create trigger service_products_touch_updated_at
before update on registry.service_products
for each row execute function platform.touch_updated_at();

create trigger service_delivery_modes_touch_updated_at
before update on registry.service_delivery_modes
for each row execute function platform.touch_updated_at();

create or replace view public.workspace_core_service_summary_v
with (security_invoker = true)
as
select
  s.id as service_id,
  s.slug,
  s.name,
  s.summary,
  s.target_user,
  s.user_job,
  s.value_proposition,
  s.expected_outcome,
  s.stage,
  s.importance,
  s.model_status,
  s.updated_at,
  (
    select count(*)::integer
    from registry.service_products sp
    where sp.service_id = s.id
  ) as product_count,
  (
    select count(*)::integer
    from registry.service_delivery_modes sdm
    where sdm.service_id = s.id
  ) as delivery_mode_count
from registry.service_offerings s;

create or replace view public.workspace_core_service_product_v
with (security_invoker = true)
as
select
  s.slug as service_slug,
  s.name as service_name,
  p.slug as product_slug,
  p.name as product_name,
  sp.role,
  sp.contribution,
  sp.is_primary,
  sp.source,
  sp.confidence,
  sp.evidence_uri,
  sp.verified_at,
  sp.notes
from registry.service_products sp
join registry.service_offerings s on s.id = sp.service_id
join registry.products p on p.id = sp.product_id;

create or replace view public.workspace_core_service_delivery_v
with (security_invoker = true)
as
select
  s.slug as service_slug,
  s.name as service_name,
  p.slug as product_slug,
  p.name as product_name,
  sdm.mode,
  sdm.label,
  sdm.description,
  sdm.touchpoint,
  sdm.is_user_facing,
  sdm.source,
  sdm.confidence,
  sdm.evidence_uri,
  sdm.verified_at,
  sdm.notes
from registry.service_delivery_modes sdm
join registry.service_offerings s on s.id = sdm.service_id
left join registry.products p on p.id = sdm.product_id;

revoke all on table
  public.workspace_core_service_summary_v,
  public.workspace_core_service_product_v,
  public.workspace_core_service_delivery_v
from public, anon, authenticated;

grant select on table
  public.workspace_core_service_summary_v,
  public.workspace_core_service_product_v,
  public.workspace_core_service_delivery_v
to service_role;

comment on view public.workspace_core_service_summary_v is
  'Workspace Core Service/value summary read model. Server-only service_role access.';
comment on view public.workspace_core_service_product_v is
  'Workspace Core Service-to-Product composition read model with provenance. Server-only service_role access.';
comment on view public.workspace_core_service_delivery_v is
  'Workspace Core Service delivery-mode/touchpoint read model with provenance. Server-only service_role access.';

commit;
