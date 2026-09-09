#!/usr/bin/env python3
"""Read-only repository scanner for Workspace Core executable candidates.

The scanner never imports or executes repository code. It only reads a small,
explicit allow-list of source and manifest files and emits deterministic JSON
whose candidates always start in ``discovered`` state.
"""

from __future__ import annotations

import argparse
import ast
import json
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
        ".git",
        ".next",
        ".pytest_cache",
        ".ruff_cache",
        ".venv",
        "__pycache__",
        "build",
        "coverage",
        "dist",
        "node_modules",
        "output",
        "outputs",
        "tmp",
        "vendor",
    }
)
SENSITIVE_FLAG_RE = re.compile(r"(?i)(?:password|passwd|secret|token|api[-_]?key|credential)")
WINDOWS_HOME_RE = re.compile(r"(?i)[a-z]:[\\/]users[\\/][^\\/\s]+")
UNIX_HOME_RE = re.compile(r"/home/[^/\s]+")


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

    def normalize(self) -> None:
        for name in (
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
            values = getattr(self, name)
            setattr(self, name, sorted(dict.fromkeys(v for v in values if v)))
        self.evidence = sorted(
            dict.fromkeys(self.evidence),
            key=lambda item: (item.path, item.line or 0, item.kind, item.rule),
        )
        if self.command:
            self.command = sanitize_text(self.command)

    def to_dict(self) -> dict[str, Any]:
        self.normalize()
        return asdict(self)


@dataclass(frozen=True)
class ScanContext:
    root: Path
    repository: str
    repository_ref: str


def sanitize_text(value: str) -> str:
    """Remove user-specific absolute home paths and normalize separators."""

    value = WINDOWS_HOME_RE.sub("%USERPROFILE%", value)
    value = UNIX_HOME_RE.sub("~", value)
    return value.replace("\\", "/")


def safe_relative(path: Path, root: Path) -> str:
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


def iter_candidate_files(root: Path) -> Iterable[Path]:
    """Yield only allow-listed files without following ignored directory trees."""

    for path in root.rglob("*"):
        if any(part in IGNORED_DIRS for part in path.relative_to(root).parts[:-1]):
            continue
        if path.is_symlink() or not path.is_file():
            continue
        rel = safe_relative(path, root)
        name = path.name
        suffix = path.suffix.lower()
        if name.startswith(".env"):
            continue
        if name in {"pyproject.toml", "package.json", "Dockerfile", "cloudbuild.yaml", "cloudbuild.yml"}:
            yield path
            continue
        if rel.startswith(".github/workflows/") and suffix in {".yml", ".yaml"}:
            yield path
            continue
        if rel.startswith(".claude/skills/") and name == "SKILL.md":
            yield path
            continue
        if name in {"AGENTS.md", "CLAUDE.md"}:
            yield path
            continue
        if suffix in {".py", ".ps1", ".bat", ".cmd"}:
            yield path
            continue
        if re.fullmatch(r"route\.(?:ts|tsx|js|jsx|mjs|cjs)", name) and "/api/" in f"/{rel}":
            yield path
            continue
        if suffix in {".yaml", ".yml"} and name.startswith("system_map"):
            yield path


def dotted_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = dotted_name(node.value)
        return f"{base}.{node.attr}" if base else node.attr
    return None


def path_parts(node: ast.AST) -> list[str] | None:
    """Resolve simple ``ROOT / 'src' / 'cli' / 'x.py'`` expressions."""

    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return [node.value]
    if isinstance(node, ast.Name):
        return [] if node.id.upper() in {"ROOT", "REPO_ROOT", "PROJECT_ROOT", "BASE_DIR"} else None
    if isinstance(node, ast.Call) and dotted_name(node.func) in {"str", "Path"} and node.args:
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
    if parts is not None and parts:
        return PurePosixPath(*parts).as_posix()
    return None


def command_from_ast(node: ast.AST, variables: dict[str, str]) -> str | None:
    if isinstance(node, ast.Name):
        if node.id in variables:
            return variables[node.id]
        if node.id in {"python", "python3", "node", "pnpm", "npm", "gh", "gcloud"}:
            return node.id
        return None
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return sanitize_command(node.value)
    if isinstance(node, (ast.List, ast.Tuple)):
        tokens: list[str] = []
        skip_next = False
        for element in node.elts:
            if skip_next:
                skip_next = False
                continue
            name = dotted_name(element)
            if name in {"sys.executable", "python", "python3"}:
                tokens.append("python")
                continue
            value = static_string(element)
            if not value:
                continue
            if SENSITIVE_FLAG_RE.search(value) and value.startswith("-"):
                tokens.append(value)
                skip_next = True
                continue
            if (
                not tokens
                or value.startswith("-")
                or value.endswith(SCRIPT_SUFFIXES)
                or value in {"python", "python3", "node", "pnpm", "npm", "gh", "gcloud", "-m"}
            ):
                tokens.append(value)
        return sanitize_command(" ".join(tokens)) if tokens else None
    return None


def sanitize_command(command: str) -> str:
    """Keep structure, but redact values following secret-like flags."""

    command = sanitize_text(command.strip())
    try:
        tokens = shlex.split(command, posix=False)
    except ValueError:
        tokens = command.split()
    safe: list[str] = []
    skip_next = False
    for token in tokens[:30]:
        if skip_next:
            safe.append("<redacted>")
            skip_next = False
            continue
        if SENSITIVE_FLAG_RE.search(token):
            if "=" in token:
                safe.append(token.split("=", 1)[0] + "=<redacted>")
            else:
                safe.append(token)
                if token.startswith("-"):
                    skip_next = True
            continue
        safe.append(token)
    return " ".join(safe)


def is_main_guard(node: ast.If) -> bool:
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


def discover_python(path: Path, text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    try:
        tree = ast.parse(text, filename=rel)
    except SyntaxError:
        return []

    command_vars: dict[str, str] = {}
    outputs: list[str] = []
    invokes: list[str] = []
    routers: list[str] = []
    has_argparse = False
    has_fastapi = False
    main_line: int | None = None
    fastapi_line: int | None = None

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            command = command_from_ast(node.value, command_vars)
            if command:
                command_vars[node.targets[0].id] = command
        if isinstance(node, ast.If) and is_main_guard(node):
            main_line = node.lineno
        if isinstance(node, ast.Call):
            name = dotted_name(node.func) or ""
            if name.endswith("ArgumentParser"):
                has_argparse = True
            if name.endswith("FastAPI"):
                has_fastapi = True
                fastapi_line = node.lineno
            if name.endswith("include_router") and node.args:
                router = dotted_name(node.args[0])
                if router:
                    routers.append(router)
            if name in {
                "subprocess.run",
                "subprocess.Popen",
                "subprocess.check_call",
                "subprocess.check_output",
            } and node.args:
                command = command_from_ast(node.args[0], command_vars)
                if command:
                    invokes.append(command)
            for keyword in node.keywords:
                if keyword.arg in {"command", "cmd"}:
                    command = command_from_ast(keyword.value, command_vars)
                    if command:
                        invokes.append(command)
            if name.endswith(("write_text", "write_bytes")) and isinstance(node.func, ast.Attribute):
                target = static_string(node.func.value)
                if target:
                    outputs.append(target)

    candidates: list[Candidate] = []
    if main_line is not None:
        candidates.append(
            Candidate(
                repository=ctx.repository,
                repository_ref=ctx.repository_ref,
                path=rel,
                symbol_or_route="__main__",
                executable_type="python_cli" if has_argparse else "python_main",
                command=f"python {rel}",
                trigger_types=["manual_or_parent_process"],
                actor_types=["human", "system"],
                access_surfaces=["local_cli"],
                execution_locus="local_pc_or_ci",
                invokes=invokes,
                output_candidates=outputs,
                evidence=[Evidence("code_ast", rel, "python.main_guard", main_line)],
                confidence=0.92 if has_argparse else 0.88,
            )
        )
    if has_fastapi:
        candidates.append(
            Candidate(
                repository=ctx.repository,
                repository_ref=ctx.repository_ref,
                path=rel,
                symbol_or_route="app",
                executable_type="fastapi_application",
                command=f"uvicorn {rel.removesuffix('.py').replace('/', '.')}:app",
                trigger_types=["container_or_manual_server"],
                actor_types=["system"],
                access_surfaces=["http_api"],
                execution_locus="server_runtime",
                invokes=[f"include_router:{router}" for router in routers],
                input_candidates=["HTTP request", "environment configuration"],
                output_candidates=["HTTP response"],
                constraints=["required runtime configuration"],
                verifier_candidates=["health endpoint", "OpenAPI schema"],
                evidence=[Evidence("code_ast", rel, "python.fastapi_app", fastapi_line)],
                confidence=0.96,
            )
        )
    if "PIPELINE_EDGES" in text:
        candidates.append(
            Candidate(
                repository=ctx.repository,
                repository_ref=ctx.repository_ref,
                path=rel,
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
                        rel,
                        "declared_map.pipeline_edges",
                        line_of(text, "PIPELINE_EDGES"),
                    )
                ],
                confidence=0.86,
            )
        )
    return candidates


