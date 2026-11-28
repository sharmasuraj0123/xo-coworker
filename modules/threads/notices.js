// @ts-check

import { rtName } from "../../core/services/runtimes.js";

/** @import { StormEvent } from "../../core/services/storm/types.d.ts" */

/** @import { ThreadNoticeOptions } from "./notices-types.d.ts" */

/** @param {ThreadNoticeOptions} options */
export function threadNotices({ find, projectName, movedHere, show, waitSince }) {
  return (/** @type {StormEvent} */ event) => {
    const thread = event.thread ? find(event.thread) : null;
    if (!thread) return;
    if (event.kind === "ask" && !waitSince.has(thread.id)) waitSince.set(thread.id, Date.now());
    if (event.kind === "resumed") waitSince.delete(thread.id);
    const project = event.project;
    if (!project || project === "workspace") return;
    const open = "t:" + thread.id;
    if (event.kind === "moved" && !movedHere(thread.id)) {
      show({
        kind: "done", text: `${thread.title} continues on ${rtName(event.agent)}`,
        sub: projectName(project), open: event.to ? "t:" + event.to : open,
      }, 5200);
    } else if (event.kind === "done") {
      show({ kind: "done", text: `${thread.title} finished`, sub: projectName(project), open }, 5200);
    } else if (event.kind === "state" && thread.state === "failed") {
      show({ kind: "stopped", text: `${thread.title} stopped`, sub: projectName(project), open }, 5200);
    }
  };
}
