-- Privileged catalog verification for Workspace Core Product Evolution Evidence reader.
-- Run after 029_product_evolution_evidence_reader.sql as an administrative role.
-- This file contains no password/DSN. Actual-login deny tests live in
-- uat_product_evolution_evidence_reader.sql.

\set ON_ERROR_STOP on

do $$
declare
  capability record;
  principal record;
  membership_count integer;
  bad_membership_count integer;
  owned_count integer;
  unexpected_policy_count integer;
  private_schema_access_count integer;
  extra_relation_access_count integer;
  definer_escape_count integer;
  bad_column_count integer;
begin
  select * into strict capability
  from pg_roles
  where rolname = 'product_evolution_evidence_reader';

  if capability.rolcanlogin
     or capability.rolsuper
     or capability.rolcreatedb
     or capability.rolcreaterole
     or capability.rolreplication
     or capability.rolbypassrls then
    raise exception 'capability role attributes are unsafe';
  end if;

  select * into strict principal
  from pg_roles
  where rolname = 'health_monitor_workspace_reader';

  if not principal.rolcanlogin
     or principal.rolsuper
     or principal.rolcreatedb
     or principal.rolcreaterole
     or principal.rolreplication
     or principal.rolbypassrls
     or principal.rolconnlimit <> 2 then
    raise exception 'principal role attributes are unsafe';
  end if;

  select count(*)::int
    into membership_count
  from pg_auth_members
  where roleid = 'product_evolution_evidence_reader'::regrole
    and member = 'health_monitor_workspace_reader'::regrole
    and not admin_option
    and inherit_option
    and not set_option;

  if membership_count <> 1 then
    raise exception 'expected exactly one ADMIN FALSE / INHERIT TRUE / SET FALSE membership';
  end if;

  select count(*)::int
    into bad_membership_count
  from pg_auth_members
  where (
      member in (
        'product_evolution_evidence_reader'::regrole,
        'health_monitor_workspace_reader'::regrole
      )
      or roleid in (
        'product_evolution_evidence_reader'::regrole,
        'health_monitor_workspace_reader'::regrole
      )
    )
    and not (
      roleid = 'product_evolution_evidence_reader'::regrole
      and member = 'health_monitor_workspace_reader'::regrole
    );

  if bad_membership_count <> 0 then
    raise exception 'unexpected membership remains on dedicated reader roles';
  end if;

  select count(*)::int
    into owned_count
  from pg_shdepend
  where refclassid = 'pg_authid'::regclass
    and refobjid in (
      'product_evolution_evidence_reader'::regrole,
      'health_monitor_workspace_reader'::regrole
    )
    and deptype = 'o';

  if owned_count <> 0 then
    raise exception 'dedicated reader roles own database objects';
  end if;

  if not has_database_privilege(
    'health_monitor_workspace_reader',
    current_database(),
    'CONNECT'
  ) then
    raise exception 'principal cannot CONNECT to the current database';
  end if;

  if not has_schema_privilege(
    'health_monitor_workspace_reader',
    'knowledge',
    'USAGE'
  ) then
    raise exception 'principal lacks required knowledge schema USAGE';
  end if;

  select count(*)::int
    into private_schema_access_count
  from pg_namespace
  where nspname in ('registry', 'platform', 'ops', 'flow', 'observability', 'coordination')
    and has_schema_privilege(
      'health_monitor_workspace_reader',
      oid,
      'USAGE'
    );

  if private_schema_access_count <> 0 then
    raise exception 'principal has unexpected USAGE on another private schema';
  end if;

  select count(*)::int
    into bad_column_count
  from information_schema.columns c
  where c.table_schema = 'knowledge'
    and c.table_name = 'items'
    and (
      (
        c.column_name in (
          'canonical_key',
          'lifecycle_status',
          'verified_at',
          'updated_at',
          'created_at'
        )
        and not has_column_privilege(
          'health_monitor_workspace_reader',
          'knowledge.items',
          c.column_name,
          'SELECT'
        )
      )
      or (
        c.column_name not in (
          'canonical_key',
          'lifecycle_status',
          'verified_at',
          'updated_at',
          'created_at'
        )
        and has_column_privilege(
          'health_monitor_workspace_reader',
          'knowledge.items',
          c.column_name,
          'SELECT'
        )
      )
    );

  if bad_column_count <> 0 then
    raise exception 'column-level SELECT boundary does not match the five-column contract';
  end if;

  if has_table_privilege(
       'health_monitor_workspace_reader',
       'knowledge.items',
       'INSERT'
     )
     or has_table_privilege(
       'health_monitor_workspace_reader',
       'knowledge.items',
       'UPDATE'
     )
     or has_table_privilege(
       'health_monitor_workspace_reader',
       'knowledge.items',
       'DELETE'
     )
     or has_table_privilege(
       'health_monitor_workspace_reader',
       'knowledge.items',
       'TRUNCATE'
     ) then
    raise exception 'principal has write privilege on knowledge.items';
  end if;

  select count(*)::int
    into extra_relation_access_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('knowledge', 'registry', 'platform', 'ops', 'flow', 'observability', 'coordination')
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and c.oid <> 'knowledge.items'::regclass
    and (
      has_table_privilege('health_monitor_workspace_reader', c.oid, 'SELECT')
      or has_table_privilege('health_monitor_workspace_reader', c.oid, 'INSERT')
      or has_table_privilege('health_monitor_workspace_reader', c.oid, 'UPDATE')
      or has_table_privilege('health_monitor_workspace_reader', c.oid, 'DELETE')
      or has_table_privilege('health_monitor_workspace_reader', c.oid, 'TRUNCATE')
      or has_table_privilege('health_monitor_workspace_reader', c.oid, 'REFERENCES')
      or has_table_privilege('health_monitor_workspace_reader', c.oid, 'TRIGGER')
      or has_any_column_privilege('health_monitor_workspace_reader', c.oid, 'SELECT')
      or has_any_column_privilege('health_monitor_workspace_reader', c.oid, 'INSERT')
      or has_any_column_privilege('health_monitor_workspace_reader', c.oid, 'UPDATE')
      or has_any_column_privilege('health_monitor_workspace_reader', c.oid, 'REFERENCES')
    );

  if extra_relation_access_count <> 0 then
    raise exception 'principal has effective relation privilege outside knowledge.items';
  end if;

  select count(*)::int
    into definer_escape_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'knowledge', 'registry', 'platform', 'ops', 'flow', 'observability', 'coordination')
    and p.prosecdef
    and has_schema_privilege(
      'health_monitor_workspace_reader',
      n.oid,
      'USAGE'
    )
    and has_function_privilege(
      'health_monitor_workspace_reader',
      p.oid,
      'EXECUTE'
    );

  if definer_escape_count <> 0 then
    raise exception 'principal can execute a SECURITY DEFINER function in an accessible schema';
  end if;

  select count(*)::int
    into unexpected_policy_count
  from pg_policy p
  where p.polrelid = 'knowledge.items'::regclass
    and (
      'product_evolution_evidence_reader'::regrole = any(p.polroles)
      or 'health_monitor_workspace_reader'::regrole = any(p.polroles)
    )
    and p.polname not in (
      'product_evolution_evidence_reader_select',
      'product_evolution_evidence_reader_restrict'
    );

  if unexpected_policy_count <> 0 then
    raise exception 'unexpected RLS policy directly targets the dedicated reader roles';
  end if;

  if not exists (
    select 1
    from pg_policy p
    where p.polrelid = 'knowledge.items'::regclass
      and p.polname = 'product_evolution_evidence_reader_select'
      and p.polcmd = 'r'
      and p.polpermissive
      and 'product_evolution_evidence_reader'::regrole = any(p.polroles)
  ) then
    raise exception 'required permissive SELECT policy is missing';
  end if;

  if not exists (
    select 1
    from pg_policy p
    where p.polrelid = 'knowledge.items'::regclass
      and p.polname = 'product_evolution_evidence_reader_restrict'
      and p.polcmd = 'r'
      and not p.polpermissive
      and 'product_evolution_evidence_reader'::regrole = any(p.polroles)
  ) then
    raise exception 'required restrictive SELECT policy is missing';
  end if;
end
$$;

-- Human-readable catalog snapshot after the assertions pass.
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
where r.rolname in (
  'product_evolution_evidence_reader',
  'health_monitor_workspace_reader'
)
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
where member_role.rolname = 'health_monitor_workspace_reader'
   or granted_role.rolname = 'product_evolution_evidence_reader'
order by member_role.rolname, granted_role.rolname;

select
  p.polname,
  case when p.polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end as policy_mode,
  p.polcmd,
  p.polroles::regrole[] as roles,
  pg_get_expr(p.polqual, p.polrelid) as using_expr
from pg_policy p
where p.polrelid = 'knowledge.items'::regclass
order by p.polname;

select
  c.column_name,
  has_column_privilege(
    'health_monitor_workspace_reader',
    'knowledge.items',
    c.column_name,
    'SELECT'
  ) as can_select
from information_schema.columns c
where c.table_schema = 'knowledge'
  and c.table_name = 'items'
order by c.ordinal_position;

select setdatabase, setrole::regrole, setconfig
from pg_db_role_setting
where setrole = 'health_monitor_workspace_reader'::regrole;
