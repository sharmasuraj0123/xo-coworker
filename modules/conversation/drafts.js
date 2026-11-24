// @ts-check

export const DRAFTS = "cv-drafts:live";

/** @typedef {{view: string, say: {value: string}, at: {_sel: number}}} DraftComposer */

/** @template {DraftComposer} Composer @param {{S: {drafts: Record<string, string>}, store: {set: (key: string, drafts: Record<string, string>) => void}, MK: Composer, updateComposer: (composer: Composer) => void}} options */
export function createDrafts({ S, store, MK, updateComposer }) {
  /** @param {Composer} [K] */
  function saveDraft(K = MK) { const v = K.view; if (K.say.value) S.drafts[v] = K.say.value; else delete S.drafts[v]; store.set(DRAFTS, S.drafts); }

  /** @param {Composer} [K] */
  function loadDraft(K = MK) { K.say.value = S.drafts[K.view] || ""; K.at._sel = 0; updateComposer(K); }

  return { saveDraft, loadDraft };
}
