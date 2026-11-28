// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api } from "../../../core/platform/api.js";
import replies from "../../../core/platform/tests/fixtures/connector-responses.json" with { type: "json" };

/** @type {{ paths: Record<string, string[]> }} */
const snapshot = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const project = "sample-project";
const root = "/api/xo-projects/{project_id}/github";
const routes = [
  { name: "githubStatus", template: "/api/connectors/github/status", call: () => api.githubStatus() },
  { name: "githubIssues", template: root + "/issues", call: () => api.githubIssues(project) },
  { name: "githubIssue", template: root + "/issues/{issue_number}", call: () => api.githubIssue(project, 17), optional: true },
  { name: "githubPulls", template: root + "/pulls", call: () => api.githubPulls(project), optional: true },
  { name: "githubPull", template: root + "/pulls/{pull_number}", call: () => api.githubPull(project, 17), optional: true },
];

for (const { name, template, call, optional } of routes) {
  const expected = template.replace("{project_id}", project).replace(/\{(?:issue|pull)_number\}/, "17");
  /** @type {string[][]} */
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push([options?.method || "GET", new URL(String(url), "http://local/").pathname]);
    if (optional) return Response.json({ detail: "Not Found" }, { status: 404 });
    return Response.json(name === "githubStatus" ? replies.connected : { ...replies.issues, project_id: project });
  };
  if (optional) {
    assert.equal(Object.entries(snapshot.paths).some(([path, methods]) => {
      const match = new RegExp(`^${path.replace(/[.*+?^$${}()|[\]\\]/g, "\\$&").replace(/\\\{[^}]+\\\}/g, "[^/]+")}$`);
      return methods.includes("GET") && match.test(expected);
    }), false, `${name} is now present in OpenAPI`);
    await assert.rejects(call(), { status: 404 });
  } else {
    assert.ok(snapshot.paths[template]?.includes("GET"), `${name} must be present in OpenAPI`);
    await call();
  }
  assert.deepEqual(requests, [["GET", expected]], name);
}
