#!/usr/bin/env python3
"""Public read-only scanner with conservative candidate normalization."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

DISCOVERY_DIR = Path(__file__).resolve().parent
if str(DISCOVERY_DIR) not in sys.path:
    sys.path.insert(0, str(DISCOVERY_DIR))

from candidate_policy import normalize_payload  # noqa: E402
from discover_executables import discover_repository as discover_raw  # noqa: E402


def scan_repository(
    root: Path,
    repository: str,
    repository_ref: str = "unknown",
) -> dict[str, Any]:
    root = root.expanduser().resolve()
    raw = discover_raw(root, repository, repository_ref)
    return normalize_payload(root, raw)


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
        payload = scan_repository(
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
