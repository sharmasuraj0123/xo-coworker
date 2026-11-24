import assert from "node:assert/strict";
import * as ring from "../core/ui/a11y/ring.js";
import { createChangesFrame } from "../modules/changes/frame.js";
import { createViewerDiff } from "../modules/files/viewer-diff.js";
import { createViewerText } from "../modules/files/viewer-text.js";
import { declarationsFor, publishedRules } from "./lib/css-snapshot.mjs";
import { dom } from "./lib/dom.mjs";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const { document } = await dom('<div id="changes"></div>');
t("text can hold focus and both diff regions are tab stops", () => {
  const { textBody } = createViewerText({ TX: {} });
  const { diffBody } = createViewerDiff({});
  const host = document.querySelector("#changes");
  createChangesFrame({ host });
  const text = textBody();
  const viewerDiff = diffBody();
  const changesDiff = host.querySelector(".cx-pd");
  assert.ok(text.matches(ring.REGIONS) && viewerDiff.matches(ring.REGIONS) && changesDiff.matches(ring.REGIONS));
  assert.ok(text.matches(".vw-file.vw-doc"), "editable text follows the editor focus policy");
  assert.equal(text.getAttribute("tabindex"), "-1", "text can hold focus outside the tab order");
  assert.equal(viewerDiff.getAttribute("tabindex"), "0", "the viewer diff is in the tab order");
  assert.equal(changesDiff.getAttribute("tabindex"), "0", "the Changes diff is in the tab order");
});

t("the ring's box: the region's own, its corners following a rounded parent's inside where they meet it", () => {
  assert.equal(typeof ring.ringBox, "function");
  // the diff: below the pane's 35 px head, full width, to the pane's foot; the pane rounds 12 with a 1 px border
  const pane = { width: 400, height: 300, radius: [12, 12, 12, 12], border: [1, 1, 1, 1] };
  const d = ring.ringBox({ left: 0, top: 35, width: 400, height: 265, radius: [0, 0, 0, 0] }, pane);
  assert.deepEqual([d.left, d.top, d.width, d.height], [0, 35, 400, 265], "over the region's box");
  assert.deepEqual(d.radius, [0, 0, 11, 11], "square under the head, the pane's inner 11 at the foot");
  // the file on a phone: the viewer covers the screen, square
  const f = ring.ringBox({ left: 0, top: 52, width: 390, height: 792, radius: [0, 0, 0, 0] }, { width: 390, height: 844, radius: [0, 0, 0, 0], border: [0, 0, 0, 0] });
  assert.deepEqual(f.radius, [0, 0, 0, 0]);
  // a region inset from its parent keeps its own corners
  const i = ring.ringBox({ left: 8, top: 40, width: 384, height: 240, radius: [6, 6, 6, 6] }, pane);
  assert.deepEqual(i.radius, [6, 6, 6, 6]);
});

