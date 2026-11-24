// The owner's icon pack (core/ui/icons/source/xo, 19 Nov) is the one source of the app's icons: core/ui/icons/xoicons.js is what
// tools/xoicons/build.mjs makes of it (each file passed an allowlist; ink is currentColor; no Figma ids), and every
// icon set (ICON, the panel, Map, Files, viewer, chat, steps, Launchpad, links, file types, project topics) draws
// from it, so no module keeps a hand-drawn <svg> of its own.
//   node tests/xoicons.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourcePaths } from "./lib/sources.mjs";
import { build, clean } from "../tools/xoicons/build.mjs";
import { XI } from "../core/ui/icons/xoicons.js";
import { xi, hasIcon } from "../core/ui/icons/icon.js";
import { ICON } from "../core/ui/icons/names.js";
import { classify, glyph } from "../modules/projects/projicons.js";
import { fileIcon, iconKey, FOLDER_ICON } from "../core/ui/icons/fileicons.js";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("core/ui/icons/xoicons.js is what the pack makes (rebuild: node tools/xoicons/build.mjs)", () => {
  assert.equal(read("core/ui/icons/xoicons.js"), build());
  const man = JSON.parse(read("core/ui/icons/source/xo/manifest.json"));
  assert.equal(Object.keys(XI).length, man.icons.length);
});

t("a file outside the allowlist stops the build, naming it", () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g><clipPath id="c"><rect width="24" height="24"/></clipPath><g clip-path="url(#c)">X</g></g></svg>';
  assert.doesNotThrow(() => clean("ok", ok.replace("X", '<path d="M0 0" stroke="rgb(29 29 31)"/>')));
  for (const bad of ['<script>x</script>', '<foreignObject/>', '<path onload="x" d="M0 0"/>', '<path fill="url(https://e.x/a)"/>',
    '<path d="M0 0" style="x"/>', '<image href="data:x"/>', '<!-- x -->']) {
    assert.throws(() => clean("bad", ok.replace("X", bad)), /bad/, bad);
  }
});

