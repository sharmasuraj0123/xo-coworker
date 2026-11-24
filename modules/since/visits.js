// @ts-check

import { AWAY_MS, createSeen } from "./model.js";

/** @import {SinceApi, SinceWorld, VisitLifetime} from "./model-types" */

/** @param {SinceWorld} world @param {SinceApi} api @param {VisitLifetime} lifetime */
export function createVisits(world, api, { scope, changed, failed, storage }) {
  const seen = createSeen(storage);
  const { signal } = scope;
  /** @type {Map<string, number | null>} */
  const since = new Map();
  /** @type {Set<string>} */
  const dismissed = new Set();
  /** @type {Map<string, number | null> | null} */
  let remoteSeen = null;
  /** @type {() => string | null} */
  let currentView = () => null;
  let hiddenAt = 0;

  /** @param {string} view */
  function placeOf(view) {
    if (view === "home" || view.startsWith("p:")) return view;
    if (!view.startsWith("t:")) return null;
    const project = world.thread(view.slice(2))?.project;
    return typeof project === "string" && project && project !== "workspace" ? "p:" + project : null;
  }

  /** @param {string} place */
  const chatOf = (place) => place.startsWith("p:") ? world.project(place.slice(2))?.chatId || null : null;

  async function loadSeen() {
    const marks = new Map();
    try {
      const data = await api.chats(signal);
      for (const chat of data?.chats ?? []) {
        if (chat && "seen" in chat) marks.set(chat.id, chat.seen ? Date.parse(chat.seen.seen_at) || null : null);
      }
    } catch (error) {
      failed(error);
    }
    if (signal.aborted) return;
    remoteSeen = marks;
    changed();
  }

  /** @param {string} place */
  function mark(place) {
    if (signal.aborted) return;
    const now = Date.now();
    seen.mark(place, now);
    const chat = chatOf(place);
    if (chat && remoteSeen?.has(chat)) {
      remoteSeen.set(chat, now);
      void api.markSeen(chat, signal).catch(failed);
    }
  }

  /** @param {string} place */
  function arrive(place) {
    if (signal.aborted || dismissed.has(place)) return null;
    if (since.has(place)) return since.get(place) ?? null;
    const chat = chatOf(place);
    if (chat && remoteSeen == null) return null;
    const local = seen.get(place);
    const remote = chat ? remoteSeen?.get(chat) ?? null : null;
    const at = local == null && remote == null ? null : Math.max(local ?? 0, remote ?? 0);
    const lastVisit = at != null && Date.now() - at >= AWAY_MS ? at : null;
    since.set(place, lastVisit);
    if (at == null) mark(place);
    return lastVisit;
  }

  function markCurrent() {
    const view = currentView();
    const place = view && placeOf(view);
    if (place) mark(place);
  }

  scope.listen(document, "visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      markCurrent();
    } else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) {
      since.clear();
      dismissed.clear();
      changed();
    }
  });
  scope.listen(window, "pagehide", markCurrent);
  void loadSeen();

  return {
    placeOf,
    arrive,
    /** @param {string} from @param {string | null} [to] */
    leave(from, to) {
      const place = placeOf(from);
      if (place && place !== (to == null ? null : placeOf(to))) mark(place);
    },
    /** @param {string} place */
    dismiss(place) {
      dismissed.add(place);
      mark(place);
    },
    /** @param {() => string | null} view */
    setView(view) { currentView = view; },
  };
}
