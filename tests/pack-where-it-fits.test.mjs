// The pack's exact icon where a word or a generic mark stood: commands, git state, Shells, panel heads, the editor's state, Launchpad.
//   node tests/pack-where-it-fits.test.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const has = (name) => ["a-places-and-the-frame", "c-actions", "d-things-and-kinds", "e-state-marks", "j-new-in-the-pack", "k-more-icons", "p-devices-development-and-everyday"].some((d) => existsSync(new URL(`../assets/icons/xo/${d}/${name}.svg`, import.meta.url)));
let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

const tv = read("js/turnview.js");
const cmdSrc = tv.slice(tv.indexOf("const CMD_ICON"), tv.indexOf("const icon ="));
const cmdIcon = new Function(`${cmdSrc.replace("export function", "function")}; return cmdIcon;`)();

await t("a command row shows the icon of what it does; anything else stays a terminal", () => {
  const want = {
    'git commit -m "x"': "commit", "git push origin feat/a": "cloud-upload", "git -C repo push": "cloud-upload", "git pull": "download",
    "git merge release/x": "merge", "git rebase main": "merge", "git diff --stat": "diff", "git status --short": "diff",
    "git switch -c feat/a": "branch", "git log --oneline -3": "history", "gh pr create": "pull-request",
    "npm test": "test-flask", "npm run test": "test-flask", "pytest -q": "test-flask", "node tests/a.test.mjs": "test-flask",
    "docker build .": "container", "curl -s http://x": "api", "cd repo && git commit -am x": "commit", "FOO=1 git push": "cloud-upload",
    "ls -la": "terminal", "": "terminal", "echo git commit": "terminal",
  };
  for (const [c, n] of Object.entries(want)) assert.equal(cmdIcon(c), n, c);
});
await t("every name the rows can draw is in the pack", () => {
  const names = [...tv.slice(tv.indexOf("const KIND_ICON"), tv.indexOf("export function cmdIcon")).matchAll(/"([a-z-]+)"\]?[,\s}]/g)].map((m) => m[1]);
  assert.ok(names.length > 20);
  for (const n of names) assert.ok(has(n), n);
  assert.match(tv, /delete_file: "delete"/); assert.match(tv, /error: "alert"/); assert.match(tv, /notice: "info"/); assert.match(tv, /list: "folder-open"/);
});
await t("git state is its icon and count; the words stay for the tooltip and a screen reader", () => {
  assert.match(read("js/record.js"), /export const GIT_ICON = \{ unsaved: "edit", unpushed: "cloud-upload", unmerged: "pull-request", shipped: "merge" \};/);
  const rv = read("js/recordview.js");
  assert.match(rv, /title="\$\{esc\(git\.word\)\}"><span class="sr-only">\$\{esc\(git\.word\)\}<\/span>\$\{xi\(ic\)\}/);
});
await t("Shells is its icon and count, named for a screen reader", () => {
  const html = read("index.html");
  assert.match(html, /class="gear is-ic sh-tog" id="nv-shells"[^>]*aria-label="Shells"/);
  assert.doesNotMatch(html, /<span class="gear-t">Shells<\/span>/);
  assert.match(read("css/side.css"), /\.gear\.sh-tog:has\(\.sh-n:not\(:empty\)\)\{width:auto;padding-inline:var\(--s-2\)\}/);
});
await t("panel heads lead with their place's icon; Map's switch is its two icons", () => {
  const st = read("js/stage.js");
  assert.match(st, /const FRAME_IC = \{ launch: "deploy", agents: "threads", changes: "changes", map: "map" \};/);
  assert.match(st, /\$\{xi\(FRAME_IC\[id\], "fr-ic"\)\}\$\{title\}/);
  assert.match(st, /data-map-mode="tree" title="Diagram" aria-label="Diagram">\$\{ICON\.map\}/);
  assert.match(st, /data-map-mode="graph" title="Graph" aria-label="Graph">\$\{ICON\.graph\}/);
});
await t("the editor's state is the working mark, save and its key, or a check", () => {
  const v = read("js/viewer.js");
  assert.match(v, /<span class="spin" aria-hidden="true"><\/span><span class="sr-only">Saving…<\/span>/);
  assert.match(v, /\$\{xi\("save"\)\}<span class="sr-only">Unsaved<\/span>\$\{K\.keyHtml/);
  assert.match(v, /\$\{ICON\.check\}<span class="sr-only">Saved<\/span>/);
});
await t("Launchpad's Live and failed marks are the threads' state-done and state-failed", () => {
  const tok = read("css/tokens.css"), lp = read("css/launchpad.css");
  assert.match(tok, /--mask-done:url\(\.\.\/assets\/icons\/xo\/e-state-marks\/state-done\.svg\)/);
  assert.match(tok, /--mask-failed:url\(\.\.\/assets\/icons\/xo\/e-state-marks\/state-failed\.svg\)/);
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
console.log(`\n${passed} passed`);
