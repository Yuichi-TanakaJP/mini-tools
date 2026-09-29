-- Workspace Core Coordination current-state reconciliation
--
-- Purpose:
--   Reconcile live-only Coordination / resume / chat-orchestration schema into the
--   existing infra/workspace-core/sql lineage after 030_observability_v2_context.sql.
--
-- This is NOT a verbatim transcript of the historical live migrations. It is a
-- fresh-bootstrap reconciliation that reproduces their final schema state:
--   20260906130144 coordination_workstreams_v0_1
--   20260927065632 workspace_core_workstream_resume_read_model_v1
--   20260927124439 chat_orchestration_v0_2_checkpoints
--   20260927141823 chat_orchestration_v0_2_attention_class_fix
--   20260927171822 architecture_alignment_review_v0_read_model
--
-- Apply only to a fresh/replay database after the existing Workspace Core SQL
-- lineage through 030. The production project already contains these objects.
--
-- No data rows are seeded here.

begin;

create schema coordination;

comment on schema coordination is
  'Cross-product human/AI coordination layer. Tracks why an initiative exists, its current state, handoffs, and links. Does not replace GitHub or product-domain sources of truth.';

revoke all on schema coordination from public;
revoke all on schema coordination from anon;
revoke all on schema coordination from authenticated;
grant usage on schema coordination to service_role;

create table coordination.workstreams (
  id uuid default gen_random_uuid() not null,
  code text not null,
  title text not null,
  workstream_type text default 'other'::text not null,
  status text default 'planned'::text not null,
  objective text not null,
  background text,
  problem_statement text,
  scope_note text,
  non_goals text,
  success_criteria jsonb default '[]'::jsonb not null,
  current_phase text,
  current_summary text,
  next_actions jsonb default '[]'::jsonb not null,
  blockers jsonb default '[]'::jsonb not null,
  progress_pct smallint,
  handoff_note text,
  started_at timestamptz,
  target_date date,
  completed_at timestamptz,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  constraint workstreams_pkey primary key (id),
  constraint workstreams_code_key unique (code),
  constraint workstreams_blockers_check check (jsonb_typeof(blockers) = 'array'::text),
  constraint workstreams_check check (
    (status = 'completed'::text and completed_at is not null)
    or status <> 'completed'::text
  ),
  constraint workstreams_code_check check (
    code ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'::text
  ),
  constraint workstreams_metadata_check check (jsonb_typeof(metadata) = 'object'::text),
  constraint workstreams_next_actions_check check (jsonb_typeof(next_actions) = 'array'::text),
  constraint workstreams_progress_pct_check check (progress_pct >= 0 and progress_pct <= 100),
  constraint workstreams_status_check check (
    status = any (array[
      'planned'::text, 'active'::text, 'blocked'::text, 'review'::text,
      'paused'::text, 'completed'::text, 'cancelled'::text
    ])
  ),
  constraint workstreams_success_criteria_check check (jsonb_typeof(success_criteria) = 'array'::text),
  constraint workstreams_workstream_type_check check (
    workstream_type = any (array[
      'feature'::text, 'research'::text, 'architecture'::text, 'migration'::text,
      'operations'::text, 'data'::text, 'ui'::text, 'governance'::text, 'other'::text
    ])
  )
);

comment on table coordination.workstreams is
  'Current snapshot / coordination SoT for cross-product initiatives. GitHub remains SoT for issue/PR execution state; knowledge.items remains SoT for ideas/problems/goals.';

create index coordination_workstreams_status_idx
  on coordination.workstreams (status);

create index coordination_workstreams_updated_at_idx
  on coordination.workstreams (updated_at desc);

create trigger coordination_workstreams_touch_updated_at
before update on coordination.workstreams
for each row execute function platform.touch_updated_at();

create table coordination.workstream_updates (
  id uuid default gen_random_uuid() not null,
  workstream_id uuid not null,
  update_type text default 'progress'::text not null,
  summary text not null,
  detail text,
  progress_pct smallint,
  actor_type text default 'other'::text not null,
  actor_name text,
  source_ref text,
  event_at timestamptz default now() not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,

  constraint workstream_updates_pkey primary key (id),
  constraint workstream_updates_actor_type_check check (
    actor_type = any (array[
      'human'::text, 'chatgpt'::text, 'claude'::text, 'codex'::text,
      'system'::text, 'other'::text
    ])
  ),
  constraint workstream_updates_metadata_check check (jsonb_typeof(metadata) = 'object'::text),
  constraint workstream_updates_progress_pct_check check (progress_pct >= 0 and progress_pct <= 100),
  constraint workstream_updates_update_type_check check (
    update_type = any (array[
      'progress'::text, 'handoff'::text, 'decision'::text, 'risk'::text,
      'note'::text, 'implementation'::text, 'verification'::text, 'status_change'::text
    ])
  ),
  constraint workstream_updates_workstream_id_fkey
    foreign key (workstream_id) references coordination.workstreams(id)
);

