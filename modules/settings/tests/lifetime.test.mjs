import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createKernel } from "../../../core/kernel/index.js";
import { settingsModule } from "../module.js";
import { SETTINGS_PAGE_OPEN } from "../page-events.js";

const { document } = await dom('<section id="settings">'
  + '<div data-page="rules"><button id="inside">Act</button><button id="pending" aria-disabled="true">Wait</button></div>'
  + '<div data-page="worktrees"></div></section><div data-page="rules"><button id="outside">Other</button></div>');
const kernel = createKernel();
kernel.register(settingsModule);
const opened = [], acted = [];
for (const name of ["rules", "worktrees"]) {
  kernel.register({
    manifest: { id: `xo.${name}`, version: "1.0.0", kernel: "^1.1.0", needs: ["settings"] },
    activate(ctx) {
      ctx.effect(() => ctx.use("settings").bindPage(name, {
        open() { opened.push(name); },
        click(target) { acted.push(target.id); return true; },
      }));
    },
  });
}

await kernel.start();
kernel.bus.emit(SETTINGS_PAGE_OPEN, "rules");
kernel.bus.emit(SETTINGS_PAGE_OPEN, "worktrees");
assert.deepEqual(opened, ["rules", "worktrees"]);
for (const id of ["inside", "pending", "outside"]) document.getElementById(id).click();
assert.deepEqual(acted, ["inside"]);
await kernel.disable("xo.rules");
assert.equal(kernel.live("xo.rules"), 0);
kernel.bus.emit(SETTINGS_PAGE_OPEN, "rules");
kernel.bus.emit(SETTINGS_PAGE_OPEN, "worktrees");
document.getElementById("inside").click();
assert.deepEqual(opened, ["rules", "worktrees", "worktrees"]);
assert.deepEqual(acted, ["inside"]);
await kernel.disable(settingsModule.manifest.id);
assert.equal(kernel.live("xo.worktrees"), 0);
kernel.bus.emit(SETTINGS_PAGE_OPEN, "worktrees");
assert.deepEqual(opened, ["rules", "worktrees", "worktrees"]);
