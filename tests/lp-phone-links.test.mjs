// @ts-check

import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { list } from "postcss";
import { templateElements } from "../tools/conformance/templates.mjs";
import { context, px, spec, cmp, covers } from "./lib/cascade.mjs";
import { declarationsFor, publishedRules, resolveValue } from "./lib/css-snapshot.mjs";
import { tokens } from "./lib/tokens.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const launchpadFiles = /^(?:modules\/(?:launchpad|shells)\/|shell\/panel\/|modules\/create-project\/create\.js$|modules\/chats\/intel[-.])/;
const all = publishedRules();
const at = (w) => all.map((r) => ({ r, c: context(r, w), s: spec(r.sel) })).filter((x) => x.c.active && !x.c.cond);
const P = at(390), D = at(1440);
/** the winning value of p for the elements of selector B, among the rules that style all of them */
const win = (live, B, p) => {
  let w = null;
  for (const X of live) {
    if (!covers(X.r.sel, B)) continue;
    for (const d of X.r.declarations) {
      if (d.p !== p) continue;
      const beats = !w || (d.imp !== w.imp ? d.imp : cmp(X.s, w.s) > 0 || (cmp(X.s, w.s) === 0 && X.r.n > w.n));
      if (beats) w = { s: X.s, n: X.r.n, v: d.v, imp: d.imp, sel: X.r.sel };
    }
  }
  return w;
};
const mobile = declarationsFor((selector) => selector.includes("a[class]") && selector.startsWith(":where("), "min-height");
const floor = mobile.find((row) => resolveValue(row.value) === "36px");
assert.ok(floor, "the shared link floor");
const exclusions = /:where\(:not\((.*)\)\)$/.exec(floor.context.at(-1).selector);
assert.ok(exclusions);
const excluded = new Set(list.comma(exclusions[1]));
const floored = (selector) => !(selector.match(/\.[\w-]+/g) ?? []).some((name) => excluded.has(name));
const tall = (live, selector) => {
  const own = win(live, selector, "min-height");
  const min = own ? px(own.v, tokens) || 0 : live === P && floored(selector) ? 36 : 0;
  return Math.max(px(win(live, selector, "height")?.v ?? "", tokens) || 0, min);
};

const links = new Set();
for (const element of templateElements(root, (file) => launchpadFiles.test(file))) {
  if (!element.matches("a[class]")) continue;
  const classes = Array.from(element.classList).filter((name) => name && !name.startsWith("is-"));
  if (classes.length) links.add("a." + classes.join("."));
}

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the census finds Launchpad's boxed links (Open in Launchpad and Logs on GitHub, Open, the address)", () => {
  for (const B of ["a.btn.lp-b", "a.btn.btn-pri.lp-go", "a.lq-host"]) assert.ok(links.has(B), `${B} in the census`);
});

t("on a phone (390) every boxed link is at least 36 px tall (S267: Open in Launchpad was 32)", () => {
  const bad = [];
  for (const B of links) {
    const disp = win(P, B, "display")?.v || "inline";
    if (/^(inline|contents|none)$/.test(disp)) continue; // a text link in a sentence (Logs, the host, Copy code and open GitHub)
    const h = tall(P, B);
    if (h < 36) bad.push(`${B} (${disp}) is ${h || "content"} px tall`);
  }
  assert.deepEqual(bad, [], `boxed links under the phone's 36:\n  ${bad.join("\n  ")}`);
});

t("the desktop keeps its sizes: a link button is a button, 40 in the window", () => {
  assert.equal(tall(D, ".dlg a.btn.lp-b"), 40);
  assert.equal(tall(D, ".dlg a.btn.btn-pri.lp-go"), 40);
  assert.equal(win(D, "a.btn.lp-b", "min-height"), null, "no min-height on the desktop");
});

console.log(`${passed} passed${process.exitCode ? ", some failed" : ""}`);
