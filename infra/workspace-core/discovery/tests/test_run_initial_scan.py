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
            self.assertTrue(report["repository_snapshot_stable"])
            self.assertEqual(
                report["repository_ref"],
                report["candidates"][0]["repository_ref"],
            )
            self.assertNotIn(str(root), json.dumps(summary, sort_keys=True))

    @staticmethod
    def _create_dirty_repository(root: Path, folder: str = "repo") -> Path:
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
        (repo / "untracked_tool.py").write_text(
            'if __name__ == "__main__":\n    print("fixture")\n',
            encoding="utf-8",
        )
        return repo


if __name__ == "__main__":
    unittest.main()