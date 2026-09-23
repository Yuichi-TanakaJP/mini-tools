-- Workspace Core Observability V2 context/lifecycle extension
--
-- Forward-compatible extension of 014_observability_schema.sql.
-- V1 producers continue to write contract_version=1 rows unchanged.
-- V2 producers explicitly opt into richer identity/context/lifecycle fields.
-- Existing rows are NOT backfilled as active V2 rows.

begin;

alter table observability.current_states
  add column contract_version smallint not null default 1,
  add column subject_kind text null,
  add column subject_label text null,
  add column product_slug text null,
  add column metric_label text null,
  add column metric_role text null,
  add column limit_value double precision null,
  add column usage_ratio double precision null,
  add column billing_period_start timestamptz null,
  add column billing_period_end timestamptz null,
  add column limit_verified_at date null,
  add column limit_needs_review boolean null,
  add column warning_operator text null,
  add column warning_value double precision null,
  add column warning_unit text null,
  add column critical_operator text null,
  add column critical_value double precision null,
  add column critical_unit text null,
  add column reason_code text null,
  add column lifecycle_status text null,
  add column retired_at timestamptz null,
  add column superseded_by text null;

alter table observability.current_states
  add constraint current_states_contract_version_check
    check (contract_version between 1 and 99),
  add constraint current_states_subject_kind_check
    check (
      subject_kind is null
      or subject_kind in (
        'service',
        'product',
        'repository',
        'job',
        'data_asset',
        'pc_resource',
        'monitor',
        'other'
      )
    ),
  add constraint current_states_subject_label_check
    check (subject_label is null or length(subject_label) <= 255),
  add constraint current_states_product_slug_check
    check (
      product_slug is null
      or (
        length(product_slug) between 1 and 128
        and product_slug ~ '^[a-z0-9][a-z0-9_-]*$'
      )
    ),
  add constraint current_states_metric_label_check
    check (metric_label is null or length(metric_label) <= 255),
  add constraint current_states_metric_role_check
    check (metric_role is null or metric_role in ('headline', 'context', 'detail')),
  add constraint current_states_limit_value_check
    check (limit_value is null or limit_value >= 0),
  add constraint current_states_usage_ratio_check
    check (usage_ratio is null or usage_ratio >= 0),
  add constraint current_states_billing_period_check
    check (
      (billing_period_start is null and billing_period_end is null)
      or (
        billing_period_start is not null
        and billing_period_end is not null
        and billing_period_end > billing_period_start
      )
    ),
  add constraint current_states_warning_threshold_check
    check (
      (warning_operator is null and warning_value is null and warning_unit is null)
      or (
        warning_operator in ('gt', 'gte', 'lt', 'lte')
        and warning_value is not null
        and (warning_unit is null or length(warning_unit) <= 64)
      )
    ),
  add constraint current_states_critical_threshold_check
    check (
      (critical_operator is null and critical_value is null and critical_unit is null)
      or (
        critical_operator in ('gt', 'gte', 'lt', 'lte')
        and critical_value is not null
        and (critical_unit is null or length(critical_unit) <= 64)
      )
    ),
  add constraint current_states_reason_code_check
    check (
      reason_code is null
      or (
        length(reason_code) between 1 and 64
        and reason_code ~ '^[a-z][a-z0-9_]*$'
      )
    ),
  add constraint current_states_lifecycle_status_check
    check (
      lifecycle_status is null
      or lifecycle_status in ('active', 'retired', 'unknown')
    ),
  add constraint current_states_retired_at_check
    check (
      (lifecycle_status = 'retired' and retired_at is not null)
      or (lifecycle_status is distinct from 'retired' and retired_at is null)
    ),
  add constraint current_states_superseded_by_check
    check (superseded_by is null or length(superseded_by) <= 255),
  add constraint current_states_v2_required_context_check
    check (
      contract_version < 2
      or (
        subject_key is not null
        and subject_kind is not null
        and metric_role is not null
        and lifecycle_status is not null
      )
    );

comment on column observability.current_states.contract_version is
  'Producer payload contract version. Existing/V1 rows remain version 1; V2 producers write 2.';
comment on column observability.current_states.subject_kind is
  'Semantic kind of stable subject_key for V2 operational identity.';
comment on column observability.current_states.product_slug is
  'Optional stable Workspace Core product slug for consumer-side semantic joins; not a FK.';
comment on column observability.current_states.lifecycle_status is
  'Operational lifecycle for V2 current facts. Primary consumers read active only.';
comment on column observability.current_states.reason_code is
  'Short machine-readable reason. message remains human-facing supporting text.';

alter table observability.status_events
  add column contract_version smallint not null default 1,
  add column subject_kind text null,
  add column subject_label text null,
  add column product_slug text null,
  add column metric_label text null,
  add column reason_code text null,
  add column event_kind text null;

alter table observability.status_events
  add constraint status_events_contract_version_check
    check (contract_version between 1 and 99),
  add constraint status_events_subject_kind_check
    check (
      subject_kind is null
      or subject_kind in (
        'service',
        'product',
        'repository',
        'job',
        'data_asset',
        'pc_resource',
        'monitor',
        'other'
      )
    ),
  add constraint status_events_subject_label_check
    check (subject_label is null or length(subject_label) <= 255),
  add constraint status_events_product_slug_check
    check (
      product_slug is null
      or (
        length(product_slug) between 1 and 128
        and product_slug ~ '^[a-z0-9][a-z0-9_-]*$'
      )
    ),
  add constraint status_events_metric_label_check
    check (metric_label is null or length(metric_label) <= 255),
  add constraint status_events_reason_code_check
    check (
      reason_code is null
      or (
        length(reason_code) between 1 and 64
        and reason_code ~ '^[a-z][a-z0-9_]*$'
      )
    ),
  add constraint status_events_event_kind_check
    check (
      event_kind is null
      or event_kind in ('status_change', 'recovery', 'retired', 'superseded')
    ),
  add constraint status_events_v2_required_context_check
    check (
      contract_version < 2
      or (
        subject_key is not null
        and subject_kind is not null
        and event_kind is not null
      )
    );

comment on column observability.status_events.contract_version is
  'Producer payload contract version. V2 events carry stable subject identity and event_kind.';
comment on column observability.status_events.product_slug is
  'Optional stable Workspace Core product slug for consumer-side semantic joins; not a FK.';
comment on column observability.status_events.event_kind is
  'Machine-readable V2 transition kind; status_events remains append-only.';

-- Read-oriented indexes only. No new writer privileges are required because
-- existing table grants cover newly-added columns.
create index current_states_v2_attention_idx
  on observability.current_states (contract_version, lifecycle_status, status, observed_at desc);

create index current_states_product_slug_idx
  on observability.current_states (product_slug, observed_at desc)
  where product_slug is not null;

create index status_events_v2_product_time_idx
  on observability.status_events (contract_version, product_slug, observed_at desc)
  where product_slug is not null;

commit;
