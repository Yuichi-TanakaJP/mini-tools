from __future__ import annotations

import importlib.util
import json
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
            self.assertEqual("discovered", summary["review_status"])
            self.assertTrue((output_root / "mini-tools.executables.json").is_file())
            self.assertTrue((output_root / "summary.json").is_file())

            rendered = json.dumps(summary, ensure_ascii=False, sort_keys=True)
            self.assertNotIn(str(root), rendered)


if __name__ == "__main__":
    unittest.main()
