-- Run this file while ACTUALLY logged in as health_monitor_workspace_reader.
-- Do not use SET ROLE: role-level session defaults are part of this UAT.
-- Example connection flow is documented in product_evolution_evidence_reader_runbook.md.

\set ON_ERROR_STOP on

do $$
declare
  visible_count integer;
  invalid_row_count integer;
begin
  if session_user <> 'health_monitor_workspace_reader'
     or current_user <> 'health_monitor_workspace_reader' then
    raise exception 'UAT must use the concrete principal as the actual login';
  end if;

  if current_setting('default_transaction_read_only') <> 'on'
     or current_setting('transaction_read_only') <> 'on' then
    raise exception 'actual login is not default/read-only';
  end if;

  if current_setting('search_path') <> 'knowledge, pg_catalog' then
    raise exception 'unexpected search_path: %', current_setting('search_path');
  end if;

  select count(canonical_key)::int,
         count(canonical_key) filter (
           where canonical_key not like 'product-evolution-review-%'
              or lifecycle_status <> 'active'
         )::int
    into visible_count, invalid_row_count
  from knowledge.items;

  if visible_count < 1 then
    raise exception 'expected at least one active Product Evolution Review evidence row';
  end if;

  if invalid_row_count <> 0 then
    raise exception 'RLS exposed a row outside the Product Evolution predicate';
  end if;

  begin
    perform statement from knowledge.items limit 1;
    raise exception 'statement column unexpectedly readable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform metadata from knowledge.items limit 1;
    raise exception 'metadata column unexpectedly readable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into knowledge.items (kind, title, statement)
    values ('insight', 'forbidden-reader-uat', 'forbidden-reader-uat');
    raise exception 'INSERT unexpectedly allowed';
  exception
    when insufficient_privilege or read_only_sql_transaction then null;
  end;

  begin
    update knowledge.items
       set lifecycle_status = lifecycle_status
     where canonical_key like 'product-evolution-review-%';
    raise exception 'UPDATE unexpectedly allowed';
  exception
    when insufficient_privilege or read_only_sql_transaction then null;
  end;

  begin
    delete from knowledge.items
     where canonical_key like 'product-evolution-review-%';
    raise exception 'DELETE unexpectedly allowed';
  exception
    when insufficient_privilege or read_only_sql_transaction then null;
  end;

  begin
    perform id from knowledge.evolution_events limit 1;
    raise exception 'another knowledge table unexpectedly readable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform id from registry.products limit 1;
    raise exception 'registry unexpectedly readable';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

select canonical_key, lifecycle_status, verified_at, updated_at, created_at
from knowledge.items
order by canonical_key;
