// @ts-check

import assert from "node:assert/strict";
import { mock } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";
import replies from "../../../core/platform/tests/fixtures/terminal-responses.json" with { type: "json" };

const markup = '<button id="nv-shells"><span class="sh-n"></span></button><aside id="shd"></aside>';
const { document, window } = await dom(markup);
const { createShells } = await import("../dock.js");
const reports = [];
const previousReporter = globalThis.reportError;
globalThis.reportError = (error) => reports.push(error);
const flush = () => new Promise(setImmediate);
const launcher = document.getElementById("nv-shells");
const old = { ...replies.terminal, id: "old", name: "Known shell" };
const replacement = { ...replies.terminal, id: "new", name: "Recovered shell" };
let status = 200;
let list = 200;
let terminal = old;
let reads = 0;
let hidden = false;
Object.defineProperty(document, "hidden", { get: () => hidden });
const visibility = (value) => { hidden = value; document.dispatchEvent(new window.Event("visibilitychange")); };
globalThis.fetch = async (url) => {
  if (String(url).endsWith("/status")) {
    return status === 200 ? Response.json(replies.status) : Response.json({ error: "status unavailable" }, { status });
  }
  reads++;
  return list === 200 ? Response.json({ terminals: [terminal] }) : Response.json({ error: "list unavailable" }, { status: list });
};

mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100 });
const dock = createShells();
try {
  await flush();
  assert.equal(reads, 1);
  list = 500;
  launcher.click();
  await flush();
  assert.equal(document.querySelector(".shl-n")?.textContent, old.name);
  assert.match(document.querySelector(".shl-err")?.textContent || "", /couldn't refresh/i);
  assert.equal(reports.length, 1, "the mounted dock reports one unexpected list failure");
  assert.equal(reports[0].status, 500);

  list = 200;
  terminal = replacement;
  mock.timers.tick(15_000);
  await flush();
  assert.equal(document.querySelector(".shl-n")?.textContent, replacement.name, "the next poll replaces last-good rows after recovery");
  assert.equal(Boolean(document.querySelector(".shl-err")), false);

  visibility(true);
  mock.timers.tick(60_000);
  status = 500;
  visibility(false);
  await flush();
  assert.equal(document.querySelector(".shl-n")?.textContent, replacement.name);
  assert.equal(reports.length, 2, "an unexpected status failure reaches the same shared reporter");
  status = 200;
  mock.timers.tick(15_000);
  await flush();
  assert.equal(Boolean(document.querySelector(".shl-err")), false);
  assert.equal(reports.length, 2);

  dock.dispose();
  status = 404;
  const older = createShells();
  try {
    await flush();
    assert.equal(older.available, false);
    assert.equal(reports.length, 2, "an older backend without terminal status uses the quiet fallback");
  } finally { older.dispose(); }
} finally {
  dock.dispose();
  globalThis.reportError = previousReporter;
  mock.timers.reset();
}
