// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api, attachmentText, attachmentUrl } from "../../../core/platform/api.js";

const { paths, taken } = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
/** @type {[string, string][]} */
const requests = [];
const pathname = (/** @type {string | URL | Request} */ url) => new URL(String(url), "http://localhost/").pathname;
globalThis.fetch = async (url, { method = "GET" } = {}) => {
  requests.push([method, pathname(url)]);
  return new Response("{}");
};

const file = "docs/index.html";
/** @type {[string, string, () => Promise<unknown>][]} */
const routes = [
  ["GET", "/api/xo-projects/{project_id}/tree", () => api.projectTree("p", "docs")],
  ["GET", "/api/xo-projects/{project_id}/file", () => api.projectFile("p", file, null, { purpose: "edit" })],
  ["PUT", "/api/xo-projects/{project_id}/file", () => api.saveProjectFile("p", file, "text", "version")],
  ["GET", "/api/xo-projects/{project_id}/versions", () => api.projectVersions("p", file)],
  ["GET", "/api/xo-projects/{project_id}/image", () => api.projectImage("p", "cover.png")],
  ["GET", "/api/xo-projects/{project_id}/download", () => api.projectDownload("p", file)],
  ["POST", "/api/xo-projects/{project_id}/files/mkdir", () => api.mkdirProject("p", "docs")],
  ["POST", "/api/xo-projects/{project_id}/files/rename", () => api.renameProjectFile("p", file, "index.html")],
  ["POST", "/api/xo-projects/{project_id}/files/delete", () => api.deleteProjectFile("p", file)],
  ["POST", "/api/xo-projects/{project_id}/edits/{edit_id}/undo", () => api.undoProjectEdit("p", "edit")],
  ["GET", "/api/chat/chats/{chat_id}/attachments/{att_id}", () => attachmentText("chat", "attachment")],
];
/** @type {Record<string, string>} */
const values = { project_id: "p", edit_id: "edit", chat_id: "chat", att_id: "attachment" };
const concrete = (/** @type {string} */ template) => template.replace(/\{([^}]+)\}/g, (_, key) => values[key]);

for (const [method, template, call] of routes) {
  assert.ok(paths[template]?.includes(method), `${method} ${template} missing from the ${taken} snapshot`);
  await call();
  assert.deepEqual(requests.splice(0), [[method, concrete(template)]], template);
}
assert.equal(pathname(attachmentUrl("chat", "attachment")), concrete(routes[routes.length - 1][1]));