def discover_pyproject(path: Path, text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    try:
        data = tomllib.loads(text)
    except tomllib.TOMLDecodeError:
        return []
    scripts = data.get("project", {}).get("scripts", {})
    if not isinstance(scripts, dict):
        return []
    candidates: list[Candidate] = []
    for name, target in sorted(scripts.items()):
        if not isinstance(target, str):
            continue
        candidates.append(
            Candidate(
                repository=ctx.repository,
                repository_ref=ctx.repository_ref,
                path=rel,
                symbol_or_route=name,
                executable_type="python_package_entrypoint",
                command=name,
                trigger_types=["manual_or_parent_process"],
                actor_types=["human", "system"],
                access_surfaces=["local_cli", "scheduled_process"],
                execution_locus="local_pc_or_container",
                invokes=[target],
                evidence=[Evidence("manifest", rel, "python.project_scripts", line_of(text, name))],
                confidence=0.99,
            )
        )
    return candidates


def discover_package_json(path: Path, text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    scripts = data.get("scripts", {})
    if not isinstance(scripts, dict):
        return []
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=rel,
            symbol_or_route=name,
            executable_type="node_package_script",
            command=f"npm run {name}",
            trigger_types=["manual_or_ci"],
            actor_types=["human", "system"],
            access_surfaces=["local_cli", "ci"],
            execution_locus="local_pc_or_ci",
            invokes=[sanitize_command(command)],
            verifier_candidates=[name] if name.startswith(("test", "lint", "build")) else [],
            evidence=[Evidence("manifest", rel, "node.package_scripts", line_of(text, f'"{name}"'))],
            confidence=0.99,
        )
        for name, command in sorted(scripts.items())
        if isinstance(command, str)
    ]


