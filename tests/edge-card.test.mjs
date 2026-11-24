// One card at the right edge: a file opened over a decision sets it aside, and closing the file brings it back (and the other way round).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createKernel } from "../core/kernel/index.js";
import { stackLayers } from "../shell/layers.js";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const app = read("js/app.js"), dec = read("modules/decisions/controller.js"), vw = read("modules/files/viewer.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the rule: what opens parks the open card it covers; that card comes back when the one over it closes", () => {
  const src = app.slice(app.indexOf("const EDGE = "), app.indexOf("const D = createDecisions("));
  const make = new Function("D", `${src}; return { EDGE, edgeOver, edgeBack, decisionsCard };`);
  const log = [];
  const card = (n) => ({ open: false, parked: false, get isOpen() { return this.open && !this.parked; }, park() { this.parked = true; log.push(n + " park"); }, unpark() { this.parked = false; log.push(n + " back"); } });
  const dc = card("decision"), file = card("file");
  const E = make({ isOpen: () => dc.isOpen, park: () => dc.park(), unpark: () => dc.unpark() });
  dc.open = true;
  file.open = true; E.edgeOver(E.decisionsCard);
  assert.deepEqual(log, ["decision park"]);
  assert.equal(E.EDGE.under, E.decisionsCard);
  E.edgeBack(file);
  assert.deepEqual(log, ["decision park"], "only the card it covered comes back");
  file.open = false; E.edgeBack(E.decisionsCard);
  assert.deepEqual(log, ["decision park", "decision back"]);
  assert.equal(E.EDGE.under, null);
  file.open = true; E.edgeOver(file);
  assert.deepEqual(log.slice(2), ["file park"], "a decision opened over a file sets the file aside");
  E.edgeOver(E.decisionsCard);
  assert.equal(log.length, 4, "nothing parked twice");
});
t("wired: the decisions panel and the file window both use it", () => {
  assert.match(app, /onShown: \(\) => edgeOver\(VW\),\n\s*onGone: \(\) => edgeBack\(VW\),/);
  assert.match(app, /opened: \(f, o\) => \{ edgeOver\(decisionsCard\); FP\.show\(o\); \},\n\s*closed: \(\) => edgeBack\(decisionsCard\),/);
  assert.match(vw, /closed && closed\(\);\n\s*onChange && onChange\(\);/);
});
t("a decision set aside keeps its place, isn't open meanwhile, and comes back with focus", () => {
  assert.match(dec, /isOpen: \(\) => F\.open && !F\.parked,/);
  assert.match(dec, /function park\(\) \{\n\s*if \(!F\.open \|\| F\.parked\) return;\n\s*F\.parked = true; panel\.hidden = true;\n\s*document\.body\.classList\.remove\("panel-open"\);/);
  assert.match(dec, /function unpark\(\) \{[\s\S]*?document\.body\.classList\.add\("panel-open"\);[\s\S]*?\(\$\("#card"\) \|\| panel\)\.focus\(/);
  assert.match(dec, /onShown && onShown\(\);\n\s*return true;/);
  assert.match(dec, /if \(restore && was\)[^\n]*\n\s*toastRender\(\);\n\s*render\(\);\n\s*onGone && onGone\(\);/, "closed while aside, it takes no focus");
});
t("phone Back asks about unsaved edits when it reaches the standalone file viewer", () => {
  const src = app.slice(app.indexOf("const LAYERS = "), app.indexOf("const placeOk = "));
  const make = new Function("stackLayers", "kernel", "state", `
    const { create, jump, keys, allEl, setEl, IQ, QO, RS, LB, FP, VW, STAGE, PHONE, SH, D, CH, $ } = state;
    const CREATE = create;
    ${src}
    return LAYERS;
  `);
  const kernel = createKernel({ warn: (message, error) => { throw error; }, log() {} });
  const closed = [];
  const hidden = { hidden: true };
  const layers = make(stackLayers, kernel, {
    create: { isOpen: () => false }, jump: hidden, keys: hidden, allEl: hidden, setEl: hidden,
    IQ: {}, QO: {}, RS: {}, LB: {}, FP: {}, SH: {}, CH: {},
    VW: { isOpen: true, close: (options) => closed.push(options) },
    STAGE: { isOpen: true }, PHONE: { matches: true }, D: { isOpen: () => false },
    $: () => ({ classList: new Set() }),
  });
  assert.equal(layers.open(), true);
  assert.equal(layers.back(), true);
  assert.deepEqual(closed, [{ ask: true }]);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
