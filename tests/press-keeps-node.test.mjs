import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";

let passed = 0;
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};


{
  const { window } = await dom(`<main id="host"></main><div id="viewer"></div>`);
  Object.assign(globalThis, { innerWidth: 1440, innerHeight: 900, localStorage: { getItem: () => null, setItem() {} } });
  globalThis.cancelAnimationFrame ??= clearTimeout;
  globalThis.performance ??= { now: () => Date.now() };
  const ev = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
  /** A press held across `fn`: pointerdown on `node`, fn() (a redraw), then the press ends. True if the node stayed. */
  const pressAcross = async (node, fn) => { ev(node, "pointerdown"); await fn(); const kept = node.isConnected; ev(node, "pointerup"); ev(node, "click"); return kept; };

  const { redraw, redrawNode, pressedNode } = await import("../core/ui/redraw.js");
  const { landed } = await import("../core/ui/landing.js");
  const host = document.getElementById("host");

  await t("redraw keeps matching controls and focuses the replacement when a control changes tag", () => {
    assert.equal(redraw(host, '<button data-fid="back">Back</button>'), true);
    const back = host.firstElementChild;
    back.focus();
    const renamed = '<button data-fid="back">Back to Home</button>';
    assert.equal(redraw(host, renamed), true);
    assert.ok(host.firstElementChild === back, "changing the label keeps the control");
    assert.equal(back.textContent, "Back to Home");
    assert.equal(redraw(host, renamed), false, "the matching DOM needs no changes");
    redraw(host, '<a href="/" data-fid="back">Back to Home</a>');
    assert.ok(host.firstElementChild !== back, "the link replaces the button");
    assert.ok(document.activeElement === host.firstElementChild, "focus follows the replacement");
  });

  await t("redraw restores nested text drift from identical markup without moving focus", () => {
    const html = "<section><button>Saved</button></section>";
    redraw(host, html);
    const section = host.firstElementChild, button = section.firstElementChild;
    button.focus();
    button.textContent = "Stale";
    assert.equal(redraw(host, html), true);
    assert.equal(button.textContent, "Saved");
    assert.ok(host.firstElementChild === section && section.firstElementChild === button);
    assert.ok(document.activeElement === button);
  });

  await t("redraw reapplies live control state from identical markup", () => {
    const html = '<input type="checkbox" checked>';
    redraw(host, html);
    const input = host.firstElementChild;
    input.checked = false;
    assert.equal(redraw(host, html), true);
    assert.ok(host.firstElementChild === input);
    assert.equal(input.checked, true);
  });

  await t("redraw reevaluates which nodes to preserve when markup is identical", () => {
    const html = "<p>Saved</p>";
    host.innerHTML = "<aside>Keep for now</aside>";
    const aside = host.firstElementChild;
    redraw(host, html, { preserve: (node) => node === aside });
    assert.ok(aside.isConnected);
    const paragraph = host.lastElementChild;
    assert.equal(redraw(host, html, { preserve: () => false }), true);
    assert.ok(!aside.isConnected && host.firstElementChild === paragraph);
  });

  await t("landed staggers the arrival of a skeleton's children once", () => {
    const delays = [];
    const animate = window.Element.prototype.animate;
    window.Element.prototype.animate = (_, options) => delays.push(options.delay);
    try {
      host.innerHTML = "<span>A</span><span>B</span>";
      host._sk = true;
      landed(host);
      landed(host);
      assert.deepEqual(delays, [0, 40]);
    } finally {
      window.Element.prototype.animate = animate;
    }
  });

  await t("redraw: a control whose key stays is the same node when its text, class and count change", () => {
    redraw(host, `<button data-go="t:a" class="nw st-busy"><b>Alpha</b><span>1 of 4</span></button><button data-go="t:b" class="nw"><b>Beta</b></button>`);
    const a = host.querySelector('[data-go="t:a"]'), b = host.querySelector('[data-go="t:b"]'), label = a.querySelector("b");
    redraw(host, `<button data-go="t:a" class="nw st-idle"><b>Alpha</b><span>2 of 4</span></button><button data-go="t:b" class="nw st-busy"><b>Beta</b><i></i></button>`);
    assert.ok(host.querySelector('[data-go="t:a"]') === a); assert.ok(host.querySelector('[data-go="t:b"]') === b);
    assert.ok(a.querySelector("b") === label, "the label a press lands on");
    assert.equal(a.className, "nw st-idle"); assert.equal(a.querySelector("span").textContent, "2 of 4");
  });
  await t("redraw: the node under a press is never moved when the list reorders; what's drawn moves around it", async () => {
    redraw(host, `<button data-go="t:a"><b>A</b></button><button data-go="t:b"><b>B</b></button><button data-go="t:c"><b>C</b></button>`);
    const c = host.querySelector('[data-go="t:c"] b');
    const kept = await pressAcross(c, () => {
      assert.ok(pressedNode() === c, "the press is known");
      redraw(host, `<button data-go="t:c"><b>C</b></button><button data-go="t:a"><b>A</b></button><button data-go="t:b"><b>B</b></button>`);
    });
    assert.ok(kept, "the pressed label stayed in the page");
    assert.deepEqual([...host.children].map((x) => x.dataset.go), ["t:c", "t:a", "t:b"], "and the order is the new one");
    assert.ok(pressedNode() === null, "a click ends the press");
  });
  await t("redraw: a press doesn't keep what the new HTML no longer has (the thing it stood for went)", async () => {
    redraw(host, `<button data-go="t:a">A</button><button data-go="t:b">B</button>`);
    const b = host.querySelector('[data-go="t:b"]');
    const kept = await pressAcross(b, () => redraw(host, `<button data-go="t:a">A</button>`));
    assert.equal(kept, false);
  });
  await t("redrawNode: an element redrawn as itself stays the same node, its insides in place", () => {
    host.innerHTML = `<header class="vw-top"><button data-vw-edit>Edit</button><span class="fixture-name">a.md</span></header>`;
    const top = host.firstElementChild, edit = top.querySelector("[data-vw-edit]");
    const now = redrawNode(top, `<header class="vw-top is-upd"><button data-vw-edit>Edit</button><span class="fixture-name">a.md · Updated</span></header>`);
    assert.ok(now === top); assert.ok(top.querySelector("[data-vw-edit]") === edit);
    assert.equal(top.className, "vw-top is-upd");
    assert.equal(top.querySelector(".fixture-name").textContent, "a.md · Updated");
  });

  const { reconcile } = await import("../core/ui/redraw.js");
  await t("reconcile: a row that is itself the button, changed while pressed, is updated in place", async () => {
    const box = document.createElement("div"); host.replaceChildren(box);
    const row = (busy) => `<button type="button" class="prow${busy ? " is-busy" : ""}" data-go="p:x"><span class="pr-n">X</span>${busy ? "<i class=\"pr-busy\"></i>" : ""}</button>`;
    reconcile(box, [{ key: "x", html: row(false) }], { quiet: true });
    const el = box.firstElementChild, name = el.querySelector(".pr-n");
    const kept = await pressAcross(name, () => reconcile(box, [{ key: "x", html: row(true) }], { quiet: true }));
    assert.ok(kept, "the pressed name stayed");
    assert.ok(box.firstElementChild === el, "the row is the same node");
    assert.ok(el.classList.contains("is-busy"), "and shows the change");
  });

  await t("reconcile: switching project, the row you leave keeps its line (its entrance isn't replayed)", () => {
    const box = document.createElement("div"); host.replaceChildren(box);
    const row = (id, on) => `<button type="button" class="prow busy${on ? " is-on" : ""}" data-go="p:${id}"><span class="pr-ic"></span><span class="pr-main"><span class="pr-l1"><span class="pr-name">${id}</span></span><span class="pr-t">2 threads working</span></span></button>`;
    // identities compared as booleans: a failing equal() on DOM nodes prints all of linkedom (out of memory)
    reconcile(box, [{ key: "a", html: row("a", true) }], { quiet: true });
    reconcile(box, [{ key: "a", html: row("a", true) }, { key: "b", html: row("b", false) }], { quiet: true });
    const a = box.firstElementChild, line = a.querySelector(".pr-t"), ic = a.querySelector(".pr-ic");
    // one row changing first
    reconcile(box, [{ key: "a", html: row("a", false) }, { key: "b", html: row("b", false) }], { quiet: true });
    assert.ok(box.firstElementChild === a, "a changed row is the same node");
    // then a switch: two rows change in one draw
    reconcile(box, [{ key: "a", html: row("a", true) }, { key: "b", html: row("b", false) }], { quiet: true });
    reconcile(box, [{ key: "a", html: row("a", false) }, { key: "b", html: row("b", true) }], { quiet: true });
    assert.ok(box.firstElementChild === a, "the row you left is the same node");
    assert.ok(a.querySelector(".pr-t") === line, "its line too: nothing replays its rise-in");
    assert.ok(a.querySelector(".pr-ic") === ic, "nor restarts its tile's orbit");
    assert.ok(!a.classList.contains("is-on") && box.lastElementChild.classList.contains("is-on"), "where you are moved");
  });

  {
    const { createFiles } = await import("../modules/files/files.js");
    const calls = [];
    globalThis.fetch = (url) => new Promise((res) => {
      const path = new URL(String(url), "https://local.test/");
      assert.match(path.pathname, /\/xo-projects\/p\/tree$/);
      calls.push({ rel: path.searchParams.get("relative_path") || "", res });
    });
    globalThis.removeEventListener = (...args) => window.removeEventListener(...args);
    const activity = new Map();
    const turn = { session: "s", status: "running" };
    const world = {
      state: {
        turns: { list: (filter) => [turn].filter(filter), blocksOf: () => [{ type: "activity", rows: [...activity.values()] }] },
        threads: [{ id: "t1", project: "p", cwd: "/w/p", sessionId: "s", title: "Agent" }],
        projects: [{ id: "p", name: "P" }],
      },
      thread: () => null,
    };
    const viewer = { hasFile: false, file: null, open() {}, close() {} };
    const FILES = createFiles({ world, viewer, isBusy: () => true, PROJ: (id) => id.toUpperCase(), go() {} });
    const fh = document.createElement("div"); host.replaceChildren(fh); fh.getBoundingClientRect = () => ({ width: 400 });
    FILES.mount(fh); FILES.show("p:p");
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const answer = async (rel, dirs, files) => { const c = calls.find((x) => x.rel === rel && !x.done); c.done = 1; c.res(Response.json({ dirs: dirs.map((n) => ({ name: n.split("/").pop(), relative_path: n })), files: files.map((n) => ({ name: n.split("/").pop(), relative_path: n, size_bytes: 1 })) })); await tick(); await tick(); };
    const row = (p) => fh.querySelector(`.fl-list [data-fl-dir="${p}"]`);
    const mark = (path, live) => { activity.clear(); activity.set(path, { target: `/w/p/${path}`, kind: "edit_file", status: live ? "running" : "completed" }); FILES.render("p:p"); };
    await answer("", ["a", "b", "c"], ["README.md"]);

    await t("Files: an agent's mark changing in a folder keeps every row above it the same node", () => {
      const before = ["a", "b", "c"].map(row);
      mark("b/x.js", true);
      assert.ok(["a", "b", "c"].every((key, index) => row(key) === before[index]), "the top folders' rows weren't replaced");
      assert.ok(row("b").querySelector(".fl-who"), "and b shows the mark");
      mark("b/x.js", false);
      assert.ok(["a", "b", "c"].every((key, index) => row(key) === before[index]));
    });
    await t("Files: a folder pressed while marks change still opens on that press (its row stays in the page)", async () => {
      const name = row("c").querySelector(".fl-n");
      const kept = await pressAcross(name, () => { mark("a/y.js", true); mark("a/y.js", false); mark("c/z.js", true); });
      assert.ok(kept, "the pressed name stayed in the page");
      assert.equal(row("c").getAttribute("aria-expanded"), "true", "the click opened it");
      assert.match(fh.querySelector('[data-fl-g="c"]').textContent, /Reading/);
      await answer("c", ["c/d"], ["c/z.js"]);
      const g = fh.querySelector('[data-fl-g="c"]');
      assert.ok(row("c").nextElementSibling === g, "its group follows its row");
      assert.deepEqual([...g.querySelectorAll("[data-fl-dir],[data-fl-file]")].map((x) => x.dataset.flDir || x.dataset.flFile), ["c/d", "c/z.js"]);
    });
    await t("Files: an open folder's group survives its parent's rows redrawing (a mark ripples up)", async () => {
      row("c/d").querySelector(".fl-n").dispatchEvent(new window.Event("click", { bubbles: true }));
      await answer("c/d", [], ["c/d/e.md"]);
      const g = fh.querySelector('[data-fl-g="c/d"]'), file = g.querySelector('[data-fl-file="c/d/e.md"]');
      mark("c/d/e.md", true);
      assert.ok(fh.querySelector('[data-fl-g="c/d"]') === g, "the same group");
      assert.ok(g.querySelector('[data-fl-file="c/d/e.md"]') === file, "the same row");
      assert.ok(row("c/d").nextElementSibling === g);
      assert.ok(row("c").querySelector(".fl-who") && row("c/d").querySelector(".fl-who"), "the mark shows on each folder above");
    });
    await t("Files: closing and opening again puts the folder's group back after its row, once", () => {
      row("c").querySelector(".fl-n").dispatchEvent(new window.Event("click", { bubbles: true }));
      assert.equal(fh.querySelectorAll('[data-fl-g="c"]').length, 0, "closed: its group left the page");
      row("c").querySelector(".fl-n").dispatchEvent(new window.Event("click", { bubbles: true }));
      assert.equal(fh.querySelectorAll('[data-fl-g="c"]').length, 1);
      assert.ok(row("c").nextElementSibling === fh.querySelector('[data-fl-g="c"]'));
    });
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
    await t("Files keeps the More button and naming field across live redraws", async () => {
      row("c").focus();
      const more = fh.querySelector('[data-fl-more="c"]');
      const changes = new window.MutationObserver(() => {});
      changes.observe(fh, { childList: true, subtree: true });
      assert.ok(await pressAcross(more, () => {
        mark("c/z.js", true);
        const removed = changes.takeRecords().flatMap((record) => [...record.removedNodes]);
        assert.equal(removed.some((el) => el === more || el.contains?.(more)), false);
      }));
      changes.disconnect();
      assert.equal(fh.querySelector('[data-fl-more="c"]') === more, true);
      const menu = document.querySelector(".fl-menu");
      assert.equal(menu.hidden, false);
      ev(menu.querySelector("[data-fl-mk]"), "click");
      const input = fh.querySelector("[data-fl-name]");
      input.value = "draft.md";
      ev(input, "input");
      mark("c/z.js", false);
      assert.equal(fh.querySelector("[data-fl-name]") === input, true);
      assert.equal(document.activeElement === input, true);
      assert.equal(input.value, "draft.md");
    });
  }
}
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
