// @ts-check
import { stormAsks } from "../../world/threads.js";
import { hostOf, askedBy } from "../../review.js";
import { isLimitItem, limitItem } from "../../runtimes.js";
import { paidItem, accountRows, heldModes } from "../../world/paid.js";
import { WAITING_STATES } from "../config.js";

/** @typedef {import("../types").Ctx} Ctx @typedef {import("../types").Row} Row */

/** Rebuilding the thread list and the hosts of items with no thread, and announcing the changes worth a line. @param {Ctx} ctx */
export function installCommit(ctx) {
  const { state, rawThreads, event, scope } = ctx;
  /** @param {Row} it */
  const askerOf = (it) => askedBy(it, it.session_id ? state.sessions[it.session_id] : null);

  ctx.commit = () => {
    if (scope.signal.aborted) return;
    ctx.indexMoves();
    const prev = new Map(state.threads.map((t) => [t.id, t]));
    const known = new Set(state.projects.map((p) => p.id));
    const next = [];
    const runsBy = ctx.runsBySession();
    for (const r of rawThreads.values()) {
      const project = ctx.projectOf(r.chat_id);
      if (!project || !known.has(project)) continue;
      const t = ctx.uiThread(r, project, runsBy);
      const old = prev.get(t.id);
      if (state.loaded && !ctx.holding) {
        if (old && old.state !== t.state) event({ kind: t.state === "done" ? "done" : WAITING_STATES.has(t.state) && !t.frozen ? "ask" : "state", thread: t.id, project: t.project, text: `${t.title}: ${t.state.replace("_", " ")}` });
        if (!old) event({ kind: "spawn", thread: t.id, project: t.project, text: `New thread: ${t.title}` });
        if (old && WAITING_STATES.has(old.state) && !WAITING_STATES.has(t.state)) event({ kind: "resumed", thread: t.id, project: t.project });
      }
      if (scope.signal.aborted) return;
      next.push(t);
    }
    state.threads = next.sort((a, b) => b.lastAt - a.lastAt);
    /** @type {Map<string, import("../../world/state-types.d.ts").DecisionHost>} */
    const hosts = new Map();
    /** @type {ReturnType<typeof accountRows> | null} */
    let rows = null;
    const paidRows = () => rows || (rows = accountRows({ advisory: state.advisory, held: heldModes(state.paid), pools: state.pools, served: state.paidPools }));
    for (const it of state.review.values()) {
      if (it.state !== "open") continue;
      const h = hostOf(it);
      if (!h) continue;
      // an item of your account (usage) or of a plain chat belongs to no project row in the sidebar
      const project = h.chat ? ctx.projectOf(h.chat) || "workspace" : h.session ? "@chats" : "@account";
      const asker = h.chat ? askerOf(it) : null;
      /** @type {import("../../world/state-types.d.ts").DecisionHost} */
      const host = hosts.get(h.id) || { id: h.id, host: true, project, chatId: h.chat, plainSession: h.session || null, asker, title: h.title || (asker ? "Coordinator" : project === "workspace" ? "Workspace" : project),
        state: "needs_approval", checklist: { items: [], total: 0, done: 0, doing: 0 }, messages: [], asks: [], live: true, loaded: true, busy: false,
        createdAt: Date.parse(it.created_at ?? "") || Date.now(), lastAt: Date.parse(it.created_at ?? "") || Date.now(), card: {} };
      const shown = isLimitItem(it) ? limitItem(it, state.runtimes, ctx.chatPolicyOf) : paidItem(it, paidRows());
      if (shown !== it && isLimitItem(it)) host.title = "Usage limit";
      host.asks.push(...stormAsks(host, [shown]));
      hosts.set(h.id, host);
    }
    state.hosts = [...hosts.values()];
  };

  /** @type {(() => void) | undefined} */
  let soonT;
  /** @type {(() => void) | null} */
  let emitT = null;
  ctx.soon = () => { soonT?.(); soonT = scope.timeout(() => { ctx.commit(); ctx.emit(); }, 30); };
  ctx.emitSoon = () => { if (!emitT) emitT = scope.timeout(() => { emitT = null; ctx.emit(); }, 40); };
}
