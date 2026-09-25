"""Observability V2 schema contract against a disposable local PostgreSQL DB.

Run with:
  OBSERVABILITY_TEST_DISPOSABLE_CLUSTER=1 \
  PGHOST=127.0.0.1 PGDATABASE=observability_v2_test \
    python infra/workspace-core/tests/test_observability_v2_context.py

The test refuses non-loopback hosts, any other database name, and clusters not
explicitly marked disposable. Applying the real V1.1 schema creates and alters
cluster-wide roles, so run this only as a superuser in a throwaway PostgreSQL
cluster. It never connects to Workspace Core production.
"""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
BASE_MIGRATION = (ROOT / "sql" / "014_observability_schema.sql").read_text()
MIGRATION = (ROOT / "sql" / "030_observability_v2_context.sql").read_text()


def psql(
    sql: str, *, expect_success: bool = True, expected_error: str | None = None
) -> str:
    env = os.environ.copy()
    if env.get("PGHOST") not in ("127.0.0.1", "localhost"):
        raise RuntimeError("Tests require a loopback PGHOST")
    if env.get("PGDATABASE") != "observability_v2_test":
        raise RuntimeError("Tests require PGDATABASE=observability_v2_test")
    if env.get("OBSERVABILITY_TEST_DISPOSABLE_CLUSTER") != "1":
        raise RuntimeError(
            "Tests require OBSERVABILITY_TEST_DISPOSABLE_CLUSTER=1 because the "
            "V1.1 migration changes cluster-wide roles"
        )
    env["PGCLIENTENCODING"] = "UTF8"

    result = subprocess.run(
        [
            "psql",
            "-X",
            "-w",
            "-At",
            "-v",
            "ON_ERROR_STOP=1",
            "-v",
            "VERBOSITY=verbose",
        ],
        input=sql,
        text=True,
        encoding="utf-8",
        capture_output=True,
        timeout=60,
        env=env,
    )
    if expect_success and result.returncode:
        raise AssertionError(result.stderr)
    if not expect_success and not result.returncode:
        raise AssertionError("statement unexpectedly succeeded")
    if expected_error is not None and expected_error not in result.stderr:
        raise AssertionError(
            f"expected error containing {expected_error!r}, got {result.stderr!r}"
        )
    return result.stdout


def role_and_schema_fixture() -> str:
    return r"""
drop schema if exists observability cascade;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;
create schema if not exists registry;
create schema if not exists platform;
create schema if not exists ops;
"""


def v1_rows() -> str:
    return r"""

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
        if psql("select rolsuper from pg_roles where rolname=current_user;").strip() != "t":
            raise RuntimeError(
                "Tests require a PostgreSQL superuser in a disposable cluster"
            )
        psql(role_and_schema_fixture())
        psql(BASE_MIGRATION)
        psql(v1_rows())
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

    def test_active_row_cannot_claim_a_superseding_identity(self) -> None:
        psql(
            "insert into observability.current_states "
            "(source_key,subject_key,metric_key,status,observed_at,producer,"
            " contract_version,subject_kind,metric_role,lifecycle_status,"
            " superseded_by_source_key,superseded_by_subject_key,superseded_by_metric_key) values "
            "('jobs','still-active','state','ok','2026-09-23T00:06:30+00',"
            "'pc-saas-health-monitor',2,'job','headline','active',"
            "'jobs','replacement','state');",
            expect_success=False,
        )

    def test_retired_row_accepts_complete_superseding_identity(self) -> None:
        psql(
            "insert into observability.current_states "
            "(source_key,subject_key,metric_key,status,observed_at,producer,"
            " contract_version,subject_kind,metric_role,lifecycle_status,retired_at,"
            " superseded_by_source_key,superseded_by_subject_key,superseded_by_metric_key) values "
            "('jobs','old-complete','state','unknown','2026-09-23T00:06:45+00',"
            "'pc-saas-health-monitor',2,'job','headline','retired',"
            "'2026-09-23T00:06:45+00','jobs','replacement','state');"
        )
        out = psql(
            "select lifecycle_status,superseded_by_subject_key "
            "from observability.current_states where subject_key='old-complete';"
        )
        self.assertEqual(out.strip(), "retired|replacement")

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

    def test_strict_newer_guard_rejects_equal_and_older_updates(self) -> None:
        out = psql(
            "set role observability_writer; "
            "insert into observability.current_states "
            "(source_key,subject_key,metric_key,value,unit,status,observed_at,producer) values "
            "('supabase','mini-tools','database_bytes',999,'bytes','critical',"
            "'2026-09-23T00:00:00+00','pc-saas-health-monitor') "
            "on conflict(source_key,subject_key,metric_key) do update set "
            "value=excluded.value,status=excluded.status,observed_at=excluded.observed_at; "
            "insert into observability.current_states "
            "(source_key,subject_key,metric_key,value,unit,status,observed_at,producer) values "
            "('supabase','mini-tools','database_bytes',888,'bytes','warning',"
            "'2026-09-22T23:59:59+00','pc-saas-health-monitor') "
            "on conflict(source_key,subject_key,metric_key) do update set "
            "value=excluded.value,status=excluded.status,observed_at=excluded.observed_at; "
            "select value,status from observability.current_states "
            "where source_key='supabase' and subject_key='mini-tools' "
            "and metric_key='database_bytes';"
        )
        self.assertEqual(out.strip().splitlines()[-1], "100|ok")

    def test_writer_effective_privileges_remain_least_privilege(self) -> None:
        out = psql(
            "select "
            "has_table_privilege('observability_writer',"
            "'observability.current_states','SELECT,INSERT,UPDATE'),"
            "has_table_privilege('observability_writer',"
            "'observability.current_states','DELETE,TRUNCATE'),"
            "has_table_privilege('observability_writer',"
            "'observability.status_events','SELECT,INSERT'),"
            "has_table_privilege('observability_writer',"
            "'observability.status_events','UPDATE,DELETE,TRUNCATE'),"
            "has_schema_privilege('observability_writer','registry','USAGE'),"
            "has_schema_privilege('observability_writer','platform','USAGE'),"
            "has_schema_privilege('observability_writer','ops','USAGE');"
        )
        self.assertEqual(out.strip(), "t|f|t|f|f|f|f")

    def test_status_events_remain_append_only_for_writer(self) -> None:
        psql(
            "set role observability_writer; "
            "update observability.status_events set message='mutated' "
            "where event_id='v1-event';",
            expect_success=False,
            expected_error="42501",
        )

    def test_rls_and_invoker_functions_remain_in_force(self) -> None:
        tables = psql(
            "select bool_and(c.relrowsecurity) "
            "from pg_class c join pg_namespace n on n.oid=c.relnamespace "
            "where n.nspname='observability' and c.relkind='r';"
        )
        functions = psql(
            "select bool_and(not p.prosecdef) "
            "from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
            "where n.nspname='observability';"
        )
        self.assertEqual(tables.strip(), "t")
        self.assertEqual(functions.strip(), "t")


if __name__ == "__main__":
    unittest.main()
