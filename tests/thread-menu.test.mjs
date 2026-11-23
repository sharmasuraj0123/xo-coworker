// The thread's ⋯ and one vocabulary (the owner, 19 Nov): one menu for everything a thread can do, only what fits
// its state; Delete only where Space offers it, asked in place; "Waiting", never "Idle"; All threads in the panel's
// four states; the Now strip gone from the header (the panel's Threads has every thread).
//   node tests/thread-menu.test.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const all = readFileSync(new URL("../modules/threads/all.js", import.meta.url), "utf8");

// the menu: ⋯, not ✎; built from the thread's state
assert.match(app, /class="tw-act tw-more" data-tmenu="\$\{esc\(t\.id\)\}"[^`]*aria-label="Thread actions">\$\{ICON\.more\}<\/button>/);
const menu = app.slice(app.indexOf("function threadMenuHtml("), app.indexOf("/** Delete, asked in place"));
assert.match(menu, /"Previous thread", !sib\.prev\)/);
assert.match(menu, /"Next thread", !sib\.next\)/);
assert.match(menu, /t\.branch \? item\(`data-tcopy=/, "Copy branch name only with a branch");
assert.match(menu, /isBusy\(t\) \? item\("data-chat-stop", "Stop"\) : ""/, "Stop only while it works");
assert.match(menu, /t\.canDelete \? item\(`data-tdel=/, "Delete only where Space can delete it");
assert.doesNotMatch(menu, /[⌘⇧⏎⌫]/, "no key glyphs in it");

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
