// @ts-check

import { ApiError } from "../../core/platform/http.js";
import { AGENTS_DIR, keyOf, ownerOf, pathOf, scopeOf } from "./agent-file.js";
import { REFRESH_MS } from "./pending.js";

/** @import { Importable, Persona } from "../../core/platform/persona-response-types" */

/** @import { Agent, AgentList, AgentWrite, PersonasDeps } from "./types" */

/** Where the Space's own agents are listed: without a project. */
const SPACE = "";

/** @param {Persona} p @param {string} project @returns {Agent} */
const agentOf = (p, project) => ({ ...p, project: p.level === "space" ? "" : project, owner: ownerOf(p.level, project) });

/** The agents each project sees, read when asked and kept a minute; the files routes write them. @param {PersonasDeps} deps */
export function createPersonasStore({ api, report, now = Date.now }) {
  /** @type {Map<string, AgentList & { at: number }>} */
  const lists = new Map();
  /** @type {Map<string, Promise<void>>} */
  const reading = new Map();
  /** @type {Set<() => void>} */
  const watchers = new Set();
  const changed = () => { for (const watch of watchers) watch(); };

  /** @param {string} asked */
  function read(asked) {
    const project = scopeOf(asked);
    const going = reading.get(project);
    if (going) return going;
    const work = api.personas(project || null).then((got) => {
      lists.set(project, { agents: got.personas.map((p) => agentOf(p, project)), may: got.may, failed: false, at: now() });
    }, (error) => {
      const had = lists.get(project);
      lists.set(project, { agents: had?.agents ?? [], may: had?.may ?? {}, failed: true, at: now() });
      if (!(error instanceof ApiError) || error.code === "bad_answer") report(error);
    }).finally(() => { reading.delete(project); changed(); });
    reading.set(project, work);
    return work;
  }

  /** What a project sees now, read again once a minute old; null until first read. @param {string} asked */
  function seen(asked) {
    const project = scopeOf(asked);
    const had = lists.get(project);
    if (!had || now() - had.at > REFRESH_MS) void read(project);
    return had ?? null;
  }

  /** Read again after a write, the Space's list too when a Space agent changed. @param {Agent | { level: string, project: string }} a */
  async function after(a) {
    for (const [key, list] of lists) if (a.level === "space" || key === a.project) list.at = -Infinity;
    await read(a.level === "space" ? SPACE : a.project);
  }

  return {
    seen,
    /** An agent by its key, from any list read so far. @param {string} key */
    find(key) {
      for (const list of lists.values()) {
        const found = list.agents.find((a) => keyOf(a) === key);
        if (found) return found;
      }
      return null;
    },
    /** The Space's agents, then each project's own, for the Agents tab. @param {string[]} projects */
    everywhere(projects) {
      const space = seen(SPACE);
      const own = projects.map((id) => ({ id, list: seen(id) }));
      return { space, own };
    },
    /** @param {() => void} fn */
    watch(fn) { watchers.add(fn); return () => { watchers.delete(fn); }; },
    refresh: read,
    /** The file as saved, and its version, to edit. @param {Agent} a @param {AbortSignal} [signal] */
    async file(a, signal) {
      const got = await api.projectFile(a.owner, a.path, undefined, { signal });
      return { text: got.content, version: got.version ?? null };
    },
    /** Writes a file; a project's first agent makes its folder. @param {AgentWrite} w */
    async save({ level, project, name, text, base, was = null }) {
      const owner = ownerOf(level, project), path = pathOf(level, name);
      if (level === "project" && !was) {
        await api.mkdirProject(owner, AGENTS_DIR).catch((error) => { if (error?.code !== "exists") throw error; });
      }
      const moved = was && was.path !== path;
      await api.saveProjectFile(owner, path, text, moved ? null : base);
      if (moved && was) await api.deleteProjectFile(was.owner, was.path, null);
      await after({ level, project });
      return name;
    },
    /** @param {Agent} a */
    async remove(a) {
      await api.deleteProjectFile(a.owner, a.path, a.version || null);
      await after(a);
    },
    /** What each runtime already has, ready to copy in. @param {string} project @param {AbortSignal} [signal] */
    async importable(project, signal) { return (await api.importable(project || null, signal)).importable; },
    /** @param {Importable} item @param {string} project @param {boolean} withoutDropped */
    async importOne(item, project, withoutDropped) {
      const done = await api.importPersona({ adapter: item.adapter, id: item.id, ...(project ? { project } : {}),
        ...(withoutDropped ? { without_dropped: true } : {}) });
      await after({ level: done.level, project });
      return done;
    },
    /** One read-only run; its thread. @param {Parameters<PersonasDeps["api"]["tryOnce"]>[0]} body */
    tryOnce: (body) => api.tryOnce(body),
  };
}

/** @typedef {ReturnType<typeof createPersonasStore>} PersonasStore */
