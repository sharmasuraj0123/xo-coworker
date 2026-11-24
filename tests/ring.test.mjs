import assert from "node:assert/strict";
import { test } from "node:test";
import { regionRings, ringBox } from "../core/ui/a11y/ring.js";
import { publishedRules } from "./lib/css-snapshot.mjs";
import { createChangesFrame } from "../modules/changes/frame.js";
import { createViewerDiff } from "../modules/files/viewer-diff.js";
import { createViewerText } from "../modules/files/viewer-text.js";
import { dom } from "./lib/dom.mjs";

test("the Stage and viewer preserve their region tab stops", async () => {
  const { document: fixtureDoc } = await dom('<div id="changes"></div>');
  const { textBody } = createViewerText({ TX: {} });
  const { diffBody } = createViewerDiff({});
  const host = fixtureDoc.querySelector("#changes");
  createChangesFrame({ host });
  const text = textBody();
  const viewerDiff = diffBody();
  const changesDiff = host.querySelector(".cx-pd");
  assert.ok(text.matches(".vw-file.vw-doc"), "editable text follows the editor focus policy");
  assert.equal(text.getAttribute("tabindex"), "-1", "text can hold focus outside the tab order");
  assert.equal(viewerDiff.getAttribute("tabindex"), "0", "the viewer diff is in the tab order");
  assert.equal(changesDiff.getAttribute("tabindex"), "0", "the Changes diff is in the tab order");
});

test("the ring follows a rounded parent's inner corners only where the region meets them", () => {
  const pane = { width: 400, height: 300, radius: [12, 12, 12, 12], border: [1, 1, 1, 1] };
  const diff = ringBox({ left: 0, top: 35, width: 400, height: 265, radius: [0, 0, 0, 0] }, pane);
  assert.deepEqual(diff, { left: 0, top: 35, width: 400, height: 265, radius: [0, 0, 11, 11] });
  const file = ringBox({ left: 0, top: 52, width: 390, height: 792, radius: [0, 0, 0, 0] },
    { width: 390, height: 844, radius: [0, 0, 0, 0], border: [0, 0, 0, 0] });
  assert.deepEqual(file.radius, [0, 0, 0, 0]);
  const inset = ringBox({ left: 8, top: 40, width: 384, height: 240, radius: [6, 6, 6, 6] }, pane);
  assert.deepEqual(inset.radius, [6, 6, 6, 6]);
});

