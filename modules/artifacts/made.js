// @ts-check
import { createPreviews } from "./previews.js";
import { createCards, KIND_IC } from "./cards.js";
import { createMadeStore } from "./store.js";
import { createArtifactsPage } from "./page.js";
import { createRecentMade } from "./recent.js";
import { api } from "../../core/platform/api.js";
import { esc } from "../../core/platform/index.js";
import { ICON } from "../../core/ui/icons/names.js";
import { sharedFileRoute } from "../../core/services/world/relay.js";
import { midName, midNameHtml } from "../../core/services/media/items.js";

/** @typedef {import("./types.d.ts").Made} Made */

/** @param {Pick<Made, "kind" | "name" | "title" | "path" | "threadTitle">} m */
export function madeNaming(m, max = 28) {
  const isFile = m.kind !== "link" && m.kind !== "branch";
  const file = isFile ? midName(m.name, max) : m.name;
  return {
    label: m.title || m.name,
    html: m.title ? esc(m.title) : isFile ? midNameHtml(m.name) : esc(m.name),
    file,
    tip: m.title ? `${m.title} · ${m.path}` : m.path,
    from: m.threadTitle || "Its thread",
  };
}

/** @param {import("./page-types.d.ts").MadeDeps} deps */
export function createMade({ world, go, VW, PROJ, schedule, announce, skTile, skBar, rememberedMade, scope }) {
  const MS = createMadeStore({ world, api, scope, schedule, announce });
  const { madeOf, madePending, togglePin } = MS;
  const PV = createPreviews({ world, api, sharedFileRoute, scope, box: () => AP.box(), landed: schedule });

  const { syncCards } = createCards({ PV, PROJ, naming: madeNaming });
  const homeMade = createRecentMade({ MS, PV, syncCards, skTile, rememberedMade });

  /** @param {string} key @param {Element | null} from */
  function openFile(key, from) {
    const m = madeOf(null).find((x) => x.key === key);
    if (!m) return;
    if (m.kind === "link" && m.url) { window.open(m.url, "_blank", "noopener,noreferrer"); return; }
    if (m.kind === "branch") return; // its thread is the place to see a branch
    const route = m.exists === false ? { why: "This file isn't there any more: its worktree was removed and no copy was kept." }
      : m.fileProject && m.rel ? { project: m.fileProject, rel: m.rel } : sharedFileRoute(world.thread(m.tid), m.path);
    VW.open({ path: m.path, name: m.name, type: m.type, bytes: m.bytes, ...route }, from);
  }

  const AP = createArtifactsPage({ MS, PV, syncCards, PROJ, sk: { tile: skTile, bar: skBar }, scope });

  /** @param {string} q */
  function jumpItems(q) {
    if (!q) return [];
    const w = q.toLowerCase();
    return madeOf(null).filter((m) => `${m.title || ""} ${m.name} ${m.path}`.toLowerCase().includes(w)).slice(0, 8)
      .map((m) => ({
        name: m.title || madeNaming(m, 48).file,
        sub: [m.title ? madeNaming(m, 32).file : "", m.project ? `Made in ${PROJ(m.project)}` : "", m.threadTitle]
          .filter(Boolean).join(" · "),
        icon: KIND_IC[m.kind] || ICON.doc,
        run() {
          if (m.kind !== "link" && m.tid) go("t:" + m.tid);
          openFile(m.key, null);
        },
      }));
  }

  scope.listen(document, "click", (e) => {
    const t = (/** @type {Element} */ (e.target));
    const pin = t.closest("[data-made-pin]");
    if (pin) { togglePin((/** @type {string} */ ((/** @type {HTMLElement} */ (pin)).dataset.madePin))); return; }
    const f = t.closest("[data-made-file]");
    if (f) {
      const key = (/** @type {string} */ ((/** @type {HTMLElement} */ (f)).dataset.madeFile));
      const m = madeOf(null).find((x) => x.key === key);
      if (m && m.kind === "branch") { if (m.tid) go("t:" + m.tid); return; }
      openFile(key, f);
      return;
    }
    const g = t.closest("[data-made-go]");
    if (g) { go((/** @type {string} */ ((/** @type {HTMLElement} */ (g)).dataset.madeGo))); return; }
  });
  return {
    homeMade, jumpItems,
    /** @param {string} tid @param {string | null} project */
    latestOf: (tid, project) => madeOf(project || null).find((x) => x.tid === tid && x.kind !== "branch" && x.kind !== "link" && x.exists !== false) || null,
    count: () => (madePending(null) ? 0 : madeOf(null).length),
    artifacts: { mount: AP.mount, render: AP.render },
  };
}
