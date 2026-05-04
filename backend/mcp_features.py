#!/usr/bin/env python3
"""
MCP server for ProShop MERN feature flag management.
Reads and writes backend/features.json as the single source of truth.
Uses atomic writes (temp file + os.replace) to prevent data corruption.

Run:  python3 backend/mcp_features.py
"""
import json
import os
import tempfile
from datetime import date
from pathlib import Path

from fastmcp import FastMCP

FEATURES_FILE = Path(__file__).parent / "features.json"
VALID_STATES = {"Disabled", "Testing", "Enabled"}

mcp = FastMCP("feature-flags")


# ── file helpers ──────────────────────────────────────────────────────────────

def today() -> str:
    return date.today().isoformat()


def read_features() -> dict:
    """Read and parse features.json. Raises RuntimeError with JSON error payload on failure."""
    try:
        return json.loads(FEATURES_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise RuntimeError(json.dumps({
            "error": "FILE_READ_ERROR",
            "message": f"features.json not found at {FEATURES_FILE}",
        }))
    except json.JSONDecodeError as exc:
        raise RuntimeError(json.dumps({
            "error": "JSON_PARSE_ERROR",
            "message": f"features.json contains invalid JSON: {exc}",
        }))


def write_features(data: dict) -> None:
    """Atomically write features.json using a temp file + os.replace."""
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=FEATURES_FILE.parent,
            delete=False,
            suffix=".tmp",
        ) as tmp:
            json.dump(data, tmp, indent=2, ensure_ascii=False)
            tmp_path = tmp.name
        os.replace(tmp_path, FEATURES_FILE)
    except OSError as exc:
        raise RuntimeError(json.dumps({
            "error": "FILE_WRITE_ERROR",
            "message": f"Could not write features.json: {exc}",
        }))


# ── business logic helpers ────────────────────────────────────────────────────

def err_not_found(feature_id: str) -> dict:
    return {
        "error": "FEATURE_NOT_FOUND",
        "message": f"No feature with ID '{feature_id}' exists in features.json.",
        "feature_id": feature_id,
    }


def dependency_warnings(feature_id: str, features: dict) -> list:
    """Return warning strings for dependencies that are not Enabled."""
    warnings = []
    for dep_id in features[feature_id].get("dependencies", []):
        dep = features.get(dep_id)
        status = dep["status"] if dep else "NOT_FOUND"
        if status != "Enabled":
            warnings.append(
                f"Dependency '{dep_id}' is in status '{status}', not 'Enabled'. "
                f"'{feature_id}' may not function correctly."
            )
    return warnings


def blocking_disabled_dependency(feature_id: str, features: dict) -> str | None:
    """Return the first dependency that is Disabled (or missing), or None."""
    for dep_id in features[feature_id].get("dependencies", []):
        dep = features.get(dep_id)
        if dep is None or dep["status"] == "Disabled":
            return dep_id
    return None


# ── tools ─────────────────────────────────────────────────────────────────────

@mcp.tool()
def get_feature_info(feature_id: str) -> dict:
    """
    Return the full current state of a single feature flag.
    Includes the status of each dependency.
    """
    try:
        features = read_features()
    except RuntimeError as exc:
        return json.loads(str(exc))

    if feature_id not in features:
        return err_not_found(feature_id)

    flag = features[feature_id]
    result = {"feature_id": feature_id, **flag}

    if "dependencies" in flag:
        result["dependency_states"] = {
            dep_id: (features[dep_id]["status"] if dep_id in features else "NOT_FOUND")
            for dep_id in flag["dependencies"]
        }

    return result


