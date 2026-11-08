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
const H = require("./harness.cjs");
const { SSE, serve, NOW, openApp, launch, LP } = H;

let browser, server, BASE, WIDTH = 1440, passed = 0, failed = 0, skipped = 0;
const tests = [];
const t = (name, fn) => tests.push({ name, fn });
// a case that doesn't apply at this width says so, and is counted as skipped, never as passed (Files/Map grader)
class Skip extends Error {}
const skip = (why) => { throw new Skip(why); };
// the project's own page, as its row in the sidebar opens it (on a phone the sidebar is a drawer)
const toDemo = (page) => page.evaluate(() => window.__t.go("p:demo"));
// theme: "dark" (the harness default) or "light" (Files/Map grader on 453de55: it was dropped here, so the light
// cases ran dark); every case that names a theme checks below that it got it
const app = async (W = {}, { width = WIDTH, motion = false, theme = "dark" } = {}) => {
  const page = await openApp(browser, BASE, W, { width, motion, theme });
  const got = await page.evaluate(() => document.documentElement.dataset.theme || "dark");
  assert.equal(got, theme, `the page is in the ${theme} theme`);
  return page;
};
// a test ends with no page errors and with focus never having fallen to the page (harness.cjs records each drop)
// strict, as Settings' (a821fe1): a record that's missing or can't be read fails the case, never reads as clean
// (Astra on 453de55: a failed read counted as no drops, and an environment flag could skip the check)
const done = async (page) => {
  const errs = page.errors;
  let drops, unread = null;
  try { drops = await page.evaluate(() => window.__focusDrops); } catch (e) { unread = e; }
  await page.context().close();
  if (unread) throw new Error(`the focus-drop record couldn't be read: ${unread.message}`);
  assert.deepEqual(errs, [], "page errors");
  assert.ok(Array.isArray(drops), "the harness's focus-drop record is there (window.__focusDrops)");
  assert.deepEqual(drops, [], "focus fell to the page when its control went");
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
    await new Promise((ok) => setTimeout(ok, 0)); // the blur is judged (deliberate) before anything is removed
    // a focused checkbox takes the new HTML's checked (a refused toggle shows the saved state again)
    box.innerHTML = `<label><input type="checkbox" data-rtd-allowed="codex" checked> Codex</label>`;
    const cb = box.querySelector("input"); cb.focus(); cb.checked = false; // Space unticked it; the save was refused
    redraw(box, `<label><input type="checkbox" data-rtd-allowed="codex" checked> Codex</label><p role="alert">Not saved</p>`);
    const box2 = { same: document.activeElement === cb, checked: cb.checked };
    cb.blur(); await new Promise((ok) => setTimeout(ok, 0));
    box.remove();
    return { kept, text, busy, gone, p, field, later, box2 };
  });
  assert.deepEqual(r, { kept: true, text: "Revoking b…", busy: "true", gone: true, p: "New words", field: { same: true, value: "typing on", caret: 3, cls: "is-bad" }, later: "server again", box2: { same: true, checked: true } });
  await done(page);
});

