// @ts-check

// The line under a conversation: who is at work on it, or what it waits for and until when.

import { ICON, XO } from "../../core/ui/icons/names.js";

/** @typedef {{ typing: HTMLElement & { _k?: string | null, _h?: string }, view: string }} TypingConv */

/** @typedef {{ world: any, CH: any, S: any, PROJ: (p: string) => string, convThread: (v: string) => any, chatOf: (v: string) => string | null, isBusy: (t: any) => boolean, heldWords: (h: any) => string, openAsk: (chat: string) => any, schedule: () => void, tick: () => void }} TypingDeps */

/** @param {TypingDeps} d */
export function createTyping({ world, CH, S, PROJ, convThread, chatOf, isBusy, heldWords, openAsk, schedule, tick }) {
  /** @param {TypingConv} C */
  function render(C) {
    const box = C.typing, view = C.view;
    const t = convThread(view);
    /** @type {{ key: string, cls: string, icon: string, text: string, since: any, wait?: boolean } | null} */
    let spec = null;
    const chat = !t && view !== "home" ? chatOf(view) : null;
    const coHeld = chat && world.act.coordinatorHeld ? world.act.coordinatorHeld(chat) : null;
    const chHeld = !chat && view.startsWith("c:") && world.act.sessionHeld ? world.act.sessionHeld(view.slice(2)) : null;
    const held = coHeld || chHeld || (t && t.held && !isBusy(t) && t.state !== "resolved" ? t.held : null);
    if (held) {
      const who = coHeld ? (view === "ws" ? "The coordinator" : `${PROJ(/** @type {string} */ (chat))} coordinator`) : "";
      const words = heldWords(held);
      spec = { key: `held:${coHeld ? chat : chHeld ? view : t.id}`, cls: "av-live is-wait", icon: coHeld ? XO : ICON.thread, text: who ? `${who} · ${words.replace(/^\w/, (c) => c.toLowerCase())}` : words, since: null, wait: true };
      clearTimeout(S.heldT);
      const at = Date.parse(held.until || "");
      if (at > Date.now()) S.heldT = setTimeout(schedule, Math.min(at - Date.now() + 50, 2 ** 31 - 1));
    } else if (chat && world.act.replying(chat)) {
      const aw = world.state.awaiting[chat];
      const who = view === "ws" ? "The coordinator" : `${PROJ(chat)} coordinator`;
      const doing = world.act.doing ? world.act.doing(chat) : null;
      spec = { key: `co:${chat}`, cls: "av-w", icon: XO, text: doing ? `${who} · ${doing.replace(/`/g, "")}` : `${who} is ${aw ? "replying" : "working"}`, since: aw ? aw.at : null };
    } else if (chat && chat !== "workspace" && openAsk(chat)) {
      const ask = openAsk(chat);
      spec = { key: `ask:${ask.id}`, cls: "av-w", icon: XO, text: `${PROJ(chat)} coordinator · Waiting for the Workspace coordinator to reply`, since: null };
      clearTimeout(S.askT);
      S.askT = setTimeout(schedule, Math.max(0, (Date.parse(ask.created_at || ask.at || "") || Date.now()) + 20 * 60e3 - Date.now()) + 50);
    } else if (view.startsWith("c:")) {
      const sid = view.slice(2), tu = world.state.turns && world.state.turns.running(sid);
      if (CH.working(view) && !(tu && world.state.turns.blocksOf(tu).length)) spec = { key: `c:${sid}`, cls: "av-live", icon: ICON.thread, text: "Working", since: null };
    } else if (t && t.sessionId && world.state.turns && world.state.turns.running(t.sessionId) && world.state.turns.blocksOf(world.state.turns.running(t.sessionId)).length) {
      spec = null;
    } else if (t && isBusy(t)) {
      const cur = t.checklist.items.find((/** @type {any} */ i) => i.state === "doing");
      spec = { key: `t:${t.id}`, cls: "av-live", icon: ICON.thread, text: `Working${cur ? ` · ${cur.text}` : ""}`, since: t.lastAt };
    }
    let changed = false;
    if (!spec) {
      if (box._k != null) { box.innerHTML = ""; box._k = null; box._h = ""; changed = true; }
      return changed;
    }
    if (box._k !== spec.key) {
      box.innerHTML = spec.wait
        ? `<div class="typing is-held" role="status"><div class="av ${spec.cls}">${spec.icon}</div><div class="ty-b"><span class="ty-t"></span><span class="elapsed"></span></div></div>`
        : `<div class="typing" role="status"><div class="av ${spec.cls}">${spec.icon}<i class="arc" aria-hidden="true"></i></div><div class="ty-b"><span class="ty-t shimmer"></span><span class="elapsed"></span></div></div>`;
      box._k = spec.key; box._h = spec.key;
      changed = true;
    }
    const tx = /** @type {HTMLElement} */ (box.querySelector(".ty-t"));
    if (tx.textContent !== spec.text) tx.textContent = spec.text;
    const el = /** @type {HTMLElement} */ (box.querySelector(".elapsed"));
    if (spec.since) el.dataset.since = spec.since; else { delete el.dataset.since; el.textContent = ""; }
    tick();
    return changed;
  }
  return { render };
}
