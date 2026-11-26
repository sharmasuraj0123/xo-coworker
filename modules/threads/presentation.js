// @ts-check
import { createThreadGroups } from "./groups.js";
import { glyphOf, isBusy, isHeld, stOf, threadInfo, wordOf } from "./status.js";
import { setThreadInfo } from "../../core/ui/markdown/markdown.js";
import { threadTitleInput, threadLabelInput } from "./editing.js";
import { threadsCtl } from "./header.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

/** @import { ThreadPresentation } from "./presentation-types" */

/** @type {ThreadPresentation} */
const threadPresentation = { glyphOf, isBusy, isHeld, stOf, wordOf, threadsCtl, threadTitleInput, threadLabelInput };

/** @type {ModuleDef} */
export const threadPresentationModule = {
  manifest: { id: "xo.thread-presentation", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world"], provides: ["threadPresentation"] },
  activate(ctx) {
    ctx.provide("threadPresentation", threadPresentation);
    ctx.effect(() => { setThreadInfo(threadInfo(ctx.use("world").thread)); return () => setThreadInfo(null); });
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const threadGroupsModule = {
  manifest: { id: "xo.thread-groups", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "decisionPresentation", "mapAgents", "threadRuntime", "placeContext"],
    provides: ["threadGroups"] },
  activate(ctx) {
    const { D, askShort } = ctx.use("decisionPresentation");
    ctx.provide("threadGroups", createThreadGroups({
      world: ctx.use("world"), D, MAP: ctx.use("mapAgents"), convProject: ctx.use("placeContext").convProject,
      askShort, threadMark: ctx.use("threadRuntime").threadMark, isBusy, isHeld,
    }));
  },
};