t("the test-time check records a focused control that's removed (and not one blurred on purpose)", async () => {
  const page = await app();
  const drops = await page.evaluate(async () => {
    const b = document.createElement("button"); b.textContent = "Gone"; b.setAttribute("data-probe", "x"); document.body.append(b);
    b.focus(); b.remove();
    await new Promise((ok) => setTimeout(ok, 50));
    const c = document.createElement("button"); c.textContent = "Kept"; document.body.append(c);
    c.focus(); c.blur(); await new Promise((ok) => setTimeout(ok, 0)); c.remove();
    await new Promise((ok) => setTimeout(ok, 50));
    const d = window.__focusDrops.slice(); window.__focusDrops.length = 0; return d;
  });
  assert.equal(drops.length, 1);
  assert.match(drops[0], /data-probe=x/);
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
t("S136/S137: in the light theme the Saved notice's Undo and Tell answer the pointer", async () => {
  const page = await app({ files: { "a.js": FILE() } }, { theme: "light" });
  await editing(page);
  await typeAll(page, "mine\n");
  await page.keyboard.press("ControlOrMeta+s");
  await page.waitForFunction(() => !window.__ED.on);
  for (const sel of ["[data-vw-undo]", "[data-vw-tell]"]) {
    const b = page.locator(sel).first();
    const rest = await b.evaluate((e) => getComputedStyle(e).backgroundImage + getComputedStyle(e).backgroundColor);
    await b.hover();
    const over = await b.evaluate((e) => getComputedStyle(e).backgroundImage + getComputedStyle(e).backgroundColor);
    assert.notEqual(over, rest, `${sel} answers hover`);
  }
  await page.mouse.move(2, 2);
  await done(page);
});
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
  await page.waitForTimeout(150);
  assert.match(await page.locator(".fl-tree").innerText(), /Reading again/, "it says it's reading again at once");
  assert.equal(await page.locator('[data-fl-retry="bad"]').first().getAttribute("aria-busy"), "true");
  await page.waitForTimeout(250); // the read is out, unanswered; the app redraws meanwhile (Files with it)
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

t("S061: the project's top failing, then reading empty: Try again lands on New file", async () => {
  let answer;
  // the top fails for every reader until the test says (the panel's map reads it too, and may read it first)
  const page = await app({ files: {}, rootFails: 99 });
  await panelOpen(page);
  await filesOpen(page);
  const retry = page.locator('[data-fl-retry=""]').first();
  await retry.waitFor();
  page.W.rootFails = 0; page.W.rootEmpty = true; page.W.rootGate = new Promise((ok) => (answer = ok));
  await retry.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  assert.match(await page.locator(".fl-tree").innerText(), /Reading again/);
  answer();
  await page.waitForTimeout(400);
  assert.match(await active(page), /data-fl-new/);
  await done(page);
});

t("C036: the tree toggle beside a file keeps focus as it folds and unfolds", async () => {
  if (WIDTH < 600) skip("the toggle shows beside a file on a desktop");
  const page = await app({ files: { "a.js": FILE() } });
  await panelOpen(page);
  await filesOpen(page);
  await page.locator('[data-fl-file="a.js"]').filter({ visible: true }).first().click();
  const tog = page.locator("[data-fv-tree]").filter({ visible: true }).first();
  await tog.waitFor();
  await tog.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  assert.match(await active(page), /data-fv-tree/);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  assert.match(await active(page), /data-fv-tree/);
  await done(page);
});

t("C034: Files' divider takes the pointer at its line, over the file beside it too", async () => {
  if (WIDTH < 600) skip("side by side on a desktop only");
  const page = await app({ files: { "a.js": FILE() } });
  await panelOpen(page);
  await filesOpen(page);
  await page.locator('[data-fl-file="a.js"]').filter({ visible: true }).first().click();
  // beside the chat the tree may fold for the file: unfolded, the divider is between them
  await page.waitForTimeout(300);
  if (await page.locator(".fv .fl.is-folded").count()) await page.locator("[data-fv-tree]").filter({ visible: true }).first().click();
  const sp = page.locator(".fv .fl.is-wide .fl-split").first();
  await sp.waitFor();
  const hit = await sp.evaluate((e) => { const r = e.getBoundingClientRect(), y = r.top + r.height / 2; return [-3, 3].map((dx) => document.elementFromPoint(r.left + dx, y) === e); });
  assert.deepEqual(hit, [true, true], "3 px either side of the line is the divider's");
  await done(page);
});
t("C031: a New file started while the last one is being made keeps its row, what's typed in it, and focus", async () => {
  let answer;
  const page = await app({ files: { "a.js": FILE() }, saveGate: new Promise((ok) => (answer = ok)) });
  await panelOpen(page);
  await filesOpen(page);
  const nb = page.locator("[data-fl-new]").filter({ visible: true }).first();
  await nb.click();
  await page.keyboard.insertText("first.md");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("[data-fl-name]")?.readOnly === true);
  await nb.click();
  await page.waitForFunction(() => { const i = document.querySelector("[data-fl-name]"); return i && !i.readOnly && document.activeElement === i; });
  await page.keyboard.insertText("sec");
  answer();
  await page.locator('[data-fl-file="first.md"]').filter({ visible: true }).first().waitFor();
  await page.waitForTimeout(200);
  const st = await page.evaluate(() => { const i = document.querySelector("[data-fl-name]"); return { value: i && i.value, focused: !!i && document.activeElement === i }; });
  assert.deepEqual(st, { value: "sec", focused: true }, "the newer row stays, with what's typed in it");
  await done(page);
});
t("C031: a New file started while the last one's folder is read again keeps its row; the last file isn't opened over it", async () => {
  let answer;
  const page = await app({ files: { "a.js": FILE() } });
  await panelOpen(page);
  await filesOpen(page);
  const nb = page.locator("[data-fl-new]").filter({ visible: true }).first();
  await nb.click();
  await page.keyboard.insertText("first.md");
  page.W.rootGate = new Promise((ok) => (answer = ok)); // the save answers; the folder's read after it waits
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector("[data-fl-name]")); // made: its row has gone
  await nb.click();
  await page.waitForFunction(() => { const i = document.querySelector("[data-fl-name]"); return i && document.activeElement === i; });
  await page.keyboard.insertText("sec");
  answer(); page.W.rootGate = null;
  await page.locator('[data-fl-file="first.md"]').filter({ visible: true }).first().waitFor();
  await page.waitForTimeout(250);
  const st = await page.evaluate(() => { const i = document.querySelector("[data-fl-name]"); return { value: i && i.value, focused: !!i && document.activeElement === i, opened: window.__t.VW.isOpen && window.__t.VW.file?.rel === "first.md" }; });
  assert.deepEqual(st, { value: "sec", focused: true, opened: false });
  await done(page);
});
t("S208: the map's Follow says on and off as it's pressed", async () => {
  const page = await app();
  await panelOpen(page);
  if (await page.locator('[data-ghost="map"]').filter({ visible: true }).count()) await page.locator('[data-ghost="map"]').filter({ visible: true }).first().click();
  await page.locator("#stage-map-tree").waitFor();
  await page.evaluate(() => document.querySelector("#stage-map-tree").click());
  const f = page.locator('[data-dg="follow"]').filter({ visible: true }).first();
  await f.waitFor();
  const was = await f.getAttribute("aria-pressed");
  await f.click();
  assert.equal(await f.getAttribute("aria-pressed"), String(was !== "true"), "pressed once");
  await f.click();
  assert.equal(await f.getAttribute("aria-pressed"), was, "pressed again");
  await done(page);
});
t("S121: a part opened from the folded panel's rail takes focus, on its own fold button", async () => {
  if (WIDTH < 600) skip("the rail is a desktop's");
  // the rail shows where the panel shares the screen with Files beside no conversation: opened in a project,
  // carried to Home, Files opened from it, at a width where the reader would get under 520 px
  const page = await app({ files: { "a.js": FILE() } });
  await page.setViewportSize({ width: 1180, height: 900 });
  await panelOpen(page);
  await page.evaluate(() => window.__t.go("home"));
  await filesOpen(page);
  await page.waitForFunction(() => document.body.classList.contains("stage-rail"), null, { timeout: 4000 });
  const r = page.locator('[data-rail="changes"]').filter({ visible: true }).first();
  await r.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.body.classList.contains("stage-rail"));
  assert.match(await active(page), /data-fr-fold=changes/, "on the part's own fold button, not the page");
  await done(page);
});
const PATCH = (f, a, b) => `diff --git a/${f} b/${f}\n--- a/${f}\n+++ b/${f}\n@@ -1,3 +1,3 @@\n-${a}\n+${b}\n two\n three\n`;
t("C085/C086: another changed file picked: the last diff goes at once; Open in Files opens the one picked", async () => {
  let answer;
  const page = await app({ files: { "a.js": FILE(), "b.js": FILE() }, changesGate: new Promise((ok) => (answer = ok)), changes: [
    { path: "a.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: PATCH("a.js", "one", "ONE") },
    { path: "b.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: null, patch_omitted: "response_budget", full: PATCH("b.js", "one", "UNO") }] });
  await panelOpen(page);
  if (await page.locator('[data-ghost="changes"]').filter({ visible: true }).count()) await page.locator('[data-ghost="changes"]').filter({ visible: true }).first().click();
  await page.locator('[data-cx="a.js"]').filter({ visible: true }).first().click();
  // a.js's diff is drawn
  await page.waitForFunction(() => { const d = document.querySelector(".cx-pd"); return d && !d.hidden && d.childElementCount > 0; });
  await page.locator('[data-cx="b.js"]').filter({ visible: true }).first().click();
  await page.waitForFunction(() => document.querySelector(".cx-pp")?.textContent === "b.js"); // the next draw
  const st = await page.evaluate(() => ({ diff: document.querySelector(".cx-pd").hidden, note: document.querySelector(".cx-note").hidden ? null : document.querySelector(".cx-note").textContent, head: document.querySelector(".cx-pp").textContent }));
  assert.deepEqual(st, { diff: true, note: "Reading its change…", head: "b.js" }, "a.js's diff gone while b.js is read");
  await page.locator("[data-cx-open]").filter({ visible: true }).first().click();
  await page.waitForFunction(() => window.__t.VW.file);
  assert.equal(await page.evaluate(() => window.__t.VW.file.rel || window.__t.VW.file.path), "b.js", "Open in Files opens b.js, the file picked");
  answer();
  await done(page);
});
t("C085: A, then B while it's read, then A again: A's diff shows again", async () => {
  let answer;
  const page = await app({ files: { "a.js": FILE(), "b.js": FILE() }, changesGate: new Promise((ok) => (answer = ok)), changes: [
    { path: "a.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: PATCH("a.js", "one", "ONE") },
    { path: "b.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: null, patch_omitted: "response_budget", full: PATCH("b.js", "one", "UNO") }] });
  await panelOpen(page);
  if (await page.locator('[data-ghost="changes"]').filter({ visible: true }).count()) await page.locator('[data-ghost="changes"]').filter({ visible: true }).first().click();
  await page.locator('[data-cx="a.js"]').filter({ visible: true }).first().click();
  await page.waitForFunction(() => { const d = document.querySelector(".cx-pd"); return d && !d.hidden && d.childElementCount > 0; });
  await page.locator('[data-cx="b.js"]').filter({ visible: true }).first().click();
  await page.waitForFunction(() => document.querySelector(".cx-pp")?.textContent === "b.js");
  await page.locator('[data-cx="a.js"]').filter({ visible: true }).first().click();
  await page.waitForFunction(() => document.querySelector(".cx-pp")?.textContent === "a.js");
  await page.waitForTimeout(200);
  const st = await page.evaluate(() => ({ diff: !document.querySelector(".cx-pd").hidden, note: document.querySelector(".cx-note").hidden ? null : document.querySelector(".cx-note").textContent }));
  assert.deepEqual(st, { diff: true, note: null }, "a.js's diff is back, no Reading note");
  answer();
  await done(page);
});
t("C085: an image's change, then another file while it's read: the image goes at once", async () => {
  let answer;
  const svg = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "favicon.svg"), "utf8");
  const page = await app({ files: { "b.js": FILE() }, pictures: svg, changesGate: new Promise((ok) => (answer = ok)), changes: [
    { path: "pic.png", status: "modified", additions: 0, deletions: 0, binary: true, version: "sha256:P", patch: null, patch_omitted: "binary" },
    { path: "b.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: null, patch_omitted: "response_budget", full: PATCH("b.js", "one", "UNO") }] });
  await panelOpen(page);
  if (await page.locator('[data-ghost="changes"]').filter({ visible: true }).count()) await page.locator('[data-ghost="changes"]').filter({ visible: true }).first().click();
  await page.locator('[data-cx="pic.png"]').filter({ visible: true }).first().click();
  await page.waitForFunction(() => { const m = document.querySelector(".cx-im"); return m && !m.hidden; });
  await page.locator('[data-cx="b.js"]').filter({ visible: true }).first().click();
  await page.waitForFunction(() => document.querySelector(".cx-pp")?.textContent === "b.js");
  assert.equal(await page.evaluate(() => document.querySelector(".cx-im").hidden), true, "the image went with its pick");
  await page.locator('[data-cx="pic.png"]').filter({ visible: true }).first().click();
  await page.waitForFunction(() => document.querySelector(".cx-pp")?.textContent === "pic.png");
  await page.waitForFunction(() => !document.querySelector(".cx-im").hidden, null, { timeout: 3000 });
  answer();
  await done(page);
});
t("S139: a file whose renderer failed, tried again, shows the file and not the old error beside it", async () => {
  let once = true;
  const page = await app({ files: { "a.js": FILE() } });
  // the renderer's library fails to load once (a dropped connection), then loads
  await page.route("**/js/vendor/pierre-diffs/diffs.js", (r) => { if (once) { once = false; return r.abort(); } return r.fallback(); });
  await toDemo(page);
  await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "a.js", path: "a.js", name: "a.js" }));
  const retry = page.locator("#viewer [data-vw-retry]");
  await retry.waitFor();
  await retry.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#viewer .vw-file diffs-container"), null, { timeout: 15000 });
  await page.waitForTimeout(200);
  assert.equal(await page.locator("#viewer .vw-file .vw-empty").count(), 0, "the old error and its Try again went");
  await done(page);
});
const MADE = () => [
  { id: "mk1", name: "notes.md", path: "notes.md", relative_path: "notes.md", project_id: "demo", mime: "text/markdown", bytes: 10, created_at: NOW, updated_at: NOW },
  { id: "mk2", kind: "link", url: "https://example.com/report", name: "report", created_at: NOW, updated_at: NOW },
];
t("C013: on a phone, Artifacts is a list of rows (the name gets the width), pictures stay pictures under Images", async () => {
  if (WIDTH >= 600) skip("a phone's layout");
  const long = "quarterly-research-findings-for-the-board-final-draft.md";
  const made = [
    { id: "r1", name: long, path: long, relative_path: long, project_id: "demo", mime: "text/markdown", bytes: 10, created_at: NOW, updated_at: NOW },
    { id: "r2", name: "notes.md", path: "notes.md", relative_path: "notes.md", project_id: "demo", mime: "text/markdown", bytes: 10, created_at: NOW, updated_at: NOW },
    { id: "r3", name: "shot.png", path: "shot.png", relative_path: "shot.png", project_id: "demo", mime: "image/png", bytes: 10, created_at: NOW, updated_at: NOW },
  ];
  const page = await app({ made });
  await page.evaluate(() => window.__t.go("artifacts"));
  await page.locator('#arts-body .md-it[data-k="r1"]').waitFor();
  const m = await page.evaluate(() => {
    const it = (k) => document.querySelector(`#arts-body .md-it[data-k="${k}"]`);
    const r = (e) => e.getBoundingClientRect();
    const a = it("r1"), b = it("r2");
    return { w: r(a).width, h: [r(a).height, r(b).height], name: r(a.querySelector(".md-meta b")).width, nameLines: Math.round(r(a.querySelector(".md-meta b")).height / 20), pin: r(a.querySelector(".md-pin")).width, pinOverOpen: r(a.querySelector(".md-pin")).left < r(a.querySelector(".md-open")).right - 1, over: document.documentElement.scrollWidth > innerWidth };
  });
  assert.ok(m.w > 300, `one row across (${m.w})`);
  assert.equal(m.h[0], m.h[1], "every row one height");
  assert.ok(m.name >= 220, `the name has the width (${m.name})`);
  assert.ok(m.nameLines <= 2);
  assert.equal(m.pin, 44, "the pin is its own 44 px target");
  assert.equal(m.pinOverOpen, false, "the pin never covers the file's button");
  assert.equal(m.over, false, "nothing overflows");
  await page.locator('#arts-f [data-arts-kind="image"]').click();
  await page.waitForFunction(() => document.querySelector("#arts").classList.contains("is-pics"));
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#arts-body .ar-grid")).gridTemplateColumns.split(" ").length), 2, "pictures as pictures");
  await done(page);
});
t("C065: Artifacts' kinds: arrows choose, one Tab stop, focus stays on the kind chosen", async () => {
  const page = await app({ made: MADE() });
  await page.evaluate(() => window.__t.go("artifacts"));
  const on = page.locator('#arts-f [role=radio][aria-checked="true"]');
  await page.locator('#arts-f [data-arts-kind="link"]').waitFor();
  await on.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  assert.match(await active(page), /data-arts-kind=(?!all)/, "on the next kind");
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-checked")), "true", "and it's chosen");
  assert.equal(await page.locator('#arts-f [role=radio]:not([tabindex="-1"])').count(), 1, "one Tab stop");
  await done(page);
});
t("H13: pinning a card in Artifacts moves it to Pinned once, with focus on its pin", async () => {
  const page = await app({ made: MADE() });
  await page.evaluate(() => window.__t.go("artifacts"));
  const pin = page.locator('#arts-body .md-it[data-k="mk1"] .md-pin');
  await pin.waitFor();
  await pin.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('#arts-body .md-it[data-k="mk1"] .md-pin')?.getAttribute("aria-pressed") === "true");
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#arts-body .md-it[data-k="mk1"]').count(), 1, "one card, no stale copy left in Today");
  assert.match(await active(page), /md-pin/);
  assert.equal(await page.evaluate(() => document.activeElement.closest(".md-it")?.dataset.k), "mk1");
  await done(page);
});
t("H20/S144: a refused clone Stop keeps focus on Stop, ready to try again", async () => {
  const page = await app({ cloneStopMode: "503" });
  await openCreate(page);
  await page.locator('#cp-mode [data-mode="clone"]').click();
  await page.locator("#cp-repo").fill("owner/repo");
  await page.locator("#cp-name").fill("cloned");
  await page.locator("#cp-submit").click();
  const st = page.locator("#cp-stop");
  await st.waitFor({ state: "visible" });
  await st.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#cp-stop").getAttribute("aria-busy") !== "true" && /Couldn't stop it/.test(document.querySelector("#create-dlg").textContent));
  assert.match(await active(page), /id=cp-stop/);
  assert.equal(await st.getAttribute("aria-disabled"), null, "usable again");
  assert.equal(page.W.cloneStops, 1);
  await done(page);
});

t("C091: an Edit that couldn't open says it was opening, then hands focus back to Edit", async () => {
  let answer;
  const page = await app({ files: { "a.js": FILE() }, editReadFails: 1, editGate: new Promise((ok) => (answer = ok)) });
  await toDemo(page);
  await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "a.js", path: "a.js", name: "a.js" }));
  const ed = page.locator("[data-vw-edit]");
  await ed.waitFor();
  await ed.focus();
  await page.keyboard.press("Enter");
  // it says it's opening at every width (a phone shows the icon only: the spinner takes the pencil's place)
  await page.waitForFunction(() => { const b = document.querySelector("[data-vw-edit]"); return b && b.getAttribute("aria-label") === "Opening for editing" && b.querySelector(".spin")?.getClientRects().length; });
  answer();
  await page.waitForFunction(() => { const b = document.querySelector("[data-vw-edit]"); return b && !b.disabled; });
  await page.waitForTimeout(150);
  assert.match(await active(page), /data-vw-edit/, "back on Edit, to try again");
  await done(page);
});
t("C092/S126: Download from ⋯ keeps focus on ⋯ while it downloads and once it's done", async () => {
  let answer;
  const page = await app({ files: { "a.js": FILE() }, downloadGate: new Promise((ok) => (answer = ok)) });
  await toDemo(page);
  await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "a.js", path: "a.js", name: "a.js" }));
  const more = page.locator("[data-vw-more]");
  await more.waitFor();
  await more.focus();
  await page.keyboard.press("Enter");
  await page.locator(".vw-menu [data-vw-download]").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("[data-vw-more]")?.getAttribute("aria-busy") === "true");
  assert.match(await active(page), /data-vw-more/, "on ⋯ while it downloads");
  await page.keyboard.press("Enter"); // pressed again meanwhile: nothing opens, nothing is asked twice
  assert.equal(await page.locator(".vw-menu").count(), 0);
  answer();
  await page.waitForFunction(() => { const b = document.querySelector("[data-vw-more]"); return b && !b.hasAttribute("aria-busy"); });
  assert.match(await active(page), /data-vw-more/, "and once it's done");
  assert.equal(page.W.downloads, 1);
  await done(page);
});
t("S232: a merge choice hands focus to the next place to choose, then to Save", async () => {
  const base = "one\ntwo\nthree\nfour\nfive\nsix\nseven\n";
  const page = await app({ files: { "a.js": { content: base, version: "sha256:A" } }, saveMode: "overlap", agentText: "AGENT1\ntwo\nthree\nfour\nfive\nsix\nAGENT7\n" });
  await editing(page);
  await typeAll(page, "MINE1\ntwo\nthree\nfour\nfive\nsix\nMINE7\n");
  await page.locator("[data-vw-saveit]").click();
  await page.waitForFunction(() => window.__ED.conflict && window.__ED.conflict.left === 2);
  const first = page.locator(".xd-mbtn").first();
  await first.waitFor();
  await first.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__ED.conflict.left === 1);
  await page.waitForFunction(() => document.activeElement?.classList.contains("xd-merge"), null, { timeout: 3000 });
  await page.keyboard.press("Tab"); // the place's choices are one Tab in
  assert.match(await page.evaluate(() => document.activeElement.className), /xd-mbtn/);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__ED.conflict.left === 0);
  await page.waitForFunction(() => document.activeElement?.hasAttribute("data-vw-saveit"), null, { timeout: 3000 });
  await done(page);
});
t("S082: a file opened from the map takes focus (on a phone the panel steps aside for it)", async () => {
  const page = await app({ files: { "a.js": FILE() } });
  await panelOpen(page);
  if (await page.locator('[data-ghost="map"]').filter({ visible: true }).count()) await page.locator('[data-ghost="map"]').filter({ visible: true }).first().click();
  await page.locator("#stage-map-tree").waitFor();
  await page.evaluate(() => document.querySelector("#stage-map-tree").click());
  const n = page.locator('[data-node="a.js"]').filter({ visible: true }).first();
  await n.waitFor();
  await n.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__t.VW.isOpen);
  await page.waitForTimeout(250);
  assert.match(await active(page), /id=viewer/);
  await done(page);
});

