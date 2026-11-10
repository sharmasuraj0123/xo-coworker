// A link drawn as a control is a control: at least 36 px tall on a phone, like every button (the owner's floor, 9 Nov).
// phone.css's floor reaches buttons and the control roles, not links, so Launchpad's boxed links fell under it. Grader B
// on 05d76ca saw S267: "Open in Launchpad" (a.lp-b, a live app) was 161×32 at 390, in both themes. "Logs on GitHub"
// shares its rule, and the address card's and the section head's "Open it" were 32 and 24 tall.
//
// The census: every <a class=…> in Family 2's files (Launchpad, Create, Shells, the stage, the picker). One drawn as a
// box (its display a flex, grid or block, not an inline text link in a sentence) must reach 36 px at 390. That comes
// from its own height or a min-height, by the cascade model of tests/lib/cascade.mjs. The desktop's sizes stay as
// they are. No browser.
//   node tests/lp-phone-links.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { rules, context, decls, px, spec, cmp, covers } from "./lib/cascade.mjs";

const ROOT = new URL("../", import.meta.url);
const tokens = Object.fromEntries([...readFileSync(new URL("css/tokens.css", ROOT), "utf8").matchAll(/(--[\w-]+):\s*(\d+(?:\.\d+)?)px/g)].map((m) => [m[1], +m[2]]));
const FILES = ["js/launchpad.js", "js/create.js", "js/stage.js", "js/intel.js", ...readdirSync(new URL("js/shells/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => `js/shells/${f}`)];
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
const tall = (live, B) => Math.max(px(win(live, B, "height")?.v ?? "", tokens) || 0, px(win(live, B, "min-height")?.v ?? "", tokens) || 0);
// where a link borrows another part's class, the place it's drawn into: the section head's Open it is the stage
// frame's icon button (.fr-ib), drawn into Launchpad's .lp-ha (checked below)
const PLACE = { "fr-ib": ".lp-ha>" };

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

t("the census finds Launchpad's boxed links (Open in Launchpad, Logs on GitHub, both Open it, the address, Open GitHub)", () => {
  for (const B of ["a.lp-b", "a.lp-ib", ".lp-ha>a.fr-ib", "a.lpm-host", "a.lp-go", "a.lp-go.lp-wide"]) assert.ok(links.has(B), `${B} in the census`);
  const lp = readFileSync(new URL("js/launchpad.js", ROOT), "utf8");
  assert.match(lp, /const ha = [^\n]*<a class="fr-ib"/, "the head's Open it is the .fr-ib link");
  assert.match(lp, /S\.ha\.innerHTML = ha/, "drawn into .lp-ha, directly");
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

t("the desktop keeps its sizes: Open in Launchpad 32, Open it 32 and 24", () => {
  assert.equal(tall(D, "a.lp-b"), 32);
  assert.equal(tall(D, "a.lp-ib"), 32);
  assert.equal(tall(D, ".lp-ha>a.fr-ib"), 24);
  assert.equal(win(D, "a.lp-b", "min-height"), null, "no min-height on the desktop");
});

console.log(`${passed} passed${process.exitCode ? ", some failed" : ""}`);
