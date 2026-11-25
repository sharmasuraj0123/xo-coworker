// @ts-check
import { glyphOf, isBusy, isHeld, stOf, threadInfo, wordOf } from "./status.js";
import { setThreadInfo } from "../../core/ui/markdown/markdown.js";
import { threadTitleInput, threadLabelInput } from "./editing.js";
import { threadsCtl } from "./header.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

/** @import { ThreadPresentation } from "./presentation-types" */

/** @type {ThreadPresentation} */
export const threadPresentation = { glyphOf, isBusy, isHeld, stOf, wordOf, threadsCtl, threadTitleInput, threadLabelInput };

/** @type {ModuleDef} */
export const threadPresentationModule = {
  manifest: { id: "xo.thread-presentation", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world"], provides: ["threadPresentation"] },
  activate(ctx) {
    ctx.provide("threadPresentation", threadPresentation);
    ctx.effect(() => { setThreadInfo(threadInfo(ctx.use("world").thread)); return () => setThreadInfo(null); });
  },
};
