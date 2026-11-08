// Browser tests for what the unit tests can't reach: the flows where timing, focus and the network meet.
//   G1  every decision path waits out the card's 300 ms re-arm; a held key (repeat) never decides anything
//   G2  a card withdrawn while you type on it hands over with the next card's letter keys paused
//   G3  a merge with a place still to choose never saves, by Ctrl/Cmd+S or the button
//   G4  a save that finishes after you opened another file only lands on the file that started it
//   G5  a hop's receipt survives a history read that left before it, and one that came before its hop
//   G6  Launchpad says a deploy stopped only once Space confirms it; a refused stop says so, with Stop again
//   G7  keyboard focus after an editor outcome: Edit after a save or a discard, Save after a failed save,
//       Keep editing for Cancel's question
//   G8  the whole-file capsule's × is named for the file, a line range's for its lines
//
// Self-contained: the app is served from this folder by a small static server, and every /api request is
// answered in the page from a mock world (the Launchpad routes by design-research's mockspace). Nothing
// reaches a Space; nothing is written anywhere.
//   node tests/browser/flows.test.cjs
// Needs Playwright's core and a Chromium: PLAYWRIGHT_CORE (default /tmp/pw/node_modules/playwright-core).
// Without them it says so and exits 2: not run is not passed.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const assert = require("assert/strict");

const PW = process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core";
let chromium;
try { ({ chromium } = require(PW)); } catch { console.error(`not run: Playwright core isn't at ${PW} (set PLAYWRIGHT_CORE)`); process.exit(2); }
const { SSE, serve, NOW, openApp, launch, LP } = require("./harness.cjs");

let browser, server, BASE, WIDTH = 1440, passed = 0, failed = 0;
const tests = [];
const t = (name, fn) => tests.push({ name, fn });
// the project's own page, as its row in the sidebar opens it (on a phone the sidebar is a drawer)
const toDemo = (page) => page.evaluate(() => window.__t.go("p:demo"));
const app = (W = {}, { width = WIDTH, motion = false } = {}) => openApp(browser, BASE, W, { width, motion });
// a test ends with no page errors and with focus never having fallen to the page (harness.cjs records each drop)
const done = async (page) => {
  const errs = page.errors;
  const drops = await page.evaluate(() => window.__focusDrops || []).catch(() => []);
  await page.context().close();
  assert.deepEqual(errs, [], "page errors");
  if (!process.env.ALLOW_FOCUS_DROPS) assert.deepEqual(drops, [], "focus fell to the page when its control went");
};

// ── the viewer's editor ───────────────────────────────────────────────────
const FILE = () => ({ content: "one\ntwo\nthree\n", version: "sha256:A" });
async function editing(page, rel = "a.js") {
  await toDemo(page);
  await page.evaluate((rel) => window.__t.VW.open({ project: "demo", rel, path: rel, name: rel }), rel);
  await page.locator("[data-vw-edit]").click();
  await page.waitForFunction(() => window.__ED && window.__ED.on && window.__ED.ed);
}
async function typeAll(page, text) {
  await page.locator("#viewer [contenteditable=true]").first().click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
  await page.waitForFunction(() => window.__ED.dirty);
}
const focusOf = (page) => page.evaluate(() => { const a = document.activeElement; return a ? [a.tagName, ...[...a.attributes].map((x) => x.name).filter((n) => n.startsWith("data-vw-"))].join(" ") : null; });

t("G3: Ctrl/Cmd+S on a merge with a place still to choose saves nothing", async () => {
  const page = await app({ files: { "a.js": FILE() }, saveMode: "overlap" });
  await editing(page);
  await typeAll(page, "mine\ntwo\nthree\n");
  await page.locator("[data-vw-saveit]").click();
  await page.waitForFunction(() => window.__ED.conflict && window.__ED.conflict.left === 1);
  await page.locator("#viewer").focus();
  await page.keyboard.press("ControlOrMeta+s");
  await page.locator("[data-vw-saveit]").click({ force: true });
  await page.waitForTimeout(300);
  assert.equal(page.W.saves.length, 1, "only the first save, the one that met the change");
  assert.ok(!/<<<<<<<|>>>>>>>/.test(page.W.files["a.js"].content), "no conflict markers written");
  assert.equal(await page.evaluate(() => window.__ED.on && window.__ED.conflict.left), 1, "still choosing");
  await done(page);
});

t("G4: a save that finishes after another file opened lands only on its own file", async () => {
  let answer;
  const page = await app({ files: { "a.js": FILE(), "b.js": { content: "SECOND FILE\n", version: "sha256:Z" } }, saveGate: new Promise((ok) => (answer = ok)) });
  await editing(page);
  await typeAll(page, "first file saved slowly\n");
  await page.locator("[data-vw-saveit]").click();
  await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "b.js", path: "b.js", name: "b.js" }));
  await page.waitForFunction(() => window.__V.data && window.__V.data.content === "SECOND FILE\n");
  answer(); // a.js's save answers only now, with b.js open
  await page.waitForTimeout(300);
  assert.equal(page.W.files["a.js"].content, "first file saved slowly\n", "a.js saved");
  assert.equal(await page.evaluate(() => window.__V.file.name), "b.js");
  assert.equal(await page.evaluate(() => window.__V.data.content), "SECOND FILE\n", "b.js shows its own text");
  assert.ok(!(await page.locator("#viewer").innerText()).includes("Saved a.js"), "no Saved/Undo for a.js on b.js");
  await done(page);
});

