// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readInbox } from "../../../core/platform/inbox-response.js";
import { arrival } from "../inbox.js";

const snapshot = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const item = { id: "one", title: "<task>", body: "Review", url: "javascript:alert(1)" };
const signal = new AbortController().signal;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input), "https://space.invalid");
  assert.equal(url.pathname, "/api/inbox");
  assert.ok(snapshot.paths[url.pathname].includes(init.method));
  assert.equal(url.searchParams.get("status"), "open");
  return Response.json({ items: [item] });
};
assert.deepEqual((await readInbox(signal)).items, [item]);
assert.match(arrival(item), /&lt;task&gt;/);
assert.doesNotMatch(arrival(item), /href=/);
assert.match(arrival({ ...item, url: "https://example.org/review" }), /href="https:\/\/example.org\/review"/);
globalThis.fetch = async () => Response.json({ items: [{ title: 2 }] });
await assert.rejects(readInbox(signal), { code: "bad_answer" });
