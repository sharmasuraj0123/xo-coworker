// @ts-check

import { ICON } from "../../core/ui/icons/names.js";
import { xi } from "../../core/ui/icons/icon.js";
import { rtMark } from "../../core/services/runtimes.js";

/** @typedef {import("./types").Session} ChatRow */

/** @typedef {import("../../core/services/world/held.js").Hold} Hold */

/** @typedef {import("./types").WorkspaceSummary} WorkspaceSummary */

/** @typedef {{ rows: ChatRow[], waiting: (row: ChatRow) => boolean, inTurn: (row: ChatRow) => boolean, heldOf: (row: ChatRow) => Hold | null, heldShort: (held: Hold) => string, rowLine: (row: ChatRow) => string, titleFor: (row: ChatRow) => string, world: { act: { sessionBusy?: (id: string) => boolean } }, rowTime: (iso: string) => string, agentName: (agent: string | null | undefined) => string }} ListDeps */

/** The start screen's one row: the Workspace, which never ages; your chats are in the panel. @param {WorkspaceSummary | null} workspace */
export function chatListItems(workspace) {
  return workspace ? [{ key: "chats-ws", html: workspaceRow(workspace) }] : [];
}

/** Its words say how far it reaches and what's moving, where a chat says when it was last used. @param {WorkspaceSummary} w */
function workspaceRow({ projects, working, coordinator }) {
  const busy = working ? `${working} working` : coordinator ? "Working" : "";
  const reach = `${projects} ${projects === 1 ? "project" : "projects"}`;
  const label = `Workspace: your coordinator across ${reach}${busy ? `, ${busy.toLowerCase()}` : ""}`;
  return `<ul class="chl-list chl-pin"><li><button type="button" class="chl-row" data-go="ws" aria-label="${label}">` +
    `<span class="chl-tile">${xi("layers")}</span>` +
    `<span class="chl-t">Workspace<span class="chl-sub"> · every project, one conversation</span></span>` +
    `<span class="chl-a">${busy ? `<span class="is-busy">${busy}</span> · ` : ""}${reach}</span></button></li></ul>`;
}

/** Your chats for the panel, grouped as its threads are: needing you, working, then the rest, newest first. @param {string} v @param {ListDeps} deps */
export function chatGroups(v, { rows, waiting, inTurn, heldOf, heldShort, rowLine, titleFor, world, rowTime, agentName }) {
  /** @type {Record<"needs" | "working" | "recent", import("../../shell/panel/list-types").Row[]>} */
  const groups = { needs: [], working: [], recent: [] };
  for (const s of rows) {
    const wait = waiting(s), busy = inTurn(s) || !!(world.act.sessionBusy && world.act.sessionBusy(s.id));
    const held = !wait && !busy ? heldOf(s) : null;
    const state = wait ? "needs" : busy ? "working" : "recent";
    const word = wait ? "Needs you" : busy ? "Working" : held ? heldShort(held) : "Idle";
    groups[state].push({ go: `c:${s.id}`, title: titleFor(s), state, word, sub: held ? word : rowLine(s) || agentName(s.agent),
      at: busy ? "" : rowTime(s.updated_at || s.created_at || ""), icon: rtMark(/** @type {string} */ (s.agent)) || ICON.thread, on: v === `c:${s.id}` });
  }
  const words = { needs: "Needs you", working: "Working", recent: "Recent" };
  return (/** @type {const} */ (["needs", "working", "recent"])).filter((k) => groups[k].length).map((k) => ({ k, word: words[k], rows: groups[k] }));
}