t("G7: focus after a keyboard save goes to Edit; a failed clicked save keeps Save; Cancel asks with Keep editing; Discard goes to Edit", async () => {
  const page = await app({ files: { "a.js": FILE() } });
  await editing(page);
  await typeAll(page, "mine\ntwo\nthree\n");
  await page.keyboard.press("ControlOrMeta+s");
  await page.waitForFunction(() => !window.__ED.on);
  assert.equal(await focusOf(page), "BUTTON data-vw-edit", "after a keyboard save");
  page.W.saveMode = "503";
  await page.locator("[data-vw-edit]").click();
  await page.waitForFunction(() => window.__ED.on && window.__ED.ed);
  await typeAll(page, "unsaved\n");
  await page.locator("[data-vw-saveit]").click();
  await page.waitForFunction(() => window.__ED.err);
  assert.equal(await focusOf(page), "BUTTON data-vw-saveit", "after a failed clicked save");
  assert.equal(await page.evaluate(() => window.__ED.ed.text()), "unsaved\n", "the text stays");
  await page.locator("[data-vw-cancel]").focus();
  await page.keyboard.press("Enter");
  assert.equal(await focusOf(page), "BUTTON data-vw-keep", "Cancel's question");
  await page.locator("[data-vw-discard]").click();
  await page.waitForFunction(() => !window.__ED.on);
  assert.equal(await focusOf(page), "BUTTON data-vw-edit", "after Discard");
  await done(page);
});

t("Save while typing: words typed during a save stay, unsaved, against the version it saved", async () => {
  let answer;
  const page = await app({ files: { "a.js": FILE() }, saveGate: new Promise((ok) => (answer = ok)) });
  await editing(page);
  await typeAll(page, "saved portion\n");
  await page.locator("[data-vw-saveit]").click();
  await page.locator("#viewer [contenteditable=true]").first().click(); // back into the text, which stays editable
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("TYPED WHILE SAVING");
  answer(); // the save's answer arrives now, with the words already typed
  await page.waitForFunction(() => !window.__ED.saving);
  await page.waitForTimeout(100);
  assert.equal(page.W.files["a.js"].content, "saved portion\n", "the save sent what was there at Save");
  const st = await page.evaluate(() => ({ on: window.__ED.on, dirty: window.__ED.dirty, text: window.__ED.ed && window.__ED.ed.text(), base: window.__ED.base, version: window.__ED.version }));
  assert.equal(st.on, true, "still editing");
  assert.equal(st.text, "saved portion\nTYPED WHILE SAVING", "what was typed is still there");
  assert.equal(st.dirty, true, "and unsaved");
  assert.equal(st.base, "saved portion\n");
  assert.equal(st.version, page.W.files["a.js"].version, "against the version just saved");
  assert.ok(!(await page.locator("#viewer").innerText()).includes("Saved a.js"), "no Saved toast while unsaved words remain");
  // Save again sends the rest, against that version
  page.W.saveGate = null;
  const v = st.version;
  await page.keyboard.press("ControlOrMeta+s");
  await page.waitForFunction(() => !window.__ED.on);
  assert.equal(page.W.saves.at(-1).base_version, v);
  assert.equal(page.W.files["a.js"].content, "saved portion\nTYPED WHILE SAVING");
  await done(page);
});

t("G9: a late conflict while you type puts focus on what happened, and typing on can't choose", async () => {
  let answer;
  const page = await app({ files: { "a.js": FILE() }, saveMode: "overlap", saveGate: new Promise((ok) => (answer = ok)) });
  await editing(page);
  await typeAll(page, "mine\ntwo\nthree\n");
  await page.locator("[data-vw-saveit]").click();
  await page.locator("#viewer [contenteditable=true]").first().click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("more");
  answer(); // the 409 arrives while the editor has focus
  await page.waitForFunction(() => window.__ED.conflict && window.__ED.conflict.left >= 1);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.activeElement.className), "xd-bar", "focus on the explanation, not BODY");
  const left = await page.evaluate(() => window.__ED.conflict.left);
  await page.keyboard.type("ab ");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => window.__ED.conflict.left), left, "no choice made by the keys");
  assert.equal(page.W.saves.length, 1, "nothing saved");
  await done(page);
});

