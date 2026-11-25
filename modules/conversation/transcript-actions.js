// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { valuePress } from "../../shell/conversation-press.js";

/** @import { PressRoutes } from "../../shell/conversation-press-types" */

/** @param {import("./transcript-action-types").TranscriptActions} host @returns {PressRoutes} */
export function transcriptActions({ convAt, loadOlderNow, transcriptFolds, schedule, convThread, toggleChecklist,
  checklistRender, needs, requestFocus, heraldBox, interruptRun }) {
  return {
    older: valuePress("data-older", (_, target) => loadOlderNow(convAt(target)), true),
    fold: valuePress("data-tb", (key, control) => {
      if (!key) return;
      const conversation = convAt(control);
      if (control.closest(".msgs")) conversation.follow.unpin();
      transcriptFolds.toggle(key, { host: conversation.msgs, restoreFocus: control.contains(document.activeElement) });
      schedule();
    }, true),
    checklist: valuePress("data-ck", (_, target) => {
      const conversation = convAt(target);
      const thread = convThread(conversation.view);
      if (!thread) return;
      toggleChecklist(thread.id);
      if (conversation.main) checklistRender(needs());
      else checklistRender(needs(), requireHtml("#tpthead"), conversation.view, "tck-list");
    }, true),
    interrupt: valuePress("data-interrupt", (_, target) => {
      requestFocus([() => heraldBox()?.querySelector("[data-herald-undo]")]);
      interruptRun(convAt(target).view);
    }, true),
  };
}
