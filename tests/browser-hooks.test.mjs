import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { hooks, serve } from "./browser/harness.cjs";
import { fakeBackend, until } from "./storm-harness.mjs";

test("the served Storm hook pauses transport without retiring event injection", async (t) => {
  const routes = new Map();
  await hooks({ route: async (pattern, handler) => routes.set(pattern, handler) });
  const route = routes.get("**/core/services/storm/stream.js");
  const server = await serve();
  t.after(() => server.close());
  const base = "http://127.0.0.1:" + server.address().port;
  const response = await fetch(base + "/core/services/storm/stream.js");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/javascript");
  let instrumented;
  await route({ fetch: async () => response, fulfill: ({ body }) => { instrumented = body; } });
  await assert.rejects(
    route({ fetch: async () => new Response("no boot here"), fulfill: assert.fail }),
    /needs one boot anchor/,
  );

  const loader = registerHooks({
    load(url, context, nextLoad) {
      if (!url.endsWith("/core/services/storm/stream.js")) return nextLoad(url, context);
      return { format: "module", source: instrumented, shortCircuit: true };
    },
  });
  t.after(() => loader.deregister());
  globalThis.window = globalThis;
  t.after(() => { delete globalThis.window; Reflect.deleteProperty(globalThis, "__storm"); });
  const backend = fakeBackend();
  const { createWorld } = await import("../core/services/world/store.js");
  const world = createWorld();
  t.after(world.dispose);
  backend.push("snapshot", { data: { seq: 1 } });
  await until(() => world.state.loaded);
  const stormHook = Reflect.get(globalThis, "__storm");
  stormHook.stop();
  assert.equal(backend.asked[0].signal.aborted, true);
  const got = [];
  world.onEvent((event) => got.push(event.kind));
  stormHook.apply({ type: "file.version", seq: 2, data: { path: "a.txt" } });
  assert.deepEqual(got, ["file"]);
});