def route_from_path(rel: str) -> str:
    route = rel
    if route.startswith("app/"):
        route = route[len("app/") :]
    route = re.sub(r"/route\.(?:ts|tsx|js|jsx|mjs|cjs)$", "", route)
    return "/" + route.strip("/")


def discover_next_route(path: Path, text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    methods = [
        method
        for method in HTTP_METHODS
        if re.search(rf"export\s+(?:async\s+)?function\s+{method}\b", text)
    ]
    if not methods:
        return []
    route = route_from_path(rel)
    constraints: list[str] = []
    inputs = ["HTTP request"]
    if "cookies(" in text or "cookies()" in text:
        inputs.append("session cookie")
    if "verifyPremiumSession" in text or "isAuthorized" in text:
        constraints.append("authenticated session")
    if re.search(r"SECRET|SERVICE_ROLE|server-only", text, re.IGNORECASE):
        constraints.append("server-only credential configuration")
    if "searchParams" in text or "new URL(" in text:
        inputs.append("query parameters")
    invokes: list[str] = []
    if "fetch(" in text or "fetchJson(" in text:
        invokes.append("external HTTP API")
    if "createWorkspaceCoreServerClient" in text or "createClient(" in text:
        invokes.append("Supabase or database client")
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=rel,
            symbol_or_route=f"{','.join(methods)} {route}",
            executable_type="nextjs_route_handler",
            command=None,
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
                    rel,
                    "next.route_handler",
                    line_of(text, f"function {methods[0]}"),
                )
            ],
            confidence=0.96,
        )
    ]


