#!/usr/bin/env python3
"""Discover executable candidates without importing or executing repository code."""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import shlex
import sys
import tomllib
from dataclasses import asdict, dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

SCHEMA_VERSION = "0.1"
MAX_FILE_BYTES = 2_000_000
HTTP_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
SCRIPT_SUFFIXES = (".py", ".ps1", ".bat", ".cmd", ".js", ".mjs", ".cjs", ".ts", ".tsx")
IGNORED_DIRS = frozenset(
    {
        ".cache",
        ".git",
        ".mypy_cache",
        ".next",
        ".pytest_cache",
        ".ruff_cache",
        ".tox",
        ".turbo",
        ".venv",
        "__pycache__",
        "build",
        "coverage",
        "dist",
        "env",
        "node_modules",
        "output",
        "outputs",
        "tmp",
        "vendor",
        "venv",
    }
)
SENSITIVE_RE = re.compile(
    r"(?i)(?:password|passwd|secret|token|api[-_]?key|credential|"
    r"service[-_]?role[-_]?key|private[-_]?key|access[-_]?key)"
)
SENSITIVE_ENV_RE = re.compile(
    r"(?i)\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|CREDENTIAL|"
    r"SERVICE_ROLE_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*)=([^\s]+)"
)
WINDOWS_HOME_RE = re.compile(r"(?i)[a-z]:[\\/]users[\\/][^\\/\s]+")
LINUX_HOME_RE = re.compile(r"/home/[^/\s]+")
MAC_HOME_RE = re.compile(r"/Users/[^/\s]+")


@dataclass(frozen=True)
class Evidence:
    kind: str
    path: str
    rule: str
    line: int | None = None


@dataclass
class Candidate:
    repository: str
    repository_ref: str
    path: str
    symbol_or_route: str
    executable_type: str
    command: str | None = None
    trigger_types: list[str] = field(default_factory=list)
    actor_types: list[str] = field(default_factory=list)
    access_surfaces: list[str] = field(default_factory=list)
    execution_locus: str = "unknown"
    invokes: list[str] = field(default_factory=list)
    input_candidates: list[str] = field(default_factory=list)
    output_candidates: list[str] = field(default_factory=list)
    manual_touchpoints: list[str] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    verifier_candidates: list[str] = field(default_factory=list)
    evidence: list[Evidence] = field(default_factory=list)
    confidence: float = 0.0
    review_status: str = "discovered"

    def to_dict(self) -> dict[str, Any]:
        command_fields = {"invokes"}
        for key in (
            "trigger_types",
            "actor_types",
            "access_surfaces",
            "invokes",
            "input_candidates",
            "output_candidates",
            "manual_touchpoints",
            "constraints",
            "verifier_candidates",
        ):
            sanitizer = sanitize_command if key in command_fields else sanitize_text
            values = [sanitizer(str(value)) for value in getattr(self, key) if value]
            setattr(self, key, sorted(dict.fromkeys(values)))

        self.path = sanitize_text(self.path)
        self.symbol_or_route = sanitize_text(self.symbol_or_route)
        self.execution_locus = sanitize_text(self.execution_locus)
        if self.command:
            self.command = sanitize_command(self.command)
        self.evidence = sorted(
            dict.fromkeys(self.evidence),
            key=lambda item: (item.path, item.line or 0, item.kind, item.rule),
        )
        return asdict(self)


@dataclass(frozen=True)
class Context:
    root: Path
    repository: str
    repository_ref: str


def sanitize_text(value: str) -> str:
    value = WINDOWS_HOME_RE.sub("%USERPROFILE%", value)
    value = LINUX_HOME_RE.sub("~", value)
    value = MAC_HOME_RE.sub("~", value)
    return value.replace("\\", "/")


