from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

DISCOVERY_DIR = Path(__file__).resolve().parents[1]
for module_name in ("discover_executables", "run_initial_scan"):
    module_path = DISCOVERY_DIR / f"{module_name}.py"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

runner = sys.modules["run_initial_scan"]


class InitialScanRunnerTests(unittest.TestCase):
    def test_scans_available_repositories_and_reports_missing_without_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dev_root = root / "dev"
            output_root = root / "reports"
            repo = dev_root / "mini-tools"
            repo.mkdir(parents=True)
            (repo / "package.json").write_text(
                json.dumps({"scripts": {"test": "vitest run"}}),
                encoding="utf-8",
            )

            specs = (
                ("mini-tools", "owner/mini-tools"),
                ("missing", "owner/missing"),
            )
            summary = runner.run_initial_scans(dev_root, output_root, iter(specs))

            self.assertEqual(2, summary["requested_repository_count"])
            self.assertEqual(1, summary["scanned_repository_count"])
            self.assertEqual(["owner/missing"], summary["missing_repositories"])
            self.assertEqual([], summary["skipped_dirty_repositories"])
            self.assertEqual([], summary["skipped_branch_repositories"])
            self.assertEqual("current_checkout", summary["snapshot_role"])
            self.assertEqual("discovered", summary["review_status"])
            self.assertEqual("0.2", summary["normalization_version"])
            self.assertTrue((output_root / "mini-tools.executables.json").is_file())
            self.assertTrue((output_root / "summary.json").is_file())

            rendered = json.dumps(summary, ensure_ascii=False, sort_keys=True)
            self.assertNotIn(str(root), rendered)

    def test_untracked_scannable_file_marks_repository_dirty(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            repo = self._create_dirty_repository(Path(temp))

            head, state = runner.repository_state(repo)

            self.assertNotEqual("unknown", head)
            self.assertEqual("dirty", state)

    def test_dirty_repository_is_skipped_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dev_root = root / "dev"
            output_root = root / "reports"
            self._create_dirty_repository(dev_root, folder="mini-tools")

            summary = runner.run_initial_scans(
                dev_root,
                output_root,
                (("mini-tools", "owner/mini-tools"),),
            )

            self.assertEqual(0, summary["scanned_repository_count"])
            self.assertEqual(
                ["owner/mini-tools"],
                summary["skipped_dirty_repositories"],
            )
            self.assertFalse((output_root / "mini-tools.executables.json").exists())

    def test_allow_dirty_marks_working_tree_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dev_root = root / "dev"
            output_root = root / "reports"
            self._create_dirty_repository(dev_root, folder="mini-tools")

            summary = runner.run_initial_scans(
                dev_root,
                output_root,
                (("mini-tools", "owner/mini-tools"),),
                allow_dirty=True,
                snapshot_role="working_draft",
            )
            report = json.loads(
                (output_root / "mini-tools.executables.json").read_text(
                    encoding="utf-8"
                )
            )

            self.assertEqual(1, summary["scanned_repository_count"])
            self.assertTrue(report["repository_ref"].endswith("+dirty"))
            self.assertEqual(
                "working_tree_snapshot",
                report["repository_evidence_scope"],
            )
            self.assertEqual("working_draft", report["repository_snapshot_role"])
            self.assertTrue(report["repository_snapshot_stable"])
            self.assertEqual(
                report["repository_ref"],
                report["candidates"][0]["repository_ref"],
            )
            self.assertNotIn(str(root), json.dumps(summary, sort_keys=True))

    def test_canonical_main_records_branch_and_snapshot_role(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dev_root = root / "dev"
            output_root = root / "reports"
            self._create_clean_repository(dev_root, folder="mini-tools", branch="main")

            summary = runner.run_initial_scans(
                dev_root,
                output_root,
                (("mini-tools", "owner/mini-tools"),),
                snapshot_role="canonical_main",
            )
            report = json.loads(
                (output_root / "mini-tools.executables.json").read_text(
                    encoding="utf-8"
                )
            )

            self.assertEqual("main", summary["required_branch"])
            self.assertEqual("canonical_main", summary["snapshot_role"])
            self.assertEqual("main", report["repository_branch"])
            self.assertEqual("canonical_main", report["repository_snapshot_role"])
            self.assertEqual("commit", report["repository_evidence_scope"])
            self.assertTrue(
                all(
                    candidate["repository_branch"] == "main"
                    and candidate["repository_snapshot_role"] == "canonical_main"
                    for candidate in report["candidates"]
                )
            )

    def test_canonical_main_skips_clean_feature_branch(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dev_root = root / "dev"
            output_root = root / "reports"
            self._create_clean_repository(
                dev_root,
                folder="mini-tools",
                branch="feat/device-map",
            )

            summary = runner.run_initial_scans(
                dev_root,
                output_root,
                (("mini-tools", "owner/mini-tools"),),
                snapshot_role="canonical_main",
            )

            self.assertEqual(0, summary["scanned_repository_count"])
            self.assertEqual(
                [
                    {
                        "repository": "owner/mini-tools",
                        "current_branch": "feat/device-map",
                        "required_branch": "main",
                    }
                ],
                summary["skipped_branch_repositories"],
            )
            self.assertFalse((output_root / "mini-tools.executables.json").exists())

    def test_development_branch_is_recorded_separately(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dev_root = root / "dev"
            output_root = root / "reports"
            self._create_clean_repository(
                dev_root,
                folder="mini-tools",
                branch="feat/device-map",
            )

            summary = runner.run_initial_scans(
                dev_root,
                output_root,
                (("mini-tools", "owner/mini-tools"),),
                snapshot_role="development_branch",
            )
            report = json.loads(
                (output_root / "mini-tools.executables.json").read_text(
                    encoding="utf-8"
                )
            )

            self.assertEqual(1, summary["scanned_repository_count"])
            self.assertEqual("development_branch", summary["snapshot_role"])
            self.assertEqual("feat/device-map", report["repository_branch"])
            self.assertEqual(
                "development_branch",
                report["repository_snapshot_role"],
            )

    def test_rejects_dirty_canonical_main_contract(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(ValueError):
                runner.run_initial_scans(
                    Path(temp),
                    Path(temp) / "reports",
                    (),
                    allow_dirty=True,
                    snapshot_role="canonical_main",
                )

    @staticmethod
    def _create_clean_repository(
        root: Path,
        folder: str = "repo",
        branch: str = "main",
    ) -> Path:
        repo = root / folder
        repo.mkdir(parents=True)
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        subprocess.run(
            ["git", "-C", str(repo), "config", "user.name", "Fixture"],
            check=True,
        )
        subprocess.run(
            ["git", "-C", str(repo), "config", "user.email", "fixture@example.invalid"],
            check=True,
        )
        (repo / "package.json").write_text(
            json.dumps({"scripts": {"test": "vitest run"}}),
            encoding="utf-8",
        )
        subprocess.run(["git", "-C", str(repo), "add", "package.json"], check=True)
        subprocess.run(
            ["git", "-C", str(repo), "commit", "-q", "-m", "fixture"],
            check=True,
        )
        subprocess.run(
            ["git", "-C", str(repo), "branch", "-M", branch],
            check=True,
        )
        return repo

    @classmethod
    def _create_dirty_repository(cls, root: Path, folder: str = "repo") -> Path:
        repo = cls._create_clean_repository(root, folder=folder)
        (repo / "untracked_tool.py").write_text(
            'if __name__ == "__main__":\n    print("fixture")\n',
            encoding="utf-8",
        )
        return repo


if __name__ == "__main__":
    unittest.main()