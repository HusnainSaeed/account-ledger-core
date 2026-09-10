#!/bin/zsh
# Cursor's sandboxed agent cannot write under .git on this machine.
# Run once in your own terminal from this directory:
set -euo pipefail
cd "$(dirname "$0")"
rm -rf .git
git init -b main
git add -A
git status
echo "Ready. Create incremental commits as in WORKLOG / the plan."