t("G7: a failed Undo returns focus to the file's head", async () => {
  const page = await app({ files: { "a.js": FILE() }, undoMode: "503" });
  await editing(page);
  await typeAll(page, "mine\ntwo\nthree\n");
  await page.keyboard.press("ControlOrMeta+s");
  await page.waitForFunction(() => !window.__ED.on);
  await page.locator("[data-vw-undo]").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  assert.equal(page.W.undos, 1);
  assert.equal(await focusOf(page), "BUTTON data-vw-edit");
  assert.match(await page.locator("#viewer").innerText(), /Fixture unavailable/);
  await done(page);
});

t("G8: the whole-file capsule's × is named for the file", async () => {
  const page = await app({ files: { "notes.md": { content: "# Notes\n", version: "sha256:N" } } });
  await toDemo(page);
  await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "notes.md", path: "notes.md", name: "notes.md" }));
  await page.locator("[data-vw-askfile]").click();
  await page.waitForSelector("#cref:not([hidden]) .cref-x");
  assert.equal(await page.locator("#cref .cref-x").getAttribute("aria-label"), "Take notes.md out of this message");
  // a line range keeps its line words
  await page.evaluate(() => { const S = window.__t.S; S.lref[S.view] = { path: "notes.md", a: 2, b: 4, name: "notes.md" }; });
  await page.evaluate(() => window.__t.lrefRender());
  assert.equal(await page.locator("#cref .cref-x").getAttribute("aria-label"), "Take the lines out of this message");
  await done(page);
});

