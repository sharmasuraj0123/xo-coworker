#!/usr/bin/env python3
"""Fill ledger.json with the planned home of every file and item (plan mode).

    python3 tools/ledger/fill_ledger.py <ledger-dir> <analysis-dir>

Run ONCE, to make the plan. It refuses to run once any entry has moved, been
kept or deleted, because it would reset those statuses. After that, statuses are
changed by the commits that move code (see AGENTS.md).

Sources: the six analyses in <modular-dir>/analysis/ (region maps for js/app.js
and css/app.css, the tests table) and the per-file decisions below. Statuses in
plan mode: planned (home), split (homes; items carry their own region's home),
decide (needs the owner: options listed), vendor (kept as-is).
"""
import json, re, subprocess, sys
from pathlib import Path

D = Path(sys.argv[1]); A = Path(sys.argv[2])
inv = json.load(open(D / "inventory.json")); L = json.load(open(D / "ledger.json"))
commit = inv["commit"]
if any(e.get("status") in ("moved", "kept", "deleted") for e in list(L["files"].values()) + list(L["items"].values())):
    sys.exit("fill_ledger: the move has started (moved/kept/deleted entries exist); refusing to reset the ledger")

JS = {  # file -> (status, home(s))  — from analyses 1–5
 "js/app.js": ("split", "boot.js + core/* + shell + modules/* by region (analysis/1-app-index.md §2.6)"),
 "js/stage.js": ("split", ["shell/panel", "core/kernel (panel.page/panel.frame places)", "modules/threads (Threads frame)", "modules/changes (frame wiring)", "modules/map (frame wiring)", "modules/launchpad (cover)", "modules/shells (shell page)"]),
 "js/shells/dock.js": ("planned", "modules/shells/dock.js"), "js/shells/term.js": ("planned", "modules/shells/term.js"), "js/shells/model.js": ("planned", "modules/shells/model.js"),
 "js/ui.js": ("split", ["core/ui/icons", "core/ui/motion", "core/ui/redraw (reconcile)", "core/platform/dom", "core/platform/time", "core/services/sound"]),
 "js/kit.js": ("split", ["modules/decisions/kit.js", "core/ui/components/hold.js"]),
 "js/dropdown.js": ("planned", "core/ui/components/xo-select.js"), "js/gestures.js": ("planned", "core/platform/gestures.js"),
 "js/keys.js": ("split", ["core/platform/keys.js", "core/kernel (shortcut place)", "modules/settings/keyboard.js"]),
 "js/keynav.js": ("planned", "core/ui/a11y/keynav.js"), "js/quickopen.js": ("planned", "modules/search/quickopen.js"), "js/fuzzy.js": ("planned", "core/platform/fuzzy.js"),
 "js/motion.js": ("planned", "core/ui/motion.js"), "js/ring.js": ("planned", "core/ui/a11y/ring.js"), "js/skeleton.js": ("split", ["modules/home/skeleton.js", "core/ui/skeleton.js"]),
 "js/herald.js": ("split", ["core/services/notices.js", "shell (notice renderer)"]), "js/icon.js": ("planned", "core/ui/icons/icon.js"), "js/xoicons.js": ("planned", "core/ui/icons/xoicons.js (generated)"),
 "js/projicons.js": ("planned", "modules/projects/projicons.js"), "js/fileicons.js": ("planned", "core/ui/icons/fileicons.js"),
 "js/settings.js": ("split", ["modules/settings (host, pend/land)", "modules/routing", "modules/rules", "modules/worktrees"]),
 "js/rtsettings.js": ("split", ["modules/runtimes (settings.section)", "modules/runtimes/paid"]),
 "js/shape.js": ("planned", "core/services/shape/shape.js"), "js/shapeview.js": ("split", ["modules/settings/shape-page.js", "modules/home (homeOrder)", "shell (density)"]),
 "js/words.js": ("planned", "modules/conversation/words.js"), "js/util.js": ("split", ["core/platform/util.js", "core/platform/time.js", "core/platform/clipboard.js"]),
 "js/redraw.js": ("planned", "core/ui/redraw.js"), "js/pending.js": ("planned", "core/platform/pending.js"), "js/hopstate.js": ("planned", "core/services/world/hops.js"), "js/focusview.js": ("planned", "core/ui/a11y/focus.js"),
 "js/follow.js": ("planned", "modules/conversation/follow.js"),
 "js/msgx.js": ("split", ["modules/conversation/decorate.js", "modules/conversation/working.js", "modules/conversation/actions.js", "modules/conversation/gestures.js", "modules/conversation/latest-button.js", "modules/composer (reply chip, quote)"]),
 "js/turnview.js": ("planned", "modules/conversation/blocks/turn.js"), "js/blocks.js": ("planned", "core/services/world/turns.js"), "js/chats.js": ("planned", "modules/chats/"),
 "js/timeline.js": ("split", ["core/services/world/normalise.js", "modules/conversation/model.js", "modules/threads", "modules/decisions"]),
 "js/markdown.js": ("planned", "core/ui/markdown/markdown.js"), "js/rich.js": ("planned", "core/ui/markdown/rich.js"), "js/chart.js": ("planned", "core/ui/markdown/chart.js"), "js/highlight.js": ("planned", "core/ui/markdown/highlight.js"),
 "js/media.js": ("split", ["modules/conversation/media/", "core/ui/media (layout)"]), "js/lightbox.js": ("planned", "core/ui/lightbox.js"),
 "js/attach.js": ("split", ["modules/composer/attachments.js", "core/services/world/normalise.js", "core/platform/util.js"]),
 "js/drafts.js": ("planned", "modules/files/documents/drafts.js"),
 "js/decide.js": ("split", ["modules/decisions/needs.js", "modules/decisions/queue.js", "modules/decisions/card.js", "modules/decisions/panel.js", "modules/decisions/toast.js"]),
 "js/review.js": ("planned", "modules/decisions/items.js"), "js/content.js": ("planned", "modules/decisions/rank.js"), "js/pacing.js": ("planned", "modules/decisions/pacing.js"),
 "js/paid.js": ("planned", "core/services/world/paid.js"), "js/paidview.js": ("planned", "modules/decisions/cards/paid.js"), "js/runtimes.js": ("planned", "core/services/runtimes.js"),
 "js/intel.js": ("planned", "modules/intelligence/"), "js/comms.js": ("planned", "modules/conversation/blocks/comms.js"), "js/runsview.js": ("planned", "modules/threads/runs/"), "js/imagechange.js": ("planned", "modules/changes/imagechange.js"),
 "js/api.js": ("split", ["core/platform/http.js", "per-module clients (routes declared in each module.json)"]), "js/sse.js": ("planned", "core/platform/sse.js"),
 "js/storm.js": ("split", ["core/services/storm/client", "core/services/storm/stream", "core/services/storm/reducers/*", "core/services/storm/selectors/*", "core/services/storm/commands", "core/services/account", "core/services/review"]),
 "js/world.js": ("planned", "core/services/world/store.js"), "js/model.js": ("planned", "modules/threads/checklist.js"),
 "js/record.js": ("split", ["modules/artifacts/model.js", "modules/since/model.js", "core/services/git-state.js", "core/ui/virtual.js"]),
 "js/recordview.js": ("split", ["modules/artifacts", "modules/since"]),
 "js/map.js": ("split", ["modules/map", "core/services/places.js", "core/services/agent-activity.js"]),
 "js/create.js": ("planned", "modules/create-project/"), "js/lpapi.js": ("split", ["modules/launchpad/client.js", "modules/launchpad/model.js", "core/services/github.js"]),
 "js/launchpad.js": ("planned", "modules/launchpad/ (store, controller, views, section)"), "js/paths.js": ("planned", "core/services/paths.js"), "js/merge.js": ("planned", "core/platform/diff.js"),
 "js/files.js": ("split", ["modules/files/tree", "modules/files/ops", "core/services/places.js", "core/services/activity.js"]),
 "js/filespage.js": ("planned", "modules/files/page.js"),
 "js/viewer.js": ("split", ["modules/files/viewer", "modules/files/documents (external-change intake)", "modules/changes/file-diff"]),
 "js/docs.js": ("planned", "modules/files/documents/docs.js"), "js/doceditor.js": ("planned", "modules/files/editor/doceditor.js"), "js/mdlive.js": ("planned", "modules/files/editor/markdown-page.js"),
 "js/changes.js": ("split", ["modules/changes/store.js", "modules/conversation/refs.js (fileRef, lineRef)", "core/services/places.js"]),
 "js/changesframe.js": ("split", ["modules/changes/frame.js", "core/ui/components/counts.js"]),
 "js/diffview.js": ("split", ["modules/changes/diff-renderer/", "decide: ~230 dead lines (file/conflict/exitKeys/ready/loaded/FIND_CSS)"]),
 "js/diffthemes.js": ("planned", "modules/changes/diff-renderer/themes.js (generated)"),
}
CSS = {
 "css/app.css": ("split", "core/ui + shell + modules/* by region (analysis/6-css-tests-tools.md, app.css region map)"),
 "css/base.css": ("planned", "core/ui/foundation.css"), "css/tokens.css": ("planned", "core/ui/tokens.css"), "css/foundation.css": ("split", ["core/ui/foundation.css", "modules/* (structure rules)"]),
 "css/light.css": ("split", ["core/ui/tokens.css (light roles)", "modules/* (light blocks)"]), "css/panel.css": ("split", ["shell/panel.css", "modules/threads", "modules/changes", "modules/map", "modules/files"]),
 "css/phone.css": ("split", ["shell/phone.css", "modules/* (phone blocks)"]), "css/diffs.css": ("planned", "modules/changes/diffs.css"), "css/launchpad.css": ("planned", "modules/launchpad/launchpad.css"),
 "css/links.css": ("planned", "modules/conversation/links.css"), "css/artifacts.css": ("planned", "modules/artifacts/artifacts.css"), "css/dropdown.css": ("planned", "core/ui/components/xo-select.css"),
 "css/media.css": ("planned", "modules/conversation/media/media.css"), "css/shape.css": ("split", ["modules/settings/shape.css", "core/ui (density)"]), "css/msgx.css": ("planned", "modules/conversation/msgx.css"),
 "css/rich.css": ("planned", "core/ui/markdown/rich.css"), "css/side.css": ("planned", "shell/sidebar.css"), "css/docs.css": ("planned", "modules/files/editor/docs.css"),
}
ROOT = {
 "index.html": ("split", "shell/index.html (thin frame) + module-owned markup (analysis/1-app-index.md element table)"),
 "README.md": ("planned", "README.md (rewritten: architecture + module table generated)"), "PR_DESCRIPTION.md": ("decide", "move to docs/history/ or delete (it describes one past PR)"),
 "serve.py": ("planned", "serve.py (kept; apps-host routes added in phase 7)"), "start.sh": ("planned", "start.sh (kept)"), ".gitignore": ("planned", ".gitignore (updated)"),
 "favicon.svg": ("decide", "core/ui/icons/favicon.svg, generated from the icon pack (today a hand-made copy that differs)"),
}

