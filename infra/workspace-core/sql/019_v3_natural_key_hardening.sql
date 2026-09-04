-- Workspace Core V3
-- Natural-key hardening for replay/concurrency safety.

begin;

create unique index if not exists capability_assessments_natural_uidx
  on registry.capability_assessments(capability_id, stage, assessed_at, source);

create unique index if not exists evolution_events_natural_uidx
  on knowledge.evolution_events(
    event_type,
    title,
    coalesce(period_start, date '0001-01-01'),
    coalesce(period_end, date '0001-01-01')
  );

create unique index if not exists flow_outcomes_natural_uidx
  on flow.flow_outcomes(flow_id, outcome_type, title);

commit;
