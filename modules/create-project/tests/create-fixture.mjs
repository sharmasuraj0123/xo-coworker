// The New project dialog on a DOM, from the page's own markup, with Space's answers set by each test.
import { dom, settle, deferred } from "../../../tests/lib/dom.mjs";
import { OVERLAYS } from "../../../shell/overlays.js";
import assert from "node:assert/strict";
import { createScope } from "../../../core/kernel/scope.js";

let dialogs = 0;
/** Winds the last case's dialog down before the next case's page exists: its clone stops, its GitHub login goes quiet. */
let retire = async () => {};
/** Space as the dialog sees it: each route a function the test can replace (GitHub's in `github`); clones answer from `clone`. */
export async function createDialog() {
  await retire();
  await dom(`<button id="opener">New project</button>${OVERLAYS}`);
  const dlg = document.querySelector("#create-dlg");
  dlg.open = false;
  dlg.showModal = () => { dlg.open = true; dlg.setAttribute("open", ""); };
  dlg.close = () => { dlg.open = false; dlg.removeAttribute("open"); dlg.dispatchEvent(new Event("close")); };
  const form = document.querySelector("#create-form");
  form.reset ??= () => { for (const el of form.querySelectorAll("input, textarea")) el.value = ""; };
  const { api } = await import("../../../core/platform/api.js");
  const said = [], heralds = [];
  /** @type {{ waiting: ReturnType<typeof deferred>[], polls: number }} */
  const clone = { waiting: [], polls: 0, id: `c${++dialogs}`, over: false };
  const github = { connect: async () => ({ status: "connected", username: "ann" }), poll: async () => ({ status: "pending" }) };
  const sessions = new Set();
  Object.assign(api, {
    workspaceConfig: async () => ({ roots: { home: "/w" }, default: "home" }),
    createProject: () => deferred().promise,
    cloneProject: async () => ({ clone_id: clone.id }),
    cloneStatus: (id) => {
      if (id !== clone.id) return new Promise(() => {});
      if (clone.over) return Promise.resolve({ state: "cancelled" });
      clone.polls++; const d = deferred(); clone.waiting.push(d); return d.promise;
    },
    cancelClone: async () => ({}),
    githubStatus: async () => ({ status: "needs_auth" }),
    githubConnect: async () => {
      const r = await github.connect();
      if (!r || !r.session_id) return r;
      const sid = `${clone.id}:${r.session_id}`;
      sessions.add(sid);
      return { ...r, session_id: sid };
    },
    githubConnectPoll: (sid) => (sessions.has(sid) ? github.poll(sid) : new Promise(() => {})),
  });
  const { initCreate } = await import("../create.js");
  const ctx = {
    world: { state: { projects: [] }, act: { refresh: async () => {} } },
    welcome() {}, go: () => {}, heraldShow: (h) => heralds.push(h), announce: (s) => said.push(s), setDrawer: () => {}, onPhoneClose: () => {},
  };
  const scope = createScope();
  const C = initCreate(ctx, scope);
  retire = async () => {
    clone.over = true; sessions.clear();
    for (const d of clone.waiting.splice(0)) d.resolve({ state: "cancelled" });
    scope.dispose();
    assert.equal(scope.size, 0);
    await settle();
  };
  const $ = (sel) => document.querySelector(sel);
  const type = (sel, text) => { const el = $(sel); el.value = text; el.dispatchEvent(new Event("input", { bubbles: true })); };
  const press = async (sel) => { const el = $(sel); if (!el) throw new Error(`no ${sel}`); el.dispatchEvent(new Event("click", { bubbles: true })); await settle(); };
  const submit = async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle(); };
  /** Answer the clone's next poll (they come a second apart) with `st`. */
  const answer = async (st) => {
    for (let i = 0; !clone.waiting.length; i++) { if (i > 40) throw new Error("the clone was never polled"); await new Promise((r) => setTimeout(r, 50)); }
    clone.waiting.shift().resolve(st); await settle();
  };
  $("#opener").focus();
  await C.open();
  await settle();
  return { C, api, github, $, type, press, submit, answer, clone, said, heralds, settle };
}
