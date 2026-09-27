-- Read-only structural verification for
-- 031_coordination_current_state_reconciliation.sql.
--
-- Safe to run against Workspace Core production or a disposable replay DB.
-- Raises on drift; performs no writes.

do $$
declare
  missing text[];
begin
  select array_agg(x.name order by x.name)
  into missing
  from (
    values
      ('coordination.workstreams'),
      ('coordination.workstream_updates'),
      ('coordination.workstream_links'),
      ('coordination.chat_checkpoints'),
      ('coordination.workstream_overview'),
      ('public.workspace_core_workstream_resume_v'),
      ('public.workspace_core_chat_orchestration_v'),
      ('public.workspace_core_architecture_alignment_v')
  ) as x(name)
  where to_regclass(x.name) is null;

  if missing is not null then
    raise exception 'missing coordination objects: %', missing;
  end if;
end
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'workstreams',
    'workstream_updates',
    'workstream_links',
    'chat_checkpoints'
  ]
  loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'coordination'
        and c.relname = table_name
        and c.relkind = 'r'
        and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on coordination.%', table_name;
    end if;
  end loop;
end
$$;

do $$
declare
  view_name text;
begin
  foreach view_name in array array[
    'workspace_core_workstream_resume_v',
    'workspace_core_chat_orchestration_v',
    'workspace_core_architecture_alignment_v'
  ]
  loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = view_name
        and c.relkind = 'v'
        and 'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[]))
    ) then
      raise exception 'public.% is missing security_invoker=true', view_name;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'coordination'
      and c.relname = 'workstream_overview'
      and c.relkind = 'v'
      and 'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[]))
  ) then
    raise exception 'coordination.workstream_overview is missing security_invoker=true';
  end if;
end
$$;

do $$
begin
  if has_schema_privilege('public', 'coordination', 'USAGE')
     or has_schema_privilege('anon', 'coordination', 'USAGE')
     or has_schema_privilege('authenticated', 'coordination', 'USAGE') then
    raise exception 'browser/public roles must not have coordination schema USAGE';
  end if;

  if not has_schema_privilege('service_role', 'coordination', 'USAGE') then
    raise exception 'service_role must have coordination schema USAGE';
  end if;
end
$$;

do $$
declare
  view_name text;
begin
  foreach view_name in array array[
    'workspace_core_workstream_resume_v',
    'workspace_core_chat_orchestration_v',
    'workspace_core_architecture_alignment_v'
  ]
  loop
    if has_table_privilege('anon', 'public.' || view_name, 'SELECT')
       or has_table_privilege('authenticated', 'public.' || view_name, 'SELECT')
       or has_table_privilege('public', 'public.' || view_name, 'SELECT') then
      raise exception 'public.% unexpectedly readable by browser/public role', view_name;
    end if;
    if not has_table_privilege('service_role', 'public.' || view_name, 'SELECT') then
      raise exception 'service_role cannot read public.%', view_name;
    end if;
  end loop;
end
$$;

do $$
declare
  expected text[] := array[
    'chat_checkpoints_done_check',
    'chat_checkpoints_evidence_refs_check',
    'chat_checkpoints_metadata_check',
    'chat_checkpoints_nonblank_check',
    'chat_checkpoints_owner_check',
    'chat_checkpoints_pkey',
    'chat_checkpoints_session_key_key',
    'chat_checkpoints_state_check',
    'chat_checkpoints_workstream_id_fkey',
    'workstream_links_check',
    'workstream_links_metadata_check',
    'workstream_links_pkey',
    'workstream_links_relation_type_check',
    'workstream_links_target_type_check',
    'workstream_links_workstream_id_fkey',
    'workstream_updates_actor_type_check',
    'workstream_updates_metadata_check',
    'workstream_updates_pkey',
    'workstream_updates_progress_pct_check',
    'workstream_updates_update_type_check',
    'workstream_updates_workstream_id_fkey',
    'workstreams_blockers_check',
    'workstreams_check',
    'workstreams_code_check',
    'workstreams_code_key',
    'workstreams_metadata_check',
    'workstreams_next_actions_check',
    'workstreams_pkey',
    'workstreams_progress_pct_check',
    'workstreams_status_check',
    'workstreams_success_criteria_check',
    'workstreams_workstream_type_check'
  ];
  actual text[];
begin
  select array_agg(con.conname order by con.conname)
  into actual
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'coordination'
    and c.relname in ('workstreams','workstream_updates','workstream_links','chat_checkpoints');

  if actual is distinct from expected then
    raise exception 'coordination constraint set drift. expected %, got %', expected, actual;
  end if;
end
$$;

do $$
declare
  expected text[] := array[
    'chat_checkpoints_checkpoint_at_idx',
    'chat_checkpoints_owner_state_idx',
    'chat_checkpoints_workstream_idx',
    'coordination_workstream_links_target_idx',
    'coordination_workstream_links_workstream_idx',
    'coordination_workstream_updates_type_idx',
    'coordination_workstream_updates_workstream_event_idx',
    'coordination_workstreams_status_idx',
    'coordination_workstreams_updated_at_idx'
  ];
  actual text[];
begin
  select array_agg(indexname order by indexname)
  into actual
  from pg_indexes
  where schemaname = 'coordination'
    and indexname not in (
      'workstreams_pkey',
      'workstreams_code_key',
      'workstream_updates_pkey',
      'workstream_links_pkey',
      'chat_checkpoints_pkey',
      'chat_checkpoints_session_key_key'
    );

  if actual is distinct from expected then
    raise exception 'coordination secondary-index set drift. expected %, got %', expected, actual;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('platform.touch_updated_at()') is null then
    raise exception 'platform.touch_updated_at() dependency is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'coordination'
      and c.relname = 'workstreams'
      and t.tgname = 'coordination_workstreams_touch_updated_at'
      and not t.tgisinternal
  ) then
    raise exception 'coordination workstreams touch_updated_at trigger is missing';
  end if;
end
$$;

do $$
begin
  if (select count(*) from pg_policies where schemaname = 'coordination') <> 0 then
    raise exception 'coordination unexpectedly has RLS policies; current contract is service-role/private-schema only';
  end if;
end
$$;

do $$
begin
  if not has_table_privilege('service_role', 'coordination.chat_checkpoints', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'service_role chat_checkpoints CRUD grant drift';
  end if;

  if has_table_privilege('service_role', 'coordination.chat_checkpoints', 'TRUNCATE') then
    raise exception 'service_role must not have TRUNCATE on chat_checkpoints';
  end if;

  if has_table_privilege('anon', 'coordination.chat_checkpoints', 'SELECT')
     or has_table_privilege('authenticated', 'coordination.chat_checkpoints', 'SELECT') then
    raise exception 'browser roles unexpectedly read chat_checkpoints';
  end if;
end
$$;

select
  'coordination-reconciliation-ok' as result,
  (select count(*) from information_schema.columns
   where table_schema='coordination' and table_name='workstreams') as workstream_columns,
  (select count(*) from information_schema.columns
   where table_schema='coordination' and table_name='chat_checkpoints') as checkpoint_columns;
