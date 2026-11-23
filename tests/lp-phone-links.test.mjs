// A link drawn as a control is a control: at least 36 px tall on a phone, like every button (the owner's floor, 9 Nov).
// phone.css's floor reached buttons and the control roles, not links, so Launchpad's boxed links fell under it. Grader B
// on 05d76ca saw S267: "Open in Launchpad" (a.lp-b, a live app) was 161×32 at 390, in both themes. "Logs on GitHub"
// shares its rule, and the address card's and the section head's "Open it" were 32 and 24 tall.
//
// The census: every <a class=…> in Family 2's files (Launchpad, Create, Shells, the stage, the picker). One drawn as a
// box (its display a flex, grid or block, not an inline text link in a sentence) must reach 36 px at 390. That comes
// from its own height or a min-height, by the cascade model of tests/lib/cascade.mjs, or from phone.css's floor, which
// now reaches every link with a class but a link in text (the model can't read the floor's :where list, so it's read
// here). The desktop's sizes stay as they are. No browser.
//   node tests/lp-phone-links.test.mjs
import assert from "node:assert/strict";
import { resolveTokens } from "./lib/tokens.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { sourcePaths } from "./lib/sources.mjs";
import { rules, context, decls, px, spec, cmp, covers } from "./lib/cascade.mjs";

const ROOT = new URL("../", import.meta.url);
const tokens = Object.fromEntries([...readFileSync(new URL("core/ui/tokens.css", ROOT), "utf8").matchAll(/(--[\w-]+):\s*(\d+(?:\.\d+)?)px/g)].map((m) => [m[1], +m[2]]));
const FILES = [...sourcePaths(".js").filter((p) => p.startsWith("modules/launchpad/")), "modules/create-project/create.js", "shell/panel/panel.js", "shell/panel/pages.js", "shell/panel/frames.js", "shell/panel/lists.js", "modules/chats/intel.js", "modules/chats/intel-catalog.js", "modules/chats/intel-view.js", "modules/chats/intel-input.js", ...readdirSync(new URL("modules/shells/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => `modules/shells/${f}`)];
const all = rules(new URL("tests/lib/x.mjs", ROOT));
const at = (w) => all.map((r) => ({ r, c: context(r, w), s: spec(r.sel) })).filter((x) => x.c.active && !x.c.cond);
const P = at(390), D = at(1440);
/** the winning value of p for the elements of selector B, among the rules that style all of them */
const win = (live, B, p) => {
  let w = null;
  for (const X of live) {
    if (!covers(X.r.sel, B)) continue;
    for (const d of decls(X.r.d)) {
      if (d.p !== p) continue;
      const beats = !w || (d.imp !== w.imp ? d.imp : cmp(X.s, w.s) > 0 || (cmp(X.s, w.s) === 0 && X.r.n > w.n));
      if (beats) w = { s: X.s, n: X.r.n, v: d.v, imp: d.imp, sel: X.r.sel };
    }
  }
  return w;
};
// phone.css's floor: weightless (:where), so any min-height of a link's own outranks it
const phoneCss = resolveTokens(readFileSync(new URL("css/phone.css", ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""));
const FLOOR = /:where\(([^{]*?)\):where\(:not\(([^{]*)\)\)\{min-height:36px;min-width:36px\}/.exec(phoneCss);
const floored = (B) => !!FLOOR && FLOOR[1].split(",").includes("a[class]") && !(B.split(/[\s>]+/).pop().match(/\.[\w-]+/g) || []).some((k) => FLOOR[2].split(",").includes(k));
const tall = (live, B) => {
  const own = win(live, B, "min-height");
  const min = own ? px(own.v, tokens) || 0 : live === P && floored(B) ? 36 : 0;
  return Math.max(px(win(live, B, "height")?.v ?? "", tokens) || 0, min);
};
const PLACE = {};

const links = new Map();
for (const f of FILES) {
  const src = readFileSync(new URL(f, ROOT), "utf8");
  for (const m of src.matchAll(/<a\b([^>]*)>/g)) {
    const c = /class="([^"$]*)/.exec(m[1]);
    if (!c) continue;
    const ks = c[1].trim().split(/\s+/).filter((k) => k && !/^is-/.test(k));
    if (!ks.length) continue;
    const B = (PLACE[ks[0]] || "") + "a" + ks.map((k) => "." + k).join("");
    links.set(B, f);
  }
}

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the census finds Launchpad's boxed links (Open in Launchpad and Logs on GitHub, Open, the address)", () => {
  for (const B of ["a.btn.lp-b", "a.btn.btn-pri.lp-go", "a.lq-host"]) assert.ok(links.has(B), `${B} in the census`);
});

t("on a phone (390) every boxed link is at least 36 px tall (S267: Open in Launchpad was 32)", () => {
  const bad = [];
  for (const [B, f] of links) {
    const disp = win(P, B, "display")?.v || "inline";
    if (/^(inline|contents|none)$/.test(disp)) continue; // a text link in a sentence (Logs, the host, Copy code and open GitHub)
    const h = tall(P, B);
    if (h < 36) bad.push(`${f}: ${B} (${disp}) is ${h || "content"} px tall`);
  }
  assert.deepEqual(bad, [], `boxed links under the phone's 36:\n  ${bad.join("\n  ")}`);
});

t("the desktop keeps its sizes: a link button is a button, 40 in the window", () => {
  assert.equal(tall(D, ".dlg a.btn.lp-b"), 40);
  assert.equal(tall(D, ".dlg a.btn.btn-pri.lp-go"), 40);
  assert.equal(win(D, "a.btn.lp-b", "min-height"), null, "no min-height on the desktop");
});

console.log(`${passed} passed${process.exitCode ? ", some failed" : ""}`);
