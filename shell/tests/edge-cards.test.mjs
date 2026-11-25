// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { createKernel } from "../../core/kernel/kernel.js";
import { edgeCardsModule } from "../edge-cards.js";

test("closing or retiring the covering card restores only its live peer", async () => {
  const kernel = createKernel();
  const draws = [];
  kernel.register(edgeCardsModule);
  for (const name of ["decisions", "files"]) {
    kernel.register({
      manifest: { id: "test." + name, version: "1.0.0", kernel: "^1.1.0", needs: ["edgeCards"] },
      activate(ctx) {
        ctx.effect(() => ctx.use("edgeCards").register(name, {
          isOpen: () => true, park: () => draws.push("park " + name), unpark: () => draws.push("restore " + name),
        }));
      },
    });
  }
  await kernel.start();
  kernel.bus.emit("app:card-opened", "decisions");
  kernel.bus.emit("app:card-closed", "decisions");
  assert.deepEqual(draws.splice(0), ["park files", "restore files"]);
  kernel.bus.emit("app:card-opened", "files");
  await kernel.disable("test.files");
  assert.deepEqual(draws.splice(0), ["park decisions", "restore decisions"]);
  await kernel.enable("test.files");
  kernel.bus.emit("app:card-opened", "decisions");
  await kernel.disable("test.files");
  kernel.bus.emit("app:card-closed", "decisions");
  assert.deepEqual(draws, ["park files"]);
  kernel.dispose();
});
