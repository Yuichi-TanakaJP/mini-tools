"""Conservative normalization policy for raw executable candidates.

Detection and acceptance are intentionally separate. This module only removes
known parser noise and improves candidate typing. It never marks a candidate as
accepted and never executes repository code.
"""

from __future__ import annotations

import ast
from copy import deepcopy
from pathlib import Path
from typing import Any

NORMALIZATION_VERSION = "0.1"
YAML_BLOCK_MARKERS = frozenset({"|", "|-", ">", ">-"})


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

        if candidate_type == "github_actions_workflow":
            candidate["invokes"] = sorted(
                dict.fromkeys(
                    invocation
                    for invocation in candidate.get("invokes", [])
                    if invocation.strip() not in YAML_BLOCK_MARKERS
                )
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
