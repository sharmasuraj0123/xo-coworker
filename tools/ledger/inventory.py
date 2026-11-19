#!/usr/bin/env python3
"""Inventories every tracked file at a commit, and the items inside first-party files."""
import json, re, subprocess, sys
from collections import defaultdict, OrderedDict
from pathlib import Path

repo, commit, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)

def git(*a):
    return subprocess.run(["git", "-C", repo, *a], check=True, capture_output=True).stdout

files = git("ls-tree", "-r", "-l", commit).decode().splitlines()
entries = []
for line in files:
    meta, path = line.split("\t", 1)
    size = meta.split()[3]
    entries.append((path, int(size) if size.isdigit() else 0))

def group(p):
    if p.startswith("js/vendor/"): return "vendor"
    if p.startswith("js/"): return "js"
    if p.startswith("css/"): return "css"
    if p.startswith("tests/browser/"): return "tests-browser"
    if p.startswith("tests/lib/"): return "tests-lib"
    if p.startswith("tests/fixtures/"): return "tests-fixtures"
    if p.startswith("tests/"): return "tests-unit"
    if p.startswith("tools/"): return "tools/" + p.split("/")[1]
    if p.startswith("assets/"): return "assets"
    if p.startswith("fonts/"): return "fonts"
    if p.startswith("presets/"): return "presets"
    if p.startswith("ui-mockups/"): return "ui-mockups"
    if p.startswith("design-research/"): return "design-research"
    if "/" not in p: return "root"
    return "other"

TEXT = re.compile(r"\.(js|mjs|cjs|css|html|json|md|py|sh|svg|txt|sse|yml|yaml)$")
FIRST_PARTY_SCAN = {"js", "css", "tests-unit", "tests-browser", "tests-lib", "root", "presets"} | {g for g in []}

R = {
    "imports":   re.compile(r"""(?:^|\n)\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)"""),
    "exports":   re.compile(r"""export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)|export\s*\{([^}]*)\}"""),
    "functions": re.compile(r"""^(?:export\s+)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)""", re.M),
    "ids":       re.compile(r"""getElementById\(\s*['"`]([\w:-]+)['"`]|querySelector(?:All)?\(\s*['"`]#([\w-]+)|\bid=\\?["']([\w-]+)\\?["']"""),
    "storage":   re.compile(r"""(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*['"`]([^'"`]+)['"`]|(?:localStorage|sessionStorage)\[\s*['"`]([^'"`]+)['"`]\]"""),
    "routes":    re.compile(r"""['"`](/api/[^'"`\s?]*)|\b(?:get|post|put|del|delete|patch|request|api|json|send|stream|req|fetchJson|call)\w*\(\s*[`'"](/[a-z][^`'"?]*)"""),
    "events":    re.compile(r"""new\s+CustomEvent\(\s*['"`]([\w:.-]+)['"`]|dispatchEvent\(\s*new\s+Event\(\s*['"`]([\w:.-]+)['"`]|addEventListener\(\s*['"`]([\w:.-]+)['"`]"""),
    "keys":      re.compile(r"""\.key\s*===?\s*['"`]([^'"`]{1,12})['"`]|\.code\s*===?\s*['"`]([^'"`]{1,16})['"`]"""),
    "globals":   re.compile(r"""\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)"""),
}
CSS = {
    "rules":     re.compile(r"""([^{}@][^{}]*)\{"""),
    "ids":       re.compile(r"""#([A-Za-z][\w-]*)(?![^{]*;)"""),
    "props_def": re.compile(r"""(--[\w-]+)\s*:"""),
    "props_use": re.compile(r"""var\(\s*(--[\w-]+)"""),
    "media":     re.compile(r"""@media\s*([^{]+)\{"""),
}
STD_EVENTS = set("""click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave pointerdown pointerup pointermove pointercancel pointerenter pointerleave pointerover pointerout gotpointercapture lostpointercapture keydown keyup keypress input change submit focus blur focusin focusout scroll wheel resize load unload beforeunload error message open close abort contextmenu dragstart dragend dragover dragenter dragleave drop touchstart touchend touchmove touchcancel transitionend transitionstart animationend animationstart visibilitychange online offline popstate hashchange storage copy paste cut selectionchange compositionstart compositionend toggle cancel beforeinput loadedmetadata play pause ended timeupdate select invalid readystatechange progress pagehide pageshow fullscreenchange""".split())

def uniq(xs):
    return list(OrderedDict.fromkeys(x for x in xs if x))

