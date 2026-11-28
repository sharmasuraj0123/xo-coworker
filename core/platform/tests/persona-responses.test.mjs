// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { api } from "../api.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/persona-responses.json", import.meta.url), "utf8"));

/** @typedef {[string, string, string, () => Promise<unknown>, object, (value: Record<string, unknown>) => void]} Route */

/** @type {Route[]} */
const routes = [
  ["GET", "/personas", "project=alpha", () => api.personas("alpha"), fixture.list,
    (v) => { v.personas = [{ ...fixture.list.personas[0], shadowed: "release-checker" }]; }],
  ["GET", "/personas", "", () => api.personas(null), fixture.list, (v) => { v.may = { read: { label: "Read", tools: "read" } }; }],
  ["GET", "/personas/importable", "project=alpha", () => api.importable("alpha"), fixture.importable,
    (v) => { v.importable = [{ ...fixture.importable.importable[0], dropped: null }]; }],
  ["POST", "/personas/import", "", () => api.importPersona({ adapter: "claude_code", id: "space:reviewer", without_dropped: true }),
    fixture.imported, (v) => { v.level = "user"; }],
  ["POST", "/chat/try", "", () => api.tryOnce({ project: "alpha", persona: { name: "reviewer", level: "space" } }), fixture.tried,
    (v) => { delete v.ts; }],
];

for (const [method, path, query, call, sample, alter] of routes) {
  test(`${method} ${path}${query ? `?${query}` : ""} checks the answer before using it`, async ({ mock }) => {
    const invalid = structuredClone(sample);
    alter(invalid);
    let value = sample;
    const fetches = mock.method(globalThis, "fetch", async (/** @type {string} */ url, /** @type {RequestInit} */ options) => {
      const [at, search = ""] = url.split("?");
      assert.equal(at, "api" + path);
      assert.equal(search, query);
      assert.equal(options.method ?? "GET", method);
      return Response.json(value);
    });
    assert.deepEqual(await call(), sample);
    value = invalid;
    await assert.rejects(call(), { code: "bad_answer" });
    assert.equal(fetches.mock.callCount(), 2);
  });
}

test("Try once and import send exactly what they were given", async ({ mock }) => {
  /** @type {unknown[]} */
  const sent = [];
  mock.method(globalThis, "fetch", async (/** @type {string} */ url, /** @type {RequestInit} */ options) => {
    sent.push(JSON.parse(String(options.body)));
    return Response.json(url.includes("/chat/try") ? fixture.tried : fixture.imported);
  });
  await api.tryOnce({ project: "alpha", text: "---\nname: a\n---\n" });
  await api.importPersona({ adapter: "claude_code", id: "space:reviewer" });
  assert.deepEqual(sent, [{ project: "alpha", text: "---\nname: a\n---\n" }, { adapter: "claude_code", id: "space:reviewer" }]);
});
