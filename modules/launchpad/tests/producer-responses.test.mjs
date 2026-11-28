// @ts-check

import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { api } from "../../../core/platform/api.js";
import { createLpApi, RETRY } from "../client.js";

test("Launchpad check preserves the readiness reason when no port was detected", async ({ mock }) => {
  const reason = "the project has no code yet";
  const reply = {
    schema: 1, project: "empty", state: "not-deployable", config: null, reasons: [reason],
    fields: {
      name: { value: "empty", source: "the project folder" },
      port: { value: null, source: null, confident: false },
    },
  };
  mock.method(globalThis, "fetch", async (path) => {
    assert.equal(path, "api/deploy/empty/check");
    return Response.json(reply);
  });
  assert.deepEqual(await api.launchpadCheck("empty"), reply);
  const check = await createLpApi().check("empty");
  assert.equal(check.port, null);
  assert.equal(check.portSure, false);
  assert.deepEqual(check.missing, [{ what: reason, why: "", ok: false }]);
  reply.fields.name.source = null;
  await assert.rejects(api.launchpadCheck("empty"), { code: "bad_answer" });
});

test("Launchpad projects a producer build failure and retires the watch", async ({ mock }) => {
  const ts = "2026-11-23T10:00:00Z";
  const run_id = "fixture-run";
  const frames = [
    { type: "run", ts, run_id, kind: "watch", attached: false, started_at: ts, after: 0 },
    { type: "error", ts, run_id, seq: 1, step: "build", code: "build_failed",
      message: "The GitHub Actions build failure at the step “Build”.",
      fix: "Open the build log, fix the Dockerfile or the code, commit and deploy again.",
      action: "open_build_log",
      data: { run_url: "https://github.com/example/project/actions/runs/1", failed_step: "Build",
        conclusion: "failure", log_tail: "Preparing\nBuilding\nBuild failed\nExit 1" } },
  ];
  mock.timers.enable({ apis: ["setTimeout"] });
  const fetches = mock.method(globalThis, "fetch", async (path) => {
    assert.equal(path, "api/deploy/example/watch");
    return new Response(frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join(""));
  });
  const reports = mock.method(console, "error", () => {});
  const projected = [];
  const watch = createLpApi().watch("example", (event) => projected.push(event));
  try {
    await setImmediate();
    mock.timers.tick(RETRY.ms);
    await setImmediate();
    const failure = projected.find((event) => event.state === "failed");
    assert.equal(failure?.step, "build");
    assert.equal(failure?.error?.code, "build_failed");
    assert.equal(failure?.error?.action, "open_build_log");
    assert.equal(failure?.error?.step, "Build");
    assert.deepEqual(failure?.error?.log, ["Building", "Build failed", "Exit 1"]);
    assert.equal(fetches.mock.callCount(), 1, "the terminal frame ends watching");
    assert.equal(reports.mock.callCount(), 0);
  } finally {
    watch.stop();
  }
});