# Tests: proposed home column of analysis 6.
TEST_HOME = {}
for row in open(A / "6-css-tests-tools.md"):
    m = re.match(r"^\| *([\w.-]+\.(?:test\.(?:mjs|cjs|py)|cjs))(?: \(README\))? *\|.*\| *([^|]+?) *\|\s*$", row)
    if m: TEST_HOME[m.group(1)] = m.group(2)
def test_home(p):
    name = p.split("/")[-1]
    if p.startswith("tests/browser/"): return ("planned", f"e2e/{name}")
    if p.startswith("tests/lib/"): return ("planned", f"core/ui/test-kit/{name}")
    if p == "tests/fixtures/plain-turn.sse": return ("planned", "core/platform/tests/fixtures/plain-turn.sse")
    if p.startswith("tests/fixtures/"): return ("planned", f"e2e/fixtures/{name}")
    h = TEST_HOME.get(name)
    if not h: return ("decide", "no row in the tests table: classify")
    h = h.strip().strip("`")
    tgt = h if h.startswith(("core/", "shell", "modules/", "e2e")) else f"modules/{h.split(' ')[0]}"
    return ("planned", f"{tgt.rstrip('/')}/tests/{name}  (source-reading tests are rewritten as behaviour tests when their module moves)")

def file_plan(p):
    if p in JS: return JS[p]
    if p in CSS: return CSS[p]
    if p in ROOT: return ROOT[p]
    if p.startswith("tests/"): return test_home(p)
    if p.startswith("js/vendor/lucide/"): return ("decide", "delete: no importer anywhere (analysis/5)")
    if p.startswith("js/vendor/pierre-diffs/") and p.endswith("edit.js"): return ("decide", "delete with diffview's dead editor path, or keep (analysis/5)")
    if p.startswith("js/vendor/"): return ("vendor", "vendor/" + p[len("js/vendor/"):])
    if p.startswith("assets/icons/"): return ("planned", "core/ui/icons/source/" + p[len("assets/icons/"):])
    if p.startswith("fonts/"): return ("planned", "core/ui/fonts/" + p[len("fonts/"):])
    if p.startswith("presets/"): return ("planned", "core/services/shape/presets/" + p.split("/")[-1])
    if p.startswith("tools/xoicons/"): return ("planned", "tools/xoicons/ (generates core/ui/icons/xoicons.js)")
    if p.startswith("tools/diffview/theme"): return ("planned", "tools/diffview/ (generates the diff themes)")
    if p.startswith(("tools/codemirror/", "tools/diffview/vendor")): return ("planned", p + " (vendor hash manifests)")
    if p.startswith("tools/launchpad/mockspace"): return ("planned", "e2e/fixtures/mockspace.cjs (one copy; the design-research copy goes)")
    if p.startswith("tools/"): return ("decide", "one-off probe with machine paths: keep under tools/probes/ or delete (analysis/6 Part C)")
    if p in ("design-research/2026-11-lg/controls-ids.json", "design-research/2026-11-lg/tools/controls-md.cjs", "design-research/2026-11-lg/lp-shell/world.cjs", "design-research/2026-11-vision/launchpad/tools/mockspace.cjs"):
        return ("planned", "e2e/fixtures/ (tests need it; then it leaves design-research)")
    if p.startswith(("design-research/", "ui-mockups/")): return ("decide", "leave the product repo for the design archive (nothing in the app or tests depends on it)")
    return ("decide", "unclassified")