comment on table coordination.workstream_updates is
  'Append-oriented timeline of progress, handoffs, decisions, risks, implementation and verification events for a workstream.';

create index coordination_workstream_updates_type_idx
  on coordination.workstream_updates (update_type);

create index coordination_workstream_updates_workstream_event_idx
  on coordination.workstream_updates (workstream_id, event_at desc);

create table coordination.workstream_links (
  id uuid default gen_random_uuid() not null,
  workstream_id uuid not null,
  relation_type text default 'related_to'::text not null,
  target_type text not null,
  target_id uuid,
  target_key text,
  label text,
  url text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,

  constraint workstream_links_pkey primary key (id),
  constraint workstream_links_check check (
    target_id is not null or target_key is not null or url is not null
  ),
  constraint workstream_links_metadata_check check (jsonb_typeof(metadata) = 'object'::text),
  constraint workstream_links_relation_type_check check (
    relation_type = any (array[
      'source_of_truth'::text, 'originates_from'::text, 'implements'::text,
      'depends_on'::text, 'produces'::text, 'tracks'::text,
      'related_to'::text, 'supersedes'::text
    ])
  ),
  constraint workstream_links_target_type_check check (
    target_type = any (array[
      'knowledge_item'::text, 'evolution_event'::text, 'product'::text,
      'repository'::text, 'github_issue'::text, 'github_pr'::text,
      'supabase_project'::text, 'database_object'::text, 'architecture'::text,
      'policy'::text, 'document'::text, 'workstream'::text,
      'external_url'::text, 'other'::text
    ])
  ),
  constraint workstream_links_workstream_id_fkey
    foreign key (workstream_id) references coordination.workstreams(id)
);

comment on table coordination.workstream_links is
  'Loose links from a workstream to knowledge, products, repositories, GitHub issues/PRs, DB objects and external documents. Links point to external SoTs rather than copying their state.';

create index coordination_workstream_links_target_idx
  on coordination.workstream_links (target_type, target_key);

create index coordination_workstream_links_workstream_idx
  on coordination.workstream_links (workstream_id);

create table coordination.chat_checkpoints (
  id uuid default gen_random_uuid() not null,
  session_key text not null,
  workstream_id uuid not null,
  chat_label text,
  purpose text not null,
  current_state text not null,
  done jsonb default '[]'::jsonb not null,
  owner text not null,
  state text not null,
  waiting_for text not null,
  next_action text not null,
  evidence_refs jsonb default '[]'::jsonb not null,
  thought_changed boolean default false not null,
  thought_lineage_key text,
  source_ref text,
  checkpoint_version text default '0.2'::text not null,
  metadata jsonb default '{}'::jsonb not null,
  checkpoint_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  constraint chat_checkpoints_pkey primary key (id),
  constraint chat_checkpoints_session_key_key unique (session_key),
  constraint chat_checkpoints_done_check check (jsonb_typeof(done) = 'array'::text),
  constraint chat_checkpoints_evidence_refs_check check (jsonb_typeof(evidence_refs) = 'array'::text),
  constraint chat_checkpoints_metadata_check check (jsonb_typeof(metadata) = 'object'::text),
  constraint chat_checkpoints_nonblank_check check (
    btrim(session_key) <> ''::text
    and btrim(purpose) <> ''::text
    and btrim(current_state) <> ''::text
    and btrim(waiting_for) <> ''::text
    and btrim(next_action) <> ''::text
  ),
  constraint chat_checkpoints_owner_check check (
    owner = any (array[
      'user'::text, 'chatgpt'::text, 'codex'::text, 'claude'::text,
      'system'::text, 'other'::text
    ])
  ),
  constraint chat_checkpoints_state_check check (
    state = any (array[
      'planned'::text, 'working'::text, 'waiting'::text, 'review'::text,
      'blocked'::text, 'done'::text, 'abandoned'::text
    ])
  ),
  constraint chat_checkpoints_workstream_id_fkey
    foreign key (workstream_id) references coordination.workstreams(id)
);

comment on table coordination.chat_checkpoints is
  'Authoritative per-chat orchestration checkpoints. One row per semantic chat session. Chats are workspaces, while this table stores the resumable state: owner, state, waiting_for, next_action, and linked evidence.';

