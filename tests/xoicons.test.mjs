import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dom } from "./lib/dom.mjs";
import { flattenStyles } from "../tools/conformance/css-flatten.mjs";
import { build, clean } from "../tools/xoicons/build.mjs";
import { XI } from "../core/ui/icons/xoicons.js";
import { xi, hasIcon } from "../core/ui/icons/icon.js";
import { ICON } from "../core/ui/icons/names.js";
import { classify, glyph, TOPICS } from "../modules/projects/projicons.js";
import { fileIcon, iconKey, FOLDER_ICON } from "../core/ui/icons/fileicons.js";
import { faviconRender } from "../shell/favicon.js";

const { document } = await dom('<link rel="icon" href="favicon.svg">');
const generated = await import(`data:text/javascript,${encodeURIComponent(build())}`);
const styles = flattenStyles(fileURLToPath(new URL("../", import.meta.url)));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("core/ui/icons/xoicons.js is what the pack makes (rebuild: node tools/xoicons/build.mjs)", () => {
  assert.deepEqual(XI, generated.XI);
  const man = JSON.parse(readFileSync(new URL("../core/ui/icons/source/xo/manifest.json", import.meta.url), "utf8"));
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
  const dimensions = (selector) => styles
    .filter((entry) => ["width", "height"].includes(entry.property) && entry.context.some((scope) => scope.selector === selector))
    .map(({ value }) => value);
  assert.deepEqual(dimensions(":where(svg.xi:not(.xo-mark))"), ["var(--ic)", "var(--ic)"]);
  for (const size of ["xs", "sm", "lg"]) assert.deepEqual(dimensions(`:where(svg.xi.ic-${size})`), Array(2).fill(`var(--ic-${size})`));
});

t("named icons render known entries with the pack's geometry", () => {
  const sample = document.createElement("div");
  assert.ok(Object.keys(ICON).length > 60);
  for (const [key, markup] of Object.entries(ICON)) {
    sample.innerHTML = markup;
    const svg = sample.querySelector("svg");
    const name = svg?.getAttribute("data-xi");
    assert.ok(hasIcon(name), key);
    assert.equal(svg.getAttribute("viewBox"), key === "cursor" ? "4.5 2.5 18 18" : XI[name][0], key);
  }
});

t("project topics: each topic is the owner's project-<topic>; nothing placed keeps the cube", () => {
  assert.equal(TOPICS.length, 31);
  for (const topic of TOPICS) assert.match(glyph(topic), new RegExp(`data-xi="project-${topic}"`));
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
  const fav = readFileSync(new URL("../favicon.svg", import.meta.url), "utf8");
  assert.match(fav, /viewBox="0 0 48 48"/);
  assert.match(fav, /<rect width="48" height="48" rx="11" fill="#151515"\/>/);
  const link = document.querySelector('link[rel="icon"]');
  faviconRender({ checklist: { total: 3, done: 1 } });
  const frame = document.createElement("div");
  frame.innerHTML = decodeURIComponent(link.getAttribute("href").split(",")[1]);
  const segments = [...frame.querySelectorAll('rect[y="35"]')];
  assert.deepEqual(segments.map((node) => [node.getAttribute("x"), node.getAttribute("width"), node.getAttribute("height"), node.getAttribute("rx")]),
    [["9.75", "8.50", "2.5", "1.25"], ["19.75", "8.50", "2.5", "1.25"], ["29.75", "8.50", "2.5", "1.25"]]);
  faviconRender(null);
  assert.equal(link.getAttribute("href"), "favicon.svg");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
