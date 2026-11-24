// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { deferred, same, settle } from "../../../tests/lib/dom.mjs";
import { mountSettingsPage } from "../../../tests/lib/settings-page.mjs";
import { createWorktreesPage } from "../page.js";

const tree = { chat_id: "chat", thread_ts: "thread", path: "/checkout", removable: true, exists: true };

async function mount() {
  const host = await mountSettingsPage("worktrees");
  const announce = [];
  const page = createWorktreesPage(host, {
    world: { thread: () => ({ title: "A finished thread" }), act: { projectOf: () => "project" } },
    announce: (words) => announce.push(words),
    PROJ: () => "Example project",
  });
  return { page, announce };
}

test("Worktrees owns its list and confirmation while Settings still handles focus", async () => {
  const { page, announce } = await mount();
  const methods = [];
  globalThis.fetch = async (_url, init) => {
    methods.push(init.method);
    return Response.json(init.method === "DELETE" || methods.includes("DELETE") ? {} : { worktrees: [tree] });
  };
  try {
    await page.open();
    assert.match(document.querySelector(".wt-row").textContent, /A finished thread.*Nothing would be lost/);
    const remove = document.querySelector("button[data-wt]");
    remove.focus();
    assert.equal(page.click(remove), true);
    assert.deepEqual(methods, ["GET"]);
    const keep = document.querySelector("[data-wt-no]");
    same(document.activeElement, keep);
    assert.equal(page.click(keep), true);
    const again = document.querySelector("button[data-wt]");
    same(document.activeElement, again);
    page.click(again);
    const confirm = document.querySelector("[data-wt-yes]");
    confirm.focus();
    page.click(confirm);
    await settle();
    assert.deepEqual(methods, ["GET", "DELETE", "GET"]);
    assert.deepEqual(announce, ["Removed. Nothing was lost."]);
    assert.equal(Boolean(document.querySelector(".wt-row")), false);
    same(document.activeElement, document.querySelector("[data-set=worktrees]"));
  } finally {
    page.dispose();
  }
});

test("superseding and disposing Worktrees abort their reads", async () => {
  const { page } = await mount();
  const stale = deferred();
  const pending = deferred();
  const signals = [];
  globalThis.fetch = async (_url, init) => {
    signals.push(init.signal);
    if (signals.length === 1) return stale.promise;
    if (signals.length === 3) return pending.promise;
    return Response.json({ worktrees: [{ ...tree, path: "/new" }] });
  };
  const oldLoad = page.open();
  try {
    await settle();
    await page.open();
    assert.equal(signals[0].aborted, true);
    stale.resolve(Response.json({ worktrees: [tree] }));
    await oldLoad;
    assert.equal(document.querySelector(".wt-row code").textContent, "/new");
    const lateLoad = page.open();
    await settle();
    page.dispose();
    assert.equal(signals[2].aborted, true);
    pending.resolve(Response.json({ worktrees: [] }));
    await lateLoad;
    assert.equal(document.querySelector(".wt-row code").textContent, "/new");
  } finally {
    page.dispose();
    stale.resolve(Response.json({}));
    pending.resolve(Response.json({}));
  }
});

test("Keep it dismisses a removal refusal and returns focus to the checkout", async () => {
  const { page } = await mount();
  globalThis.fetch = async (_url, init) => init.method === "DELETE"
    ? Response.json({ detail: { code: "session_busy" } }, { status: 409 })
    : Response.json({ worktrees: [tree] });
  try {
    await page.open();
    page.click(document.querySelector("[data-wt]"));
    const confirm = document.querySelector("[data-wt-yes]");
    confirm.focus();
    page.click(confirm);
    await settle();
    assert.match(document.querySelector("[role=alertdialog]").textContent, /Its agent is still using it/);
    page.click(document.querySelector("[data-wt-no]"));
    assert.doesNotMatch(document.querySelector(".wt-row").textContent, /Its agent is still using it/);
    same(document.activeElement, document.querySelector("[data-wt]"));
  } finally {
    page.dispose();
  }
});

test("an unexpected refresh failure reports once and keeps the last list", async () => {
  const { page } = await mount();
  const original = Object.getOwnPropertyDescriptor(globalThis, "reportError");
  const failures = [];
  Object.defineProperty(globalThis, "reportError", { configurable: true, value: (error) => failures.push(error.code) });
  let reads = 0;
  globalThis.fetch = async () => {
    if (reads++ === 0) return Response.json({ worktrees: [tree] });
    return Response.json({ detail: { code: "storage_error", message: "Unavailable" } }, { status: 500 });
  };
  try {
    await page.open();
    await page.open();
    assert.equal(document.querySelector(".wt-row code").textContent, "/checkout");
    assert.deepEqual(failures, ["storage_error"]);
  } finally {
    page.dispose();
    if (original) Object.defineProperty(globalThis, "reportError", original);
    else Reflect.deleteProperty(globalThis, "reportError");
  }
});
