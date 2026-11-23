import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api } from "../../../core/platform/api.js";

const snapshot = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const project = "sample-project";
const root = "/api/xo-projects/{project_id}/github";
const routes = [
  { name: "githubStatus", template: "/api/connectors/github/status", args: [] },
  { name: "githubIssues", template: root + "/issues", args: [project] },
  { name: "githubIssue", template: root + "/issues/{issue_number}", args: [project, 17], optional: true },
  { name: "githubPulls", template: root + "/pulls", args: [project], optional: true },
  { name: "githubPull", template: root + "/pulls/{pull_number}", args: [project, 17], optional: true },
];

for (const { name, template, args, optional } of routes) {
  const expected = template.replace("{project_id}", project).replace(/\{(?:issue|pull)_number\}/, "17");
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push([options?.method || "GET", new URL(String(url), "http://local/").pathname]);
    return optional ? Response.json({ detail: "Not Found" }, { status: 404 }) : Response.json({});
  };
  if (optional) {
    assert.equal(Object.entries(snapshot.paths).some(([path, methods]) => {
      const match = new RegExp(`^${path.replace(/[.*+?^$${}()|[\]\\]/g, "\\$&").replace(/\\\{[^}]+\\\}/g, "[^/]+")}$`);
      return methods.includes("GET") && match.test(expected);
    }), false, `${name} is now present in OpenAPI`);
    await assert.rejects(api[name](...args), { status: 404 });
  } else {
    assert.ok(snapshot.paths[template]?.includes("GET"), `${name} must be present in OpenAPI`);
    await api[name](...args);
  }
  assert.deepEqual(requests, [["GET", expected]], name);
}