t("RUN-7/S102: Runs Close goes back to its opener even when that was drawn again meanwhile", async () => {
  const W = { runs: { "ses-a": { runs: [run("ra", "Alpha's helper")], counts: { running: 1 } } } };
  const page = await app(W);
  await toDemo(page);
  // an opener, as a run's line in a message is; it's focused when Runs opens from it
  await page.evaluate(() => { const b = document.createElement("button"); b.type = "button"; b.dataset.run = "ra"; b.textContent = "Alpha's helper"; document.body.appendChild(b); b.focus(); return window.__t.openRuns({ sessionId: "ses-a", title: "Thread A" }); });
  await page.locator("#runs [data-close]").first().waitFor();
  // while Runs is open, the conversation is drawn again: the opener is a new node with the same hook
  await page.evaluate(() => { const old = document.querySelector('body > [data-run="ra"]'); old.replaceWith(old.cloneNode(true)); });
  await page.locator("#runs [data-close]").first().focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#runs").hidden);
  assert.match(await active(page), /data-run=ra/, "on the opener drawn now, not the page");
  await done(page);
});
t("H29: with Settings open, a file dragged over the page isn't taken by the hidden composer", async () => {
  const page = await app();
  await toDemo(page);
  const drag = (sel, end) => page.evaluate(({ sel, end }) => {
    const dt = new DataTransfer(); dt.items.add(new File(["hello"], "audit.txt", { type: "text/plain" }));
    const at = document.querySelector(sel);
    at.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
    const veil = !document.querySelector("#drop-veil").hidden;
    at.dispatchEvent(new DragEvent(end, { bubbles: true, cancelable: true, dataTransfer: dt }));
    return veil;
  }, { sel, end });
  // in reach, the composer takes it (the veil says so); a drag that ends goes nowhere
  assert.equal(await drag("#main", "dragend"), true, "the composer in reach takes a drag");
  await page.evaluate(() => document.querySelector("#set-side").click());
  await page.waitForFunction(() => !document.querySelector("#settings").hidden);
  assert.equal(await drag("#settings", "drop"), false, "no veil over Settings");
  await page.waitForTimeout(200);
  assert.equal(await page.locator("#att-tray > *").count(), 0, "nothing was attached to the hidden message");
  await done(page);
});
t("C052: a code block's Copy answered out of order: only the newest says Copied, and its own timer resets it", async () => {
  const page = await app({ messages: MSG("Here is the command:\n\n```sh\nnpm test\n```\n") });
  await page.evaluate(() => { window.__cp = []; navigator.clipboard.writeText = () => new Promise((ok, no) => window.__cp.push({ ok, no })); document.execCommand = () => false; });
  await toDemo(page);
  const code = page.locator("#msgs [data-copy]").first();
  await code.waitFor();
  await code.focus();
  await page.keyboard.press("Enter"); // the first Copy, held
  await page.waitForTimeout(700);
  await page.keyboard.press("Enter"); // the second, held
  await page.waitForFunction(() => window.__cp.length === 2);
  await page.evaluate(() => window.__cp[1].ok()); // the newer answers first
  await page.waitForFunction(() => document.querySelector("#msgs [data-copy]").textContent === "Copied");
  await page.evaluate(() => window.__cp[0].ok()); // then the older, late: it says nothing
  await page.waitForTimeout(900); // past the older one's 1400 ms, inside the newer one's
  assert.equal(await code.innerText(), "Copied", "the newer acknowledgement stands");
  await page.waitForFunction(() => document.querySelector("#msgs [data-copy]").textContent === "Copy", null, { timeout: 3000 });
  // a refusal clears the check at once
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__cp.length === 3);
  await page.evaluate(() => window.__cp[2].no(new Error("denied")));
  await page.waitForTimeout(200);
  assert.equal(await code.innerText(), "Copy");
  await done(page);
});
t("C052: what a code block's Copy says is its own: a success then a newer refusal never says Copied after it", async () => {
  const page = await app({ messages: MSG("Here is the command:\n\n```sh\nnpm test\n```\n") });
  await toDemo(page);
  await page.locator("#msgs [data-copy]").first().waitFor();
  const seen = await page.evaluate(async () => {
    const b = document.querySelector("#msgs [data-copy]"), live = document.querySelector("#live"), q = [];
    navigator.clipboard.writeText = () => new Promise((ok, no) => q.push({ ok, no }));
    document.execCommand = () => false;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), t0 = performance.now(), at = (ms) => wait(Math.max(0, t0 + ms - performance.now()));
    b.click(); q[0].ok();             // the first Copy: success at 0
    await at(5); b.click();           // a second Copy
    await at(20); q[1].no(new Error("denied")); // refused at 20
    const out = [];
    await at(40); out.push(live.textContent);
    await at(60); out.push(live.textContent);
    await at(120); out.push(live.textContent, b.textContent);
    return out;
  });
  assert.ok(!seen.slice(0, 3).includes("Copied the code."), `never "Copied" after the newer refusal: ${JSON.stringify(seen)}`);
  assert.match(seen[2], /^Couldn't copy/, "the refusal is what's said");
  assert.equal(seen[3], "Copy", "and the check is cleared");
  await done(page);
});
t("DEC-NOTE-LOSS/S167: a Send back that failed keeps its note for the next try", async () => {
  const page = await decisions("approval", 1);
  await page.evaluate(() => { const no = async () => { throw Object.assign(new Error("Fixture unavailable"), { status: 503, code: "unavailable" }); }; window.d.world.act.decide = no; window.d.world.act.reply = no; });
  await page.waitForTimeout(400); // the card's read beat
  await page.locator("[data-act=back]").first().click();
  const n = page.locator(".c-note-in").first();
  await n.waitFor();
  await n.fill("Do not lose these local words");
  await n.press("Enter");
  // the commit window, then the refusal: the ask comes back to decide again
  await page.waitForFunction(() => window.d.decided().length === 1); // queued, its Undo window open
  await page.waitForFunction(() => window.d.decided().length === 0, null, { timeout: 9000 }); // sent, refused
  // the panel closed with its last card decided; the refused ask is back in the list: opened again, as you would
  await page.evaluate(() => { if (!window.d.D.isOpen()) window.d.D.open(); else window.d.D.sync(); });
  await page.locator("[data-act=back]").first().waitFor();
  await page.waitForTimeout(400); // the card's read beat again
  await page.locator("[data-act=back]").first().click();
  await n.waitFor();
  assert.equal(await page.locator(".c-note-in").first().inputValue(), "Do not lose these local words");
  await ctxDone(page);
});
t("S201/S202: the lightbox's end arrow keeps focus at the end", async () => {
  const page = await app();
  await toDemo(page);
  await page.evaluate(async () => {
    const { mediaItem, mediaHtml } = await import("./js/media.js");
    const { createLightbox } = await import("./js/lightbox.js");
    const items = ["a", "b", "c"].map((k) => mediaItem({ key: "t:" + k, name: k + ".svg", type: "image/svg+xml", src: "/favicon.svg", w: 64, h: 64 }));
    const root = document.createElement("div"); root.id = "lbx-test"; root.innerHTML = mediaHtml(items); document.body.appendChild(root);
    const LB = createLightbox({});
    LB.open("t:a", root.querySelector('[data-mx="t:a"]'), root);
  });
  const next = page.locator('[data-lbx="next"]').filter({ visible: true }).first();
  await next.waitFor();
  await next.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // the last picture
  await page.waitForFunction(() => document.querySelector('[data-lbx="next"]')?.getAttribute("aria-disabled") === "true");
  assert.match(await active(page), /data-lbx=next/, "still on the arrow");
  await page.keyboard.press("Enter"); // no further
  assert.match(await page.locator(".lbx-count").first().innerText(), /3 of 3/);
  await page.keyboard.press("ArrowLeft");
  assert.match(await page.locator(".lbx-count").first().innerText(), /2 of 3/);
  // and the other end: Previous, pressed to the first picture, keeps focus there
  const prev = page.locator('[data-lbx="prev"]').filter({ visible: true }).first();
  await prev.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('[data-lbx="prev"]')?.getAttribute("aria-disabled") === "true");
  assert.match(await active(page), /data-lbx=prev/, "still on Previous at the first picture");
  await page.keyboard.press("Enter");
  assert.match(await page.locator(".lbx-count").first().innerText(), /1 of 3/);
  await done(page);
});
t("S063: a changed file opened from Files' Changed takes focus", async () => {
  const page = await app({ files: { "a.js": FILE() }, changes: [{ path: "a.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: PATCH("a.js", "one", "ONE") }] });
  await panelOpen(page);
  await filesOpen(page);
  const row = page.locator('[data-fl-change="a.js"]').filter({ visible: true }).first();
  await row.waitFor();
  await row.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__t.VW.isOpen);
  await page.waitForTimeout(250);
  assert.match(await active(page), /id=viewer/);
  await done(page);
});
const deepActive = (page) => page.evaluate(() => { let a = document.activeElement; while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; return { editable: !!a?.isContentEditable, inViewer: !!document.activeElement?.closest?.("#viewer") }; });
t("EDITOR-close: the find bar's Escape and Close put you back at your caret, still editing", async () => {
  const page = await app({ files: { "a.js": FILE() } });
  await editing(page);
  await page.locator("#viewer [contenteditable=true]").first().click();
  for (const how of ["Escape", "Close"]) {
    await page.keyboard.press("ControlOrMeta+f");
    const q = page.locator("[data-search-grid] [data-search]").first();
    await q.waitFor();
    await q.focus();
    await page.keyboard.insertText("two");
    if (how === "Escape") await page.keyboard.press("Escape");
    else { await page.locator("[data-search-close]").first().focus(); await page.keyboard.press("Enter"); }
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => !!(window.__ED && window.__ED.on)), true, `${how}: still editing`);
    assert.deepEqual(await deepActive(page), { editable: true, inViewer: true }, `${how}: back at the caret`);
  }
  await done(page);
});
t("EDITOR-regex: a pattern that isn't a valid regexp says so", async () => {
  const page = await app({ files: { "a.js": FILE() } });
  await editing(page);
  await page.locator("#viewer [contenteditable=true]").first().click();
  await page.keyboard.press("ControlOrMeta+f");
  const q = page.locator("[data-search-grid] [data-search]").first();
  await q.waitFor();
  await page.locator('[data-search-grid] [aria-label="Regexp"]').first().click();
  await q.focus();
  await page.keyboard.insertText("[");
  await page.waitForTimeout(150);
  assert.equal(await page.locator("[data-search-grid] [data-matches]").first().innerText(), "Not a valid pattern");
  assert.equal(await q.getAttribute("aria-invalid"), "true");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText("t.o");
  await page.waitForTimeout(150);
  assert.equal(await q.getAttribute("aria-invalid"), "false", "a valid one is fine again");
  await done(page);
});

// ── the picker: Astra's d88441d findings (D884-SAVE-1..3, D884-SIMPLE-1, MIG-1..3) ──
t("D884-SAVE-3: the first Done says it's saving at once: busy, its words, focus kept", async () => {
  let answer;
  const W = {};
  const page = await app(W);
  await picker(page);
  await page.locator('#iq-pop [data-dmodel="sonnet"]').click();
  W.patchGate = new Promise((ok) => (answer = ok));
  await page.locator("#iq-pop [data-ldone]").focus();
  await page.keyboard.press("Enter");
  const b = page.locator("#iq-pop [data-ldone]");
  assert.equal(await b.getAttribute("aria-busy"), "true", "busy from the first press");
  assert.equal(await b.getAttribute("aria-disabled"), "true");
  assert.equal((await b.innerText()).trim(), "Saving…");
  assert.match(await active(page), /data-ldone/);
  answer();
  await page.waitForFunction(() => document.querySelector("#iq-pop").hidden || document.querySelector("#iq-pop").classList.contains("is-out"));
  assert.equal(W.patches, 1);
  await done(page);
});
t("D884-SAVE-1: while Done saves, the choice on screen is the one being saved and can't change", async () => {
  let answer;
  const W = {};
  const page = await app(W);
  await picker(page);
  await page.locator('#iq-pop [data-dmodel="sonnet"]').click();
  await page.locator('#iq-pop [data-deffort="low"]').click();
  W.patchGate = new Promise((ok) => (answer = ok));
  await page.locator("#iq-pop [data-ldone]").click();
  // every way to change it while it saves: a click, Space on another model, an arrow on the depth, Done again
  await page.evaluate(() => document.querySelector('#iq-pop [data-dmodel="opus"]').click());
  await page.locator('#iq-pop [data-dmodel="opus"]').focus();
  await page.keyboard.press(" ");
  await page.locator('#iq-pop [data-deffort="low"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.evaluate(() => document.querySelector("#iq-pop [data-ldone]").click());
  const st = await page.evaluate(() => ({
    model: document.querySelector('#iq-pop [data-dmodel][aria-checked="true"]')?.dataset.dmodel,
    effort: document.querySelector('#iq-pop [data-deffort][aria-checked="true"]')?.dataset.deffort,
    waits: document.querySelector('#iq-pop [data-dmodel="opus"]').getAttribute("aria-disabled"),
  }));
  assert.deepEqual(st, { model: "sonnet", effort: "low", waits: "true" }, "what's on screen is what's being sent");
  assert.match(await active(page), /data-deffort=low/, "focus stays where it was");
  answer();
  await page.waitForFunction(() => document.querySelector("#iq-pop").hidden || document.querySelector("#iq-pop").classList.contains("is-out"));
  assert.equal(W.patches, 1, "one request");
  assert.deepEqual(W.patchBodies[0], { model: "sonnet", effort: "low" });
  await done(page);
});
t("D884-SAVE-2: an earlier Done's success doesn't close a newer opening or take its choice", async () => {
  let answer;
  const W = {};
  const page = await app(W);
  await picker(page);
  await page.locator('#iq-pop [data-dmodel="sonnet"]').click();
  await page.locator('#iq-pop [data-deffort="low"]').click();
  W.patchGate = new Promise((ok) => (answer = ok));
  await page.locator("#iq-pop [data-ldone]").click();
  await page.keyboard.press("Escape"); // put away while it saves
  await page.locator("#iq").filter({ visible: true }).first().click();
  await page.locator('#iq-pop [data-dmodel="opus"]').waitFor();
  await page.locator('#iq-pop [data-dmodel="opus"]').click();
  await page.locator('#iq-pop [data-deffort="high"]').click();
  answer(); // the earlier save answers
  await page.waitForTimeout(400);
  assert.ok(await page.locator("#iq-pop").isVisible(), "the newer opening stays open");
  assert.equal(await page.locator('#iq-pop [data-dmodel="opus"]').getAttribute("aria-checked"), "true", "with its own choice");
  assert.equal(await page.locator('#iq-pop [data-deffort="high"]').getAttribute("aria-checked"), "true");
  W.patchGate = null;
  await page.locator("#iq-pop [data-ldone]").click();
  await page.waitForFunction(() => document.querySelector("#iq-pop").hidden || document.querySelector("#iq-pop").classList.contains("is-out"));
  assert.deepEqual(W.patchBodies, [{ model: "sonnet", effort: "low" }, { model: "opus", effort: "high" }], "each opening's choice, in order");
  await done(page);
});
t("D884-SIMPLE-1: the simple picker's catalog arriving keeps you on the choice you're on", async () => {
  let answer;
  const W = {};
  const page = await app(W);
  await page.evaluate(() => localStorage.setItem("cv-shape-device", JSON.stringify({ shape: 1, surfaces: { "xo:composer/intel": { mode: "simple" } } })));
  await page.reload();
  await page.waitForSelector('[data-go="p:demo"]', { state: "attached", timeout: 30000 });
  await toDemo(page);
  const chip = page.locator("#iq").filter({ visible: true }).first();
  await chip.click();
  await page.locator('#iq-pop [data-lsimple="deep"]:not([aria-disabled="true"])').waitFor(); // read once: cached
  await page.keyboard.press("Escape");
  W.modelsGate = new Promise((ok) => (answer = ok)); // the next opening's fresh read waits
  await chip.click();
  const deep = page.locator('#iq-pop [data-lsimple="deep"]:not([aria-disabled="true"])');
  await deep.waitFor();
  await deep.focus();
  answer();
  await page.waitForTimeout(400);
  assert.match(await active(page), /data-lsimple=deep/);
  await page.keyboard.press("Escape");
  await done(page);
});

// ── continuing a thread on another runtime (the picker opened on Codex, as the thread menu opens it) ──
const RT = (name, dflt) => ({ name, default: dflt, health: { agent: name, usable: true, why_not: null, installed: true, logged_in: true, account: "acct-test", cli_version: "1.0", pool: `${name}:acct-test`, limit: "open", resets_at: null, windows: {}, error: null, checked_at: NOW }, cli: { version: "1.0", logged_in: true, account: "acct-test", limits: {} }, features: { agent: name, cli_version: "1.0", contract_version: "1.0", features: { model: { support: "native", values: [] }, effort: { support: "native", values: [] } } } });
const CODEX = (list) => ({ name: "codex", models: list.map(([id, efforts]) => ({ id, name: id, efforts, default_effort: null, context_window: null, is_default: false, takes_effort: true, family: null, family_default: false, description: "" })) });
async function movePicker(W) {
  W.runtimes = [RT("claude_code", true), RT("codex", false)];
  const page = await app(W);
  await toDemo(page);
  await page.evaluate(() => {
    const t = window.__t;
    t.world.state.threads = [{ id: "mig", chatId: "chat_demo", title: "A local task", project: "demo", state: "idle", live: false, busy: false, messages: [], lastAt: Date.now(), happened: "Test only",
      session: { agent: "claude_code", model: "opus", effort: "low" }, pin: {}, checklist: { total: 0, done: 0, items: [] }, asks: [] }];
    t.IQ.open("t:mig", document.querySelector("#iq"), { rt: "codex" });
  });
  return page;
}
t("MIG-1: while it moves, the model and depth it's moving with can't change", async () => {
  let answer;
  const W = { modelsFor: (name) => (name === "codex" ? CODEX([["codex-a", ["low", "high"]], ["codex-b", ["low", "max"]]]) : null) };
  const page = await movePicker(W);
  await page.locator('#iq-pop [data-mvm="codex-a"]').click();
  await page.locator('#iq-pop [data-mvp="low"]').waitFor();
  W.continueGate = new Promise((ok) => (answer = ok));
  await page.locator("#iq-pop [data-mv-go]").click();
  await page.waitForFunction(() => document.querySelector("#iq-pop [data-mv-go]")?.getAttribute("aria-busy") === "true");
  // try to change it while it moves: a click on another model, Space on it, a click on another depth
  await page.evaluate(() => document.querySelector('#iq-pop [data-mvm="codex-b"]').click());
  await page.locator('#iq-pop [data-mvm="codex-b"]').focus();
  await page.keyboard.press(" ");
  await page.evaluate(() => document.querySelector('#iq-pop [data-mvp="high"]').click());
  const st = await page.evaluate(() => ({ model: document.querySelector('#iq-pop [data-mvm][aria-checked="true"]')?.dataset.mvm, effort: document.querySelector('#iq-pop [data-mvp][aria-checked="true"]')?.dataset.mvp, says: document.querySelector("#iq-pop .iq-now").textContent }));
  assert.equal(st.model, "codex-a");
  assert.equal(st.effort, "low");
  assert.match(st.says, /codex-a · Quick/, "the promise on screen is what's sent");
  answer(); // refused: still busy
  await page.waitForFunction(() => document.querySelector("#iq-pop [data-mv-go]")?.getAttribute("aria-busy") !== "true");
  assert.deepEqual(W.continues.map((b) => [b.model, b.effort]), [["codex-a", "low"]]);
  assert.match(await page.locator("#iq-pop .iq-now").innerText(), /codex-a · Quick/, "and it still says what was sent");
  await done(page);
});
t("MIG-2: choosing a depth, and Continue, keep focus where you are", async () => {
  let answer;
  const W = { modelsFor: (name) => (name === "codex" ? CODEX([["codex-a", ["low", "medium", "high"]]]) : null) };
  const page = await movePicker(W);
  await page.locator('#iq-pop [data-mvm="codex-a"]').click();
  const hi = page.locator('#iq-pop [data-mvp="high"]');
  await hi.focus();
  await page.keyboard.press("Enter");
  assert.equal(await hi.getAttribute("aria-checked"), "true");
  assert.match(await active(page), /data-mvp=high/, "Enter on a depth");
  await page.locator('#iq-pop [data-mvp="low"]').click();
  assert.match(await active(page), /data-mvp=low/, "a click on a depth");
  W.continueGate = new Promise((ok) => (answer = ok));
  await page.locator("#iq-pop [data-mv-go]").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#iq-pop [data-mv-go]")?.getAttribute("aria-busy") === "true");
  assert.match(await active(page), /data-mv-go/, "on Continue while it moves");
  answer();
  await page.waitForFunction(() => document.querySelector("#iq-pop [data-mv-go]")?.getAttribute("aria-busy") !== "true");
  assert.match(await active(page), /data-mv-go/, "and on Try again after");
  await done(page);
});
t("MIG-3: a cancelled read of the same runtime's models doesn't replace a newer one", async () => {
  const gates = [];
  const W = { modelsFor: (name) => {
    if (name !== "codex") return null;
    const n = gates.length;
    let open; const g = new Promise((ok) => (open = ok)); gates.push(open);
    return g.then(() => (n === 0 ? CODEX([["codex-old", ["low"]]]) : CODEX([["codex-new", ["low", "high"]]])));
  } };
  const page = await movePicker(W); // the first read of Codex's models is out
  await page.waitForFunction(() => document.querySelector("#iq-pop [data-mv-cancel]"));
  await page.locator("#iq-pop [data-mv-cancel]").click();
  await page.locator('#iq-pop [data-lrt="codex"]').click(); // look again: a second read
  await page.waitForFunction(() => document.querySelector("#iq-pop [data-mv-cancel]"));
  while (gates.length < 2) await page.waitForTimeout(50);
  gates[1](); // the newer read answers first
  await page.locator('#iq-pop [data-mvm="codex-new"]').click();
  await page.locator('#iq-pop [data-mvp="high"]').click();
  gates[0](); // then the cancelled one
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({ rows: [...document.querySelectorAll("#iq-pop [data-mvm]")].map((r) => r.dataset.mvm), model: document.querySelector('#iq-pop [data-mvm][aria-checked="true"]')?.dataset.mvm, effort: document.querySelector('#iq-pop [data-mvp][aria-checked="true"]')?.dataset.mvp }));
  assert.deepEqual(st, { rows: ["codex-new"], model: "codex-new", effort: "high" }, "the newer list and the choice in it stay");
  assert.match(await active(page), /data-mvp=high/);
  // and the list kept for next time is the newer one
  await page.locator("#iq-pop [data-mv-cancel]").click();
  await page.locator('#iq-pop [data-lrt="codex"]').click();
  await page.locator('#iq-pop [data-mvm="codex-new"]').waitFor();
  assert.equal(await page.locator('#iq-pop [data-mvm="codex-old"]').count(), 0);
  await done(page);
});

t("RUN-5: a notice's Undo you're on, when its time is up, hands focus on, never to the page", async () => {
  const page = await app();
  await toDemo(page);
  await page.evaluate(() => window.__t.heraldShow({ kind: "halt", tag: "test", text: "Stopping", sub: "A local test", undo: () => {} }, 1200));
  const u = page.locator("#herald [data-herald-undo]");
  await u.waitFor();
  await u.focus();
  await page.waitForFunction(() => !document.querySelector("#herald [data-herald-undo]"), null, { timeout: 5000 });
  await page.waitForTimeout(100);
  assert.match(await active(page), /id=say/, "on the message box (the notice named nothing it acts on)");
  await done(page);
});

t("Herald: Undo and Retry hand focus to what the notice acts on before its line goes", async () => {
  const page = await app();
  await toDemo(page);
  await page.evaluate(() => { const b = document.createElement("button"); b.type = "button"; b.dataset.resolve = "t-x"; b.textContent = "Resolve"; document.body.appendChild(b); });
  for (const label of ["Undo", "Retry"]) {
    await page.evaluate((label) => window.__t.heraldShow({ kind: "stopped", text: "Couldn't resolve it", sub: "A local test", back: ['[data-resolve="t-x"]'], undo: () => {}, undoLabel: label === "Retry" ? "Retry" : undefined }, 6000), label);
    const u = page.locator("#herald [data-herald-undo]");
    await u.waitFor();
    await u.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.querySelector("#herald [data-herald-undo]"));
    assert.match(await active(page), /data-resolve=t-x/, `${label}: on Resolve`);
  }
  await done(page);
});

