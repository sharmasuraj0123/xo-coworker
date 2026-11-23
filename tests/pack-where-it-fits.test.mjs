// The pack's exact icon where a word or a generic mark stood: commands, git state, Shells, panel heads, the editor's state, Launchpad.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { cmdIcon, stepIcon } from "../core/services/step-icons.js";
import { cmdIcon as legacyCmdIcon, stepIcon as legacyStepIcon } from "../js/turnview.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
import { panelSrc } from "./lib/panel-src.mjs";

const PACK = JSON.parse(read("core/ui/icons/source/xo/manifest.json")).icons.map((i) => i.file);
const has = (name) => PACK.some((f) => f.endsWith(`/${name}.svg`) && existsSync(new URL(`../core/ui/icons/source/xo/${f}`, import.meta.url)));
let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

const tv = read("js/turnview.js");
const iconSrc = read("core/services/step-icons.js");
assert.equal(legacyCmdIcon, cmdIcon);
assert.equal(legacyStepIcon, stepIcon);

await t("a command row shows the icon of what it does; anything else stays a terminal", () => {
  const want = {
    'git commit -m "x"': "commit", "git push origin feat/a": "cloud-upload", "git -C repo push": "cloud-upload", "git pull": "download",
    "git merge release/x": "merge", "git rebase main": "merge", "git diff --stat": "diff", "git status --short": "diff",
    "git switch -c feat/a": "branch", "git log --oneline -3": "history", "gh pr create": "pull-request",
    "npm test": "test-flask", "npm run test": "test-flask", "pytest -q": "test-flask", "node tests/a.test.mjs": "test-flask",
    "docker build .": "container", "curl -s http://x": "api", "cd repo && git commit -am x": "commit", "FOO=1 git push": "cloud-upload",
    "ls -la": "folder-open", "": "terminal", "echo git commit": "terminal", "python3 x.py": "terminal",
    "git fetch -q . ; sed -n 1,60p js/turnview.js": "eye", "cd /x && grep -n foo css/*.css | head": "search", "git fetch && git merge --ff-only r": "merge",
    "git add -A && git commit -m x && git log -1": "commit", "npm install && npm test": "test-flask", "rm -rf /tmp/a && mkdir -p /tmp/a": "delete",
    "sed -i s/a/b/ f": "edit", "timeout 60 node tests/a.test.mjs": "test-flask", "cat > a <<'EOF'\ngit push origin main\nEOF\nls": "file-new", "echo hi > notes.md": "file-new", "cat a.txt 2>/dev/null": "eye",
  };
  for (const [c, n] of Object.entries(want)) assert.equal(cmdIcon(c), n, c);
});
await t("a step's icon comes from its kind, its tool's own name in any runtime, its command, then its own words", () => {
  const want = [
    [{ kind: "read" }, "eye"], [{ kind: "search" }, "search"], [{ kind: "list" }, "folder-open"], [{ kind: "create_file" }, "file-new"],
    [{ kind: "edit_file" }, "edit"], [{ kind: "delete_file" }, "delete"], [{ kind: "web_fetch" }, "web"], [{ kind: "web_search" }, "web"],
    [{ kind: "mcp" }, "plug"], [{ kind: "subagent" }, "agent"], [{ kind: "plan" }, "checklist"], [{ kind: "ask" }, "question"],
    [{ kind: "command", target: "git push" }, "cloud-upload"], [{ kind: "command", target: "python3 x.py", line: "Read the type tokens" }, "eye"],
    [{ kind: "command", target: "python3 x.py", line: "Find where the tick is drawn" }, "search"], [{ kind: "command", target: "python3 x.py", line: "Build it" }, "terminal"],
    [{ kind: "other", tool: "Skill" }, "wand"], [{ kind: "other", tool: "ScheduleWakeup" }, "alarm"], [{ kind: "other", tool: "EnterWorktree" }, "branch"],
    [{ kind: "other", tool: "image_generation" }, "image"], [{ kind: "other", tool: "Monitor" }, "logs"], [{ kind: "other", tool: "ToolSearch" }, "search"],
    [{ kind: "other", tool: "something_new" }, "wrench"], [{}, "wrench"], [{ pending: true }, "compose"], [{ pending: true, kind: "create_file" }, "file-new"],
    [{ kind: "mcp", tool: "mcp__xo_comms__update_status" }, "checklist"], [{ kind: "mcp", target: "xo_comms/share_files" }, "share"], [{ kind: "mcp", tool: "mcp__xo_comms__wake_me" }, "alarm"],
    [{ kind: "mcp", tool: "mcp__xo_comms__reply" }, "chat"], [{ kind: "mcp", tool: "mcp__xo_comms__ask" }, "question"], [{ kind: "mcp", tool: "mcp__xo_comms__fetch_thread" }, "eye"],
    [{ kind: "mcp", tool: "mcp__xo_comms__brand_new" }, "plug"], [{ kind: "mcp", tool: "mcp__github__create_issue" }, "plug"],
  ];
  for (const [r, n] of want) assert.equal(stepIcon(r), n, JSON.stringify(r));
  assert.match(tv, /<span class="tb-ri">\$\{xi\(stepIcon\(r\)\)\}<\/span>/);
  assert.match(read("js/runsview.js"), /<span class="tb-ri">\$\{xi\(stepIcon\(\{ kind: it\.kind, tool: it\.tool, target: it\.target, line: it\.title \}\)\)\}<\/span>/);
});
await t("every name the rows can draw is in the pack", () => {
  const names = [...iconSrc.slice(iconSrc.indexOf("const KIND_ICON"), iconSrc.indexOf("export function stepIcon")).matchAll(/"([a-z-]+)"\]?[,\s}]/g)].map((m) => m[1]);
  assert.ok(names.length > 20);
  for (const n of names) assert.ok(has(n), n);
  assert.match(iconSrc, /delete_file: "delete"/); assert.match(iconSrc, /error: "alert"/); assert.match(iconSrc, /notice: "info"/); assert.match(iconSrc, /list: "folder-open"/);
});
await t("the git states name icons present in the pack", async () => {
  const { GIT_ICON } = await import("../core/services/git-state.js");
  assert.deepEqual(GIT_ICON, { unsaved: "edit", unpushed: "cloud-upload", unmerged: "pull-request", shipped: "merge" });
  for (const name of Object.values(GIT_ICON)) assert.ok(has(name), name);
});
await t("Shells is its icon and count, named for a screen reader", () => {
  const html = read("index.html");
  assert.match(html, /class="gear is-ic sh-tog" id="nv-shells"[^>]*aria-label="Shells"/);
  assert.doesNotMatch(html, /<span class="gear-t">Shells<\/span>/);
  assert.match(read("css/side.css"), /\.gear\.sh-tog:has\(\.sh-n:not\(:empty\)\)\{width:auto;padding-inline:var\(--s-2\)\}/);
});
await t("panel heads lead with their place's icon; Map's switch is its two icons", () => {
  const st = panelSrc;
  assert.match(st, /const FRAME_IC = \{ agents: "threads", changes: "changes", map: "map" \};/);
  assert.match(st, /\$\{xi\(FRAME_IC\[id\], "fr-ic"\)\}\$\{title\}/);
  assert.match(st, /data-map-mode="tree" title="Diagram" aria-label="Diagram">\$\{ICON\.map\}/);
  assert.match(st, /data-map-mode="graph" title="Graph" aria-label="Graph">\$\{ICON\.graph\}/);
});
await t("the editor's state is the working mark, save and its key, or a check", () => {
  const v = read("js/viewer.js");
  assert.match(v, /<span class="spin" aria-hidden="true"><\/span><span class="sr-only">Saving…<\/span>/);
  assert.match(v, /\$\{xi\("save"\)\}<span class="sr-only">Unsaved<\/span>\$\{keyHtml/);
  assert.match(v, /\$\{ICON\.check\}<span class="sr-only">Saved<\/span>/);
});
await t("Launchpad's Live and failed marks are the threads' state-done and state-failed", () => {
  const tok = read("core/ui/tokens.css"), lp = read("modules/launchpad/launchpad.css");
  assert.match(tok, /--mask-done:url\(\/core\/ui\/icons\/source\/xo\/e-state-marks\/state-done\.svg\)/);
  assert.match(tok, /--mask-failed:url\(\/core\/ui\/icons\/source\/xo\/e-state-marks\/state-failed\.svg\)/);
  assert.match(lp, /\.lp-st:is\(\.t-go,\.t-stop\)>i:not\(\.lp-arc\)\{width:var\(--ic-sm\);height:var\(--ic-sm\);mask:var\(--mask-done\)\}/);
  assert.match(lp, /\.lp-st\.t-stop>i:not\(\.lp-arc\)\{mask:var\(--mask-failed\)\}/);
});
await t("the sidebar's More is the pack's dashboard", () => {
  assert.match(read("js/app.js"), /\$\("#ic-more"\)\.innerHTML = xi\("dashboard"\);/);
});
await t("an icon's size is a token: no svg rule writes its own px (15, 13, 17 and 18 blurred the pack's 24 grid)", async () => {
  const { readdirSync } = await import("node:fs");
  for (const f of readdirSync(new URL("../css/", import.meta.url)).filter((x) => x.endsWith(".css") && x !== "tokens.css")) {
    const css = read(`css/${f}`);
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (m[1].includes("svg")) assert.doesNotMatch(m[2], /(^|;)(width|height):\d+px/, `${f}: ${m[1].trim()}`);
  }
});
await t("the exact pack icon for a download, a new tab, an undo, made code, links and data, and sub-agents", () => {
  const ui = read("core/ui/icons/names.js");
  for (const [k, n] of [["download", "download"], ["undo", "undo"], ["table", "table"], ["code", "code"], ["link", "link"], ["agent", "agent"], ["out", "external-link"]]) assert.match(ui, new RegExp(`  ${k}: xi\\("${n}"\\),`), k);
  assert.doesNotMatch(ui, /down: xi\("arrow-down"\)/);
  assert.match(read("core/ui/lightbox.js"), /title="Download">\$\{ICON\.download\}/);
  const v = read("js/viewer.js");
  assert.equal(v.match(/\$\{ICON\.download\}<span>Download<\/span>/g).length, 2);
  assert.match(v, /\$\{ICON\.out\}<span>Open in a new tab<\/span>/);
  assert.match(read("modules/launchpad/views.js"), /btn\("undo", "Undo", ICON\.undo\)/);
  assert.match(read("modules/artifacts/cards.js"), /data: ICON\.table, code: ICON\.code, link: ICON\.link,/);
  assert.match(read("js/runsview.js"), /title="What its sub-agents did">\$\{ICON\.agent\}/);
});
await t("the title bar's tile centres on the title's first line, from the line height and the tile", () => {
  const f = read("css/foundation.css");
  assert.match(f, /\.tw-ic\{width:var\(--tile-sm\);height:var\(--tile-sm\);/);
  assert.match(f, /\.top-who>\.tw-ic\{margin-block:calc\(\(var\(--lh-title\) - var\(--tile-sm\)\) \/ 2\)\}/);
  assert.match(read("css/side.css"), /\.pj-pick\{[^}]*height:var\(--h-ctl\);margin:calc\(\(var\(--lh-title\) - var\(--h-ctl\)\) \/ 2\) /);
  assert.doesNotMatch(read("css/app.css"), /\.tw-ic\{[^}]*width:30px/);
  assert.match(read("css/app.css"), /\.help\.gear\{padding:0;justify-content:center\}/, "the phone gear is icon-only, not squeezed by the sidebar gear's text padding");
});
await t("a thinking step leads with the brain, in a turn and in a sub-agent's work, and its line shows it", () => {
  assert.match(read("core/ui/icons/names.js"), /  brain: xi\("brain"\),/);
  for (const f of ["js/turnview.js", "js/runsview.js"]) assert.match(read(f), /<span class="tb-hi">\$\{ICON\.brain\}<\/span><span class="tb-ht/, f);
  assert.match(read("css/foundation.css"), /\.turn>\.tb:not\(\.tb-think\)>\.tb-h \.tb-hi\{display:none\}/);
});
await t("a running tool group leads with its running step's own icon (blue while live), never an empty arc slot", () => {
  assert.match(read("js/turnview.js"), /<span class="tb-hi">\$\{cur\.length \? xi\(stepIcon\(cur\[0\]\)\) : ICON\.list\}<\/span>/);
  assert.match(read("css/app.css"), /\.tb\.is-live>\.tb-h \.tb-hi,[^{]*\{color:var\(--info\)\}/);
});
await t("the latest thinking under a closed work fold keeps its brain: no rule hides a line's icon there", () => {
  assert.doesNotMatch(read("css/app.css"), /\.tb-work:not\(\.is-open\)>\.tb>\.tb-h \.tb-hi\{display:none\}/);
});
await t("a step's icon is blue while it runs and grey once finished, as a line's header or as a row, opened or not", () => {
  assert.match(read("css/app.css"), /\.tb\.is-live>\.tb-h \.tb-hi,:is\(\.tb-row,\.rt-call\)\.s-running:not\(\.is-waiting\) \.tb-ri,\.tb-spin\{color:var\(--info\)\}/);
  assert.match(read("css/msgx.css"), /:root\[data-msgx\] \.m-turn \.tb-work\.is-open \.tb-rail \.tb-hi\{display:grid\}/);
});
await t("a plan's line leads with the checklist, as its steps do", () => {
  assert.match(read("js/turnview.js"), /<span class="tb-hi">\$\{xi\("checklist"\)\}<\/span><span class="tb-ht">\$\{esc\(b\.header \|\| "Plan"\)\}/);
});
console.log(`\n${passed} passed`);
