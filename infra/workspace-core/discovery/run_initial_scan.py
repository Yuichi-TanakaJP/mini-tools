#!/usr/bin/env python3
"""Run normalized executable discovery over the initial sibling repositories.

This wrapper is intentionally local and read-only. It invokes ``git`` only to
capture the current commit and clean/dirty state; it never fetches, checks out,
or modifies a repository. Scanned repository code is never executed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Iterable

DISCOVERY_DIR = Path(__file__).resolve().parent
if str(DISCOVERY_DIR) not in sys.path:
    sys.path.insert(0, str(DISCOVERY_DIR))

from candidate_policy import NORMALIZATION_VERSION  # noqa: E402
from scan_repository import scan_repository  # noqa: E402

INITIAL_REPOSITORIES: tuple[tuple[str, str], ...] = (
    ("mini-tools", "Yuichi-TanakaJP/mini-tools"),
    ("market_info", "Yuichi-TanakaJP/market_info"),
    ("pc-saas-health-monitor", "Yuichi-TanakaJP/pc-saas-health-monitor"),
    ("market-info-api", "Yuichi-TanakaJP/market-info-api"),
    ("stock-notes", "Yuichi-TanakaJP/stock-notes"),
    ("claude-skills", "Yuichi-TanakaJP/claude-skills"),
)


def git_read(repo: Path, *args: str) -> str | None:
    """Run a bounded read-only git command and return stdout on success."""

    try:
        result = subprocess.run(
            ["git", "-C", str(repo), *args],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def repository_snapshot(repo: Path) -> tuple[str, str, str | None]:
    """Return commit, state, and a path-free digest of porcelain output."""

    head = git_read(repo, "rev-parse", "HEAD") or "unknown"
    porcelain = git_read(repo, "status", "--porcelain")
    if porcelain is None:
        return head, "unknown", None
    state = "dirty" if porcelain else "clean"
    digest = hashlib.sha256(porcelain.encode("utf-8")).hexdigest()
    return head, state, digest


def repository_state(repo: Path) -> tuple[str, str]:
    """Compatibility wrapper used by callers that only need commit and state."""

    head, state, _ = repository_snapshot(repo)
    return head, state


def evidence_ref(head: str, worktree_state: str) -> str:
    """Do not present working-tree content as an exact commit snapshot."""

    if worktree_state == "clean":
        return head
    if worktree_state == "dirty":
        return f"{head}+dirty"
    return f"{head}+state-unknown" if head != "unknown" else "unknown"


def run_initial_scans(
    dev_root: Path,
    output_root: Path,
    repositories: Iterable[tuple[str, str]] = INITIAL_REPOSITORIES,
    *,
    allow_dirty: bool = False,
) -> dict:
    """Scan available sibling clones and return a path-free summary.

    Dirty repositories are skipped by default. When explicitly allowed, their
    candidates use ``<head>+dirty`` and are marked as working-tree evidence.
    """

    repository_specs = tuple(repositories)
    dev_root = dev_root.expanduser().resolve()
    output_root = output_root.expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    reports: list[dict] = []
    missing: list[str] = []
    skipped_dirty: list[str] = []
    for folder, full_name in repository_specs:
        repo = dev_root / folder
        if not repo.is_dir():
            missing.append(full_name)
            continue

        head_before, state_before, digest_before = repository_snapshot(repo)
        if state_before == "dirty" and not allow_dirty:
            skipped_dirty.append(full_name)
            continue

        ref = evidence_ref(head_before, state_before)
        payload = scan_repository(repo, full_name, ref)
        head_after, state_after, digest_after = repository_snapshot(repo)
        stable = (
            head_before == head_after
            and state_before == state_after
            and digest_before == digest_after
        )

        if not stable:
            ref = f"{ref}+changed-during-scan"
            payload["repository_ref"] = ref
            for candidate in payload.get("candidates", []):
                candidate["repository_ref"] = ref

        evidence_scope = {
            "clean": "commit",
            "dirty": "working_tree_snapshot",
        }.get(state_before, "state_unknown")
        payload["repository_commit"] = head_before
        payload["repository_ref"] = ref
        payload["repository_worktree_state"] = state_before
        payload["repository_evidence_scope"] = evidence_scope
        payload["repository_snapshot_stable"] = stable
        payload["repository_status_digest"] = digest_before

        report_name = folder.replace("_", "-") + ".executables.json"
        (output_root / report_name).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        type_counts = Counter(
            candidate["executable_type"] for candidate in payload["candidates"]
        )
        reports.append(
            {
                "repository": full_name,
                "repository_commit": head_before,
                "repository_ref": ref,
                "repository_worktree_state": state_before,
                "repository_evidence_scope": evidence_scope,
                "repository_snapshot_stable": stable,
                "raw_candidate_count": payload["raw_candidate_count"],
                "candidate_count": payload["candidate_count"],
                "candidate_types": dict(sorted(type_counts.items())),
                "normalization_dropped_count": len(
                    payload.get("normalization_dropped", [])
                ),
                "report": report_name,
            }
        )

    summary = {
        "schema_version": "0.1",
        "normalization_version": NORMALIZATION_VERSION,
        "scan_mode": "local_read_only_initial_repository_scan",
        "review_status": "discovered",
        "allow_dirty": allow_dirty,
        "requested_repository_count": len(repository_specs),
        "scanned_repository_count": len(reports),
        "missing_repositories": sorted(missing),
        "skipped_dirty_repositories": sorted(skipped_dirty),
        "reports": sorted(reports, key=lambda item: item["repository"]),
    }
    (output_root / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dev-root",
        type=Path,
        default=Path.home() / "dev",
        help="Parent directory containing the six sibling repository clones.",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        help="Destination directory. Defaults to <dev-root>/_workspace-core-discovery.",
    )
    parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help=(
            "Explicitly scan dirty clones as working-tree evidence. "
            "The default is to skip them."
        ),
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help=(
            "Return exit code 2 when a repository is missing or skipped because "
            "it is dirty."
        ),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    output_root = args.output_root or args.dev_root.expanduser() / "_workspace-core-discovery"
    summary = run_initial_scans(
        args.dev_root,
        output_root,
        allow_dirty=args.allow_dirty,
    )

    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    if args.strict and (
        summary["missing_repositories"] or summary["skipped_dirty_repositories"]
    ):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())