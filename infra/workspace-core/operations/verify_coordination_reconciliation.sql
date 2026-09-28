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
  if not has_table_privilege('service_role', 'coordination.chat_checkpoints', 'SELECT')
     or not has_table_privilege('service_role', 'coordination.chat_checkpoints', 'INSERT')
     or not has_table_privilege('service_role', 'coordination.chat_checkpoints', 'UPDATE')
     or not has_table_privilege('service_role', 'coordination.chat_checkpoints', 'DELETE') then
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

do $$
declare
  mismatch_count integer;
begin
  with expected(table_name,ordinal_position,column_name,udt_name,is_nullable,column_default) as (
    values
      ('chat_checkpoints', 1, 'id', 'uuid', 'NO', 'gen_random_uuid()'),
      ('chat_checkpoints', 2, 'session_key', 'text', 'NO', null),
      ('chat_checkpoints', 3, 'workstream_id', 'uuid', 'NO', null),
      ('chat_checkpoints', 4, 'chat_label', 'text', 'YES', null),
      ('chat_checkpoints', 5, 'purpose', 'text', 'NO', null),
      ('chat_checkpoints', 6, 'current_state', 'text', 'NO', null),
      ('chat_checkpoints', 7, 'done', 'jsonb', 'NO', '''[]''::jsonb'),
      ('chat_checkpoints', 8, 'owner', 'text', 'NO', null),
      ('chat_checkpoints', 9, 'state', 'text', 'NO', null),
      ('chat_checkpoints', 10, 'waiting_for', 'text', 'NO', null),
      ('chat_checkpoints', 11, 'next_action', 'text', 'NO', null),
      ('chat_checkpoints', 12, 'evidence_refs', 'jsonb', 'NO', '''[]''::jsonb'),
      ('chat_checkpoints', 13, 'thought_changed', 'bool', 'NO', 'false'),
      ('chat_checkpoints', 14, 'thought_lineage_key', 'text', 'YES', null),
      ('chat_checkpoints', 15, 'source_ref', 'text', 'YES', null),
      ('chat_checkpoints', 16, 'checkpoint_version', 'text', 'NO', '''0.2''::text'),
      ('chat_checkpoints', 17, 'metadata', 'jsonb', 'NO', '''{}''::jsonb'),
      ('chat_checkpoints', 18, 'checkpoint_at', 'timestamptz', 'NO', 'now()'),
      ('chat_checkpoints', 19, 'created_at', 'timestamptz', 'NO', 'now()'),
      ('chat_checkpoints', 20, 'updated_at', 'timestamptz', 'NO', 'now()'),
      ('workstream_links', 1, 'id', 'uuid', 'NO', 'gen_random_uuid()'),
      ('workstream_links', 2, 'workstream_id', 'uuid', 'NO', null),
      ('workstream_links', 3, 'relation_type', 'text', 'NO', '''related_to''::text'),
      ('workstream_links', 4, 'target_type', 'text', 'NO', null),
      ('workstream_links', 5, 'target_id', 'uuid', 'YES', null),
      ('workstream_links', 6, 'target_key', 'text', 'YES', null),
      ('workstream_links', 7, 'label', 'text', 'YES', null),
      ('workstream_links', 8, 'url', 'text', 'YES', null),
      ('workstream_links', 9, 'metadata', 'jsonb', 'NO', '''{}''::jsonb'),
      ('workstream_links', 10, 'created_at', 'timestamptz', 'NO', 'now()'),
      ('workstream_updates', 1, 'id', 'uuid', 'NO', 'gen_random_uuid()'),
      ('workstream_updates', 2, 'workstream_id', 'uuid', 'NO', null),
      ('workstream_updates', 3, 'update_type', 'text', 'NO', '''progress''::text'),
      ('workstream_updates', 4, 'summary', 'text', 'NO', null),
      ('workstream_updates', 5, 'detail', 'text', 'YES', null),
      ('workstream_updates', 6, 'progress_pct', 'int2', 'YES', null),
      ('workstream_updates', 7, 'actor_type', 'text', 'NO', '''other''::text'),
      ('workstream_updates', 8, 'actor_name', 'text', 'YES', null),
      ('workstream_updates', 9, 'source_ref', 'text', 'YES', null),
      ('workstream_updates', 10, 'event_at', 'timestamptz', 'NO', 'now()'),
      ('workstream_updates', 11, 'metadata', 'jsonb', 'NO', '''{}''::jsonb'),
      ('workstream_updates', 12, 'created_at', 'timestamptz', 'NO', 'now()'),
      ('workstreams', 1, 'id', 'uuid', 'NO', 'gen_random_uuid()'),
      ('workstreams', 2, 'code', 'text', 'NO', null),
      ('workstreams', 3, 'title', 'text', 'NO', null),
      ('workstreams', 4, 'workstream_type', 'text', 'NO', '''other''::text'),
      ('workstreams', 5, 'status', 'text', 'NO', '''planned''::text'),
      ('workstreams', 6, 'objective', 'text', 'NO', null),
      ('workstreams', 7, 'background', 'text', 'YES', null),
      ('workstreams', 8, 'problem_statement', 'text', 'YES', null),
      ('workstreams', 9, 'scope_note', 'text', 'YES', null),
      ('workstreams', 10, 'non_goals', 'text', 'YES', null),
      ('workstreams', 11, 'success_criteria', 'jsonb', 'NO', '''[]''::jsonb'),
      ('workstreams', 12, 'current_phase', 'text', 'YES', null),
      ('workstreams', 13, 'current_summary', 'text', 'YES', null),
      ('workstreams', 14, 'next_actions', 'jsonb', 'NO', '''[]''::jsonb'),
      ('workstreams', 15, 'blockers', 'jsonb', 'NO', '''[]''::jsonb'),
      ('workstreams', 16, 'progress_pct', 'int2', 'YES', null),
      ('workstreams', 17, 'handoff_note', 'text', 'YES', null),
      ('workstreams', 18, 'started_at', 'timestamptz', 'YES', null),
      ('workstreams', 19, 'target_date', 'date', 'YES', null),
      ('workstreams', 20, 'completed_at', 'timestamptz', 'YES', null),
      ('workstreams', 21, 'metadata', 'jsonb', 'NO', '''{}''::jsonb'),
      ('workstreams', 22, 'created_at', 'timestamptz', 'NO', 'now()'),
      ('workstreams', 23, 'updated_at', 'timestamptz', 'NO', 'now()')
  ),
  actual as (
    select
      table_name,
      ordinal_position,
      column_name,
      udt_name,
      is_nullable,
      column_default
    from information_schema.columns
    where table_schema='coordination'
      and table_name in ('workstreams','workstream_updates','workstream_links','chat_checkpoints')
  ),
  diff as (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  )
  select count(*) into mismatch_count from diff;

  if mismatch_count <> 0 then
    raise exception 'coordination column contract drift: % mismatched rows', mismatch_count;
  end if;
end
$$;

select
  'coordination-reconciliation-ok' as result,
  (select count(*) from information_schema.columns
   where table_schema='coordination'
     and table_name in ('workstreams','workstream_updates','workstream_links','chat_checkpoints'))
    as verified_columns;
