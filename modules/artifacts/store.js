// @ts-check

import { read, write } from "../../core/platform/storage.js";
import { createMadeReads } from "./made-reads.js";
import { madeFromServer, madeItems } from "./model.js";
import { createMadePins } from "./pins.js";

/** @import {Made, MadeThread} from "./types" */
/** @import {MadeStoreOptions} from "./read-types.d.ts" */

const PINS = "xo-made-pins";

/** @param {string} raw */
function parsePins(raw) {
  const value = /** @type {unknown} */ (JSON.parse(raw));
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

/** @param {MadeStoreOptions} options */
export function createMadeStore({ world, api, scope, schedule, announce }) {
  const pins = new Set(read(PINS, parsePins, []));
  const reads = createMadeReads(api.made, scope.signal, schedule, schedule);
  const toggleRemotePin = createMadePins(api.pinMade, reads.setPin, scope.signal, (message) => {
    announce(message);
    schedule();
  });
  const projectsMade = () => (world.state.projects || []).filter((project) => project && project.id !== "workspace");
  let settled = false;
  let pinsVersion = 0;

  /** @param {string | null} pid */
  function madePending(pid) {
    const projects = pid ? [world.project(pid)] : projectsMade();
    let pending = false;
    for (const project of projects) {
      if (project?.chatId && reads.pending(reads.newest(project.chatId))) pending = true;
    }
    if (!pid && !pending && projects.length) settled = true;
    return pending && !(settled && !pid);
  }

  /** @param {boolean} [retry] */
  function olderPages(retry = false) {
    let started = false;
    for (const project of projectsMade()) {
      if (project.chatId && reads.older(project.chatId, retry)) started = true;
    }
    return started;
  }

  /** @type {MadeThread[] | null} */
  let titlesOf = null;
  /** @type {Map<string, string>} */
  let titles = new Map();
  /** @type {Map<string, {key: string, source?: symbol, titles: Map<string, string>, threads: MadeThread[], items: Made[]}>} */
  const memo = new Map();
  /** @type {{parts: Made[][], items: Made[]}} */
  let allMemo = { parts: [], items: [] };

  /** @param {string} pid */
  function madeIn(pid) {
    const chat = world.project(pid)?.chatId;
    const entry = chat ? reads.newest(chat) : null;
    const rows = entry && !entry.off ? entry.rows : null;
    const threads = world.state.threads;
    if (titlesOf !== threads) {
      titlesOf = threads;
      titles = new Map(threads.map((thread) => [thread.id, thread.title || ""]));
    }
    const key = rows ? `s|${entry?.version}|${rows.length}` : `f|${pinsVersion}`;
    const previous = memo.get(pid);
    const source = entry?.key;
    if (previous?.key === key && previous.source === source && previous.titles === titles) {
      if (rows || previous.threads === threads) return previous.items;
    }
    const items = rows
      ? madeFromServer(rows, { project: pid, threadTitle: (id) => titles.get(id) || "" }).map((item) => ({ ...item, chat }))
      : madeItems(threads.filter((thread) => thread.project === pid), { pins });
    memo.set(pid, { key, source, titles, threads, items });
    return items;
  }

  /** @param {string | null} pid */
  function madeOf(pid) {
    if (pid) return madeIn(pid);
    const parts = projectsMade().map((project) => madeIn(project.id));
    if (parts.length === allMemo.parts.length && parts.every((items, index) => items === allMemo.parts[index])) return allMemo.items;
    allMemo = { parts, items: parts.flat().sort((a, b) => b.at - a.at) };
    return allMemo.items;
  }

  /** @param {string} key */
  function togglePin(key) {
    if (scope.signal.aborted) return;
    const item = madeOf(null).find((entry) => entry.key === key);
    const on = item ? !item.pinned : !pins.has(key);
    if (item?.server && item.chat && item.id) {
      toggleRemotePin(item.chat, item.id, !!item.pinned);
    } else {
      if (on) pins.add(key); else pins.delete(key);
      pinsVersion++;
      write(PINS, JSON.stringify([...pins]));
    }
    announce(on ? "Pinned" : "Unpinned");
    schedule();
  }

  /** @param {"reading" | "retry"} state */
  const hasOlder = (state) => projectsMade().some((project) => project.chatId && reads.olderStatus(project.chatId) === state);

  return {
    madeOf, madePending, olderPages, projectsMade, togglePin,
    olderLeft: () => hasOlder("reading"),
    olderFailed: () => hasOlder("retry"),
  };
}
