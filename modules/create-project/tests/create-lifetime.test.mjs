// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { setImmediate as drain } from "node:timers/promises";
import { createScope } from "../../../core/kernel/scope.js";
import { OVERLAYS } from "../../../shell/overlays.js";
import { deferred, dom } from "../../../tests/lib/dom.mjs";
import { initCreate } from "../create.js";

const fixture = JSON.parse(readFileSync(new URL(
  "../../../core/platform/tests/fixtures/project-schedule-responses.json", import.meta.url,
), "utf8"));

async function mount() {
  await dom(`<button id="opener">New project</button>${OVERLAYS}`);
  const form = document.querySelector("#create-form");
  assert.ok(form);
  Object.assign(form, { reset() {} });
  const dialog = document.querySelector("#create-dlg");
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; };
  const refresh = deferred();
  const events = { refreshes: 0, ready: 0, announcements: [], heralds: [] };
  const scope = createScope();
  const create = initCreate({
    world: { state: { projects: [] }, act: { refresh() { events.refreshes++; return refresh.promise; } } },
    welcome() { events.ready++; }, go() {}, heraldShow: (notice) => events.heralds.push(notice),
    announce: (message) => events.announcements.push(message), setDrawer() {}, onPhoneClose() {},
  }, scope);
  document.querySelector("#opener").focus();
  await create.open();
  const input = (/** @type {string} */ id, /** @type {string} */ value) => {
    const field = document.querySelector(id);
    assert.ok(field instanceof window.HTMLInputElement);
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const submit = () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  return { create, scope, refresh, events, input, submit };
}

test("a malformed clone status is reported once, stops polling and releases the form", async ({ mock }) => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const failures = mock.method(console, "error", () => {});
  let polls = 0;
  mock.method(globalThis, "fetch", async (url) => {
    if (url === "api/config/workspace") return Response.json(fixture.workspace);
    if (url === "api/connectors/github/status") return Response.json({ status: "needs_auth" });
    if (url === "api/xo-projects") return Response.json(fixture.clone, { status: 202 });
    assert.equal(url, "api/xo-projects/clones/cl_fixture");
    polls++;
    return Response.json({ ...fixture.activeClone, percent: "25" });
  });
  const { scope, input, submit, events } = await mount();
  try {
    document.querySelector('[data-mode="clone"]').dispatchEvent(new Event("click", { bubbles: true }));
    input("#cp-repo", "example/fixture");
    submit();
    await drain();
    mock.timers.tick(1000);
    await drain();
    assert.equal(document.querySelector("#cp-submit").hasAttribute("aria-busy"), false);
    assert.equal(document.querySelector("#cp-prog").hidden, true);
    assert.match(document.querySelector("#cp-err").textContent, /unexpected answer/);
    assert.equal(failures.mock.callCount(), 1);
    assert.equal(failures.mock.calls[0].arguments[0].code, "bad_answer");
    mock.timers.tick(4000);
    await drain();
    assert.equal(polls, 1);
    assert.equal(events.refreshes, 0);
  } finally { scope.dispose(); }
  assert.equal(scope.size, 0);
});

for (const unload of [false, true]) {
  test(`an accepted create with a pending refresh ${unload ? "cannot publish after retirement" : "finishes after dialog close"}`,
    async ({ mock }) => {
      mock.method(globalThis, "fetch", async (url) => {
        if (url === "api/config/workspace") return Response.json(fixture.workspace);
        assert.equal(url, "api/files/mkdir");
        return Response.json(fixture.created);
      });
      const { create, scope, refresh, input, submit, events } = await mount();
      try {
        input("#cp-name", "Fixture");
        submit();
        await drain();
        assert.equal(events.refreshes, 1);
        create.close({ now: true });
        if (unload) scope.dispose();
        refresh.resolve();
        await drain();
        assert.equal(events.ready, unload ? 0 : 1);
        assert.equal(events.heralds.length, unload ? 0 : 1);
        assert.equal(events.announcements.length, unload ? 0 : 1);
      } finally { scope.dispose(); }
      assert.equal(scope.size, 0);
    });
}
