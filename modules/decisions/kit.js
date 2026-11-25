// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { isResponseObject } from "../../core/platform/http.js";
import { WAITING } from "../../core/services/world/store.js";
import { itemBody } from "../../core/services/review.js";
export { HOLD_MS, holdButton, holdToConfirm } from "../../core/ui/components/hold.js";

/** @import { DecisionChoice, DecisionPart, DecisionQueueDeps, DecisionQueueItem, DecisionQueueOptions } from "./queue-types.d.ts" */

/** @import { NeedAsk, NeedThread } from "../../core/services/decision-types.d.ts" */

export const COMMIT_MS = 3000;
export const READ_MS = 300;
export const GROUPS = ["rope", "notable", "routine", "stopped"];

/** @param {{risk?: string} | null | undefined} ask */
export const riskOf = (ask) => (ask && (ask.risk === "routine" || ask.risk === "destructive") ? ask.risk : "notable");

/** @param {unknown} ask */
export const isBinary = (ask) => isResponseObject(ask) && (ask.kind === "permission" || ask.kind === "approval");

/** @param {{id: string}} t @param {NeedAsk} ask */
export const askKey = (t, ask) => `${ask.id ?? `${t.id}:synthetic`}|${ask.title}`;

/** @param {{state: string, stop?: unknown}} t @param {{risk?: string}} ask */
export function groupOf(t, ask) {
  if (t.state === "failed" && !t.stop) return "stopped";
  const r = riskOf(ask);
  return r === "destructive" ? "rope" : r;
}

/** @param {Pick<NeedThread, "state" | "asks" | "frozen" | "needsYou">} t @returns {NeedAsk[]} */
export function asksOf(t) {
  if (t.asks && t.asks.length) return t.asks;
  if (!WAITING(t.state) || t.frozen) return [];
  return [{
    id: null,
    kind: t.state === "needs_approval" ? "approval" : "question",
    title: t.needsYou || "Open the thread to see what it needs",
    risk: "notable",
    synthetic: true,
  }];
}

/** @param {string | null | undefined} cmd */
export function prefixOf(cmd) {
  const w = String(cmd || "").trim().split(/\s+/);
  const tool = /^(npm|pnpm|yarn|npx|bun|git|python3?|pip3?|make|cargo|go|docker|kubectl|terraform)$/;
  return (tool.test(w[0]) && w[1] && !w[1].startsWith("-") ? w.slice(0, 2) : w.slice(0, 1)).join(" ");
}

/** @param {string} house @param {string | null} cmd */
export const teachSentence = (house, cmd) => `Standing rule for ${house}: you may run "${cmd}" without asking.`;

/** @param {DecisionQueueDeps["world"]} world @param {{id: string}} t @param {DecisionPart["ask"]} ask @param {DecisionChoice} choice */
export function answer(world, t, ask, choice, note = "") {
  note = String(note || "").trim();
  if (ask && ask.item) return world.act.decideItem(ask.item.id, itemBody(ask.item, choice, note));
  if (ask.pending) return Promise.reject(new Error("Open the thread to see what it needs."));
  if (choice && typeof choice === "object") {
    if ("text" in choice && choice.text != null) return world.act.reply(t.id, String(choice.text));
    return world.act.reply(t.id, String("option" in choice ? choice.option : undefined) + (note ? ` (${note})` : ""));
  }
  if (ask.replyOnly) return Promise.reject(new Error("Answer this one in words."));
  const allow = choice === "allow";
  const synthetic = ask.synthetic;
  if (isBinary(ask) && ask.id && !synthetic) {
    return world.act.decide(ask.id, allow ? "allow" : "deny", note);
  }
  if (isBinary(ask) || synthetic) {
    return world.act.reply(t.id, (allow ? "Approved." : "Not approved.") + (note ? " " + note : ""));
  }
  return world.act.reply(t.id, `Sending this back without an answer.${note ? " " + note : ""}`);
}

/** @param {DecisionQueueOptions} options */
export function createCommitQueue({ delay = COMMIT_MS, exec, onChange }) {
  const scope = createScope();
  const { signal } = scope;
  /** @type {DecisionQueueItem[]} */
  const queued = [];
  /** @type {DecisionQueueItem[]} */
  const inflight = [];
  scope.effect(() => () => { queued.length = inflight.length = 0; });
  if (typeof window !== "undefined") scope.listen(window, "pagehide", (event) => {
    if (!("persisted" in event && event.persisted)) scope.dispose();
  });
  let n = 0;
  /** @param {DecisionQueueItem} item */
  async function fire(item) {
    const i = queued.indexOf(item);
    if (i < 0) return;
    queued.splice(i, 1);
    inflight.push(item);
    onChange("sending", item);
    const results = await Promise.all(item.parts.map((p) =>
      Promise.resolve().then(() => { signal.throwIfAborted(); return exec(p, signal); })
        .then(() => ({ part: p, ok: true }), (err) => ({ part: p, ok: false, err }))));
    if (signal.aborted) return;
    inflight.splice(inflight.indexOf(item), 1);
    onChange("settled", item, results);
  }
  return {
    dispose: scope.dispose,
    timeout: scope.timeout,
    signal: scope.signal,
    /** @param {DecisionPart[]} parts @param {DecisionQueueItem["meta"]} [meta] */
    push(parts, meta = {}) {
      if (signal.aborted) return null;
      /** @type {DecisionQueueItem} */
      const item = { id: ++n, parts, meta, startedAt: Date.now(), due: Date.now() + delay };
      item.cancel = scope.timeout(() => { void fire(item); }, delay);
      queued.push(item);
      onChange("queued", item);
      return item;
    },
    /** @param {number} [id] */
    undo(id) {
      const item = id ? queued.find((x) => x.id === id) : queued[queued.length - 1];
      if (!item) return null;
      item.cancel?.();
      queued.splice(queued.indexOf(item), 1);
      onChange("undone", item);
      return item;
    },
    has: (/** @type {string} */ key) => [...queued, ...inflight].some((i) => i.parts.some((p) => p.key === key)),
    hasThread: (/** @type {string} */ tid) => [...queued, ...inflight].some((i) => i.parts.some((p) => p.t && p.t.id === tid)),
    get queued() { return queued.slice(); },
    get inflight() { return inflight.slice(); },
  };
}

/** @param {number} n @param {string} base */
export const titleFor = (n, base) => (n ? "Needs you · " : "") + base;
