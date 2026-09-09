from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

DISCOVERY_DIR = Path(__file__).resolve().parents[1]
for module_name in (
    "discover_executables",
    "candidate_policy",
    "scan_repository",
):
    module_path = DISCOVERY_DIR / f"{module_name}.py"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

scanner = sys.modules["scan_repository"]


class CandidatePolicyTests(unittest.TestCase):
    def test_normalizes_known_static_parser_noise_without_accepting_candidates(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self._write(
                root,
                "false_marker.py",
                'MARKER_NAME = "PIPELINE_EDGES"\n',
            )
            self._write(
                root,
                "real_map.py",
                "PIPELINE_EDGES: list[tuple[str, str]] = []\n",
            )
            self._write(
                root,
                "tests/test_tool.py",
                'if __name__ == "__main__":\n    print("test")\n',
            )
            self._write(
                root,
                ".github/workflows/ci.yml",
                """
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          echo first
      - run: >-
          python -m unittest
""".strip(),
            )

            result = scanner.scan_repository(root, "owner/fixture", "abc123")

            self.assertEqual("discovered", result["review_status"])
            self.assertGreater(result["raw_candidate_count"], result["candidate_count"])
            self.assertTrue(
                all(
                    candidate["review_status"] == "discovered"
                    for candidate in result["candidates"]
                )
            )

            declared_maps = [
                candidate
                for candidate in result["candidates"]
                if candidate["executable_type"] == "declared_pipeline_map"
            ]
            self.assertEqual(["real_map.py"], [item["path"] for item in declared_maps])
            self.assertTrue(
                any(
                    candidate["executable_type"] == "python_test_entrypoint"
                    and candidate["path"] == "tests/test_tool.py"
                    for candidate in result["candidates"]
                )
            )
            self.assertFalse(
                any(
                    invocation in {"|", "|-", ">", ">-"}
                    for candidate in result["candidates"]
                    for invocation in candidate["invokes"]
                )
            )
            self.assertEqual(
                [
                    {
                        "path": "false_marker.py",
                        "reason": "pipeline_edges_name_without_assignment",
                    }
                ],
                result["normalization_dropped"],
            )

    @staticmethod
    def _write(root: Path, relative: str, content: str) -> None:
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
