import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { api } from "../api.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/run-reads.json", import.meta.url), "utf8"));
const [run] = fixture.list.runs;
const child = { ...run, id: "child_example", parent_run_id: run.id };
const detail = { ...run, ancestry: fixture.ancestry };
const singleStop = { run: detail, stopping: true };
const allStops = { stopping: ["run_example"] };
const routes = [
  ["/chat/sessions/session_example/runs", () => api.runs("session_example"), fixture.list,
    { ...fixture.list, runs: [{ ...run, children: [{ ...child, last_tool: [] }] }] }],
  ["/chat/runs/run_example", () => api.run("run_example"), { ...run, ancestry: fixture.ancestry },
    { ...run, ancestry: { ...fixture.ancestry, chat: { name: {} } } }],
  ["/chat/runs/run_example/transcript", () => api.transcript("run_example"), fixture.transcript,
    { ...fixture.transcript, items: [{ ...fixture.transcript.items[0], plan: [{ state: null }] }] }],
  ["/chat/runs/run_example/stop", () => api.stopRun("run_example"), singleStop, allStops, "POST"],
  ["/chat/sessions/session_example/runs/stop", () => api.stopRuns("session_example"), allStops, singleStop, "POST"],
];

for (const [path, read, sample, malformed, method = "GET"] of routes) {
  await test(`${method} ${path} validates nested response data`, async (t) => {
    let body = sample;
    const mock = t.mock.method(globalThis, "fetch", async (url, init) => {
      assert.equal(url, "api" + path);
      assert.equal(init.method, method);
      return Response.json(body);
    });
    assert.deepEqual(await read(), sample);
    body = malformed;
    await assert.rejects(read, { code: "bad_answer" });
    assert.equal(mock.mock.callCount(), 2);
  });
}

await test("Stop receipts validate the nested run and keep the missing confirmation path", async (t) => {
  let body = { stopping: true, run: 42 };
  t.mock.method(globalThis, "fetch", async () => Response.json(body));
  await assert.rejects(() => api.stopRun("run_example"), { code: "bad_answer" });
  body = { stopping: true };
  await assert.rejects(() => api.stopRuns("session_example"), { code: "bad_answer" });
  body = { stopping: ["run_example", 42] };
  await assert.rejects(() => api.stopRuns("session_example"), { code: "bad_answer" });
  for (const missing of [null, {}, { stopping: null }]) {
    body = missing;
    assert.deepEqual(await api.stopRun("run_example"), missing);
    assert.deepEqual(await api.stopRuns("session_example"), missing);
  }
});
