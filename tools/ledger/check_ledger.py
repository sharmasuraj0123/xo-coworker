#!/usr/bin/env python3
"""Fails when a file of the ledger's base commit has no home; --final also checks the working tree."""
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