t("C023: a panel covering the page keeps Tab out of what it covers; the open panel's opener answers hover", async () => {
  const page = await app();
  await panelOpen(page);
  const under = () => page.evaluate(() => [...document.querySelector("#main").children].filter((c) => !c.classList.contains("stage") && !c.classList.contains("toast-wrap")).map((c) => c.inert));
  if (WIDTH < 600) {
    assert.ok((await under()).every(Boolean), "everything under the phone's panel is out of reach");
    await page.locator("[data-stg-close]").filter({ visible: true }).first().focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#stage").hidden);
    assert.equal(await page.evaluate(() => document.querySelectorAll("#main [data-stage-inert]").length), 0, "in reach again once it closes");
  } else {
    assert.ok(!(await under()).some(Boolean), "beside the chat it covers nothing");
    const b = page.locator(".stg-btn.is-on").filter({ visible: true }).first();
    const rest = await b.evaluate((e) => getComputedStyle(e).backgroundColor);
    await b.hover();
    await page.waitForTimeout(250);
    assert.notEqual(await b.evaluate((e) => getComputedStyle(e).backgroundColor), rest, "the selected opener answers hover");
    await page.mouse.move(2, 2);
  }
  await done(page);
});
// a thread as the server lists it (its row survives the world's own refreshes, and its page loads as a thread's does)
const serverThread = (ts, sid, extra = {}) => ({ ts, chat_id: "chat_demo", title: "A local task", session_id: sid, cwd: "/home/test/demo", state: "idle", created_at: NOW, updated_at: NOW, ...extra });
/** A turn fed to the app's own turn store as the stream feeds it; finished unless running. */
const feedTurn = (page, { id, sid, rows, running = false, n = 1 }) => page.evaluate(({ id, sid, rows, running, n }) => {
  const at = new Date().toISOString(), tid = `tu-${id}-${n}`, s0 = n * 10;
  const f = (type, seq, data) => ({ type, envelope: { type, turn_id: tid, session_id: sid, chat_id: "chat_demo", thread_ts: id, seq, ts: at, data } });
  window.__storm.apply(f("turn.started", s0 + 1, {}));
  window.__storm.apply(f("block.finished", s0 + 2, { block: { id: `b-${tid}`, type: "activity", rows } }));
  if (!running) window.__storm.apply(f("turn.finished", s0 + 3, { status: "finished" }));
  window.__t.render();
}, { id, sid, rows, running, n });
/** Go to a listed thread and wait for its page to be in (a thread draws nothing before it is). */
async function toThread(page, ts) {
  await page.waitForFunction((ts) => window.__t.world.state.threads.some((x) => x.id === ts), ts, { timeout: 15000 });
  await page.evaluate((ts) => window.__t.go(`t:${ts}`), ts);
  await page.waitForFunction((ts) => window.__t.world.state.threads.find((x) => x.id === ts)?.loaded, ts, { timeout: 15000 });
}
// the real turn chip, through the real conversation: the thread as the server lists it, its finished turn fed to
// the app's own turn store as the stream feeds it, drawn in #msgs by the conversation (and redrawn by it, chosen);
// opened with the keyboard by the page's own handler, through the thread's route (Files/Map grader: mounted
// outside #msgs, the redraw wasn't part of the case). W needs TT (below) among its threads.
const TT = () => ({ chat_demo: [serverThread("tt1", "ses-tt")] });
async function turnChip(page) {
  await toThread(page, "tt1");
  await feedTurn(page, { id: "tt1", sid: "ses-tt", rows: [{ call_id: "c1", kind: "edit_file", status: "ok", target: "a.js" }] });
  const chip = page.locator('#msgs .tb-cf[data-file="a.js"]').first();
  await chip.waitFor({ timeout: 15000 });
  assert.equal(await chip.getAttribute("data-file-bytes"), null, "the real chip has no size");
  return chip;
}
t("S224: a turn's file chip whose file changed opens its diff (the panel's Changes; Files on a phone), focus on it", async () => {
  const page = await app({ files: { "a.js": FILE() }, threadsBy: TT(), changes: [{ path: "a.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: PATCH("a.js", "one", "ONE") }] });
  await toDemo(page);
  const chip = await turnChip(page);
  await page.waitForTimeout(400); // the place's changes are read
  await chip.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  assert.match(await active(page), /data-cx=a\.js|id=viewer/, "on the change: its row in the panel, or the file on a phone");
  await done(page);
});
for (const variant of ["read", "held", "refused"]) {
  t(`S224: a turn's file chip opens with the keyboard (${variant}): no "NaN", and the file takes focus`, async () => {
    let answer;
    const W = { files: variant === "refused" ? {} : { "a.js": FILE() }, threadsBy: TT() };
    if (variant === "held") W.fileGate = new Promise((ok) => (answer = ok));
    const page = await app(W);
    await toDemo(page);
    const chip = await turnChip(page);
    await chip.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__t.VW.isOpen);
    await page.waitForTimeout(300);
    assert.match(await active(page), /id=viewer/, "on the file while it's read, or says it couldn't be");
    assert.doesNotMatch(await page.locator("#viewer .vw-top").first().innerText(), /NaN/);
    if (variant === "held") {
      answer();
      await page.waitForTimeout(400);
      assert.match(await active(page), /id=viewer/, "still on the file once it's read");
      assert.doesNotMatch(await page.locator("#viewer .vw-top").first().innerText(), /NaN/);
    }
    if (variant === "refused") assert.match(await page.locator("#viewer").innerText(), /isn't there any more/, "it says so");
    await done(page);
  });
}
t("S207/S082: Fit shows every box; no box's target reaches a neighbour's box (edges too); far out a press zooms in", async () => {
  const dirs = Array.from({ length: 40 }, (_, i) => `folder-${String(i).padStart(2, "0")}`);
  const page = await app({ files: { "a.js": FILE() }, dirs });
  await panelOpen(page);
  if (await page.locator('[data-ghost="map"]').filter({ visible: true }).count()) await page.locator('[data-ghost="map"]').filter({ visible: true }).first().click();
  await page.locator("#stage-map-tree").waitFor();
  await page.evaluate(() => document.querySelector("#stage-map-tree").click());
  await page.locator(".dg-world [data-node]").first().waitFor();
  // the top folder shows 14 and "N more": open them all (with the keyboard: it acts at any size)
  const more = page.locator(".dg-world .dg-n.k-more").first();
  if (await more.count()) { await more.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  await page.locator('[data-dg="fit"]').filter({ visible: true }).first().click();
  await page.waitForTimeout(500);
  const probe = () => page.evaluate(() => {
    const box = document.querySelector(".dg-world").parentElement.getBoundingClientRect();
    const nodes = [...document.querySelectorAll(".dg-world [data-node]")];
    const out = [], stolen = [], grown = [];
    const s = parseFloat(document.querySelector(".dg-world").style.getPropertyValue("--dg-s")) || 1;
    for (const n of nodes) {
      const b = n.getBoundingClientRect();
      if (b.left < box.left - 1 || b.right > box.right + 1 || b.top < box.top - 1 || b.bottom > box.bottom + 1) out.push(n.dataset.node);
      // the target's own reach, in the map's units: never more than 5 past the box (half the 10 between boxes), at
      // any scale; this holds exactly where a pixel probe can't (far out a box is 2 px and probes snap to pixels)
      const be = getComputedStyle(n, "::before");
      if (parseFloat(be.top) < -5.01 || parseFloat(be.bottom) < -5.01) grown.push(`${n.dataset.node} ${be.top}`);
      if (b.height < 8) continue; // below that, the pixel probe is meaningless (it snaps)
      // its middle and a point just inside each edge are its own, never a neighbour's target
      const pts = [[b.left + b.width / 2, b.top + b.height / 2], [b.left + b.width / 2, b.top + 0.5], [b.left + b.width / 2, b.bottom - 0.5], [b.left + 0.5, b.top + b.height / 2], [b.right - 0.5, b.top + b.height / 2]];
      for (const [x, y] of pts) {
        if (y < box.top || y > box.bottom - 44 || x < box.left || x > box.right) continue; // under the map's tools
        const hit = document.elementFromPoint(x, y), owner = hit && hit.closest("[data-node]");
        if (owner && owner !== n) { stolen.push(`${n.dataset.node} → ${owner.dataset.node}`); break; }
      }
    }
    return { n: nodes.length, out, stolen, grown, s };
  });
  const r = await probe();
  assert.ok(r.n >= 40, `every folder drawn (${r.n})`);
  assert.deepEqual(r.out, [], "every box inside the view after Fit");
  assert.deepEqual(r.grown, [], `at scale ${r.s.toFixed(3)} no target reaches more than half way to a neighbour`);
  assert.deepEqual(r.stolen, [], `at scale ${r.s.toFixed(3)} no target reaches a neighbour's box`);
  if (r.s < 24 / 42) {
    // too far out to press a box surely: a pointer press brings the map in to it, and doesn't act
    const n = page.locator('.dg-world [data-node="folder-20"]');
    const was = await n.getAttribute("class");
    await n.click();
    await page.waitForTimeout(500);
    const s2 = await page.evaluate(() => parseFloat(document.querySelector(".dg-world").style.getPropertyValue("--dg-s")) || 1);
    assert.ok(s2 >= 24 / 42, `zoomed in to a pressable size (${s2})`);
    assert.equal(await n.getAttribute("class"), was, "the folder didn't open on that press");
    const r2 = await probe();
    assert.deepEqual(r2.grown, [], `at scale ${r2.s.toFixed(3)} no target reaches more than half way to a neighbour`);
    assert.deepEqual(r2.stolen, [], `at scale ${r2.s.toFixed(3)} no target reaches a neighbour's box (edges probed)`);
  }
  await done(page);
});
t("H12: a made thing's age updates in place, and a name cut in the middle stays whole", async () => {
  const long = "a-very-long-report-name-that-is-cut-in-the-middle-final.md";
  const page = await app({ made: [{ id: "mk9", name: long, path: long, relative_path: long, project_id: "demo", mime: "text/markdown", bytes: 10, created_at: NOW, updated_at: NOW }] });
  await page.evaluate(() => window.__t.go("home"));
  const card = page.locator('#hm-made .md-it[data-k="mk9"]');
  await card.waitFor();
  const name0 = await card.locator(".md-meta b").innerText();
  await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 2 * 3600e3; window.__t.render(); });
  await page.waitForTimeout(200);
  assert.match(await card.locator(".md-meta > span").innerText(), /2h ago/, "its age moved on");
  assert.equal(await card.locator(".md-meta b").innerText(), name0, "its name is as it was");
  await done(page);
});

t("IME: a key of a word being composed is the field's: a composing Escape closes nothing, page-wide or in Jump", async () => {
  const page = await app();
  await toDemo(page);
  const esc = (sel) => page.evaluate((sel) => document.querySelector(sel).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", isComposing: true, keyCode: 229, bubbles: true, cancelable: true })), sel);
  await page.keyboard.press("ControlOrMeta+k");
  await page.locator("#jump").waitFor();
  await esc("#jump-q");
  assert.equal(await page.locator("#jump").isVisible(), true, "Jump stays open on a composing Escape");
  await page.keyboard.press("Escape"); // a plain one closes it
  await page.waitForFunction(() => document.querySelector("#jump").hidden);
  await done(page);
});

t("SRC-MAIN-CREATE-1: an earlier clone's late Stop refusal leaves a later clone's Stop as it is", async () => {
  let openA, openB;
  const W = { cloneStopMode: "503", cloneDone: new Set(), cloneStopGates: {} };
  const page = await app(W);
  const clone = async (repo, name) => {
    await openCreate(page);
    await page.locator('#cp-mode [data-mode="clone"]').click();
    await page.locator("#cp-repo").fill(repo);
    await page.locator("#cp-name").fill(name);
    await page.locator("#cp-submit").click();
    await page.locator("#cp-stop").waitFor({ state: "visible" });
  };
  await clone("owner/aaa", "clone-a");
  W.cloneStopGates["clone-1"] = new Promise((ok) => (openA = ok));
  await page.locator("#cp-stop").focus();
  await page.keyboard.press("Enter"); // A's Stop, held
  W.cloneDone.add("clone-1"); // A finishes meanwhile
  await page.waitForFunction(() => !document.querySelector("#create-dlg").open, null, { timeout: 8000 });
  await clone("owner/bbb", "clone-b");
  W.cloneStopGates["clone-2"] = new Promise((ok) => (openB = ok));
  await page.locator("#cp-stop").focus();
  await page.keyboard.press("Enter"); // B's Stop, held
  await page.waitForFunction(() => document.querySelector("#cp-stop").getAttribute("aria-busy") === "true");
  openA(); // A's refusal arrives late
  await page.waitForTimeout(400);
  assert.equal(await page.locator("#cp-stop").getAttribute("aria-busy"), "true", "B's Stop still says it's asking");
  assert.doesNotMatch(await page.locator("#create-dlg").innerText(), /clone-1/, "A's error isn't shown under B");
  openB();
  await page.waitForFunction(() => /Couldn't stop it/.test(document.querySelector("#create-dlg").textContent));
  await done(page);
});
t("SRC-MAIN-RUN-1/2: Runs opened again in the same thread: the old opening's list and run never land; cached rows say a refused read", async () => {
  let oldList, newList;
  const W = { runsGate: {}, runs: { "ses-a": { runs: [run("cur", "Current helper")], counts: { running: 1 } } } };
  const page = await app(W);
  W.runsGate["ses-a"] = new Promise((ok) => (oldList = ok));
  await page.evaluate(() => { window.__t.openRuns({ sessionId: "ses-a", title: "Thread A" }, "old-run"); });
  await page.waitForFunction(() => !document.querySelector("#runs").hidden);
  await page.keyboard.press("Escape");
  W.runsGate["ses-a"] = new Promise((ok) => (newList = ok));
  await page.evaluate(() => { window.__t.openRuns({ sessionId: "ses-a", title: "Thread A" }); });
  newList();
  await page.waitForFunction(() => /Current helper/.test(document.querySelector("#runs").innerText));
  W.runs["ses-a"] = { runs: [run("old-run", "Old helper")], counts: { running: 1 } };
  oldList(); // the old opening's list, late
  await page.waitForTimeout(500);
  const txt = await page.locator("#runs").innerText();
  assert.match(txt, /Current helper/, "this opening's rows");
  assert.doesNotMatch(txt, /Old helper/, "never the old opening's");
  assert.equal(await page.locator("#runs .rn-h #runs-h").count(), 1, "the list, not the old opening's run");
  // closed and opened again with a read that fails: the rows from before stay, and say the read failed
  await page.keyboard.press("Escape");
  W.runsGate = {}; W.runsFail = { "ses-a": true };
  await page.evaluate(() => { window.__t.openRuns({ sessionId: "ses-a", title: "Thread A" }); });
  await page.locator("#runs [data-runs-retry]").waitFor();
  assert.match(await page.locator("#runs").innerText(), /Couldn't read its sub-agents again/);
  await done(page);
});
t("S101: Stop all says what it does: all of them stop in 3 s, Undo in the sheet; Undo keeps them and focus goes back", async () => {
  const W = { runs: { "ses-a": { runs: [run("ra", "Alpha's helper"), run("rb", "Beta's helper")], counts: { running: 2 } } } };
  const page = await app(W);
  await page.evaluate(() => { window.__t.world.act.feature = () => true; return window.__t.openRuns({ sessionId: "ses-a", title: "Thread A" }); });
  const all = page.locator("#runs [data-runs-stop]");
  await all.waitFor();
  await all.focus();
  await page.keyboard.press("Enter");
  const undo = page.locator("#runs [data-runs-undo]").first();
  await undo.waitFor();
  assert.match(await page.locator("#runs .rn-stopping").first().innerText(), /every sub-agent/);
  await undo.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3600);
  assert.equal(W.runStops || 0, 0, "nothing was stopped");
  assert.match(await active(page), /data-runs-stop/, "back on Stop all");
  await done(page);
});
t("IME: a composing key in Jump, the Home note or a decision's note changes and closes nothing", async () => {
  const page = await app();
  await toDemo(page);
  const key = (sel, k) => page.evaluate(({ sel, k }) => document.querySelector(sel).dispatchEvent(new KeyboardEvent("keydown", { key: k, isComposing: k !== "Enter", keyCode: 229, bubbles: true, cancelable: true })), { sel, k });
  await page.keyboard.press("ControlOrMeta+k");
  await page.locator("#jump").waitFor();
  const sel0 = await page.evaluate(() => document.querySelector("#jump-list [aria-selected=\"true\"]")?.textContent);
  await key("#jump-q", "ArrowDown");
  assert.equal(await page.evaluate(() => document.querySelector("#jump-list [aria-selected=\"true\"]")?.textContent), sel0, "the selection didn't move");
  await key("#jump-q", "Escape");
  assert.equal(await page.locator("#jump").isVisible(), true, "Jump stays open");
  await page.keyboard.press("Escape");
  await done(page);
});
t("IME: a decision note's composing Enter (keyCode 229 only) and Escape neither send nor close", async () => {
  const page = await decisions("approval", 1);
  await page.waitForTimeout(400);
  await page.locator("[data-act=back]").first().click();
  const n = page.locator(".c-note-in").first();
  await n.waitFor();
  await n.fill("half a wor");
  for (const k of ["Enter", "Escape"]) await page.evaluate((k) => document.querySelector(".c-note-in").dispatchEvent(new KeyboardEvent("keydown", { key: k, keyCode: 229, isComposing: k === "Escape", bubbles: true, cancelable: true })), k);
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => window.d.decided()), [], "nothing was sent back");
  assert.equal(await page.evaluate(() => !document.querySelector(".c-note").hidden && window.d.D.isOpen()), true, "the note and the panel stay");
  await ctxDone(page);
});

t("SRC-IQ-QUEUE-1: a newer Auto, chosen while an earlier Done is still saving, goes after it, never before", async () => {
  let answer;
  const W = {};
  const page = await app(W);
  await page.evaluate(() => localStorage.setItem("cv-shape-device", JSON.stringify({ shape: 1, surfaces: { "xo:composer/intel": { mode: "simple" } } })));
  await page.reload();
  await page.waitForSelector('[data-go="p:demo"]', { state: "attached", timeout: 30000 });
  await toDemo(page);
  const chip = page.locator("#iq").filter({ visible: true }).first();
  // Deep first (so Auto is a change), then More options: Sonnet · low, Done, held
  await chip.click();
  await page.locator('#iq-pop [data-lsimple="deep"]:not([aria-disabled="true"])').click();
  await page.waitForFunction(() => document.querySelector("#iq-pop").hidden || document.querySelector("#iq-pop").classList.contains("is-out"));
  const p0 = W.patches || 0;
  await chip.click();
  await page.locator("#iq-pop [data-lfull]").click();
  await page.locator('#iq-pop [data-dmodel="sonnet"]').click();
  await page.locator('#iq-pop [data-deffort="low"]').click();
  W.patchGate = new Promise((ok) => (answer = ok));
  await page.locator("#iq-pop [data-ldone]").click();
  for (let i = 0; i < 60 && (W.patches || 0) <= p0; i++) await page.waitForTimeout(50); // Done's request is out
  await page.keyboard.press("Escape");
  await chip.click();
  await page.locator('#iq-pop [data-lsimple="auto"]').click(); // newer: Auto
  await page.waitForTimeout(300);
  assert.equal(W.patches, p0 + 1, "Auto waits for the Done still out");
  W.patchGate = null; answer();
  for (let i = 0; i < 60 && W.patches < p0 + 2; i++) await page.waitForTimeout(50);
  const last2 = W.patchBodies.slice(-2);
  assert.equal(last2[0].model, "sonnet", `Done's choice first: ${JSON.stringify(W.patchBodies)}`);
  assert.deepEqual(last2[1], { model: "default", effort: null }, "then Auto (the default model, its own effort)");
  await done(page);
});
t("H13: on a long phone list, pinning a card far below moves it to Pinned and focus goes with it", async () => {
  if (WIDTH >= 600) skip("the phone list (Astra's 100-row fixture)");
  const made = Array.from({ length: 100 }, (_, i) => ({ id: `k${i}`, name: `note-${String(i).padStart(3, "0")}.md`, path: `n${i}.md`, relative_path: `n${i}.md`, project_id: "demo", mime: "text/markdown", bytes: 10, created_at: new Date(Date.now() - i * 60e3).toISOString(), updated_at: new Date(Date.now() - i * 60e3).toISOString() }));
  const page = await app({ made });
  await page.evaluate(() => window.__t.go("artifacts"));
  await page.locator('#arts-body .md-it[data-k="k0"]').waitFor();
  await page.evaluate(() => { const b = document.querySelector("#arts"), it = [...document.querySelectorAll("#arts-body .md-it")]; b.scrollTop = 5250; });
  await page.waitForTimeout(400);
  const pin = page.locator('#arts-body .md-it[data-k="k50"] .md-pin');
  await pin.waitFor();
  await pin.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('#arts-body .md-it[data-k="k50"] .md-pin')?.getAttribute("aria-pressed") === "true");
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.activeElement.closest(".md-it")?.dataset.k), "k50", "focus on its pin, in Pinned");
  assert.equal(await page.locator('#arts-body .md-it[data-k="k50"]').count(), 1);
  await done(page);
});
t("C065: Images chosen, then a project with no images: the kinds still have one choice checked and one Tab stop", async () => {
  const made = [
    { id: "d1", name: "notes.md", path: "notes.md", relative_path: "notes.md", project_id: "demo", mime: "text/markdown", bytes: 10, created_at: NOW, updated_at: NOW },
    { id: "i1", name: "shot.png", path: "shot.png", relative_path: "shot.png", project_id: "research", mime: "image/png", bytes: 10, created_at: NOW, updated_at: NOW },
  ];
  const page = await app({ madeBy: { chat_demo: [made[0]], chat_research: [made[1]] }, extraChats: [H.chat("chat_research", "project", "research")] });
  await page.evaluate(() => window.__t.go("artifacts"));
  await page.locator('#arts-f [data-arts-kind="image"]').click();
  await page.evaluate(() => { const s = document.querySelector("#arts-pj"); s.value = "demo"; s.dispatchEvent(new Event("change", { bubbles: true })); });
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => { const r = [...document.querySelectorAll("#arts-f [role=radio]")]; return { checked: r.filter((x) => x.getAttribute("aria-checked") === "true").map((x) => x.dataset.artsKind), stops: r.filter((x) => x.getAttribute("tabindex") !== "-1").length, empty: document.querySelector("#arts-body .ar-none")?.textContent }; });
  assert.deepEqual(st.checked, ["image"], "Images stays chosen");
  assert.equal(st.stops, 1, "one Tab stop");
  assert.match(st.empty || "", /No images in this project/);
  await done(page);
});

