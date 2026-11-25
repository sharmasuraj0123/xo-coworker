// @ts-check

import { pressEntry } from "../../shell/conversation-press.js";
import { createRunsPage } from "./page.js";
import { createRunsStrip } from "./strip.js";
import { wireRunsGesture } from "../../shell/gestures.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

/** @import { RunsHost } from "./module-types.d.ts" */

/** @typedef {import("../../core/kernel/types").Services["world"]} RunsPageWorld */

/** @typedef {Parameters<ReturnType<typeof createRunsStrip>["workingRuns"]>[0]} RunThread */

/** @param {RunsHost} host */
export function createRunsModule(host) {
  /** @type {{ page: ReturnType<typeof createRunsPage>, strip: ReturnType<typeof createRunsStrip>, world: RunsPageWorld } | undefined} */
  let active;
  /** @type {ModuleDef} */
  const module = {
    manifest: {
      id: "xo.runs", version: "1.0.0", kernel: "^1.1.0", needs: ["world", "announce"],
      contributes: ["panel.page:runs", "thread.head:runs", "conversation.press:run"],
    },
    activate(ctx) {
      const world = ctx.use("world");
      const strip = createRunsStrip({ world, SHAPE: host.shape, schedule: () => ctx.emit("app:render") });
      ctx.effect(() => strip.dispose);
      const page = createRunsPage({ ...host, world, announce: ctx.use("announce") });
      ctx.effect(() => () => { active = undefined; page.dispose(); });
      active = { page, strip, world };
      wireRunsGesture(page.card, () => page.isDetail, page.back, ctx.signal);
      ctx.contribute("panel.page", page.page);
      ctx.contribute("conversation.press", pressEntry("run", openFrom));
      ctx.contribute("thread.head", { id: "runs", order: 20, render: strip.runsStrip });
    },
  };
  /** @param {Element} target */
  function openFrom(target) {
    if (!active) return false;
    const call = target.closest("[data-run-call]");
    const spawn = call?.getAttribute("data-run-call");
    const strip = target.closest(".thead [data-run], .thead [data-runs]");
    const opener = spawn ? call : strip;
    if (!opener) return false;
    const thread = host.threadAt(opener);
    const run = spawn ? [...active.world.state.runs.values()].find((candidate) => candidate.spawn === spawn)?.id ?? null
      : opener.getAttribute("data-run");
    void active.page.open(thread, run);
    return true;
  }
  return {
    module,
    working: (/** @type {RunThread} */ thread) => active?.strip.workingRuns(thread) ?? 0,
    layer: { id: "runs", open: () => active?.page.isOpen ?? false, close: () => active?.page.back() },
  };
}