t("the ink is currentColor, Figma's wrapper and ids are gone", () => {
  const all = Object.values(XI).map((v) => v[1]).join("");
  assert.doesNotMatch(all, /rgb\(29 29 31\)|clip-path|clipPath|\bid=/);
  // what keeps its own colours: the app icon (a tab can't take the page's ink) and the pack's two-tone marks
  const own = Object.entries(XI).filter(([, v]) => /rgb\(/.test(v[1])).map(([k]) => k).sort();
  assert.deepEqual(own, ["badge-working", "check-circle-fill", "favicon", "favicon-progress", "x-circle-fill"]);
  assert.match(XI["xo-mark"][1], /class="x"[\s\S]*class="o"/, "the mark's X and O take the themes' --mark-x / --mark-o");
});

t("xi(): the pack's icon, its name on it, a size only from the scale", () => {
  assert.match(xi("home"), /^<svg class="xi" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" data-xi="home">/);
  assert.match(xi("lock", "", "sm"), /class="xi ic-sm"/);
  assert.throws(() => xi("lock", "", "15"));
  assert.throws(() => xi("no-such-icon"));
  const base = read("core/ui/foundation.css");
  assert.match(base, /:where\(svg\.xi:not\(\.xo-mark\)\)\{width:var\(--ic\);height:var\(--ic\)\}/);
  for (const k of ["xs", "sm", "lg"]) assert.match(base, new RegExp(`:where\\(svg\\.xi\\.ic-${k}\\)\\{width:var\\(--ic-${k}\\);height:var\\(--ic-${k}\\)\\}`));
});

t("every icon a module names is in the pack", () => {
  const files = sourcePaths(".js");
  const names = new Set();
  for (const f of files) for (const m of read(f).matchAll(/\bxi\("([a-z0-9-]+)"/g)) names.add(m[1]);
  assert.ok(names.size > 60, `${names.size} names`);
  for (const n of names) assert.ok(hasIcon(n), n);
});

t("no module keeps a hand-drawn icon: every set draws from the pack", () => {
  const sets = ["core/ui/icons/names.js", "shell/panel/panel.js", "shell/panel/pages.js", "shell/panel/frames.js", "shell/panel/lists.js", "modules/map/map.js", "modules/map/head.js", "modules/map/tree.js", "modules/map/drawing.js", "modules/files/files.js", "modules/files/page.js", "modules/changes/frame.js", "modules/settings/shape-page.js",
    "modules/files/viewer.js", "modules/files/viewer-head.js", "modules/files/viewer-text.js", "core/ui/lightbox.js", "modules/create-project/create.js", "modules/chats/intel-view.js", "modules/search/quickopen.js", ...sourcePaths(".js").filter((p) => p.startsWith("modules/conversation/")), ...sourcePaths(".js").filter((p) => p.startsWith("modules/launchpad/")),
    "core/ui/markdown/inline.js", "core/ui/markdown/markdown.js", "modules/projects/projicons.js"];
  for (const f of sets) assert.doesNotMatch(read(f), /<svg viewBox="0 0 24 24"|<path d="M|const I = \(d/, f);
  const ui = read("core/ui/icons/names.js");
  const block = ui.slice(ui.indexOf("export const ICON = {"), ui.indexOf("\n};", ui.indexOf("export const ICON = {")));
  for (const line of block.split("\n").slice(1)) if (/^ {2}\w+:/.test(line)) assert.match(line, /: xi\("[a-z0-9-]+"/, line);
  // the stamps and the Stop come from the pack too; the undo ring (an animation) and the tab's live icon are drawn
  assert.match(read("js/decide.js"), /const BIG_CHECK = ICON\.stampAllow;\nconst BIG_BACK = ICON\.stampBack;/);
  assert.doesNotMatch(read("js/app.js"), /viewBox="0 0 52 52"/);
});

t("project topics: each topic is the owner's project-<topic>; nothing placed keeps the cube", () => {
  const src = read("modules/projects/projicons.js");
  const topics = [...src.matchAll(/^ {2}\["([a-z-]+)", "/gm)].map((m) => m[1]);
  assert.equal(topics.length, 31);
  for (const k of topics) assert.ok(hasIcon(`project-${k}`), k);
  assert.equal(classify("cron jobs").icon, "automation");
  assert.equal(classify("Telescope research").icon, "research");
  assert.equal(classify("qwzx").icon, "project");
  assert.match(glyph("research"), /data-xi="project-research"/);
  assert.match(glyph("project"), /data-xi="project"/);
});

t("file types: the plain kinds are the owner's, in their kind's colour; others' marks stay theirs", () => {
  for (const [name, own] of [["a.json", "file-json"], ["b.txt", "file-text"], ["c.sh", "file-shell"], ["d.csv", "file-table"],
    ["e.weird", "file-default"], ["f.zip", "file-archive"], ["g.tar.gz", "file-archive"], ["h.pdf", "file-pdf"], ["i.md", "file-markdown"]]) {
    assert.ok(fileIcon(name).includes(XI[own][1]), `${name} → ${own} (${iconKey(name)})`);
    assert.match(fileIcon(name), /^<svg class="fi" /);
  }
  assert.doesNotMatch(fileIcon("x.ts"), /currentColor" stroke-width="1\.75/, "TypeScript keeps its own mark");
  assert.match(FOLDER_ICON, /data-fi="folder"[^>]*class="xi fi fi-line"[^>]*data-xi="folder"/);
});

t("the app icon is the owner's; the tab's working line sits on its foot", () => {
  const fav = read("favicon.svg");
  assert.match(fav, /viewBox="0 0 48 48"/);
  assert.match(fav, /<rect width="48" height="48" rx="11" fill="#151515"\/>/);
  const app = read("shell/favicon.js");
  assert.match(app, /const W = 28\.5, X = 9\.75, GAP = 1\.5/);
  assert.match(app, /y="35" width="\$\{w\.toFixed\(2\)\}" height="2\.5" rx="1\.25"/);
});

t("every ICON name used by an importer exists in the icon catalogue", () => {
  const keys = new Set(Object.keys(ICON));
  const users = sourcePaths(".js").filter((f) => /import \{[^}]*\bICON\b[^}]*\} from "[^"]*(?:ui|icons\/names)\.js"/.test(read(f)));
  assert.ok(users.includes("modules/shells/dock-view.js"));
  const missing = users.flatMap((f) => [...read(f).matchAll(/(?<![\w.])ICON\.([A-Za-z0-9_]+)/g)].map((m) => m[1]).filter((k) => !keys.has(k)).map((k) => `${f}: ICON.${k}`));
  assert.deepEqual(missing, []);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
