// Open files as documents (modules/files/documents.js): states, saving on ⌘S only (no autosave), saving against the version, someone else's change coming
// in (taken in, merged, or the merge view), drafts, versions. Pure, with a fake clock, a fake Space and a stand-in
// for localStorage.
//   node tests/docs.test.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createScope } from "../core/kernel/scope.js";
import { createDocs, refusal, changedLines, minimalEdit, byWords, MERGE_MS } from "../modules/files/documents.js";
import { draftKey, getDraft, putDraft } from "../modules/files/drafts.js";

let passed = 0;
const queue = [];
const t = (name, fn) => queue.push([name, fn]);

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), raw: m }; };
function fakeClock() {
  let now = 1000, id = 0;
  const timers = new Map();
  return {
    now: () => now,
    set: (f, ms) => { const i = ++id; timers.set(i, { at: now + ms, f }); return i; },
    clear: (i) => timers.delete(i),
    async tick(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]); now = due[1].at; due[1].f();
        await settle();
      }
      now = end;
      await settle();
    },
    pending: () => timers.size,
  };
}
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const sha = (s) => "sha256:" + createHash("sha256").update(s).digest("hex");
function fakeSpace(files = {}) {
  const disk = new Map(Object.entries(files));
  const S = {
    disk, saves: [], reads: 0, refuse: null, hold: null,
    async projectFile(project, rel) { S.reads++; const c = disk.get(rel); if (c == null) { const e = new Error("gone"); e.status = 404; throw e; } return { content: c, version: sha(c), editable: true, kind: "markdown" }; },
    async saveProjectFile(project, rel, content, base, confirm, opts) {
      S.saves.push({ rel, content, base, confirm, restoreOf: opts && opts.restoreOf || null });
      if (S.hold) await S.hold;
      if (S.refuse) { const r = S.refuse(rel, content, base, confirm); if (r) throw r; }
      const cur = disk.get(rel);
      if (base == null ? cur != null : cur == null || sha(cur) !== base) {
        const e = new Error("changed"); e.status = 409; e.code = "file_changed"; e.current = cur == null ? null : { content: cur, version: sha(cur) }; throw e;
      }
      disk.set(rel, content);
      return { version: sha(content), saved_at: "t", edit_id: "e_" + S.saves.length };
    },
  };
  return S;
}
// a view: its own text, as an editor holds it
function fakeView(docs, d) {
  const v = { text: docs.textOf(d), applied: [] };
  docs.attach(d, { source: () => v.text, apply: (e, info) => { v.text = v.text.slice(0, e.from) + e.insert + v.text.slice(e.to); v.applied.push(info); } });
  v.type = (s) => { v.text = s; docs.edited(d); };
  return v;
}
const setup = (files = { "a.md": "one\ntwo\nthree\n" }) => {
  const clock = fakeClock(), space = fakeSpace(files), store = mem(), events = [];
  const scope = createScope();
  const docs = createDocs({ api: space, store, clock, scope, onChange: (d, what) => events.push(what) });
  return { clock, space, store, docs, events, scope };
};
const openDoc = async (docs, space, rel = "a.md") => docs.open("p", rel, await space.projectFile("p", rel));

t("pure: refusal words, changed lines, minimal edit, who made it", () => {
  assert.equal(refusal({ status: 428, code: "confirm_required" }).kind, "confirm");
  assert.equal(refusal({ status: 409, code: "file_changed", current: { content: "x", version: "v" } }).kind, "changed");
  assert.equal(refusal({ status: 409, code: "file_changed", current: null }).kind, "deleted");
  assert.equal(refusal({ status: 403, code: "read_only_place" }).kind, "readonly");
  assert.equal(refusal(new Error("fetch failed")).kind, "offline");
  assert.deepEqual(changedLines("a\nb\nc\n", "a\nB\nc\n"), [{ from: 2, to: 2 }]);
  assert.deepEqual(changedLines("a\nb\n", "a\nb\nc\nd\n"), [{ from: 3, to: 4 }]);
  assert.deepEqual(minimalEdit("hello world", "hello brave world"), { from: 6, to: 6, insert: "brave " });
  assert.equal(minimalEdit("same", "same"), null);
  assert.equal(byWords({ kind: "ui" }), "You");
  assert.equal(byWords({ kind: "agent", thread_ts: "t1" }, (ts) => (ts === "t1" ? "Pricing page" : null)), "Pricing page");
  assert.equal(byWords({ kind: "disk" }), "Changed on disk");
});

