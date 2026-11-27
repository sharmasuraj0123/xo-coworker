// @ts-check

import { createLru } from "../../core/platform/cache.js";
import { ApiError, missingRoute } from "../../core/platform/http.js";
import { isPending, latest, once } from "../../core/platform/pending.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @import {ListApi, PageData} from "./types" */

const LIST_CACHE_SIZE = 32;
let ownerSequence = 0;

/** @param {ListApi} api @param {AbortSignal} signal */
export function createListReads(api, signal) {
  /** @type {ReturnType<typeof createLru<string, PageData>>} */
  const cache = createLru({ max: LIST_CACHE_SIZE });
  const owner = `github:lists:${++ownerSequence}`;

  /** @param {string} project @param {{ refresh?: boolean, again?: boolean }} [options] */
  async function load(project, { refresh = false, again = false } = {}) {
    const previous = cache.get(project);
    if (!project || signal.aborted || (previous && !refresh && !again)) return previous;
    const key = JSON.stringify([owner, project]);
    const refreshKey = JSON.stringify([key, true]);
    const pendingKey = refresh || isPending(refreshKey) ? refreshKey : JSON.stringify([key, false]);
    const readLatest = () => latest(key, (active) => read(project, previous, refresh, active), {
      signal,
      commit: (data) => cache.set(project, data),
    });
    try {
      return await once(pendingKey, readLatest);
    } catch (error) {
      if (!signal.aborted && !(error instanceof Error && error.name === "AbortError")) throw error;
      return cache.get(project);
    }
  }

  /** @param {string} project @param {PageData | undefined} previous @param {boolean} refresh @param {AbortSignal} active */
  async function read(project, previous, refresh, active) {
    const options = { signal: active };
    /** @type {PageData["issues"]} */
    let issues;
    let pulls = previous?.pulls;
    let status = previous?.status ?? null;
    try {
      issues = await api.githubIssues(project, refresh, options);
    } catch (error) {
      active.throwIfAborted();
      const message = requestFailureMessage(error, "Space didn't answer.");
      issues = { ...previous?.issues, repo: previous?.issues.repo ?? null, state: "error", error: { message } };
    }
    if (issues.repo && (pulls !== null || refresh)) {
      try {
        pulls = await api.githubPulls(project, options);
      } catch (error) {
        active.throwIfAborted();
        if (error instanceof ApiError && error.status === 404 && missingRoute(error)) pulls = null;
        else requestFailureMessage(error, "Couldn't read pull requests.");
      }
    }
    try {
      status = await api.githubStatus(options);
    } catch (error) {
      active.throwIfAborted();
      requestFailureMessage(error, "Couldn't read GitHub's connection.");
    }
    return { issues, pulls, status };
  }

  return { load, get: cache.get };
}
