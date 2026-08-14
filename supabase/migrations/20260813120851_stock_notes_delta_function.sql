-- 銘柄分析ダッシュボードの銘柄単位差分取得。
-- SECURITY INVOKER のため、stock_notes_* の既存RLSをそのまま適用する。
create or replace function public.get_stock_notes_delta(
  p_known_manifest jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with normalized_known as (
  select case
    when jsonb_typeof(coalesce(p_known_manifest, '{}'::jsonb)) = 'object'
      then coalesce(p_known_manifest, '{}'::jsonb)
    else '{}'::jsonb
  end as manifest
),
bundles as (
  select
    s.id::text as stock_id,
    jsonb_build_object(
      'stock', jsonb_build_object(
        'id', s.id,
        'code', s.code,
        'name', coalesce(s.name, ''),
        'category', s.category,
        'categoryChangedAt', s.category_changed_at,
        'categoryChangeReason', s.category_change_reason,
        'createdAt', s.created_at,
        'updatedAt', s.updated_at
      ),
      'analyses', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id,
          'stockId', a.stock_id,
          'analysisType', a.analysis_type,
          'conclusion', a.conclusion,
          'evidence', a.evidence,
          'concerns', a.concerns,
          'source', a.source,
          'sourceUrl', a.source_url,
          'analyzedAt', a.analyzed_at,
          'createdAt', a.created_at
        ) order by a.id)
        from public.stock_notes_analyses a
        where a.stock_id = s.id and a.user_id = auth.uid()
      ), '[]'::jsonb),
      'theses', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', t.id,
          'stockId', t.stock_id,
          'view', t.view,
          'confidence', coalesce(t.confidence, 'medium'),
          'thesis', coalesce(t.thesis, '[]'::jsonb),
          'risks', coalesce(t.risks, '[]'::jsonb),
          'nextCheck', coalesce(t.next_check, '[]'::jsonb),
          'buyMoreCondition', t.buy_more_condition,
          'exitCondition', t.exit_condition,
          'asOf', t.as_of,
          'createdAt', t.created_at
        ) order by t.id)
        from public.stock_notes_theses t
        where t.stock_id = s.id and t.user_id = auth.uid()
      ), '[]'::jsonb),
      'actions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', x.id,
          'stockId', x.stock_id,
          'actionType', x.action_type,
          'title', x.title,
          'detail', x.detail,
          'triggerCondition', x.trigger_condition,
          'dueDate', x.due_date,
          'status', x.status,
          'createdAt', x.created_at
        ) order by x.id)
        from public.stock_notes_actions x
        where x.stock_id = s.id and x.user_id = auth.uid() and x.status = 'open'
      ), '[]'::jsonb)
    ) as bundle
  from public.stock_notes_stocks s
  where s.user_id = auth.uid()
),
hashed as (
  select stock_id, bundle, md5(bundle::text) as revision
  from bundles
),
changed as (
  select h.bundle || jsonb_build_object('revision', h.revision) as bundle
  from hashed h
  cross join normalized_known k
  where coalesce(k.manifest ->> h.stock_id, '') <> h.revision
),
deleted as (
  select jsonb_agg(known.key order by known.key) as ids
  from normalized_known k
  cross join lateral jsonb_object_keys(k.manifest) as known(key)
  where not exists (select 1 from hashed h where h.stock_id = known.key)
)
select jsonb_build_object(
  'version', 1,
  'complete', true,
  'currentManifest', coalesce((
    select jsonb_object_agg(h.stock_id, h.revision order by h.stock_id)
    from hashed h
  ), '{}'::jsonb),
  'changedStocks', coalesce((select jsonb_agg(changed.bundle order by changed.bundle -> 'stock' ->> 'id') from changed), '[]'::jsonb),
  'deletedStockIds', coalesce((select deleted.ids from deleted), '[]'::jsonb)
);
$$;

revoke all on function public.get_stock_notes_delta(jsonb) from public;
revoke execute on function public.get_stock_notes_delta(jsonb) from anon;
grant execute on function public.get_stock_notes_delta(jsonb) to authenticated;
