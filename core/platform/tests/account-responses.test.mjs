import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { api } from "../api.js";

const { advisory, intents } = JSON.parse(readFileSync(new URL("./fixtures/account-api.json", import.meta.url), "utf8"));
const [account] = advisory.accounts;
const [pool] = intents.pools;
const clear = { scope: "pool", scope_id: pool.pool, value: null };
const halted = { session_id: "session_example", turn_id: null, interrupted: false, released: true, ms: 15 };
const routes = [
  ["/advisory", () => api.advisory(), advisory, { ...advisory, accounts: [
    { ...account, paid: { possible: { value: "yes", known: true } } },
  ] }],
  ["/chat/intent", () => api.intents(), intents, { ...intents, pools: [{ ...pool, state: [] }] }],
  ["/chat/intent/paid", () => api.setPaid(clear), { intent: null, halted: [halted] },
    { intent: null, halted: [{ ...halted, interrupted: 0 }] }, "POST"],
];

for (const [path, read, sample, malformed, method = "GET"] of routes) {
  await test(`${method} ${path} checks its published response`, async (t) => {
    let body = sample;
    const mock = t.mock.method(globalThis, "fetch", async (url, init) => {
      assert.equal(url, "api" + path);
      assert.equal(init.method, method);
      if (method === "POST") assert.deepEqual(JSON.parse(init.body), clear);
      return Response.json(body);
    });
    assert.deepEqual(await read(), sample);
    body = malformed;
    await assert.rejects(read, { code: "bad_answer" });
    assert.equal(mock.mock.callCount(), 2);
  });
}
