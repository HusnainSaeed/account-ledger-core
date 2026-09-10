#!/bin/zsh
# Cursor sandbox cannot mutate .git inside Documents. Commits already live at:
#   /tmp/account-ledger-core.git
# Run this once in your own Terminal to attach that history to the project folder.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -d /tmp/account-ledger-core.git ]]; then
  echo "Missing /tmp/account-ledger-core.git — re-run agent git step or git init fresh."
  exit 1
fi
rm -rf .git
# Convert bare repo into a normal .git directory for this work tree
mkdir .git
# bare layout: objects, refs, HEAD at top level — copy into .git
cp -a /tmp/account-ledger-core.git/. .git/
# bare repos use HEAD; add worktree linkage
git config --local core.bare false
git config --local core.worktree "$(pwd)"
git status
git log --oneline
echo "Done. Local history is now in $(pwd)/.git"