// ── Copy: "Copied" only once it's on the clipboard ──
const MSG = (text) => [{ id: "m1", seq: 1, chat_id: "chat_demo", thread_ts: null, author_kind: "agent", author_id: "project-coordinator", author_session_id: null, text, reply_to: null, extra: {}, created_at: NOW }];
async function copyCase(refuse) {
  const page = await app({ messages: MSG("Here is the command:\n\n```sh\nnpm test\n```\n") });
  await page.evaluate((refuse) => {
    window.__copied = [];
    navigator.clipboard.writeText = (t) => (refuse ? Promise.reject(new Error("denied")) : (window.__copied.push(t), Promise.resolve()));
    document.execCommand = () => false; // the old way refused too
  }, refuse);
  await toDemo(page);
  const code = page.locator("#msgs [data-copy]").first();
  await code.waitFor();
  await code.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const codeWords = (await code.innerText()).trim();
  const live1 = await page.locator("#live").innerText();
  const focus1 = await page.evaluate(() => document.activeElement.hasAttribute("data-copy"));
  const m = page.locator("#msgs .m").first();
  await m.hover();
  const msgCopy = m.locator("[data-mx-copy]").filter({ visible: true }).first();
  // a phone has no hover, so the message's Copy isn't offered there (the code block's is)
  if (!(await m.locator("[data-mx-copy]").filter({ visible: true }).count())) return { page, codeWords, live1, focus1, phone: true, copied: await page.evaluate(() => window.__copied) };
  const before = await msgCopy.innerHTML();
  await msgCopy.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const after = await msgCopy.innerHTML();
  const live2 = await page.locator("#live").innerText();
  const focus2 = await page.evaluate(() => document.activeElement.hasAttribute("data-mx-copy"));
  const copied = await page.evaluate(() => window.__copied);
  return { page, codeWords, live1, focus1, before, after, live2, focus2, copied };
}
t("Copy refused: neither the code block nor the message says copied; it says why, and focus stays", async () => {
  const r = await copyCase(true);
  assert.equal(r.codeWords, "Copy", "the code button still says Copy");
  assert.match(r.live1, /Couldn't copy/);
  assert.ok(r.focus1, "focus stays on the code block's Copy");
  if (r.phone) return done(r.page);
  assert.equal(r.after, r.before, "the message's Copy icon doesn't change to a check");
  assert.match(r.live2, /Couldn't copy/);
  assert.ok(r.focus2, "focus stays on the message's Copy");
  await done(r.page);
});
t("Copy allowed: both say copied, and the text is what was shown", async () => {
  const r = await copyCase(false);
  assert.equal(r.codeWords, "Copied");
  assert.match(r.live1, /Copied the code/);
  assert.equal(r.copied[0].trim(), "npm test");
  if (r.phone) return done(r.page);
  assert.notEqual(r.after, r.before, "the message's Copy shows its check");
  assert.match(r.live2, /Copied the message/);
  assert.match(r.copied[1], /Here is the command/);
  await done(r.page);
});

// ── redraw in place (js/redraw.js): the focused control, a typed value and a caret survive a redraw ──
t("redraw: a region redrawn keeps the focused control, what's typed, and applies everything else", async () => {
  const page = await app();
  const r = await page.evaluate(async () => {
    const { redraw } = await import("./js/redraw.js");
    const box = document.createElement("div"); document.body.append(box);
    box.innerHTML = `<p>Old words</p><button type="button" data-rule-off="a">Revoke a</button><button type="button" data-rule-off="b">Revoke b</button><input id="rd-in" value="saved">`;
    const b = box.querySelector('[data-rule-off="b"]'); b.focus();
    redraw(box, `<p>New words</p><button type="button" data-rule-off="b" aria-busy="true">Revoking b…</button><input id="rd-in" value="server">`);
    const kept = document.activeElement === b && b.isConnected, text = b.textContent, busy = b.getAttribute("aria-busy"), gone = !box.querySelector('[data-rule-off="a"]'), p = box.querySelector("p").textContent;
    const input = box.querySelector("#rd-in"); input.focus(); input.value = "typing on"; input.setSelectionRange(3, 3);
    redraw(box, `<p>Newer</p><input id="rd-in" value="server again" class="is-bad">`);
    const field = { same: document.activeElement === input, value: input.value, caret: input.selectionStart, cls: input.className };
    input.blur();
    redraw(box, `<p>Newer</p><input id="rd-in" value="server again">`);
    const later = input.value;
    // a focused checkbox takes the new HTML's checked (a refused toggle shows the saved state again)
    box.innerHTML = `<label><input type="checkbox" data-rtd-allowed="codex" checked> Codex</label>`;
    const cb = box.querySelector("input"); cb.focus(); cb.checked = false; // Space unticked it; the save was refused
    redraw(box, `<label><input type="checkbox" data-rtd-allowed="codex" checked> Codex</label><p role="alert">Not saved</p>`);
    const box2 = { same: document.activeElement === cb, checked: cb.checked };
    box.remove();
    return { kept, text, busy, gone, p, field, later, box2 };
  });
  assert.deepEqual(r, { kept: true, text: "Revoking b…", busy: "true", gone: true, p: "New words", field: { same: true, value: "typing on", caret: 3, cls: "is-bad" }, later: "server again", box2: { same: true, checked: true } });
  await done(page);
});

// ── Jump: the pointer selects as the arrows do ──
t("Jump: the row under a moving pointer is the selection, and Enter goes there", async () => {
  const page = await app();
  await page.keyboard.press("Control+k");
  await page.waitForSelector("#jump:not([hidden]) #j-2");
  const third = page.locator("#j-2");
  const name = (await third.locator(".j-n").innerText()).trim();
  await third.hover();
  await page.mouse.move(...(await third.boundingBox().then((b) => [b.x + b.width / 2 + 4, b.y + b.height / 2])));
  assert.equal(await third.getAttribute("aria-selected"), "true");
  assert.equal(await page.locator('#jump-list [aria-selected="true"]').count(), 1, "one selection");
  assert.equal(await page.locator("#jump-q").getAttribute("aria-activedescendant"), "j-2");
  // the arrows carry on from there
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.locator("#j-3").getAttribute("aria-selected"), "true");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  assert.ok(await page.locator("#jump").isHidden(), "Jump closed");
  assert.ok(name.length > 0);
  await done(page);
});

// ── focus never falls to the page when a control it was on goes ──
const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? a.tagName + [...a.attributes].filter((x) => x.name.startsWith("data-") || x.name === "id" || x.name === "class").map((x) => ` ${x.name}=${x.value}`).join("") : null; });
t("S138: dismissing the Saved notice hands focus to the file's Edit", async () => {
  const page = await app({ files: { "a.js": FILE() } });
  await editing(page);
  await typeAll(page, "mine\n");
  await page.keyboard.press("ControlOrMeta+s");
  await page.waitForFunction(() => !window.__ED.on);
  await page.locator("[data-vw-toastx]").focus();
  await page.keyboard.press("Enter");
  assert.match(await active(page), /data-vw-edit/);
  await done(page);
});
async function panelOpen(page) {
  await toDemo(page);
  // from the keyboard, as a person would
  // (the head redraws as the project's data lands; patch() keeps focus on the toggle through it, so one Enter does)
  await page.locator("[data-stage-toggle]").filter({ visible: true }).first().focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector("#stage").hidden, null, { timeout: 4000 });
}
t("C069: closing the panel puts focus back on its toggle", async () => {
  const page = await app();
  await panelOpen(page);
  await page.locator("[data-stg-close]").filter({ visible: true }).first().focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#stage").hidden);
  assert.match(await active(page), /data-stage-toggle/);
  await done(page);
});
t("C080/C081: the map's tabs: arrows move between Diagram and Graph and stay on the tabs", async () => {
  const page = await app();
  await panelOpen(page);
  if (await page.locator('[data-ghost="map"]').filter({ visible: true }).count()) await page.locator('[data-ghost="map"]').filter({ visible: true }).first().click();
  const tree = page.locator("#stage-map-tree");
  await tree.waitFor();
  await page.evaluate(() => document.querySelector("#stage-map-tree").click());
  await tree.focus();
  await page.keyboard.press("ArrowRight");
  assert.match(await active(page), /id=stage-map-graph/, "focus on Graph's tab, not the drawing");
  await page.keyboard.press("ArrowLeft");
  assert.match(await active(page), /id=stage-map-tree/, "back to Diagram's tab");
  assert.equal(await tree.getAttribute("aria-selected"), "true");
  await done(page);
});
t("S061: Files' Try again, then a good read: focus stays in the tree", async () => {
  const page = await app({ files: { "a.js": FILE() }, treeFails: 1 });
  await panelOpen(page);
  if (await page.locator('[data-ghost="changes"]').filter({ visible: true }).count()) await page.locator('[data-ghost="changes"]').filter({ visible: true }).first().click();
  await page.locator("[data-open-files]").filter({ visible: true }).first().click();
  const step = (w) => process.env.DEBUG && console.log("   step", w);
  step("files open");
  await page.locator('[data-fl-dir="bad"]').filter({ visible: true }).first().click();
  step("folder clicked");
  const retry = page.locator('[data-fl-retry="bad"]').first();
  await retry.waitFor();
  await retry.focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-fl-file="bad/inside.md"]').first().waitFor();
  const a = await active(page);
  assert.ok(a && !/^BODY/.test(a), `focus in the tree, not the page: ${a}`);
  await done(page);
});

