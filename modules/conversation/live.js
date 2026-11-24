// @ts-check

/** @import { LiveConversationDeps } from "./live-types.d.ts" */

/** @param {LiveConversationDeps} options */
export function createLiveConversation({ view, world, CH, convThread, chatOf }) {
  /** @param {string} v */
  function liveReady(v) {
    const t = convThread(v);
    if (t) return t.loaded;
    const h = world.state.hist[/** @type {string} */ (chatOf(v))];
    return !!h && !(h.loading && !(world.state.timeline[/** @type {string} */ (chatOf(v))] || []).length);
  }

  function follow() {
    const v = view(), t = convThread(v);
    if (v !== "chats") CH.leaveList();
    if (CH.isChats(v)) { world.act.watch([]); world.act.watchThread(null); world.act.watchSession?.(v.startsWith("c:") ? v.slice(2) : null); CH.open(v); return; }
    world.act.watchSession?.(null);

    if (t && world.act.loadHops) world.act.loadHops(t.id);

    if (!t) loadChatHops(v);
    world.act.watch(v === "home" || v === "ws" ? ["workspace"] : v.startsWith("p:") ? [v.slice(2)] : t ? [t.project] : []);
    world.act.watchThread(t ? t.id : null);
  }

  /** @param {string} v */
  function loadChatHops(v) {
    const chat = v === "ws" || v === "home" ? "workspace" : v.startsWith("p:") ? v.slice(2) : null;
    if (chat && world.act.loadChatHops) world.act.loadChatHops(chat);
  }

  /** @param {string} [destination] */
  function ensureRoot(destination = view()) {
    const t = convThread(destination);
    if (!t || !world.act.findRows) return;
    const th = world.state.threadHist?.[t.id];
    if (!th || !th.loaded || !th.all) return;
    if ((world.state.timeline[t.project] || []).some((r) => r.id === t.id) || world.state.found?.[t.project]?.has(t.id)) return;
    const first = t.messages.find((m) => m.seq != null);
    world.act.findRows(t.project, [t.id], first ? first.seq : null);
  }

  return { liveReady, follow, loadChatHops, ensureRoot };
}
