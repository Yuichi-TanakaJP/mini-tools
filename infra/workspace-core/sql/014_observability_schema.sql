-- Workspace Core Observability V1.1
--
-- Remote read / history mirror for pc-saas-health-monitor and future producers.
-- Local Health Monitor SQLite remains the operational source of truth.
-- Raw observations are intentionally NOT stored here.
--
-- External identity contract:
--   source_key + subject_key + metric_key
-- subject_key may be NULL. UNIQUE NULLS NOT DISTINCT keeps a subject-less
-- metric idempotent under at-least-once delivery.
--
-- Security contract:
--   - observability_writer: NOLOGIN capability role, observability only
--   - health_monitor_observability: LOGIN principal, no password in source
--   - no DELETE / TRUNCATE / DDL for the writer
--   - no registry / platform / ops access
--   - RLS enabled with policies only for observability_writer
--   - public / anon / authenticated have no schema/table access

begin;

create schema observability;

revoke all on schema observability from public;
revoke all on schema observability from anon;
revoke all on schema observability from authenticated;

-- Capability role. Do not make this a login role and do not grant BYPASSRLS.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'observability_writer') then
    create role observability_writer
      nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

-- Concrete Health Monitor principal. Password is set/rotated out-of-band and
-- stored only in the Health Monitor OS Credential Store.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'health_monitor_observability') then
    create role health_monitor_observability
      login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
      connection limit 5;
  end if;
end
$$;

grant observability_writer to health_monitor_observability;
alter role health_monitor_observability set search_path = observability, pg_catalog;

create table observability.current_states (
  source_key text not null,
  subject_key text null,
  metric_key text not null,
  value double precision null,
  unit text null,
  status text not null,
  message text null,
  observed_at timestamptz not null,
  producer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint current_states_identity_key
    unique nulls not distinct (source_key, subject_key, metric_key),
  constraint current_states_source_key_check
    check (length(btrim(source_key)) between 1 and 255),
  constraint current_states_subject_key_check
    check (subject_key is null or length(btrim(subject_key)) between 1 and 255),
  constraint current_states_metric_key_check
    check (length(btrim(metric_key)) between 1 and 255),
  constraint current_states_unit_check
    check (unit is null or length(unit) <= 64),
  constraint current_states_status_check
    check (status in ('ok', 'warning', 'critical', 'unknown')),
  constraint current_states_message_check
    check (message is null or octet_length(message) <= 4096),
  constraint current_states_producer_check
    check (length(btrim(producer)) between 1 and 128)
);

create table observability.status_events (
  event_id text primary key,
  source_key text not null,
  subject_key text null,
  metric_key text not null,
  previous_status text null,
  new_status text not null,
  value double precision null,
  unit text null,
  message text null,
  observed_at timestamptz not null,
  producer text not null,
  created_at timestamptz not null default now(),

  constraint status_events_event_id_check
    check (length(btrim(event_id)) between 1 and 200),
  constraint status_events_source_key_check
    check (length(btrim(source_key)) between 1 and 255),
  constraint status_events_subject_key_check
    check (subject_key is null or length(btrim(subject_key)) between 1 and 255),
  constraint status_events_metric_key_check
    check (length(btrim(metric_key)) between 1 and 255),
  constraint status_events_previous_status_check
    check (previous_status is null or previous_status in ('ok', 'warning', 'critical', 'unknown')),
  constraint status_events_new_status_check
    check (new_status in ('ok', 'warning', 'critical', 'unknown')),
  constraint status_events_transition_check
    check (previous_status is null or previous_status <> new_status),
  constraint status_events_unit_check
    check (unit is null or length(unit) <= 64),
  constraint status_events_message_check
    check (message is null or octet_length(message) <= 4096),
  constraint status_events_producer_check
    check (length(btrim(producer)) between 1 and 128)
);

create table observability.daily_rollups (
  source_key text not null,
  subject_key text null,
  metric_key text not null,
  day date not null,
  unit text null,
  min_value double precision null,
  max_value double precision null,
  avg_value double precision null,
  count bigint not null,
  valued_count bigint not null,
  unknown_count bigint not null,
  worst_status text not null,
  generated_at timestamptz not null,
  producer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_rollups_identity_key
    unique nulls not distinct (source_key, subject_key, metric_key, day),
  constraint daily_rollups_source_key_check
    check (length(btrim(source_key)) between 1 and 255),
  constraint daily_rollups_subject_key_check
    check (subject_key is null or length(btrim(subject_key)) between 1 and 255),
  constraint daily_rollups_metric_key_check
    check (length(btrim(metric_key)) between 1 and 255),
  constraint daily_rollups_unit_check
    check (unit is null or length(unit) <= 64),
  constraint daily_rollups_count_check
    check (count >= 1),
  constraint daily_rollups_valued_count_check
    check (valued_count >= 0 and valued_count <= count),
  constraint daily_rollups_unknown_count_check
    check (unknown_count >= 0 and unknown_count <= count),
  constraint daily_rollups_status_check
    check (worst_status in ('ok', 'warning', 'critical', 'unknown')),
  constraint daily_rollups_values_check
    check (
      (valued_count = 0 and min_value is null and max_value is null and avg_value is null)
      or
      (valued_count > 0 and min_value is not null and max_value is not null
       and avg_value is not null and min_value <= max_value)
    ),
  constraint daily_rollups_producer_check
    check (length(btrim(producer)) between 1 and 128)
);

