#!/bin/sh
set -eu

if ! command -v render >/dev/null 2>&1; then
  echo 'Install and log in to the Render CLI, or copy the External URL from Render Dashboard > promptdock-postgres > Connect.' >&2
  exit 1
fi

render pg get "${1:-promptdock-postgres}" --include-sensitive-connection-info --output json | python3 -c '
import json, sys
data = json.load(sys.stdin)
found = []
def scan(value, path=""):
    if isinstance(value, dict):
        for key, item in value.items():
            scan(item, f"{path}.{key}" if path else key)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            scan(item, f"{path}.{index}")
    elif isinstance(value, str) and value.startswith(("postgresql://", "postgres://")):
        found.append((path.lower(), value))
scan(data)
preferred = next((url for path, url in found if "external" in path and "pool" in path), None)
preferred = preferred or next((url for path, url in found if "external" in path), None)
if not preferred:
    sys.exit("No external PostgreSQL URL found. Use Render Dashboard > Connect > External.")
print("Copy this into Vercel Environment Variables as DATABASE_URL:\n")
print(preferred)
print("\nKeep this URL private; it contains the database password.")
'
