// A press still clicks while live data redraws around it (the owner, 19 Nov: Back needed several clicks; a folder
// needed a second). Chromium dispatches a click only if the node the press began on is still in the page when it
// ends (mouse_event_manager.cc), and while agents work the app redraws regions several times a second. The rule
// these check: a data update never replaces a control. It changes the control's text and attributes in place, and
// the node under a press (as the one with focus) is never moved or replaced while the new HTML still has it.
//
// On a real DOM (linkedom): node identity across redraws (js/redraw.js), rows under a press in keyed lists
// (js/ui.js reconcile), and the Files tree (js/files.js) while an agent's marks change, with a press held across each
// redraw. Then the write paths themselves, read from the source: no region on the render path is drawn anew.
//   node tests/press-keeps-node.test.mjs   (linkedom: LINKEDOM=<its esm/index.js>, else `npm i linkedom` in ~/.cache/xo-test-deps)
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

// linkedom, outside the repo (it has no dependencies of its own): LINKEDOM, else ~/.cache/xo-test-deps or /tmp/dom
const LD = process.env.LINKEDOM || [join(homedir(), ".cache/xo-test-deps/node_modules/linkedom/esm/index.js"), "/tmp/dom/node_modules/linkedom/esm/index.js"].find((f) => existsSync(f)) || "~/.cache/xo-test-deps";
let passed = 0, skipped = 0;
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const src = (f) => readFileSync(new URL(`../js/${f}`, import.meta.url), "utf8");