def extract_script_references(text: str) -> list[str]:
    references = re.findall(r"(?i)(?:[\w./\\-]+\.(?:py|ps1|bat|cmd|mjs|cjs|js|ts))", text)
    return sorted(dict.fromkeys(sanitize_text(item.strip('"\'')) for item in references))


def discover_shell_script(path: Path, text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    suffix = path.suffix.lower()
    is_scheduler = bool(
        re.search(r"(?i)\bschtasks\b.*?/create|Register-ScheduledTask|New-ScheduledTask", text)
    )
    constraints: list[str] = []
    manual: list[str] = []
    if re.search(r"(?i)RunAs|Administrator|elevat|UAC", text):
        constraints.append("administrator or UAC required for setup")
        manual.append("approve UAC or run elevated setup")
    if re.search(r"(?i)\b(login|2FA|MFA)\b", text):
        constraints.append("authenticated human session may be required")
        manual.append("complete login or multifactor authentication")
    if re.search(r"(?i)credential|keyring", text):
        constraints.append("local credential context")
    invokes = extract_script_references(text)
    for command in ("python", "pythonw", "node", "npm", "pnpm", "gh", "gcloud", "wrangler", "schtasks"):
        if re.search(rf"(?i)(?<![\w-]){re.escape(command)}(?:\.exe)?(?![\w-])", text):
            invokes.append(command)
    invokes = sorted(dict.fromkeys(invokes))
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=rel,
            symbol_or_route=path.name,
            executable_type=(
                "windows_scheduler_registration"
                if is_scheduler
                else ("powershell_script" if suffix == ".ps1" else "batch_script")
            ),
            command=f"powershell -File {rel}" if suffix == ".ps1" else rel,
            trigger_types=["human_explicit_setup"] if is_scheduler else ["manual_or_parent_process"],
            actor_types=["human", "system"],
            access_surfaces=["windows_powershell" if suffix == ".ps1" else "windows_shell"],
            execution_locus="windows_local_pc",
            invokes=invokes,
            manual_touchpoints=manual,
            constraints=constraints,
            verifier_candidates=["exit code", "task status"] if is_scheduler else ["exit code"],
            evidence=[
                Evidence("code_pattern", rel, "shell.scheduler" if is_scheduler else "shell.script", 1)
            ],
            confidence=0.94 if is_scheduler else 0.82,
        )
    ]


def discover_github_workflow(path: Path, text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    invokes: list[str] = []
    for match in re.finditer(r"(?m)^\s*(?:uses|run):\s*(.+?)\s*$", text):
        value = match.group(1).strip().strip('"\'')
        if value:
            invokes.append(sanitize_command(value))
    trigger_types: list[str] = ["github_event"]
    if re.search(r"(?m)^\s*schedule\s*:", text):
        trigger_types.append("schedule")
    if "workflow_dispatch" in text:
        trigger_types.append("manual_dispatch")
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=rel,
            symbol_or_route=path.stem,
            executable_type="github_actions_workflow",
            trigger_types=trigger_types,
            actor_types=["system", "human"],
            access_surfaces=["github_ui", "git_push_or_pull_request"],
            execution_locus="github_actions_cloud",
            invokes=invokes,
            input_candidates=["repository checkout", "workflow event"],
            output_candidates=["check status", "logs", "optional artifacts or deployment"],
            constraints=["GitHub availability", "configured workflow permissions and secrets"],
            verifier_candidates=["workflow conclusion", "job status"],
            evidence=[Evidence("manifest", rel, "github_actions.workflow", 1)],
            confidence=0.98,
        )
    ]


