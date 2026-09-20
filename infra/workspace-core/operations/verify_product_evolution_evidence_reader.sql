-- Read-only verification for Workspace Core Product Evolution Evidence reader.
-- Run after 029_product_evolution_evidence_reader.sql.
-- Do not put the principal password/DSN in this file or terminal history.

-- 1. Role shape: capability must be NOLOGIN/NOBYPASSRLS; principal LOGIN/NOBYPASSRLS.
select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
from pg_roles
where rolname in (
  'product_evolution_evidence_reader',
  'health_monitor_workspace_reader'
)
order by rolname;

-- 2. Membership.
select
  member_role.rolname as member_role,
  granted_role.rolname as granted_role
from pg_auth_members m
join pg_roles granted_role on granted_role.oid = m.roleid
join pg_roles member_role on member_role.oid = m.member
where member_role.rolname = 'health_monitor_workspace_reader'
  and granted_role.rolname = 'product_evolution_evidence_reader';

-- 3. RLS policy is narrow and SELECT-only.
select polname, polcmd, polroles::regrole[] as roles, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy
where polrelid = 'knowledge.items'::regclass
  and polname = 'product_evolution_evidence_reader_select';

-- 4. Column grants: exactly the five Evidence columns.
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'knowledge'
  and table_name = 'items'
  and grantee = 'product_evolution_evidence_reader'
order by column_name, privilege_type;

-- 5. There must be no table-level privilege for the capability role.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'knowledge'
  and table_name = 'items'
  and grantee = 'product_evolution_evidence_reader';

-- 6. Allowed read. Run in a disposable session or transaction.
begin;
set local role health_monitor_workspace_reader;
select canonical_key, lifecycle_status, verified_at, updated_at, created_at
from knowledge.items
order by canonical_key;
rollback;

-- Expected: only active product-evolution-review-* rows.
--
-- Negative tests should be run as separate commands because an expected
-- permission error aborts the current transaction:
--
--   set role health_monitor_workspace_reader;
--   select statement from knowledge.items limit 1;
--   -- expected: permission denied for table/column
--
--   set role health_monitor_workspace_reader;
--   insert into knowledge.items(kind,title,statement)
--   values ('insight','forbidden','forbidden');
--   -- expected: permission denied
--
--   set role health_monitor_workspace_reader;
--   select * from registry.products limit 1;
--   -- expected: permission denied
