// @ts-check

import { RM } from "../../core/ui/motion.js";

/** @typedef {{ kind: "stopped" | "clear" | "calm", text: string, sub: string, force?: boolean }} FeedbackNotice */

/** @typedef {Pick<ReturnType<typeof import("../../core/kernel/scope.js").createScope>, "timeout" | "signal">} FeedbackScope */

/** @param {(notice: FeedbackNotice, duration: number) => void} show @param {FeedbackScope} scope */
export function createDecisionFeedback(show, scope) {
  return {
    /** @param {string | undefined} title @param {string} why */
    onNotSent(title, why) {
      const sub = `${String(title).replace(/`/g, "").replace(/[.?!]$/, "")} · ${why}`;
      scope.timeout(() => show({ kind: "stopped", text: "Not sent", sub, force: true }, 7000), RM.matches ? 0 : 950);
    },
    /** @param {string} summary */
    onAllClear(summary) {
      scope.timeout(() => show({ kind: "clear", text: "All clear", sub: summary }, 4600), RM.matches ? 0 : 900);
    },
    /** @param {number} remaining */
    onBreak(remaining) {
      if (!scope.signal.aborted) show({ kind: "calm", text: "Taking a break", sub: `${remaining} wait safely` }, 5200);
    },
  };
}
