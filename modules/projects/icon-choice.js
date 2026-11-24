// @ts-check

import { classify, glyph, TOPICS } from "./projicons.js";

/** @param {{ world: import("./icon-choice-types.js").ProjectIconWorld, SHAPE: import("./icon-choice-types.js").ProjectIconShape }} options */
export function createProjectIconChoice({ world, SHAPE }) {
  /** @type {Map<string, { n: number, own: string | null, svg: string }>} */
  const projIcons = new Map();

  /** @param {string} pid */
  const ownIcon = (pid) => {
    const v = SHAPE.get("layout")?.icons?.[pid];
    return typeof v === "string" && (v === "project" || TOPICS.includes(v)) ? v : null;
  };

  /** @param {string} pid */
  function projectIcon(pid) {
    const ts = world.state.threads.filter((t) => t.project === pid);
    const own = ownIcon(pid);
    const memo = projIcons.get(pid);
    if (memo && memo.n === ts.length && memo.own === own) return memo.svg;
    const icon = own || classify((world.project(pid) || {}).name || pid, ts.map((t) => t.title || "")).icon;
    const svg = glyph(icon);
    projIcons.set(pid, { n: ts.length, own, svg });
    return svg;
  }

  return { ownIcon, projectIcon, forgetIcon: (/** @type {string} */ pid) => projIcons.delete(pid) };
}
