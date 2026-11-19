// @ts-check

// The decision kit: the ask list and its risk, the one place a decision becomes a world call, the 3 s window with Undo, the announcer.

import { WAITING } from "../../core/services/world/store.js";
import { itemBody } from "../../core/services/review.js";
import { typing } from "../../core/platform/keys.js";
export { HOLD_MS, holdButton, holdToConfirm } from "../../core/ui/components/hold.js";

export const COMMIT_MS = 3000;
export const READ_MS = 300;
export const GROUPS = ["rope", "notable", "routine", "stopped"];

/** @param {any} ask @returns {string} */
export const riskOf = (ask) => (ask && (ask.risk === "routine" || ask.risk === "destructive") ? ask.risk : "notable");

/** @param {any} ask */
export const isBinary = (ask) => !!ask && (ask.kind === "permission" || ask.kind === "approval");

/** @param {any} t @param {any} ask */
export const askKey = (t, ask) => `${ask.id ?? `${t.id}:synthetic`}|${ask.title}`;

/** @param {any} t @param {any} ask */
export function groupOf(t, ask) {
  if (t.state === "failed" && !t.stop) return "stopped";
  const r = riskOf(ask);
  return r === "destructive" ? "rope" : r;
}

/** @param {any} t @returns {any[]} */
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

/** @param {any} ask */
export function commandOf(ask) {
  const m = /^run:\s*(.+)$/i.exec((ask && ask.title) || "");
  return m ? m[1].trim() : null;
}

/** @param {string | null | undefined} cmd */
export function prefixOf(cmd) {
  const w = String(cmd || "").trim().split(/\s+/);
  const tool = /^(npm|pnpm|yarn|npx|bun|git|python3?|pip3?|make|cargo|go|docker|kubectl|terraform)$/;
  return (tool.test(w[0]) && w[1] && !w[1].startsWith("-") ? w.slice(0, 2) : w.slice(0, 1)).join(" ");
}

/** @param {string} house @param {string | null} cmd */
export const teachSentence = (house, cmd) => `Standing rule for ${house}: you may run "${cmd}" without asking.`;

/** @param {any} world @param {any} t @param {any} ask @param {any} choice @param {string} [note] @returns {Promise<any>} */
export function answer(world, t, ask, choice, note = "") {
  note = String(note || "").trim();
  if (ask && ask.item) return world.act.decideItem(ask.item.id, itemBody(ask.item, choice, note));
  if (ask && ask.pending) return Promise.reject(new Error("Open the thread to see what it needs."));
  if (choice && typeof choice === "object") {
    if (choice.text != null) return world.act.reply(t.id, choice.text);
    return world.act.reply(t.id, choice.option + (note ? ` (${note})` : ""));
  }
  if (ask.replyOnly) return Promise.reject(new Error("Answer this one in words."));
  const allow = choice === "allow";
  if (isBinary(ask) && ask.id && !ask.synthetic) return world.act.decide(ask.id, allow ? "allow" : "deny", note);
  if (isBinary(ask) || ask.synthetic) {
    return world.act.reply(t.id, (allow ? "Approved." : "Not approved.") + (note ? " " + note : ""));
  }
  return world.act.reply(t.id, `Sending this back without an answer.${note ? " " + note : ""}`);
}

/** @typedef {{ id: number, parts: any[], meta: any, startedAt: number, due: number, timer?: ReturnType<typeof setTimeout> }} QueueItem */

/** @param {{ delay?: number, exec: (part: any) => any, onChange: (type: string, item: QueueItem, results?: any[]) => void }} o */
export function createCommitQueue({ delay = COMMIT_MS, exec, onChange }) {
  /** @type {QueueItem[]} */
  const queued = [];
  /** @type {QueueItem[]} */
  const inflight = [];
  let n = 0;
  /** @param {QueueItem} item */
  async function fire(item) {
    const i = queued.indexOf(item);
    if (i < 0) return;
    queued.splice(i, 1);
    inflight.push(item);
    onChange("sending", item);
    const results = await Promise.all(item.parts.map((p) =>
      Promise.resolve().then(() => exec(p)).then(() => ({ part: p, ok: true }), (err) => ({ part: p, ok: false, err }))));
    inflight.splice(inflight.indexOf(item), 1);
    onChange("settled", item, results);
  }
  return {
    /** @param {any[]} parts @param {any} [meta] */
    push(parts, meta = {}) {
      /** @type {QueueItem} */
      const item = { id: ++n, parts, meta, startedAt: Date.now(), due: Date.now() + delay };
      item.timer = setTimeout(() => fire(item), delay);
      queued.push(item);
      onChange("queued", item);
      return item;
    },
    /** @param {number} [id] */
    undo(id) {
      const item = id ? queued.find((x) => x.id === id) : queued[queued.length - 1];
      if (!item) return null;
      clearTimeout(item.timer);
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

/** @param {HTMLElement} region @param {{ quietMs?: number }} [o] */
export function createAnnouncer(region, { quietMs = 2000 } = {}) {
  let lastTyped = 0;
  /** @type {string[]} */
  const q = [];
  addEventListener("keydown", (e) => {
    if (typing(e)) lastTyped = Date.now();
  }, true);
  const flush = () => {
    if (!q.length || Date.now() - lastTyped < quietMs) return;
    const msg = q.splice(0).join(" ");
    region.textContent = "";
    setTimeout(() => { region.textContent = msg; }, 60);
  };
  setInterval(flush, 400);
  return {
    /** @param {string} text */
    say(text) { if (text && !q.includes(text)) q.push(text); },
    /** @param {string} text */
    now(text) { region.textContent = ""; setTimeout(() => { region.textContent = text; }, 60); },
  };
}

/** @param {number} n @param {string} base */
export const titleFor = (n, base) => (n ? "Needs you · " : "") + base;
