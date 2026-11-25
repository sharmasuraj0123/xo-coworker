// @ts-check

import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { stateMark } from "../../core/ui/icons/icon.js";
import { rtMark } from "../../core/services/runtimes.js";

const RECENT = 3;

/** @typedef {import("./types").Session} ChatRow */

/** @typedef {import("../../core/services/world/held.js").Hold} Hold */

/** @typedef {{ list: boolean | null, err: string | null, all: boolean, q: string, searching: boolean }} ListState */

/** @typedef {{ rows: ChatRow[], waiting: (row: ChatRow) => boolean, inTurn: (row: ChatRow) => boolean, heldOf: (row: ChatRow) => Hold | null, heldShort: (held: Hold) => string, rowLine: (row: ChatRow) => string, titleFor: (row: ChatRow) => string, world: { act: { sessionBusy?: (id: string) => boolean } }, dayGroup: (iso: string) => string, rowTime: (iso: string) => string }} ListDeps */

/** @param {ListState} C @param {ListDeps} deps */
export function chatListItems(C, { rows, waiting, inTurn, heldOf, heldShort, rowLine, titleFor, world, dayGroup, rowTime }) {
  if (!C.list && !rows.length) return [{ key: "chats-load", html: `<p class="m-note">${C.err ? `Couldn't read your chats: ${esc(C.err)}` : "Reading your chats…"}</p>` }];
  if (!rows.length) return [{ key: "chats-none", html: `<div class="calm chl-calm"><div class="calm-mark">${ICON.thread}</div><h2>No chats yet.</h2><p>Your first question starts one. No project needed.</p></div>` }];
  // at rest a few of the latest under the composer; all of them, searchable and by day, a click away
  const few = !C.all && rows.length > RECENT;
  const q = C.all ? C.q.trim().toLowerCase() : "";
  const shown = few ? rows.slice(0, RECENT) : q ? rows.filter((s) => `${titleFor(s)} ${rowLine(s)}`.toLowerCase().includes(q)) : rows;
  const more = !C.all && rows.length > RECENT ? `<button type="button" class="chl-more" data-chl-all="1">All chats<span class="chl-n"> · ${rows.length}</span></button>` : "";
  const head = { key: `chats-head-${C.all ? "all" : "few"}`, html: C.all
    ? `<div class="chl-top"><h2 class="chl-k">All chats</h2><label class="tg-qf chl-q">${ICON.search}<input type="search" data-chl-q placeholder="Search your chats" aria-label="Search your chats by title, model or folder" autocomplete="off" spellcheck="false"></label><button type="button" class="chl-more" data-chl-all="0">Show less</button></div>`
    : `<div class="chl-top"><h2 class="chl-k">Recent</h2>${more}</div>` };
  const empty = C.searching ? "Searching chat titles…" : `No chats match “${esc(C.q.trim())}”.`;
  if (!shown.length) return [head, { key: "chats-nomatch", html: `<p class="m-note">${empty}</p>` }];
  /** @type {Map<string, ChatRow[]>} */
  const groups = new Map();
  for (const s of shown) { const g = dayGroup(s.updated_at || s.created_at || ""); if (!groups.has(g)) groups.set(g, []); /** @type {ChatRow[]} */ (groups.get(g)).push(s); }
  const row = (/** @type {ChatRow} */ s) => {
    // Working: on a turn, or a sub-agent working on after it (storm's busy rule); waiting on you says so first
    const wait = waiting(s), busy = inTurn(s) || !!(world.act.sessionBusy && world.act.sessionBusy(s.id));
    const held = !wait && !busy ? heldOf(s) : null;
    const state = wait ? "needs_approval" : busy ? "working" : held ? "paused" : "";
    return `<li><button type="button" class="chl-row" data-go="c:${esc(s.id)}">` +
      `<span class="chl-tile">${rtMark(/** @type {string} */ (s.agent)) || ICON.thread}${state ? stateMark(state) : ""}</span>` +
      `<span class="chl-t">${esc(titleFor(s))}</span>` +
      `<span class="chl-a${wait ? " is-need" : busy ? " is-busy" : ""}">${wait ? "Needs you" : busy ? "Working" : held ? esc(heldShort(held)) : esc(rowTime(s.updated_at || s.created_at || ""))}</span></button></li>`;
  };
  if (!C.all) return [head, { key: "chats-list", html: `<div class="chl chl-few"><ul class="chl-list">${shown.map(row).join("")}</ul></div>` }];
  return [head, { key: "chats-list", html: `<div class="chl">${[...groups].map(([g, list], i) =>
    `<section class="chl-g" aria-labelledby="chl-g${i}"><h2 class="chl-h" id="chl-g${i}">${esc(g)}</h2><ul class="chl-list">${list.map(row).join("")}</ul></section>`).join("")}</div>` }];
}
