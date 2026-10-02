from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "discover_executables.py"
SPEC = importlib.util.spec_from_file_location("discover_executables", MODULE_PATH)
assert SPEC and SPEC.loader
scanner = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = scanner
SPEC.loader.exec_module(scanner)


class DiscoveryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self._write(
            "pyproject.toml",
            """
[project]
name = "fixture"
version = "0.1.0"
[project.scripts]
fixture-cli = "fixture.cli:main"
""".strip(),
        )
        self._write(
            "package.json",
            json.dumps(
                {
                    "scripts": {
                        "build": "API_TOKEN=super-secret next build",
                        "test": "vitest run",
                    }
                }
            ),
        )
        self._write(
            "src/orchestrator.py",
            """
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
child = [sys.executable, str(ROOT / "src" / "child.py"), "--token", "super-secret"]

def main():
    argparse.ArgumentParser()
    subprocess.run(child, check=True)
    Path("C:/Users/Alice/private/output.json").write_text("{}")

if __name__ == "__main__":
    main()
""".strip(),
        )
        self._write(
            "app/main.py",
            """
from fastapi import FastAPI
from app.routers import health
app = FastAPI()
app.include_router(health.router)
""".strip(),
        )
        self._write(
            "app/api/premium/items/route.ts",
            """
import { cookies } from "next/headers";
export async function GET(request: Request) {
  const session = (await cookies()).get("session");
  const url = new URL(request.url);
  return fetch("https://example.invalid/items?x=" + url.searchParams.get("x"));
}
export const POST = buildPostRoute();
""".strip(),
        )
        self._write(
            "scripts/register-task.ps1",
            """
Start-Process powershell -Verb RunAs
schtasks /Create /TN Fixture /TR "python src/child.py" /SC DAILY /F
""".strip(),
        )
        self._write(
            ".github/workflows/ci.yml",
            """
name: CI
on:
  pull_request:
  workflow_dispatch:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
""".strip(),
        )
        self._write(
            "Dockerfile",
            'FROM python:3.11-slim\nCMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]\n',
        )
        self._write(
            "cloudbuild.yaml",
            """
steps:
  - id: Build
    name: gcr.io/cloud-builders/docker
  - id: Deploy
    name: gcr.io/google.com/cloudsdktool/cloud-sdk:slim
    args: [run, services, update, fixture]
""".strip(),
        )
        self._write(
            ".claude/skills/dev-status/SKILL.md",
            """
---
name: dev-status
description: Read-only status.
---
```bash
python .claude/skills/dev-status/dev_status.py --html
```
""".strip(),
        )
        self._write(
            ".claude/skills/dev-status/dev_status.py",
            """
if __name__ == "__main__":
    print("ok")
""".strip(),
        )
        self._write("AGENTS.md", "Read this before changing the repository.")
        self._write(
            "config/system_map.example.yaml",
            "title: Fixture\nnodes: []\nedges: []\n",
        )
        self._write(".env.local", "API_TOKEN=super-secret\n")
        self._write(
            "node_modules/deep/ignored_tool.py",
            'if __name__ == "__main__":\n    print("must not scan")\n',
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _write(self, rel: str, text: str) -> None:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def test_detects_representative_entrypoints(self) -> None:
        result = scanner.discover_repository(self.root, "owner/fixture", "abc123")
        types = {item["executable_type"] for item in result["candidates"]}
        self.assertTrue(
            {
                "python_package_entrypoint",
                "node_package_script",
                "python_cli",
                "fastapi_application",
                "nextjs_route_handler",
                "windows_scheduler_registration",
                "github_actions_workflow",
                "container_entrypoint",
                "cloud_build_pipeline",
                "agent_skill",
                "agent_harness_contract",
                "declared_system_map",
            }.issubset(types)
        )
        self.assertEqual("discovered", result["review_status"])
        self.assertEqual("abc123", result["repository_ref"])
        route = next(
            item
            for item in result["candidates"]
            if item["executable_type"] == "nextjs_route_handler"
        )
        self.assertEqual("GET,POST /api/premium/items", route["symbol_or_route"])

    def test_output_is_deterministic_and_does_not_leak_secret_or_root(self) -> None:
        first = scanner.discover_repository(self.root, "owner/fixture", "abc123")
        second = scanner.discover_repository(self.root, "owner/fixture", "abc123")
        self.assertEqual(first, second)
        rendered = json.dumps(first, ensure_ascii=False, sort_keys=True)
        self.assertNotIn("super-secret", rendered)
        self.assertNotIn(str(self.root), rendered)
        self.assertNotIn("C:/Users/Alice", rendered)
        self.assertIn("%USERPROFILE%/private/output.json", rendered)
        self.assertNotIn(".env.local", first["scanned_files"])
        self.assertFalse(
            any(path.startswith("node_modules/") for path in first["scanned_files"])
        )

    def test_python_subprocess_keeps_structure_and_redacts_sensitive_value(self) -> None:
        result = scanner.discover_repository(self.root, "owner/fixture", "abc123")
        orchestrator = next(
            item
            for item in result["candidates"]
            if item["path"] == "src/orchestrator.py"
            and item["executable_type"] == "python_cli"
        )
        joined = " ".join(orchestrator["invokes"])
        self.assertIn("src/child.py", joined)
        self.assertNotIn("super-secret", joined)

    def test_invalid_repository_identifier_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            scanner.discover_repository(self.root, "fixture", "abc123")


if __name__ == "__main__":
    unittest.main()