@mcp.tool()
def set_feature_state(feature_id: str, state: str) -> dict:
    """
    Change the status of a feature flag (Disabled / Testing / Enabled).

    Side effects:
      - Disabled  → traffic_percentage = 0
      - Enabled   → traffic_percentage = 100
      - Testing   → traffic_percentage kept if 1–99, else reset to 10
    Blocks enabling a flag when any dependency is Disabled.
    Warns when Testing/Enabled and dependencies are not fully Enabled.
    Updates last_modified to today.
    """
    if state not in VALID_STATES:
        return {
            "error": "INVALID_STATE",
            "message": (
                f"State '{state}' is not valid. "
                "Must be one of: Disabled, Testing, Enabled (case-sensitive)."
            ),
            "feature_id": feature_id,
        }

    try:
        features = read_features()
    except RuntimeError as exc:
        return json.loads(str(exc))

    if feature_id not in features:
        return err_not_found(feature_id)

    flag = features[feature_id]

    # Block Enabled if a dependency is Disabled
    if state == "Enabled":
        blocked_by = blocking_disabled_dependency(feature_id, features)
        if blocked_by:
            dep_status = features[blocked_by]["status"] if blocked_by in features else "NOT_FOUND"
            return {
                "error": "DEPENDENCY_DISABLED",
                "message": (
                    f"Cannot set '{feature_id}' to Enabled: "
                    f"dependency '{blocked_by}' is '{dep_status}'. "
                    f"Enable '{blocked_by}' first."
                ),
                "feature_id": feature_id,
                "blocking_dependency": blocked_by,
            }

    # Apply traffic_percentage rules
    if state == "Disabled":
        flag["traffic_percentage"] = 0
    elif state == "Enabled":
        flag["traffic_percentage"] = 100
    elif state == "Testing":
        current = flag.get("traffic_percentage", 0)
        if not (1 <= current <= 99):
            flag["traffic_percentage"] = 10

    flag["status"] = state
    flag["last_modified"] = today()

    try:
        write_features(features)
    except RuntimeError as exc:
        return json.loads(str(exc))

    warnings = dependency_warnings(feature_id, features) if state in ("Testing", "Enabled") else []
    return {"feature_id": feature_id, **flag, "warnings": warnings}


@mcp.tool()
def adjust_traffic_rollout(feature_id: str, percentage: int) -> dict:
    """
    Update traffic_percentage for a feature in Testing state.
    percentage must be an integer 0–100.
    Feature must be in Testing status (use set_feature_state to change status first).
    Provides hints when percentage is 0 or 100.
    """
    if not isinstance(percentage, int) or isinstance(percentage, bool):
        return {
            "error": "INVALID_PERCENTAGE",
            "message": "percentage must be an integer (no decimals).",
            "feature_id": feature_id,
        }
    if not (0 <= percentage <= 100):
        return {
            "error": "INVALID_PERCENTAGE",
            "message": f"percentage must be between 0 and 100, got {percentage}.",
            "feature_id": feature_id,
        }

    try:
        features = read_features()
    except RuntimeError as exc:
        return json.loads(str(exc))

    if feature_id not in features:
        return err_not_found(feature_id)

    flag = features[feature_id]

    if flag["status"] != "Testing":
        return {
            "error": "WRONG_STATUS_FOR_ROLLOUT",
            "message": (
                f"adjust_traffic_rollout can only be called on features with status 'Testing'. "
                f"'{feature_id}' is currently '{flag['status']}'. "
                "Use set_feature_state to change its status first."
            ),
            "feature_id": feature_id,
        }

    flag["traffic_percentage"] = percentage
    flag["last_modified"] = today()

    try:
        write_features(features)
    except RuntimeError as exc:
        return json.loads(str(exc))

    hint = None
    if percentage == 0:
        hint = f"Traffic is 0%. Consider using set_feature_state('{feature_id}', 'Disabled') instead."
    elif percentage == 100:
        hint = f"Traffic is 100%. Consider promoting with set_feature_state('{feature_id}', 'Enabled')."

    return {"feature_id": feature_id, **flag, "hint": hint}


@mcp.tool()
def list_features() -> list:
    """Return all feature flags with feature_id, name, status, and traffic_percentage."""
    try:
        features = read_features()
    except RuntimeError as exc:
        return [json.loads(str(exc))]

    return [
        {
            "feature_id": fid,
            "name": flag["name"],
            "status": flag["status"],
            "traffic_percentage": flag["traffic_percentage"],
        }
        for fid, flag in features.items()
    ]


if __name__ == "__main__":
    mcp.run()
