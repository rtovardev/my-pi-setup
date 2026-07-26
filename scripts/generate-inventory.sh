#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
output="$repo_root/inventory/pi-inventory.json"
pi_home="${PI_HOME:-$HOME/.pi}"

mkdir -p "$(dirname "$output")"

PI_HOME="$pi_home" OUTPUT="$output" python3 <<'PY'
import hashlib
import json
import os
import platform
import subprocess
from pathlib import Path

pi_home = Path(os.environ["PI_HOME"])
output = Path(os.environ["OUTPUT"])
agent = pi_home / "agent"


def names(directory: Path):
    if not directory.is_dir():
        return []
    return sorted(entry.name for entry in directory.iterdir() if not entry.name.startswith("."))


def packages(manifest: Path):
    try:
        data = json.loads(manifest.read_text())
    except (OSError, json.JSONDecodeError):
        return []
    dependencies = data.get("dependencies", {}) if isinstance(data, dict) else {}
    return sorted(str(name) for name in dependencies) if isinstance(dependencies, dict) else []


def extension_hashes(directory: Path):
    if not directory.is_dir():
        return {}
    result = {}
    for path in sorted(directory.rglob("*")):
        if path.is_file() and path.suffix in {".js", ".cjs", ".mjs", ".ts", ".mts", ".cts"}:
            relative = path.relative_to(directory).as_posix()
            result[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def mcp_server_names():
    candidates = [agent / "mcp.json", Path.home() / ".config/mcp/mcp.json"]
    result = set()
    for candidate in candidates:
        try:
            data = json.loads(candidate.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        for key in ("mcpServers", "servers"):
            servers = data.get(key, {}) if isinstance(data, dict) else {}
            if isinstance(servers, dict):
                result.update(str(name) for name in servers)
    return sorted(result)

try:
    pi_version = subprocess.check_output(["pi", "--version"], text=True, stderr=subprocess.DEVNULL).strip()
except (OSError, subprocess.CalledProcessError):
    pi_version = None

inventory = {
    "schema_version": 1,
    "pi": {
        "version": pi_version,
        "packages": packages(agent / "npm/package.json"),
        "extensions": extension_hashes(agent / "extensions"),
        "skills": names(agent / "skills"),
        "themes": names(agent / "themes"),
        "mcp_server_names": mcp_server_names(),
    },
    "platform": {
        "system": platform.system(),
        "release": platform.release(),
    },
    "privacy": {
        "contains_raw_configuration": False,
        "contains_credentials": False,
        "contains_absolute_paths": False,
    },
}
output.write_text(json.dumps(inventory, indent=2, sort_keys=True) + "\n")
PY

echo "Updated ${output#$repo_root/}"
