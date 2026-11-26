// storm when a pool's usage limit lifts, end to end on a fake backend: a runtime's health follows its live pool, with no runtimes read.
import { fakeBackend, boot, until, settle, fire, runner } from "./storm-harness.mjs";
import { healthOf, windowsOf } from "../core/services/runtimes.js";

const { t, done, assert } = runner();

const AT_LIMIT = { installed: true, logged_in: true, pool: "cc:a", usable: false, why_not: "its usage limit is closed", limit: "closed",
  resets_at: "2026-11-26T19:00:00Z", windows: { five_hour: { state: "closed", utilization: 1, resets_at: "2026-11-26T19:00:00Z" } } };

t("a runtime's limit, usable and usage windows are its live pool's: the stream and the status move them, with no runtimes read", async () => {
  const be = fakeBackend({
    "GET /chat/status": { pools: [{ id: "cc:a", state: "closed", resets_at: "2026-11-26T19:00:00Z" }] },
    "GET /chat/runtimes": { runtimes: [{ name: "claude_code", cli: { logged_in: true, account: "a" }, health: AT_LIMIT }] },
  });
  const { world } = await boot(be);
  await until(() => !!world.state.runtimes?.length);
  assert.equal(healthOf(world.state.runtimes[0]).key, "closed");
  const reads = be.count("GET", "/chat/runtimes");
  be.push("pool", { seq: 10, data: { pool: "cc:a", state: "open", resets_at: null, was: "closed" } }, 10);
  await until(() => world.state.runtimes[0].health.limit === "open");
  const rt = world.state.runtimes[0];
  assert.equal(healthOf(rt).key, "usable");
  assert.equal(rt.health.usable, true);
  assert.equal(rt.health.why_not, null);
  be.routes["GET /chat/status"] = { pools: [{ id: "cc:a", state: "open", windows: { five_hour: { state: "open", utilization: 0.02, resets_at: null } } }] };
  fire("visibilitychange");
  await until(() => windowsOf(world.state.runtimes[0])[0]?.state === "open", 2000);
  await settle();
  assert.equal(be.count("GET", "/chat/runtimes"), reads, "nothing was read again");
});

await done();
