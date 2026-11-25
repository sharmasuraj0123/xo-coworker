// @ts-check
import { $ } from "../../core/platform/dom.js";
import { heldShort } from "../../core/services/world/held.js";
import { createLaunchpad } from "./launchpad.js";
import { createLpApi } from "./client.js";
import { createLpWindow } from "./window.js";
import { createLpPage } from "./page.js";
import { createLaunchpadHerald } from "./herald.js";

/** @param {import("./surface-types").LaunchpadHost} host */
export function createLaunchpadSurface({ world, isBusy, isHeld, PROJ, projectIcon, projects, go, announce, schedule, notices }) {
  /** @param {string | null | undefined} v */
  const lpProject = (v) => v?.startsWith("p:") ? v.slice(2) : v?.startsWith("t:") ? world.thread(v.slice(2))?.project ?? null : null;
  /** @param {string} p @param {string | null} [id] */
  function lpThread(p, id) {
    const t = id ? world.thread(id) : world.state.threads.find((row) =>
      row.project === p && /^deploy to launchpad/i.test(row.title) && row.state !== "resolved");
    if (!t || t.project !== p) return null;
    return { thread: t.id, title: t.title, since: t.createdAt, busy: isBusy(t), held: isHeld(t) ? heldShort(t.held) : null,
      done: t.state === "done" || t.state === "resolved" };
  }
  const LP = createLaunchpad({
    api: createLpApi(), projectOf: lpProject, nameOf: (p) => PROJ(p), findThread: lpThread,
    go: (v) => { LW.close(); go(v); }, announce, onChange: schedule,
    ...createLaunchpadHerald(notices),
  });
  const LW = createLpWindow({ launch: LP, projectOf: lpProject, nameOf: PROJ,
    iconOf: (p) => p ? projectIcon(p) : "", allApps: () => go("launchpad"), onChange: schedule });
  const LPP = createLpPage({ el: $("#lpp"), launch: LP, projects: () => projects().map((p) => p.id), iconOf: projectIcon,
    open: (v, from) => LW.open(v, from),
    press: (name) => LW.press(name) });
  return { LP, LW, LPP, lpProject, dispose() { LPP.dispose(); LW.dispose(); } };
}