async function filesOpen(page) {
  if (await page.locator('[data-ghost="changes"]').filter({ visible: true }).count()) await page.locator('[data-ghost="changes"]').filter({ visible: true }).first().click();
  await page.locator("[data-open-files]").filter({ visible: true }).first().click();
}
t("C033: opening a file from Files with the keyboard puts focus on the file", async () => {
  const page = await app({ files: { "a.js": FILE() } });
  await panelOpen(page);
  await filesOpen(page);
  const row = page.locator('[data-fl-file="a.js"]').filter({ visible: true }).first();
  await row.focus();
  if (process.env.DEBUG) await page.evaluate(() => { window.__fl = []; document.addEventListener("focusout", (e) => window.__fl.push("out " + e.target.tagName + "." + e.target.className + " -> " + (e.relatedTarget ? e.relatedTarget.tagName : "null") + " conn=" + e.target.isConnected + " rects=" + e.target.getClientRects().length + " " + (new Error().stack.split("\n").slice(2, 6).join(" | "))), true); document.addEventListener("focusin", (e) => window.__fl.push("in " + e.target.tagName + "#" + e.target.id + "." + e.target.className), true); new MutationObserver((ms) => { for (const m of ms) for (const r of m.removedNodes) if (r.nodeType === 1 && r.matches && (r.matches("[data-fl-file]") || r.querySelector?.("[data-fl-file]"))) window.__fl.push("removed row " + new Error().stack.split("\n").slice(1, 3).join(" | ")); }).observe(document.body, { childList: true, subtree: true }); });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  if (process.env.DEBUG) console.log(await page.evaluate(() => window.__fl));
  assert.match(await active(page), /^SECTION (class=[^ ]+ )*id=viewer|^SECTION.*id=viewer/);
  await done(page);
});
t("S065/S062: picking a project in Files, and going back, keep focus in Files", async () => {
  const page = await app({ files: { "a.js": FILE() } });
  await page.evaluate(() => window.__t.go("ws"));
  await page.locator("[data-stage-toggle]").filter({ visible: true }).first().click();
  await page.waitForFunction(() => !document.querySelector("#stage").hidden);
  await filesOpen(page);
  const pick = page.locator('[data-fl-pick="demo"]').filter({ visible: true }).first();
  await pick.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const a1 = await active(page);
  assert.ok(a1 && !/^BODY/.test(a1) && /data-fl-/.test(a1), `after picking: ${a1}`);
  await page.locator("[data-fl-unpick]").filter({ visible: true }).first().focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  assert.match(await active(page), /data-fl-pick=demo/, "back on the project it came from");
  await done(page);
});
t("S061: while Try again is reading, focus stays in the tree", async () => {
  let answer;
  const page = await app({ files: { "a.js": FILE() }, treeFails: 1, treeGate: new Promise((ok) => (answer = ok)) });
  await panelOpen(page);
  await filesOpen(page);
  await page.locator('[data-fl-dir="bad"]').filter({ visible: true }).first().click();
  const retry = page.locator('[data-fl-retry="bad"]').first();
  await retry.waitFor();
  await retry.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400); // the read is out, unanswered; the app redraws meanwhile (Files with it)
  await page.evaluate(() => window.__t.render());
  await page.waitForTimeout(200);
  const pending = await active(page);
  assert.ok(pending && !/^BODY/.test(pending), `pending: ${pending}`);
  answer();
  await page.locator('[data-fl-file="bad/inside.md"]').first().waitFor();
  const after = await active(page);
  assert.ok(after && !/^BODY/.test(after), `after: ${after}`);
  await done(page);
});

t("C029: on a phone, Back to chat from a file shows the chat, not the panel again", async () => {
  if (WIDTH > 760) return; // beside the chat on a desktop, the panel coming back is the design
  const page = await app({ files: { "a.js": FILE() } });
  await panelOpen(page);
  if (await page.locator('[data-ghost="changes"]').filter({ visible: true }).count()) await page.locator('[data-ghost="changes"]').filter({ visible: true }).first().click();
  await page.locator("[data-open-files]").filter({ visible: true }).first().click();
  await page.locator('[data-fl-file="a.js"]').filter({ visible: true }).first().click();
  await page.locator("[data-fv-min]").filter({ visible: true }).first().click();
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(() => document.querySelector("#stage").hidden), "the panel stays closed");
  assert.ok(await page.locator("#say").isVisible(), "the chat's box is there to type in");
  await done(page);
});

