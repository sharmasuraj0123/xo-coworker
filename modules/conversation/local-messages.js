// @ts-check

import { echoes } from "../../core/services/world/conversation.js";

/** @import { LocalMessage } from "./delivery-types.d.ts" */

/** @import { LocalRecord, LocalRow } from "./local-messages-types.d.ts" */

export function createLocalMessages() {
  let sequence = 0;
  /** @type {Map<string, LocalRow[]>} */
  const byView = new Map();

  /** @type {Map<string, LocalRow>} */
  const byId = new Map();

  /** @type {Map<string, string>} */
  const aliases = new Map();

  /** @param {string} view @returns {readonly LocalRow[]} */
  function list(view) { return byView.get(view) ?? []; }

  /** @param {string} view @param {LocalRow} row */
  function append(view, row) {
    const rows = byView.get(view);
    if (rows) rows.push(row);
    else byView.set(view, [row]);
    byId.set(row.id, row);
  }

  /** @param {Pick<LocalMessage, "conv" | "text" | "target" | "to" | "files">} details */
  function send(details) {
    const at = Date.now();
    const stamp = at.toString(36);
    /** @type {LocalMessage} */
    const row = {
      ...details,
      id: `l${++sequence}_${stamp}`,
      who: "you",
      at,
      status: "sending",
      cid: `ui_${stamp}_${Math.random().toString(36).slice(2, 10)}`,
    };
    append(row.conv, row);
    return row;
  }

  /** @param {string} view @param {Omit<LocalRecord, "id" | "who">} details */
  function record(view, details) {
    /** @type {LocalRecord} */
    const row = { ...details, id: `rec${++sequence}`, who: "rec" };
    append(view, row);
    return row;
  }

  /** @param {string} view @param {string} text */
  function welcome(view, text) {
    for (const row of list(view)) byId.delete(row.id);
    byView.delete(view);
    append(view, { id: `l${++sequence}_hello`, conv: view, who: "event", at: Date.now(), tone: "ok", text });
  }

  /** @param {string} view @param {string} id */
  function removeSend(view, id) {
    const rows = byView.get(view);
    const index = rows?.findIndex((row) => row.id === id && row.who === "you") ?? -1;
    if (!rows || index < 0) return null;
    const [row] = rows.splice(index, 1);
    byId.delete(id);
    return row.who === "you" ? row : null;
  }

  /** @param {string} view @param {Parameters<typeof echoes>[1]} rows */
  function mergeEchoes(view, rows) {
    for (const [local, server] of echoes(list(view), rows, new Set(aliases.keys()))) {
      const row = byId.get(local);
      if (row?.who !== "you") continue;
      aliases.set(server, local);
      row.merged = true;
      row.status = "sent";
    }
  }

  return {
    list, send, record, welcome, removeSend, mergeEchoes,
    get: byId.get.bind(byId),
    alias: aliases.get.bind(aliases),
    aliases: aliases.entries.bind(aliases),
  };
}
