#!/usr/bin/env python3
"""Regenerates architecture/modular/LEDGER.md from tools/ledger/ledger.json."""
import json, os, sys
from collections import Counter, defaultdict
repo = sys.argv[1] if len(sys.argv) > 1 else "."
L = json.load(open(os.path.join(repo, "tools/ledger/ledger.json")))
inv = json.load(open(os.path.join(repo, "tools/ledger/inventory.json")))
G = {r["path"]: r["group"] for r in inv["files"]}; N = {r["path"]: r.get("lines") for r in inv["files"]}
by = defaultdict(list)
for p, e in L["files"].items(): by[G.get(p, "other")].append((p, e))
order = ["root", "js", "css", "tests-unit", "tests-browser", "tests-lib", "tests-fixtures", "presets", "fonts", "vendor", "assets", "ui-mockups", "design-research"]
groups = order + sorted(g for g in by if g not in order)
out = [f"# Ledger: every file of xo-coworker at {L['commit'][:7]} and its new home", "",
       "Generated from `tools/ledger/ledger.json` by `tools/ledger/ledger_md.py`; do not edit by hand. Statuses: **planned** (one home), **split** (several homes; the items inside carry their own), **vendor** (kept as-is), **decide** (waits for the owner), and once the move runs **moved**, **kept**, **deleted** (with a reason). `tools/ledger/check_ledger.py` fails if a file of the base commit is missing here or has no home; `--final` fails until nothing is planned or undecided.", "",
       "| Status | Files |", "|---|---:|"]
for k, v in Counter(e["status"] for e in L["files"].values()).most_common(): out.append(f"| {k} | {v} |")
ic = Counter(e["status"] for e in L["items"].values())
out += ["", f"Items inside first-party files: {len(L['items'])} (" + ", ".join(f"{k} {v}" for k, v in ic.most_common()) + "), in `ledger.json` as `path::kind::name`.", ""]
for g in groups:
    if g not in by: continue
    out += [f"## {g} ({len(by[g])})", "", "| File | Lines | Status | New home |", "|---|---:|---|---|"]
    for p, e in sorted(by[g]):
        h = e.get("home") or e.get("reason") or ""; h = ", ".join(h) if isinstance(h, list) else h
        if e.get("note"): h += f" · next: {e['note']}"
        out.append(f"| `{p}` | {N.get(p) if N.get(p) is not None else ''} | {e['status']} | {h} |")
    out.append("")
open(os.path.join(repo, "architecture/modular/LEDGER.md"), "w").write("\n".join(out) + "\n")
print(f"{len(L['files'])} files written")
