-- Privileged catalog verification for Workspace Core System Map reviewed-facts reader.
-- Run after 030_system_map_facts_reader.sql as an administrative role.
-- This file contains no password/DSN. Actual-login deny tests live in
-- uat_system_map_facts_reader.sql.

\set ON_ERROR_STOP on

do $$
declare
  capability record;
  principal record;
  membership_count integer;
  bad_membership_count integer;
  owned_count integer;
  private_schema_access_count integer;
  extra_relation_access_count integer;
  public_workspace_view_access_count integer;
  definer_escape_count integer;
  bad_column_count integer;
  missing_rls_count integer;
  unexpected_policy_count integer;
  expected_policy_count integer;
begin
  select * into strict capability
  from pg_roles
  where rolname = 'system_map_facts_reader';

  if capability.rolcanlogin
     or capability.rolsuper
     or capability.rolcreatedb
     or capability.rolcreaterole
     or capability.rolreplication
     or capability.rolbypassrls
     or capability.rolconnlimit <> -1 then
    raise exception 'System Map capability role attributes are unsafe';
  end if;

  select * into strict principal
  from pg_roles
  where rolname = 'health_monitor_system_map_reader';

  if not principal.rolcanlogin
     or principal.rolsuper
     or principal.rolcreatedb
     or principal.rolcreaterole
     or principal.rolreplication
     or principal.rolbypassrls
     or principal.rolconnlimit <> 2 then
    raise exception 'System Map principal role attributes are unsafe';
  end if;

  select count(*)::int
    into membership_count
  from pg_auth_members
  where roleid = 'system_map_facts_reader'::regrole
    and member = 'health_monitor_system_map_reader'::regrole
    and not admin_option
    and inherit_option
    and not set_option;

  if membership_count <> 1 then
    raise exception 'expected exactly one System Map ADMIN FALSE / INHERIT TRUE / SET FALSE membership';
  end if;

  select count(*)::int
    into bad_membership_count
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
    );

  if bad_membership_count <> 0 then
    raise exception 'unexpected membership remains on System Map reader roles';
  end if;

  select count(*)::int
    into owned_count
  from pg_shdepend
  where refclassid = 'pg_authid'::regclass
    and refobjid in (
      'system_map_facts_reader'::regrole,
      'health_monitor_system_map_reader'::regrole
    )
    and deptype = 'o';

  if owned_count <> 0 then
    raise exception 'System Map reader roles own database objects';
  end if;

  if not has_database_privilege(
    'health_monitor_system_map_reader',
    current_database(),
    'CONNECT'
  ) then
    raise exception 'System Map principal cannot CONNECT to the current database';
  end if;

  if not has_schema_privilege('health_monitor_system_map_reader', 'registry', 'USAGE')
     or not has_schema_privilege('health_monitor_system_map_reader', 'flow', 'USAGE') then
    raise exception 'System Map principal lacks registry/flow schema USAGE';
  end if;

  select count(*)::int
    into private_schema_access_count
  from pg_namespace
  where nspname in ('knowledge', 'platform', 'ops', 'observability', 'coordination')
    and has_schema_privilege('health_monitor_system_map_reader', oid, 'USAGE');

  if private_schema_access_count <> 0 then
    raise exception 'System Map principal has unexpected USAGE on another private schema';
  end if;

  select count(*)::int
    into bad_column_count
  from information_schema.columns c
  where (c.table_schema, c.table_name) in (
      ('registry', 'products'),
      ('registry', 'product_relations'),
      ('flow', 'value_flows'),
      ('flow', 'flow_versions')
    )
    and (
      (
        (
          (c.table_schema = 'registry' and c.table_name = 'products'
            and c.column_name in ('id', 'slug', 'name', 'product_type', 'lifecycle_status', 'importance'))
          or
          (c.table_schema = 'registry' and c.table_name = 'product_relations'
            and c.column_name in ('source_product_id', 'target_product_id', 'relation_type', 'confidence', 'verified_at'))
          or
          (c.table_schema = 'flow' and c.table_name = 'value_flows'
            and c.column_name in ('id', 'slug', 'name', 'lifecycle_status', 'model_status'))
          or
          (c.table_schema = 'flow' and c.table_name = 'flow_versions'
            and c.column_name in ('id', 'flow_id', 'version_number', 'variant_type', 'state', 'as_of', 'verified_at'))
        )
        and not has_column_privilege(
          'health_monitor_system_map_reader',
          format('%I.%I', c.table_schema, c.table_name),
          c.column_name,
          'SELECT'
        )
      )
      or
      (
        not (
          (c.table_schema = 'registry' and c.table_name = 'products'
            and c.column_name in ('id', 'slug', 'name', 'product_type', 'lifecycle_status', 'importance'))
          or
          (c.table_schema = 'registry' and c.table_name = 'product_relations'
            and c.column_name in ('source_product_id', 'target_product_id', 'relation_type', 'confidence', 'verified_at'))
          or
          (c.table_schema = 'flow' and c.table_name = 'value_flows'
            and c.column_name in ('id', 'slug', 'name', 'lifecycle_status', 'model_status'))
          or
          (c.table_schema = 'flow' and c.table_name = 'flow_versions'
            and c.column_name in ('id', 'flow_id', 'version_number', 'variant_type', 'state', 'as_of', 'verified_at'))
        )
        and has_column_privilege(
          'health_monitor_system_map_reader',
          format('%I.%I', c.table_schema, c.table_name),
          c.column_name,
          'SELECT'
        )
      )
    );

  if bad_column_count <> 0 then
    raise exception 'System Map column-level SELECT boundary does not match the contract';
  end if;

  if has_table_privilege('health_monitor_system_map_reader', 'registry.products', 'INSERT')
     or has_table_privilege('health_monitor_system_map_reader', 'registry.products', 'UPDATE')
     or has_table_privilege('health_monitor_system_map_reader', 'registry.products', 'DELETE')
     or has_table_privilege('health_monitor_system_map_reader', 'registry.products', 'TRUNCATE')
     or has_table_privilege('health_monitor_system_map_reader', 'registry.product_relations', 'INSERT')
     or has_table_privilege('health_monitor_system_map_reader', 'registry.product_relations', 'UPDATE')
     or has_table_privilege('health_monitor_system_map_reader', 'registry.product_relations', 'DELETE')
     or has_table_privilege('health_monitor_system_map_reader', 'registry.product_relations', 'TRUNCATE')
     or has_table_privilege('health_monitor_system_map_reader', 'flow.value_flows', 'INSERT')
     or has_table_privilege('health_monitor_system_map_reader', 'flow.value_flows', 'UPDATE')
     or has_table_privilege('health_monitor_system_map_reader', 'flow.value_flows', 'DELETE')
     or has_table_privilege('health_monitor_system_map_reader', 'flow.value_flows', 'TRUNCATE')
     or has_table_privilege('health_monitor_system_map_reader', 'flow.flow_versions', 'INSERT')
     or has_table_privilege('health_monitor_system_map_reader', 'flow.flow_versions', 'UPDATE')
     or has_table_privilege('health_monitor_system_map_reader', 'flow.flow_versions', 'DELETE')
     or has_table_privilege('health_monitor_system_map_reader', 'flow.flow_versions', 'TRUNCATE') then
    raise exception 'System Map principal has write privilege on the reviewed-facts tables';
  end if;

  select count(*)::int
    into extra_relation_access_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('knowledge', 'registry', 'platform', 'ops', 'flow', 'observability', 'coordination')
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and c.oid not in (
      'registry.products'::regclass,
      'registry.product_relations'::regclass,
      'flow.value_flows'::regclass,
      'flow.flow_versions'::regclass
    )
    and (
      has_table_privilege('health_monitor_system_map_reader', c.oid, 'SELECT')
      or has_table_privilege('health_monitor_system_map_reader', c.oid, 'INSERT')
      or has_table_privilege('health_monitor_system_map_reader', c.oid, 'UPDATE')
      or has_table_privilege('health_monitor_system_map_reader', c.oid, 'DELETE')
      or has_table_privilege('health_monitor_system_map_reader', c.oid, 'TRUNCATE')
      or has_table_privilege('health_monitor_system_map_reader', c.oid, 'REFERENCES')
      or has_table_privilege('health_monitor_system_map_reader', c.oid, 'TRIGGER')
      or has_any_column_privilege('health_monitor_system_map_reader', c.oid, 'SELECT')
      or has_any_column_privilege('health_monitor_system_map_reader', c.oid, 'INSERT')
      or has_any_column_privilege('health_monitor_system_map_reader', c.oid, 'UPDATE')
      or has_any_column_privilege('health_monitor_system_map_reader', c.oid, 'REFERENCES')
    );

  if extra_relation_access_count <> 0 then
    raise exception 'System Map principal has effective relation privilege outside the four-table contract';
  end if;

  select count(*)::int
    into public_workspace_view_access_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('v', 'm')
    and c.relname like 'workspace_core_%'
    and has_table_privilege('health_monitor_system_map_reader', c.oid, 'SELECT');

  if public_workspace_view_access_count <> 0 then
    raise exception 'System Map principal can read Product Map public read views outside its contract';
  end if;

  select count(*)::int
    into definer_escape_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'knowledge', 'registry', 'platform', 'ops', 'flow', 'observability', 'coordination')
    and p.prosecdef
    and has_schema_privilege('health_monitor_system_map_reader', n.oid, 'USAGE')
    and has_function_privilege('health_monitor_system_map_reader', p.oid, 'EXECUTE');

  if definer_escape_count <> 0 then
    raise exception 'System Map principal can execute a SECURITY DEFINER function in an accessible schema';
  end if;

  select count(*)::int
    into missing_rls_count
  from pg_class c
  where c.oid in (
      'registry.products'::regclass,
      'registry.product_relations'::regclass,
      'flow.value_flows'::regclass,
      'flow.flow_versions'::regclass
    )
    and not c.relrowsecurity;

  if missing_rls_count <> 0 then
    raise exception 'RLS is not enabled on every System Map reviewed-facts table';
  end if;

  select count(*)::int
    into unexpected_policy_count
  from pg_policy p
  where (
      'system_map_facts_reader'::regrole = any(p.polroles)
      or 'health_monitor_system_map_reader'::regrole = any(p.polroles)
    )
    and p.polname not in (
      'system_map_facts_reader_products_select',
      'system_map_facts_reader_products_restrict',
      'system_map_facts_reader_product_relations_select',
      'system_map_facts_reader_product_relations_restrict',
      'system_map_facts_reader_value_flows_select',
      'system_map_facts_reader_value_flows_restrict',
      'system_map_facts_reader_flow_versions_select',
      'system_map_facts_reader_flow_versions_restrict'
    );

  if unexpected_policy_count <> 0 then
    raise exception 'unexpected RLS policy directly targets the System Map reader roles';
  end if;

  select count(*)::int
    into expected_policy_count
  from pg_policy p
  where p.polname in (
      'system_map_facts_reader_products_select',
      'system_map_facts_reader_products_restrict',
      'system_map_facts_reader_product_relations_select',
      'system_map_facts_reader_product_relations_restrict',
      'system_map_facts_reader_value_flows_select',
      'system_map_facts_reader_value_flows_restrict',
      'system_map_facts_reader_flow_versions_select',
      'system_map_facts_reader_flow_versions_restrict'
    )
    and 'system_map_facts_reader'::regrole = any(p.polroles)
    and p.polcmd = 'r';

  if expected_policy_count <> 8 then
    raise exception 'required System Map SELECT policies are missing or target the wrong role';
  end if;
