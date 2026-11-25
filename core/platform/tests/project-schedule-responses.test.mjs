// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { api, request } from "../api.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/project-schedule-responses.json", import.meta.url), "utf8"));
const project = "fixture";
const root = "/xo-projects/fixture";
const job = "sample check";
const schedule = "/schedules/sample%20check";
const clone = "/xo-projects/clones/cl_fixture";

/** @typedef {[string, string, () => Promise<unknown>, object, (value: Record<string, unknown>) => void]} Route */

/** @type {Route[]} */
const routes = [
  ["GET", root + "/file", () => api.projectFile(project, "README.md"), fixture.file, (v) => { v.content = null; }],
  ["GET", root + "/tree", () => api.projectTree(project), fixture.tree, (v) => { v.files = [{ name: 1 }]; }],
  ["PUT", root + "/file", () => api.saveProjectFile(project, "README.md", "a", null), fixture.saved, (v) => { v.unchanged = "no"; }],
  ["GET", root + "/versions", () => api.projectVersions(project, "README.md"), fixture.versions, (v) => { v.head = { commit: 0 }; }],
  ["GET", "/coworker" + root + "/paths", () => api.projectPaths(project), fixture.paths, (v) => { v.paths = [false]; }],
  ["GET", "/coworker" + root + "/search", () => api.projectSearch(project), fixture.search, (v) => { v.matches = [null]; }],
  ["POST", root + "/files/rename", () => api.renameProjectFile(project, "notes", "docs"), fixture.rename, (v) => { v.kind = null; }],
  ["POST", root + "/files/delete", () => api.deleteProjectFile(project, "README.md"), fixture.delete, (v) => { v.count = -1; }],
  ["POST", root + "/files/mkdir", () => api.mkdirProject(project, "docs"), fixture.folder, (v) => { v.relative_path = 1; }],
  ["POST", root + "/edits/edit_fixture/undo", () => api.undoProjectEdit(project, "edit_fixture"), fixture.undo,
    (v) => { delete v.version; }],
  ["GET", root + "/changes", () => api.projectChanges(project), fixture.changes, (v) => { v.total_files = "1"; }],
  ["GET", "/config/workspace", () => api.workspaceConfig(), fixture.workspace, (v) => { v.roots = { claude_code: 1 }; }],
  ["POST", "/files/mkdir", () => api.createProject({ path: "/home/example/fixture" }), fixture.created, (v) => { v.copied = null; }],
  ["POST", "/xo-projects", () => api.cloneProject({ id: project, url: "https://example.test/sample.git" }), fixture.clone,
    (v) => { v.state = "unknown"; }],
  ["GET", clone, () => api.cloneStatus("cl_fixture"), fixture.activeClone, (v) => { v.error = {}; }],
  ["DELETE", clone, () => api.cancelClone("cl_fixture"), fixture.cancelledClone, (v) => { v.finished_at = 0; }],
  ["GET", "/schedules", () => api.schedules(), { jobs: [fixture.job, fixture.agentJob] }, (v) => { v.jobs = [{}]; }],
  ["GET", schedule, () => api.schedule(job), fixture.job, (v) => { v.last_result = { status: "ok" }; }],
  ["GET", schedule + "/runs", () => api.scheduleRuns(job), fixture.runs, (v) => { v.runs = [{ type: "job.run" }]; }],
];

for (const [method, path, call, sample, alter] of routes) {
  test(`${method} ${path} checks the response before publishing it`, async ({ mock }) => {
    const invalid = { ...sample };
    alter(invalid);
    let value = sample;
    const fetches = mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url.split("?")[0], "api" + path);
      assert.equal(options.method, method);
      if (path === "/xo-projects") {
        assert.deepEqual(JSON.parse(options.body), { project_id: project, repository_url: "https://example.test/sample.git", wait: false });
      }
      if (path === clone) assert.equal(options.body, undefined);
      return Response.json(value, { status: path === "/xo-projects" ? 202 : 200 });
    });
    assert.deepEqual(await call(), sample);
    value = invalid;
    await assert.rejects(call(), { code: "bad_answer" });
    await assert.rejects(request(path + "?legacy=1", { method: method.toLowerCase() }), TypeError);
    assert.equal(fetches.mock.callCount(), 2);
  });
}

test("path stamps preserve the unchanged variant and send the requested stamp", async ({ mock }) => {
  mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "api/coworker/xo-projects/fixture/paths?stamp=fixture-stamp");
    return Response.json(fixture.unchangedPaths);
  });
  assert.deepEqual(await api.projectPaths(project, { stamp: "fixture-stamp" }), fixture.unchangedPaths);
});

test("restores preserve the writer headers, confirmation and base version", async ({ mock }) => {
  mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(new Headers(options.headers).get("X-XO-Restore-Of"), "version-old");
    assert.deepEqual(JSON.parse(options.body), { relative_path: "README.md", content: "a", base_version: null, confirm: "runs_code" });
    return Response.json(fixture.saved);
  });
  assert.deepEqual(await api.saveProjectFile(project, "README.md", "a", null, "runs_code", { restoreOf: "version-old" }), fixture.saved);
});