// ── threads with agents at work, as the server lists them and the stream feeds them ──
t("S064: Files' Touched by agents (Space can't list changes here): a touched file opens with the keyboard and takes focus", async () => {
  const page = await app({ files: { "a.js": FILE() }, changesUnsupported: true, threadsBy: { chat_demo: [serverThread("tw1", "ses-tw")] } });
  await toDemo(page);
  await page.waitForFunction(() => window.__t.world.state.threads.some((x) => x.id === "tw1"), null, { timeout: 15000 });
  await feedTurn(page, { id: "tw1", sid: "ses-tw", rows: [{ call_id: "c1", kind: "edit_file", status: "ok", target: "a.js" }] });
  await panelOpen(page);
  await filesOpen(page);
  const row = page.locator('[data-fl-touch="a.js"]').filter({ visible: true }).first();
  await row.waitFor();
  await row.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__t.VW.isOpen);
  await page.waitForTimeout(300);
  assert.match(await active(page), /id=viewer/);
  await done(page);
});
t("S042: Changes paused on a file; an agent edits another: Show takes you there, focus on its row", async () => {
  const page = await app({ files: { "a.js": FILE(), "b.js": FILE() }, threadsBy: { chat_demo: [serverThread("tc1", "ses-tc")] }, changes: [
    { path: "a.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: PATCH("a.js", "one", "ONE") },
    { path: "b.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: PATCH("b.js", "one", "UNO") }] });
  await panelOpen(page);
  if (await page.locator('[data-ghost="changes"]').filter({ visible: true }).count()) await page.locator('[data-ghost="changes"]').filter({ visible: true }).first().click();
  await page.locator('[data-cx="a.js"]').filter({ visible: true }).first().click(); // your pick: following pauses
  await page.waitForFunction(() => document.querySelector(".cx-pp")?.textContent === "a.js");
  await page.waitForFunction(() => window.__t.world.state.threads.some((x) => x.id === "tc1"), null, { timeout: 15000 });
  await feedTurn(page, { id: "tc1", sid: "ses-tc", rows: [{ call_id: "c1", kind: "edit_file", status: "ok", target: "b.js" }] });
  const pill = page.locator(".cx-pill[data-cx-show]").filter({ visible: true }).first();
  await pill.waitFor({ timeout: 10000 });
  await pill.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".cx-pp")?.textContent === "b.js");
  await page.waitForTimeout(200);
  assert.match(await active(page), /data-cx=b\.js/, "on b.js's row, not the page");
  await done(page);
});
t("S037: Interrupt under your waiting message: focus goes to its Undo, and Undo puts it back on Interrupt", async () => {
  // a working thread (its session busy on a running turn) with your message after the turn began
  const page = await app();
  await toDemo(page);
  await page.evaluate(() => {
    const t = window.__t;
    t.world.act.stop = async () => ({ stopped: true });
    t.world.state.threads = [{ id: "ti1", chatId: "chat_demo", sessionId: "ses-ti", title: "A local task", project: "demo", cwd: "/home/test/demo", loaded: true, live: true, busy: true, state: "working", messages: [{ id: "m-you", who: "you", seq: 15, text: "Also check the docs", at: Date.now() }], happened: "Test only", lastAt: Date.now(), createdAt: Date.now() - 60e3, checklist: { total: 0, done: 0, items: [] }, asks: [] }];
  });
  await feedTurn(page, { id: "ti1", sid: "ses-ti", running: true, rows: [{ call_id: "c1", kind: "command", status: "running", target: "npm test" }] });
  await page.evaluate(() => { window.__t.go("t:ti1"); window.__t.render(); });
  const intr = page.locator("[data-interrupt]").first();
  await intr.waitFor({ timeout: 10000 });
  await intr.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement?.hasAttribute("data-herald-undo"), null, { timeout: 3000 });
  await page.keyboard.press("Enter"); // Undo
  await page.waitForFunction(() => document.activeElement?.hasAttribute("data-interrupt"), null, { timeout: 3000 });
  await done(page);
});
for (const refused of [false, true]) {
  t(`S038: Pick this thread back up${refused ? ", refused" : ""}: focus ${refused ? "stays on it, usable again" : "goes to the message box"}`, async () => {
    const page = await app({ threadsBy: { chat_demo: [serverThread("tf1", "ses-tf", { state: "paused", continued_in: "tf2" }), serverThread("tf2", "ses-tf2", { title: "Its continuation" })] } });
    await toDemo(page);
    await page.evaluate((refused) => { window.__t.world.act.editThread = refused ? async () => { throw Object.assign(new Error("Fixture unavailable"), { status: 503 }); } : async () => ({}); }, refused);
    await toThread(page, "tf1");
    const b = page.locator('[data-unfreeze="tf1"]').first();
    await b.waitFor({ timeout: 10000 });
    await b.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    if (refused) {
      assert.match(await active(page), /data-unfreeze=tf1/);
      assert.equal(await b.getAttribute("aria-busy"), null, "usable again");
    } else assert.match(await active(page), /id=say/);
    await done(page);
  });
}

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

// ── Create, and Jump's places ──
const openCreate = async (page) => { await page.evaluate(() => window.__t.go("home")); const c = page.locator("#home .create, #home [data-create]").filter({ visible: true }).first(); await c.focus(); await page.keyboard.press("Enter"); await page.locator("#cp-name").waitFor(); };
t("H2: a project made from Create opens with focus in its message box", async () => {
  const page = await app({}, { motion: true });
  await openCreate(page);
  await page.locator("#cp-name").fill("Made here");
  await page.locator("#cp-name").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === "say", null, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.activeElement.id), "say");
  await done(page);
});
t("H3: Create keeps focus while it works, and on a plain failure stays on Create", async () => {
  let answer;
  const W = { createMode: "503", createGate: new Promise((ok) => (answer = ok)) };
  const page = await app(W);
  await openCreate(page);
  await page.locator("#cp-name").fill("Not today");
  await page.locator("#cp-submit").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => document.activeElement.id), "cp-submit", "focus stays on Create while it works");
  await page.keyboard.press("Enter"); // a second press while it works
  answer();
  await page.waitForTimeout(400);
  assert.equal(W.creates, 1, "one request");
  assert.equal(await page.evaluate(() => document.activeElement.id), "cp-submit", "after the failure");
  assert.equal(await page.locator("#cp-name").inputValue(), "Not today", "the name is kept");
  await done(page);
});
t("H4: Cancel puts focus back on what opened Create", async () => {
  const page = await app();
  await openCreate(page);
  await page.locator("#cp-cancel").click();
  await page.waitForTimeout(300);
  assert.match(await active(page), /class=create|data-create/);
  await done(page);
});
t("C021: Jump → New project → Escape goes back to the message box Jump was opened from", async () => {
  const page = await app();
  await toDemo(page);
  await page.locator("#say").focus();
  await page.keyboard.press("Control+k");
  await page.locator("#jump-q").fill("New project");
  await page.keyboard.press("Enter");
  await page.locator("#cp-name").waitFor();
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  assert.match(await active(page), /id=say/);
  await done(page);
});
t("H6: Connect GitHub starts once, keeps focus, and lands on Try again when it fails", async () => {
  let answer;
  const W = { ghGate: new Promise((ok) => (answer = ok)) };
  const page = await app(W);
  await openCreate(page);
  await page.locator('#cp-mode [data-mode="clone"]').click();
  const connect = page.locator('#cp-gh [data-cp="connect"]');
  await connect.waitFor();
  await connect.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  answer();
  await page.waitForTimeout(400);
  assert.equal(W.ghStarts, 1, "one start for two presses");
  assert.match(await active(page), /data-cp=connect/, "on Try again");
  assert.match(await page.locator("#cp-gh").innerText(), /Try again/);
  await done(page);
});
t("Jump: Enter with nothing found keeps Jump open on what you typed; a composing Enter does nothing", async () => {
  const page = await app();
  await page.keyboard.press("Control+k");
  await page.locator("#jump-q").fill("zzzz nothing like this");
  await page.keyboard.press("Enter");
  assert.ok(await page.locator("#jump").isVisible(), "still open");
  assert.match(await active(page), /id=jump-q/);
  await page.locator("#jump-q").fill("New project");
  await page.locator("#jump-q").dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, bubbles: true });
  await page.waitForTimeout(200);
  assert.ok(!(await page.locator("#cp-name").isVisible()), "a composing Enter didn't open Create");
  assert.ok(await page.locator("#jump").isVisible());
  await done(page);
});
t("H8: Jump to Artifacts puts focus in Artifacts", async () => {
  const page = await app();
  await page.keyboard.press("Control+k");
  await page.locator("#jump-q").fill("Artifacts");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  assert.match(await active(page), /id=arts/);
  await done(page);
});

