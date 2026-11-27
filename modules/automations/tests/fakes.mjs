// @ts-check

const DAY = 86400;

/** @param {Record<string, unknown>} over */
export const job = (over = {}) => ({
  id: "j1", name: "Morning check", kind: "agent", chat: "chat_a", prompt: "Look", utc_offset: "+00:00", agent: "claude", model: "opus",
  effort: "high", description: "Checks", enabled: true, running: false, every_seconds: DAY, first_run_at: "2026-11-20T09:00:00+00:00",
  next_run: "2026-11-26T09:00:00+00:00", last_run: null, running_since: null, last_result: null, created_by: { kind: "person" }, ...over,
});

/** A schedule API that answers from a list and writes down each call. @param {Record<string, unknown>[]} jobs */
export function fakeApi(jobs) {
  /** @type {{ name: string, args: unknown[] }[]} */
  const calls = [];
  let failDelete = false;
  /** @param {string} name @param {unknown[]} args */
  const note = (name, args) => { calls.push({ name, args }); };
  /** @param {string} id */
  const one = (id) => jobs.find((j) => j.id === id) ?? job({ id });
  const api = {
    schedules: async () => { note("schedules", []); return { jobs }; },
    /** @param {string} id */
    scheduleRuns: async (id) => { note("scheduleRuns", [id]); return { job_id: id, runs: [], log_path: "" }; },

    /** @param {Record<string, unknown>} body */
    createSchedule: async (body) => { note("createSchedule", [body]); return job({ ...body, id: "new" }); },

    /** @param {string} id @param {Record<string, unknown>} body */
    updateSchedule: async (id, body) => { note("updateSchedule", [id, body]); return job({ ...body, id }); },

    /** @param {string} id */
    deleteSchedule: async (id) => {
      note("deleteSchedule", [id]);
      if (failDelete) throw new Error("gone wrong");
      return { ok: true, deleted: id };
    },
    /** @param {string} id */
    runSchedule: async (id) => { note("runSchedule", [id]); return { ok: true, started: true, job: { ...one(id), running: true } }; },
  };
  return { api: /** @type {never} */ (api), calls, failDeletes() { failDelete = true; } };
}

/** Timers the test fires by hand. */
export function fakeTimers() {
  /** @type {Set<{ fn: () => void, ms: number }>} */
  const pending = new Set();
  return {
    /** @param {() => void} fn @param {number} ms */
    timeout(fn, ms) {
      const t = { fn, ms };
      pending.add(t);
      return () => { pending.delete(t); };
    },
    fire() { for (const t of [...pending]) { pending.delete(t); t.fn(); } },
    get size() { return pending.size; },
  };
}
