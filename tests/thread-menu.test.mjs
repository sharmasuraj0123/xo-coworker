// @ts-check
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dom } from "./lib/dom.mjs";
import { createThreadMenu } from "../modules/threads/menu.js";
import { createThreadGroups } from "../modules/threads/groups.js";
import { createThreadDeleteView } from "../modules/threads/delete-view.js";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const all = readFileSync(new URL("../modules/threads/all.js", import.meta.url), "utf8");

// the menu: ⋯, not ✎; built from the thread's state
assert.match(app, /class="tw-act tw-more" data-tmenu="\$\{esc\(t\.id\)\}"[^`]*aria-label="Thread actions">\$\{ICON\.more\}<\/button>/);
const earlier = { id: "earlier", project: "project", state: "working", busy: true, title: "Earlier", lastAt: 2, branch: "branch&name", label: "Work", canDelete: true };
const later = { id: "later", project: "project", state: "resolved", busy: false, title: "Later", lastAt: 1 };
const world = { state: { threads: [later, earlier] } };
const isBusy = (thread) => !!thread.busy;
const { panelThreads } = createThreadGroups({ world, isBusy, isHeld: () => false, convProject: () => "project",
  D: { needItems: () => [] }, MAP: { agents: () => [{ go: "p:project", doing: "Coordinating", since: null }] },
  askShort: () => "", threadMark: () => "",
});
const menu = createThreadMenu({ panelThreads, SH: { enabled: true }, isBusy, movable: (thread) => thread.id === earlier.id });
const { document } = await dom('<section id="main"></section><section id="page"></section><div id="tdel" hidden></div>');
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
assert.equal(page.querySelector("[data-tcopy], [data-chat-stop], [data-tdel], [data-tmove]"), null);
assert.doesNotMatch(main.textContent + page.textContent, /[⌘⇧⏎⌫]/, "no key glyphs in it");

// Delete: Space says per thread; asked in place, Keep it first; undo
{
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push([init.method, String(url), init.body]); return { ok: true, status: 200, type: "basic", text: async () => "{}" }; };
  const { api } = await import("../core/platform/api.js");
  await api.deleteThread("c/1", "t 1", { keep_branch: true });
  await api.restoreThread("c/1", "t 1");
  assert.deepEqual(sent, [["DELETE", "api/chat/chats/c%2F1/threads/t%201", '{"keep_branch":true}'], ["POST", "api/chat/chats/c%2F1/threads/t%201/restore", "{}"]]);
}
const del = app.slice(app.indexOf("async function deleteThread("), app.indexOf("/** A Shell button: \"ws\""));
/** @type {{ tDel: string | null, tDelLose: { summary: string } | null }} */
const decision = { tDel: null, tDelLose: null };
const renderDelete = createThreadDeleteView(decision);
const dialog = document.getElementById("tdel");
assert.ok(dialog);
renderDelete(earlier);
assert.equal(dialog.hidden, true);
decision.tDel = earlier.id;
renderDelete(earlier);
assert.equal(dialog.hidden, false);
assert.equal(dialog.querySelector("button")?.textContent, "Keep it", "Keep it comes first");
assert.match(dialog.textContent, /Its branch branch&name is kept/);
assert.equal(dialog.querySelector("[data-tdel-yes]")?.textContent, "Delete thread");
decision.tDelLose = { summary: "One unpublished commit" };
renderDelete(earlier);
assert.match(dialog.textContent, /One unpublished commit/);
assert.equal(dialog.querySelector("[data-tdel-yes]")?.textContent, "Delete anyway");
renderDelete(later);
assert.equal(dialog.hidden, true);
assert.equal(dialog.children.length, 0);
assert.match(del, /keepBranch: true/, "its branch is kept");
assert.match(del, /undo: \(\) => world\.act\.restoreThread\(tid, res\.row\)/);
assert.match(del, /err\.code === "would_lose_work"/, "work kept nowhere else is named and asked again");
assert.match(html, /<div class="tdel" id="tdel" hidden><\/div>/);

// one vocabulary
assert.doesNotMatch(app.replace(/\/\/[^\n]*/g, "") + readFileSync(new URL("../js/chats.js", import.meta.url), "utf8"), /"Idle"/, "nothing reads Idle");
assert.match(all, /const ALL_F = \[\["all", "All"\], \["needs", "Needs you"\], \["working", "Working"\], \["waiting", "Waiting"\], \["done", "Done"\]\];/);
assert.match(all, /const cat = \(t\) => threadState\(t, needs\);/);

// the Now strip is gone, with everything that was its own
assert.doesNotMatch(app + html, /now-wrap|nowRender|nowEdges|fitChips/);
assert.ok(!existsSync(new URL("../js/nowfit.js", import.meta.url)), "js/nowfit.js is gone");

console.log("thread-menu: ok");
