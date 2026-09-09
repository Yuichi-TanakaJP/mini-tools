"""Final command-string safety filter for discovery reports.

The scanner never reads credential stores. This module additionally removes
common inline credential literals from command-like strings before JSON output.
"""

from __future__ import annotations

import re
import shlex

URL_USERINFO_RE = re.compile(r"(?i)(https?://)([^/@\s]+):([^@\s]+)@")
WINDOWS_HOME_RE = re.compile(r"(?i)[a-z]:[\\/]users[\\/][^\\/\s]+")
LINUX_HOME_RE = re.compile(r"/home/[^/\s]+")
MAC_HOME_RE = re.compile(r"/Users/[^/\s]+")
SENSITIVE_NAME_RE = re.compile(
    r"(?i)(?:password|passwd|secret|token|api[-_]?key|credential|"
    r"service[-_]?role[-_]?key|private[-_]?key|access[-_]?key|"
    r"authorization|proxy[-_]?authorization|x[-_]?api[-_]?key)"
)
AUTH_SCHEMES = frozenset({"bearer", "basic"})
HEADER_FLAGS = frozenset({"-h", "--header"})


def sanitize_text(value: str) -> str:
    value = WINDOWS_HOME_RE.sub("%USERPROFILE%", value)
    value = LINUX_HOME_RE.sub("~", value)
    value = MAC_HOME_RE.sub("~", value)
    return value.replace("\\", "/")


def _strip_outer_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"\"", "'"}:
        return value[1:-1]
    return value


def _looks_sensitive_name(value: str) -> bool:
    value = _strip_outer_quotes(value.strip()).rstrip(":=")
    if not value:
        return False
    normalized = value.lstrip("-/").replace("_", "-").lower()
    exact_names = {
        "password",
        "passwd",
        "secret",
        "token",
        "api-key",
        "apikey",
        "credential",
        "service-role-key",
        "private-key",
        "access-key",
        "authorization",
        "proxy-authorization",
        "x-api-key",
    }
    return (
        normalized in exact_names
        or (value.startswith(("-", "/")) and bool(SENSITIVE_NAME_RE.search(value)))
        or (value.upper() == value and bool(SENSITIVE_NAME_RE.search(value)))
    )


def sanitize_command(command: str) -> str:
    """Preserve command shape while replacing likely literal values."""

    command = sanitize_text(command.strip())
    command = URL_USERINFO_RE.sub(r"\1<redacted>@", command)
    try:
        tokens = shlex.split(command, posix=False)
    except ValueError:
        tokens = command.split()

    safe: list[str] = []
    redact_next = False
    allow_auth_scheme = False

    for raw_token in tokens[:30]:
        token = _strip_outer_quotes(raw_token.strip())
        lowered = token.lower()

        if redact_next:
            if allow_auth_scheme and lowered in AUTH_SCHEMES:
                safe.append(token)
                allow_auth_scheme = False
                continue
            safe.append("<redacted>")
            redact_next = False
            allow_auth_scheme = False
            continue

        if lowered in HEADER_FLAGS:
            safe.append(token)
            continue

        separator = None
        left = token
        right = ""
        for candidate_separator in ("=", ":"):
            if candidate_separator in token:
                left, right = token.split(candidate_separator, 1)
                separator = candidate_separator
                break

        if separator and _looks_sensitive_name(left):
            if right.strip() and right.strip().lower() not in AUTH_SCHEMES:
                safe.append(f"{left}{separator}<redacted>")
            else:
                safe.append(f"{left}{separator}{right.strip()}")
                redact_next = True
                allow_auth_scheme = not bool(right.strip())
            continue

        if _looks_sensitive_name(token):
            safe.append(token)
            redact_next = True
            allow_auth_scheme = normalized_authorization_name(token)
            continue

        safe.append(token)

    return " ".join(safe)


def normalized_authorization_name(value: str) -> bool:
    normalized = value.strip().lstrip("-/").rstrip(":=").replace("_", "-").lower()
    return normalized in {"authorization", "proxy-authorization"}
