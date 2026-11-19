// Open files as documents (js/docs.js): states, autosave, saving against the version, someone else's change coming
// in (taken in, merged, or the merge view), drafts, versions. Pure, with a fake clock, a fake Space and a stand-in
// for localStorage.
//   node tests/docs.test.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createDocs, refusal, changedLines, minimalEdit, byWords, AUTOSAVE_MS } from "../js/docs.js";
import { draftKey, getDraft, putDraft } from "../js/drafts.js";

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
  const docs = createDocs({ api: space, store, clock, onChange: (d, what) => events.push(what) });
  return { clock, space, store, docs, events };
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

t("typing saves itself a second after the last key, against the version it started from", async () => {
  const { clock, space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  assert.equal(d.state, "saved");
  v.type("one\ntwo!\nthree\n");
  assert.equal(d.state, "dirty");
  await clock.tick(AUTOSAVE_MS - 100);
  v.type("one\ntwo!!\nthree\n"); // still typing: the second waits for the pause
  await clock.tick(AUTOSAVE_MS - 100);
  assert.equal(space.saves.length, 0, "nothing sent while you type");
  await clock.tick(200);
  assert.equal(space.saves.length, 1);
  assert.equal(space.saves[0].base, sha("one\ntwo\nthree\n"));
  assert.equal(d.state, "saved");
  assert.equal(space.disk.get("a.md"), "one\ntwo!!\nthree\n");
  assert.equal(d.versions.length, 2, "the opened version and yours");
  assert.deepEqual(d.versions[1].by, { kind: "ui" });
});

t("⌘S and leaving save at once; typing while a save is out saves next", async () => {
  const { clock, space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("x\n");
  let release; space.hold = new Promise((r) => (release = r));
  const p = docs.flush(d);
  assert.equal(d.state, "saving");
  v.type("xy\n"); // typed while saving
  release(); space.hold = null; await p; await settle();
  assert.equal(space.disk.get("a.md"), "x\n", "what was sent is saved");
  assert.equal(d.state, "dirty", "what you typed since is still to save");
  await clock.tick(AUTOSAVE_MS + 10);
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

t("someone else's change while you type elsewhere: merged into yours, and yours saves on top", async () => {
  const { clock, space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("ONE\ntwo\nthree\n");
  space.disk.set("a.md", "one\ntwo\nTHREE\n");
  await docs.changed("p", "a.md", { version: sha("one\ntwo\nTHREE\n"), by: { kind: "agent" } });
  assert.equal(v.text, "ONE\ntwo\nTHREE\n", "both kept");
  assert.equal(d.state, "dirty");
  await clock.tick(AUTOSAVE_MS + 10);
  assert.equal(space.disk.get("a.md"), "ONE\ntwo\nTHREE\n");
  assert.equal(space.saves.at(-1).base, sha("one\ntwo\nTHREE\n"), "saved against theirs");
});

t("a save that finds the file changed (409) merges and saves again; the same lines go to the merge view", async () => {
  const { clock, space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("one\ntwo\nthree\nfour\n");
  space.disk.set("a.md", "zero\none\ntwo\nthree\n"); // unseen change (bash): only the save finds it
  await clock.tick(AUTOSAVE_MS + 10);
  await clock.tick(AUTOSAVE_MS + 10);
  assert.equal(space.disk.get("a.md"), "zero\none\ntwo\nthree\nfour\n");
  assert.equal(d.state, "saved");
  // now a clash
  v.type("zero\none\nTWO mine\nthree\nfour\n");
  space.disk.set("a.md", "zero\none\nTWO theirs\nthree\nfour\n");
  await clock.tick(AUTOSAVE_MS + 10);
  assert.equal(d.state, "conflict");
  assert.equal(d.merge.left, 1);
  const n = space.saves.length;
  await clock.tick(AUTOSAVE_MS * 3);
  assert.equal(space.saves.length, n, "nothing saves until every place is chosen");
  assert.equal(v.text, "zero\none\nTWO mine\nthree\nfour\n", "the editor holds yours in the place you both changed");
  assert.equal(d.merge.other, "zero\none\nTWO theirs\nthree\nfour\n", "shown against theirs");
  v.text = "zero\none\nTWO both\nthree\nfour\n"; // chosen in the merge view (kept, taken back, or edited)
  assert.equal(docs.resolve(d), false, "not while a place is left");
  docs.mergeProgress(d, 0);
  assert.ok(docs.resolve(d));
  await settle();
  assert.equal(space.disk.get("a.md"), "zero\none\nTWO both\nthree\nfour\n");
  assert.equal(d.state, "saved");
});

t("a file that runs code asks once; no leaves it unsaved, yes saves now and from then on", async () => {
  const { clock, space, docs, events } = setup({ ".claude/x.md": "a\n" });
  space.refuse = (rel, content, base, confirm) => (confirm ? null : Object.assign(new Error("confirm"), { status: 428, code: "confirm_required" }));
  const d = await openDoc(docs, space, ".claude/x.md");
  const v = fakeView(docs, d);
  v.type("b\n");
  await clock.tick(AUTOSAVE_MS + 10);
  assert.ok(d.confirm);
  assert.ok(events.includes("confirm"));
  v.type("bc\n");
  await clock.tick(AUTOSAVE_MS * 2);
  assert.equal(space.saves.length, 1, "no more saves while the question is open");
  docs.confirmRunsCode(d, true);
  await settle();
  assert.equal(space.disk.get(".claude/x.md"), "bc\n");
  v.type("bcd\n");
  await clock.tick(AUTOSAVE_MS + 10);
  assert.equal(space.saves.at(-1).confirm, "runs_code");
  assert.equal(space.disk.get(".claude/x.md"), "bcd\n");
});

t("offline: your text stays as a draft and it tries again; deleted on disk: kept, and saving makes it again", async () => {
  const { clock, space, docs, store } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  space.refuse = () => new Error("Failed to fetch");
  v.type("mine\n");
  await clock.tick(AUTOSAVE_MS + 10);
  assert.equal(d.state, "error");
  assert.equal(getDraft(store, draftKey("p", "a.md")).text, "mine\n");
  space.refuse = null;
  await clock.tick(5000);
  assert.equal(space.disk.get("a.md"), "mine\n");
  assert.equal(d.state, "saved");
  assert.equal(getDraft(store, draftKey("p", "a.md")), null, "the draft goes once it's saved");
  // deleted
  space.disk.delete("a.md");
  await docs.changed("p", "a.md", { kind: "delete", by: { kind: "disk" } });
  assert.equal(d.state, "deleted");
  assert.equal(v.text, "mine\n");
  await docs.flush(d);
  await settle();
  assert.equal(space.disk.get("a.md"), "mine\n", "made again");
  assert.equal(space.saves.at(-1).base, null);
});

t("a draft left behind comes back unsaved and saves itself; read-only files take no typing", async () => {
  const { clock, space, docs, store } = setup({ "a.md": "base\n", "big.txt": "x" });
  putDraft(store, draftKey("p", "a.md"), { text: "draft\n", base: "base\n", version: sha("base\n"), at: 1 });
  const d = await openDoc(docs, space);
  assert.equal(d.state, "dirty");
  assert.equal(docs.textOf(d), "draft\n");
  await clock.tick(10);
  assert.equal(space.disk.get("a.md"), "draft\n");
  const r = docs.open("p", "big.txt", { content: "x", version: null, truncated: true });
  assert.equal(r.state, "readonly");
  docs.edited(r);
  await clock.tick(AUTOSAVE_MS * 2);
  assert.equal(space.saves.filter((s) => s.rel === "big.txt").length, 0);
});

t("versions: an older one is read only; restoring it is a new version", async () => {
  const { clock, space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("second\n"); await clock.tick(AUTOSAVE_MS + 10);
  v.type("third\n"); await clock.tick(AUTOSAVE_MS + 10);
  assert.equal(d.versions.length, 3);
  const old = docs.view(d, 0);
  assert.equal(old.text, "one\ntwo\nthree\n");
  docs.edited(d); // a key while looking at an old version does nothing
  await clock.tick(AUTOSAVE_MS * 2);
  assert.equal(space.saves.length, 2);
  await docs.restore(d, old.text); await settle();
  assert.equal(space.disk.get("a.md"), "one\ntwo\nthree\n");
  assert.equal(v.text, "one\ntwo\nthree\n");
  assert.equal(d.versions.length, 4);
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

t("the last view letting go saves what's pending and forgets the document", async () => {
  const { clock, space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("bye\n");
  docs.release(d);
  await settle();
  assert.equal(space.disk.get("a.md"), "bye\n");
  assert.equal(docs.get("p", "a.md"), null);
  void clock;
});

t("a restore says which version it brings back; a renamed file's document follows it", async () => {
  const { clock, space, docs } = setup();
  const d = await openDoc(docs, space);
  const v = fakeView(docs, d);
  v.type("later\n"); await clock.tick(AUTOSAVE_MS + 10);
  d.versions[0].id = "v_first";
  await docs.restore(d, d.versions[0].text, { id: "v_first" }); await settle();
  assert.equal(space.saves.at(-1).restoreOf, "v_first");
  v.type("next\n"); await clock.tick(AUTOSAVE_MS + 10);
  assert.equal(space.saves.at(-1).restoreOf, null, "only that one save");
  space.disk.set("b/renamed.md", space.disk.get("a.md")); space.disk.delete("a.md");
  const moved = docs.renamed("p", "a.md", "b/renamed.md");
  assert.equal(moved, d);
  assert.equal(docs.get("p", "a.md"), null);
  assert.equal(docs.get("p", "b/renamed.md"), d);
  v.type("after the move\n"); await clock.tick(AUTOSAVE_MS + 10);
  assert.equal(space.disk.get("b/renamed.md"), "after the move\n");
});

for (const [name, fn] of queue) {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
}
console.log(`${passed}/${queue.length} passed`);
