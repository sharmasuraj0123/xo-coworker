// @ts-check

const DAY = 86400;

/** @param {Record<string, unknown>} over */
export const job = (over = {}) => ({
  id: "j1", name: "Morning check", kind: "agent", chat: "chat_a", prompt: "Look", utc_offset: "+00:00", agent: "claude", model: "opus",
  effort: "high", description: "Checks", enabled: true, running: false, every_seconds: DAY, first_run_at: "2026-11-20T09:00:00+00:00",
  next_run: "2026-11-26T09:00:00+00:00", last_result: null, created_by: { kind: "person" }, approved_by: null, state: "armed",
  state_reason: null, schedule: { every_seconds: DAY }, persona: null, icon: null, upcoming: [], ...over,
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
    /** @param {AbortSignal} [_signal] @param {number} [upcoming] */
    schedules: async (_signal, upcoming) => { note("schedules", [upcoming]); return { jobs }; },
    /** @param {string} id */
    scheduleRuns: async (id) => { note("scheduleRuns", [id]); return { job_id: id, runs: [], log_path: null }; },

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

export const MAY = {
  read: { label: "Read the project", tools: ["read", "search", "list"] },
  edit: { label: "Change files", tools: ["edit", "create", "delete"] },
  run: { label: "Run commands", tools: ["shell"] },
};

/** @param {Record<string, unknown>} over */
export const persona = (over = {}) => ({
  name: "release-checker", description: "Checks what's live.", level: "project", path: ".xo/agents/release-checker.md", version: "v1",
  runtime: null, model: null, effort: null, tools: ["read", "search", "list"], disallowedTools: [], mcpServers: null, shadows: null,
  shadowed: null, used_by: { jobs: [] }, problems: [], ...over,
});

/** The personas and files routes over lists keyed by project ("" for the Space's), writing down each call. @param {Record<string, Record<string, unknown>[]>} lists @param {Record<string, unknown>[]} [importable] */
export function fakePersonaApi(lists, importable = []) {
  /** @type {{ name: string, args: unknown[] }[]} */
  const calls = [];
  /** @param {string} name @param {unknown[]} args */
  const note = (name, args) => { calls.push({ name, args }); };
  /** @type {Map<string, string>} */
  const files = new Map();
  const api = {
    /** @param {string | null} project */
    personas: async (project) => { note("personas", [project]); return { personas: lists[project ?? ""] ?? [], may: MAY }; },
    /** @param {string | null} project */
    importable: async (project) => { note("importable", [project]); return { importable }; },
    /** @param {Record<string, unknown>} body */
    importPersona: async (body) => {
      note("importPersona", [body]);
      return { name: "reviewer", level: "space", relative_path: "reviewer.md", version: "v9", dropped: [] };
    },
    /** @param {Record<string, unknown>} body */
    tryOnce: async (body) => { note("tryOnce", [body]); return { chat_id: "chat_a", ts: "1764000000.000100" }; },
    /** @param {string} owner @param {string} path */
    projectFile: async (owner, path) => {
      note("projectFile", [owner, path]);
      return { content: files.get(`${owner}/${path}`) ?? "---\nname: release-checker\n---\n\nRead what's live.\n", version: "v1" };
    },
    /** @param {string} owner @param {string} path @param {string} text @param {string | null} base */
    saveProjectFile: async (owner, path, text, base) => { note("saveProjectFile", [owner, path, text, base]); files.set(`${owner}/${path}`, text); },
    /** @param {string} owner @param {string} path @param {string | null} base */
    deleteProjectFile: async (owner, path, base) => { note("deleteProjectFile", [owner, path, base]); },
    /** @param {string} owner @param {string} path */
    mkdirProject: async (owner, path) => {
      note("mkdirProject", [owner, path]);
      throw Object.assign(new Error("exists"), { code: "exists" });
    },
  };
  return { api: /** @type {never} */ (api), calls };
}
