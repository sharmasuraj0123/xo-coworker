import assert from "node:assert/strict";

const media = new EventTarget();
let width = 761;
let queries = 0;
globalThis.matchMedia = (query) => {
  queries++;
  assert.equal(query, "(max-width: 760px)");
  const [, threshold] = /max-width: (\d+)px/.exec(query);
  Object.defineProperty(media, "matches", { get: () => width <= Number(threshold) });
  return media;
};

const { PHONE } = await import("../viewport.js");
assert.equal(PHONE.matches, false);
width = 760;
assert.equal(PHONE.matches, true);
width = 759;
assert.equal(PHONE.matches, true);
width = 761;
assert.equal(PHONE.matches, false);
assert.equal(queries, 1);