// ── overlays: one opening while Create (a native modal) is still closing gets the focus ──
t("C020: Create, Esc, Ctrl+K at once: Jump's field has focus", async () => {
  const page = await app({}, { motion: true });
  await page.locator(".create, [data-create]").filter({ visible: true }).first().click();
  await page.locator("#cp-desc").focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(500);
  assert.ok(await page.locator("#jump").isVisible(), "Jump is open");
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "jump-q");
  await page.keyboard.type("dem");
  assert.equal(await page.locator("#jump-q").inputValue(), "dem", "typing lands in Jump");
  await done(page);
});

// ── hops: the Workspace coordinator's receipt and the chat's history read, in either order ──
async function hopRace(receiptFirst) {
  let release;
  const gate = new Promise((ok) => (release = ok));
  const hop = { id: "race-ask", seq: 5, chat_id: "chat_demo", thread_ts: null, kind: "ask", from_role: "project-coordinator", to_role: "workspace-coordinator", state: "sent", created_at: NOW };
  const W = { hops: async (r, chatId, json) => { if (chatId !== "chat_demo") return json({ hops: [] }); await gate; return json({ hops: [{ ...hop }], next_after_seq: null, next_before_seq: null }); } };
  const page = await app(W);
  await page.evaluate(() => window.__storm.stop());
  if (!receiptFirst) await page.evaluate((h) => window.__storm.apply({ type: "hop", envelope: { seq: 5, chat_id: "chat_demo", ts: new Date().toISOString(), data: h } }), hop);
  await toDemo(page);
  await page.waitForTimeout(150); // the history read is out
  await page.evaluate(() => window.__storm.apply({ type: "hop", envelope: { seq: 99, chat_id: "chat_demo", ts: new Date().toISOString(), data: { id: "race-ask", state: "answered" } } }));
  release();
  await page.waitForTimeout(400);
  const got = await page.evaluate(() => { window.__t.typingRender(); return { state: window.__t.world.state.hops.get("race-ask")?.state, line: document.querySelector("#typing")?.innerText || "" }; });
  assert.equal(got.state, "answered");
  assert.ok(!/Waiting for the Workspace coordinator/.test(got.line), `no false Waiting: "${got.line}"`);
  await done(page);
}
t("G5: a receipt during a history read that left before it stays answered", () => hopRace(false));
t("G5: a receipt that came before its hop was known still counts once the history arrives", () => hopRace(true));

// ── Launchpad: a stop is said only once Space confirms it ──
t("G6: a refused stop keeps the run, says why and offers Stop again; a confirmed one says stopped", async () => {
  let refuse = true;
  const calls = [];
  const W = { launchpad: "building", onDeploy: (r, m, p) => {
    // once Space has stopped it, its check no longer says a deploy is running
    if (/\/api\/deploy\/[^/]+\/check$/.test(p) && calls.length && !refuse) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(LP.ready.check) });
    if (/\/api\/deploy\/[^/]+$/.test(p) && m === "DELETE") { calls.push(m); return refuse ? r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: { code: "fixture_offline", message: "Fixture offline" } }) }) : r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stopped: true, run_id: "r1" }) }); }
    return r.fallback();
  } };
  const page = await app(W);
  await toDemo(page);
  await page.locator("[data-lp-open]").click();
  await page.locator("[data-lp=stop]").click();
  await page.waitForTimeout(3400);
  assert.deepEqual(calls, ["DELETE"]);
  assert.equal(await page.locator(".lp").getAttribute("data-screen"), "run", "still following the run");
  assert.match(await page.locator(".lp").innerText(), /Couldn't stop it: Fixture offline/);
  assert.match(await page.locator("#live").innerText(), /Couldn't stop the deploy/);
  assert.equal((await page.locator("[data-lp=stop]").innerText()).trim(), "Stop again");
  refuse = false;
  await page.locator("[data-lp=stop]").click();
  await page.waitForTimeout(3400);
  assert.deepEqual(calls, ["DELETE", "DELETE"]);
  assert.notEqual(await page.locator(".lp").getAttribute("data-screen"), "run", "the run is over");
  assert.match(await page.locator("#live").innerText(), /Deploy stopped/);
  await done(page);
});

