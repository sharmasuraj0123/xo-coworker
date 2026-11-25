// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { api, terminalSocketUrl } from "../../../core/platform/api.js";

/** @type {{ paths: Record<string, string[]> }} */
const snapshot = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const origin = "https://xo.test/";
const fixtureUrl = new URL("../../../core/platform/tests/fixtures/terminal-responses.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const id = "sample-terminal";
const session = "/api/terminal/sessions";
const terminalTemplate = session + "/{terminal_id}";
const terminalPath = session + "/" + id;

/** @type {[method: string, template: string, path: string, call: () => Promise<unknown>][]} */
const routes = [
  ["GET", "/api/terminal/status", "/api/terminal/status", () => api.terminalStatus()],
  ["GET", session, session, () => api.terminals()],
  ["POST", session, session, () => api.openTerminal({ name: "Example" })],
  ["GET", terminalTemplate, terminalPath, () => api.terminal(id)],
  ["POST", terminalTemplate + "/attach", terminalPath + "/attach", () => api.attachTerminal(id)],
  ["PATCH", terminalTemplate, terminalPath, () => api.renameTerminal(id, "Example")],
  ["DELETE", terminalTemplate, terminalPath, () => api.closeTerminal(id)],
  ["GET", "/api/chat/worktrees", "/api/chat/worktrees", () => api.worktrees("sample-chat")],
];

for (const [method, template, path, request] of routes) {
  assert.ok(snapshot.paths[template]?.includes(method), `${method} ${template} is in OpenAPI`);
  /** @type {string[][]} */
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push([options?.method || "GET", new URL(String(url), origin).pathname]);
    if (path === "/api/chat/worktrees") return Response.json({ worktrees: [], removed: [], reported: [] });
    if (path === "/api/terminal/status") return Response.json(fixture.status);
    if (path === session && method === "GET") return Response.json({ terminals: [fixture.terminal] });
    if (path === session && method === "POST") return Response.json({ terminal: fixture.terminal, ...fixture.ticket });
    if (path.endsWith("/attach")) return Response.json(fixture.ticket);
    if (method === "DELETE") return Response.json(fixture.closed);
    return Response.json({ terminal: fixture.terminal });
  };
  await request();
  assert.deepEqual(requests, [[method, path]], `${method} ${path}`);
}

Object.defineProperty(globalThis, "location", { value: new URL(origin), configurable: true });
const socket = new URL(terminalSocketUrl(id));
assert.equal(socket.protocol, "wss:");
assert.equal(socket.pathname, terminalPath + "/ws");
assert.ok(snapshot.paths[terminalTemplate]?.includes("GET"), "the socket belongs to a terminal session in OpenAPI");