// ── Runs (a thread's sub-agents) ──
const run = (id, title, state = "running") => ({ id, title, state, agent_type: "general", started_at: NOW, can_stop: true });
t("Runs: a late list for a thread you left never shows under the one you opened", async () => {
  let releaseA;
  const W = { runsGate: { "ses-a": new Promise((ok) => (releaseA = ok)) }, runs: { "ses-a": { runs: [run("ra", "Alpha's helper")], counts: { running: 1 } }, "ses-b": { runs: [run("rb", "Beta's helper")], counts: { running: 1 } } } };
  const page = await app(W);
  // opened, not waited on: its list is held, and the sheet says it's reading meanwhile
  await page.evaluate(() => { window.__t.openRuns({ sessionId: "ses-a", title: "Thread A" }); });
  await page.waitForFunction(() => !document.querySelector("#runs").hidden);
  assert.match(await page.locator("#runs").innerText(), /Reading its sub-agents/, "it says it's reading, not that there are none");
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__t.openRuns({ sessionId: "ses-b", title: "Thread B" }));
  await page.waitForFunction(() => /Beta's helper/.test(document.querySelector("#runs").innerText));
  releaseA();
  await page.waitForTimeout(300);
  const text = await page.locator("#runs").innerText();
  assert.match(text, /Beta's helper/);
  assert.doesNotMatch(text, /Alpha's helper/);
  await done(page);
});
t("Runs: a failed read says so, with Try again", async () => {
  const W = { runsFail: { "ses-a": true } };
  const page = await app(W);
  await page.evaluate(() => window.__t.openRuns({ sessionId: "ses-a", title: "Thread A" }));
  await page.locator("[data-runs-retry]").waitFor();
  assert.match(await page.locator("#runs").innerText(), /Couldn't read its sub-agents: Fixture offline/);
  W.runsFail = null; W.runs = { "ses-a": { runs: [run("ra", "Alpha's helper")], counts: { running: 1 } } };
  await page.locator("[data-runs-retry]").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => /Alpha's helper/.test(document.querySelector("#runs").innerText));
  await done(page);
});
t("Runs: Stop's Undo is in the sheet; Undo keeps it running and focus goes back to Stop; a second Stop adds nothing", async () => {
  const W = { runs: { "ses-a": { runs: [run("ra", "Alpha's helper")], counts: { running: 1 } } } };
  const page = await app(W);
  await page.evaluate(() => { window.__t.world.act.feature = () => true; return window.__t.openRuns({ sessionId: "ses-a", title: "Thread A" }); });
  const stop = page.locator('#runs [data-run-stop="ra"]');
  await stop.waitFor();
  await stop.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // again, while it waits
  assert.equal(await page.locator("#runs [data-runs-undo]").count(), 1, "one stop waiting, its Undo in the sheet");
  await page.locator("#runs [data-runs-undo]").focus();
  await page.keyboard.press("Enter");
  assert.match(await active(page), /data-run-stop=ra/);
  await page.waitForTimeout(3300);
  assert.equal(W.runStops || 0, 0, "nothing was stopped");
  await done(page);
});

// ── xo-select ──
async function select(page, html) {
  return page.evaluate(async (html) => {
    await import("./js/dropdown.js");
    const box = document.createElement("div"); box.style.cssText = "position:fixed;left:40px;top:40px;z-index:9999"; box.innerHTML = html; document.body.append(box);
    await new Promise((ok) => requestAnimationFrame(ok));
    return true;
  }, html);
}
t("xo-select: a choice survives the select being disabled and enabled (S229)", async () => {
  const page = await app();
  await select(page, `<xo-select id="t-sel" aria-label="Test"><option value="a" selected>Alpha</option><option value="b">Bravo</option><option value="c">Charlie</option></xo-select>`);
  await page.locator("#t-sel .dd-btn").click();
  await page.locator("#t-sel .dd-row", { hasText: "Charlie" }).click();
  assert.equal(await page.evaluate(() => document.querySelector("#t-sel").value), "c");
  await page.evaluate(() => { const s = document.querySelector("#t-sel"); s.setAttribute("disabled", ""); });
  await page.waitForTimeout(50);
  await page.evaluate(() => document.querySelector("#t-sel").removeAttribute("disabled"));
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => document.querySelector("#t-sel").value), "c");
  await done(page);
});
t("xo-select: PageDown never rests on a disabled option, and rows nest in the menu's corner (S230, H11)", async () => {
  const page = await app();
  const opts = Array.from({ length: 6 }, (_, i) => `<option value="${i}"${i >= 4 ? " disabled" : ""}${i === 0 ? " selected" : ""}>Option ${i}</option>`).join("");
  await select(page, `<xo-select id="t-sel" aria-label="Test">${opts}</xo-select>`);
  await page.locator("#t-sel .dd-btn").focus();
  await page.keyboard.press("Enter");
  await page.locator("#t-sel .dd-row").first().waitFor();
  await page.keyboard.press("PageDown");
  const cur = await page.evaluate(() => [...document.querySelectorAll("#t-sel .dd-row")].findIndex((r) => r.classList.contains("is-cur")));
  assert.equal(cur, 3, "the last option that can be chosen");
  const r = await page.evaluate(() => { const m = document.querySelector("#t-sel .dd-menu"), row = m.querySelector(".dd-row"); const mc = getComputedStyle(m), rc = getComputedStyle(row); return { outer: parseFloat(mc.borderTopLeftRadius), border: parseFloat(mc.borderTopWidth), pad: parseFloat(mc.paddingTop), inner: parseFloat(rc.borderTopLeftRadius) }; });
  assert.equal(r.inner, r.outer - r.border - r.pad, `concentric: ${JSON.stringify(r)}`);
  await page.keyboard.press("Escape");
  await done(page);
});
// ── light theme: the search fields show focus ──
for (const [name, sel, place] of [["C007 project search", "#pf-in", "home"], ["C063 artifact search", "#arts-q", "artifacts"]]) {
  t(`${name}: in the light theme its box changes when it has focus`, async () => {
    // the project search shows once the list is long: enough projects for it
    const W = sel === "#pf-in" ? { extraChats: Array.from({ length: 12 }, (_, i) => H.chat(`chat_p${i}`, "project", `proj-${i}`)) } : {};
    const page = await app(W, { theme: "light" });
    if (WIDTH < 600 && sel === "#pf-in") { await done(page); skip("the phone's sidebar is a drawer: the desktop case covers the rule"); }
    await page.evaluate((v) => window.__t.go(v), place);
    await page.locator(sel).waitFor({ state: "attached", timeout: 20000 }); // the place's own field, once it's drawn
    const box = await page.evaluate((sel) => { const e = document.querySelector(sel); const b = e.parentElement; return { rest: getComputedStyle(b).borderColor }; }, sel);
    await page.locator(sel).focus();
    await page.waitForTimeout(300); // its border eases over --d-hover
    const on = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel).parentElement).borderColor, sel);
    assert.notEqual(on, box.rest, "the box's border changes on focus");
    await done(page);
  });
}