create table observability.governance_runs (
  run_id text primary key,
  target_system text not null,
  producer text not null,
  policy_key text null,
  policy_version text null,
  architecture_key text null,
  architecture_version text null,
  started_at timestamptz not null,
  completed_at timestamptz null,
  overall_status text not null,
  summary text null,
  created_at timestamptz not null default now(),

  constraint governance_runs_run_id_check
    check (length(btrim(run_id)) between 1 and 200),
  constraint governance_runs_target_system_check
    check (length(btrim(target_system)) between 1 and 255),
  constraint governance_runs_producer_check
    check (length(btrim(producer)) between 1 and 128),
  constraint governance_runs_policy_key_check
    check (policy_key is null or length(policy_key) <= 255),
  constraint governance_runs_policy_version_check
    check (policy_version is null or length(policy_version) <= 200),
  constraint governance_runs_architecture_key_check
    check (architecture_key is null or length(architecture_key) <= 255),
  constraint governance_runs_architecture_version_check
    check (architecture_version is null or length(architecture_version) <= 200),
  constraint governance_runs_completed_at_check
    check (completed_at is null or completed_at >= started_at),
  constraint governance_runs_status_check
    check (overall_status in ('ok', 'warning', 'critical', 'unknown')),
  constraint governance_runs_summary_check
    check (summary is null or octet_length(summary) <= 4096)
);

create table observability.governance_results (
  run_id text not null,
  check_key text not null,
  status text not null,
  severity text not null,
  checked_at timestamptz not null,
  policy_version text null,
  architecture_version text null,
  summary text null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint governance_results_pkey primary key (run_id, check_key),
  constraint governance_results_run_fk
    foreign key (run_id) references observability.governance_runs(run_id)
    on update cascade on delete restrict,
  constraint governance_results_check_key_check
    check (length(btrim(check_key)) between 1 and 255),
  constraint governance_results_status_check
    check (status in ('pass', 'fail', 'error', 'skipped')),
  constraint governance_results_severity_check
    check (severity in ('info', 'warning', 'critical')),
  constraint governance_results_policy_version_check
    check (policy_version is null or length(policy_version) <= 200),
  constraint governance_results_architecture_version_check
    check (architecture_version is null or length(architecture_version) <= 200),
  constraint governance_results_summary_check
    check (summary is null or octet_length(summary) <= 4096),
  constraint governance_results_evidence_type_check
    check (jsonb_typeof(evidence) = 'object'),
  constraint governance_results_evidence_size_check
    check (octet_length(evidence::text) <= 32768)
);

comment on schema observability is
  'Cross-product operational observations and governance history. Not a business-fact SoT.';
comment on table observability.current_states is
  'Latest mirrored state per external metric key. Raw observations are not stored.';
comment on table observability.status_events is
  'Append-only status-transition history. Same-status value changes do not belong here.';
comment on table observability.daily_rollups is
  'Producer-computed UTC-day aggregate snapshots. Cloud does not add/merge aggregates.';
comment on table observability.governance_runs is
  'Executable governance check execution history; observations, not policy/business facts.';
comment on table observability.governance_results is
  'Individual governance check results with minimal structured evidence.';

-- Read-oriented indexes for future server-side UI / AI consumers.
create index current_states_status_idx
  on observability.current_states (status, observed_at desc);
create index status_events_subject_metric_time_idx
  on observability.status_events (source_key, subject_key, metric_key, observed_at desc);
create index status_events_status_time_idx
  on observability.status_events (new_status, observed_at desc);
create index daily_rollups_day_idx
  on observability.daily_rollups (day desc, source_key, subject_key);
create index governance_runs_target_time_idx
  on observability.governance_runs (target_system, started_at desc);
create index governance_results_status_idx
  on observability.governance_results (status, severity, checked_at desc);

