-- Run this file while ACTUALLY logged in as health_monitor_system_map_reader.
-- Do not use SET ROLE: role-level session defaults are part of this UAT.
-- Example connection flow is documented in system_map_facts_reader_runbook.md.

\set ON_ERROR_STOP on

do $$
declare
  product_count integer;
  relation_count integer;
  flow_count integer;
  version_count integer;
  invalid_product_count integer;
  invalid_relation_count integer;
  invalid_flow_count integer;
  invalid_version_count integer;
begin
  if session_user <> 'health_monitor_system_map_reader'
     or current_user <> 'health_monitor_system_map_reader' then
    raise exception 'UAT must use the concrete System Map principal as the actual login';
  end if;

  if current_setting('default_transaction_read_only') <> 'on'
     or current_setting('transaction_read_only') <> 'on' then
    raise exception 'actual System Map login is not default/read-only';
  end if;

  if current_setting('search_path') <> 'registry, flow, pg_catalog' then
    raise exception 'unexpected System Map search_path: %', current_setting('search_path');
  end if;

  select count(*)::int,
         count(*) filter (
           where lifecycle_status not in ('active', 'experimental', 'archived')
         )::int
    into product_count, invalid_product_count
  from registry.products;

  select count(*)::int,
         count(*) filter (
           where relation_type not in (
             'consumes_api',
             'consumes_content',
             'consumes_data',
             'predecessor_of',
             'references_source_of_truth',
             'uses_workflow_asset'
           )
         )::int
    into relation_count, invalid_relation_count
  from registry.product_relations;

  select count(*)::int,
         count(*) filter (
           where lifecycle_status not in ('active', 'planned')
              or model_status not in ('confirmed', 'provisional')
         )::int
    into flow_count, invalid_flow_count
  from flow.value_flows;

  select count(*)::int,
         count(*) filter (
           where variant_type not in ('as_is', 'proposed')
              or state not in ('active', 'draft')
         )::int
    into version_count, invalid_version_count
  from flow.flow_versions;

  if product_count < 1 or relation_count < 1 or flow_count < 1 or version_count < 1 then
    raise exception 'expected reviewed-facts rows in every System Map table';
  end if;

  if invalid_product_count <> 0
     or invalid_relation_count <> 0
     or invalid_flow_count <> 0
     or invalid_version_count <> 0 then
    raise exception 'RLS exposed a row outside the reviewed System Map vocabularies';
  end if;

  begin
    perform description from registry.products limit 1;
    raise exception 'registry.products.description unexpectedly readable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform metadata from registry.products limit 1;
    raise exception 'registry.products.metadata unexpectedly readable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform notes from registry.product_relations limit 1;
    raise exception 'registry.product_relations.notes unexpectedly readable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform source from registry.product_relations limit 1;
    raise exception 'registry.product_relations.source unexpectedly readable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform purpose from flow.value_flows limit 1;
    raise exception 'flow.value_flows.purpose unexpectedly readable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform summary from flow.flow_versions limit 1;
    raise exception 'flow.flow_versions.summary unexpectedly readable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform id from registry.repositories limit 1;
    raise exception 'another Registry table unexpectedly readable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform id from flow.flow_steps limit 1;
    raise exception 'flow steps unexpectedly readable in Phase 2A';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform canonical_key from knowledge.items limit 1;
    raise exception 'Knowledge schema unexpectedly readable by System Map principal';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update registry.products
       set lifecycle_status = lifecycle_status
     where false;
    raise exception 'UPDATE unexpectedly allowed';
  exception
    when insufficient_privilege or read_only_sql_transaction then null;
  end;
end
$$;

select id, slug, name, product_type, lifecycle_status, importance
from registry.products
order by slug;

select source_product_id, target_product_id, relation_type, confidence, verified_at
from registry.product_relations
order by relation_type, source_product_id, target_product_id;

select id, slug, name, lifecycle_status, model_status
from flow.value_flows
order by slug;

select id, flow_id, version_number, variant_type, state, as_of, verified_at
from flow.flow_versions
order by flow_id, version_number;