test("keyboard focus draws one ring on either region and resize follows its new bounds", async () => {
  const { document, window } = await dom('<div id="pane"><button class="vw-body">File</button>'
    + '<button class="cx-pd">Diff</button><button class="vw-body vw-doc">Editor</button></div>');
  const pane = document.getElementById("pane");
  const [file, diff, editor] = pane.children;
  let nextFrame = 0;
  let width = 600;
  let keyboard = true;
  let placed = true;
  const frames = new Map();
  const observed = new Set();
  const flush = () => { for (const [id, fn] of frames) { frames.delete(id); fn(); } };
  const win = {
    Element: window.Element,
    ResizeObserver: class {
      targets = new Set();
      observe(target) { this.targets.add(target); observed.add(target); }
      disconnect() { for (const target of this.targets) observed.delete(target); }
    },
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    requestAnimationFrame(fn) { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); },
    getComputedStyle(el) {
      return el === pane ? { borderBottomLeftRadius: "14px", borderBottomRightRadius: "14px", borderBottomWidth: "1px" } : {};
    },
  };
  Object.defineProperties(pane, { offsetWidth: { get: () => width }, offsetHeight: { value: 801 } });
  for (const region of [file, diff, editor]) {
    Object.defineProperties(region, {
      offsetParent: { get: () => placed ? pane : null }, offsetWidth: { get: () => width },
      offsetTop: { value: 52 }, offsetLeft: { value: 0 }, offsetHeight: { value: 748 },
    });
    const matches = region.matches.bind(region);
    region.matches = (selector) => selector === ":focus-visible" ? keyboard : matches(selector);
  }
  const dispose = regionRings(document, win);
  const originalElement = globalThis.Element;
  try {
    globalThis.Element = class ForeignElement {};
    file.focus();
  } finally {
    globalThis.Element = originalElement;
  }
  flush();
  const ring = file.nextElementSibling;
  assert.equal(ring?.className, "region-ring", "focus is narrowed in the supplied window");
  assert.ok(observed.has(file) && observed.has(pane), "the active region and parent are observed");
  assert.equal(ring.getAttribute("aria-hidden"), "true");
  assert.deepEqual([ring.style.left, ring.style.top, ring.style.width, ring.style.height], ["0px", "52px", "600px", "748px"]);
  assert.equal(ring.style.borderRadius, "0px 0px 13px 13px");
  assert.equal(file.classList.contains("has-ring"), true);
  width = 400;
  window.dispatchEvent(new window.Event("resize"));
  assert.equal(ring.style.width, "400px");
  diff.focus();
  flush();
  assert.equal(document.querySelectorAll(".region-ring").length, 1);
  assert.equal(diff.nextElementSibling?.className, "region-ring");
  assert.equal(file.classList.contains("has-ring"), false);
  editor.focus();
  flush();
  assert.equal(document.querySelectorAll(".region-ring").length, 0);

  keyboard = false;
  file.focus();
  flush();
  assert.equal(file.classList.contains("has-ring"), false);
  keyboard = true;
  placed = false;
  diff.focus();
  flush();
  assert.equal(diff.classList.contains("has-ring"), false);

  placed = true;
  file.focus();
  assert.equal(frames.size, 1);
  dispose();
  assert.equal(frames.size, 0);
  diff.focus();
  flush();
  assert.equal(document.querySelectorAll(".region-ring").length, 0);

  const retire = regionRings(document, win);
  file.focus();
  flush();
  assert.equal(document.querySelectorAll(".region-ring").length, 1);
  assert.equal(observed.size, 2);
  retire();
  assert.equal(observed.size, 0, "disposing the focused ring disconnects the active observations");
  assert.equal(file.classList.contains("has-ring"), false, "disposal restores the region's own focus outline");
  assert.equal(document.querySelectorAll(".region-ring").length, 0);
  diff.focus();
  assert.equal(frames.size, 0, "the retired ring no longer listens for focus");
});

test("the published ring covers both regions without intercepting the pointer", () => {
  const rules = publishedRules();
  const paints = rules.filter(({ sel }) => sel === ".region-ring");
  assert.equal(paints.length, 1);
  const style = new Map(paints[0].declarations.map(({ p, v }) => [p, v]));
  assert.equal(style.get("position"), "absolute");
  assert.equal(style.get("pointer-events"), "none");
  assert.ok(style.get("z-index"));
  assert.match(style.get("box-shadow"), /^inset 0 0 0 2px var\(--focus\)$/);
  const value = (selector, property) => rules.find(({ sel, declarations }) => sel === selector
    && declarations.some(({ p }) => p === property))?.declarations.find(({ p }) => p === property)?.v;
  const regions = rules.find(({ sel, declarations }) => sel.startsWith(":is(") && sel.includes(".vw-body") && sel.includes(".cx-pd")
    && declarations.some(({ p, v }) => p === "isolation" && v === "isolate"))?.sel;
  assert.ok(regions, "both regions keep their painted content under the ring");
  assert.equal(value(regions + ".has-ring:focus-visible", "outline"), "none");
  assert.equal(value(regions + ":focus-visible", "outline"), "2px solid var(--ring-in,var(--focus))");
  assert.equal(value(regions + ":focus-visible", "outline-offset"), "-2px");
  assert.ok(!rules.some(({ sel }) => sel.includes(".cx-pd:focus-visible") && sel.endsWith("::after")));
});
