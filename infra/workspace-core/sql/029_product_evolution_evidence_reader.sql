-- Workspace Core V3
-- Narrow Product Evolution Evidence reader for pc-saas-health-monitor.
--
-- Security contract:
--   - capability role is NOLOGIN / NOBYPASSRLS
--   - concrete Health Monitor principal is LOGIN / NOBYPASSRLS
--   - principal inherits only this capability and cannot SET ROLE into it
--   - only five columns from knowledge.items are selectable
--   - a restrictive RLS policy prevents future permissive/PUBLIC policies from widening rows
--   - unknown membership, ownership, direct ACL, or role-targeted policy state aborts
--   - password is configured out-of-band and never stored in source control

begin;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'product_evolution_evidence_reader'
  ) then
    create role product_evolution_evidence_reader
      nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
      connection limit -1;
  end if;

  if not exists (
    select 1 from pg_roles where rolname = 'health_monitor_workspace_reader'
  ) then
    create role health_monitor_workspace_reader
      login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
      connection limit 2;
  end if;
end
$$;

-- Supabase's migration role may create these roles but is not a superuser,
-- so protected role attributes cannot be repaired with ALTER ROLE. Existing
-- roles must already match the exact contract or the migration aborts.
do $
declare
  capability record;
  principal record;
begin
  select * into strict capability
  from pg_roles
  where rolname = 'product_evolution_evidence_reader';

  if capability.rolcanlogin
     or not capability.rolinherit
     or capability.rolsuper
     or capability.rolcreatedb
     or capability.rolcreaterole
     or capability.rolreplication
     or capability.rolbypassrls
     or capability.rolconnlimit <> -1 then
    raise exception 'existing capability role attributes do not match the security contract';
  end if;

  select * into strict principal
  from pg_roles
  where rolname = 'health_monitor_workspace_reader';

  if not principal.rolcanlogin
     or not principal.rolinherit
     or principal.rolsuper
     or principal.rolcreatedb
     or principal.rolcreaterole
     or principal.rolreplication
     or principal.rolbypassrls
     or principal.rolconnlimit <> 2 then
    raise exception 'existing principal role attributes do not match the security contract';
  end if;
end
$;

-- Role GUCs are owned by this migration and can be converged safely.
alter role product_evolution_evidence_reader reset all;
alter role health_monitor_workspace_reader reset all;
alter role health_monitor_workspace_reader set search_path = knowledge, pg_catalog;
alter role health_monitor_workspace_reader set default_transaction_read_only = on;

-- Remove only the state this migration itself owns, so re-running can validate
-- that nothing else has been attached to these dedicated roles.
revoke product_evolution_evidence_reader from health_monitor_workspace_reader;

drop policy if exists product_evolution_evidence_reader_select on knowledge.items;
drop policy if exists product_evolution_evidence_reader_restrict on knowledge.items;

revoke all privileges on table knowledge.items
  from product_evolution_evidence_reader, health_monitor_workspace_reader;
revoke usage on schema knowledge
  from product_evolution_evidence_reader, health_monitor_workspace_reader;

do $$
declare
  columns_sql text;
begin
  select string_agg(format('%I', attname), ', ' order by attnum)
    into columns_sql
  from pg_attribute
  where attrelid = 'knowledge.items'::regclass
    and attnum > 0
    and not attisdropped;

  if columns_sql is not null then
    execute format(
      'revoke select (%1$s) on table knowledge.items from product_evolution_evidence_reader, health_monitor_workspace_reader',
      columns_sql
    );
    execute format(
      'revoke insert (%1$s) on table knowledge.items from product_evolution_evidence_reader, health_monitor_workspace_reader',
      columns_sql
    );
    execute format(
      'revoke update (%1$s) on table knowledge.items from product_evolution_evidence_reader, health_monitor_workspace_reader',
      columns_sql
    );
    execute format(
      'revoke references (%1$s) on table knowledge.items from product_evolution_evidence_reader, health_monitor_workspace_reader',
      columns_sql
    );
  end if;