def discover_cloudbuild(path: Path, text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    steps = [
        match.group(1).strip().strip('"\'')
        for match in re.finditer(r"(?m)^\s*-\s+id:\s*(.+?)\s*$", text)
    ]
    invokes = [match.group(1).strip() for match in re.finditer(r"(?m)^\s+name:\s*(.+?)\s*$", text)]
    if "gcloud" in text and "run" in text and "services" in text:
        invokes.append("gcloud run services update")
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=rel,
            symbol_or_route="cloudbuild",
            executable_type="cloud_build_pipeline",
            trigger_types=["cloud_build_trigger_or_manual_submit"],
            actor_types=["system", "human"],
            access_surfaces=["google_cloud_console", "git_push_or_cli"],
            execution_locus="google_cloud_build",
            invokes=[*steps, *invokes],
            input_candidates=["repository source", "substitution variables"],
            output_candidates=["container image", "deployment", "Cloud Logging records"],
            constraints=[
                "Google Cloud availability",
                "build service account permissions",
                "configured substitutions",
            ],
            verifier_candidates=["build result", "deployed revision health"],
            evidence=[Evidence("manifest", rel, "cloudbuild.pipeline", 1)],
            confidence=0.98,
        )
    ]


def discover_dockerfile(path: Path, text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    matches = list(re.finditer(r"(?mi)^\s*(CMD|ENTRYPOINT)\s+(.+?)\s*$", text))
    if not matches:
        return []
    kind, raw = matches[-1].groups()
    try:
        parsed = json.loads(raw)
        command = " ".join(str(item) for item in parsed) if isinstance(parsed, list) else str(parsed)
    except json.JSONDecodeError:
        command = raw
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=rel,
            symbol_or_route=kind.upper(),
            executable_type="container_entrypoint",
            command=sanitize_command(command),
            trigger_types=["container_start"],
            actor_types=["system"],
            access_surfaces=["container_platform"],
            execution_locus="container_runtime",
            input_candidates=["container environment", "network requests"],
            output_candidates=["service process", "stdout and stderr logs"],
            constraints=["container image build", "runtime environment configuration"],
            verifier_candidates=["container health", "service health endpoint"],
            evidence=[
                Evidence(
                    "manifest",
                    rel,
                    "docker.entrypoint",
                    text.count("\n", 0, matches[-1].start()) + 1,
                )
            ],
            confidence=0.99,
        )
    ]


def parse_skill_frontmatter(text: str) -> tuple[str | None, str | None]:
    if not text.startswith("---"):
        return None, None
    end = text.find("\n---", 3)
    if end < 0:
        return None, None
    block = text[3:end]
    name = None
    description = None
    for line in block.splitlines():
        key, sep, value = line.partition(":")
        if not sep:
            continue
        if key.strip() == "name":
            name = value.strip().strip('"\'')
        elif key.strip() == "description":
            description = value.strip().strip('"\'')
    return name, description


def code_block_commands(text: str) -> list[str]:
    commands: list[str] = []
    for block in re.findall(
        r"```(?:bash|shell|powershell|cmd)?\s*\n(.*?)```",
        text,
        re.DOTALL | re.IGNORECASE,
    ):
        for line in block.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if re.match(
                r"(?i)^(python|python3|claude|codex|gh|git|node|npm|pnpm|powershell|start)\b",
                line,
            ):
                commands.append(sanitize_command(line))
    return sorted(dict.fromkeys(commands))


def discover_skill(path: Path, text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    name, _description = parse_skill_frontmatter(text)
    if not name:
        name = path.parent.name
    invokes = code_block_commands(text)
    helper_refs = extract_script_references(text)
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=rel,
            symbol_or_route=f"/{name}",
            executable_type="agent_skill",
            command=f"/{name}",
            trigger_types=["agent_intent_match_or_explicit_command"],
            actor_types=["human", "ai_agent"],
            access_surfaces=["claude_code_cli", "vscode_agent"],
            execution_locus="agent_runtime_and_local_pc",
            invokes=[*invokes, *helper_refs],
            input_candidates=["user instruction", "repository context"],
            output_candidates=["agent response", "optional helper-script artifacts"],
            constraints=[
                "skill availability in agent search path",
                "helper runtime dependencies",
                "secrets must stay outside skill files",
            ],
            verifier_candidates=["helper exit code", "user-visible output"],
            evidence=[Evidence("agent_manifest", rel, "agent_skill.frontmatter", 1)],
            confidence=0.96,
        )
    ]


