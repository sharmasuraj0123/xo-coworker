// @ts-check

import { createStore } from "../../core/kernel/store.js";
import { api } from "../../core/platform/api.js";
import { ApiError } from "../../core/platform/http.js";
import { isPending, latest, once } from "../../core/platform/pending.js";
import { cancelLatest } from "../../core/platform/latest.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @import {GithubAccountOptions, GithubAccountState, GitHubFlow, GitHubStatus} from "./accounts-types" */

const POLL_MS = 5000;
const EXPIRY_SECONDS = 900;
const START_CONTROL = '[data-acct="in"],[data-acct="again"]';
const EXPIRED = "That code expired.";

/** @param {GithubAccountOptions} options */
export function createGithubAccount({ scope, announce, draw, focus, bus }) {
  const initial = /** @type {GithubAccountState} */ ({ gh: null, flow: null, err: "", confirm: false });
  const store = createStore(initial, { bus, topic: "settings:github-account" });
  const { get, set } = store;
  const { signal } = scope;
  const statusKey = Symbol("settings:github-status");
  const pollKey = Symbol("settings:github-poll");
  const outKey = "acct:out";
  let stopPoll = () => {};
  scope.effect(() => store.subscribe(draw));

  async function read() {
    try {
      await latest(statusKey, (active) => api.githubStatus({ signal: active }), {
        signal,
        commit: (gh) => set({ gh }),
      });
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
      set({ gh: { status: "failed", error: requestFailureMessage(error, "Couldn't reach GitHub.") } });
    }
  }

  /** @param {GitHubFlow} flow */
  function schedulePoll(flow) {
    stopPoll = scope.timeout(() => { void poll(flow); }, POLL_MS);
  }

  /** @param {GitHubFlow} flow */
  async function poll(flow) {
    const id = flow.id;
    if (!id || get().flow !== flow || signal.aborted) return;
    /** @type {GitHubStatus} */
    let result;
    try {
      result = await latest(pollKey, (active) => api.githubConnectPoll(id, { signal: active }), { signal });
    } catch (error) {
      if (signal.aborted || get().flow !== flow) return;
      const expired = error instanceof ApiError && error.status === 404;
      result = { status: "failed", error: expired ? EXPIRED : requestFailureMessage(error, "GitHub didn't sign in.") };
    }
    if (signal.aborted || get().flow !== flow) return;
    if (result.status === "pending" && Date.now() < (flow.until ?? 0)) {
      schedulePoll(flow);
      return;
    }
    if (result.status === "connected") {
      set({ flow: null, gh: result });
      announce(`GitHub signed in as @${result.username}.`);
    } else {
      const err = result.status === "pending" ? `${EXPIRED} Sign in to get a new one.` : result.error || "GitHub didn't sign in.";
      set({ flow: null, err });
    }
    void read();
  }

  /** @param {boolean} fresh */
  async function signIn(fresh) {
    if (get().flow || signal.aborted) return;
    stopPoll();
    const starting = { starting: true };
    set({ err: "", flow: starting });
    let result;
    try {
      result = await api.githubConnect(fresh);
    } catch (error) {
      if (signal.aborted || get().flow !== starting) return;
      set({ flow: null, err: requestFailureMessage(error, "GitHub didn't start a sign-in.") });
      focus(START_CONTROL);
      return;
    }
    if (signal.aborted || get().flow !== starting) return;
    if (result.status === "connected") {
      set({ flow: null, gh: result });
      const source = result.imported ? ", with this machine's gh login" : "";
      announce(`GitHub signed in as @${result.username}${source}.`);
      focus('[data-acct="again"]');
      void read();
      return;
    }
    const flow = {
      code: result.user_code,
      uri: result.verification_uri,
      id: result.session_id,
      until: Date.now() + (result.expires_in || EXPIRY_SECONDS) * 1000,
    };
    set({ flow });
    focus('[data-acct="open"]');
    schedulePoll(flow);
  }

  function cancel() {
    const { flow } = get();
    stopPoll();
    cancelLatest(pollKey);
    set({ flow: null });
    if (flow?.id) {
      void api.githubConnectCancel(flow.id).catch((error) => {
        if (!(error instanceof ApiError && error.status === 404)) requestFailureMessage(error, "Couldn't cancel GitHub sign-in.");
      });
    }
    focus(START_CONTROL);
  }

  /** @param {Element} from */
  async function signOut(from) {
    if (isPending(outKey)) return;
    const p = once(outKey, async () => {
      try {
        await api.githubDisconnect();
        if (signal.aborted) return false;
        set({ confirm: false, err: "" });
        announce("Signed out of GitHub.");
        return true;
      } catch (error) {
        if (!signal.aborted) set({ err: requestFailureMessage(error, "Couldn't sign out of GitHub.") });
        return false;
      }
    });
    draw();
    if (await p) {
      await read();
      if (!signal.aborted) focus('[data-acct="in"]', from);
    } else {
      draw();
    }
  }

  return { get, set, read, signIn, cancel, signOut };
}
