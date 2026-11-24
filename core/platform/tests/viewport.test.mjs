import assert from "node:assert/strict";

const media = new EventTarget();
let width;
const queries = [];
globalThis.matchMedia = (query) => {
  queries.push(query);
  const match = /^\(max-width: (\d+)px\)$/.exec(query);
  assert.ok(match, "Phone uses an inclusive maximum in CSS pixels");
  Object.defineProperty(media, "matches", { get: () => width <= Number(match[1]) });
  return media;
};

const { PHONE, PHONE_MAX_WIDTH } = await import("../viewport.js");
for (const [offset, matches] of [[1, false], [0, true], [-1, true], [.5, false]]) {
  width = PHONE_MAX_WIDTH + offset;
  assert.equal(PHONE.matches, matches, `Phone match at ${width}px`);
}
assert.deepEqual(queries, [`(max-width: ${PHONE_MAX_WIDTH}px)`]);
