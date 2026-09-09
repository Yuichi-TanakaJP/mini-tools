"""Conservative normalization policy for raw executable candidates.

Detection and acceptance are intentionally separate. This module only removes
known parser noise, applies a final command-output safety filter, and improves
candidate typing. It never marks a candidate as accepted and never executes
repository code.
"""

from __future__ import annotations

import ast
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

from command_safety import sanitize_command

NORMALIZATION_VERSION = "0.2"
YAML_BLOCK_MARKERS = frozenset({"|", "|-", ">", ">-"})
RUN_BLOCK_RE = re.compile(
    r"^(?P<indent>\s*)(?:-\s*)?run:\s*(?P<marker>[|>][+-]?)\s*(?:#.*)?$"
)


def _assignment_names(node: ast.AST) -> set[str]:
    names: set[str] = set()
    if isinstance(node, ast.Name):
        names.add(node.id)
    elif isinstance(node, (ast.Tuple, ast.List)):
        for element in node.elts:
            names.update(_assignment_names(element))
    return names


def has_pipeline_edges_assignment(path: Path) -> bool:
    """Return true only for a real top-level/AST assignment to PIPELINE_EDGES."""

    try:
        tree = ast.parse(path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, SyntaxError):
        return False

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            if any("PIPELINE_EDGES" in _assignment_names(target) for target in node.targets):
                return True
        elif isinstance(node, ast.AnnAssign):
            if "PIPELINE_EDGES" in _assignment_names(node.target):
                return True
    return False


def _is_test_path(relative_path: str) -> bool:
    path = Path(relative_path)
    return (
        "tests" in path.parts
        or path.name.startswith("test_")
        or path.name.endswith("_test.py")
    )


def _extract_workflow_block_runs(path: Path) -> list[str]:
    """Extract conservative command strings from YAML block-style run steps."""

    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []

    commands: list[str] = []
    index = 0
    while index < len(lines):
        match = RUN_BLOCK_RE.match(lines[index])
        if not match:
            index += 1
            continue

        base_indent = len(match.group("indent"))
        marker = match.group("marker")
        block: list[str] = []
        cursor = index + 1
        while cursor < len(lines):
            line = lines[cursor]
            if not line.strip():
                block.append("")
                cursor += 1
                continue
            indent = len(line) - len(line.lstrip(" "))
            if indent <= base_indent:
                break
            block.append(line.strip())
            cursor += 1

        nonempty = [line for line in block if line and not line.startswith("#")]
        if nonempty:
            command = (
                " ".join(nonempty)
                if marker.startswith(">")
                else " ; ".join(nonempty)
            )
            commands.append(sanitize_command(command))
        index = max(cursor, index + 1)

    return sorted(dict.fromkeys(command for command in commands if command))


def _normalize_next_route(symbol_or_route: str) -> str:
    return re.sub(r"(?<=\s)/src/app/", "/", symbol_or_route)


def _safe_invocations(values: list[Any]) -> list[str]:
    return sorted(
        dict.fromkeys(
            sanitize_command(str(value))
            for value in values
            if str(value).strip()
        )
    )


def normalize_payload(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize a raw discovery payload without promoting candidate status."""

    root = root.expanduser().resolve()
    result = deepcopy(payload)
    raw_candidates = result.get("candidates", [])
    normalized: list[dict[str, Any]] = []
    dropped: list[dict[str, str]] = []

    for raw in raw_candidates:
        candidate = deepcopy(raw)
        candidate_type = candidate.get("executable_type")
        relative_path = str(candidate.get("path", ""))

        if candidate_type == "declared_pipeline_map":
            source_path = root / relative_path
            if not has_pipeline_edges_assignment(source_path):
                dropped.append(
                    {
                        "path": relative_path,
                        "reason": "pipeline_edges_name_without_assignment",
                    }
                )
                continue

        invocations = [
            invocation
            for invocation in candidate.get("invokes", [])
            if str(invocation).strip() not in YAML_BLOCK_MARKERS
        ]
        if candidate_type == "github_actions_workflow":
            invocations.extend(_extract_workflow_block_runs(root / relative_path))
        candidate["invokes"] = _safe_invocations(invocations)

        if candidate_type == "nextjs_route_handler":
            candidate["symbol_or_route"] = _normalize_next_route(
                str(candidate.get("symbol_or_route", ""))
            )

        if (
            candidate_type in {"python_main", "python_cli"}
            and _is_test_path(relative_path)
        ):
            candidate["executable_type"] = "python_test_entrypoint"
            candidate["trigger_types"] = ["manual_or_ci_test"]
            candidate["access_surfaces"] = ["local_cli", "ci"]
            candidate["execution_locus"] = "local_pc_or_ci"
            candidate["verifier_candidates"] = sorted(
                dict.fromkeys(
                    [*candidate.get("verifier_candidates", []), "test result"]
                )
            )
            candidate["confidence"] = min(float(candidate.get("confidence", 0.0)), 0.9)

        if candidate.get("command"):
            candidate["command"] = sanitize_command(str(candidate["command"]))

        candidate["review_status"] = "discovered"
        normalized.append(candidate)

    normalized.sort(
        key=lambda item: (
            str(item.get("path", "")),
            str(item.get("executable_type", "")),
            str(item.get("symbol_or_route", "")),
        )
    )
    result["raw_candidate_count"] = len(raw_candidates)
    result["candidate_count"] = len(normalized)
    result["candidates"] = normalized
    result["normalization_version"] = NORMALIZATION_VERSION
    result["normalization_dropped"] = dropped
    result["review_status"] = "discovered"
    return result