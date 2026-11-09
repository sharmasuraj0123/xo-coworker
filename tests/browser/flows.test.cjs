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
//   node tests/browser/flows.test.cjs [name-pattern]
// Every case runs in four cells: dark and light, at 1440×900 and 390×844. A case that can't apply in a cell (the
// control isn't there at that width) says why and counts as skipped, never as passed.
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

let browser, server, BASE, WIDTH = 1440, THEME = "dark", passed = 0, failed = 0, skipped = 0;
const tests = [];
const t = (name, fn) => tests.push({ name, fn });
// a case that doesn't apply at this width says so, and is counted as skipped, never as passed (Files/Map grader)
class Skip extends Error {}
const skip = (why) => { throw new Skip(why); };
// the project's own page, as its row in the sidebar opens it (on a phone the sidebar is a drawer)
const toDemo = (page) => page.evaluate(() => window.__t.go("p:demo"));
// every case runs in four cells: dark and light, at 1440×900 and 390×844 (the owner's bar: every row in both themes at
// every width, never a light pass inferred from a dark one); the page is checked to be in the cell's theme (Files/Map
// grader on 453de55: a light case once ran dark)
const app = async (W = {}, { width = WIDTH, motion = false, theme = THEME } = {}) => {
  const page = await openApp(browser, BASE, W, { width, height: width < 600 ? 844 : 900, motion, theme });
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
t("S136/S137: the Saved notice's Undo and Tell answer the pointer", async () => {
  const page = await app({ files: { "a.js": FILE() } });
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
t("C023: the window narrows to a phone's (or widens) with focus on the panel's opener: focus goes into the panel, never the page", async () => {
  const page = await app();
  await panelOpen(page);
  // the panel's opener, reached with the keyboard as a person would (Tab from the drawing to the selected opener)
  const opener = page.locator("[data-stage-toggle]").filter({ visible: true }).first();
  if (WIDTH >= 600) {
    await opener.focus();
    await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); // natively back onto it
    assert.match(await active(page), /data-stage-toggle/, "on the panel's opener");
    // to a phone's width: the panel now covers the page, its opener under it goes out of reach
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => { const a = document.activeElement; return { inPanel: !!a && !!a.closest("#stage"), page: a === document.body, inert: !!a?.closest("[inert]") }; });
    assert.deepEqual(st, { inPanel: true, page: false, inert: false }, "focus went into the covering panel (Files/Map grader on 875a2ab: it fell to BODY)");
  } else {
    // on a phone the panel covers the page; widened to a desktop it sits beside the chat, focus stays where it was
    await page.locator("[data-stg-close]").filter({ visible: true }).first().focus();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => { const a = document.activeElement; return { inPanel: !!a && !!a.closest("#stage"), page: a === document.body, inert: document.querySelectorAll("#main [data-stage-inert]").length }; });
    assert.deepEqual(st, { inPanel: true, page: false, inert: 0 }, "still in the panel, and nothing under it out of reach any more");
  }
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
  // a whole target, its words on one line, refused or reading (Astra S061 on 2354917: 54 × 16 px at 390)
  const size = () => retry.evaluate((b) => { const r = b.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(b); return { w: r.width, h: r.height, lines: new Set([...g.getClientRects()].map((x) => Math.round(x.top))).size }; });
  const want = WIDTH < 600 ? 36 : 32;
  let sz = await size();
  assert.ok(sz.lines === 1 && sz.h >= want && sz.w >= 44, `Try again, refused: ${JSON.stringify(sz)} (at least 44 × ${want}, one line)`);
  const errInk = await page.evaluate(() => { const p = document.createElement("p"); p.style.color = "var(--err-ink)"; document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return c; });
  await retry.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  assert.match(await page.locator(".fl-tree").innerText(), /Reading again/, "it says it's reading again at once");
  // reading again is a status, not the error: the line isn't in the error's colour (Astra S061: it stayed red)
  const line = await page.locator(".fl-tree .fl-note.is-pending").first().evaluate((n) => ({ cls: n.className, color: getComputedStyle(n).color }));
  assert.ok(!/\bis-err\b/.test(line.cls) && line.color !== errInk, `the pending line: ${JSON.stringify(line)} (error ink ${errInk})`);
  sz = await size();
  assert.ok(sz.lines === 1 && sz.h >= want && sz.w >= 44, `Try again, reading: ${JSON.stringify(sz)}`);
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

t("EDITOR-close: Escape on one of the find bar's buttons closes the bar and puts you back at your caret, still editing", async () => {
  const page = await app({ files: { "a.js": FILE() } });
  await editing(page);
  await page.locator("#viewer [contenteditable=true]").first().click();
  await page.keyboard.press("ControlOrMeta+f");
  const q = page.locator("[data-search-grid] [data-search]").first();
  await q.waitFor();
  await q.focus();
  await page.keyboard.insertText("two");
  // from the field to one of the bar's own buttons, as Tab takes you
  await page.locator('[data-search-grid] [aria-label="Regexp"]').first().focus();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => !!(window.__ED && window.__ED.on)), true, "still editing");
  assert.deepEqual(await deepActive(page), { editable: true, inViewer: true }, "back at the caret");
  assert.equal(await page.locator("[data-search-grid] [data-search]").filter({ visible: true }).count(), 0, "the bar closed");
  await done(page);
});
t("EDITOR-regex: a pattern that isn't a valid regexp still says so after an edit to the document", async () => {
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
  // an edit to the document while the bar is open: the editor counts its matches again (back at the caret the way
  // the bar's own Close puts you there; the bar covers the first lines, so a click there lands on the bar)
  await page.evaluate(() => window.__ED.ed.focus());
  await page.waitForFunction(() => { let a = document.activeElement; while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; return !!a?.isContentEditable; });
  await page.keyboard.insertText("x");
  await page.waitForTimeout(300);
  assert.equal(await page.locator("[data-search-grid] [data-matches]").first().innerText(), "Not a valid pattern", "its words after the edit");
  assert.equal(await q.getAttribute("aria-invalid"), "true", "and the field says so too");
  await done(page);
});
t("S232: a merge choice hands focus to the next place even far below, never to Save while a place is left", async () => {
  const lines = Array.from({ length: 400 }, (_, i) => `line ${i + 1}`);
  const of = (a, z) => [a, ...lines.slice(1, 399), z].join("\n") + "\n";
  const page = await app({ files: { "a.js": { content: of("line 1", "line 400"), version: "sha256:A" } }, saveMode: "overlap", agentText: of("AGENT first", "AGENT last") });
  await editing(page);
  await typeAll(page, of("MINE first", "MINE last"));
  await page.locator("[data-vw-saveit]").click();
  await page.waitForFunction(() => window.__ED.conflict && window.__ED.conflict.left === 2);
  const first = page.locator(".xd-mbtn").first();
  await first.waitFor();
  await first.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__ED.conflict.left === 1);
  // where focus goes in the next moments: a place to choose, never Save
  const seen = await page.evaluate(() => new Promise((ok) => {
    const out = [], t0 = performance.now();
    const look = () => { const a = document.activeElement; out.push(a?.classList.contains("xd-merge") ? "place" : a?.hasAttribute("data-vw-saveit") ? "save" : a?.id === "viewer" || a?.classList.contains("vw-file") ? "file" : a === document.body ? "page" : a?.tagName || "none"); if (performance.now() - t0 < 1500 && out[out.length - 1] !== "place") requestAnimationFrame(look); else ok(out); };
    look();
  }));
  assert.ok(!seen.includes("save"), `never Save with a place left (${[...new Set(seen)].join(", ")})`);
  assert.equal(seen[seen.length - 1], "place", `it reaches the next place (${[...new Set(seen)].join(", ")})`);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__ED.conflict.left === 0);
  await page.waitForFunction(() => document.activeElement?.hasAttribute("data-vw-saveit"), null, { timeout: 3000 });
  await done(page);
});
for (const how of ["Enter", "click"]) {
  t(`S137: Tell the agent (${how}) tells it once, and the notice hands focus to the file's Edit`, async () => {
    const page = await app({ files: { "a.js": FILE() } });
    await editing(page);
    await typeAll(page, "mine\n");
    await page.keyboard.press("ControlOrMeta+s");
    await page.waitForFunction(() => !window.__ED.on);
    const tell = page.locator("[data-vw-tell]").first();
    if (how === "click") await tell.click(); else { await tell.focus(); await page.keyboard.press("Enter"); }
    assert.match(await active(page), /data-vw-edit/, "focus on the file's Edit");
    assert.equal(await page.locator("[data-vw-tell]").count(), 0, "the notice went");
    const said = await page.evaluate(() => Object.values(window.__t.S.local || {}).flat().filter((m) => /^I edited a\.js\. Read it again/.test(m.text || "")).length);
    assert.equal(said, 1, "the agent is told, once");
    await done(page);
  });
}
// ── the viewer: what's shown is the file's or change's you're on, never the last one's ──
for (const how of [413, "late"]) {
  t(`VW-STALE-EDIT: an Edit read for the file you left never lands on the next one (${how === 413 ? "too large" : "answered late"})`, async () => {
    let answerA;
    const page = await app({ files: { "a.js": FILE(), "b.js": { content: "bee\nbuzz\n", version: "sha256:B" } }, editGateFor: { "a.js": new Promise((ok) => (answerA = ok)) }, editStatusFor: how === 413 ? { "a.js": 413 } : {} });
    await toDemo(page);
    const edit = () => page.evaluate(() => document.querySelector("#viewer .vw-top [data-vw-edit]")?.getAttribute("aria-label") || null);
    await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "a.js", path: "a.js", name: "a.js" }));
    await page.waitForFunction(() => document.querySelector("#viewer .vw-top [data-vw-edit]")?.getAttribute("aria-label") === "Edit");
    await page.locator("#viewer .vw-top [data-vw-edit]").click();
    await page.waitForFunction(() => document.querySelector("#viewer .vw-top [data-vw-edit]")?.getAttribute("aria-label") === "Opening for editing");
    await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "b.js", path: "b.js", name: "b.js" }));
    await page.waitForFunction(() => window.__t.VW.file?.rel === "b.js" && document.querySelector("#viewer .vw-top [data-vw-edit]"));
    assert.equal(await edit(), "Edit", "b.js has its own Edit, not a.js's Opening…");
    answerA();
    await page.waitForTimeout(400);
    assert.equal(await edit(), "Edit", "a.js's answer changed nothing on b.js");
    assert.equal(await page.evaluate(() => !!(window.__ED && window.__ED.on)), false, "not editing b.js on a.js's answer");
    await page.locator("#viewer .vw-top [data-vw-edit]").click();
    await page.waitForFunction(() => window.__ED && window.__ED.on && window.__ED.ed);
    assert.equal(await page.evaluate(() => window.__ED.ed.text()), "bee\nbuzz\n", "b.js opens for editing on its own words");
    await done(page);
  });
}
const viewerDiff = (page) => page.evaluate(() => { const d = document.querySelector("#viewer .vw-diff"); if (!d) return ""; const c = d.querySelector("diffs-container"); return d.textContent + (c && c.shadowRoot ? c.shadowRoot.textContent : ""); });
async function diffOpen(page, rel) {
  await page.waitForFunction((rel) => !!window.__t.CHG.at("demo", rel), rel, { timeout: 15000 }); // the project's changes are read
  await page.evaluate((rel) => window.__t.VW.open({ project: "demo", rel, path: rel, name: rel, show: "changes" }), rel);
}
t("VW-DIFF-HELD: a change whose read is held says so, never the last change's diff", async () => {
  let answerB;
  const page = await app({ files: { "a.js": FILE(), "b.js": FILE() }, changesGateFor: { "b.js": new Promise((ok) => (answerB = ok)) }, changes: [
    { path: "a.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: PATCH("a.js", "one", "ALPHA") },
    { path: "b.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:B", patch: null, patch_omitted: "response_budget", full: PATCH("b.js", "one", "BRAVO") }] });
  await toDemo(page);
  await diffOpen(page, "a.js");
  await page.waitForFunction(() => { const d = document.querySelector("#viewer .vw-diff diffs-container"); return d && d.shadowRoot && d.shadowRoot.textContent.includes("ALPHA"); }, null, { timeout: 15000 });
  await diffOpen(page, "b.js");
  await page.waitForTimeout(250);
  const held = await viewerDiff(page);
  assert.ok(!held.includes("ALPHA"), "a.js's diff went at once");
  assert.match(held, /Reading the change/, "it says b.js's change is being read");
  answerB();
  await page.waitForFunction(() => { const d = document.querySelector("#viewer .vw-diff diffs-container"); return d && d.shadowRoot && d.shadowRoot.textContent.includes("BRAVO"); }, null, { timeout: 15000 });
  assert.doesNotMatch(await viewerDiff(page), /Reading the change/, "and once it's there, only it");
  await done(page);
});
t("VW-DIFF-ERR: a change that couldn't be read says so and stays said; Try again reads it again, focus in the diff", async () => {
  const page = await app({ files: { "b.js": FILE() }, changesFailFor: { "b.js": 1 }, changes: [
    { path: "b.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:B", patch: null, patch_omitted: "response_budget", full: PATCH("b.js", "one", "BRAVO") }] });
  await toDemo(page);
  await diffOpen(page, "b.js");
  await page.waitForFunction(() => /Couldn't read this change/.test(document.querySelector("#viewer .vw-diff")?.textContent || ""), null, { timeout: 15000 });
  const reads = page.W.changeReads["b.js"];
  // the app draws again (as it does all the time): the failure stays said, and isn't read again behind your back
  await page.evaluate(() => { for (let i = 0; i < 5; i++) window.__t.render(); });
  await page.waitForTimeout(300);
  assert.match(await viewerDiff(page), /Couldn't read this change/, "still says so");
  assert.equal(page.W.changeReads["b.js"], reads, "not read again until you ask");
  await page.locator("#viewer [data-vw-diff-retry]").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => { const d = document.querySelector("#viewer .vw-diff diffs-container"); return d && d.shadowRoot && d.shadowRoot.textContent.includes("BRAVO"); }, null, { timeout: 15000 });
  assert.equal(page.W.changeReads["b.js"], reads + 1, "read once more");
  assert.match(await active(page), /vw-diff/, "focus waited in the diff's body, where the change appeared");
  await done(page);
});
t("VW-DIFF-LATE: the last file's change, read late, never draws over the one you're on", async () => {
  let answerA;
  const page = await app({ files: { "a.js": FILE(), "b.js": FILE() }, changesGateFor: { "a.js": new Promise((ok) => (answerA = ok)) }, changes: [
    { path: "a.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: null, patch_omitted: "response_budget", full: PATCH("a.js", "one", "ALPHA") },
    { path: "b.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:B", patch: PATCH("b.js", "one", "BRAVO") }] });
  await toDemo(page);
  await diffOpen(page, "a.js");
  await page.waitForFunction(() => /Reading the change/.test(document.querySelector("#viewer .vw-diff")?.textContent || ""));
  await diffOpen(page, "b.js");
  await page.waitForFunction(() => { const d = document.querySelector("#viewer .vw-diff diffs-container"); return d && d.shadowRoot && d.shadowRoot.textContent.includes("BRAVO"); }, null, { timeout: 15000 });
  answerA();
  await page.waitForTimeout(600);
  const now = await viewerDiff(page);
  assert.ok(now.includes("BRAVO") && !now.includes("ALPHA"), "still b.js's change only");
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
  // every control on the page outside the panel and the notices (the herald, the toast) is inert or not: true each
  const under = () => page.evaluate(() => [...document.querySelectorAll("#main button, #main [href], #main input, #main textarea, #main [tabindex]")]
    .filter((c) => !c.closest(".stage, .toast-wrap, #herald")).map((c) => !!c.closest("[inert]")));
  if (WIDTH < 600) {
    assert.ok((await under()).every(Boolean), "everything under the phone's panel is out of reach (only notices stay)");
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
for (const how of ["Enter", "Space", "click"]) {
  t(`S224: a turn's file chip whose file changed (${how}) opens its diff, focus on exactly what shows it`, async () => {
    const page = await app({ files: { "a.js": FILE() }, threadsBy: TT(), changes: [{ path: "a.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: PATCH("a.js", "one", "ONE") }] });
    await toDemo(page);
    const chip = await turnChip(page);
    await page.waitForFunction(() => !!window.__t.CHG.at("demo", "a.js"), null, { timeout: 15000 }); // the place's changes are read
    // fresh: nothing of a.js's change is shown yet
    assert.equal(await page.evaluate(() => !!window.__t.VW.isOpen || !!document.querySelector("#stage:not([hidden]) .cx-pd:not([hidden])")), false, "nothing shown before the press");
    if (how === "click") await chip.click(); else { await chip.focus(); await page.keyboard.press(how); }
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => {
      const a = document.activeElement, usable = !!a && a !== document.body && a.isConnected && a.getClientRects().length > 0 && !a.closest("[inert], [hidden]");
      const pd = document.querySelector("#stage .cx-pd"), panel = !!pd && !pd.hidden && pd.getClientRects().length > 0 && pd.childElementCount > 0;
      const vd = document.querySelector("#viewer .vw-diff"), viewer = !!window.__t.VW.isOpen && !!vd && vd.getClientRects().length > 0;
      return { usable, onRow: !!a?.matches?.('#stage [data-cx="a.js"]'), onViewer: a?.id === "viewer", panel, viewer, rel: window.__t.VW.file?.rel || null };
    });
    assert.ok(st.usable, "focus on something you can see and use");
    if (WIDTH >= 600) {
      // beside the conversation: the panel's Changes, on a.js's row, its diff showing
      assert.deepEqual({ onRow: st.onRow, panel: st.panel }, { onRow: true, panel: true }, "on a.js's row in the panel's Changes, its diff shown");
    } else if (st.viewer) {
      assert.deepEqual({ onViewer: st.onViewer, rel: st.rel }, { onViewer: true, rel: "a.js" }, "on a.js's diff in Files");
    } else {
      assert.deepEqual({ onRow: st.onRow, panel: st.panel }, { onRow: true, panel: true }, "on a.js's row in the panel's Changes (covering the chat), its diff shown");
    }
    await done(page);
  });
}
t("S224: the file put away after its turn went on: focus goes to what brings it back, or to a.js's chip, never the page", async () => {
  const page = await app({ files: { "a.js": FILE() }, threadsBy: TT() });
  await toDemo(page);
  const chip = await turnChip(page);
  await chip.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__t.VW.isOpen);
  await page.waitForTimeout(300);
  // the thread goes on while the file is open: its next turn comes in and the conversation draws again
  await feedTurn(page, { id: "tt1", sid: "ses-tt", rows: [{ call_id: "c3", kind: "read_file", status: "ok", target: "c.js" }], n: 2 });
  await page.waitForTimeout(300);
  assert.match(await active(page), /id=viewer/, "still on the file");
  // Escape, as a person leaves it: beside the chat the file is put away (its own chip brings it back); on a phone
  // the sheet steps back to the chat
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => { const a = document.activeElement; return { usable: !!a && a !== document.body && a.isConnected && a.getClientRects().length > 0 && !a.closest("[inert], [hidden]"), chip: !!a?.matches?.('#msgs .tb-cf[data-file="a.js"], [data-fv-restore]'), at: a ? a.tagName + (a.id ? "#" + a.id : "") + (a.className ? "." + String(a.className).split(" ").join(".") : "") : null }; });
  assert.ok(st.usable, `focus on something you can use, never the page (${st.at})`);
  if (WIDTH >= 600) assert.ok(st.chip, `on what brings a.js back, or a.js's chip in the turn (${st.at})`);
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
// ── the Map far out: what a pointer press does ──
/** The project's Map in the panel, 40 folders at the top (the top folder shows 14 and "N more"). */
async function bigMap() {
  const dirs = Array.from({ length: 40 }, (_, i) => `folder-${String(i).padStart(2, "0")}`);
  const page = await app({ files: { "a.js": FILE() }, dirs });
  await panelOpen(page);
  if (await page.locator('[data-ghost="map"]').filter({ visible: true }).count()) await page.locator('[data-ghost="map"]').filter({ visible: true }).first().click();
  await page.locator("#stage-map-tree").waitFor();
  await page.evaluate(() => document.querySelector("#stage-map-tree").click());
  await page.locator(".dg-world [data-node]").first().waitFor();
  return page;
}
const mapScale = (page) => page.evaluate(() => parseFloat(document.querySelector(".dg-world").style.getPropertyValue("--dg-s")) || 1);
/** ⌘-scroll, as a person zooms, at a box's middle (it stays under the pointer), to scale `to`. */
const zoomOn = (page, id, to) => page.evaluate(({ id, to }) => {
  const n = document.querySelector(`.dg-world [data-node="${CSS.escape(id)}"]`), v = document.querySelector(".dg-world").parentElement;
  const s = parseFloat(document.querySelector(".dg-world").style.getPropertyValue("--dg-s")) || 1, b = n.getBoundingClientRect();
  v.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, deltaY: -Math.log(to / s) / 0.0022, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true, cancelable: true }));
}, { id, to });
/** How far a box's middle is from the middle of the drawing's view (above its tools), in px. */
const offCentre = (page, id) => page.evaluate((id) => {
  const n = document.querySelector(`.dg-world [data-node="${CSS.escape(id)}"]`), v = document.querySelector(".dg-world").parentElement;
  const b = n.getBoundingClientRect(), r = v.getBoundingClientRect();
  return { dx: b.left + b.width / 2 - (r.left + v.clientLeft + v.clientWidth / 2), dy: b.top + b.height / 2 - (r.top + v.clientTop + (v.clientHeight - 44) / 2) };
}, id);
/** What a box says it is: a press that acts changes it (a folder opens, "More" shows the rest). */
const boxState = (page, id) => page.evaluate((id) => { const n = document.querySelector(`.dg-world [data-node="${CSS.escape(id)}"]`); return n ? `${n.className}|${n.getAttribute("aria-label")}|${document.querySelectorAll(".dg-world [data-node]").length}` : "gone"; }, id);
/** The Graph settles by itself: wait until no node moves for 300 ms. */
async function graphStill(page) {
  const at = () => page.evaluate(() => [...document.querySelectorAll(".dg-world .gn")].map((n) => n.style.transform).join());
  let was = await at();
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(300); const now = await at(); if (now === was) return; was = now; }
  throw new Error("the Graph never settled");
}
t("S207/S082: Fit shows every box; no box's target reaches a neighbour's box (edges too); far out a press zooms in", async () => {
  const page = await bigMap();
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
    const s2 = await mapScale(page);
    assert.ok(s2 >= 24 / 42, `zoomed in to a pressable size (${s2})`);
    assert.equal(await n.getAttribute("class"), was, "the folder didn't open on that press");
    const off = await offCentre(page, "folder-20");
    assert.ok(Math.abs(off.dx) <= 3 && Math.abs(off.dy) <= 3, `in to that folder, in the middle (${off.dx.toFixed(1)}, ${off.dy.toFixed(1)})`);
    const r2 = await probe();
    assert.deepEqual(r2.grown, [], `at scale ${r2.s.toFixed(3)} no target reaches more than half way to a neighbour`);
    assert.deepEqual(r2.stolen, [], `at scale ${r2.s.toFixed(3)} no target reaches a neighbour's box (edges probed)`);
  }
  await done(page);
});
t("S207: far out, a press on a Graph node brings the map in to that node, in the middle, and doesn't act; pressed again, it acts", async () => {
  const page = await bigMap();
  await page.evaluate(() => document.querySelector("#stage-map-graph").click()); // the panel's Graph tab
  await page.locator(".dg-world.k-graph button.gn[data-node]").first().waitFor();
  await graphStill(page);
  await page.locator('[data-dg="fit"]').filter({ visible: true }).first().click();
  await page.waitForTimeout(300);
  await graphStill(page);
  const s = await mapScale(page);
  assert.ok(s < 0.8, `Fit is far out here (${s.toFixed(3)}), below the readable scale`);
  // the folder farthest from the drawing's corner (0,0): a Graph node sits there and moves by its transform, which
  // is where the press used to zoom in (grader on 44e429d)
  const id = await page.evaluate(() => {
    let best = null, far = -1;
    for (const n of document.querySelectorAll(".dg-world.k-graph button.gn.k-dir[data-node]")) {
      const m = new DOMMatrixReadOnly(n.style.transform || undefined), d = Math.hypot(m.e, m.f);
      if (d > far) { far = d; best = n.dataset.node; }
    }
    return best;
  });
  assert.ok(id, "a folder in the Graph");
  const before = await boxState(page, id);
  const b = await page.locator(`.dg-world [data-node="${id}"]`).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(400);
  assert.ok(Math.abs((await mapScale(page)) - 0.8) < 1e-6, "in to the readable scale");
  const off = await offCentre(page, id);
  assert.ok(Math.abs(off.dx) <= 3 && Math.abs(off.dy) <= 3, `in to that node, in the middle (${off.dx.toFixed(1)}, ${off.dy.toFixed(1)})`);
  assert.equal(await boxState(page, id), before, "that press didn't act");
  // the next press acts (it's readable now)
  const b2 = await page.locator(`.dg-world [data-node="${id}"]`).boundingBox();
  await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.waitForFunction(({ id, before }) => { const n = document.querySelector(`.dg-world [data-node="${CSS.escape(id)}"]`); return !n || `${n.className}|${n.getAttribute("aria-label")}|${document.querySelectorAll(".dg-world [data-node]").length}` !== before; }, { id, before }, { timeout: 5000 });
  await done(page);
});
t("S207: each box by its own target: at 0.6 a 24 px \"More\" brings the map in first, a 32 px folder acts", async () => {
  const page = await bigMap();
  await page.locator('[data-dg="fit"]').filter({ visible: true }).first().click();
  await page.waitForTimeout(400);
  const more = await page.locator(".dg-world .dg-n.k-more[data-node]").first().getAttribute("data-node");
  assert.ok(more, "the top folder shows \"N more\"");
  // at 0.6 "More"'s target is (24 + 5 + 5) × 0.6 = 20.4 px: under 24, so a press brings the map in to it first
  await zoomOn(page, more, 0.6);
  assert.ok(Math.abs((await mapScale(page)) - 0.6) < 1e-3, "at 0.6");
  const before = await boxState(page, more);
  let b = await page.locator(`.dg-world [data-node="${more}"]`).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(400);
  assert.ok(Math.abs((await mapScale(page)) - 0.8) < 1e-6, "\"More\" brought the map in to the readable scale");
  assert.equal(await boxState(page, more), before, "and didn't act on that press");
  const off = await offCentre(page, more);
  assert.ok(Math.abs(off.dx) <= 3 && Math.abs(off.dy) <= 3, `in to it, in the middle (${off.dx.toFixed(1)}, ${off.dy.toFixed(1)})`);
  // a folder at 0.6: (32 + 5 + 5) × 0.6 = 25.2 px, pressable, so the press acts at once, and the scale holds.
  // Fit again (every box in view), then in at the folder, as a person zooms at what they mean to press
  await page.locator('[data-dg="fit"]').filter({ visible: true }).first().click();
  await page.waitForTimeout(400);
  const dir = await page.locator(".dg-world button.dg-n.k-dir[data-node]").first().getAttribute("data-node");
  assert.ok(dir, "a folder");
  await zoomOn(page, dir, 0.6);
  assert.ok(Math.abs((await mapScale(page)) - 0.6) < 1e-3, "at 0.6 again");
  const was = await boxState(page, dir);
  b = await page.locator(`.dg-world [data-node="${dir}"]`).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForFunction(({ id, was }) => { const n = document.querySelector(`.dg-world [data-node="${CSS.escape(id)}"]`); return !n || `${n.className}|${n.getAttribute("aria-label")}|${document.querySelectorAll(".dg-world [data-node]").length}` !== was; }, { id: dir, was }, { timeout: 5000 });
  assert.ok(Math.abs((await mapScale(page)) - 0.6) < 1e-3, "the folder acted where it was; the map didn't move in");
  await done(page);
});
t("H12: a made thing's age updates in place, and a name cut in the middle stays whole", async () => {
  const long = "a-very-long-report-name-that-is-cut-in-the-middle-final.md";
  // made just now (NOW is when the suite started: 45 minutes into a four-cell run, "2 h later" read as 3h)
  const at = new Date().toISOString();
  const page = await app({ made: [{ id: "mk9", name: long, path: long, relative_path: long, project_id: "demo", mime: "text/markdown", bytes: 10, created_at: at, updated_at: at }] });
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
t("S238: Runs read once, then refused twice: Try again keeps focus; once it reads, focus goes to the first run", async () => {
  const W = { runs: { "ses-a": { runs: [run("ra", "Alpha's helper")], counts: { running: 1 } } } };
  const page = await app(W);
  await page.evaluate(() => window.__t.openRuns({ sessionId: "ses-a", title: "Thread A" }));
  await page.waitForFunction(() => /Alpha's helper/.test(document.querySelector("#runs")?.innerText || ""));
  assert.match(await active(page), /rn-open/, "opened and read: on the first run");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#runs").hidden);
  // opened again, its list refused: the rows from before stay, with the refusal and Try again above them
  W.runsFail = { "ses-a": true };
  await page.evaluate(() => window.__t.openRuns({ sessionId: "ses-a", title: "Thread A" }));
  await page.locator("#runs [data-runs-retry]").waitFor();
  await page.waitForFunction(() => document.activeElement?.hasAttribute("data-runs-retry"), null, { timeout: 3000 });
  // Try again, refused again: focus stays on Try again (Astra S238: it went to the sheet's ×)
  const asked = W.runsReads;
  await page.keyboard.press("Enter");
  for (let i = 0; i < 50 && W.runsReads === asked; i++) await page.waitForTimeout(100);
  assert.equal(W.runsReads, asked + 1, "read again");
  await page.waitForFunction(() => /Couldn't read its sub-agents again/.test(document.querySelector("#runs").innerText) && document.querySelector("#runs [data-runs-retry]"), null, { timeout: 5000 });
  await page.waitForTimeout(300); // its answer drawn
  assert.match(await active(page), /data-runs-retry/, "refused again: still on Try again");
  // Try again is whole: its words on one line, its target at least the size of a row's control, never squeezed by a
  // long refusal (Astra S238 at 875a2ab: 34.9 × 40 px on two lines at 390)
  const tr = await page.locator("#runs [data-runs-retry]").evaluate((b) => { const r = b.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(b); const lines = new Set([...g.getClientRects()].map((x) => Math.round(x.top))).size; return { w: r.width, h: r.height, lines, squeezed: b.scrollWidth > b.clientWidth + 1 }; });
  assert.equal(tr.lines, 1, `Try again on one line (${JSON.stringify(tr)})`);
  assert.ok(!tr.squeezed && tr.w >= 44 && tr.h >= 32, `Try again whole: ${JSON.stringify(tr)}`);
  // and once it reads: on the first run
  W.runsFail = null;
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement?.classList.contains("rn-open"), null, { timeout: 5000 });
  await done(page);
});
t("C047: the thread head's sub-agents working now are buttons, each in the list's own item; Enter opens one", async () => {
  if (WIDTH < 600) skip("a phone shows one count in their place (the chips are hidden there by design; the count is the button)");
  const page = await app({ threadsBy: { chat_demo: [serverThread("rc1", "ses-rc")] }, runs: { "ses-rc": { runs: [run("a1", "Fixture a1")], counts: { running: 1 } } } });
  await toDemo(page);
  await toThread(page, "rc1");
  // a sub-agent working now, as the stream names it
  await page.evaluate(() => { window.__t.world.state.runs.set("a1", { id: "a1", session: "ses-rc", parent: null, state: "running", title: "Fixture a1", depth: 1 }); window.__t.render(); });
  const strip = page.locator("#thead .rn-strip").filter({ visible: true }).first();
  await strip.waitFor();
  assert.equal(await strip.getByRole("listitem").count(), 1, "one item in the list");
  assert.equal(await strip.getByRole("listitem").getByRole("button", { name: /Fixture a1/ }).count(), 1, "and in it a button, named for its run (Astra C047: it read as a listitem, not a button)");
  await strip.getByRole("button", { name: /Fixture a1/ }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector("#runs").hidden);
  await done(page);
});
t("S100: Runs' Stop is named Stop in every layout, a run's own view too (on a phone it shows as its icon)", async () => {
  const W = { runs: { "ses-a": { runs: [run("ra", "Alpha's helper")], counts: { running: 1 } } } };
  const page = await app(W);
  await page.evaluate(() => { window.__t.world.act.feature = () => true; return window.__t.openRuns({ sessionId: "ses-a", title: "Thread A" }); });
  await page.locator('#runs [data-run-stop="ra"]').waitFor();
  const named = (scope) => page.locator(scope).getByRole("button", { name: "Stop", exact: true }).count();
  assert.equal(await named("#runs .rn-list"), 1, "the row's Stop, by its name");
  // the run's own view: its Stop in the head
  await page.locator('#runs .rn-open[data-run="ra"]').click();
  await page.locator('#runs .rn-top [data-run-stop="ra"]').waitFor();
  assert.equal(await named("#runs .rn-top"), 1, "the run view's Stop, by its name (Astra S100: none at 390)");
  const look = await page.locator('#runs .rn-top [data-run-stop="ra"]').evaluate((b) => { const i = b.querySelector("svg").getBoundingClientRect(), w = b.querySelector("span").getBoundingClientRect(); return { icon: i.width > 0 && i.height > 0, word: w.width > 2 }; });
  assert.equal(look.icon, true, "its icon shows");
  assert.equal(look.word, WIDTH >= 600, WIDTH >= 600 ? "its word shows beside it" : "on a phone the word is only its name, not shown");
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
// ── the search fields show focus (a light-theme finding; every cell checks it) ──
for (const [name, sel, place] of [["C007 project search", "#pf-in", "home"], ["C063 artifact search", "#arts-q", "artifacts"]]) {
  t(`${name}: its box changes when it has focus`, async () => {
    // the project search shows once the list is long: enough projects for it
    const W = sel === "#pf-in" ? { extraChats: Array.from({ length: 12 }, (_, i) => H.chat(`chat_p${i}`, "project", `proj-${i}`)) } : {};
    const page = await app(W);
    await page.evaluate((v) => window.__t.go(v), place);
    if (WIDTH < 600 && sel === "#pf-in") {
      // on a phone the project list is in the drawer: opened as a person opens it, with the menu button
      await page.locator("#pb-menu, #top-menu").filter({ visible: true }).first().click();
      await page.waitForFunction(() => document.querySelector("#app").classList.contains("drawer"));
      await page.waitForTimeout(300); // the drawer done sliding in
    }
    await page.locator(sel).waitFor({ state: "attached", timeout: 20000 }); // the place's own field, once it's drawn
    const box = await page.evaluate((sel) => { const e = document.querySelector(sel); const b = e.parentElement; return { rest: getComputedStyle(b).borderColor }; }, sel);
    await page.locator(sel).focus();
    await page.waitForTimeout(300); // its border eases over --d-hover
    const on = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel).parentElement).borderColor, sel);
    assert.notEqual(on, box.rest, "the box's border changes on focus");
    await done(page);
  });
}

t("C058: the @ list has one active row: the mouse moves it, Enter picks it, the arrows go on from it", async () => {
  const page = await app({ extraChats: Array.from({ length: 3 }, (_, i) => H.chat(`chat_r${i}`, "project", `rcpt-${i}`)) });
  await page.locator("#say").focus();
  await page.keyboard.type("@");
  const rows = page.locator("#at-list li[role=option]");
  await rows.nth(1).waitFor();
  const st = () => page.evaluate(() => { const l = document.querySelector("#at-list"), li = [...l.querySelectorAll("li[role=option]")]; return { active: document.querySelector("#say").getAttribute("aria-activedescendant"), on: li.filter((x) => x.getAttribute("aria-selected") === "true").map((x) => x.id), paint: li.map((x) => getComputedStyle(x).backgroundColor) }; });
  const before = await st();
  assert.deepEqual([before.active, before.on], ["at-0", ["at-0"]], "the first row is the active one");
  // the mouse onto the second row: it becomes the active one, and only it looks it (Astra C058: two rows did)
  const b = await rows.nth(1).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 3 });
  await page.waitForTimeout(150);
  const over = await st();
  assert.deepEqual([over.active, over.on], ["at-1", ["at-1"]], "the row under the mouse is the active one");
  assert.equal(over.paint.filter((c) => c === over.paint[1]).length, 1, `one row painted active: ${JSON.stringify(over.paint)}`);
  // the arrows carry on from it; Enter picks what's highlighted
  await page.keyboard.press("ArrowDown");
  const pid = await rows.nth(2).getAttribute("data-pid");
  assert.equal((await st()).active, "at-2", "↓ from the pointed-at row");
  await page.keyboard.press("Enter");
  assert.match(await page.locator("#say").inputValue(), new RegExp(`^@${pid} `), `Enter picked @${pid}, the highlighted row`);
  await done(page);
});
t("C058 menus: the file's More, opened with the mouse; the mouse onto Copy path, then ↓: one item looks active, the focused one", async () => {
  const page = await app({ files: { "a.js": FILE() } });
  await toDemo(page);
  await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "a.js", path: "a.js", name: "a.js" }));
  const more = page.locator("#viewer [data-vw-more]").filter({ visible: true }).first();
  await more.waitFor();
  await more.click();
  const items = page.locator("#viewer .vw-menu [role=menuitem]");
  await items.nth(1).waitFor();
  const n = await items.count();
  assert.ok(n >= 2, `More has items (${n})`);
  const b = await items.nth(1).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 3 });
  await page.waitForTimeout(150);
  const look = () => page.evaluate(() => { const its = [...document.querySelectorAll("#viewer .vw-menu [role=menuitem]")]; const bg = its.map((x) => getComputedStyle(x).backgroundColor); const rest = getComputedStyle(document.querySelector("#viewer .vw-menu")).backgroundColor; return { focus: its.indexOf(document.activeElement), lit: bg.map((c, i) => (c !== rest && c !== "rgba(0, 0, 0, 0)" ? i : -1)).filter((i) => i >= 0) }; });
  let st = await look();
  assert.deepEqual(st, { focus: 1, lit: [1] }, "the item under the mouse is the active one, and the only one lit");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  st = await look();
  const next = n > 2 ? 2 : 0;
  assert.deepEqual(st, { focus: next, lit: [next] }, "↓ moves it on; the item still under the mouse isn't lit (Astra on e1f8666: both were)");
  await page.keyboard.press("Escape");
  await done(page);
});
t("S170: the long-press Copy copies a message's words: a code block's label and Copy aren't among them", async () => {
  const text = "Run this:\n\n```js\nconst a = 1;\n```\n\nThen check it.";
  const page = await app({ threadsBy: { chat_demo: [serverThread("lp1", "ses-lp")] }, threadPages: { lp1: [AGENT_MSG("lp1", text)] } });
  await page.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { window.__copied.push(t); } } }); });
  await toDemo(page);
  await toThread(page, "lp1");
  const prose = page.locator('#msgs [data-k="lp1-md"] .prose').first();
  await prose.waitFor({ timeout: 15000 });
  await page.waitForTimeout(600); // the view done moving: a scroll closes the menu, by design
  // a long press with a finger, on the words (not the code block, which keeps its own Copy)
  const b = await prose.locator("p").first().boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const pt = { x: b.x + Math.min(24, b.width / 3), y: b.y + Math.min(10, b.height / 2) };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt] });
  await page.waitForTimeout(650);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.locator(".lp-menu [data-lp=copy]").waitFor();
  await page.locator(".lp-menu [data-lp=copy]").click();
  await page.waitForFunction(() => window.__copied.length === 1);
  const got = await page.evaluate(() => window.__copied[0]);
  assert.equal(got, "Run this:\n\nconst a = 1;\n\nThen check it.", `copied: ${JSON.stringify(got)}`);
  await done(page);
});
t("nothing scrolls sideways: a thread with messages and a finished turn, at this width, with a mouse", async () => {
  const text = "A reply with a code block:\n\n```js\nconst a = 1;\n```\n\nAnd a long line that wraps at narrow widths so the bubble is as wide as it gets.";
  const page = await app({ threadsBy: { chat_demo: [serverThread("ow1", "ses-ow")] }, threadPages: { ow1: [AGENT_MSG("ow1", text)] } });
  await toDemo(page);
  await toThread(page, "ow1");
  await page.locator('#msgs [data-k="ow1-md"]').first().waitFor({ timeout: 15000 });
  await feedTurn(page, { id: "ow1", sid: "ses-ow", rows: [{ call_id: "c1", kind: "edit_file", status: "ok", target: "a.js" }, { call_id: "c2", kind: "read_file", status: "ok", target: "b.js" }] });
  await page.waitForTimeout(400);
  // the mouse over the messages: their hover actions show beside the bubbles (where a phone has none)
  const b = await page.locator('#msgs [data-k="ow1-md"]').first().boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 10);
  await page.waitForTimeout(300);
  const w = await page.evaluate(() => { const sc = document.querySelector("#scroller"), m = document.querySelector("#msgs"); return { sc: [sc.clientWidth, sc.scrollWidth], msgs: [m.clientWidth, m.scrollWidth], doc: [document.documentElement.clientWidth, document.documentElement.scrollWidth] }; });
  assert.ok(w.sc[1] <= w.sc[0] + 1, `the conversation's scroller: ${w.sc[1]} wide in ${w.sc[0]} (Conversation's check on dd15034: 438 in 390)`);
  assert.ok(w.doc[1] <= w.doc[0] + 1, `the page: ${w.doc[1]} wide in ${w.doc[0]}`);
  await done(page);
});
t("C111: routing Off, a reply in a thread: Send is on and no Off line shows beside it; a draft naming the Workspace shows it", async () => {
  const page = await app({ router: { mode: "off", decision_model: null, abstain_below: 0.5 }, threadsBy: { chat_demo: [serverThread("rt1", "ses-rt")] }, threadPages: { rt1: [AGENT_MSG("rt1", "Something to reply to.")] } });
  await toDemo(page);
  await toThread(page, "rt1");
  await page.waitForFunction(() => window.__t.world.state.router && window.__t.world.state.router.mode === "off", null, { timeout: 15000 });
  // the test world's stream is a stub that ends at once ("Can't reach XO" would cover any other line): XO is reachable here
  await page.evaluate(() => { const st = window.__t.world.state; st.conn = "live"; st.error = null; st.statusError = null; window.__t.render(); });
  await page.locator("#say").focus();
  await page.keyboard.type("A reply in the thread");
  await page.waitForTimeout(300);
  const st = () => page.evaluate(() => { const hc = document.querySelector("#herald .hr-conn"); return { line: hc ? hc.innerText.replace(/\s+/g, " ").trim() : null, send: !document.querySelector("#send").disabled, paused: /Sending is paused/.test(document.querySelector("#composer")?.innerText || "") }; });
  let s = await st();
  assert.equal(s.send, true, "Send is on: a thread's reply is never routed");
  assert.ok(!s.line || !/off/i.test(s.line), `no Off line beside it (Astra C111-PHONE-CONTEXT-1): ${s.line}`);
  // the same draft, now naming the Workspace (whose routing, the Space's, is off): the line and the paused Send agree
  await page.locator("#say").fill("@workspace A new message");
  await page.waitForTimeout(400);
  s = await st();
  assert.equal(s.send, false, "Send waits");
  assert.ok(s.line && /router is off/i.test(s.line), `the line says so: ${s.line}`);
  await page.locator("#say").fill("");
  await done(page);
});
for (const w of [320, 390]) {
  t(`viewer head at ${w} px (the owner's choice): one row, the name readable, More on screen; Ask about this folds into More`, async () => {
    if (WIDTH >= 600) skip("a phone's widths (320 and 390)");
    const page = await app({ files: { "a-much-longer-file-name.js": FILE() }, changes: [{ path: "a-much-longer-file-name.js", status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:A", patch: PATCH("a-much-longer-file-name.js", "one", "ONE") }] }, { width: w });
    await toDemo(page);
    await page.waitForFunction(() => !!window.__t.CHG.at("demo", "a-much-longer-file-name.js"), null, { timeout: 15000 });
    // a changed, editable text file, showing File: Ask about this, Changes · File, Edit and More in its head
    await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "a-much-longer-file-name.js", path: "a-much-longer-file-name.js", name: "a-much-longer-file-name.js" }));
    await page.locator("#viewer .vw-top [data-vw-edit]").waitFor();
    const g = await page.evaluate(() => {
      const top = document.querySelector("#viewer .vw-top"), r = top.getBoundingClientRect(), vw = innerWidth;
      const box = (sel) => { const e = top.querySelector(sel); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
      return { vw, top: { h: Math.round(r.height) }, name: box("#vw-h"), more: box("[data-vw-more]"), edit: box("[data-vw-edit]"), seg: box(".vw-seg.is-words"), ask: box(".vw-acts .vw-ask"), rows: new Set([...top.querySelectorAll(".vw-acts > *")].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().top))).size };
    });
    assert.ok(g.more && g.more.r <= g.vw, `More on screen: ${JSON.stringify(g.more)} in ${g.vw}`);
    assert.ok(g.name && g.name.w >= 56, `the name readable (a long one, cut with …): ${JSON.stringify(g.name)}`);
    assert.equal(g.ask, null, "Ask about this isn't in the narrow row");
    assert.ok(g.seg && g.edit, "the view switch and Edit stay");
    assert.equal(g.rows, 1, "one row");
    // Ask about this is in More
    await page.locator("#viewer [data-vw-more]").click();
    const ask = page.locator("#viewer .vw-menu [data-vw-askfile]");
    await ask.waitFor();
    assert.ok(await ask.isVisible(), "Ask about this in More");
    await page.keyboard.press("Escape");
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

t("S031: a Send back from Home that didn't go comes back open with its note, and sends it on the next try", async () => {
  const page = await app();
  await homeAsk(page);
  const NOTE = "Keep these words: try the smaller fix first";
  // Space refuses whatever this card sends (both ways a note can go)
  await page.evaluate(() => { const no = async () => { throw Object.assign(new Error("Fixture unavailable"), { status: 503, code: "unavailable" }); }; window.__t.world.act.decide = no; window.__t.world.act.reply = no; });
  await page.waitForTimeout(350); // the card's read beat
  await page.locator("[data-nx-back]").first().click();
  await page.locator("#nx-note-in").fill(NOTE);
  await page.locator("#nx-note-in").press("Enter");
  assert.deepEqual(await homeDecided(page), ["deny"], "queued, its Undo window open");
  // the window runs out, it's sent, Space refuses: the card is back on Home, open on the words
  await page.waitForFunction(() => window.__t.D.decisions().length === 0, null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector("#hm-next .next.noting #nx-note-in")?.getClientRects().length > 0, null, { timeout: 5000 });
  assert.equal(await page.locator("#nx-note-in").inputValue(), NOTE, "the note is still there");
  assert.match(await page.locator("#hm-next .nx-note [role=status]").innerText(), /didn't send/, "it says it didn't send");
  // the next try goes, with the same words
  await page.evaluate(() => { for (const name of ["reply", "decide", "decideItem", "resolve"]) window.__t.world.act[name] = async () => ({}); });
  await page.waitForTimeout(350); // the card's read beat, as it came back
  await page.locator("#nx-note-in").focus();
  await page.keyboard.press("Enter");
  const sent = await page.evaluate(() => window.__t.D.decisions().map((d) => ({ choice: d.choice, note: d.note })));
  assert.deepEqual(sent, [{ choice: "deny", note: NOTE }], "sent back again, with the note");
  await page.evaluate(() => window.__t.D.undo());
  await done(page);
});
// an agent's message as the server pages it, for the selection's Reply to this
const AGENT_MSG = (ts, text) => ({ id: `${ts}-md`, seq: 50, chat_id: "chat_demo", thread_ts: ts, author_kind: "agent", author_id: "agent", author_session_id: null, text, reply_to: null, extra: {}, created_at: NOW });
{
  t("S228/RPL-4: Reply to this (words selected in a message) answers the pointer: hover a step brighter, press another; it quotes them", async () => {
    const page = await app({ threadsBy: { chat_demo: [serverThread("rp1", "ses-rp")] }, threadPages: { rp1: [AGENT_MSG("rp1", "Words to answer, chosen on purpose.")] } });
    await toDemo(page);
    await toThread(page, "rp1");
    await page.locator('#msgs [data-k="rp1-md"] p').first().waitFor({ timeout: 15000 });
    await page.evaluate(() => {
      const p = document.querySelector('#msgs [data-k="rp1-md"] p');
      const r = document.createRange(); r.selectNodeContents(p);
      getSelection().removeAllRanges(); getSelection().addRange(r);
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    const q = page.locator(".mx-qpop:not([hidden])");
    await q.waitFor();
    const look = () => q.evaluate((b) => { const c = getComputedStyle(b), i = getComputedStyle(b.querySelector("svg")); return { bg: c.backgroundColor, line: c.borderTopColor, icon: i.color }; });
    const rest = await look();
    const box = await q.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300); // its colours ease over --d-hover
    const hover = await look();
    assert.notEqual(hover.bg, rest.bg, `hover changes its background (${rest.bg} → ${hover.bg})`);
    assert.notEqual(hover.line, rest.line, "and its edge");
    assert.notEqual(hover.icon, rest.icon, "and its icon");
    await page.mouse.down();
    await page.waitForTimeout(200);
    const pressed = await look();
    assert.notEqual(pressed.bg, hover.bg, `pressed is another step (${hover.bg} → ${pressed.bg})`);
    await page.mouse.up(); // the click: it replies with the words
    await page.locator(".mx-reply").first().waitFor();
    assert.match(await page.locator(".mx-reply .mx-r-t > span").first().textContent(), /Words to answer, chosen on purpose\./, "the selected words are the quote");
    assert.match(await active(page), /id=say/, "focus goes to the message box");
    await done(page);
  });
}

// ── decisions (js/decide.js on its own, with a local world: no app, no API) ──
async function decisions(kind = "approval", count = 1) {
  // at the run's width: the 300 ms rule holds on a phone's cards too (it used to run at 1440 only, skipped at 390)
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: WIDTH < 600 ? 844 : 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript((theme) => { try { localStorage.setItem("cv-theme", theme); } catch { /* none */ } }, THEME); // the cell's theme
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
  // the app's flows at a desktop and a phone width; the decision module's on its own, at both widths too
  // the four cells; FLOWS_CELLS="390 light,1440 dark" runs only those (a rerun of what failed, never the record)
  const cells = [[1440, "dark"], [1440, "light"], [390, "dark"], [390, "light"]]
    .filter(([w, th]) => !process.env.FLOWS_CELLS || process.env.FLOWS_CELLS.split(",").map((x) => x.trim()).includes(`${w} ${th}`));
  for (const [width, theme] of cells) {
    WIDTH = width; THEME = theme;
    for (const { name, fn } of tests) {
      if (only && !only.test(name)) continue;
      const label = `${name} [${width} ${theme}]`;
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