// ── the write paths, from the source (no DOM needed) ─────────────────────────
await t("patch() draws a region in place (redraw), never with innerHTML", () => {
  const app = src("app.js");
  const i = app.indexOf("function patch(el, html) {");
  const body = app.slice(i, app.indexOf("\n}\n", i));
  assert.match(body, /redraw\(el, html\); el\._h = html;/);
  assert.doesNotMatch(body, /innerHTML/);
});
await t("Back is written through patch(): only when its name changes, in place", () => {
  const app = src("app.js");
  assert.doesNotMatch(app, /back\.innerHTML\s*=/);
  assert.equal((app.match(/patch\(back, `\$\{ICON\.back\}<span>/g) || []).length, 2, "a thread's Back and a chat's");
});
await t("Files redraws a folder's rows in place; its groups, the ⋯ and a new file's row are the tree's own", () => {
  const f = src("files.js");
  const i = f.indexOf("function sync(s, local, g, ctx) {");
  const body = f.slice(i, f.indexOf("\n  }\n", i));
  assert.match(body, /redraw\(g\.el, rowsHtml\(/);
  assert.doesNotMatch(body, /innerHTML/);
  assert.match(f, /el\.dataset\.flG = p; el\.setAttribute\("data-own", ""\);/, "a group made by sync is the tree's own");
  assert.match(f, /data-fl-g="\$\{esc\(x\.path\)\}" data-own>/, "a group drawn whole is too");
  assert.match(f, /M\.btn\.setAttribute\("data-own", ""\)/, "the ⋯");
  assert.match(f, /el\.className = "fl-new"; el\.setAttribute\("data-own", ""\)/, "a new file's row");
});
await t("the Map draws its boxes, its head and a cursor's tag in place", () => {
  const m = src("map.js");
  assert.doesNotMatch(m, /nodes\.innerHTML\s*=/);
  assert.match(m, /redraw\(nodes, html\)/, "the graph");
  assert.match(m, /redraw\(nodes, nodesHtml\)/, "the tree");
  assert.match(m, /redraw\(hd, h\); M\.head = h;/, "the head");
  assert.match(m, /redraw\(c\.el\.querySelector\("\.dg-tag"\), tag\)/, "a cursor's tag");
});
await t("the other live regions draw in place: away line, Follow, decisions foot, Launchpad, the file's head, send, chip, counts", () => {
  assert.equal((src("recordview.js").match(/if \(box\._h !== html\) \{ redraw\(box, html\);/g) || []).length, 2);
  assert.match(src("stage.js"), /if \(fw\._h !== fh\) \{ redraw\(fw, fh\);/);
  assert.match(src("decide.js"), /redraw\(foot, F\.done \|\| F\.vig \? "" :/);
  const lp = src("launchpad.js");
  assert.match(lp, /redraw\(S\.hs, hs\)/); assert.match(lp, /redraw\(S\.ha, ha\)/); assert.match(lp, /redraw\(S\.body, `<div class="lp/);
  assert.doesNotMatch(lp, /S\.body\.innerHTML\s*=/);
  assert.match(src("viewer.js"), /redrawNode\(top, head\(\)\);/);
  const app = src("app.js");
  assert.match(app, /redraw\(btn, run \? STOP_ICON : ICON\.send\)/);
  assert.match(app, /const swap = \(\) => \{ redraw\(chip, html\); chip\._h = html; \}/);
  assert.match(app, /redraw\(hn, hnHtml\)/); assert.match(app, /redraw\(wn, wnHtml\)/);
  assert.match(app, /redraw\(\$\("#all-list"\), html\)/);
});

// ── on a DOM ──────────────────────────────────────────────────────────────────
if (!existsSync(LD)) {
  skipped++;
  console.log(`  skip the DOM cases: linkedom isn't installed (npm i linkedom in ~/.cache/xo-test-deps, or set LINKEDOM)`);
} else {
  const { parseHTML } = await import(LD);
  const { window, document } = parseHTML(`<!doctype html><html><body><main id="host"></main><div id="viewer"></div></body></html>`);
  Object.assign(globalThis, {
    window, document, HTMLElement: window.HTMLElement, CustomEvent: window.CustomEvent, Event: window.Event,
    CSS: { escape: (s) => String(s).replace(/["\\]/g, "\\$&") },
    requestAnimationFrame: (f) => setTimeout(f, 0), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    innerWidth: 1440, innerHeight: 900, localStorage: { getItem: () => null, setItem() {} },
  });
  globalThis.performance ??= { now: () => Date.now() };
  const ev = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
  /** A press held across `fn`: pointerdown on `node`, fn() (a redraw), then the press ends. True if the node stayed. */
  const pressAcross = async (node, fn) => { ev(node, "pointerdown"); await fn(); const kept = node.isConnected; ev(node, "pointerup"); ev(node, "click"); return kept; };

  const { redraw, redrawNode, pressedNode } = await import("../js/redraw.js");
  const host = document.getElementById("host");

  await t("redraw: a control whose key stays is the same node when its text, class and count change", () => {
    redraw(host, `<button data-go="t:a" class="nw st-busy"><b>Alpha</b><span>1 of 4</span></button><button data-go="t:b" class="nw"><b>Beta</b></button>`);
    const a = host.querySelector('[data-go="t:a"]'), b = host.querySelector('[data-go="t:b"]'), label = a.querySelector("b");
    redraw(host, `<button data-go="t:a" class="nw st-idle"><b>Alpha</b><span>2 of 4</span></button><button data-go="t:b" class="nw st-busy"><b>Beta</b><i></i></button>`);
    assert.equal(host.querySelector('[data-go="t:a"]'), a); assert.equal(host.querySelector('[data-go="t:b"]'), b);
    assert.equal(a.querySelector("b"), label, "the label a press lands on");
    assert.equal(a.className, "nw st-idle"); assert.equal(a.querySelector("span").textContent, "2 of 4");
  });
  await t("redraw: the node under a press is never moved when the list reorders; what's drawn moves around it", async () => {
    redraw(host, `<button data-go="t:a"><b>A</b></button><button data-go="t:b"><b>B</b></button><button data-go="t:c"><b>C</b></button>`);
    const c = host.querySelector('[data-go="t:c"] b');
    const kept = await pressAcross(c, () => {
      assert.equal(pressedNode(), c, "the press is known");
      redraw(host, `<button data-go="t:c"><b>C</b></button><button data-go="t:a"><b>A</b></button><button data-go="t:b"><b>B</b></button>`);
    });
    assert.ok(kept, "the pressed label stayed in the page");
    assert.deepEqual([...host.children].map((x) => x.dataset.go), ["t:c", "t:a", "t:b"], "and the order is the new one");
    assert.equal(pressedNode(), null, "a click ends the press");
  });
  await t("redraw: a press doesn't keep what the new HTML no longer has (the thing it stood for went)", async () => {
    redraw(host, `<button data-go="t:a">A</button><button data-go="t:b">B</button>`);
    const b = host.querySelector('[data-go="t:b"]');
    const kept = await pressAcross(b, () => redraw(host, `<button data-go="t:a">A</button>`));
    assert.equal(kept, false);
  });
  await t("redrawNode: an element redrawn as itself stays the same node, its insides in place", () => {
    host.innerHTML = `<header class="vw-top"><button data-vw-edit>Edit</button><span class="vw-n">a.md</span></header>`;
    const top = host.firstElementChild, edit = top.querySelector("[data-vw-edit]");
    const now = redrawNode(top, `<header class="vw-top is-upd"><button data-vw-edit>Edit</button><span class="vw-n">a.md · Updated</span></header>`);
    assert.equal(now, top); assert.equal(top.querySelector("[data-vw-edit]"), edit);
    assert.equal(top.className, "vw-top is-upd"); assert.equal(top.querySelector(".vw-n").textContent, "a.md · Updated");
  });

  const { reconcile } = await import("../js/ui.js");
  await t("reconcile: a row that is itself the button, changed while pressed, is updated in place", async () => {
    const box = document.createElement("div"); host.replaceChildren(box);
    const row = (busy) => `<button type="button" class="prow${busy ? " is-busy" : ""}" data-go="p:x"><span class="pr-n">X</span>${busy ? "<i class=\"pr-busy\"></i>" : ""}</button>`;
    reconcile(box, [{ key: "x", html: row(false) }], { quiet: true });
    const el = box.firstElementChild, name = el.querySelector(".pr-n");
    const kept = await pressAcross(name, () => reconcile(box, [{ key: "x", html: row(true) }], { quiet: true }));
    assert.ok(kept, "the pressed name stayed");
    assert.equal(box.firstElementChild, el, "the row is the same node");
    assert.ok(el.classList.contains("is-busy"), "and shows the change");
  });

  await t("reconcile inPlace: switching project, the row you leave keeps its line (its entrance isn't replayed)", () => {
    const box = document.createElement("div"); host.replaceChildren(box);
    const row = (id, on) => `<button type="button" class="prow busy${on ? " is-on" : ""}" data-go="p:${id}"><span class="pr-ic"></span><span class="pr-main"><span class="pr-l1"><span class="pr-name">${id}</span></span><span class="pr-t">2 threads working</span></span></button>`;
    reconcile(box, [{ key: "a", html: row("a", true) }, { key: "b", html: row("b", false) }], { quiet: true, inPlace: true });
    const a = box.firstElementChild, line = a.querySelector(".pr-t"), ic = a.querySelector(".pr-ic");
    reconcile(box, [{ key: "a", html: row("a", false) }, { key: "b", html: row("b", true) }], { quiet: true, inPlace: true });
    assert.equal(box.firstElementChild, a, "the row you left is the same node");
    assert.equal(a.querySelector(".pr-t"), line, "its line too: nothing replays its rise-in");
    assert.equal(a.querySelector(".pr-ic"), ic, "nor restarts its tile's orbit");
    assert.ok(!a.classList.contains("is-on") && box.lastElementChild.classList.contains("is-on"), "where you are moved");
    // the sidebar asks for it
    assert.match(src("app.js"), /reconcile\(\$\("#projects"\), items, \{ quiet: !sideRender\.ready, inPlace: true \}\);/);
  });

  // Files: js/files.js on its real redraw, with its other imports stood in for (a folder of copies, as the app has them)
  const dir = mkdtempSync(join(tmpdir(), "files-press-"));
  try {
    // the pure modules it uses as they are (Find: fuzzy ranking over every path in the place)
    for (const f of ["files.js", "redraw.js", "fuzzy.js", "paths.js"]) copyFileSync(new URL(`../js/${f}`, import.meta.url), join(dir, f));
    writeFileSync(join(dir, "package.json"), '{"type":"module"}');
    writeFileSync(join(dir, "focusview.js"), "export const inSight = () => true; export const bringWhole = () => {};");
    writeFileSync(join(dir, "util.js"), 'export const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); export const copyText = async () => true; export const COPY_REFUSED = ""; export const space = () => 0;');
    writeFileSync(join(dir, "ui.js"), 'export const ICON = new Proxy({}, { get: () => "<i></i>" });');
    writeFileSync(join(dir, "api.js"), "export const calls = []; export const api = { projectTree: (project, rel) => new Promise((res) => calls.push({ project, rel, res })) };");
    writeFileSync(join(dir, "map.js"), 'export const MARKS = { files: new Map() }; export const activityOf = () => ({ files: MARKS.files }); export const folderOf = () => ({ root: "/w/p", base: "", project: "p", projectRoot: "/w/p" });');
    writeFileSync(join(dir, "fileicons.js"), 'export const fileIcon = () => "<i></i>"; export const folderIcon = () => "<i></i>";');
    writeFileSync(join(dir, "changesframe.js"), 'export const countsHtml = () => "";');
    writeFileSync(join(dir, "viewer.js"), "export const RUNS = /^(\\.git|\\.claude)\\//;");
    writeFileSync(join(dir, "keynav.js"), "export const pointerFollows = () => {};");
    // the copy registers its own press listener on the same document: both see the same presses
    const { createFiles } = await import(join(dir, "files.js"));
    const { calls } = await import(join(dir, "api.js"));
    const { MARKS } = await import(join(dir, "map.js"));
    const world = { state: { turns: [], threads: [{ id: "t1", project: "p", sessionId: "s", title: "Agent" }], projects: [{ id: "p", name: "P" }] }, thread: () => null };
    const viewer = { hasFile: false, file: null, open() {}, close() {} };
    const FILES = createFiles({ world, viewer, isBusy: () => true, PROJ: (id) => id.toUpperCase(), go() {} });
    const fh = document.createElement("div"); host.replaceChildren(fh); fh.getBoundingClientRect = () => ({ width: 400 });
    FILES.mount(fh); FILES.show("p:p");
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const answer = async (rel, dirs, files) => { const c = calls.find((x) => x.rel === rel && !x.done); c.done = 1; c.res({ dirs: dirs.map((n) => ({ name: n.split("/").pop(), relative_path: n })), files: files.map((n) => ({ name: n.split("/").pop(), relative_path: n, size_bytes: 1 })) }); await tick(); await tick(); };
    const row = (p) => fh.querySelector(`.fl-list [data-fl-dir="${p}"]`);
    const mark = (path, live) => { MARKS.files = new Map([[path, { path, mark: live ? "read" : "edited", live, seq: 1 }]]); FILES.render("p:p"); };
    await answer("", ["a", "b", "c"], ["README.md"]);

    await t("Files: an agent's mark changing in a folder keeps every row above it the same node", () => {
      const before = ["a", "b", "c"].map(row);
      mark("b/x.js", true);
      assert.deepEqual(["a", "b", "c"].map(row), before, "the top folders' rows weren't replaced");
      assert.ok(row("b").querySelector(".fl-who"), "and b shows the mark");
      mark("b/x.js", false);
      assert.deepEqual(["a", "b", "c"].map(row), before);
    });
    await t("Files: a folder pressed while marks change still opens on that press (its row stays in the page)", async () => {
      const name = row("c").querySelector(".fl-n");
      const kept = await pressAcross(name, () => { mark("a/y.js", true); mark("a/y.js", false); mark("c/z.js", true); });
      assert.ok(kept, "the pressed name stayed in the page");
      assert.equal(row("c").getAttribute("aria-expanded"), "true", "the click opened it");
      assert.match(fh.querySelector('[data-fl-g="c"]').textContent, /Reading/);
      await answer("c", ["c/d"], ["c/z.js"]);
      const g = fh.querySelector('[data-fl-g="c"]');
      assert.equal(row("c").nextElementSibling, g, "its group follows its row");
      assert.deepEqual([...g.querySelectorAll("[data-fl-dir],[data-fl-file]")].map((x) => x.dataset.flDir || x.dataset.flFile), ["c/d", "c/z.js"]);
    });
    await t("Files: an open folder's group survives its parent's rows redrawing (a mark ripples up)", async () => {
      row("c/d").querySelector(".fl-n").dispatchEvent(new window.Event("click", { bubbles: true }));
      await answer("c/d", [], ["c/d/e.md"]);
      const g = fh.querySelector('[data-fl-g="c/d"]'), file = g.querySelector('[data-fl-file="c/d/e.md"]');
      mark("c/d/e.md", true);
      assert.equal(fh.querySelector('[data-fl-g="c/d"]'), g, "the same group");
      assert.equal(g.querySelector('[data-fl-file="c/d/e.md"]'), file, "the same row");
      assert.equal(row("c/d").nextElementSibling, g);
      assert.ok(row("c").querySelector(".fl-who") && row("c/d").querySelector(".fl-who"), "the mark shows on each folder above");
    });
    await t("Files: closing and opening again puts the folder's group back after its row, once", () => {
      row("c").querySelector(".fl-n").dispatchEvent(new window.Event("click", { bubbles: true }));
      assert.equal(fh.querySelectorAll('[data-fl-g="c"]').length, 0, "closed: its group left the page");
      row("c").querySelector(".fl-n").dispatchEvent(new window.Event("click", { bubbles: true }));
      assert.equal(fh.querySelectorAll('[data-fl-g="c"]').length, 1);
      assert.equal(row("c").nextElementSibling, fh.querySelector('[data-fl-g="c"]'));
    });
    // the owner, 19 Nov: a folder stuck on "Reading…" until clicked again. A file opened from elsewhere (Changed, a chip)
    // opens every folder down to it and reads them one after another; the app renders between the reads, and each render
    // gives F.scope a new object, so a "same place?" check by identity stopped after the first read
    await t("Files: a file opened from elsewhere reads every folder down to it, the app rendering around each read", async () => {
      const rev = FILES.reveal({ project: "p", rel: "b/q/r/s.md", name: "s.md" });
      for (const [rel, dirs, files] of [["b", ["b/q"], []], ["b/q", ["b/q/r"], []], ["b/q/r", [], ["b/q/r/s.md"]]]) {
        FILES.render("p:p"); // as the stream does, several times a second
        await tick(); await tick();
        assert.ok(calls.some((c) => c.rel === rel && !c.done), `${rel} is read (requests: ${calls.filter((c) => !c.done).map((c) => c.rel).join(", ") || "none"})`);
        await answer(rel, dirs, files);
        FILES.render("p:p");
      }
      await rev;
      for (const p of ["b", "b/q", "b/q/r"]) {
        assert.equal(row(p).getAttribute("aria-expanded"), "true", `${p} open`);
        assert.doesNotMatch(fh.querySelector(`[data-fl-g="${p}"]`).textContent, /Reading/, `${p} shows its rows`);
      }
      assert.ok(fh.querySelector('[data-fl-g="b/q/r"] [data-fl-file="b/q/r/s.md"]'), "the file is there to be marked");
    });
    await t("Files: an open folder that nothing has read starts its read where it's drawn, so Reading… always has a read", () => {
      const f = readFileSync(new URL("../js/files.js", import.meta.url), "utf8");
      const i = f.indexOf("function sync(s, local, g, ctx) {"), body = f.slice(i, f.indexOf("\n  }\n", i));
      assert.match(body, /if \(!F\.dirs\.has\(dkey\(s, p\)\)\) load\(s, p\);/);
      assert.doesNotMatch(f, /F\.scope !== s\b/, "a place is the same place by its key, never by the object");
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
console.log(`\n${passed} passed${skipped ? `, ${skipped} skipped (said above)` : ""}${process.exitCode ? ", some FAILED" : ""}`);