t("typing never saves by itself: the file is unsaved until ⌘S, which saves against the version it started from", async () => {
  const { clock, space, docs, store } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  assert.equal(d.state, "saved");
  v.type("one\ntwo!\nthree\n");
  assert.equal(d.state, "dirty");
  await clock.tick(60000);
  assert.equal(space.saves.length, 0, "a minute later, still nothing written");
  assert.equal(getDraft(store, draftKey("p", "a.md")).text, "one\ntwo!\nthree\n", "but kept in this browser");
  await docs.flush(d); await settle();
  assert.equal(space.saves.length, 1);
  assert.equal(space.saves[0].base, sha("one\ntwo\nthree\n"));
  assert.equal(d.state, "saved");
  assert.equal(space.disk.get("a.md"), "one\ntwo!\nthree\n");
  assert.equal(getDraft(store, draftKey("p", "a.md")), null, "saved: the draft goes");
  assert.deepEqual(d.versions[1].by, { kind: "ui" });
});

t("typing while a save is out stays unsaved for the next ⌘S; ⌘S pressed again meanwhile saves it", async () => {
  const { space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("x\n");
  let release; space.hold = new Promise((r) => (release = r));
  const p = docs.flush(d);
  assert.equal(d.state, "saving");
  v.type("xy\n");
  release(); space.hold = null; await p; await settle();
  assert.equal(space.disk.get("a.md"), "x\n", "what was sent is saved");
  assert.equal(d.state, "dirty", "what you typed since is unsaved");
  await docs.flush(d); await settle();
  assert.equal(space.disk.get("a.md"), "xy\n");
  assert.equal(d.state, "saved");
});

t("someone else's change, while you have nothing unsaved: taken in place as a new version, lines marked", async () => {
  const { space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  space.disk.set("a.md", "one\nTWO\nthree\n");
  await docs.changed("p", "a.md", { version: sha("one\nTWO\nthree\n"), by: { kind: "agent", thread_ts: "t1" } });
  assert.equal(v.text, "one\nTWO\nthree\n");
  assert.equal(d.state, "saved");
  assert.deepEqual(v.applied[0].lines, [{ from: 2, to: 2 }]);
  assert.equal(d.versions.length, 2);
  assert.equal(d.versions[1].by.kind, "agent");
  assert.equal(space.saves.length, 0, "nothing is saved back");
});

t("someone else's change while you have unsaved text: merged into yours, still unsaved until ⌘S", async () => {
  const { clock, space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("ONE\ntwo\nthree\n");
  space.disk.set("a.md", "one\ntwo\nTHREE\n");
  await docs.changed("p", "a.md", { version: sha("one\ntwo\nTHREE\n"), by: { kind: "agent" } });
  assert.equal(v.text, "ONE\ntwo\nTHREE\n", "both kept");
  assert.equal(d.state, "dirty");
  await clock.tick(60000);
  assert.equal(space.saves.length, 0);
  await docs.flush(d); await settle();
  assert.equal(space.disk.get("a.md"), "ONE\ntwo\nTHREE\n");
  assert.equal(space.saves.at(-1).base, sha("one\ntwo\nTHREE\n"), "saved against theirs");
});

t("⌘S that finds the file changed (409) merges and saves on top; the same lines go to the merge view, then save", async () => {
  const { space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("one\ntwo\nthree\nfour\n");
  space.disk.set("a.md", "zero\none\ntwo\nthree\n"); // unseen change (bash): only the save finds it
  await docs.flush(d); await settle(); await settle();
  assert.equal(space.disk.get("a.md"), "zero\none\ntwo\nthree\nfour\n");
  assert.equal(d.state, "saved");
  v.type("zero\none\nTWO mine\nthree\nfour\n");
  space.disk.set("a.md", "zero\none\nTWO theirs\nthree\nfour\n");
  await docs.flush(d); await settle();
  assert.equal(d.state, "conflict");
  assert.equal(d.merge.left, 1);
  assert.equal(v.text, "zero\none\nTWO mine\nthree\nfour\n", "the editor holds yours in the place you both changed");
  assert.equal(d.merge.other, "zero\none\nTWO theirs\nthree\nfour\n", "shown against theirs");
  const n = space.saves.length;
  await docs.flush(d); await settle();
  assert.equal(space.saves.length, n, "nothing saves until every place is chosen");
  v.text = "zero\none\nTWO both\nthree\nfour\n";
  assert.equal(docs.resolve(d), false, "not while a place is left");
  docs.mergeProgress(d, 0);
  assert.ok(docs.resolve(d));
  await settle();
  assert.equal(space.disk.get("a.md"), "zero\none\nTWO both\nthree\nfour\n", "it came from your ⌘S, so it saves");
  assert.equal(d.state, "saved");
});

t("a clash from someone else's change while you weren't saving waits, after you choose, for your ⌘S", async () => {
  const { space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("one\nTWO mine\nthree\n");
  space.disk.set("a.md", "one\nTWO theirs\nthree\n");
  await docs.changed("p", "a.md", { version: sha("one\nTWO theirs\nthree\n"), by: { kind: "agent" } });
  assert.equal(d.state, "conflict");
  docs.mergeProgress(d, 0);
  assert.ok(docs.resolve(d));
  await settle();
  assert.equal(d.state, "dirty");
  assert.equal(space.saves.length, 0);
});

t("a file that runs code asks at ⌘S; no leaves it unsaved, yes saves now and from then on", async () => {
  const { space, docs, events } = setup({ ".claude/x.md": "a\n" });
  space.refuse = (rel, content, base, confirm) => (confirm ? null : Object.assign(new Error("confirm"), { status: 428, code: "confirm_required" }));
  const d = await openDoc(docs, space, ".claude/x.md");
  const v = fakeView(docs, d);
  v.type("b\n");
  await docs.flush(d); await settle();
  assert.ok(d.confirm);
  assert.ok(events.includes("confirm"));
  docs.confirmRunsCode(d, false);
  assert.equal(d.state, "dirty");
  assert.equal(space.disk.get(".claude/x.md"), "a\n");
  v.type("bc\n");
  await docs.flush(d); await settle();
  docs.confirmRunsCode(d, true); await settle();
  assert.equal(space.disk.get(".claude/x.md"), "bc\n");
  v.type("bcd\n");
  await docs.flush(d); await settle();
  assert.equal(space.saves.at(-1).confirm, "runs_code");
  assert.equal(space.disk.get(".claude/x.md"), "bcd\n");
});

t("offline: your text stays as a draft and says so; deleted on disk: kept, and ⌘S makes it again", async () => {
  const { space, docs, store } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  space.refuse = () => new Error("Failed to fetch");
  v.type("mine\n");
  await docs.flush(d); await settle();
  assert.equal(d.state, "error");
  assert.match(d.err, /⌘S again/);
  assert.equal(getDraft(store, draftKey("p", "a.md")).text, "mine\n");
  space.refuse = null;
  await docs.flush(d); await settle();
  assert.equal(space.disk.get("a.md"), "mine\n");
  assert.equal(d.state, "saved");
  assert.equal(getDraft(store, draftKey("p", "a.md")), null, "the draft goes once it's saved");
  space.disk.delete("a.md");
  await docs.changed("p", "a.md", { kind: "delete", by: { kind: "disk" } });
  assert.equal(d.state, "deleted");
  assert.equal(v.text, "mine\n");
  await docs.flush(d);
  await settle();
  assert.equal(space.disk.get("a.md"), "mine\n", "made again");
  assert.equal(space.saves.at(-1).base, null);
});

t("a draft left behind comes back unsaved, for ⌘S; read-only files take no typing", async () => {
  const { clock, space, docs, store } = setup({ "a.md": "base\n", "big.txt": "x" });
  putDraft(store, draftKey("p", "a.md"), { text: "draft\n", base: "base\n", version: sha("base\n"), at: 1 });
  const d = await openDoc(docs, space);
  assert.equal(d.state, "dirty");
  assert.equal(docs.textOf(d), "draft\n");
  await clock.tick(60000);
  assert.equal(space.disk.get("a.md"), "base\n", "not saved by itself");
  await docs.flush(d); await settle();
  assert.equal(space.disk.get("a.md"), "draft\n");
  const r = docs.open("p", "big.txt", { content: "x", version: null, truncated: true });
  assert.equal(r.state, "readonly");
  docs.edited(r);
  await docs.flush(r);
  assert.equal(space.saves.filter((s) => s.rel === "big.txt").length, 0);
});

t("versions: your saves within 10 s are one; an older one is read only; restoring it is a new version", async () => {
  const { clock, space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("second\n"); await docs.flush(d); await settle();
  await clock.tick(2000);
  v.type("third\n"); await docs.flush(d); await settle();
  assert.equal(d.versions.length, 2, "saves a moment apart are one version (the merge window)");
  await clock.tick(MERGE_MS);
  v.type("fourth\n"); await docs.flush(d); await settle();
  assert.equal(d.versions.length, 3, "a pause longer than the window starts a new one");
  const old = docs.view(d, 0);
  assert.equal(old.text, "one\ntwo\nthree\n");
  docs.edited(d); // a key while looking at an old version does nothing
  await docs.flush(d); await settle();
  assert.equal(space.saves.length, 3, "no save while an old version is shown");
  await docs.restore(d, old.text); await settle();
  assert.equal(space.disk.get("a.md"), "one\ntwo\nthree\n");
  assert.equal(v.text, "one\ntwo\nthree\n");
  assert.equal(d.versions.length, 4, "a restore is always a version of its own");
  assert.equal(d.viewing, null);
});

t("versions Space knows fold in: older ones listed before, who made the ones held here", async () => {
  const { space, docs } = setup();
  const d = await openDoc(docs, space);
  docs.knownVersions(d, [
    { id: "v3", version: sha("one\ntwo\nthree\n"), at: "t3", by: { kind: "agent", thread_ts: "x" } },
    { id: "v2", version: "sha256:older", at: "t2", by: { kind: "ui" } },
    { id: "v1", version: "sha256:oldest", at: "t1", by: { kind: "git" } },
  ]);
  assert.deepEqual(d.versions.map((x) => x.id), ["v1", "v2", "v3"]);
  assert.equal(d.versions[2].by.kind, "agent");
  assert.equal(d.versions[0].text, null);
});

t("the last view letting go keeps unsaved text as a draft (never saves it) and forgets the document", async () => {
  const { space, docs, store } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("bye\n");
  docs.release(d);
  await settle();
  assert.equal(space.disk.get("a.md"), "one\ntwo\nthree\n", "not written");
  assert.equal(getDraft(store, draftKey("p", "a.md")).text, "bye\n", "kept for next time");
  assert.equal(docs.get("p", "a.md"), null);
});

t("a restore says which version it brings back; a renamed file's document follows it", async () => {
  const { clock, space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("later\n"); await docs.flush(d); await settle();
  d.versions[0].id = "v_first";
  await docs.restore(d, d.versions[0].text, { id: "v_first" }); await settle();
  assert.equal(space.saves.at(-1).restoreOf, "v_first");
  await clock.tick(MERGE_MS); v.type("next\n"); await docs.flush(d); await settle();
  assert.equal(space.saves.at(-1).restoreOf, null, "only that one save");
  space.disk.set("b/renamed.md", space.disk.get("a.md")); space.disk.delete("a.md");
  const moved = docs.renamed("p", "a.md", "b/renamed.md");
  assert.equal(moved, d);
  assert.equal(docs.get("p", "a.md"), null);
  assert.equal(docs.get("p", "b/renamed.md"), d);
  v.type("after the move\n"); await docs.flush(d); await settle();
  assert.equal(space.disk.get("b/renamed.md"), "after the move\n");
});

t("undoing back to the saved text: saved again (no Unsaved, no draft, no question); redo: unsaved again", async () => {
  const { space, docs, store } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("one\ntwo!\nthree\n");
  assert.equal(d.state, "dirty");
  v.type("one\ntwo\nthree\n"); // undone
  assert.equal(d.state, "saved");
  assert.equal(getDraft(store, draftKey("p", "a.md")), null);
  assert.deepEqual(docs.unsaved(), [], "nothing to ask about on close");
  v.type("one\ntwo!\nthree\n"); // redone
  assert.equal(d.state, "dirty");
  // the same length, other text: still unsaved
  v.type("one\ntwo\nthreE\n");
  assert.equal(d.state, "dirty");
  assert.equal(space.saves.length, 0);
});

t("refresh reports unexpected errors and preserves text for a missing file until a delete event", async () => {
  const { space, docs } = setup();
  const d = await openDoc(docs, space);
  const errors = [], original = globalThis.reportError;
  globalThis.reportError = (error) => errors.push(error);
  try {
    const failure = new Error("decoder failed");
    space.projectFile = async () => { throw failure; };
    await docs.changed("p", "a.md");
    space.projectFile = async () => { throw Object.assign(new Error("gone"), { status: 404 }); };
    await docs.changed("p", "a.md");
    assert.deepEqual(errors, [failure]);
    assert.equal(d.state, "saved");
  } finally {
    if (original) globalThis.reportError = original;
    else delete globalThis.reportError;
  }
});

t("a superseded refresh cannot repaint or apply an old version", async () => {
  const { space, docs } = setup();
  const d = await openDoc(docs, space);
  const view = fakeView(docs, d);
  const pending = [];
  space.projectFile = (project, rel, at, { signal }) => new Promise((resolve) => pending.push({ signal, resolve }));
  const first = docs.changed("p", "a.md");
  await settle();
  const second = docs.changed("p", "a.md");
  await settle();
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve({ content: "new", version: "new" });
  await second;
  pending[0].resolve({ content: "old", version: "old" });
  await first;
  assert.equal(view.text, "new");
  assert.equal(view.applied.length, 1);
});

t("retiring the owner cancels a pending refresh and its draft timer without writing the file", async () => {
  const { clock, space, docs, events, scope } = setup();
  const d = await openDoc(docs, space);
  const view = fakeView(docs, d);
  view.type("draft");
  assert.equal(clock.pending(), 1);
  let complete, signal;
  space.projectFile = (project, rel, at, options) => new Promise((resolve) => { complete = resolve; signal = options.signal; });
  const refresh = docs.changed("p", "a.md");
  await settle();
  const beforeRetirement = [...events];
  scope.dispose();
  assert.equal(scope.size, 0);
  assert.equal(clock.pending(), 0);
  assert.equal(signal.aborted, true);
  complete({ content: "late", version: "late" });
  await refresh;
  await clock.tick(1000);
  assert.equal(view.text, "draft");
  assert.equal(view.applied.length, 0);
  assert.deepEqual(events, beforeRetirement);
  assert.deepEqual(space.saves, []);
});

t("a refresh body captured before a Save cannot replace the accepted text", async () => {
  const { space, docs } = setup({ "a.md": "before" });
  const d = await openDoc(docs, space), view = fakeView(docs, d);
  const heldRead = Promise.withResolvers(), heldSave = Promise.withResolvers();
  let signal;
  space.projectFile = (project, rel, at, options) => { signal = options.signal; return heldRead.promise; };
  const refresh = docs.changed("p", "a.md");
  await settle();
  view.type("accepted");
  space.hold = heldSave.promise;
  const save = docs.flush(d);
  heldRead.resolve({ content: "before", version: sha("before") });
  await settle();
  heldSave.resolve();
  await Promise.all([refresh, save]);
  assert.equal(space.disk.get("a.md"), "accepted");
  assert.equal(view.text, "accepted");
  assert.equal(d.version, sha("accepted"));
  assert.deepEqual(view.applied, []);
  assert.equal(signal.aborted, true);
});

t("an event for the open version retires a held read of an intermediate revision", async () => {
  const { docs, space } = setup({ "a.md": "open" });
  const d = await openDoc(docs, space), view = fakeView(docs, d);
  const held = Promise.withResolvers();
  let signal, reads = 0;
  space.projectFile = (project, rel, at, options) => { reads++; signal = options.signal; return held.promise; };
  const refresh = docs.changed("p", "a.md", { version: sha("intermediate") });
  await settle();
  await docs.changed("p", "a.md", { version: sha("open") });
  held.resolve({ content: "intermediate", version: sha("intermediate") });
  await refresh;
  assert.equal(view.text, "open");
  assert.equal(d.version, sha("open"));
  assert.deepEqual(view.applied, []);
  assert.equal(reads, 1);
  assert.equal(signal.aborted, true);
});

t("a refresh that arrives during a Save reads the disk after it settles", async () => {
  const { docs, space } = setup({ "a.md": "before" });
  const d = await openDoc(docs, space), view = fakeView(docs, d);
  const heldSave = Promise.withResolvers();
  view.type("accepted");
  space.hold = heldSave.promise;
  const save = docs.flush(d);
  const refresh = docs.changed("p", "a.md", { version: sha("before") });
  await settle();
  assert.equal(space.reads, 1);
  heldSave.resolve();
  await Promise.all([save, refresh]);
  assert.equal(space.reads, 2);
  assert.equal(view.text, "accepted");
  assert.deepEqual(view.applied, []);
});

for (const [name, fn] of queue) {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
}
console.log(`${passed}/${queue.length} passed`);
