// @ts-check

import { classify, glyph, TOPICS } from "./projicons.js";

/** @param {{ world: import("./icon-choice-types.js").ProjectIconWorld, SHAPE: import("./icon-choice-types.js").ProjectIconShape }} options */
export function createProjectIconChoice({ world, SHAPE }) {
  /** @type {WeakMap<{ name?: string }, { input: string, svg: string }>} */
  const projIcons = new WeakMap();
  /** @param {string} pid */
  const ownIcon = (pid) => {
    const v = SHAPE.get("layout")?.icons?.[pid];
    return typeof v === "string" && (v === "project" || TOPICS.includes(v)) ? v : null;
  };
  /** @param {string} pid */
  function projectIcon(pid) {
    const own = ownIcon(pid);
    if (own) return glyph(own);
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
  return { ownIcon, projectIcon, forgetIcon };
}