def sanitize_command(command: str) -> str:
    """Preserve command shape while redacting common literal credential forms."""

    command = sanitize_text(command.strip())
    command = re.sub(
        r"(?i)(https?://)([^/@\s]+):([^@\s]+)@",
        r"\1<redacted>@",
        command,
    )
    command = SENSITIVE_ENV_RE.sub(r"\1=<redacted>", command)
    command = re.sub(
        r"(?i)(authorization\s*[:=]\s*(?:bearer\s+)?)([^\s\"']+)",
        r"\1<redacted>",
        command,
    )
    try:
        tokens = shlex.split(command, posix=False)
    except ValueError:
        tokens = command.split()

    safe: list[str] = []
    redact_next = False
    for token in tokens[:30]:
        if redact_next:
            safe.append("<redacted>")
            redact_next = False
            continue
        if SENSITIVE_RE.search(token):
            if "=" in token:
                safe.append(token.split("=", 1)[0] + "=<redacted>")
            else:
                safe.append(token)
                redact_next = token.startswith("-")
            continue
        safe.append(token)
    return " ".join(safe)


def rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def read_text(path: Path) -> str | None:
    try:
        if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
            return None
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


def line_of(text: str, needle: str) -> int | None:
    index = text.find(needle)
    return None if index < 0 else text.count("\n", 0, index) + 1


def is_allowed_file(path: Path, root: Path) -> bool:
    relative = rel(path, root)
    name = path.name
    suffix = path.suffix.lower()

    if name.startswith(".env"):
        return False
    if name in {
        "pyproject.toml",
        "package.json",
        "Dockerfile",
        "cloudbuild.yaml",
        "cloudbuild.yml",
    }:
        return True
    if relative.startswith(".github/workflows/") and suffix in {".yml", ".yaml"}:
        return True
    if relative.startswith(".claude/skills/") and name == "SKILL.md":
        return True
    if name in {"AGENTS.md", "CLAUDE.md"}:
        return True
    if suffix in {".py", ".ps1", ".bat", ".cmd"}:
        return True
    if re.fullmatch(r"route\.(?:ts|tsx|js|jsx|mjs|cjs)", name) and "/api/" in f"/{relative}":
        return True
    return suffix in {".yaml", ".yml"} and name.startswith("system_map")


def iter_files(root: Path) -> Iterable[Path]:
    """Walk deterministically and prune dependency/build directories before descent."""

    for current, directories, filenames in os.walk(
        root,
        topdown=True,
        followlinks=False,
    ):
        current_path = Path(current)
        directories[:] = sorted(
            directory
            for directory in directories
            if directory not in IGNORED_DIRS
            and not (current_path / directory).is_symlink()
        )
        for filename in sorted(filenames):
            path = current_path / filename
            if path.is_symlink():
                continue
            if is_allowed_file(path, root):
                yield path