end
$$;

select
  r.rolname,
  r.rolcanlogin,
  r.rolinherit,
  r.rolsuper,
  r.rolcreatedb,
  r.rolcreaterole,
  r.rolreplication,
  r.rolbypassrls,
  r.rolconnlimit
from pg_roles r
where r.rolname in ('system_map_facts_reader', 'health_monitor_system_map_reader')
order by r.rolname;

select
  member_role.rolname as member_role,
  granted_role.rolname as granted_role,
  m.admin_option,
  m.inherit_option,
  m.set_option
from pg_auth_members m
join pg_roles granted_role on granted_role.oid = m.roleid
join pg_roles member_role on member_role.oid = m.member
where member_role.rolname = 'health_monitor_system_map_reader'
   or granted_role.rolname = 'system_map_facts_reader'
order by member_role.rolname, granted_role.rolname;

select
  n.nspname as schema_name,
  c.relname as table_name,
  p.polname,
  case when p.polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end as policy_mode,
  p.polcmd,
  p.polroles::regrole[] as roles,
  pg_get_expr(p.polqual, p.polrelid) as using_expr
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where 'system_map_facts_reader'::regrole = any(p.polroles)
order by n.nspname, c.relname, p.polname;

select setdatabase, setrole::regrole, setconfig
from pg_db_role_setting
where setrole = 'health_monitor_system_map_reader'::regrole;
