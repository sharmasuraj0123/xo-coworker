// @ts-check

import { autoTint, classify, glyph, TINTS, TOPICS } from "./projicons.js";

/** @param {{ world: import("./icon-choice-types.js").ProjectIconWorld, SHAPE: import("./icon-choice-types.js").ProjectIconShape }} options */
export function createProjectIconChoice({ world, SHAPE }) {
  /** @type {WeakMap<{ name?: string }, { input: string, svg: string }>} */
  const projIcons = new WeakMap();
  /** A project's own entry: a topic, or {icon, tint}. @param {string} pid @returns {{ icon?: unknown, tint?: unknown }} */
  const own = (pid) => {
    const v = SHAPE.get("layout")?.icons?.[pid];
    return typeof v === "string" ? { icon: v } : v && typeof v === "object" ? v : {};
  };
  /** @param {string} pid */
  const ownIcon = (pid) => {
    const v = own(pid).icon;
    return typeof v === "string" && (v === "project" || TOPICS.includes(v)) ? v : null;
  };
  /** @param {string} pid */
  const ownTint = (pid) => {
    const v = own(pid).tint;
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= TINTS ? v : null;
  };
  /** The project's colour, 1…TINTS, or 0 for none. @param {string} pid */
  const projectTint = (pid) => ownTint(pid) ?? autoTint(world.project(pid)?.name || pid);
  /** @param {string} pid */
  function projectIcon(pid) {
    const mine = ownIcon(pid);
    if (mine) return glyph(mine);
    const project = world.project(pid), name = project?.name || pid;
    const titles = world.state.threads.filter((t) => t.project === pid).map((t) => t.title || "");
    const input = JSON.stringify([name, titles]), memo = project && projIcons.get(project);
    if (memo?.input === input) return memo.svg;
    const svg = glyph(classify(name, titles).icon);
    if (project) projIcons.set(project, { input, svg });
    return svg;
  }
  /** @param {string} id */
  function forgetIcon(id) { const p = world.project(id); if (p) projIcons.delete(p); }
  return { ownIcon, ownTint, projectTint, projectIcon, forgetIcon };
}