-- Database-level stale update guard. The adapter must still use conditional
-- ON CONFLICT upserts, but a buggy client cannot roll a current state backward.
create function observability.guard_current_state_update()
returns trigger
language plpgsql
set search_path = pg_catalog, observability
as $$
begin
  if new.source_key is distinct from old.source_key
     or new.subject_key is distinct from old.subject_key
     or new.metric_key is distinct from old.metric_key then
    raise exception 'current_states identity columns are immutable';
  end if;

  if new.observed_at <= old.observed_at then
    return null;
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create function observability.guard_daily_rollup_update()
returns trigger
language plpgsql
set search_path = pg_catalog, observability
as $$
begin
  if new.source_key is distinct from old.source_key
     or new.subject_key is distinct from old.subject_key
     or new.metric_key is distinct from old.metric_key
     or new.day is distinct from old.day then
    raise exception 'daily_rollups identity columns are immutable';
  end if;

  if new.generated_at <= old.generated_at then
    return null;
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create function observability.guard_governance_run_update()
returns trigger
language plpgsql
set search_path = pg_catalog, observability
as $$
begin
  if new.run_id is distinct from old.run_id then
    raise exception 'governance_runs run_id is immutable';
  end if;

  if old.completed_at is not null
     and (new.completed_at is null or new.completed_at < old.completed_at) then
    return null;
  end if;

  new.created_at := old.created_at;
  return new;
end;
$$;

create function observability.guard_governance_result_update()
returns trigger
language plpgsql
set search_path = pg_catalog, observability
as $$
begin
  if new.run_id is distinct from old.run_id or new.check_key is distinct from old.check_key then
    raise exception 'governance_results identity columns are immutable';
  end if;

  if new.checked_at < old.checked_at then
    return null;
  end if;

  if new.checked_at = old.checked_at
     and new.status is not distinct from old.status
     and new.severity is not distinct from old.severity
     and new.policy_version is not distinct from old.policy_version
     and new.architecture_version is not distinct from old.architecture_version
     and new.summary is not distinct from old.summary
     and new.evidence is not distinct from old.evidence then
    return null;
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function observability.guard_current_state_update() from public;
revoke all on function observability.guard_daily_rollup_update() from public;
revoke all on function observability.guard_governance_run_update() from public;
revoke all on function observability.guard_governance_result_update() from public;

create trigger current_states_guard_before_update
before update on observability.current_states
for each row execute function observability.guard_current_state_update();

create trigger daily_rollups_guard_before_update
before update on observability.daily_rollups
for each row execute function observability.guard_daily_rollup_update();

create trigger governance_runs_guard_before_update
before update on observability.governance_runs
for each row execute function observability.guard_governance_run_update();

create trigger governance_results_guard_before_update
before update on observability.governance_results
for each row execute function observability.guard_governance_result_update();

alter table observability.current_states enable row level security;
alter table observability.status_events enable row level security;
alter table observability.daily_rollups enable row level security;
alter table observability.governance_runs enable row level security;
alter table observability.governance_results enable row level security;

create policy observability_writer_current_states_select
  on observability.current_states for select to observability_writer using (true);
create policy observability_writer_current_states_insert
  on observability.current_states for insert to observability_writer with check (true);
create policy observability_writer_current_states_update
  on observability.current_states for update to observability_writer using (true) with check (true);

create policy observability_writer_status_events_select
  on observability.status_events for select to observability_writer using (true);
create policy observability_writer_status_events_insert
  on observability.status_events for insert to observability_writer with check (true);

create policy observability_writer_daily_rollups_select
  on observability.daily_rollups for select to observability_writer using (true);
create policy observability_writer_daily_rollups_insert
  on observability.daily_rollups for insert to observability_writer with check (true);
create policy observability_writer_daily_rollups_update
  on observability.daily_rollups for update to observability_writer using (true) with check (true);

create policy observability_writer_governance_runs_select
  on observability.governance_runs for select to observability_writer using (true);
create policy observability_writer_governance_runs_insert
  on observability.governance_runs for insert to observability_writer with check (true);
create policy observability_writer_governance_runs_update
  on observability.governance_runs for update to observability_writer using (true) with check (true);

create policy observability_writer_governance_results_select
  on observability.governance_results for select to observability_writer using (true);
create policy observability_writer_governance_results_insert
  on observability.governance_results for insert to observability_writer with check (true);
create policy observability_writer_governance_results_update
  on observability.governance_results for update to observability_writer using (true) with check (true);

revoke all on all tables in schema observability from public;
revoke all on all tables in schema observability from anon;
revoke all on all tables in schema observability from authenticated;

-- Writer: exactly the operations needed for idempotent mirror delivery.
grant usage on schema observability to observability_writer;
grant select, insert, update on observability.current_states to observability_writer;
grant select, insert on observability.status_events to observability_writer;
grant select, insert, update on observability.daily_rollups to observability_writer;
grant select, insert, update on observability.governance_runs to observability_writer;
grant select, insert, update on observability.governance_results to observability_writer;

-- Existing server-only workspace-core consumers may read Observability later,
-- but service_role receives no write permission here.
grant usage on schema observability to service_role;
grant select on all tables in schema observability to service_role;

-- Defense in depth for any later table accidentally created in this schema.
alter default privileges in schema observability revoke all on tables from public;
alter default privileges in schema observability revoke all on tables from anon;
alter default privileges in schema observability revoke all on tables from authenticated;

commit;