// a stand-in page for the real regionRings: a parent (the viewer, or the pane) holding a head and the region
function standIn({ fv = true, placed = true } = {}) {
  const L = {}, raf = [];
  const on = (type, fn) => (L[type] = L[type] || []).push(fn);
  const style = (o) => ({ borderTopLeftRadius: "0px", borderTopRightRadius: "0px", borderBottomRightRadius: "0px", borderBottomLeftRadius: "0px", borderTopWidth: "0px", borderRightWidth: "0px", borderBottomWidth: "0px", borderLeftWidth: "0px", ...o });
  const mk = (cls, extra = {}) => {
    const n = { cls: new Set(cls ? cls.split(" ") : []), kids: [], parentElement: null, style: {}, attrs: {}, ...extra };
    n.classList = { add: (k) => n.cls.add(k), remove: (k) => n.cls.delete(k), contains: (k) => n.cls.has(k) };
    n.setAttribute = (k, v) => (n.attrs[k] = v);
    Object.defineProperty(n, "className", { set: (v) => { n.cls = new Set(v.split(" ")); }, get: () => [...n.cls].join(" ") });
    Object.defineProperty(n, "isConnected", { get: () => !!n.parentElement || n === parent });
    Object.defineProperty(n, "nextElementSibling", { get: () => { const p = n.parentElement; return p ? p.kids[p.kids.indexOf(n) + 1] || null : null; } });
    n.after = (x) => { const p = n.parentElement; if (x.parentElement) x.parentElement.kids.splice(x.parentElement.kids.indexOf(x), 1); p.kids.splice(p.kids.indexOf(n) + 1, 0, x); x.parentElement = p; };
    n.remove = () => { const p = n.parentElement; if (p) { p.kids.splice(p.kids.indexOf(n), 1); n.parentElement = null; } };
    n.getClientRects = () => [1];
    return n;
  };
  const parent = mk("viewer", { offsetWidth: 600, offsetHeight: 800 });
  const head = mk("vw-top"), region = mk("vw-body vw-file", { offsetLeft: 0, offsetTop: 52, offsetWidth: 600, offsetHeight: 748 });
  for (const k of [head, region]) { k.parentElement = parent; parent.kids.push(k); }
  Object.defineProperty(region, "offsetParent", { get: () => (placed ? parent : null) });
  let focused = null;
  region.matches = (sel) => sel === ":focus-visible" ? fv && focused === region : sel.split(",").some((s) => region.cls.has(s.trim().slice(1)));
  head.matches = () => false;
  const doc = { addEventListener: on, get activeElement() { return focused; }, createElement: () => mk("") };
  const win = {
    addEventListener: on, requestAnimationFrame: (f) => raf.push(f),
    getComputedStyle: (n) => n === parent ? style({ borderTopLeftRadius: "14px", borderTopRightRadius: "14px", borderBottomRightRadius: "14px", borderBottomLeftRadius: "14px", borderTopWidth: "1px", borderRightWidth: "1px", borderBottomWidth: "1px", borderLeftWidth: "1px" }) : style(),
  };
  const fire = (type, target) => (L[type] || []).forEach((f) => f({ target }));
  const flush = () => { while (raf.length) raf.shift()(); };
  return { doc, win, parent, region, head, focus: () => { focused = region; fire("focusin", region); flush(); }, blur: () => { focused = null; fire("focusout", region); flush(); } };
}

t("the keyboard's focus on a region: the ring is drawn just after it, over its box; it goes when focus leaves", () => {
  assert.equal(typeof ring.regionRings, "function");
  const P = standIn();
  ring.regionRings(P.doc, P.win);
  P.focus();
  const r = P.region.nextElementSibling;
  assert.ok(r && r.cls.has("region-ring"), "the ring sits right after the region, inside the same parent");
  assert.equal(r.attrs["aria-hidden"], "true", "it says nothing to a screen reader: the region's own focus does");
  assert.deepEqual([r.style.left, r.style.top, r.style.width, r.style.height], ["0px", "52px", "600px", "748px"]);
  assert.equal(r.style.borderRadius, "0px 0px 13px 13px", "the viewer's inner corners at its foot");
  assert.ok(P.region.cls.has("has-ring"), "the region's own outline stands down for it");
  P.blur();
  assert.equal(P.region.nextElementSibling, null, "gone with the focus");
  assert.ok(!P.region.cls.has("has-ring"));
});
t("a click's focus (not the keyboard's) draws nothing; nor where the parent doesn't place the region (the outline stays)", () => {
  const A = standIn({ fv: false });
  ring.regionRings(A.doc, A.win);
  A.focus();
  assert.equal(A.region.nextElementSibling, null);
  const B = standIn({ placed: false });
  ring.regionRings(B.doc, B.win);
  B.focus();
  assert.equal(B.region.nextElementSibling, null);
  assert.ok(!B.region.cls.has("has-ring"), "its outline is the ring then");
});

t("one rule draws it for both regions; no copy per region", () => {
  const published = publishedRules();
  const rules = published.filter(({ sel }) => sel === ".region-ring");
  assert.equal(rules.length, 1, "one .region-ring rule");
  const ringPaint = new Map(rules[0].declarations.map(({ p, v }) => [p, v]));
  assert.equal(ringPaint.get("position"), "absolute");
  assert.equal(ringPaint.get("box-shadow"), "inset 0 0 0 2px var(--focus)");
  assert.equal(ringPaint.get("pointer-events"), "none");
  assert.ok(ringPaint.get("z-index"));
  const regions = ":is(.vw-body,.cx-pd)";
  const check = (selector, property, expected) => {
    assert.ok(declarationsFor(selector, property).some(({ value }) => value === expected), selector + " " + property);
  };
  check(regions, "isolation", "isolate");
  check(regions + ".has-ring:focus-visible", "outline", "none");
  check(regions + ":focus-visible", "outline", "2px solid var(--ring-in,var(--focus))");
  check(regions + ":focus-visible", "outline-offset", "-2px");
  assert.ok(!published.some(({ sel }) => sel === ".cx-pane:has(>.cx-pd:focus-visible)::after"));
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
