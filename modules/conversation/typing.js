// @ts-check

// The line under a conversation: who is at work on it, or what it waits for and until when.

import { DOTS, ICON, XO } from "../../core/ui/icons/names.js";
import { ARC } from "../../core/ui/icons/icon.js";

/** @typedef {{ typing: HTMLElement, view: string }} TypingConv */

/** @import { TypingDeps } from "./typing-types" */

/** @param {TypingDeps} d @param {Pick<import("../../core/kernel/types").ModuleContext, "timeout">} scope */
export function createTyping({ world, CH, PROJ, convThread, chatOf, isBusy, heldWords, openAsk, sendingTo, schedule, tick }, scope) {
  /** @type {WeakMap<TypingConv, () => void>} */
  const timers = new WeakMap();
  /** @param {TypingConv} C */
  function render(C) {
    timers.get(C)?.();
    timers.delete(C);
    const box = C.typing, view = C.view;
    const t = convThread(view);
    /** @type {{ key: string, cls: string, icon: string, text: string, since: string | number | null, wait?: boolean } | null} */
    let spec = null;
    const chat = !t && view !== "home" ? chatOf(view) : null;
    const coHeld = chat && world.act.coordinatorHeld ? world.act.coordinatorHeld(chat) : null;
    const chHeld = !chat && view.startsWith("c:") && world.act.sessionHeld ? world.act.sessionHeld(view.slice(2)) : null;
    const held = coHeld || chHeld || (t && t.held && !isBusy(t) && t.state !== "resolved" ? t.held : null);
    const ask = chat && chat !== "workspace" ? openAsk(chat) : null;
    const turn = t?.sessionId && world.state.turns?.running(t.sessionId);
    if (held) {
      const who = coHeld ? (view === "ws" ? "The coordinator" : `${PROJ(/** @type {string} */ (chat))} coordinator`) : "";
      const words = heldWords(held);
      spec = { key: `held:${coHeld ? chat : chHeld ? view : t?.id}`, cls: "av-live is-wait", icon: coHeld ? XO : ICON.thread, text: who ? `${who} · ${words.replace(/^\w/, (c) => c.toLowerCase())}` : words, since: null, wait: true };
      const at = Date.parse(held.until || "");
      if (at > Date.now()) timers.set(C, scope.timeout(schedule, Math.min(at - Date.now() + 50, 2 ** 31 - 1)));
    } else if (chat && (world.act.replying(chat) || sendingTo(chat))) {
      const aw = world.state.awaiting[chat];
      const who = view === "ws" ? "The coordinator" : `${PROJ(chat)} coordinator`;
      const doing = world.act.doing ? world.act.doing(chat) : null;
      const out = aw || sendingTo(chat);
      spec = { key: `co:${chat}`, cls: "av-w", icon: XO, text: doing ? `${who} · ${doing.replace(/`/g, "")}` : `${who} is ${out ? "replying" : "working"}`, since: out ? out.at : null };
    } else if (chat && ask) {
      spec = { key: `ask:${ask.id}`, cls: "av-w", icon: XO, text: `${PROJ(chat)} coordinator · Waiting for the Workspace coordinator to reply`, since: null };
      const end = (Date.parse(ask.created_at || ask.at || "") || Date.now()) + 20 * 60e3;
      timers.set(C, scope.timeout(schedule, Math.max(0, end - Date.now()) + 50));
    } else if (view.startsWith("c:")) {
      const sid = view.slice(2), tu = world.state.turns && world.state.turns.running(sid);
      if (CH.working(view) && !(tu && world.state.turns.blocksOf(tu).length)) spec = { key: `c:${sid}`, cls: "av-live", icon: ICON.thread, text: "Working", since: null };
    } else if (turn && world.state.turns.blocksOf(turn).length) {
      spec = null;
    } else if (t && isBusy(t)) {
      const cur = t.checklist.items.find((i) => i.state === "doing");
      spec = { key: `t:${t.id}`, cls: "av-live", icon: ICON.thread, text: `Working${cur ? ` · ${cur.text}` : ""}`, since: t.lastAt };
    }
    let changed = false;
    if (!spec) {
      if (box.firstChild) { box.innerHTML = ""; delete box.dataset.typingKey; changed = true; }
      return changed;
    }
    if (box.dataset.typingKey !== spec.key) {
      box.innerHTML = spec.wait
        ? `<div class="typing is-held" role="status"><div class="av ${spec.cls}">${spec.icon}</div><div class="ty-b"><span class="ty-t"></span><span class="elapsed"></span></div></div>`
        : `<div class="typing" role="status"><div class="av ${spec.cls}">${spec.icon}${ARC}</div><div class="ty-b">${DOTS}<span class="ty-t shimmer"></span><span class="elapsed"></span></div></div>`;
      box.dataset.typingKey = spec.key;
      changed = true;
    }
    const tx = /** @type {HTMLElement} */ (box.querySelector(".ty-t"));
    if (tx.textContent !== spec.text) tx.textContent = spec.text;
    const el = /** @type {HTMLElement} */ (box.querySelector(".elapsed"));
    if (spec.since) el.dataset.since = String(spec.since); else { delete el.dataset.since; el.textContent = ""; }
    tick();
    return changed;
  }
  return { render };
}
