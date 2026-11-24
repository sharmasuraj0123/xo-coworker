// @ts-check

import { read, write } from "../../core/platform/storage.js";

const DRAFTS = "cv-drafts:live";

/** @typedef {{view: string, say: {value: string}}} DraftComposer */

/** @param {string} raw @returns {[string, string][]} */
function parseDrafts(raw) {
  const saved = JSON.parse(raw);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return [];
  return Object.entries(saved).filter((entry) => typeof entry[1] === "string");
}

/** @template {DraftComposer} C @param {C} main @param {(composer: C) => void} onRestore */
export function createDrafts(main, onRestore) {
  const drafts = new Map(read(DRAFTS, parseDrafts, []));

  /** @param {C} [composer] */
  function saveDraft(composer = main) {
    const { view, say } = composer;
    if (say.value) drafts.set(view, say.value);
    else drafts.delete(view);
    write(DRAFTS, JSON.stringify(Object.fromEntries(drafts)));
  }

  /** @param {C} [composer] */
  function loadDraft(composer = main) {
    composer.say.value = drafts.get(composer.view) || "";
    onRestore(composer);
  }

  return { saveDraft, loadDraft };
}
