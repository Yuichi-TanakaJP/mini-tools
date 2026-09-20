-- Workspace Core V3
-- Narrow Product Evolution Evidence reader for pc-saas-health-monitor.
--
-- Security contract:
--   - capability role is NOLOGIN / NOBYPASSRLS
--   - concrete Health Monitor principal is LOGIN / NOBYPASSRLS
--   - only five columns from knowledge.items are selectable
--   - RLS limits rows to active product-evolution-review-* Evidence
--   - no write privileges and no access to other knowledge tables/schemas
--   - password is configured out-of-band and never stored in source control

begin;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'product_evolution_evidence_reader'
  ) then
    create role product_evolution_evidence_reader
      nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'health_monitor_workspace_reader'
  ) then
    create role health_monitor_workspace_reader
      login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
      connection limit 2;
  end if;
end
$$;

grant product_evolution_evidence_reader to health_monitor_workspace_reader;
alter role health_monitor_workspace_reader set search_path = knowledge, pg_catalog;
alter role health_monitor_workspace_reader set default_transaction_read_only = on;

do $$
begin
  execute format(
    'grant connect on database %I to health_monitor_workspace_reader',
    current_database()
  );
end
$$;

grant usage on schema knowledge to product_evolution_evidence_reader;

-- Re-run safe: keep this role column-scoped even if an earlier manual test
-- accidentally granted wider table privileges.
revoke all on table knowledge.items from product_evolution_evidence_reader;
grant select (
  canonical_key,
  lifecycle_status,
  verified_at,
  updated_at,
  created_at
) on table knowledge.items to product_evolution_evidence_reader;

do $$
begin
  if not exists (
    select 1
      from pg_policy
     where polrelid = 'knowledge.items'::regclass
       and polname = 'product_evolution_evidence_reader_select'
  ) then
    create policy product_evolution_evidence_reader_select
      on knowledge.items
      for select
      to product_evolution_evidence_reader
      using (
        canonical_key is not null
        and canonical_key like 'product-evolution-review-%'
        and lifecycle_status = 'active'
      );
  end if;
end
$$;

comment on role product_evolution_evidence_reader is
  'NOLOGIN capability role: read only active Product Evolution Review evidence keys/timestamps.';
comment on role health_monitor_workspace_reader is
  'Health Monitor principal for Product Evolution Review evidence only. Password managed out-of-band.';

commit;
