#!/usr/bin/env python3
"""The "nothing is left behind" check.

    python3 tools/ledger/check_ledger.py [--final] [--repo .] [--ledger tools/ledger/ledger.json] [--inventory tools/ledger/inventory.json]

The ledger is checked against ITS OWN base commit (ledger["commit"]: the files
that existed when the plan was made). With --final it also checks the working
tree: a moved/kept file's home exists, and a deleted file is gone.

Fails (exit 1) when:
  * a file tracked at <commit> has no ledger entry, or an entry names a file
    that isn't tracked there (the ledger is stale);
  * any file or item is still `unmapped`;
  * an entry is `moved`/`split` without a `home`, or `deleted` without a `reason`;
  * (with --inventory) an item found in the inventory is missing from the ledger.
Plan mode (the default while nothing has moved): planned, split, split-region
and vendor need a home; decide needs a home (the options) and is reported, so
the owner's open decisions stay visible. --final (once the move is done): only
moved, split, kept, deleted (with a reason) and vendor are allowed: nothing
planned or undecided may remain.
"""
import json, subprocess, sys

import os
def opt(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default
repo = opt("--repo", ".")
ledger_path = opt("--ledger", os.path.join(repo, "tools/ledger/ledger.json"))
inv_path = opt("--inventory", os.path.join(repo, "tools/ledger/inventory.json"))
L = json.load(open(ledger_path))
commit = L["commit"]
tracked = set(subprocess.run(["git", "-C", repo, "ls-tree", "-r", "--name-only", commit],
                             check=True, capture_output=True, text=True).stdout.splitlines())
errors = []
for p in sorted(tracked - set(L["files"])): errors.append(f"not in ledger: {p}")
for p in sorted(set(L["files"]) - tracked): errors.append(f"ledger names an untracked file: {p}")
FINAL = "--final" in sys.argv
OK = {"moved", "split", "kept", "deleted", "vendor"} if FINAL else {"planned", "split", "split-region", "decide", "vendor", "moved", "kept", "deleted"}
decides = []
def check(kind, key, e):
    s = e.get("status")
    if s in (None, "unmapped"): errors.append(f"unmapped {kind}: {key}")
    elif s not in OK: errors.append(f"status {s!r} not allowed{' in --final' if FINAL else ''}: {key}")
    elif s == "deleted" and not e.get("reason"): errors.append(f"deleted without reason: {key}")
    elif s != "deleted" and not e.get("home"): errors.append(f"{s} without home: {key}")
    if s == "decide": decides.append(key)
for k, e in L["files"].items(): check("file", k, e)
for k, e in L.get("items", {}).items(): check("item", k, e)
if FINAL:
    for p, e in L["files"].items():
        h = e.get("home")
        if e.get("status") in ("moved", "kept") and isinstance(h, str) and " " not in h and not os.path.exists(os.path.join(repo, h)):
            errors.append(f"{e['status']} home does not exist in the working tree: {p} -> {h}")
        if e.get("status") == "deleted" and os.path.exists(os.path.join(repo, p)):
            errors.append(f"deleted but still present: {p}")
if inv_path and os.path.exists(inv_path):
    inv = json.load(open(inv_path))
    for r in inv["files"]:
        for kind, vals in (r.get("items") or {}).items():
            if kind in ("exports", "functions", "ids", "storage", "routes", "custom_events", "keys", "globals"):
                for v in vals:
                    key = f"{r['path']}::{kind}::{v}"
                    if key not in L.get("items", {}): errors.append(f"inventory item missing from ledger: {key}")
print(f"{'final' if FINAL else 'plan'} mode: {len(L['files'])} files, {len(L.get('items', {}))} items checked; {len(errors)} problems; {len(decides)} entries wait for the owner's decision")
for e in errors[:200]: print("  " + e)
if len(errors) > 200: print(f"  … and {len(errors) - 200} more")
sys.exit(1 if errors else 0)
