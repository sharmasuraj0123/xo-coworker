// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectAccess, removeProject } from "../../../core/platform/project-access-response.js";

const routes = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8")).paths;
const blocked = { project_id: "example", can_remove: false, blockers: [{ message: "Active worktree" }], members: [], peers: [], repo: null };
const signal = new AbortController().signal;
globalThis.fetch = async (path, init) => {
  const url = new URL(String(path), "http://localhost");
  assert.ok(routes[url.pathname.replace("/example", "/{project_id}")].includes(init.method));
  if (init.method === "GET") return Response.json(blocked);
  assert.deepEqual(JSON.parse(init.body), { confirm_project_id: "example" });
  return Response.json({ project_id: "different", removed: true });
};
assert.deepEqual(await projectAccess("example", signal), blocked);
await assert.rejects(removeProject("example", signal), { code: "bad_answer" });
