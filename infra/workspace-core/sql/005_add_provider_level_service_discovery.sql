-- Workspace Core V1
-- Add provider-level product/service relationships for evidence-backed cases
-- where the provider is known but a concrete service instance is not yet identified.

begin;

create table if not exists registry.product_service_provider_links (
  product_id uuid not null references registry.products(id) on delete cascade,
  provider_id uuid not null references registry.service_providers(id) on delete cascade,
  relation_type text not null,
  source text not null default 'manual',
  confidence numeric(4,3) not null default 1.000
    check (confidence >= 0 and confidence <= 1),
  evidence_uri text,
  last_verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, provider_id, relation_type)
);

comment on table registry.product_service_provider_links is
  'Evidence-backed product-to-provider relationships used when a concrete service instance is not yet known. Do not create placeholder service instances merely to represent provider usage.';

create index if not exists product_service_provider_links_provider_id_idx
  on registry.product_service_provider_links(provider_id);

alter table registry.product_service_provider_links enable row level security;
revoke all on registry.product_service_provider_links from public, anon, authenticated;
grant select, insert, update, delete on registry.product_service_provider_links to service_role;

create trigger product_service_provider_links_touch_updated_at
before update on registry.product_service_provider_links
for each row execute function platform.touch_updated_at();

commit;
