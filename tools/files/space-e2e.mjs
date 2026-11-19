// End-to-end, no browser: the frontend's document model (js/docs.js) and the frontend's own api.js, against xo-space's
// branch (e2b7b3f) on :5292 behind this branch's serve.py on :5293, a throwaway project in /tmp/e2e. Checks the
// contract as the UI uses it: saves, version store, merge window, file.version events (UI save, a disk write as an
// agent's bash would, rename, delete + undo), /versions, /file?version=, /paths, /search, Restore's header.
// Never against the live Space or a real project: a throwaway one, an empty state store.
//   bash tools/files/space-e2e-reset.sh        (xo-space's branch on :5292, XO_PROJECTS_ROOT and QUIRQ_STATE_ROOT in /tmp/e2e)
//   PORT=5293 XO_API=http://127.0.0.1:5292 QUIRQ_STATE_ROOT=/tmp/e2e/state python3 serve.py &
//   node tools/files/space-e2e.mjs "$PWD"
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
const WT = process.argv[2];
const ORIGIN = "http://127.0.0.1:5293";
// the page's fetch: api.js asks for "api/…" relative to the page
const realFetch = globalThis.fetch;
globalThis.fetch = (u, o) => realFetch(new URL(u, ORIGIN + "/"), o);
globalThis.location = new URL(ORIGIN + "/");
const { api } = await import(WT + "/js/api.js");
const { createDocs } = await import(WT + "/js/docs.js");
const P = "demo", DIR = "/tmp/e2e/projects/demo";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0;
const step = async (name, fn) => { try { await fn(); ok++; console.log("  ok  " + name); } catch (e) { console.log("  FAIL " + name + "\n    " + (e && e.stack || e).toString().split("\n").slice(0, 4).join("\n    ")); process.exitCode = 1; } };

// the stream: file events as the app's storm.js would get them
const events = [];
const ac = new AbortController();
(async () => {
  const res = await realFetch(ORIGIN + "/api/chat/stream?kinds=file", { signal: ac.signal });
  const rd = res.body.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await rd.read().catch(() => ({ done: true }));
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const fr = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /^event: (.*)$/m.exec(fr)?.[1], data = /^data: (.*)$/m.exec(fr)?.[1];
      if (ev && ev.startsWith("file")) { try { const env = JSON.parse(data); events.push({ type: ev, ...(env.data || env) }); } catch {} }
    }
  }
})();
const waitFor = async (pred, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = events.find(pred); if (e) return e; await sleep(100); } throw new Error("no such event; got: " + JSON.stringify(events.slice(-4))); };
await sleep(800);

const store = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, String(v)); }, removeItem(k) { this.m.delete(k); } };
const docs = createDocs({ api, store });
let view = null;
const attach = (d) => { view = { text: docs.textOf(d) }; docs.attach(d, { source: () => view.text, apply: (e) => { view.text = view.text.slice(0, e.from) + e.insert + view.text.slice(e.to); } }); };
const type = (d, s) => { view.text = s; docs.edited(d); };

