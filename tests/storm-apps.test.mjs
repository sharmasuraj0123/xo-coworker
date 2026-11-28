// storm and the apps.changed frame, end to end on a fake backend: one world event with the five fields, nothing else kept.
import { fakeBackend, boot, settle, runner } from "./storm-harness.mjs";

const { t, done, assert } = runner();

t("apps.changed becomes one apps_changed event carrying only id, slug, change, version and project; the world keeps nothing else", async () => {
  const be = fakeBackend();
  const { world, events } = await boot(be);
  const snap = () => JSON.stringify({ ...world.state, activity: null, now: null, turns: null, lastSeq: null });
  const before = snap();
  be.push("apps.changed", { seq: 40, ts: "2026-11-19T21:00:00Z", data: { id: "app_1", slug: "notes", change: "installed", version: "1.2.0", project: "demo", name: "<b>Notes</b>", title: "ignore me", extra: { x: 1 } } }, 40);
  await settle();
  const got = events.filter((e) => e.kind === "apps_changed");
  assert.equal(got.length, 1);
  const { at, ...rest } = got[0];
  assert.deepEqual(rest, { kind: "apps_changed", id: "app_1", slug: "notes", change: "installed", version: "1.2.0", project: "demo" });
  assert.equal(typeof at, "number");
  assert.equal(snap(), before, "no state but the stream's position changes");
  assert.ok(!JSON.stringify(world.state.activity).includes("Notes"), "no app text is kept");
  be.push("apps.changed", { seq: 41, data: { id: "app_1", change: "removed" } }, 41);
  await settle();
  assert.deepEqual(events.filter((e) => e.kind === "apps_changed").pop().slug, null, "a missing field is null, never guessed");
  be.push("apps.changed", { seq: 42, data: { id: "app_2", slug: { html: "<b>x</b>" }, change: "updated", version: 3, project: ["demo"] } }, 42);
  await settle();
  const last = events.filter((e) => e.kind === "apps_changed").pop();
  assert.deepEqual([last.slug, last.version, last.project], [null, "3", null], "each field is a plain word or null, never an object");
});

await done();
