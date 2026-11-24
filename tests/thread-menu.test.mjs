// @ts-check
import assert from "node:assert/strict";
import { deferred, dom, same } from "./lib/dom.mjs";
import { createThreadMenu } from "../modules/threads/menu.js";
import { createThreadGroups } from "../modules/threads/groups.js";
import { createThreadDelete } from "../modules/threads/delete.js";

const earlier = { id: "earlier", project: "project", state: "working", busy: true, title: "Earlier", lastAt: 2, branch: "branch&name", label: "Work", canDelete: true };
const later = { id: "later", project: "project", state: "resolved", busy: false, title: "Later", lastAt: 1 };
const world = { state: { threads: [later, earlier] } };
const isBusy = (thread) => !!thread.busy;
const { panelThreads } = createThreadGroups({ world, isBusy, isHeld: () => false, convProject: () => "project",
  D: { needItems: () => [] }, MAP: { agents: () => [{ go: "p:project", doing: "Coordinating", since: null }] },
  askShort: () => "", threadMark: () => "",
});
const menu = createThreadMenu({ panelThreads, SH: { enabled: true }, isBusy, movable: (thread) => thread.id === earlier.id });
const { document } = await dom('<section id="main"></section><section id="page"></section><div id="top-who"></div><div id="tdel" hidden></div>');
const main = document.getElementById("main");
const page = document.getElementById("page");
assert.ok(main && page);
main.innerHTML = menu(earlier);
page.innerHTML = menu(later, "page");
const [mainPrev, mainNext] = main.querySelectorAll("[data-tgo]");
const [pagePrev, pageNext] = page.querySelectorAll("[data-tgo]");
assert.equal(mainPrev.textContent, "Previous thread");
assert.equal(mainPrev.getAttribute("aria-disabled"), "true", "skip the project coordinator");
assert.equal(mainNext.textContent, "Next thread");
assert.equal(mainNext.getAttribute("data-tgo"), "t:later");
assert.equal(pagePrev.getAttribute("data-tgo"), "t:earlier");
assert.equal(pageNext.getAttribute("aria-disabled"), "true");
assert.equal(main.querySelector("[data-tside]")?.textContent, "Open beside its project's chat");
assert.equal(page.querySelector("[data-tp-main]")?.textContent, "Open in main chat");
assert.equal(main.querySelector("[data-tcopy]")?.getAttribute("data-tcopy"), "branch&name");
assert.equal(main.querySelector("[data-chat-stop]")?.textContent, "Stop");
assert.equal(main.querySelector("[data-tdel]")?.getAttribute("data-tdel"), "earlier");
assert.equal(main.querySelector("[data-tmove]")?.getAttribute("data-tmove"), "earlier");
assert.ok(page.querySelector("[data-tcopy], [data-chat-stop], [data-tdel], [data-tmove]") === null, "main-only actions stay out of the panel");
assert.doesNotMatch(main.textContent + page.textContent, /[⌘⇧⏎⌫]/, "no key glyphs in it");

{
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push([init.method, String(url), init.body]); return { ok: true, status: 200, type: "basic", text: async () => "{}" }; };
  const { api } = await import("../core/platform/api.js");
  await api.deleteThread("c/1", "t 1", { keep_branch: true });
  await api.restoreThread("c/1", "t 1");
  assert.deepEqual(sent, [["DELETE", "api/chat/chats/c%2F1/threads/t%201", '{"keep_branch":true}'], ["POST", "api/chat/chats/c%2F1/threads/t%201/restore", "{}"]]);
}
const dialog = document.getElementById("tdel");
assert.ok(dialog);
/** @type {typeof earlier | typeof later} */
let current = earlier;
const requests = [], restored = [], places = [], notices = [];
let pending = deferred();
let hold = false;
const deletion = createThreadDelete({
  PROJ: () => "Project", announce() {}, render: () => deletion.render(current), view: () => "t:" + current.id,
  go: (view) => places.push(view), heraldShow: (notice) => notices.push(notice),
  world: { thread: (id) => world.state.threads.find((thread) => thread.id === id), act: {
    async deleteThread(id, options) {
      requests.push([id, options]);
      if (hold) return pending.promise;
      if (!options.confirm) {
        throw Object.assign(new Error("Unpublished"), { code: "would_lose_work", confirm: "confirm-token", what: { summary: "One unpublished commit" } });
      }
      return { row: { chat_id: "chat" } };
    },
    async restoreThread(id, row) { restored.push([id, row]); },
  } },
});
deletion.render(earlier);
assert.equal(dialog.hidden, true);
deletion.ask(earlier.id);
assert.equal(dialog.hidden, false);
assert.equal(dialog.querySelector("button")?.textContent, "Keep it", "Keep it comes first");
assert.match(dialog.textContent, /Its branch branch&name is kept/);
const approve = dialog.querySelector("[data-tdel-yes]");
assert.equal(approve?.textContent, "Delete thread");
approve.focus();
await deletion.confirm(earlier.id);
assert.match(dialog.textContent, /One unpublished commit/);
assert.equal(dialog.querySelector("[data-tdel-yes]")?.textContent, "Delete anyway");
same(document.activeElement, approve);
deletion.render(later);
assert.equal(dialog.hidden, true);
assert.equal(dialog.children.length, 0);
assert.deepEqual(places, []);
await deletion.confirm(earlier.id);
assert.deepEqual(requests, [[earlier.id, { keepBranch: true, confirm: null }], [earlier.id, { keepBranch: true, confirm: "confirm-token" }]]);
assert.deepEqual(places, ["p:" + earlier.project]);
await notices[0].undo();
assert.deepEqual(restored, [[earlier.id, { chat_id: "chat" }]]);

hold = true;
deletion.ask(earlier.id);
const submitted = deletion.confirm(earlier.id);
await Promise.resolve();
current = later;
deletion.ask(later.id);
pending.resolve({ row: { chat_id: "chat" } });
await submitted;
assert.deepEqual(places, ["p:" + earlier.project], "a completed delete leaves the current conversation in place");
deletion.render(later);
assert.equal(dialog.querySelector("[data-tdel-yes]")?.getAttribute("data-tdel-yes"), later.id);
assert.equal(dialog.querySelector("[data-tdel-yes]")?.textContent, "Delete thread");
assert.equal(deletion.cancel(), later.id);
assert.equal(dialog.hidden, true);

pending = deferred();
deletion.ask(later.id);
const departing = deletion.confirm(later.id);
await Promise.resolve();
deletion.dispose();
pending.resolve({ row: { chat_id: "chat" } });
await departing;
assert.deepEqual(places, ["p:" + earlier.project], "an unloaded confirmation cannot change the view");
assert.equal(notices.length, 2, "an unloaded confirmation cannot show a notice");
await notices[0].undo();
assert.equal(restored.length, 1, "an unloaded undo cannot start a write");

console.log("thread-menu: ok");
