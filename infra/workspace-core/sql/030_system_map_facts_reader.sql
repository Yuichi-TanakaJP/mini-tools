-- Workspace Core V3
-- Narrow System Map reviewed-facts reader for pc-saas-health-monitor.
--
-- Security contract:
--   - capability role is NOLOGIN / NOBYPASSRLS
--   - concrete System Map principal is LOGIN / NOBYPASSRLS
--   - Product Evolution reader roles from migration 029 are not modified
--   - only explicitly listed columns from four registry/flow tables are selectable
--   - row policies fail closed on the currently known lifecycle/model/relation vocabularies
--   - unknown membership, ownership, direct ACL, or role-targeted policy state aborts
--   - password is configured out-of-band and never stored in source control
--
-- Known vocabularies were read from the live Workspace Core catalog on 2026-09-23.
-- New lifecycle/model/relation values remain invisible until this contract is reviewed.

begin;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'system_map_facts_reader'
  ) then
    create role system_map_facts_reader
      nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
      connection limit -1;
  end if;

  if not exists (
    select 1 from pg_roles where rolname = 'health_monitor_system_map_reader'
  ) then
    create role health_monitor_system_map_reader
      login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
      connection limit 2;
  end if;
end
$$;

do $$
declare
  capability record;
  principal record;
begin
  select * into strict capability
  from pg_roles
  where rolname = 'system_map_facts_reader';

  if capability.rolcanlogin
     or not capability.rolinherit
     or capability.rolsuper
     or capability.rolcreatedb
     or capability.rolcreaterole
     or capability.rolreplication
     or capability.rolbypassrls
     or capability.rolconnlimit <> -1 then
    raise exception 'existing System Map capability role attributes do not match the security contract';
  end if;

  select * into strict principal
  from pg_roles
  where rolname = 'health_monitor_system_map_reader';

  if not principal.rolcanlogin
     or not principal.rolinherit
     or principal.rolsuper
     or principal.rolcreatedb
     or principal.rolcreaterole
     or principal.rolreplication
     or principal.rolbypassrls
     or principal.rolconnlimit <> 2 then
    raise exception 'existing System Map principal role attributes do not match the security contract';
  end if;
end
$$;

alter role system_map_facts_reader reset all;
alter role health_monitor_system_map_reader reset all;
alter role health_monitor_system_map_reader set search_path = registry, flow, pg_catalog;
alter role health_monitor_system_map_reader set default_transaction_read_only = on;

-- Remove only state owned by this migration. Migration 029's Product Evolution
-- reader and its principal are deliberately untouched.
revoke system_map_facts_reader from health_monitor_system_map_reader;

drop policy if exists system_map_facts_reader_products_select on registry.products;
drop policy if exists system_map_facts_reader_products_restrict on registry.products;
drop policy if exists system_map_facts_reader_product_relations_select on registry.product_relations;
drop policy if exists system_map_facts_reader_product_relations_restrict on registry.product_relations;
drop policy if exists system_map_facts_reader_value_flows_select on flow.value_flows;
drop policy if exists system_map_facts_reader_value_flows_restrict on flow.value_flows;
drop policy if exists system_map_facts_reader_flow_versions_select on flow.flow_versions;
drop policy if exists system_map_facts_reader_flow_versions_restrict on flow.flow_versions;

revoke all privileges on table
  registry.products,
  registry.product_relations,
  flow.value_flows,
  flow.flow_versions
from system_map_facts_reader, health_monitor_system_map_reader;

revoke usage on schema registry, flow
from system_map_facts_reader, health_monitor_system_map_reader;

do $$
declare
  target record;
  columns_sql text;
begin
  for target in
    select c.oid,
           format('%I.%I', n.nspname, c.relname) as qualified_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where (n.nspname, c.relname) in (
      ('registry', 'products'),
      ('registry', 'product_relations'),
      ('flow', 'value_flows'),
      ('flow', 'flow_versions')
    )
  loop
    select string_agg(format('%I', attname), ', ' order by attnum)
      into columns_sql
    from pg_attribute
    where attrelid = target.oid
      and attnum > 0
      and not attisdropped;

    if columns_sql is not null then
      execute format(
        'revoke select (%1$s) on table %2$s from system_map_facts_reader, health_monitor_system_map_reader',
        columns_sql,
        target.qualified_name
      );
      execute format(
        'revoke insert (%1$s) on table %2$s from system_map_facts_reader, health_monitor_system_map_reader',
        columns_sql,
        target.qualified_name
      );
      execute format(
        'revoke update (%1$s) on table %2$s from system_map_facts_reader, health_monitor_system_map_reader',
        columns_sql,
        target.qualified_name
      );
      execute format(
        'revoke references (%1$s) on table %2$s from system_map_facts_reader, health_monitor_system_map_reader',
        columns_sql,
        target.qualified_name
      );
    end if;
  end loop;
