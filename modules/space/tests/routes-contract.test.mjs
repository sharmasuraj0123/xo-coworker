// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readConnections, readSharing } from "../../../core/platform/space-surfaces-response.js";
import { scheduleApi } from "../../../core/platform/schedule-response.js";
import { readSpaceMap } from "../../../core/platform/explore-response.js";
import { checkSharing, pollConnection, runJob } from "../../../core/platform/space-actions-response.js";
import { projectSync, applySharedCommits } from "../../../core/platform/project-access-response.js";
import { readUsage, readSources } from "../../../core/platform/space-usage-response.js";
import { readSecretKeys, changeSecret, readDoctor } from "../../../core/platform/space-settings-response.js";

const routes = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8")).paths;
const payloads = {
  "/xo/sessions.json": { totals: { sessions: 1, tokens: 20, sessions_by_agent: {agent: 1}, tokens_by_agent: {agent: 20} } },
  "/api/telemetry/sources": { items: [{ label: "Local runtime", enabled: true }] },
  "/xo/space.json": { groups: [], leaves: [], ties: [], milestones: [] },
  "/api/connections": { connections: [{ toolkit: "github", connected_here: true }] },
  "/api/project-sharing/status": { repos: { "org/project": { project: "project", shared: true } } },
  "/api/schedules": { jobs: [] },
  "/api/schedules/sample/run": { ok: true, started: true },
  "/api/project-sharing/check": { ok: true },
  "/api/connections/github/poll": { toolkit: "github", new_events: 2 },
  "/api/xo-projects/sample/commits": { project_id: "sample", branch: "main", path: "/example", behind: 2 },
  "/api/xo-projects/sample/apply": { project_id: "sample", applied: 2 },
  "/api/secrets": { items: [{ key: "EXAMPLE", preview: "discard-me" }] },
  "/api/secrets/EXAMPLE": { key: "EXAMPLE", deleted: true },
  "/api/doctor": { checks: [{ id: "folders", findings: [] }] },
};
globalThis.fetch = async (input, init) => {
  const { pathname } = new URL(String(input), "http://localhost");
  const route = pathname.replace("/secrets/EXAMPLE", "/secrets/{key}").replace("/schedules/sample", "/schedules/{job_id}")
    .replace("/connections/github", "/connections/{toolkit}").replace("/xo-projects/sample", "/xo-projects/{project_id}");
  assert.ok(routes[route].includes(init.method));
  return Response.json(payloads[pathname]);
};
const signal = new AbortController().signal;
assert.equal((await readUsage(signal)).tokens, 20);
assert.equal((await readSources(signal)).items[0].enabled, true);
assert.deepEqual(await readSpaceMap(signal), payloads["/xo/space.json"]);
assert.deepEqual(await readConnections(signal), payloads["/api/connections"]);
assert.deepEqual(await readSharing(signal), payloads["/api/project-sharing/status"]);
assert.deepEqual(await scheduleApi.schedules(signal), payloads["/api/schedules"]);
assert.deepEqual(await readSecretKeys(signal), ["EXAMPLE"]);
await changeSecret("EXAMPLE", "test-input", signal);
await changeSecret("EXAMPLE", null, signal);
assert.deepEqual(await readDoctor(signal), payloads["/api/doctor"]);
assert.equal(await runJob("sample", signal), "Run requested.");
assert.equal(await checkSharing(signal), "Sharing check requested.");
assert.equal(await pollConnection("github", signal), "New events: 2");
assert.equal((await projectSync("sample", signal)).behind, 2);
assert.equal((await applySharedCommits("sample", signal)).applied, 2);