def dotted(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = dotted(node.value)
        return f"{base}.{node.attr}" if base else node.attr
    return None


def path_parts(node: ast.AST) -> list[str] | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return [node.value]
    if isinstance(node, ast.Name):
        return [] if node.id.upper() in {"ROOT", "REPO_ROOT", "PROJECT_ROOT", "BASE_DIR"} else None
    if isinstance(node, ast.Call) and dotted(node.func) in {"str", "Path"} and node.args:
        return path_parts(node.args[0])
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
        left = path_parts(node.left)
        right = path_parts(node.right)
        if left is not None and right is not None:
            return [*left, *right]
    return None


def static_string(node: ast.AST) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    parts = path_parts(node)
    return PurePosixPath(*parts).as_posix() if parts else None


def command_from_ast(node: ast.AST, variables: dict[str, str]) -> str | None:
    if isinstance(node, ast.Name):
        return variables.get(node.id)
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return sanitize_command(node.value)
    if not isinstance(node, (ast.List, ast.Tuple)):
        return None

    tokens: list[str] = []
    redact_next = False
    for element in node.elts:
        if redact_next:
            redact_next = False
            continue
        name = dotted(element)
        value = static_string(element)
        if name == "sys.executable":
            tokens.append("python")
            continue
        if not value:
            continue
        if SENSITIVE_RE.search(value) and value.startswith("-"):
            tokens.append(value)
            redact_next = True
            continue
        if (
            not tokens
            or value.startswith("-")
            or value.endswith(SCRIPT_SUFFIXES)
            or value in {
                "python",
                "python3",
                "node",
                "pnpm",
                "npm",
                "gh",
                "gcloud",
                "-m",
            }
        ):
            tokens.append(value)
    return sanitize_command(" ".join(tokens)) if tokens else None


def main_guard(node: ast.If) -> bool:
    test = node.test
    return (
        isinstance(test, ast.Compare)
        and isinstance(test.left, ast.Name)
        and test.left.id == "__name__"
        and len(test.ops) == 1
        and isinstance(test.ops[0], ast.Eq)
        and len(test.comparators) == 1
        and isinstance(test.comparators[0], ast.Constant)
        and test.comparators[0].value == "__main__"
    )


def python_candidates(path: Path, text: str, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    try:
        tree = ast.parse(text, filename=relative)
    except SyntaxError:
        return []

    variables: dict[str, str] = {}
    invokes: list[str] = []
    outputs: list[str] = []
    routers: list[str] = []
    has_argparse = False
    has_fastapi = False
    main_line: int | None = None
    fastapi_line: int | None = None

    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Assign)
            and len(node.targets) == 1
            and isinstance(node.targets[0], ast.Name)
        ):
            command = command_from_ast(node.value, variables)
            if command:
                variables[node.targets[0].id] = command

        if isinstance(node, ast.If) and main_guard(node):
            main_line = node.lineno

        if not isinstance(node, ast.Call):
            continue

        name = dotted(node.func) or ""
        has_argparse |= name.endswith("ArgumentParser")
        if name.endswith("FastAPI"):
            has_fastapi = True
            fastapi_line = node.lineno
        if name.endswith("include_router") and node.args:
            router = dotted(node.args[0])
            if router:
                routers.append(router)

        if (
            name
            in {
                "subprocess.run",
                "subprocess.Popen",
                "subprocess.check_call",
                "subprocess.check_output",
            }
            and node.args
        ):
            command = command_from_ast(node.args[0], variables)
            if command:
                invokes.append(command)

        for keyword in node.keywords:
            if keyword.arg in {"command", "cmd"}:
                command = command_from_ast(keyword.value, variables)
                if command:
                    invokes.append(command)

        if name.endswith(("write_text", "write_bytes")) and isinstance(node.func, ast.Attribute):
            target = static_string(node.func.value)
            if target:
                outputs.append(target)

    found: list[Candidate] = []
    if main_line is not None:
        found.append(
            Candidate(
                repository=ctx.repository,
                repository_ref=ctx.repository_ref,
                path=relative,
                symbol_or_route="__main__",
                executable_type="python_cli" if has_argparse else "python_main",
                command=f"python {relative}",
                trigger_types=["manual_or_parent_process"],
                actor_types=["human", "system"],
                access_surfaces=["local_cli"],
                execution_locus="local_pc_or_ci",
                invokes=invokes,
                output_candidates=outputs,
                evidence=[Evidence("code_ast", relative, "python.main_guard", main_line)],
                confidence=0.92 if has_argparse else 0.88,
            )
        )

    if has_fastapi:
        found.append(
            Candidate(
                repository=ctx.repository,
                repository_ref=ctx.repository_ref,
                path=relative,
                symbol_or_route="app",
                executable_type="fastapi_application",
                command=f"uvicorn {relative.removesuffix('.py').replace('/', '.')}:app",
                trigger_types=["container_or_manual_server"],
                actor_types=["system"],
                access_surfaces=["http_api"],
                execution_locus="server_runtime",
                invokes=[f"include_router:{router}" for router in routers],
                input_candidates=["HTTP request", "environment configuration"],
                output_candidates=["HTTP response"],
                constraints=["required runtime configuration"],
                verifier_candidates=["health endpoint", "OpenAPI schema"],
                evidence=[
                    Evidence(
                        "code_ast",
                        relative,
                        "python.fastapi_app",
                        fastapi_line,
                    )
                ],
                confidence=0.96,
            )
        )

    if "PIPELINE_EDGES" in text:
        found.append(
            Candidate(
                repository=ctx.repository,
                repository_ref=ctx.repository_ref,
                path=relative,
                symbol_or_route="PIPELINE_EDGES",
                executable_type="declared_pipeline_map",
                trigger_types=["manual_documentation_generation"],
                actor_types=["human", "system"],
                access_surfaces=["local_cli", "repository_documentation"],
                execution_locus="local_pc_or_ci",
                output_candidates=["declared pipeline documentation"],
                constraints=["declared design may drift from runtime"],
                evidence=[
                    Evidence(
                        "code_pattern",
                        relative,
                        "declared_map.pipeline_edges",
                        line_of(text, "PIPELINE_EDGES"),
                    )
                ],
                confidence=0.86,
            )
        )
    return found