// ── the Intelligence picker ──
async function picker(page) {
  await toDemo(page);
  await page.locator("#iq").filter({ visible: true }).first().click();
  await page.locator('#iq-pop [data-dmodel="opus"]').waitFor();
}
t("INT-1: the catalog arriving while you're on a model keeps you on it", async () => {
  let answer;
  const W = {};
  const page = await app(W);
  await picker(page); // first opening: the catalog is cached
  await page.keyboard.press("Escape");
  W.modelsGate = new Promise((ok) => (answer = ok)); // the fresh read on the next opening waits
  await page.locator("#iq").filter({ visible: true }).first().click();
  await page.locator('#iq-pop [data-dmodel="opus"]').waitFor();
  await page.locator('#iq-pop [data-dmodel="opus"]').focus();
  answer();
  await page.waitForTimeout(400);
  assert.match(await active(page), /data-dmodel=opus/);
  await done(page);
});
t("INT-2: Done saves, then closes; refused, the picker stays on your choice and Done tries again", async () => {
  let answer;
  const W = { patchMode: "503" };
  const page = await app(W);
  await picker(page);
  await page.locator('#iq-pop [data-dmodel="sonnet"]').click();
  W.patchGate = new Promise((ok) => (answer = ok));
  await page.locator("#iq-pop [data-ldone]").click();
  // a second Done while the first is out (aria-disabled now, which the test driver won't click: a person can)
  await page.evaluate(() => document.querySelector("#iq-pop [data-ldone]").click());
  assert.equal(await page.locator("#iq-pop [data-ldone]").getAttribute("aria-busy"), "true", "Done says it's saving");
  answer();
  await page.waitForTimeout(300);
  assert.equal(W.patches, 1, "one request for two Dones");
  assert.ok(await page.locator("#iq-pop").isVisible(), "still open");
  if (process.env.DEBUG) console.log(await page.locator("#iq-pop").innerText(), await page.evaluate(() => document.querySelector("#iq-pop").innerHTML.slice(0, 600)));
  assert.equal(await page.locator('#iq-pop [data-dmodel="sonnet"]').getAttribute("aria-checked"), "true", "the choice is kept");
  assert.match(await page.locator("#iq-pop").innerText(), /didn't save/);
  W.patchGate = null; W.patchMode = "ok";
  await page.locator("#iq-pop [data-ldone]").click();
  await page.waitForTimeout(300);
  assert.equal(W.patches, 2, "Done tried again");
  assert.ok(!(await page.locator("#iq-pop").isVisible()), "closed once saved");
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
    // drawn and pressed in one step (a loaded machine can't stretch "at once" past 300 ms between two calls)
    const atOnce = await page.evaluate((q) => { const t = window.__t; t.S.pin = null; document.querySelector("#hm-next").replaceChildren(); document.querySelector("#hm-next")._key = null; document.querySelector("#hm-next")._h = null; t.render(); document.querySelector(q ? "[data-nx-opt]" : "[data-nx-allow]").click(); return t.D.decisions().map((d) => d.choice); }, q);
    assert.deepEqual(atOnce, [], "nothing at once");
    await page.waitForTimeout(350);
    await page.evaluate((q) => document.querySelector(q ? "[data-nx-opt]" : "[data-nx-allow]").click(), q);
    assert.equal((await homeDecided(page)).length, 1, "decided once read");
    await page.evaluate(() => window.__t.D.undo());
    await done(page);
  }
});
t("Home: a card that comes back (Undo) waits its 300 ms again", async () => {
  const page = await app();
  await page.evaluate(() => {
    const t = window.__t;
    for (const name of ["reply", "decide", "decideItem", "resolve"]) t.world.act[name] = async () => ({});
    const th = (i) => ({ id: "home-" + i, title: "Task " + i, project: "demo", live: false, busy: false, state: "needs_approval", messages: [], happened: "Test only", lastAt: Date.now() - i, checklist: { total: 1, done: 0, items: [{ text: "Step", state: "todo" }] }, asks: [{ id: "ask-" + i, title: "Choice " + i, kind: "approval", risk: "routine", detail: "Test only" }] });
    t.world.state.threads = [th(0), th(1)];
    t.go("home"); t.render();
  });
  await page.locator("#hm-next .next").waitFor();
  await page.waitForTimeout(350);
  const first = await page.locator("#hm-next .next").getAttribute("data-key");
  await page.evaluate(() => document.querySelector("[data-nx-allow]").click());
  await page.waitForFunction((k) => document.querySelector("#hm-next .next")?.dataset.key !== k, first);
  // Undo brings it back, and it's pressed at once, in one step
  const atOnce = await page.evaluate((k) => { const t = window.__t; t.D.undo(); t.render(); const card = document.querySelector("#hm-next .next"); if (!card || card.dataset.key !== k) return "not back"; document.querySelector("[data-nx-allow]").click(); return t.D.decisions().map((d) => d.choice); }, first);
  assert.deepEqual(atOnce, [], "nothing at once after it came back");
  await page.waitForTimeout(350);
  await page.evaluate(() => document.querySelector("[data-nx-allow]").click());
  assert.equal((await homeDecided(page)).length, 1, "decided once read again");
  await page.evaluate(() => window.__t.D.undo());
  await done(page);
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
      const label = `${name} [${width}]`;
      if (width !== 1440 && /^G[12]:/.test(name)) { skipped++; console.log(`  skip ${label} (a desktop case)`); continue; }
      try { await fn(); passed++; console.log("  ok  " + label); }
      catch (e) {
        if (e instanceof Skip) { skipped++; console.log(`  skip ${label} (${e.message})`); continue; }
        failed++; console.error("  FAIL " + label + "\n" + (e.stack || e));
      }
    }
  }
  await browser.close(); server.close();
  console.log(`${passed} passed${failed ? `, ${failed} failed` : ""}${skipped ? `, ${skipped} skipped` : ""}`);
  process.exitCode = failed ? 1 : 0;
})();
