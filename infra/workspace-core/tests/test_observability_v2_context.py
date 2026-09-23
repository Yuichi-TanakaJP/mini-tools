"""Observability V2 schema contract against a disposable local PostgreSQL DB.

Run with:
  PGHOST=127.0.0.1 PGDATABASE=observability_v2_test python -m unittest     infra.workspace-core.tests.test_observability_v2_context

The test refuses non-loopback hosts and any other database name.  It builds a
minimal synthetic V1 fixture, applies only the forward V2 migration, and never
connects to Workspace Core production.
"""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = (ROOT / "sql" / "030_observability_v2_context.sql").read_text()


def psql(sql: str, *, expect_success: bool = True) -> str:
    env = os.environ.copy()
    if env.get("PGHOST") not in ("127.0.0.1", "localhost"):
        raise RuntimeError("Tests require a loopback PGHOST")
    if env.get("PGDATABASE") != "observability_v2_test":
        raise RuntimeError("Tests require PGDATABASE=observability_v2_test")

    result = subprocess.run(
        ["psql", "-X", "-w", "-At", "-v", "ON_ERROR_STOP=1"],
        input=sql,
        text=True,
        capture_output=True,
        timeout=60,
        env=env,
    )
    if expect_success and result.returncode:
        raise AssertionError(result.stderr)
    if not expect_success and not result.returncode:
        raise AssertionError("statement unexpectedly succeeded")
    return result.stdout


def v1_fixture() -> str:
    return r"""
drop schema if exists observability cascade;
create schema observability;

create table observability.current_states (
  source_key text not null,
  subject_key text null,
  metric_key text not null,
  value double precision null,
  unit text null,
  status text not null check (status in ('ok','warning','critical','unknown')),
  message text null,
  observed_at timestamptz not null,
  producer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (source_key, subject_key, metric_key)
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
  check (previous_status is null or previous_status <> new_status)
);

insert into observability.current_states (
  source_key, subject_key, metric_key, value, unit, status, observed_at, producer
) values (
  'supabase', 'mini-tools', 'database_bytes', 100, 'bytes', 'ok',
  '2026-09-23T00:00:00+00', 'pc-saas-health-monitor'
);

insert into observability.status_events (
  event_id, source_key, subject_key, metric_key,
  previous_status, new_status, observed_at, producer
) values (
  'v1-event', 'supabase', 'mini-tools', 'database_bytes',
  'ok', 'warning', '2026-09-23T00:01:00+00', 'pc-saas-health-monitor'
);
"""


class ObservabilityV2MigrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        psql(v1_fixture())
        psql(MIGRATION)

    def test_existing_rows_stay_v1_legacy(self) -> None:
        out = psql(
            "select contract_version,coalesce(lifecycle_status,'NULL') "
            "from observability.current_states "
            "where source_key='supabase' and subject_key='mini-tools';"
        )
        self.assertEqual(out.strip(), "1|NULL")

    def test_v1_writer_shape_still_inserts(self) -> None:
        psql(
            "insert into observability.current_states "
            "(source_key,subject_key,metric_key,value,unit,status,observed_at,producer) values "
            "('line_messaging',null,'line_messages_sent',1,'count','ok',"
            "'2026-09-23T00:02:00+00','pc-saas-health-monitor');"
        )
        out = psql(
            "select contract_version from observability.current_states "
            "where source_key='line_messaging';"
        )
        self.assertEqual(out.strip(), "1")

    def test_v2_requires_explicit_identity_role_and_lifecycle(self) -> None:
        psql(
            "insert into observability.current_states "
            "(source_key,subject_key,metric_key,value,unit,status,observed_at,producer,"
            " contract_version,lifecycle_status) values "
            "('jobs','market_info:daily_fetch','hours_since_success',1,'hours','ok',"
            "'2026-09-23T00:03:00+00','pc-saas-health-monitor',2,'active');",
            expect_success=False,
        )

    def test_valid_v2_current_state_is_accepted(self) -> None:
        psql(
            "insert into observability.current_states "
            "(source_key,subject_key,metric_key,value,unit,status,observed_at,producer,"
            " contract_version,subject_kind,subject_label,product_slug,metric_label,metric_role,"
            " lifecycle_status,limit_value,usage_ratio,reason_code) values "
            "('jobs','market_info:daily_fetch','hours_since_success',1,'hours','ok',"
            "'2026-09-23T00:04:00+00','pc-saas-health-monitor',"
            "2,'job','Market Info daily fetch','market-info','最終成功から','headline',"
            "'active',48,0.02,'configured_threshold');"
        )
        out = psql(
            "select contract_version,lifecycle_status,product_slug "
            "from observability.current_states "
            "where source_key='jobs' and subject_key='market_info:daily_fetch';"
        )
        self.assertEqual(out.strip(), "2|active|market-info")

    def test_retired_requires_retired_at(self) -> None:
        psql(
            "insert into observability.current_states "
            "(source_key,subject_key,metric_key,status,observed_at,producer,"
            " contract_version,subject_kind,metric_role,lifecycle_status) values "
            "('jobs','old-job','state','unknown','2026-09-23T00:05:00+00',"
            "'pc-saas-health-monitor',2,'job','headline','retired');",
            expect_success=False,
        )

    def test_superseding_identity_is_all_or_none(self) -> None:
        psql(
            "insert into observability.current_states "
            "(source_key,subject_key,metric_key,status,observed_at,producer,"
            " contract_version,subject_kind,metric_role,lifecycle_status,retired_at,"
            " superseded_by_source_key) values "
            "('jobs','old-job-2','state','unknown','2026-09-23T00:06:00+00',"
            "'pc-saas-health-monitor',2,'job','headline','retired',"
            "'2026-09-23T00:06:00+00','jobs');",
            expect_success=False,
        )

    def test_v2_status_event_requires_identity_and_event_kind(self) -> None:
        psql(
            "insert into observability.status_events "
            "(event_id,source_key,subject_key,metric_key,previous_status,new_status,"
            " observed_at,producer,contract_version,subject_kind,event_kind) values "
            "('v2-event','jobs','market_info:daily_fetch','hours_since_success',"
            "'ok','warning','2026-09-23T00:07:00+00','pc-saas-health-monitor',"
            "2,'job','status_change');"
        )
        out = psql(
            "select contract_version,event_kind from observability.status_events "
            "where event_id='v2-event';"
        )
        self.assertEqual(out.strip(), "2|status_change")

    def test_lifecycle_event_kind_is_not_a_health_transition(self) -> None:
        psql(
            "insert into observability.status_events "
            "(event_id,source_key,subject_key,metric_key,previous_status,new_status,"
            " observed_at,producer,contract_version,subject_kind,event_kind) values "
            "('retire-event','jobs','old-job','state','ok','warning',"
            "'2026-09-23T00:08:00+00','pc-saas-health-monitor',2,'job','retired');",
            expect_success=False,
        )

    def test_migration_does_not_change_privilege_contract(self) -> None:
        lower = MIGRATION.lower()
        self.assertNotIn(" grant ", f" {lower} ")
        self.assertNotIn(" revoke ", f" {lower} ")
        self.assertNotIn("security definer", lower)


if __name__ == "__main__":
    unittest.main()