def pyproject_candidates(path: Path, text: str, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    try:
        scripts = tomllib.loads(text).get("project", {}).get("scripts", {})
    except tomllib.TOMLDecodeError:
        return []
    if not isinstance(scripts, dict):
        return []

    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=relative,
            symbol_or_route=name,
            executable_type="python_package_entrypoint",
            command=name,
            trigger_types=["manual_or_parent_process"],
            actor_types=["human", "system"],
            access_surfaces=["local_cli", "scheduled_process"],
            execution_locus="local_pc_or_container",
            invokes=[target],
            evidence=[
                Evidence(
                    "manifest",
                    relative,
                    "python.project_scripts",
                    line_of(text, name),
                )
            ],
            confidence=0.99,
        )
        for name, target in sorted(scripts.items())
        if isinstance(target, str)
    ]


def package_candidates(path: Path, text: str, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    try:
        scripts = json.loads(text).get("scripts", {})
    except json.JSONDecodeError:
        return []
    if not isinstance(scripts, dict):
        return []

    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=relative,
            symbol_or_route=name,
            executable_type="node_package_script",
            command=f"npm run {name}",
            trigger_types=["manual_or_ci"],
            actor_types=["human", "system"],
            access_surfaces=["local_cli", "ci"],
            execution_locus="local_pc_or_ci",
            invokes=[command],
            verifier_candidates=[name]
            if name.startswith(("test", "lint", "build"))
            else [],
            evidence=[
                Evidence(
                    "manifest",
                    relative,
                    "node.package_scripts",
                    line_of(text, f'"{name}"'),
                )
            ],
            confidence=0.99,
        )
        for name, command in sorted(scripts.items())
        if isinstance(command, str)
    ]


def route_match(text: str, method: str) -> re.Match[str] | None:
    return re.search(
        rf"export\s+(?:(?:async\s+)?function\s+{method}\b|const\s+{method}\s*=)",
        text,
    )


def next_route_candidates(path: Path, text: str, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    matches = {method: route_match(text, method) for method in HTTP_METHODS}
    methods = [method for method, match in matches.items() if match]
    if not methods:
        return []

    route = re.sub(
        r"/route\.(?:ts|tsx|js|jsx|mjs|cjs)$",
        "",
        relative.removeprefix("app/"),
    )
    inputs = ["HTTP request"]
    constraints: list[str] = []
    invokes: list[str] = []

    if "cookies(" in text:
        inputs.append("session cookie")
    if "searchParams" in text or "new URL(" in text:
        inputs.append("query parameters")
    if "verifyPremiumSession" in text or "isAuthorized" in text:
        constraints.append("authenticated session")
    if re.search(r"SECRET|SERVICE_ROLE|server-only", text, re.IGNORECASE):
        constraints.append("server-only credential configuration")
    if "fetch(" in text or "fetchJson(" in text:
        invokes.append("external HTTP API")
    if "createWorkspaceCoreServerClient" in text or "createClient(" in text:
        invokes.append("Supabase or database client")

    first = matches[methods[0]]
    assert first is not None
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=relative,
            symbol_or_route=f"{','.join(methods)} /{route.strip('/')}",
            executable_type="nextjs_route_handler",
            trigger_types=["http_request"],
            actor_types=["human", "system"],
            access_surfaces=["web_ui", "http_api"],
            execution_locus="cloud_or_local_nextjs_server",
            invokes=invokes,
            input_candidates=inputs,
            output_candidates=["HTTP JSON or redirect response"],
            constraints=constraints,
            verifier_candidates=["route test", "HTTP status"],
            evidence=[
                Evidence(
                    "code_pattern",
                    relative,
                    "next.route_handler",
                    text.count("\n", 0, first.start()) + 1,
                )
            ],
            confidence=0.96,
        )
    ]


