// @ts-check

import { esc } from "../../core/platform/util.js";
import { reactionGroups } from "../../core/services/world/conversation.js";

/** @param {import("./message-context-types.d.ts").MessageContextDeps} options */
export function createMessageContext({ world, PROJ }) {
  /** @param {string} v */
  function convHost(v) {
    const hosts = world.state.hosts || [];
    if (v.startsWith("c:")) return hosts.find((h) => h.id === `session:${v.slice(2)}`) || null;
    const chat = v === "ws" ? world.project("workspace")?.chatId : v.startsWith("p:") ? world.project(v.slice(2))?.chatId : null;
    return chat ? hosts.find((h) => h.id === `chat:${chat}`) || null : null;
  }

  /** @param {string} project */
  function openAsk(project) {
    const chatId = world.project(project)?.chatId;
    if (!chatId || !world.state.hops) return null;
    let best = null, at = 0;
    for (const h of world.state.hops.values()) {
      if (h.chat_id !== chatId || h.kind !== "ask" || h.from_role !== "project-coordinator" || !(h.state === "sent" || h.state === "delivered")) continue;
      const t = Date.parse(h.created_at || h.at || "") || 0;
      if (t && Date.now() - t < 20 * 60e3 && t > at) { best = h; at = t; }
    }
    return best;
  }

  /** @param {{ chatId?: string | null, via?: string[] }} fwd */
  function fwdSource(fwd) {
    const p = fwd.chatId && world.act.projectOf ? world.act.projectOf(fwd.chatId) : null;
    if (p) return p === "workspace" ? null : p;
    const v = fwd.via || [];
    return v.length > 1 && v[0] !== "workspace" && v[0] !== "project" && world.project(v[0]) ? v[0] : null;
  }
  /** @param {Parameters<typeof reactionGroups>[0]} reactions */
  function reactionsHtml(reactions) {
    const groups = reactionGroups(reactions);
    if (!groups.length) return "";
    return `<div class="m-reacts" aria-label="Reactions">${groups.map((g) => {
      const who = g.by.map(reactorName).join(", ") || "An agent";
      return `<span class="m-react" title="${esc(`${who} reacted ${g.emoji}`)}">${esc(g.emoji)}${g.count > 1 ? `<span class="m-react-n">${g.count}</span>` : ""}</span>`;
    }).join("")}</div>`;
  }
  /** @param {string} sessionId */
  function reactorName(sessionId) {
    const s = (world.state.sessions || {})[sessionId];
    if (!s) return "An agent";
    if (s.role === "workspace-coordinator") return "The Workspace coordinator";
    const p = s.chat_id && world.act.projectOf ? world.act.projectOf(s.chat_id) : null;
    if (s.role === "project-coordinator") return p && p !== "workspace" ? `The ${PROJ(p)} coordinator` : "The coordinator";
    return p && p !== "workspace" ? `A ${PROJ(p)} agent` : "An agent";
  }

  return { convHost, openAsk, fwdSource, reactionsHtml };
}