end
$$;

do $$
begin
  execute format(
    'revoke connect on database %I from product_evolution_evidence_reader, health_monitor_workspace_reader',
    current_database()
  );
end
$$;

-- Fail closed if either dedicated role has any state that this migration does
-- not own. This catches partial/manual experiments instead of silently keeping
-- their privileges.
do $$
declare
  capability_oid oid := 'product_evolution_evidence_reader'::regrole;
  principal_oid oid := 'health_monitor_workspace_reader'::regrole;
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
  where m.member in (capability_oid, principal_oid)
     or m.roleid in (capability_oid, principal_oid);

  if detail is not null then
    raise exception 'unexpected role membership on dedicated reader roles: %', detail;
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
    raise exception 'unexpected ownership/direct ACL on dedicated reader roles: %', detail;
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
    raise exception 'unexpected RLS policy targets dedicated reader roles: %', detail;
  end if;
end
$$;

-- Rebuild the one and only role membership. INHERIT lets the login use the
-- capability automatically; SET FALSE prevents it from becoming the group role.
grant product_evolution_evidence_reader
  to health_monitor_workspace_reader
  with admin false, inherit true, set false;

do $$
begin
  execute format(
    'grant connect on database %I to health_monitor_workspace_reader',
    current_database()
  );
end
$$;

grant usage on schema knowledge to product_evolution_evidence_reader;

grant select (
  canonical_key,
  lifecycle_status,
  verified_at,
  updated_at,
  created_at
) on table knowledge.items to product_evolution_evidence_reader;

-- The permissive policy grants the intended rows today. The matching
-- restrictive policy is defense in depth: any future permissive policy
-- applicable through PUBLIC or another inherited role still cannot widen this
-- reader beyond the Product Evolution predicate.
create policy product_evolution_evidence_reader_select
  on knowledge.items
  as permissive
  for select
  to product_evolution_evidence_reader
  using (
    canonical_key is not null
    and canonical_key like 'product-evolution-review-%'
    and lifecycle_status = 'active'
  );

create policy product_evolution_evidence_reader_restrict
  on knowledge.items
  as restrictive
  for select
  to product_evolution_evidence_reader
  using (
    canonical_key is not null
    and canonical_key like 'product-evolution-review-%'
    and lifecycle_status = 'active'
  );

comment on role product_evolution_evidence_reader is
  'NOLOGIN capability role: read only active Product Evolution Review evidence keys/timestamps.';
comment on role health_monitor_workspace_reader is
  'Health Monitor principal for Product Evolution Review evidence only. Password managed out-of-band.';

-- Postconditions: attributes and the expected membership itself are part of the
-- migration contract, not merely documentation.
do $$
declare
  capability record;
  principal record;
  membership record;
begin
  select * into strict capability
  from pg_roles
  where rolname = 'product_evolution_evidence_reader';

  if capability.rolcanlogin
     or not capability.rolinherit
     or capability.rolsuper
     or capability.rolcreatedb
     or capability.rolcreaterole
     or capability.rolreplication
     or capability.rolbypassrls then
    raise exception 'capability role attributes do not match the security contract';
  end if;

  select * into strict principal
  from pg_roles
  where rolname = 'health_monitor_workspace_reader';

  if not principal.rolcanlogin
     or not principal.rolinherit
     or principal.rolsuper
     or principal.rolcreatedb
     or principal.rolcreaterole
     or principal.rolreplication
     or principal.rolbypassrls
     or principal.rolconnlimit <> 2 then
    raise exception 'principal role attributes do not match the security contract';
  end if;

  select m.admin_option, m.inherit_option, m.set_option
    into strict membership
  from pg_auth_members m
  where m.roleid = 'product_evolution_evidence_reader'::regrole
    and m.member = 'health_monitor_workspace_reader'::regrole;

  if membership.admin_option
     or not membership.inherit_option
     or membership.set_option then
    raise exception 'reader membership options do not match ADMIN FALSE / INHERIT TRUE / SET FALSE';
  end if;
end
$$;

commit;
