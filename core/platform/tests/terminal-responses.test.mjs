// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { api, request } from "../api.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/terminal-responses.json", import.meta.url), "utf8"));
const root = "/terminal/sessions";
const id = "sample-terminal";
const session = root + "/" + id;
const terminal = { terminal: fixture.terminal };

/** @type {[string, string, () => Promise<unknown>, object, object][]} */
const routes = [
  ["GET", "/terminal/status", () => api.terminalStatus(), fixture.status, { ...fixture.status, reason: false }],
  ["GET", root, () => api.terminals(), { terminals: [fixture.terminal] }, { terminals: [null] }],
  ["GET", session, () => api.terminal(id), terminal, { terminal: { ...fixture.terminal, viewers: "0" } }],
  ["POST", root, () => api.openTerminal({ name: "Example" }), { ...terminal, ...fixture.ticket }, terminal],
  ["POST", session + "/attach", () => api.attachTerminal(id), fixture.ticket, { ...fixture.ticket, ticket_expires_in: -1 }],
  ["PATCH", session, () => api.renameTerminal(id, "Example"), terminal, { terminal: { ...fixture.terminal, size: null } }],
  ["DELETE", session, () => api.closeTerminal(id), fixture.closed, { ...fixture.closed, ok: false }],
];

for (const [method, path, call, good, bad] of routes) {
  test(`${method} ${path} checks the response before publishing it`, async ({ mock }) => {
    let payload = good;
    const calls = mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url, "api" + path);
      assert.equal(options.method, method);
      return Response.json(payload);
    });
    assert.deepEqual(await call(), good);
    payload = bad;
    await assert.rejects(call(), { code: "bad_answer" });
    await assert.rejects(request(path + "?legacy=1", { method: method.toLowerCase() }), TypeError);
    assert.equal(calls.mock.callCount(), 2);
  });
}
