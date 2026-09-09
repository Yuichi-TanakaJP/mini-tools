from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

DISCOVERY_DIR = Path(__file__).resolve().parents[1]
for module_name in (
    "discover_executables",
    "command_safety",
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
          echo second
      - run: >-
          python -m unittest discover
          -s tests
          -v
""".strip(),
            )
            self._write(
                root,
                "src/app/api/items/route.ts",
                "export async function GET() { return Response.json({ ok: true }); }\n",
            )
            self._write(
                root,
                "package.json",
                json.dumps(
                    {
                        "scripts": {
                            "space-form": "API_TOKEN fixture-value next build",
                            "header-form": "curl -H X-API-Key:fixture-value https://example.invalid",
                            "auth-form": 'curl --header "Authorization: Bearer fixture-value" https://example.invalid',
                        }
                    }
                ),
            )

            result = scanner.scan_repository(root, "owner/fixture", "abc123")

            self.assertEqual("discovered", result["review_status"])
            self.assertEqual("0.2", result["normalization_version"])
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

            workflow = next(
                candidate
                for candidate in result["candidates"]
                if candidate["executable_type"] == "github_actions_workflow"
            )
            self.assertFalse(
                any(invocation in {"|", "|-", ">", ">-"} for invocation in workflow["invokes"])
            )
            self.assertIn("echo first ; echo second", workflow["invokes"])
            self.assertIn(
                "python -m unittest discover -s tests -v",
                workflow["invokes"],
            )

            route = next(
                candidate
                for candidate in result["candidates"]
                if candidate["executable_type"] == "nextjs_route_handler"
            )
            self.assertEqual("GET /api/items", route["symbol_or_route"])

            rendered = json.dumps(result, ensure_ascii=False, sort_keys=True)
            self.assertNotIn("fixture-value", rendered)
            self.assertIn("<redacted>", rendered)
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