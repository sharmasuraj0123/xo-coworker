// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAct } from "../../../core/services/storm/act.js";
import { createRunsReads } from "../read.js";

/** @type {{ paths: Record<string, string[]> }} */
const { paths } = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const routes = ["/api/chat/sessions/{session_id}/runs", "/api/chat/runs/{run_id}", "/api/chat/runs/{run_id}/transcript"];
for (const route of routes) assert.ok(paths[route]?.includes("GET"), `GET ${route} in OpenAPI`);
const calls = [];
const run = { id: "run/key", state: "done", title: "Review" };
const responses = [{ runs: [run], counts: { done: 1 } }, run, { items: [{ id: "line", type: "text" }] }];
globalThis.fetch = async (url, init) => {
  const request = new URL(String(url), "http://local");
  calls.push([init?.method ?? "GET", request.pathname, Object.fromEntries(request.searchParams)]);
  return Response.json(responses[calls.length - 1]);
};
/** @type {import("../read-types.d.ts").RunsReadDeps["RS"]} */
const RS = { open: true, session: "session/key", opening: 1, gen: 0, title: "Runs", view: "list", runId: null, returnTo: null,
  tree: [], counts: null, said: null, cmdsOpen: true, cmdsAll: false, run: null, anc: null, items: [], cursor: null,
  children: [], loading: false, error: null, gone: null, pollT: null };
const state = { runs: new Map() };
const act = createAct(/** @type {import("../../../core/services/storm/types").Ctx} */ (/** @type {unknown} */ ({
  state, sentAt: () => ({ at: Date.now(), seq: null }), soon() {},
})));
const reads = createRunsReads({ RS, world: { state, act }, STAGE: { repaint() {} }, runsRender() {} });
assert.equal(await reads.readRunsList("session/key"), true);
await reads.openRun(run.id);
assert.deepEqual(calls, [
  ["GET", "/api/chat/sessions/session%2Fkey/runs", { tree: "true", depth: "3", limit: "200" }],
  ["GET", "/api/chat/runs/run%2Fkey", {}],
  ["GET", "/api/chat/runs/run%2Fkey/transcript", { limit: "200" }],
]);
assert.deepEqual(RS.counts, { done: 1 });
assert.equal(RS.run?.title, "Review");
assert.deepEqual(RS.items.map((item) => item.id), ["line"]);