def script_refs(text: str) -> list[str]:
    refs = re.findall(
        r"(?i)[\w./\\-]+\.(?:py|ps1|bat|cmd|mjs|cjs|js|ts)",
        text,
    )
    return sorted(dict.fromkeys(sanitize_text(item.strip("\"'")) for item in refs))


def shell_candidates(path: Path, text: str, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    suffix = path.suffix.lower()
    scheduler = bool(
        re.search(
            r"(?i)\bschtasks\b.*?/create|Register-ScheduledTask|New-ScheduledTask",
            text,
        )
    )
    constraints: list[str] = []
    manual: list[str] = []
    invokes = script_refs(text)

    if re.search(r"(?i)RunAs|Administrator|elevat|UAC", text):
        constraints.append("administrator or UAC required for setup")
        manual.append("approve UAC or run elevated setup")
    if re.search(r"(?i)\b(login|2FA|MFA)\b", text):
        constraints.append("authenticated human session may be required")
        manual.append("complete login or multifactor authentication")
    if re.search(r"(?i)credential|keyring", text):
        constraints.append("local credential context")

    for command in (
        "python",
        "pythonw",
        "node",
        "npm",
        "pnpm",
        "gh",
        "gcloud",
        "wrangler",
        "schtasks",
    ):
        if re.search(
            rf"(?i)(?<![\w-]){re.escape(command)}(?:\.exe)?(?![\w-])",
            text,
        ):
            invokes.append(command)

    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=relative,
            symbol_or_route=path.name,
            executable_type=(
                "windows_scheduler_registration"
                if scheduler
                else ("powershell_script" if suffix == ".ps1" else "batch_script")
            ),
            command=f"powershell -File {relative}" if suffix == ".ps1" else relative,
            trigger_types=[
                "human_explicit_setup" if scheduler else "manual_or_parent_process"
            ],
            actor_types=["human", "system"],
            access_surfaces=[
                "windows_powershell" if suffix == ".ps1" else "windows_shell"
            ],
            execution_locus="windows_local_pc",
            invokes=invokes,
            manual_touchpoints=manual,
            constraints=constraints,
            verifier_candidates=["exit code", "task status"]
            if scheduler
            else ["exit code"],
            evidence=[
                Evidence(
                    "code_pattern",
                    relative,
                    "shell.scheduler" if scheduler else "shell.script",
                    1,
                )
            ],
            confidence=0.94 if scheduler else 0.82,
        )
    ]


def workflow_candidates(path: Path, text: str, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    invokes = [
        match.group(1).strip().strip("\"'")
        for match in re.finditer(
            r"(?m)^\s*(?:uses|run):\s*(.+?)\s*$",
            text,
        )
    ]
    triggers = ["github_event"]
    if re.search(r"(?m)^\s*schedule\s*:", text):
        triggers.append("schedule")
    if "workflow_dispatch" in text:
        triggers.append("manual_dispatch")

    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=relative,
            symbol_or_route=path.stem,
            executable_type="github_actions_workflow",
            trigger_types=triggers,
            actor_types=["system", "human"],
            access_surfaces=["github_ui", "git_push_or_pull_request"],
            execution_locus="github_actions_cloud",
            invokes=invokes,
            input_candidates=["repository checkout", "workflow event"],
            output_candidates=[
                "check status",
                "logs",
                "optional artifacts or deployment",
            ],
            constraints=[
                "GitHub availability",
                "configured workflow permissions and secrets",
            ],
            verifier_candidates=["workflow conclusion", "job status"],
            evidence=[Evidence("manifest", relative, "github_actions.workflow", 1)],
            confidence=0.98,
        )
    ]


