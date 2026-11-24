// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api } from "../../../core/platform/api.js";
import { createMapFolders } from "../folders.js";

/** @type {{ paths: Record<string, string[]> }} */
const { paths } = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const route = "/api/xo-projects/{project_id}/tree";
assert.ok(paths[route]?.includes("GET"), `GET ${route} in OpenAPI`);
const seen = [];
globalThis.fetch = async (url, init) => {
  const request = new URL(String(url), "http://local");
  seen.push([init?.method ?? "GET", request.pathname, Object.fromEntries(request.searchParams)]);
  return Response.json({ files: [{ name: "readme", relative_path: "base/docs/readme" }] });
};
const folders = createMapFolders(api, () => {});
const folder = { project: "project/key", base: "base" };
await folders.load(folder, "docs");
assert.deepEqual(seen, [["GET", "/api/xo-projects/project%2Fkey/tree", { relative_path: "base/docs", hidden: "true" }]]);
assert.deepEqual(folders.get(folder, "docs"), { state: "ok", dirs: [], files: [{ name: "readme", path: "docs/readme" }] });