const lpJson = (r, o, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(o) });
t("G6: a stop answered 200 without stopped:true is not a stop", async () => {
  const W = { launchpad: "building", onDeploy: (r, m, p) => (/\/api\/deploy\/[^/]+$/.test(p) && m === "DELETE" ? lpJson(r, {}) : r.fallback()) };
  const page = await app(W);
  await toDemo(page);
  await page.locator("[data-lp-open]").click();
  await page.locator("[data-lp=stop]").click();
  await page.waitForTimeout(3400);
  assert.equal(await page.locator(".lp").getAttribute("data-screen"), "run");
  assert.doesNotMatch(await page.locator("#live").innerText(), /Deploy stopped/);
  assert.match(await page.locator(".lp").innerText(), /Couldn't stop it: Space didn't confirm it/);
  await done(page);
});
t("G6: a run that goes live while its stop is pending stays live; the late refusal says nothing", async () => {
  let answer;
  const late = new Promise((ok) => (answer = ok));
  const at = new Date().toISOString();
  SSE.head = [{ type: "run", ts: at, run_id: "r1", kind: "deploy", attached: true, started_at: at }, { type: "step", ts: at, step: "push", title: "push", status: "done", message: "", elapsed: 3 }, { type: "step", ts: at, step: "build", title: "build", status: "running", message: "Building on GitHub Actions", elapsed: 0 }];
  const W = { launchpad: "building", onDeploy: async (r, m, p) => {
    if (/\/api\/deploy\/[^/]+\/watch$/.test(p)) return r.continue({ url: BASE + "/__sse" });
    if (/\/api\/deploy\/[^/]+$/.test(p) && m === "DELETE") { await late; return lpJson(r, { detail: { code: "fixture_offline", message: "Fixture offline" } }, 503); }
    return r.fallback();
  } };
  const page = await app(W);
  await toDemo(page);
  await page.locator("[data-lp-open]").click();
  await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "run");
  await page.locator("[data-lp=stop]").click();
  await page.waitForTimeout(3300); // the DELETE is out, unanswered
  SSE.push({ type: "done", ts: new Date().toISOString(), url: "https://demo.example", http_status: 200, app: { id: "app_7f3a", name: "demo", slug: "demo" }, repo: "o/demo", branch: "main", commit: "cd6096efbe28", release: 4, created: false }, true);
  await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "live");
  answer();
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".lp").getAttribute("data-screen"), "live");
  assert.doesNotMatch(await page.locator("#live").innerText(), /Couldn't stop|still running|Deploy stopped/);
  SSE.head = [];
  await done(page);
});

// ── Home's next move: the same protection as a decision card ──
async function homeAsk(page, question = false) {
  await page.evaluate((question) => {
    const t = window.__t;
    for (const name of ["reply", "decide", "decideItem", "resolve"]) t.world.act[name] = async () => ({});
    t.world.state.threads = [{ id: "home-local", title: "A local task", project: "demo", live: false, busy: false, state: "needs_approval", messages: [], happened: "Test only", lastAt: Date.now(), checklist: { total: 1, done: 0, items: [{ text: "Step", state: "todo" }] },
      asks: [{ id: "home-ask", title: "A local choice", kind: question ? "question" : "approval", risk: "routine", detail: "Test only", ...(question ? { options: ["First", "Second"] } : {}) }] }];
    t.go("home"); t.render();
  }, question);
  await page.locator("#hm-next .next").waitFor();
}
const homeDecided = (page) => page.evaluate(() => window.__t.D.decisions().map((d) => d.choice));
t("Home: Allow and an option can't decide in the ask's first 300 ms; after, they do", async () => {
  for (const q of [false, true]) {
    const page = await app();
    await homeAsk(page, q);
    await page.evaluate((q) => document.querySelector(q ? "[data-nx-opt]" : "[data-nx-allow]").click(), q);
    assert.deepEqual(await homeDecided(page), [], "nothing at once");
    await page.waitForTimeout(350);
    await page.evaluate((q) => document.querySelector(q ? "[data-nx-opt]" : "[data-nx-allow]").click(), q);
    assert.equal((await homeDecided(page)).length, 1, "decided once read");
    await page.evaluate(() => window.__t.D.undo());
    await done(page);
  }
});
t("Home: a held key (repeat) never decides", async () => {
  for (const q of [false, true]) {
    const page = await app();
    await homeAsk(page, q);
    await page.waitForTimeout(350);
    await page.locator("#hm-next .next").focus();
    await page.evaluate((q) => document.querySelector("#hm-next .next").dispatchEvent(new KeyboardEvent("keydown", { key: q ? "1" : "a", repeat: true, bubbles: true, cancelable: true })), q);
    assert.deepEqual(await homeDecided(page), [], "a repeat decided nothing");
    await done(page);
  }
});
t("Home: Enter while a word is being composed in the note doesn't send it back", async () => {
  const page = await app();
  await homeAsk(page);
  await page.waitForTimeout(350);
  await page.locator("[data-nx-back]").click();
  await page.locator("#nx-note-in").fill("unfinished compos");
  await page.locator("#nx-note-in").dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, bubbles: true });
  assert.deepEqual(await homeDecided(page), [], "composition Enter decided nothing");
  await page.locator("#nx-note-in").press("Enter");
  assert.deepEqual(await homeDecided(page), ["deny"], "a real Enter sends it back");
  await page.evaluate(() => window.__t.D.undo());
  await done(page);
});

