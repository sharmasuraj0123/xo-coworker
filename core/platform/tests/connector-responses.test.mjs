// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { api, request } from "../api.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/connector-responses.json", import.meta.url), "utf8"));
const connector = "/connectors/github";
const deploy = "/deploy/demo";
const apps = { linked: null, name: "Demo", apps: [{ ...fixture.app, linkable: true, match: ["name", "repo"] }] };
const link = { config: fixture.config, commit: null, app: fixture.app };
const unlink = { unlinked: { app_id: null, name: "Demo" }, forgot: false, commit: null };
const stop = { stopped: true, run_id: "sample-run" };
const issues = fixture.issues;
const detail = { body: "Example", comments: [{ author: { login: "sample-user" }, body: "A reply" }] };
const pulls = { pulls: [{ number: 2, title: "Example pull request", is_draft: false }] };

/** @type {[string, string, () => Promise<unknown>, object, object][]} */
const routes = [
  ["GET", connector + "/status", () => api.githubStatus(), fixture.connected, { ...fixture.connected, username: null }],
  ["POST", connector + "/cli/start", () => api.githubConnect(), fixture.start, { ...fixture.start, expires_in: "900" }],
  ["POST", connector + "/cli/poll", () => api.githubConnectPoll("sample-session"), fixture.pending, { status: "pending" }],
  ["POST", connector + "/cli/cancel", () => api.githubConnectCancel("sample-session"), { status: "cancelled" }, { status: false }],
  ["POST", connector + "/disconnect", () => api.githubDisconnect(), { status: "needs_auth" }, { status: "connected" }],
  ["GET", "/xo-projects/demo/github/issues", () => api.githubIssues("demo"), issues, { ...issues, untracked: "1" }],
  ["GET", "/xo-projects/demo/github/issues/1", () => api.githubIssue("demo", 1), detail, { ...detail, comments: [null] }],
  ["GET", "/xo-projects/demo/github/pulls", () => api.githubPulls("demo"), pulls, { pulls: [{ number: "2" }] }],
  ["GET", "/xo-projects/demo/github/pulls/2", () => api.githubPull("demo", 2), detail, { ...detail, conflicts: [1] }],
  ["GET", deploy + "/apps", () => api.launchpadApps("demo"), apps, { ...apps, apps: [{ ...apps.apps[0], match: [123] }] }],
  ["GET", deploy + "/check", () => api.launchpadCheck("demo"), fixture.check, { ...fixture.check, fields: { name: null } }],
  ["GET", deploy + "/preflight", () => api.launchpadPreflight("demo"), fixture.preflight, { ...fixture.preflight, github: false }],
  ["POST", deploy + "/link", () => api.launchpadLink("demo", "sample-app"), link, { ...link, commit: false }],
  ["DELETE", deploy + "/link", () => api.launchpadUnlink("demo"), unlink, { ...unlink, forgot: null }],
  ["DELETE", deploy, () => api.launchpadStop("demo"), stop, { stopped: true }],
  ["POST", deploy + "/agent", () => api.launchpadAskAgent("demo", ""), fixture.agent, { ...fixture.agent, thread_ts: null }],
];

for (const [method, path, call, good, bad] of routes) {
  test(`${method} ${path} only publishes a valid reply`, async ({ mock }) => {
    let payload = good;
    const fetches = mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url, "api" + path);
      assert.equal(options.method, method);
      return Response.json(payload);
    });
    assert.deepEqual(await call(), good);
    payload = bad;
    await assert.rejects(call(), { code: "bad_answer" });
    await assert.rejects(request(path + "?legacy=1", { method: method.toLowerCase() }), TypeError);
    assert.equal(fetches.mock.callCount(), 2);
  });
}

const run = { type: "run", ts: "2026-11-23T01:00:00Z", run_id: "fixture", kind: "deploy", attached: true,
  started_at: "2026-11-23T01:00:00Z", after: 2 };

const progress = { type: "progress", ts: run.ts, run_id: "fixture", seq: 3, step: "release", data: { ready: 1, desired: 2 } };

for (const method of ["GET", "POST"]) {
  test(`${method} Launchpad streams only publish checked frames`, async ({ mock }) => {
    const watch = method === "GET";
    const path = deploy + (watch ? "/watch" : "");
    const resume = watch ? "?run=fixture&after=2" : "";
    const invalid = { ...progress, seq: 4, data: { ready: "1", desired: 2 } };
    const body = [run, invalid, progress].map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
    const reported = mock.method(console, "error", () => {});
    const fetches = mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url, "api" + path + resume);
      assert.equal(options.method, method);
      assert.equal(new Headers(options.headers).get("Accept"), "text/event-stream");
      assert.equal(options.body, watch ? undefined : '{"name":"demo"}');
      return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
    });
    const seen = [];
    const options = { signal: new AbortController().signal, on: (frame) => seen.push(frame) };
    const result = watch ? await api.launchpadWatch("demo", { ...options, run: "fixture", after: 2 })
      : await api.launchpadDeploy("demo", { name: "demo" }, options);
    assert.deepEqual(seen, [run, progress]);
    assert.deepEqual(result, { ended: false });
    assert.equal(reported.mock.callCount(), 1);
    assert.equal(reported.mock.calls[0].arguments[0].code, "bad_answer");
    await assert.rejects(request(path, { method }), TypeError);
    assert.equal(fetches.mock.callCount(), 1);
  });
}

test("resuming a finished Launchpad stream accepts an empty 204", async ({ mock }) => {
  mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  assert.deepEqual(await api.launchpadWatch("demo", { signal: new AbortController().signal, on: assert.fail }), { ended: true });
});
