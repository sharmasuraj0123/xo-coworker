// @ts-check
// The thread's ⋯ and one vocabulary (the owner, 19 Nov): one menu for everything a thread can do, only what fits
// its state; Delete only where Space offers it, asked in place; "Waiting", never "Idle"; All threads in the panel's
// four states; the Now strip gone from the header (the panel's Threads has every thread).
//   node tests/thread-menu.test.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dom } from "./lib/dom.mjs";
import { createThreadMenu } from "../modules/threads/menu.js";
import { createThreadGroups } from "../modules/threads/groups.js";

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
const { document } = await dom('<section id="main"></section><section id="page"></section>');
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
const del = app.slice(app.indexOf("function tdelRender("), app.indexOf("/** A Shell button: \"ws\""));
assert.ok(del.indexOf("data-tdel-no>Keep it") < del.indexOf("data-tdel-yes"), "Keep it comes first");
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