create index chat_checkpoints_checkpoint_at_idx
  on coordination.chat_checkpoints (checkpoint_at desc);

create index chat_checkpoints_owner_state_idx
  on coordination.chat_checkpoints (owner, state);

create index chat_checkpoints_workstream_idx
  on coordination.chat_checkpoints (workstream_id);

alter table coordination.workstreams enable row level security;
alter table coordination.workstream_updates enable row level security;
alter table coordination.workstream_links enable row level security;
alter table coordination.chat_checkpoints enable row level security;

revoke all on coordination.workstreams from public, anon, authenticated;
revoke all on coordination.workstream_updates from public, anon, authenticated;
revoke all on coordination.workstream_links from public, anon, authenticated;
revoke all on coordination.chat_checkpoints from public, anon, authenticated;

grant all on coordination.workstreams to service_role;
grant all on coordination.workstream_updates to service_role;
grant all on coordination.workstream_links to service_role;
grant select, insert, update, delete on coordination.chat_checkpoints to service_role;

create view coordination.workstream_overview
with (security_invoker = true)
as
SELECT w.id,
    w.code,
    w.title,
    w.workstream_type,
    w.status,
    w.objective,
    w.current_phase,
    w.current_summary,
    w.progress_pct,
    w.next_actions,
    w.blockers,
    w.handoff_note,
    w.started_at,
    w.target_date,
    w.completed_at,
    w.updated_at,
    u.event_at AS last_update_at,
    u.update_type AS last_update_type,
    u.summary AS last_update_summary,
    COALESCE(l.link_count, 0::bigint) AS link_count,
    NULLIF(w.metadata ->> 'snapshot_verified_at'::text, ''::text)::timestamp with time zone AS snapshot_verified_at,
    COALESCE(NULLIF(w.metadata #>> '{snapshot_freshness,status}'::text[], ''::text), 'unknown'::text) AS freshness_status,
    NULLIF(w.metadata #>> '{snapshot_freshness,coverage}'::text[], ''::text) AS freshness_coverage,
    NULLIF(w.metadata #>> '{snapshot_freshness,latest_basis_updated_at}'::text[], ''::text)::timestamp with time zone AS latest_basis_updated_at,
        CASE
            WHEN COALESCE(NULLIF(w.metadata #>> '{snapshot_freshness,status}'::text[], ''::text), 'unknown'::text) = ANY (ARRAY['needs_recheck'::text, 'partial'::text, 'unknown'::text]) THEN true
            ELSE false
        END AS freshness_attention,
        CASE
            WHEN jsonb_typeof(w.metadata -> 'snapshot_basis'::text) = 'array'::text THEN jsonb_array_length(w.metadata -> 'snapshot_basis'::text)
            ELSE 0
        END AS snapshot_basis_count,
    NULLIF(w.metadata #>> '{semantic_freshness,status}'::text[], ''::text) AS semantic_freshness_status,
    COALESCE(NULLIF(w.metadata #>> '{semantic_freshness,last_materiality}'::text[], ''::text), NULLIF(sm.metadata ->> 'materiality'::text, ''::text)) AS semantic_last_materiality,
    sm.event_at AS semantic_candidate_at,
        CASE
            WHEN sm.event_at IS NULL AND (w.metadata -> 'semantic_freshness'::text) IS NULL THEN NULL::boolean
            WHEN COALESCE(NULLIF(w.metadata #>> '{semantic_freshness,status}'::text[], ''::text), ''::text) = 'needs_recheck'::text THEN true
            WHEN COALESCE((sm.metadata ->> 'requires_snapshot_recheck'::text)::boolean, false) AND (NULLIF(w.metadata #>> '{semantic_freshness,reviewed_at}'::text[], ''::text)::timestamp with time zone IS NULL OR NULLIF(w.metadata #>> '{semantic_freshness,reviewed_at}'::text[], ''::text)::timestamp with time zone < sm.event_at) THEN true
            WHEN COALESCE(NULLIF(w.metadata #>> '{semantic_freshness,status}'::text[], ''::text), ''::text) = 'fresh'::text THEN false
            ELSE NULL::boolean
        END AS semantic_attention
   FROM coordination.workstreams w
     LEFT JOIN LATERAL ( SELECT wu.event_at,
            wu.update_type,
            wu.summary
           FROM coordination.workstream_updates wu
          WHERE wu.workstream_id = w.id
          ORDER BY wu.event_at DESC, wu.created_at DESC
         LIMIT 1) u ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS link_count
           FROM coordination.workstream_links wl
          WHERE wl.workstream_id = w.id) l ON true
     LEFT JOIN LATERAL ( SELECT wu.event_at,
            wu.metadata
           FROM coordination.workstream_updates wu
          WHERE wu.workstream_id = w.id AND (wu.metadata ? 'materiality'::text OR wu.metadata ? 'requires_snapshot_recheck'::text)
          ORDER BY wu.event_at DESC, wu.created_at DESC
         LIMIT 1) sm ON true;
comment on view coordination.workstream_overview is
  'Human/AI-friendly current overview: workstream snapshot plus the latest timeline update and link count.';

revoke all on coordination.workstream_overview from public, anon, authenticated;
grant all on coordination.workstream_overview to service_role;

create view public.workspace_core_workstream_resume_v
with (security_invoker = true)
as
SELECT w.id AS workstream_id,
    w.code AS workstream_code,
    w.title AS workstream_title,
    w.status,
    w.current_phase,
    w.progress_pct,
    w.current_summary,
    w.next_actions,
    w.blockers,
    w.updated_at AS workstream_updated_at,
    lu.event_at AS last_update_at,
    lu.update_type AS last_update_type,
    lu.summary AS last_update_summary,
    tl.id AS thought_item_id,
    tl.canonical_key AS thought_item_key,
    tl.title AS thought_title,
    tl.statement AS thought_statement,
    tl.updated_at AS thought_updated_at,
        CASE
            WHEN tl.id IS NULL THEN NULL::jsonb
            ELSE jsonb_build_object('why', COALESCE(NULLIF(tl.metadata ->> 'insight'::text, ''::text), tl.statement), 'hypothesis', tl.metadata -> 'hypothesis'::text, 'connections', COALESCE(tl.metadata -> 'connections'::text, '[]'::jsonb), 'selected_or_active', COALESCE(tl.metadata -> 'selected_or_active'::text, '[]'::jsonb), 'deferred', COALESCE(tl.metadata -> 'deferred'::text, '[]'::jsonb), 'defer_reason_summary', tl.metadata -> 'defer_reason_summary'::text, 'next_question', tl.metadata -> 'next_question'::text, 'next_meaningful_decision', tl.metadata -> 'next_meaningful_decision'::text, 'evidence_refs', COALESCE(tl.metadata -> 'evidence_refs'::text, '[]'::jsonb), 'operational_state', jsonb_build_object('status', w.status, 'current_phase', w.current_phase, 'progress_pct', w.progress_pct, 'current_summary', w.current_summary, 'next_actions', w.next_actions, 'blockers', w.blockers, 'last_update_at', lu.event_at, 'last_update_type', lu.update_type, 'last_update_summary', lu.summary))
        END AS resume_packet
   FROM coordination.workstreams w
     LEFT JOIN LATERAL ( SELECT u.event_at,
            u.update_type,
            u.summary
           FROM coordination.workstream_updates u
          WHERE u.workstream_id = w.id
          ORDER BY u.event_at DESC, u.created_at DESC
         LIMIT 1) lu ON true
     LEFT JOIN LATERAL ( SELECT k.id,
            k.canonical_key,
            k.kind,
            k.title,
            k.statement,
            k.domain_id,
            k.lifecycle_status,
            k.verification_status,
            k.supersedes_item_id,
            k.source,
            k.confidence,
            k.verified_at,
            k.metadata,
            k.created_at,
            k.updated_at
           FROM coordination.workstream_links l
             JOIN knowledge.items k ON k.id = l.target_id
          WHERE l.workstream_id = w.id AND l.target_type = 'knowledge_item'::text AND ((k.metadata ->> 'record_kind'::text) = 'thought_lineage_v0_pilot'::text OR k.canonical_key ~~ 'thought-lineage-pilot-%'::text)
          ORDER BY k.updated_at DESC, k.created_at DESC
         LIMIT 1) tl ON true;
comment on view public.workspace_core_workstream_resume_v is
  'Read-only resume packet for Workspace Core workstreams. Combines operational state with the latest linked Thought Lineage item so an AI or human can recover why the work exists, what is active/deferred, and the next meaningful decision without reconstructing the full chat.';

revoke all on public.workspace_core_workstream_resume_v from public, anon, authenticated;
grant all on public.workspace_core_workstream_resume_v to service_role;

create view public.workspace_core_chat_orchestration_v
with (security_invoker = true)
as
SELECT c.id AS checkpoint_id,
    c.session_key,
    c.chat_label,
    w.id AS workstream_id,
    w.code AS workstream_code,
    w.title AS workstream_title,
    w.status AS workstream_status,
    c.purpose,
    c.current_state,
    c.done,
    c.owner,
    c.state,
    c.waiting_for,
    c.next_action,
    c.evidence_refs,
    c.thought_changed,
    c.thought_lineage_key,
    c.source_ref,
    c.checkpoint_version,
    c.checkpoint_at,
    c.updated_at,
        CASE
            WHEN c.state = ANY (ARRAY['done'::text, 'abandoned'::text]) THEN true
            ELSE false
        END AS is_terminal,
        CASE
            WHEN c.state = ANY (ARRAY['done'::text, 'abandoned'::text]) THEN 'terminal'::text
            WHEN c.state = 'blocked'::text THEN 'blocked'::text
            WHEN c.owner = 'user'::text THEN 'user_action'::text
            WHEN c.state = 'waiting'::text THEN 'waiting'::text
            WHEN c.state = 'review'::text THEN 'review'::text
            ELSE 'active'::text
        END AS attention_class
   FROM coordination.chat_checkpoints c
     JOIN coordination.workstreams w ON w.id = c.workstream_id;
comment on view public.workspace_core_chat_orchestration_v is
  'Read-only cross-chat orchestration board. Shows one authoritative checkpoint per chat session together with its parent Workstream.';

revoke all on public.workspace_core_chat_orchestration_v from public, anon, authenticated;
grant all on public.workspace_core_chat_orchestration_v to service_role;

create view public.workspace_core_architecture_alignment_v
with (security_invoker = true)
as
SELECT c.id AS checkpoint_id,
    c.session_key,
    c.chat_label,
    w.id AS workstream_id,
    w.code AS workstream_code,
    w.title AS workstream_title,
    c.owner,
    c.state,
    c.current_state,
    c.next_action,
    c.checkpoint_at,
    (c.metadata -> 'architecture_alignment_v0'::text) ->> 'review_version'::text AS review_version,
    NULLIF((c.metadata -> 'architecture_alignment_v0'::text) ->> 'reviewed_at'::text, ''::text)::timestamp with time zone AS architecture_reviewed_at,
    (c.metadata -> 'architecture_alignment_v0'::text) -> 'origin_architecture_refs'::text AS origin_architecture_refs,
    (c.metadata -> 'architecture_alignment_v0'::text) -> 'applicable_current_architecture_refs'::text AS applicable_current_architecture_refs,
    (c.metadata -> 'architecture_alignment_v0'::text) ->> 'status'::text AS alignment_status,
    (c.metadata -> 'architecture_alignment_v0'::text) ->> 'rationale'::text AS alignment_rationale,
    (c.metadata -> 'architecture_alignment_v0'::text) ->> 'gap_or_risk'::text AS alignment_gap_or_risk,
    (c.metadata -> 'architecture_alignment_v0'::text) ->> 'recheck_trigger'::text AS architecture_recheck_trigger,
        CASE
            WHEN NOT c.metadata ? 'architecture_alignment_v0'::text THEN 'unreviewed'::text
            WHEN ((c.metadata -> 'architecture_alignment_v0'::text) ->> 'status'::text) = ANY (ARRAY['drift-risk'::text, 'superseded'::text]) THEN 'high'::text
            WHEN ((c.metadata -> 'architecture_alignment_v0'::text) ->> 'status'::text) = ANY (ARRAY['transitional'::text, 'unknown'::text]) THEN 'review'::text
            WHEN ((c.metadata -> 'architecture_alignment_v0'::text) ->> 'status'::text) = ANY (ARRAY['aligned'::text, 'legacy-intentional'::text]) THEN 'ok'::text
            ELSE 'review'::text
        END AS architecture_attention,
        CASE
            WHEN NOT c.metadata ? 'architecture_alignment_v0'::text THEN true
            WHEN ((c.metadata -> 'architecture_alignment_v0'::text) ->> 'status'::text) = ANY (ARRAY['drift-risk'::text, 'superseded'::text, 'transitional'::text, 'unknown'::text]) THEN true
            ELSE false
        END AS needs_architecture_review
   FROM coordination.chat_checkpoints c
     JOIN coordination.workstreams w ON w.id = c.workstream_id;
comment on view public.workspace_core_architecture_alignment_v is
  'Read-only Architecture Alignment Review V0 board. Shows each chat checkpoint, its origin/applicable architecture refs, alignment status, rationale, gap/risk, and recheck trigger.';

revoke all on public.workspace_core_architecture_alignment_v from public, anon, authenticated;
grant all on public.workspace_core_architecture_alignment_v to service_role;

commit;
