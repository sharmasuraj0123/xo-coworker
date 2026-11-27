// @ts-check

import { ApiError } from "../../core/platform/http.js";
import { createScope } from "../../core/kernel/scope.js";
import { api } from "../../core/platform/api.js";
import { reportFailure } from "../../core/platform/util.js";
import { model, rows, hostOf } from "./model.js";

/** @import { DeployFrame } from "./lifetime-types.d.ts" */

const END = new Set(["done", "error", "needs", "replaced"]);
/** How long a dropped stream waits before picking up again: Space's `retry: 3000` (a test may shorten it). */
export const RETRY = { ms: 3000 };
/** @typedef {Parameters<typeof api.launchpadWatch>[1]} StreamOptions */

/** @typedef {(options: StreamOptions) => ReturnType<typeof api.launchpadWatch>} Start */

/** @param {string} p @param {Start} start @param {(e: DeployFrame) => void} on */
function stream(p, start, on) {
  const scope = createScope(), take = rows(on);
  const { signal } = scope;
  let run = "", seq = 0, ended = false, tries = 0;
  const seen = (/** @type {Parameters<StreamOptions["on"]>[0]} */ ev) => {
    if (ev.run_id && ev.run_id !== run) { run = ev.run_id; seq = 0; }
    if (ev.seq) {
      if (ev.seq <= seq) return;
      seq = ev.seq; tries = 0;
    }
    if (END.has(ev.type)) ended = true;
    if (ev.type === "error" && typeof ev.data?.log_tail === "string") {
      take({ ...ev, data: { ...ev.data, log_tail: ev.data.log_tail.split("\n") } });
    } else take(ev);
  };
  const fail = (/** @type {string} */ code, /** @type {string} */ message, action = "retry") => { ended = true; take({ type: "error", step: "check", code, message, action }); };
  const go = (/** @type {Start} */ open) => open({ signal, on: seen })
    .then((res) => {
      if (signal.aborted) return;
      if (res.ended) { ended = true; take({ type: "ended", run_id: run }); return; }
      if (res.failure) {
        fail(res.failure.code, res.failure.message, res.failure.action);
        return;
      }
      again();
    })
    .catch((error) => { if (!(error instanceof Error && error.name === "AbortError")) again(error); });
  const again = (/** @type {unknown} */ e = undefined) => {
    if (ended || signal.aborted) return;
    // out of tries (or never told which run): the deploy goes on in Space; the panel says it lost touch
    if (!run || tries >= 5) { ended = true; take({ type: "lost", message: e instanceof Error ? e.message : "" }); return; }
    tries++;
    scope.timeout(() => go((options) => api.launchpadWatch(p, { ...options, run, after: seq })), RETRY.ms);
  };
  go(start);
  return { stop: scope.dispose };
}

/** @type {Map<string, import("../../core/platform/launchpad-check-types.d.ts").Check>} */
const checks = new Map();
const real = {
  /** @param {string} p */
  check: async (p) => { const c = await api.launchpadCheck(p); checks.set(p, c); return model(c); },
  /** @param {string} p @param {string} [name] */
  preflight: async (p, name) => {
    const pre = await api.launchpadPreflight(p, name);
    const c = checks.get(p) || await real.check(p).then(() => checks.get(p));
    if (!c) throw new Error("Launchpad's check left no result");
    return model(c, pre);
  },
  /** @param {string} p @param {object} body @param {(e: DeployFrame) => void} on */
  deploy: (p, body, on) => stream(p, (options) => api.launchpadDeploy(p, body, options), on),
  /** @param {string} p @param {(e: DeployFrame) => void} on */
  watch: (p, on) => stream(p, (options) => api.launchpadWatch(p, options), on),
  /** @param {string} p */
  stop: async (p) => {
    try { return await api.launchpadStop(p); }
    catch (error) {
      if (error instanceof ApiError && error.code === "bad_answer") {
        throw new ApiError(error.status, error.code, "Space didn't confirm it");
      }
      throw error;
    }
  },
  /** @param {string} p @param {AbortSignal} [signal] */
  apps: async (p, signal) => (await api.launchpadApps(p, signal)).apps.map((a) =>
    ({ id: a.id, name: a.name, status: a.status || "", host: hostOf(a.url || ""), linkable: a.linkable })),
  /** @param {string} p @param {string} app */
  link: async (p, app) => {
    const { config, app: linked } = await api.launchpadLink(p, app);
    return { id: config.app_id, name: config.name, url: config.url || "", host: hostOf(config.url || ""), status: linked.status || "" };
  },
  /** @param {string} p */
  unlink: (p) => api.launchpadUnlink(p),
  /** @param {string} p @param {string} note */
  askAgent: (p, note) => api.launchpadAskAgent(p, note),
  /** @param {boolean} saved @param {AbortSignal} [signal] */
  async githubStart(saved, signal) {
    if (saved) await api.githubDisconnect({ signal });
    signal?.throwIfAborted();
    const r = await api.githubConnect(false, { signal, body: {} });
    if (r.status === "connected") return { connected: true, imported: !!r.imported, username: r.username || "" };
    return { id: r.session_id, code: r.user_code, url: r.verification_uri, until: Date.now() + (r.expires_in || 900) * 1000 };
  },
  /** @param {string} id @param {AbortSignal} [signal] */
  githubPoll: async (id, signal) => {
    const r = await api.githubConnectPoll(id, { signal });
    return { done: r.status === "connected", failed: "" };
  },
  /** @param {string} id */
  githubCancel: (id) => api.githubConnectCancel(id).catch(reportFailure),
};

/** The deploy API (a function, so a test can hand the section another). */
export function createLpApi() { return real; }
