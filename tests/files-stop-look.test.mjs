import assert from "node:assert/strict";
import { publishedRules } from "./lib/css-snapshot.mjs";

const css = publishedRules();
const properties = (selector) => Object.fromEntries(css.filter(({ sel }) => sel === selector)
  .flatMap(({ declarations }) => declarations).map(({ p, v }) => [p, v]));
const send = properties(".send");
const stop = properties(".send.is-stop");
const glyph = properties(".send.is-stop svg");

assert.equal(send.width, "var(--comp-ctl)", "Send and Stop share the composer control width");
assert.equal(send.height, "var(--comp-ctl)", "Send and Stop share the composer control height");
assert.equal(send["border-radius"], "50%");
for (const name of ["width", "height", "margin", "border-radius"]) assert.equal(name in stop, false, name);
assert.equal(stop["--stop"], "var(--fill-4)");
assert.equal(stop["--ring-in"], "var(--focus)");
assert.equal(stop.background, "var(--stop)");
assert.equal(stop.color, "var(--ink)");
assert.equal(glyph.width, "var(--ic-lg)");
assert.equal(glyph.height, "var(--ic-lg)");
