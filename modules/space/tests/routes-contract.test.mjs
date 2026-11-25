// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readConnections, readSharing } from "../../../core/platform/space-surfaces-response.js";
import { scheduleApi } from "../../../core/platform/schedule-response.js";

const routes = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8")).paths;
const payloads = {
  "/api/connections": { connections: [{ toolkit: "github", connected_here: true }] },
  "/api/project-sharing/status": { repos: { "org/project": { project: "project", shared: true } } },
  "/api/schedules": { jobs: [] },
};
globalThis.fetch = async (input, init) => {
  const { pathname } = new URL(String(input), "http://localhost");
  assert.ok(routes[pathname].includes(init.method));
  return Response.json(payloads[pathname]);
};
const signal = new AbortController().signal;
assert.deepEqual(await readConnections(signal), payloads["/api/connections"]);
assert.deepEqual(await readSharing(signal), payloads["/api/project-sharing/status"]);
assert.deepEqual(await scheduleApi.schedules(signal), payloads["/api/schedules"]);
