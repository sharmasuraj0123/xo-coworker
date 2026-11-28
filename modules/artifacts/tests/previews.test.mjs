import assert from "node:assert/strict";

globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
globalThis.cancelAnimationFrame = clearTimeout;
const open = [], log = [];
const ask = (project, rel) => new Promise((resolve) => { log.push(`${project}/${rel}`); open.push({ rel, resolve }); });
const api = { projectFile: (project, rel) => ask(project, rel), projectImage: (project, rel) => ask(project, rel).then(() => new Blob(["x"])) };
const reply = (i, body) => { const [r] = open.splice(i, 1); r.resolve(body); };
const make = (box, landed) => createPreviews({ world: { thread: () => null }, api, sharedFileRoute: () => ({}), box, landed });
const tick = () => new Promise((r) => setTimeout(r, 0));
const { createPreviews } = await import("../previews.js");

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

const doc = (i) => ({ key: `k${i}`, kind: "doc", name: `n${i}.md`, path: `n${i}.md`, fileProject: "demo", rel: `n${i}.md` });

await t("three reads at a time; the rest wait their turn, nearest the view first", async () => {
  let landed = 0;
  const box = { hidden: false, scrollTop: 0, clientHeight: 300 };
  const PV = make(() => box, () => landed++);
  for (let i = 0; i < 6; i++) PV.nearY.set(`k${i}`, { y: 1000 - i * 100 });
  PV.loadTexts([0, 1, 2, 3, 4, 5].map(doc));
  await tick();
  assert.equal(open.length, 3);
  const names = () => open.map((o) => o.rel.match(/n(\d)\.md/)[1]);
  assert.deepEqual(names(), ["0", "1", "2"], "the first asked start at once");
  reply(0, { content: "# Title\n\nSome words here." });
  await tick(); await tick();
  assert.deepEqual(names(), ["1", "2", "5"], "one landed; of those waiting, the nearest to a third down the view starts");
  assert.deepEqual(PV.texts.get("k0"), { kind: "doc", title: "Title", text: "Some words here." });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(landed, 1, "what arrived is drawn once a frame");
  while (open.length) { reply(0, { content: "" }); await tick(); await tick(); }
  assert.ok(PV.failed.has("k4") && PV.failed.has("k1") && !PV.failed.has("k0"), "nothing to show: it keeps its icon");
});
await t("a file is asked for once; a binary or a gone file never", async () => {
  log.length = 0;
  const PV = make(() => null, () => {});
  PV.loadTexts([doc(7), doc(7), { ...doc(8), name: "a.pdf" }, { ...doc(9), exists: false }]);
  await tick();
  assert.deepEqual(log, ["demo/n7.md"], "through the file's own project and path");
  assert.equal(PV.wantsText(doc(7)), false, "asked already");
  assert.equal(PV.previewable({ ...doc(8), name: "a.pdf" }), false);
  assert.equal(PV.previewable(doc(1)), true);
  while (open.length) { reply(0, { content: "x" }); await tick(); }
});
console.log(`\n${passed} passed`);
