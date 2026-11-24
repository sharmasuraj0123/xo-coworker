// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { same, settle } from "../../../tests/lib/dom.mjs";
import { mountSettingsPage } from "../../../tests/lib/settings-page.mjs";
import { createRulesPage } from "../page.js";

const snapshot = JSON.parse(readFileSync(
  new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8",
));
const requests = [];
const first = { id: "first rule", sentence: "Read the current project", scope: "project", project_pid: "local" };
const second = { id: "second", sentence: "Inspect the current thread", scope: "thread", thread_ts: "thread" };
const builtIn = { id: "built-in", sentence: "Read inside the project" };
let revoked = false;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input), "https://space.invalid");
  const cursor = url.searchParams.get("after_seq");
  const method = init?.method;
  const path = url.pathname.replace("/first%20rule", "/{rule_id}");
  requests.push([method, path, cursor]);
  assert.ok(snapshot.paths[path]?.includes(method), `${method} ${path} must be in OpenAPI`);
  if (method === "DELETE") {
    revoked = true;
    return Response.json({});
  }
  if (cursor === "0") return Response.json({ rules: revoked ? [] : [first], defaults: [builtIn], next_after_seq: 8 });
  return Response.json({ rules: [second] });
};

const host = await mountSettingsPage("rules");
const announced = [];
const page = createRulesPage(host, {
  world: { thread: () => ({ title: "Current thread" }), state: { projects: [{ id: "project", pid: "local" }] } },
  PROJ: (id) => (id === "project" ? "Example project" : id),
  announce: (words) => announced.push(words),
});
try {
  await page.open();
  assert.deepEqual([...document.querySelectorAll(".rl-m")].map((row) => row.textContent), [
    "Example project", "Only in “Current thread”", "XO's default",
  ]);
  const button = document.querySelector('[data-rule-off="first rule"]');
  button.focus();
  page.click(button);
  assert.equal(requests.length, 2);
  same(document.activeElement, document.querySelector("[data-rule-no]"));
  const yes = document.querySelector("[data-rule-yes]");
  yes.focus();
  page.click(yes);
  await settle();
  assert.equal(Boolean(document.querySelector('[data-rule-off="first rule"]')), false);
  same(document.activeElement, document.querySelector('[data-rule-off="second"]'));
  assert.deepEqual(announced, ["Revoked. Agents will ask again."]);
  assert.deepEqual(requests, [
    ["GET", "/api/chat/rules", "0"], ["GET", "/api/chat/rules", "8"],
    ["DELETE", "/api/chat/rules/{rule_id}", null],
    ["GET", "/api/chat/rules", "0"], ["GET", "/api/chat/rules", "8"],
  ]);
} finally {
  page.dispose();
}

const refreshed = createRulesPage(await mountSettingsPage("rules"), {
  world: { thread: () => undefined, state: { projects: [] } },
  PROJ: (id) => id,
  announce() {},
});
const originalReport = Object.getOwnPropertyDescriptor(globalThis, "reportError");
const failures = [];
Object.defineProperty(globalThis, "reportError", { configurable: true, value: (error) => failures.push(error.code) });
const stale = Promise.withResolvers();
const signals = [];
globalThis.fetch = async (_input, init) => {
  signals.push(init.signal);
  if (signals.length === 1) return stale.promise;
  if (signals.length === 2) return Response.json({ rules: [second] });
  return Response.json({ detail: { code: "storage_error", message: "Unavailable" } }, { status: 500 });
};
const opening = refreshed.open();
try {
  await settle();
  await refreshed.open();
  assert.equal(signals[0].aborted, true);
  stale.resolve(Response.json({ rules: [first] }));
  await opening;
  await refreshed.open();
  assert.equal(document.querySelector(".rl-s")?.textContent, second.sentence);
  assert.deepEqual(failures, ["storage_error"]);
} finally {
  stale.resolve(Response.json({ rules: [] }));
  refreshed.dispose();
  if (originalReport) Object.defineProperty(globalThis, "reportError", originalReport);
  else Reflect.deleteProperty(globalThis, "reportError");
}
