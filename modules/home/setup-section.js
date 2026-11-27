// @ts-check

import { setupHtml, setupItems } from "./setup.js";

/** @import { Lifetime } from "../../core/kernel/types" */

/** @import { Runtime } from "../../core/services/runtime-types" */

/** @import { GitHubRead } from "./setup.js" */

const AGAIN_MS = 3000;

/** @typedef {{ state: { runtimes?: Runtime[] | null }, subscribe?: (fn: () => void) => () => void }} SetupWorld */

/** @typedef {(o: { signal: AbortSignal }) => Promise<{ status: string }>} ReadGitHub */

/** @typedef {{ world: SetupWorld, githubStatus: ReadGitHub, scope: Lifetime, schedule: () => void }} SetupDeps */

/** Home's set-up suggestions; GitHub's status is read again when the page or a layer comes back. @param {SetupDeps} deps */
export function setupSection({ world, githubStatus, scope, schedule }) {
  /** @type {GitHubRead} */
  let gh;
  let at = 0, reading = false, seen = world.state.runtimes;

  async function read() {
    if (reading || scope.signal.aborted) return;
    reading = true; at = Date.now();
    try { gh = await githubStatus({ signal: scope.signal }); }
    catch { gh = gh ?? null; }
    finally { reading = false; }
    if (!scope.signal.aborted) schedule();
  }
  const again = () => { if (gh?.status !== "connected" && Date.now() - at > AGAIN_MS) void read(); };

  void read();
  scope.effect(() => world.subscribe?.(() => { if (world.state.runtimes !== seen) { seen = world.state.runtimes; schedule(); } }));
  scope.listen(document, "visibilitychange", () => { if (!document.hidden) again(); });

  return {
    again,
    section: {
      id: "hm-start",
      order: 5,
      mount() {},
      /** @param {HTMLElement} el @param {{ patch: (el: HTMLElement, html: string) => boolean }} context */
      render(el, context) { context.patch(el, setupHtml(setupItems(world.state.runtimes, gh))); },
    },
  };
}
