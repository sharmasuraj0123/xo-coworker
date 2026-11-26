// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readConnections, readSharing } from "../../../core/platform/space-surfaces-response.js";
import { scheduleApi } from "../../../core/platform/schedule-response.js";
import { readSpaceMap } from "../../../core/platform/explore-response.js";
import { readSecretKeys, changeSecret, readDoctor } from "../../../core/platform/space-settings-response.js";

const routes = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8")).paths;
const payloads = {
  "/xo/space.json": { groups: [], leaves: [], ties: [], milestones: [] },
  "/api/connections": { connections: [{ toolkit: "github", connected_here: true }] },
  "/api/project-sharing/status": { repos: { "org/project": { project: "project", shared: true } } },
  "/api/schedules": { jobs: [] },
  "/api/secrets": { items: [{ key: "EXAMPLE", preview: "discard-me" }] },
  "/api/secrets/EXAMPLE": { key: "EXAMPLE", deleted: true },
  "/api/doctor": { checks: [{ id: "folders", findings: [] }] },
};
globalThis.fetch = async (input, init) => {
  const { pathname } = new URL(String(input), "http://localhost");
  assert.ok(routes[pathname.replace("/secrets/EXAMPLE", "/secrets/{key}")].includes(init.method));
  return Response.json(payloads[pathname]);
};
const signal = new AbortController().signal;
assert.deepEqual(await readSpaceMap(signal), payloads["/xo/space.json"]);
assert.deepEqual(await readConnections(signal), payloads["/api/connections"]);
assert.deepEqual(await readSharing(signal), payloads["/api/project-sharing/status"]);
assert.deepEqual(await scheduleApi.schedules(signal), payloads["/api/schedules"]);
assert.deepEqual(await readSecretKeys(signal), ["EXAMPLE"]);
await changeSecret("EXAMPLE", "test-input", signal);
await changeSecret("EXAMPLE", null, signal);
assert.deepEqual(await readDoctor(signal), payloads["/api/doctor"]);
