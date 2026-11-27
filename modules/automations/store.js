// @ts-check

import { automationsOf, runRowsOf } from "./model.js";
import { REFRESH_MS } from "./pending.js";

/** @import { AgentJobBody, ScheduledJob, ScheduleRule } from "../../core/platform/schedule-response-types" */

/** @import { Automation, AutomationsState, StoreDeps } from "./types" */

export const UNDO_MS = 10_000;

/** A fortnight of a calendar job's run times, for the week and the agenda. */
const UPCOMING = 14;

/** The definition a job was saved with, ready to send back changed. @param {Automation["job"]} job @returns {AgentJobBody} */
const definitionOf = (job) => ({
  kind: "agent", name: job.name, description: job.description, chat: job.chat, prompt: job.prompt, agent: job.agent,
  model: job.model, effort: job.effort, every_seconds: job.every_seconds, first_run_at: job.first_run_at ?? null, enabled: job.enabled,
  ...calendarOf(job.schedule), persona: job.persona ?? null, icon: job.icon ?? null,
});

/** A calendar rule says when it runs by itself, without an interval or a start. @param {ScheduleRule | null | undefined} rule */
const calendarOf = (rule) => rule && !("every_seconds" in rule) ? { schedule: rule, every_seconds: null, first_run_at: null } : {};

/** @param {StoreDeps} deps */
export function createAutomationsStore({ api, report, timeout, now = Date.now }) {
  /** @type {AutomationsState} */
  let state = { list: [], loaded: false, failed: false, deleting: new Map(), turning: new Map() };
  /** @type {Map<string, () => void>} */
  const timers = new Map();
  /** @type {Set<(state: AutomationsState) => void>} */
  const watchers = new Set();
  /** @type {AbortController | null} */
  let reading = null;
  let readAt = -Infinity;

  /** @param {Partial<AutomationsState>} next */
  const set = (next) => {
    state = { ...state, ...next };
    for (const watch of watchers) watch(state);
  };

  /** @param {ScheduledJob[]} jobs */
  const land = (jobs) => set({ list: automationsOf(jobs), loaded: true, failed: false });

  /** @param {ScheduledJob} job */
  const landOne = (job) => {
    const [next] = automationsOf([job]);
    if (!next) return;
    const has = state.list.some((a) => a.id === next.id);
    set({ list: has ? state.list.map((a) => a.id === next.id ? next : a) : [...state.list, next] });
  };

  /** @param {string} id */
  async function finish(id) {
    timers.delete(id);
    const deleting = new Map(state.deleting);
    deleting.delete(id);
    try {
      await api.deleteSchedule(id);
      set({ list: state.list.filter((a) => a.id !== id), deleting });
    } catch (error) {
      set({ deleting });
      report(error);
    }
  }

  async function refresh() {
    reading?.abort();
    const mine = reading = new AbortController();
    try {
      land((await api.schedules(mine.signal, UPCOMING)).jobs);
    } catch (error) {
      if (mine.signal.aborted) return;
      set({ loaded: true, failed: true });
      report(error);
    } finally {
      if (reading === mine) reading = null;
    }
  }

  return {
    get state() { return state; },
    /** @param {string} id */
    find: (id) => state.list.find((a) => a.id === id) ?? null,
    /** @param {(state: AutomationsState) => void} watch */
    watch(watch) {
      watchers.add(watch);
      return () => { watchers.delete(watch); };
    },
    refresh,
    /** Read again once what was read is a minute old: the page and the panel both ask as they draw. */
    fresh() {
      if (now() - readAt <= REFRESH_MS) return;
      readAt = now();
      void refresh();
    },
    /** @param {Automation} a @param {boolean} on */
    async setOn(a, on) {
      set({ turning: new Map(state.turning).set(a.id, on) });
      try { landOne(await api.updateSchedule(a.id, { ...definitionOf(a.job), enabled: on })); } finally {
        const turning = new Map(state.turning);
        turning.delete(a.id);
        set({ turning });
      }
    },
    /** @param {Automation} a */
    async runNow(a) {
      landOne((await api.runSchedule(a.id)).job);
    },
    /** Deleted for real only once the undo has run out. @param {string} id */
    removeLater(id) {
      if (timers.has(id)) return;
      timers.set(id, timeout(() => void finish(id), UNDO_MS));
      set({ deleting: new Map(state.deleting).set(id, now() + UNDO_MS) });
    },
    /** @param {string} id */
    undoRemove(id) {
      timers.get(id)?.();
      timers.delete(id);
      const deleting = new Map(state.deleting);
      deleting.delete(id);
      set({ deleting });
    },
    /** @param {string | null} id @param {AgentJobBody} body */
    async save(id, body) {
      const job = id ? await api.updateSchedule(id, body) : await api.createSchedule(body);
      landOne(job);
      return job.id;
    },
    /** @param {string} id @param {AbortSignal} [signal] */
    async runs(id, signal) {
      return runRowsOf((await api.scheduleRuns(id, { limit: 50 }, signal)).runs);
    },
    /** Deletes still waiting for their undo go now. */
    dispose() {
      reading?.abort();
      watchers.clear();
      for (const [id, cancel] of timers) { cancel(); void finish(id); }
    },
  };
}

/** @typedef {ReturnType<typeof createAutomationsStore>} AutomationsStore */