let d;
await step("a file opens editable, with its version", async () => {
  const data = await api.projectFile(P, "notes.md", null, { purpose: "edit" });
  assert.equal(data.editable, true);
  d = docs.open(P, "notes.md", data);
  attach(d);
  assert.equal(d.state, "saved");
});
await step("typing saves itself through serve.py's writer key; Space's file.version names you", async () => {
  type(d, "# Demo\n\nOne!\nTwo.\n");
  await sleep(1500);
  assert.equal(d.state, "saved");
  assert.equal(readFileSync(DIR + "/notes.md", "utf8"), "# Demo\n\nOne!\nTwo.\n");
  const e = await waitFor((x) => x.type === "file.version" && x.path === "notes.md" && x.version === d.version);
  assert.equal(e.by.kind, "ui");
});
await step("saves a second apart are one version in Space too (the merge window)", async () => {
  type(d, "# Demo\n\nOne!!\nTwo.\n"); await sleep(1400);
  type(d, "# Demo\n\nOne!!!\nTwo.\n"); await sleep(1400);
  const r = await api.projectVersions(P, "notes.md");
  const ui = r.versions.filter((v) => v.by && v.by.kind === "ui");
  assert.equal(ui.length, 1, JSON.stringify(r.versions.map((v) => [v.kind, v.by && v.by.kind, v.at])));
  assert.equal(ui[0].version, d.version);
});
await step("a write on disk (an agent's bash) comes in as an event, and the open document takes it in place", async () => {
  await sleep(10500); // past the window, so this is its own version
  writeFileSync(DIR + "/notes.md", "# Demo\n\nOne!!!\nTwo.\nThree, from disk.\n");
  const e = await waitFor((x) => x.type === "file.version" && x.path === "notes.md" && x.by && x.by.kind !== "ui");
  await docs.changed(P, "notes.md", { version: e.version, by: e.by, at: e.at, id: e.id, kind: e.kind });
  assert.equal(view.text, "# Demo\n\nOne!!!\nTwo.\nThree, from disk.\n");
  assert.equal(d.state, "saved");
  assert.equal(d.version, e.version);
});
await step("typing while the disk changes elsewhere: merged, and yours saves on top", async () => {
  type(d, "# Demo (mine)\n\nOne!!!\nTwo.\nThree, from disk.\n");
  writeFileSync(DIR + "/notes.md", "# Demo\n\nOne!!!\nTwo.\nThree, from disk.\nFour, from disk.\n");
  await sleep(2500);
  if (d.state !== "saved") await sleep(2000);
  assert.equal(readFileSync(DIR + "/notes.md", "utf8"), "# Demo (mine)\n\nOne!!!\nTwo.\nThree, from disk.\nFour, from disk.\n");
  assert.equal(view.text, readFileSync(DIR + "/notes.md", "utf8"));
});
let first;
await step("/versions lists every writer; an older one reads back with /file?version=", async () => {
  const r = await api.projectVersions(P, "notes.md");
  assert.ok(r.versions.length >= 3, `${r.versions.length} versions`);
  assert.ok(r.versions.some((v) => v.by && v.by.kind === "disk") || r.versions.some((v) => v.by && v.by.kind === "agent"));
  first = r.versions[r.versions.length - 1];
  const old = await api.projectFile(P, "notes.md", null, { version: first.version });
  assert.equal(old.editable, false);
  assert.equal(typeof old.content, "string");
});
await step("Restore sends X-XO-Restore-Of; Space records a restore of that version", async () => {
  const r0 = await api.projectVersions(P, "notes.md");
  const target = r0.versions[r0.versions.length - 1];
  const text = (await api.projectFile(P, "notes.md", null, { version: target.version })).content;
  await sleep(10500);
  await docs.restore(d, text, { id: target.id });
  await sleep(800);
  const r = await api.projectVersions(P, "notes.md");
  const top = r.versions[0];
  assert.equal(top.kind, "restore", JSON.stringify(top));
  assert.equal(top.restores, target.id);
});
await step("/paths: every file, nothing ignored", async () => {
  writeFileSync(DIR + "/scratch.txt", "x\n");
  const r = await api.projectPaths(P);
  assert.ok(r.paths.includes("scratch.txt") && r.paths.includes("src/app.js"));
  assert.ok(!r.paths.some((p) => p.startsWith(".git/")));
  assert.deepEqual(r.paths.filter((p) => p.startsWith(".xo/")), [], "XO's own files aren't offered");
});
await step("/search finds text, by line", async () => {
  const r = await api.projectSearch(P, { q: "const a" });
  assert.ok(r.matches.length >= 1 && r.matches[0].path === "src/app.js", JSON.stringify(r).slice(0, 200));
  const xo = await api.projectSearch(P, { q: "demo" });
  assert.deepEqual(xo.matches.filter((m) => m.path.startsWith(".xo/")).map((m) => m.path), [], "nor searched");
  let err = null; try { await api.projectSearch(P, { q: "(", regex: true }); } catch (e) { err = e; }
  assert.equal(err && err.status, 400);
});
await step("rename through the writer key: the event says where it went, and the document follows", async () => {
  const r = await api.renameProjectFile(P, "notes.md", "docs/notes.md");
  assert.equal(r.relative_path, "docs/notes.md");
  assert.ok(existsSync(DIR + "/docs/notes.md") && !existsSync(DIR + "/notes.md"));
  const e = await waitFor((x) => x.type === "file.version" && x.kind === "rename" && x.path === "docs/notes.md");
  assert.equal(e.old_path, "notes.md");
  docs.renamed(P, e.old_path, e.path);
  type(d, view.text + "After the move.\n"); await sleep(1500);
  assert.match(readFileSync(DIR + "/docs/notes.md", "utf8"), /After the move\.\n$/);
});
await step("delete into Space's trash, and Undo brings it back", async () => {
  const r = await api.deleteProjectFile(P, "scratch.txt");
  assert.ok(r.edit_id && !existsSync(DIR + "/scratch.txt"));
  await waitFor((x) => x.type === "file.version" && x.kind === "delete" && x.path === "scratch.txt");
  await api.undoProjectEdit(P, r.edit_id);
  assert.ok(existsSync(DIR + "/scratch.txt"));
});
await step("a missing route vs a route's own 404 (the frontend's missingRoute rule)", async () => {
  const { missingRoute, request } = await import(WT + "/js/api.js");
  let e1 = null; try { await api.projectFile(P, "nope.md", null, { version: "sha256:00" }); } catch (e) { e1 = e; }
  assert.equal(e1.status, 404); assert.ok(!missingRoute(e1), `coded: ${e1.code}`);
  let e2 = null; try { await request("/xo-projects/demo/no-such-route"); } catch (e) { e2 = e; }
  assert.ok(!e2 || missingRoute(e2), `bare: ${e2 && e2.status} ${e2 && e2.code}`);
});
ac.abort();
console.log(`${ok} passed`);
process.exit(process.exitCode || 0);