def discover_agent_contract(path: Path, _text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=rel,
            symbol_or_route=path.name,
            executable_type="agent_harness_contract",
            trigger_types=["agent_session_start_or_repository_work"],
            actor_types=["ai_agent", "human"],
            access_surfaces=["coding_agent"],
            execution_locus="agent_runtime",
            input_candidates=["repository policy and workflow context"],
            output_candidates=["constrained agent behavior"],
            constraints=["contract must be read before repository changes"],
            evidence=[Evidence("agent_contract", rel, "agent.instructions", 1)],
            confidence=0.90,
        )
    ]


def discover_system_map(path: Path, _text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    return [
        Candidate(
            repository=ctx.repository,
            repository_ref=ctx.repository_ref,
            path=rel,
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
            evidence=[Evidence("declared_design", rel, "system_map.yaml", 1)],
            confidence=0.88,
        )
    ]


def discover_file(path: Path, text: str, ctx: ScanContext) -> list[Candidate]:
    rel = safe_relative(path, ctx.root)
    name = path.name
    suffix = path.suffix.lower()
    if name == "pyproject.toml":
        return discover_pyproject(path, text, ctx)
    if name == "package.json":
        return discover_package_json(path, text, ctx)
    if name == "Dockerfile":
        return discover_dockerfile(path, text, ctx)
    if name in {"cloudbuild.yaml", "cloudbuild.yml"}:
        return discover_cloudbuild(path, text, ctx)
    if rel.startswith(".github/workflows/"):
        return discover_github_workflow(path, text, ctx)
    if rel.startswith(".claude/skills/") and name == "SKILL.md":
        return discover_skill(path, text, ctx)
    if name in {"AGENTS.md", "CLAUDE.md"}:
        return discover_agent_contract(path, text, ctx)
    if suffix == ".py":
        return discover_python(path, text, ctx)
    if suffix in {".ps1", ".bat", ".cmd"}:
        return discover_shell_script(path, text, ctx)
    if re.fullmatch(r"route\.(?:ts|tsx|js|jsx|mjs|cjs)", name) and "/api/" in f"/{rel}":
        return discover_next_route(path, text, ctx)
    if suffix in {".yaml", ".yml"} and name.startswith("system_map"):
        return discover_system_map(path, text, ctx)
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
    ctx = ScanContext(
        root=root,
        repository=repository,
        repository_ref=repository_ref or "unknown",
    )
    candidates: list[Candidate] = []
    scanned_files: list[str] = []
    for path in sorted(iter_candidate_files(root), key=lambda item: safe_relative(item, root)):
        text = read_text(path)
        if text is None:
            continue
        scanned_files.append(safe_relative(path, root))
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
        "scanned_files": scanned_files,
        "candidate_count": len(normalized),
        "candidates": normalized,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path, help="Local repository root to scan.")
    parser.add_argument("--repository", required=True, help="Stable owner/name identifier.")
    parser.add_argument(
        "--repository-ref",
        default="unknown",
        help="Commit SHA supplied by the caller. The scanner does not invoke git.",
    )
    parser.add_argument("--output", type=Path, help="Write JSON here instead of stdout.")
    parser.add_argument("--compact", action="store_true", help="Emit compact JSON.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        payload = discover_repository(args.repo, args.repository, args.repository_ref)
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 2
    rendered = json.dumps(
        payload,
        ensure_ascii=False,
        indent=None if args.compact else 2,
        sort_keys=True,
    ) + "\n"
    if args.output:
        output = args.output.expanduser()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