# Region maps → item homes for js/app.js and css/app.css.
def regions(md, start_pat, sep):
    out, on = [], False
    for row in open(A / md):
        if re.search(start_pat, row): on = True
        if on:
            m = re.match(r"^\| *(\d+) *[–-] *(\d+) *\|(.*)\|\s*$", row) or re.match(r"^\| *(\d+) *\|(.*)\|\s*$", row)
            if m and len(m.groups()) == 3: out.append((int(m.group(1)), int(m.group(2)), m.group(3).split("|")[-1].strip()))
            elif m: out.append((int(m.group(1)), int(m.group(1)), m.group(2).split("|")[-1].strip()))
            if on and row.startswith("####") and out: break
    return out
APP = regions("1-app-index.md", r"2\.6 REGION MAP", "|")
def git_show(p): return subprocess.run(["git", "-C", "/home/coder/xo-coworker", "show", f"{commit}:{p}"], capture_output=True, text=True).stdout.splitlines()
app_lines = git_show("js/app.js")
def app_home(token):
    for i, ln in enumerate(app_lines, 1):
        if token in ln:
            for a, b, h in APP:
                if a <= i <= b: return f"{h} (app.js l.{i})"
    return None

counts = {}
for p, e in L["files"].items():
    s, h = file_plan(p)
    L["files"][p] = {"status": s, "home": h}
    counts[s] = counts.get(s, 0) + 1
icounts = {}
for k in L["items"]:
    p, kind, v = k.split("::", 2)
    fs, fh = L["files"][p]["status"], L["files"][p]["home"]
    if p == "js/app.js":
        tok = {"functions": f"function {v}", "exports": v}.get(kind, v)
        h = app_home(tok) or app_home(v)
        e = {"status": "planned", "home": h} if h else {"status": "decide", "home": "not found in the region map: place by hand"}
    elif fs == "split":
        e = {"status": "split-region", "home": fh, "note": "assign to its region's home when this file moves (see its analysis)"}
    else:
        e = {"status": fs, "home": fh}
    L["items"][k] = e; icounts[e["status"]] = icounts.get(e["status"], 0) + 1
L["mode"] = "plan"
json.dump(L, open(D / "ledger.json", "w"), indent=1)
print("files:", counts); print("items:", icounts); print("app.js regions parsed:", len(APP))