end
$$;

do $$
begin
  execute format(
    'revoke connect on database %I from system_map_facts_reader, health_monitor_system_map_reader',
    current_database()
  );
end
$$;

-- Abort instead of preserving partial/manual experiments on either dedicated
-- role. PostgreSQL 17 may automatically grant role-management authority back
-- to the CREATEROLE creator; that management-only membership is allowed.
do $$
declare
  capability_oid oid := 'system_map_facts_reader'::regrole;
  principal_oid oid := 'health_monitor_system_map_reader'::regrole;
  detail text;
begin
  select string_agg(
           format(
             '%s -> %s [admin=%s inherit=%s set=%s]',
             member_role.rolname,
             granted_role.rolname,
             m.admin_option,
             m.inherit_option,
             m.set_option
           ),
           '; ' order by member_role.rolname, granted_role.rolname
         )
    into detail
  from pg_auth_members m
  join pg_roles granted_role on granted_role.oid = m.roleid
  join pg_roles member_role on member_role.oid = m.member
  where (
      m.member in (capability_oid, principal_oid)
      or m.roleid in (capability_oid, principal_oid)
    )
    and not (
      m.member = current_user::regrole
      and m.roleid in (capability_oid, principal_oid)
      and m.admin_option
      and not m.inherit_option
      and not m.set_option
    );

  if detail is not null then
    raise exception 'unexpected role membership on System Map reader roles: %', detail;
  end if;

  select string_agg(
           format('dbid=%s class=%s objid=%s deptype=%s', dbid, classid::regclass, objid, deptype),
           '; ' order by dbid, classid::regclass::text, objid
         )
    into detail
  from pg_shdepend
  where refclassid = 'pg_authid'::regclass
    and refobjid in (capability_oid, principal_oid)
    and deptype in ('a', 'o');

  if detail is not null then
    raise exception 'unexpected ownership/direct ACL on System Map reader roles: %', detail;
  end if;

  select string_agg(
           format('%s.%s policy=%s', n.nspname, c.relname, p.polname),
           '; ' order by n.nspname, c.relname, p.polname
         )
    into detail
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where capability_oid = any(p.polroles)
     or principal_oid = any(p.polroles);

  if detail is not null then
    raise exception 'unexpected RLS policy targets System Map reader roles: %', detail;
  end if;
end
$$;

grant system_map_facts_reader
  to health_monitor_system_map_reader
  with admin false, inherit true, set false;

do $$
begin
  execute format(
    'grant connect on database %I to health_monitor_system_map_reader',
    current_database()
  );
end
$$;

grant usage on schema registry, flow to system_map_facts_reader;

grant select (
  id,
  slug,
  name,
  product_type,
  lifecycle_status,
  importance
) on table registry.products to system_map_facts_reader;

grant select (
  source_product_id,
  target_product_id,
  relation_type,
  confidence,
  verified_at
) on table registry.product_relations to system_map_facts_reader;

grant select (
  id,
  slug,
  name,
  lifecycle_status,
  model_status
) on table flow.value_flows to system_map_facts_reader;

grant select (
  id,
  flow_id,
  version_number,
  variant_type,
  state,
  as_of,
  verified_at
) on table flow.flow_versions to system_map_facts_reader;

-- Rows are bounded to vocabularies that were explicitly reviewed for the
-- System Map contract. A new status/type stays hidden until the contract is
-- updated instead of being exposed automatically.
create policy system_map_facts_reader_products_select
  on registry.products
  as permissive
  for select
  to system_map_facts_reader
  using (lifecycle_status in ('active', 'experimental', 'archived'));

create policy system_map_facts_reader_products_restrict
  on registry.products
  as restrictive
  for select
  to system_map_facts_reader
  using (lifecycle_status in ('active', 'experimental', 'archived'));