def cloudbuild_candidates(path: Path, text: str, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    invokes = [
        match.group(1).strip().strip("\"'")
        for match in re.finditer(r"(?m)^\s*-\s+id:\s*(.+?)\s*$", text)
    ]
    invokes.extend(
        match.group(1).strip()
        for match in re.finditer(r"(?m)^\s+name:\s*(.+?)\s*$", text)
    )
    if "gcloud" in text and "run" in text and "services" in text:
        invokes.append("gcloud run services update")

    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=relative,
            symbol_or_route="cloudbuild",
            executable_type="cloud_build_pipeline",
            trigger_types=["cloud_build_trigger_or_manual_submit"],
            actor_types=["system", "human"],
            access_surfaces=["google_cloud_console", "git_push_or_cli"],
            execution_locus="google_cloud_build",
            invokes=invokes,
            input_candidates=["repository source", "substitution variables"],
            output_candidates=[
                "container image",
                "deployment",
                "Cloud Logging records",
            ],
            constraints=[
                "Google Cloud availability",
                "build service account permissions",
                "configured substitutions",
            ],
            verifier_candidates=["build result", "deployed revision health"],
            evidence=[Evidence("manifest", relative, "cloudbuild.pipeline", 1)],
            confidence=0.98,
        )
    ]


def docker_candidates(path: Path, text: str, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    matches = list(
        re.finditer(
            r"(?mi)^\s*(CMD|ENTRYPOINT)\s+(.+?)\s*$",
            text,
        )
    )
    if not matches:
        return []

    kind, raw = matches[-1].groups()
    try:
        parsed = json.loads(raw)
        command = " ".join(map(str, parsed)) if isinstance(parsed, list) else str(parsed)
    except json.JSONDecodeError:
        command = raw

    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=relative,
            symbol_or_route=kind.upper(),
            executable_type="container_entrypoint",
            command=command,
            trigger_types=["container_start"],
            actor_types=["system"],
            access_surfaces=["container_platform"],
            execution_locus="container_runtime",
            input_candidates=["container environment", "network requests"],
            output_candidates=["service process", "stdout and stderr logs"],
            constraints=[
                "container image build",
                "runtime environment configuration",
            ],
            verifier_candidates=["container health", "service health endpoint"],
            evidence=[
                Evidence(
                    "manifest",
                    relative,
                    "docker.entrypoint",
                    text.count("\n", 0, matches[-1].start()) + 1,
                )
            ],
            confidence=0.99,
        )
    ]


def frontmatter_name(text: str) -> str | None:
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end < 0:
        return None
    for line in text[3:end].splitlines():
        key, separator, value = line.partition(":")
        if separator and key.strip() == "name":
            return value.strip().strip("\"'")
    return None


def block_commands(text: str) -> list[str]:
    commands: list[str] = []
    for block in re.findall(
        r"```(?:bash|shell|powershell|cmd)?\s*\n(.*?)```",
        text,
        re.DOTALL | re.IGNORECASE,
    ):
        for line in block.splitlines():
            line = line.strip()
            if (
                line
                and not line.startswith("#")
                and re.match(
                    r"(?i)^(python|python3|claude|codex|gh|git|node|npm|pnpm|powershell|start)\b",
                    line,
                )
            ):
                commands.append(line)
    return sorted(dict.fromkeys(commands))


def skill_candidates(path: Path, text: str, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    name = frontmatter_name(text) or path.parent.name
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=relative,
            symbol_or_route=f"/{name}",
            executable_type="agent_skill",
            command=f"/{name}",
            trigger_types=["agent_intent_match_or_explicit_command"],
            actor_types=["human", "ai_agent"],
            access_surfaces=["claude_code_cli", "vscode_agent"],
            execution_locus="agent_runtime_and_local_pc",
            invokes=[*block_commands(text), *script_refs(text)],
            input_candidates=["user instruction", "repository context"],
            output_candidates=[
                "agent response",
                "optional helper-script artifacts",
            ],
            constraints=[
                "skill availability in agent search path",
                "helper runtime dependencies",
                "secrets must stay outside skill files",
            ],
            verifier_candidates=["helper exit code", "user-visible output"],
            evidence=[
                Evidence(
                    "agent_manifest",
                    relative,
                    "agent_skill.frontmatter",
                    1,
                )
            ],
            confidence=0.96,
        )
    ]


