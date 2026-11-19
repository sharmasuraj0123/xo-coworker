#!/usr/bin/env python3
"""python3 tools/ledger/reconcile.py [--repo .] [--write]: records in the ledger what the working tree shows is done."""
import json, os, re, subprocess, sys
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scan import items_of

OPEN = ("planned", "split-region")
AREAS = ("core/", "shell/", "modules/", "apps-host/", "e2e/", "tools/", "tests/", "js/", "css/", "presets/", "assets/", "fonts/")
SCANNED = re.compile(r"\.((m|c)?js|css|html)$")
REEXPORT = re.compile(r"^\s*export\s*(\*|\{[^}]*\})\s*from\s*['\"][^'\"]+['\"];?\s*$", re.M)
REGION_NOTE = "assign to its region's home when this file moves (see its analysis)"
GONE_WORDS = ("delete", "drop", "none:")

def candidates(home):
    """The repo paths a home names, in order: `core/ui/x.js (why)`, a list of them, or a folder."""
    texts = home if isinstance(home, list) else [home or ""]
    out = []
    for t in texts:
        for tok in re.split(r"[\s,;()`+]+", t):
            tok = tok.rstrip(".:").replace("*", "").rstrip("/")
            if tok.startswith(AREAS) or tok in ("index.html", "serve.py", "start.sh", "boot.js"):
                out.append(tok)
    return list(dict.fromkeys(out))

class Tree:
    def __init__(self, repo):
        self.repo, self.cache = repo, {}

    def exists(self, p):
        return os.path.exists(os.path.join(self.repo, p))

    def items(self, p, strip_reexports=False):
        key = (p, strip_reexports)
        if key not in self.cache:
            text = Path(self.repo, p).read_text(encoding="utf-8", errors="replace")
            self.cache[key] = items_of(p, REEXPORT.sub("", text) if strip_reexports else text)
        return self.cache[key]

    def files_under(self, p):
        full = os.path.join(self.repo, p)
        if os.path.isfile(full): return [p] if SCANNED.search(p) else []
        out = []
        for d, dirs, names in os.walk(full):
            dirs[:] = sorted(x for x in dirs if x not in ("vendor", "node_modules"))
            out += [os.path.relpath(os.path.join(d, n), self.repo) for n in sorted(names) if SCANNED.search(n)]
        return out

    def area(self, p):
        """The nearest existing path at or above p, never above an area's own folder (modules/x, core/ui)."""
        while p and not self.exists(p):
            p = os.path.dirname(p)
        return p if p and (p.count("/") >= 1 or p in ("shell", "e2e", "apps-host", "index.html")) else None

def holds(found, kind, name):
    kinds = ("exports", "functions") if kind in ("exports", "functions") else (kind,)
    return any(name in found.get(k, []) for k in kinds)

def where(tree, home, kind, name, src):
    """The first file at the item's home, other than its source, that holds it: the named files, then their folders."""
    named = [c for c in candidates(home) if tree.exists(c)]
    wider = [a for a in (tree.area(c) for c in candidates(home)) if a]
    wider += [os.path.dirname(c) for c in named if os.path.isfile(os.path.join(tree.repo, c)) and os.path.dirname(c).count("/") >= 1]
    for base in dict.fromkeys(named + wider):
        for f in tree.files_under(base):
            if f != src and holds(tree.items(f), kind, name): return f
    return None

def gone_reason(home):
    h = (home if isinstance(home, str) else "").strip()
    if not h.lower().startswith(GONE_WORDS): return None
    return re.sub(r"^delete:\s*", "", h) or h

def reconcile(repo):
    path = os.path.join(repo, "tools/ledger/ledger.json")
    L = json.loads(Path(path).read_text())
    tree = Tree(repo)
    changes, unplaced = [], []
    for key, e in L.get("items", {}).items():
        if e.get("status") not in OPEN: continue
        src, kind, name = key.split("::", 2)
        if tree.exists(src) and SCANNED.search(src) and holds(tree.items(src, strip_reexports=True), kind, name): continue
        if not tree.exists(src) or SCANNED.search(src):
            reason = gone_reason(e.get("home"))
            if reason:
                new = {"status": "deleted", "reason": reason}
            else:
                at = where(tree, e.get("home"), kind, name, src)
                if not at:
                    unplaced.append(key); continue
                new = {"status": "moved", "home": at}
                if e.get("note") and e["note"] != REGION_NOTE: new["note"] = e["note"]
            changes.append((key, e, new)); L["items"][key] = new
    for p, e in L["files"].items():
        if e.get("status") not in OPEN or tree.exists(p): continue
        reason = gone_reason(e.get("home"))
        homes = candidates(e.get("home"))
        if reason: new = {"status": "deleted", "reason": reason}
        elif homes and all(tree.exists(h) for h in homes):
            new = {"status": "moved", "home": homes[0]} if len(homes) == 1 else {"status": "split", "home": homes}
        else:
            unplaced.append(p); continue
        changes.append((p, e, new)); L["files"][p] = new
    return L, changes, unplaced

def main():
    repo = sys.argv[sys.argv.index("--repo") + 1] if "--repo" in sys.argv else "."
    L, changes, unplaced = reconcile(repo)
    for key, old, new in changes:
        print(f"{old.get('status')} -> {new['status']}: {key} -> {new.get('home') or new.get('reason')}")
    print(f"{len(changes)} entries done in the tree; {len(unplaced)} gone from their source but not found at their home")
    for key in unplaced: print(f"  not found at its home: {key}")
    if "--write" in sys.argv and changes:
        Path(repo, "tools/ledger/ledger.json").write_text(json.dumps(L, indent=1, ensure_ascii=False) + "\n")
        md = os.path.join(repo, "tools/ledger/ledger_md.py")
        if os.path.exists(md): subprocess.run([sys.executable, md, repo], check=True, capture_output=True)

if __name__ == "__main__":
    main()