create policy system_map_facts_reader_product_relations_select
  on registry.product_relations
  as permissive
  for select
  to system_map_facts_reader
  using (
    relation_type in (
      'consumes_api',
      'consumes_content',
      'consumes_data',
      'predecessor_of',
      'references_source_of_truth',
      'uses_workflow_asset'
    )
  );

create policy system_map_facts_reader_product_relations_restrict
  on registry.product_relations
  as restrictive
  for select
  to system_map_facts_reader
  using (
    relation_type in (
      'consumes_api',
      'consumes_content',
      'consumes_data',
      'predecessor_of',
      'references_source_of_truth',
      'uses_workflow_asset'
    )
  );

create policy system_map_facts_reader_value_flows_select
  on flow.value_flows
  as permissive
  for select
  to system_map_facts_reader
  using (
    lifecycle_status in ('active', 'planned')
    and model_status in ('confirmed', 'provisional')
  );

create policy system_map_facts_reader_value_flows_restrict
  on flow.value_flows
  as restrictive
  for select
  to system_map_facts_reader
  using (
    lifecycle_status in ('active', 'planned')
    and model_status in ('confirmed', 'provisional')
  );

create policy system_map_facts_reader_flow_versions_select
  on flow.flow_versions
  as permissive
  for select
  to system_map_facts_reader
  using (
    variant_type in ('as_is', 'proposed')
    and state in ('active', 'draft')
  );

create policy system_map_facts_reader_flow_versions_restrict
  on flow.flow_versions
  as restrictive
  for select
  to system_map_facts_reader
  using (
    variant_type in ('as_is', 'proposed')
    and state in ('active', 'draft')
  );

comment on role system_map_facts_reader is
  'NOLOGIN capability role: read only sanitized Product/Relation/Value Flow facts for Health Monitor System Map.';
comment on role health_monitor_system_map_reader is
  'Health Monitor System Map reviewed-facts principal only. Password managed out-of-band.';

do $$
declare
  capability record;
  principal record;
  membership record;
begin
  select * into strict capability
  from pg_roles
  where rolname = 'system_map_facts_reader';

  if capability.rolcanlogin
     or not capability.rolinherit
     or capability.rolsuper
     or capability.rolcreatedb
     or capability.rolcreaterole
     or capability.rolreplication
     or capability.rolbypassrls
     or capability.rolconnlimit <> -1 then
    raise exception 'System Map capability role attributes do not match the security contract';
  end if;

  select * into strict principal
  from pg_roles
  where rolname = 'health_monitor_system_map_reader';

  if not principal.rolcanlogin
     or not principal.rolinherit
     or principal.rolsuper
     or principal.rolcreatedb
     or principal.rolcreaterole
     or principal.rolreplication
     or principal.rolbypassrls
     or principal.rolconnlimit <> 2 then
    raise exception 'System Map principal role attributes do not match the security contract';
  end if;

  select m.admin_option, m.inherit_option, m.set_option
    into strict membership
  from pg_auth_members m
  where m.roleid = 'system_map_facts_reader'::regrole
    and m.member = 'health_monitor_system_map_reader'::regrole;

  if membership.admin_option
     or not membership.inherit_option
     or membership.set_option then
    raise exception 'System Map reader membership options do not match ADMIN FALSE / INHERIT TRUE / SET FALSE';
  end if;

  if exists (
    select 1
    from pg_auth_members m
    where (
        m.member in (
          'system_map_facts_reader'::regrole,
          'health_monitor_system_map_reader'::regrole
        )
        or m.roleid in (
          'system_map_facts_reader'::regrole,
          'health_monitor_system_map_reader'::regrole
        )
      )
      and not (
        (
          m.roleid = 'system_map_facts_reader'::regrole
          and m.member = 'health_monitor_system_map_reader'::regrole
          and not m.admin_option
          and m.inherit_option
          and not m.set_option
        )
        or (
          m.member = current_user::regrole
          and m.roleid in (
            'system_map_facts_reader'::regrole,
            'health_monitor_system_map_reader'::regrole
          )
          and m.admin_option
          and not m.inherit_option
          and not m.set_option
        )
      )
  ) then
    raise exception 'unexpected role membership remains after System Map reader setup';
  end if;
end
$$;

commit;