// ── decisions (js/decide.js on its own, with a local world: no app, no API) ──
async function decisions(kind = "approval", count = 1) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/\/js\/(app|msgx|skeleton)\.js$/, (r) => r.abort());
  await page.route("**/api/**", (r) => r.fulfill({ status: 403, contentType: "application/json", body: '{"error":"test_only"}' }));
  await page.goto(BASE + "/");
  await page.evaluate(async ({ kind, count }) => {
    const { createDecisions } = await import("./js/decide.js");
    const calls = [];
    const threads = Array.from({ length: count }, (_, i) => ({ id: "t-" + i, title: "Task " + i, project: "demo", state: kind === "stopped" ? "failed" : "needs_approval", happened: "Test only", checklist: { total: 1, done: 0, items: [{ text: "Step", state: "todo" }] }, messages: [],
      asks: kind === "stopped" ? [] : [{ id: "ask-" + i, kind: kind === "question" ? "question" : "approval", title: "Choice " + i, risk: "routine", detail: "A local test.", ...(kind === "question" ? { options: ["First", "Second"] } : {}) }] }));
    const act = Object.fromEntries(["reply", "decide", "decideItem", "resolve"].map((name) => [name, async (...args) => { calls.push({ name, args }); return {}; }]));
    const world = { state: { threads, hosts: [] }, act };
    const P = { classify: (ns) => ns.forEach((n) => (n.admitted = true)), reviewStart() {}, reviewStop() {}, tired: () => false, reviewMin: () => 0, keepGoing() {}, rested() {}, bringIn() {} };
    const D = createDecisions({ world, P, PROJ: () => "Demo", announce: () => {}, render: () => {}, later: new Set(), waitSince: new Map() });
    window.d = { D, world, decided: () => D.decisions().map((x) => x.key) };
    D.open();
  }, { kind, count });
  page.errors = errors;
  return page;
}
const key = (page, k, o = {}) => page.evaluate(({ k, o }) => document.querySelector("#card").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...o })), { k, o });
const decided = (page) => page.evaluate(() => window.d.decided());

for (const [kind, sel] of [["approval", "[data-act=allow]"], ["stopped", "[data-act=retry]"], ["question", '[data-opt="0"]']]) {
  t(`G1: a fresh ${kind} card can't be decided in its first 300 ms (${sel})`, async () => {
    const page = await decisions(kind);
    await page.evaluate((s) => document.querySelector(s).click(), sel);
    assert.deepEqual(await decided(page), [], "nothing decided at once");
    await page.waitForTimeout(360);
    await page.evaluate((s) => document.querySelector(s).click(), sel);
    assert.equal((await decided(page)).length, 1, "decided once the card is read");
    await ctxDone(page);
  });
}
t("G1: holding A (key repeats) decides only the card the first press was for", async () => {
  const page = await decisions("approval", 3);
  await page.waitForTimeout(360);
  await key(page, "a");
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(80); await key(page, "a", { repeat: true }); }
  assert.deepEqual(await decided(page), ["ask-0|Choice 0"]);
  await ctxDone(page);
});
t("G2: a card withdrawn while you type its note hands over with the next card's keys paused", async () => {
  const page = await decisions("approval", 2);
  await page.locator("[data-act=back]").click();
  await page.locator(".c-note-in").fill("a word still being typ");
  await page.evaluate(() => { window.d.world.state.threads.shift(); window.d.D.sync(); });
  await page.waitForTimeout(500);
  await key(page, "a");
  assert.deepEqual(await decided(page), [], "the letter didn't decide the next card");
  assert.match(await page.locator("#card .c-hint").innerText(), /keys are paused/);
  // Esc is the deliberate reset: then A decides it
  await key(page, "Escape");
  await key(page, "a");
  assert.deepEqual(await decided(page), ["ask-1|Choice 1"]);
  await ctxDone(page);
});
async function ctxDone(page) { const errs = page.errors; await page.context().close(); assert.deepEqual(errs, [], "page errors"); }

(async () => {
  server = await serve();
  BASE = `http://127.0.0.1:${server.address().port}`;
  browser = await launch(chromium);
  if (!browser) { console.error("not run: no Chromium would start"); server.close(); process.exit(2); }
  const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
  // the app's flows at a desktop and a phone width; the decision module's on its own once
  for (const width of [1440, 390]) {
    WIDTH = width;
    for (const { name, fn } of tests) {
      if (only && !only.test(name)) continue;
      if (width !== 1440 && /^G[12]:/.test(name)) continue;
      const label = `${name} [${width}]`;
      try { await fn(); passed++; console.log("  ok  " + label); }
      catch (e) { failed++; console.error("  FAIL " + label + "\n" + (e.stack || e)); }
    }
  }
  await browser.close(); server.close();
  console.log(`${passed} passed${failed ? `, ${failed} failed` : ""}`);
  process.exitCode = failed ? 1 : 0;
})();