inv = []
for path, size in entries:
    g = group(path)
    rec = {"path": path, "group": g, "bytes": size}
    if TEXT.search(path):
        try:
            text = git("show", f"{commit}:{path}").decode("utf-8", "replace")
        except subprocess.CalledProcessError:
            text = ""
        rec["lines"] = text.count("\n") + (0 if text.endswith("\n") or not text else 1)
        scan = g in FIRST_PARTY_SCAN or g.startswith("tools/")
        if scan and re.search(r"\.(m|c)?js$", path):
            items = {}
            for k, rx in R.items():
                found = []
                for m in rx.finditer(text):
                    if k == "exports" and m.group(2):
                        found += [x.strip().split(" as ")[-1].strip() for x in m.group(2).split(",")]
                    else:
                        found += [x for x in m.groups() if x]
                items[k] = uniq(found)
            items["custom_events"] = [e for e in items.pop("events") if e not in STD_EVENTS]
            idents = re.findall(r"(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*([A-Za-z_$][\w$.]*)", text)
            for ident in uniq(idents):
                m = re.search(r"(?:const|let|var)\s+" + re.escape(ident.split(".")[-1]) + r"\s*=\s*['\"`]([^'\"`]+)['\"`]", text)
                items["storage"] = uniq(items.get("storage", []) + [m.group(1) if m else f"<{ident}>"])
            items["routes"] = uniq(re.sub(r"\$\{[^}]*\}", "{}", r) for r in items.get("routes", []))
            rec["items"] = {k: v for k, v in items.items() if v}
        elif scan and path.endswith(".css"):
            sels = [s.strip() for s in CSS["rules"].findall(re.sub(r"/\*[\s\S]*?\*/", "", text)) if s.strip() and not s.strip().startswith(("from", "to")) and not re.match(r"^[\d.]+%", s.strip())]
            rec["items"] = {
                "rule_blocks": len(sels),
                "ids": uniq(CSS["ids"].findall(" ".join(sels))),
                "custom_props_defined": uniq(CSS["props_def"].findall(text)),
                "custom_props_used": uniq(CSS["props_use"].findall(text)),
                "media": uniq(m.strip() for m in CSS["media"].findall(text)),
            }
        elif path.endswith(".html") and g in ("root",):
            rec["items"] = {
                "ids": uniq(re.findall(r'\bid="([\w-]+)"', text)),
                "scripts": uniq(re.findall(r'<script[^>]*src="([^"]+)"', text)),
                "stylesheets": uniq(re.findall(r'<link[^>]*href="([^"]+\.css)"', text)),
            }
    inv.append(rec)

(out / "inventory.json").write_text(json.dumps({"commit": commit, "files": inv}, indent=1))

ledger = {"commit": commit, "files": {}, "items": {}}
for r in inv:
    ledger["files"][r["path"]] = {"home": None, "status": "unmapped"}
    for k, vals in (r.get("items") or {}).items():
        if k in ("exports", "functions", "ids", "storage", "routes", "custom_events", "keys", "globals"):
            for v in vals:
                ledger["items"][f"{r['path']}::{k}::{v}"] = {"home": None, "status": "unmapped"}
(out / "ledger.json").write_text(json.dumps(ledger, indent=1))

by = defaultdict(list)
for r in inv: by[r["group"]].append(r)
order = ["root", "js", "css", "tests-unit", "tests-browser", "tests-lib", "tests-fixtures", "presets", "fonts", "vendor", "assets", "ui-mockups", "design-research"]
groups = order + sorted(g for g in by if g not in order)
md = [f"# xo-coworker inventory at {commit[:7]}", "",
      f"Generated by `modular/tools/inventory.py` from git (`git ls-tree -r {commit[:7]}`). {len(inv)} tracked files. Every file appears below exactly once.", ""]
md.append("| Group | Files | Lines |"); md.append("|---|---:|---:|")
for g in groups:
    if g in by: md.append(f"| {g} | {len(by[g])} | {sum(r.get('lines', 0) for r in by[g]):,} |")
md.append(f"| **total** | **{len(inv)}** | **{sum(r.get('lines',0) for r in inv):,}** |"); md.append("")
def short(xs, n=12):
    xs = list(xs); return ", ".join(f"`{x}`" for x in xs[:n]) + (f" … (+{len(xs)-n})" if len(xs) > n else "")
for g in groups:
    if g not in by: continue
    md.append(f"## {g} ({len(by[g])} files)"); md.append("")
    compact = g in ("vendor", "assets", "ui-mockups", "design-research", "fonts") or g.startswith("tools/") and len(by[g]) > 8
    for r in sorted(by[g], key=lambda r: r["path"]):
        ln = f" · {r['lines']:,} lines" if "lines" in r else f" · {r['bytes']:,} bytes"
        if compact:
            md.append(f"- `{r['path']}`{ln}"); continue
        md.append(f"- **`{r['path']}`**{ln}")
        it = r.get("items") or {}
        for k in ("exports", "imports", "ids", "storage", "routes", "custom_events", "keys", "globals", "scripts", "stylesheets", "custom_props_defined"):
            if it.get(k): md.append(f"  - {k}: {short(it[k])}")
        if "rule_blocks" in it: md.append(f"  - rule blocks: {it['rule_blocks']}")
    md.append("")
(out / "INVENTORY.md").write_text("\n".join(md))
print(f"{len(inv)} files; {sum(1 for r in inv if r.get('items'))} scanned; ledger: {len(ledger['files'])} files + {len(ledger['items'])} items")
