"""Workspace Core SQL-lineage regression tests.

Static checks run everywhere.

A full 001-031 replay is available only on an explicitly disposable local
PostgreSQL 17+ cluster:

  WORKSPACE_CORE_TEST_DISPOSABLE_CLUSTER=1 \
  PGHOST=127.0.0.1 PGDATABASE=workspace_core_replay_test \
    python infra/workspace-core/tests/test_coordination_reconciliation.py

The integration test refuses non-loopback hosts and any other database name.
It never connects to Workspace Core production.
"""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
SQL_DIR = ROOT / "sql"
VERIFY = (ROOT / "operations" / "verify_coordination_reconciliation.sql").read_text()

# Explicit order is intentional: two historical files use the 014 prefix.
SQL_ORDER = [
    "001_registry_schema.sql",
    "002_seed_sources_and_repositories.sql",
    "003_seed_products_provisional.sql",
    "004_schema_hardening.sql",
    "005_add_provider_level_service_discovery.sql",
    "006_seed_discovered_assets.sql",
    "007_seed_trade_research_discovery.sql",
    "008_reconcile_discovery_snapshot.sql",
    "009_finalize_discovery_links.sql",
    "010_product_map_read_model.sql",
    "011_enrich_product_descriptions.sql",
    "012_service_value_layer.sql",
    "013_seed_provisional_services.sql",
    "014_observability_schema.sql",
    "014_v3_registry_functions_capabilities.sql",
    "015_v3_knowledge_evolution.sql",
    "016_v3_value_flow.sql",
    "017_seed_v3_golden_dataset.sql",
    "018_finalize_v3_golden_links.sql",
    "019_v3_natural_key_hardening.sql",
    "020_v3_fk_index_hardening.sql",
    "021_seed_v3_inventory_wave1_registry.sql",
    "022_seed_v3_inventory_wave1_knowledge.sql",
    "023_seed_v3_inventory_wave1_flows.sql",
    "024_seed_v3_inventory_wave2_registry.sql",
    "025_seed_v3_inventory_wave2_knowledge.sql",
    "026_seed_v3_inventory_wave2_flows.sql",
    "027_seed_v3_inventory_wave2_origins.sql",
    "028_seed_v3_diagram_pattern_knowledge.sql",
    "029_product_evolution_evidence_reader.sql",
    "030_observability_v2_context.sql",
    "031_coordination_current_state_reconciliation.sql",
]


def psql(sql: str) -> str:
    env = os.environ.copy()
    if env.get("PGHOST") not in ("127.0.0.1", "localhost"):
        raise RuntimeError("Tests require a loopback PGHOST")
    if env.get("PGDATABASE") != "workspace_core_replay_test":
        raise RuntimeError("Tests require PGDATABASE=workspace_core_replay_test")
    if env.get("WORKSPACE_CORE_TEST_DISPOSABLE_CLUSTER") != "1":
        raise RuntimeError(
            "Tests require WORKSPACE_CORE_TEST_DISPOSABLE_CLUSTER=1 because "
            "Workspace Core SQL creates cluster-wide roles"
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
        timeout=180,
        env=env,
    )
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout


class CoordinationReconciliationStaticTest(unittest.TestCase):
    def test_explicit_sql_order_is_complete(self) -> None:
        expected = {p.name for p in SQL_DIR.glob("*.sql")}
        self.assertEqual(set(SQL_ORDER), expected)

    def test_reconciliation_is_schema_only(self) -> None:
        sql = (SQL_DIR / SQL_ORDER[-1]).read_text().lower()
        self.assertNotIn("insert into coordination.", sql)
        self.assertNotIn("delete from coordination.", sql)
        self.assertNotIn("drop schema", sql)
        self.assertIn("create schema coordination", sql)

    def test_reconciliation_preserves_current_security_contract(self) -> None:
        sql = (SQL_DIR / SQL_ORDER[-1]).read_text().lower()
        self.assertGreaterEqual(sql.count("security_invoker = true"), 4)
        self.assertIn("enable row level security", sql)
        self.assertIn("revoke all on schema coordination from anon", sql)
        self.assertIn("revoke all on schema coordination from authenticated", sql)
        self.assertIn("grant usage on schema coordination to service_role", sql)

    def test_reconciliation_is_honest_about_historical_migrations(self) -> None:
        sql = (SQL_DIR / SQL_ORDER[-1]).read_text()
        for migration_name in (
            "coordination_workstreams_v0_1",
            "workspace_core_workstream_resume_read_model_v1",
            "chat_orchestration_v0_2_checkpoints",
            "chat_orchestration_v0_2_attention_class_fix",
            "architecture_alignment_review_v0_read_model",
        ):
            self.assertIn(migration_name, sql)

    def test_reconciliation_does_not_sneak_in_resume_v11(self) -> None:
        # 031 must reproduce current live behavior only. The selection fix belongs
        # to a later reviewed migration after the lineage-selection contract.
        sql = (SQL_DIR / SQL_ORDER[-1]).read_text()
        self.assertIn("thought_lineage_v0_pilot", sql)
        self.assertNotIn("thought_lineage_delta'::text", sql)


@unittest.skipUnless(
    os.environ.get("WORKSPACE_CORE_TEST_DISPOSABLE_CLUSTER") == "1",
    "requires explicitly marked disposable local PostgreSQL cluster",
)
class WorkspaceCoreCleanReplayTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        version = int(psql("show server_version_num;").strip())
        if version < 170000:
            raise RuntimeError("Full Workspace Core replay requires PostgreSQL 17+")

        existing = psql(
            "select count(*) from pg_namespace where nspname in "
            "('platform','registry','ops','knowledge','flow','observability','coordination');"
        ).strip()
        if existing != "0":
            raise RuntimeError(
                "workspace_core_replay_test must start without Workspace Core schemas"
            )

        # Supabase provides these roles. A plain disposable PostgreSQL cluster does not.
        psql(
            """
            do $$
            begin
              if not exists (select 1 from pg_roles where rolname='anon') then
                create role anon nologin;
              end if;
              if not exists (select 1 from pg_roles where rolname='authenticated') then
                create role authenticated nologin;
              end if;
              if not exists (select 1 from pg_roles where rolname='service_role') then
                create role service_role nologin bypassrls;
              end if;
            end
            $$;
            """
        )

        for filename in SQL_ORDER:
            psql((SQL_DIR / filename).read_text())

    def test_coordination_verification_passes(self) -> None:
        out = psql(VERIFY)
        self.assertIn("coordination-reconciliation-ok|65", out)

    def test_no_browser_role_can_read_coordination(self) -> None:
        out = psql(
            """
            select
              has_schema_privilege('anon','coordination','USAGE'),
              has_schema_privilege('authenticated','coordination','USAGE'),
              has_table_privilege(
                'anon','public.workspace_core_chat_orchestration_v','SELECT'
              ),
              has_table_privilege(
                'authenticated','public.workspace_core_chat_orchestration_v','SELECT'
              );
            """
        )
        self.assertEqual(out.strip(), "f|f|f|f")


if __name__ == "__main__":
    unittest.main()
