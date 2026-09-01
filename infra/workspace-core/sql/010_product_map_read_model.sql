-- Workspace Core Product Map V1 read model.
--
-- Keeps registry private while exposing a narrow set of SECURITY INVOKER views
-- through the already-exposed public schema. Only service_role may SELECT them.
-- Browser clients must never receive the service-role key; mini-tools reads these
-- views from server-only code and returns only the JSON required by Product Map.

begin;

-- service_role is the only runtime role allowed to traverse the private registry.
grant usage on schema registry to service_role;
grant select on table
  registry.products,
  registry.repositories,
  registry.product_repositories,
  registry.technologies,
  registry.product_technologies,
  registry.service_providers,
  registry.service_instances,
  registry.product_service_links,
  registry.product_service_provider_links,
  registry.product_relations
  to service_role;

create or replace view public.workspace_core_product_summary_v
with (security_invoker = true)
as
select
  p.id as product_id,
  p.slug,
  p.name,
  p.description,
  p.product_type,
  p.lifecycle_status,
  p.importance,
  p.updated_at,
  (
    select count(*)::integer
    from registry.product_repositories pr
    where pr.product_id = p.id
  ) as repository_count,
  (
    select count(*)::integer
    from registry.product_technologies pt
    where pt.product_id = p.id
  ) as technology_count,
  (
    select count(distinct provider_id)::integer
    from (
      select pspl.provider_id
      from registry.product_service_provider_links pspl
      where pspl.product_id = p.id
      union all
      select si.provider_id
      from registry.product_service_links psl
      join registry.service_instances si on si.id = psl.service_instance_id
      where psl.product_id = p.id
    ) providers
  ) as provider_count,
  (
    (select count(*) from registry.product_relations rel where rel.source_product_id = p.id) +
    (select count(*) from registry.product_relations rel where rel.target_product_id = p.id)
  )::integer as relation_count
from registry.products p;

create or replace view public.workspace_core_product_repository_v
with (security_invoker = true)
as
select
  p.slug as product_slug,
  r.id as repository_id,
  r.full_name,
  r.visibility,
  r.default_branch,
  r.archived,
  r.html_url,
  pr.role,
  pr.is_primary,
  pr.source,
  pr.confidence,
  pr.verified_at,
  pr.notes
from registry.product_repositories pr
join registry.products p on p.id = pr.product_id
join registry.repositories r on r.id = pr.repository_id;

create or replace view public.workspace_core_product_technology_v
with (security_invoker = true)
as
select
  p.slug as product_slug,
  t.id as technology_id,
  t.slug as technology_slug,
  t.name as technology_name,
  t.category,
  t.layer,
  pt.role,
  pt.version,
  pt.source,
  pt.confidence,
  pt.evidence_uri,
  pt.last_verified_at,
  pt.notes
from registry.product_technologies pt
join registry.products p on p.id = pt.product_id
join registry.technologies t on t.id = pt.technology_id;

create or replace view public.workspace_core_product_provider_v
with (security_invoker = true)
as
select
  p.slug as product_slug,
  sp.id as provider_id,
  sp.slug as provider_slug,
  sp.name as provider_name,
  sp.category as provider_category,
  pspl.relation_type,
  pspl.source,
  pspl.confidence,
  pspl.evidence_uri,
  pspl.last_verified_at,
  pspl.notes
from registry.product_service_provider_links pspl
join registry.products p on p.id = pspl.product_id
join registry.service_providers sp on sp.id = pspl.provider_id;

create or replace view public.workspace_core_product_instance_v
with (security_invoker = true)
as
select
  p.slug as product_slug,
  sp.slug as provider_slug,
  sp.name as provider_name,
  si.id as service_instance_id,
  si.external_id,
  si.name as instance_name,
  si.account_scope,
  si.environment,
  si.region,
  si.url,
  si.status,
  psl.relation_type,
  psl.source,
  psl.confidence,
  psl.verified_at,
  psl.notes
from registry.product_service_links psl
join registry.products p on p.id = psl.product_id
join registry.service_instances si on si.id = psl.service_instance_id
join registry.service_providers sp on sp.id = si.provider_id;

create or replace view public.workspace_core_product_relation_v
with (security_invoker = true)
as
select
  src.slug as source_product_slug,
  src.name as source_product_name,
  dst.slug as target_product_slug,
  dst.name as target_product_name,
  rel.relation_type,
  rel.source,
  rel.confidence,
  rel.verified_at,
  rel.notes
from registry.product_relations rel
join registry.products src on src.id = rel.source_product_id
join registry.products dst on dst.id = rel.target_product_id;

-- Supabase projects may have permissive default privileges in public. Make the
-- intended surface explicit after every CREATE/REPLACE VIEW.
revoke all on table
  public.workspace_core_product_summary_v,
  public.workspace_core_product_repository_v,
  public.workspace_core_product_technology_v,
  public.workspace_core_product_provider_v,
  public.workspace_core_product_instance_v,
  public.workspace_core_product_relation_v
  from public, anon, authenticated;

grant select on table
  public.workspace_core_product_summary_v,
  public.workspace_core_product_repository_v,
  public.workspace_core_product_technology_v,
  public.workspace_core_product_provider_v,
  public.workspace_core_product_instance_v,
  public.workspace_core_product_relation_v
  to service_role;

comment on view public.workspace_core_product_summary_v is
  'Workspace Core Product Map read model. Server-only service_role access.';
comment on view public.workspace_core_product_repository_v is
  'Workspace Core Product to Repository read model. Server-only service_role access.';
comment on view public.workspace_core_product_technology_v is
  'Workspace Core Product to Technology read model with provenance. Server-only service_role access.';
comment on view public.workspace_core_product_provider_v is
  'Workspace Core Product to provider-level service read model with provenance. Server-only service_role access.';
comment on view public.workspace_core_product_instance_v is
  'Workspace Core Product to concrete service instance read model. Server-only service_role access.';
comment on view public.workspace_core_product_relation_v is
  'Workspace Core Product dependency/content/workflow relation read model. Server-only service_role access.';

commit;