def contract_candidates(path: Path, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=relative,
            symbol_or_route=path.name,
            executable_type="agent_harness_contract",
            trigger_types=["agent_session_start_or_repository_work"],
            actor_types=["ai_agent", "human"],
            access_surfaces=["coding_agent"],
            execution_locus="agent_runtime",
            input_candidates=["repository policy and workflow context"],
            output_candidates=["constrained agent behavior"],
            constraints=["contract must be read before repository changes"],
            evidence=[Evidence("agent_contract", relative, "agent.instructions", 1)],
            confidence=0.90,
        )
    ]


def system_map_candidates(path: Path, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=relative,
            symbol_or_route=path.stem,
            executable_type="declared_system_map",
            trigger_types=["configuration_load"],
            actor_types=["human", "system"],
            access_surfaces=["system_map_ui", "repository_documentation"],
            execution_locus="local_application_or_ui",
            input_candidates=["hand-maintained nodes, edges and geometry"],
            output_candidates=["system map read model"],
            constraints=[
                "declared design may drift from runtime",
                "geometry is intentionally human-maintained",
            ],
            evidence=[Evidence("declared_design", relative, "system_map.yaml", 1)],
            confidence=0.88,
        )
    ]


def discover_file(path: Path, text: str, ctx: Context) -> list[Candidate]:
    relative = rel(path, ctx.root)
    name = path.name
    suffix = path.suffix.lower()

    if name == "pyproject.toml":
        return pyproject_candidates(path, text, ctx)
    if name == "package.json":
        return package_candidates(path, text, ctx)
    if name == "Dockerfile":
        return docker_candidates(path, text, ctx)
    if name in {"cloudbuild.yaml", "cloudbuild.yml"}:
        return cloudbuild_candidates(path, text, ctx)
    if relative.startswith(".github/workflows/"):
        return workflow_candidates(path, text, ctx)
    if relative.startswith(".claude/skills/") and name == "SKILL.md":
        return skill_candidates(path, text, ctx)
    if name in {"AGENTS.md", "CLAUDE.md"}:
        return contract_candidates(path, ctx)
    if suffix == ".py":
        return python_candidates(path, text, ctx)
    if suffix in {".ps1", ".bat", ".cmd"}:
        return shell_candidates(path, text, ctx)
    if (
        re.fullmatch(r"route\.(?:ts|tsx|js|jsx|mjs|cjs)", name)
        and "/api/" in f"/{relative}"
    ):
        return next_route_candidates(path, text, ctx)
    if suffix in {".yaml", ".yml"} and name.startswith("system_map"):
        return system_map_candidates(path, ctx)
    return []


def discover_repository(
    root: Path,
    repository: str,
    repository_ref: str = "unknown",
) -> dict[str, Any]:
    root = root.expanduser().resolve()
    if not root.is_dir():
        raise ValueError(f"repository root is not a directory: {root}")
    if not repository or "/" not in repository:
        raise ValueError("--repository must be in owner/name form")

    ctx = Context(root, repository, repository_ref or "unknown")
    candidates: list[Candidate] = []
    scanned: list[str] = []

    for path in iter_files(root):
        text = read_text(path)
        if text is None:
            continue
        scanned.append(rel(path, root))
        candidates.extend(discover_file(path, text, ctx))

    normalized = [candidate.to_dict() for candidate in candidates]
    normalized.sort(
        key=lambda item: (
            item["path"],
            item["executable_type"],
            item["symbol_or_route"],
        )
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "repository": repository,
        "repository_ref": repository_ref or "unknown",
        "scan_mode": "read_only_static_candidate_discovery",
        "review_status": "discovered",
        "scanned_files": scanned,
        "candidate_count": len(normalized),
        "candidates": normalized,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo",
        required=True,
        type=Path,
        help="Local repository root to scan.",
    )
    parser.add_argument(
        "--repository",
        required=True,
        help="Stable owner/name identifier.",
    )
    parser.add_argument(
        "--repository-ref",
        default="unknown",
        help="Caller-supplied commit SHA; the scanner does not invoke git.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Write JSON here instead of stdout.",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Emit compact JSON.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        payload = discover_repository(
            args.repo,
            args.repository,
            args.repository_ref,
        )
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 2

    rendered = (
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=None if args.compact else 2,
            sort_keys=True,
        )
        + "\n"
    )
    if args.output:
        output = args.output.expanduser()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
