// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { createLru } from "../../core/platform/cache.js";
import { ApiError, missingRoute } from "../../core/platform/http.js";
import { latest } from "../../core/platform/latest.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @import {Detail, DetailApi} from "./types" */

const DETAIL_CACHE_SIZE = 64;
const FAILED = "Couldn't read this item from GitHub.";

/** @typedef {(project: string, key: string) => boolean} IsCurrent */

/** @param {DetailApi} api @param {IsCurrent} current @param {() => void} paint @param {(message: string) => void} announce */
export function createItemReads(api, current, paint, announce) {
  /** @type {ReturnType<typeof createLru<string, Detail>>} */
  const details = createLru({ max: DETAIL_CACHE_SIZE });
  const unsupported = new Set();
  const owner = {};
  let scope = createScope();
  let failed = "";
  /** @param {string} project @param {string} key */
  const id = (project, key) => JSON.stringify([project, key]);

  function hide() { scope.dispose(); failed = ""; }

  /** @param {string} project @param {string} key */
  async function show(project, key) {
    hide();
    scope = createScope();
    const signal = scope.signal, k = id(project, key), kind = key[0], number = Number(key.slice(1));
    paint();
    if (unsupported.has(kind) || details.has(k)) return;
    try {
      await latest(owner, (s) => kind === "p" ? api.githubPull(project, number, s) : api.githubIssue(project, number, s), {
        signal,
        commit(value) { details.set(k, value); },
      });
    } catch (error) {
      if (signal.aborted) return;
      if (missingRoute(error)) { unsupported.add(kind); return; }
      if (!(error instanceof ApiError && error.code === "not_found")) requestFailureMessage(error, FAILED);
      if (current(project, key)) { failed = k; paint(); announce(FAILED); }
      return;
    }
    if (current(project, key)) paint();
  }

  /** @param {string} project @param {string | null} key */
  const failure = (project, key) => key && failed === id(project, key) ? `<p class="fr-none">${FAILED}</p>` : "";
  return {
    show, hide, failure,
    clear() { hide(); details.clear(); unsupported.clear(); },
    get: (/** @type {string} */ project, /** @type {string} */ key) => details.get(id(project, key)) || null,
  };
}
