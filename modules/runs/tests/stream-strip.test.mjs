// @ts-check
import { dom } from "../../../tests/lib/dom.mjs";
import { boot, fakeBackend, runner, until } from "../../../tests/storm-harness.mjs";
import { createRunsStrip } from "../strip.js";

const { t, done, assert } = runner();

for (const finish of [
  { name: "sequenced", envelope: { seq: 4 }, id: 4 },
  { name: "sequence-less", envelope: {}, id: null },
]) t(`a newer ${finish.name} Storm finish survives held warm and explicit Runs reads at the same tick`, async () => {
  const realNow = Date.now;
  Date.now = () => 1000;
  try { await heldReads(finish); }
  finally { Date.now = realNow; }
});

async function heldReads(finish) {
  const { document } = await dom('<section id="strip"></section>');
  const box = document.querySelector("#strip");
  const replies = Array.from({ length: 2 }, () => Promise.withResolvers());
  const [first, second] = replies;
  const route = "/chat/sessions/team/runs";
  let reads = 0;
  const backend = fakeBackend({ [`GET ${route}`]: () => replies[reads++].promise });
  const { world } = await boot(backend);
  backend.push("run.started", { session_id: "team", seq: 2, data: { run_id: "agent", info: { title: "Check the patch" } } }, 2);
  await until(() => world.state.runs.get("agent")?.state === "running");
  backend.push("runs", { seq: 3, data: { session: "unrelated", running: 1 } }, 3);
  await until(() => world.state.liveRuns.unrelated?.running === 1);
  assert.equal(world.act.sentAt().seq, 3);

  let warmPaints = 0;
  const thread = { sessionId: "team", runs: { running: 2, total: 1 } };
  const strip = createRunsStrip({
    world, SHAPE: { on: () => true },
    schedule: () => { warmPaints++; draw(); },
  });
  function draw() { box.innerHTML = strip.runsStrip(thread); }
  draw();
  assert.ok(box.querySelector('[data-run="agent"]'));
  await until(() => backend.count("GET", route) === 1);
  const manual = world.act.listRuns("team");
  await until(() => backend.count("GET", route) === 2);

  backend.push("run.finished", { ...finish.envelope, session_id: "team", data: { run_id: "agent", summary: "Checked" } }, finish.id);
  await until(() => world.state.runs.get("agent")?.state === "finished");
  draw();
  assert.equal(!!box.querySelector('[data-run="agent"]'), false);

  const oldList = { runs: [{ id: "agent", session: "team", state: "running", title: "Check the patch", kind: "subagent" }] };
  second.resolve(oldList);
  const explicit = await manual;
  first.resolve(oldList);
  await until(() => warmPaints === 1);
  assert.equal(world.state.runs.get("agent")?.state, "finished", "a held warm response cannot resurrect a finished run");
  assert.equal(world.state.runs.get("agent")?.summary, "Checked");
  assert.equal(world.state.runs.get("agent")?.seenSeq, 2, "the original working-evidence sequence is preserved");
  assert.equal(!!box.querySelector('[data-run="agent"]'), false);
  assert.equal(box.querySelector("[data-runs]")?.textContent, "1 sub-agent ran");
  assert.equal(explicit.runs[0].state, "finished", "the manual list respects the newer stream record");
  strip.dispose();
}

t("overlapping Runs GETs publish in dispatch order", async () => {
  const earlier = Promise.withResolvers();
  const later = Promise.withResolvers();
  const route = "/chat/sessions/team/runs";
  const replies = [earlier, later];
  let reads = 0;
  const backend = fakeBackend({ [`GET ${route}`]: () => replies[reads++].promise });
  const { world } = await boot(backend);
  const overtake = world.act.listRuns("team");
  await until(() => backend.count("GET", route) === 1);
  const newest = world.act.listRuns("team");
  await until(() => backend.count("GET", route) === 2);
  const row = { id: "other-agent", state: "running", title: "Follow-up", kind: "subagent" };
  later.resolve({ runs: [{ ...row, state: "waiting" }] });
  assert.equal((await newest).runs[0].state, "waiting");
  earlier.resolve({ runs: [row] });
  assert.equal((await overtake).runs[0].state, "waiting", "an older overlapping GET also returns the already newer record");
  assert.equal(world.state.runs.get(row.id)?.state, "waiting");
});

await done();
