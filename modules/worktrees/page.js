// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { chatActivityApi } from "../../core/platform/api.js";
import { ApiError } from "../../core/platform/http.js";
import { busyAttrs, esc, isPending } from "../../core/platform/index.js";
import { latest } from "../../core/platform/latest.js";
import { isWorktree, isWorktreeLoss } from "../../core/platform/record-responses.js";
import { reportFailure, requestFailureMessage } from "../../core/services/notices/failures.js";
import { holdButton } from "../../core/ui/components/hold.js";
import { ICON } from "../../core/ui/icons/names.js";

/** @import {Worktree, WorktreeLoss, WorktreesHost, WorktreesOptions, WorktreesResponse, WorktreesState} from "./types" */

const PAGE = "worktrees";
const LOSS_PATH_LIMIT = 30;

/** @param {Worktree} tree */
const treeKey = (tree) => `${tree.chat_id}/${tree.thread_ts}`;

/** @param {WorktreeLoss} loss */
function lossHtml(loss) {
  const changed = (loss.changed?.paths ?? []).map((path) => `changed · ${path}`);
  const untracked = (loss.untracked?.paths ?? []).map((path) => `new · ${path}`);
  const paths = [...changed, ...untracked].slice(0, LOSS_PATH_LIMIT);
  const hidden = Math.max(0, (loss.changed?.count ?? 0) + (loss.untracked?.count ?? 0) - paths.length);
  const more = hidden ? `\n… ${hidden} more` : "";
  const commits = loss.commits
    ? `<p>${loss.commits} commit${loss.commits === 1 ? "" : "s"} only on ${esc(loss.branch || "its branch")}</p>` : "";
  const files = paths.length ? `<pre class="tb-out">${esc(paths.join("\n"))}${more}</pre>` : "";
  return `<div class="wt-loss"><p><b>${esc(loss.summary || "Work that isn't kept anywhere else")}</b></p>${commits}${files}</div>`;
}

/** @param {string} key @param {WorktreeLoss | undefined} loss @param {string} error @param {string} waits */
function confirmationHtml(key, loss, error, waits) {
  const pending = `wt:${key}`;
  const keep = `<button type="button" class="btn" data-wt-no${waits}>Keep it</button>`;
  const confirm = loss
    ? `<button type="button" class="b b-hold wt-hold" data-wt-hold="${esc(key)}" aria-pressed="false"`
      + `${isPending(pending) ? ' style="--p:1"' : ""}${busyAttrs(pending)}><span class="hold-fill" aria-hidden="true"></span>`
      + `<span class="b-l"><span class="hold-ic">${ICON.lock}</span><span class="hold-txt">`
      + '<span class="ht-a">Hold to remove</span><span class="ht-b" aria-hidden="true">Keep holding…</span></span></span></button>'
    : `<button type="button" class="btn btn-danger" data-wt-yes="${esc(key)}"${busyAttrs(pending)}>Remove</button>`;
  const question = loss ? "Removing it deletes that work. It can't be undone." : "Remove this checkout? Nothing would be lost.";
  return '<div class="wt-confirm" role="alertdialog" aria-label="Remove this worktree">'
    + `${loss ? lossHtml(loss) : ""}<p class="wt-q">${question}</p>${error}<div class="set-fa">${keep}${confirm}</div></div>`;
}

/** @param {Worktree} tree @param {string} title @param {WorktreesState} view @param {WorktreesHost} host */
function treeRow(tree, title, view, host) {
  const key = treeKey(tree);
  const pending = `wt:${key}`;
  const choice = view.confirmation?.key === key ? view.confirmation : null;
  const busy = !!tree.session_state && tree.session_state !== "cold";
  const canRemove = tree.removable || (tree.would_lose && tree.xo !== false && !tree.error);
  const state = tree.error ? (tree.checked_at === null ? tree.error : `Can't be read: ${tree.error}`)
    : tree.exists === false ? "The checkout is already gone"
    : tree.xo === false ? "XO didn't make this checkout, so it won't remove it"
    : busy ? "Its agent is still using it"
    : tree.would_lose ? "Has work not kept anywhere else" : "Nothing would be lost";
  const threadState = tree.thread_state ? ` · thread ${esc(tree.thread_state.replace("_", " "))}` : "";
  const error = view.removalError?.key === key ? host.errHtml(view.removalError.text) : "";
  const remove = !choice && (canRemove || busy)
    ? `<button type="button" class="btn" data-wt="${esc(key)}"${busy ? " disabled" : busyAttrs(pending)}>Remove</button>` : "";
  return `<li class="wt-row" data-key="wt:${esc(key)}"><div class="wt-main"><b>${esc(title)}</b>`
    + `<code>${esc(tree.branch || tree.path)}</code><span class="wt-s${tree.would_lose ? " is-warn" : ""}">${esc(state)}`
    + `${threadState}</span>${choice ? "" : error}</div>${remove}`
    + `${choice ? confirmationHtml(key, choice.loss, error, host.waits(pending)) : ""}</li>`;
}

/** @param {WorktreesState} view @param {WorktreesHost} host @param {WorktreesOptions} options */
function treesHtml(view, host, { world, PROJ }) {
  if (view.listError && !view.trees) {
    return `<p class="set-empty"><b>Couldn't read the worktrees.</b> ${esc(view.listError)}</p>`;
  }
  if (!view.trees) return '<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>';
  /** @type {Map<string | null, Worktree[]>} */
  const projects = new Map();
  for (const tree of view.trees) {
    const project = world.act.projectOf ? world.act.projectOf(tree.chat_id) : tree.chat_id;
    const group = projects.get(project);
    if (group) group.push(tree);
    else projects.set(project, [tree]);
  }
  const sections = [...projects].map(([project, trees]) => {
    const rows = trees.map((tree) => {
      const thread = world.thread(tree.thread_ts);
      return treeRow(tree, thread ? thread.title ?? "" : "A thread", view, host);
    }).join("");
    return `<section class="set-sec" data-key="wtp:${esc(project)}"><h3>${esc(PROJ(project))}</h3>`
      + `<ul class="wt-list">${rows}</ul></section>`;
  }).join("");
  const reported = view.reported.map(({ path, reported_at }) => (
    `<li class="wt-row" data-key="rep:${esc(path)}"><div class="wt-main"><code>${esc(path)}</code>`
      + `<span class="wt-s">reported ${esc(host.when(reported_at))}</span></div></li>`
  )).join("");
  return '<p class="set-lead">Each thread works in its own checkout of the project. XO removes one by itself only when nothing '
    + 'would be lost; here you can remove one sooner.</p>'
    + (sections || '<p class="set-note">No worktrees right now.</p>')
    + (reported ? '<section class="set-sec" data-key="wt-reported"><h3>Made by an agent\'s own tool</h3>'
      + '<p class="set-lead">XO didn\'t create these, so it never removes them.</p>'
      + `<ul class="wt-list">${reported}</ul></section>` : "");
}

/** Every page of Space's stored listing. @param {AbortSignal} signal @returns {Promise<WorktreesResponse>} */
async function readAllTrees(signal) {
  /** @type {WorktreesResponse} */
  const all = { worktrees: [], reported: [] };
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {string | null} */
  let cursor = null;
  do {
    const reply = await chatActivityApi.worktrees(null, signal, cursor);
    all.worktrees.push(...reply.worktrees);
    all.reported?.push(...(reply.reported ?? []));
    if (cursor) seen.add(cursor);
    cursor = reply.next_cursor && !seen.has(reply.next_cursor) ? reply.next_cursor : null;
  } while (cursor);
  return all;
}

/** @param {Worktree[]} trees @param {WorktreesOptions["world"]} world */
const gitSignature = (trees, world) => JSON.stringify(trees.map((tree) => world.thread(tree.thread_ts)?.git ?? null));

/** @param {WorktreesHost} host @param {WorktreesOptions} options */
export function createWorktreesPage(host, options) {
  const scope = createScope();
  const requestKey = Symbol(PAGE);
  /** @type {WorktreesState} */
  const state = { trees: null, reported: [], listError: null, confirmation: null, removalError: null };
  /** @type {WeakSet<HTMLElement>} */
  const holds = new WeakSet();
  let signature = "";

  scope.effect(() => options.world.subscribe?.(() => {
    const page = host.box(PAGE)?.closest("[data-page]");
    if (!state.trees || !page || page.hasAttribute("hidden") || document.getElementById("settings")?.hidden) return;
    const next = gitSignature(state.trees, options.world);
    if (next === signature) return;
    signature = next;
    void loadTrees();
  }));

  async function loadTrees() {
    try {
      await latest(requestKey, readAllTrees, {
        signal: scope.signal,
        /** @param {WorktreesResponse} reply */
        commit(reply) {
          state.trees = reply.worktrees;
          state.reported = reply.reported ?? [];
          signature = gitSignature(state.trees, options.world);
          state.listError = null;
          render();
        },
      });
    } catch (error) {
      if (scope.signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
      state.listError = requestFailureMessage(error, "Couldn't read the worktrees.");
      render();
    }
  }

  function render() {
    if (scope.signal.aborted) return;
    host.paint(PAGE, treesHtml(state, host, options));
    const hold = host.box(PAGE)?.querySelector("[data-wt-hold]");
    if (!(hold instanceof HTMLElement) || holds.has(hold)) return;
    const key = hold.getAttribute("data-wt-hold");
    if (!key) return;
    holds.add(hold);
    holdButton(hold, {
      ready: () => isPending(`wt:${key}`) ? "Removing" : true,
      onConfirm: () => { void removeTree(key, state.confirmation?.token, hold); },
    });
  }

  /** @param {string} key @param {string | undefined} token @param {Element} from */
  async function removeTree(key, token, from) {
    const [chat, thread] = key.split("/");
    const pending = `wt:${key}`;
    const next = host.neighbour(from, ".wt-row", "data-wt");
    if (!isPending(pending)) state.removalError = null;
    await host.pend(pending, PAGE, render, async () => {
      try {
        const reply = await chatActivityApi.removeWorktree(chat, thread, token, scope.signal);
        if (scope.signal.aborted) return;
        state.confirmation = null;
        state.trees = (state.trees || []).filter((tree) => treeKey(tree) !== key);
        options.announce(reply?.forced ? "Removed. The work in it is gone." : "Removed. Nothing was lost.");
        void loadTrees();
        return { to: next && host.sel("data-wt", next) };
      } catch (error) {
        if (scope.signal.aborted) return;
        if (error instanceof ApiError && error.code === "would_lose_work") {
          const loss = "what" in error && isWorktreeLoss(error.what) ? error.what : undefined;
          const confirm = "confirm" in error && typeof error.confirm === "string" ? error.confirm : undefined;
          if (loss && confirm) {
            state.confirmation = { key, loss, token: confirm };
            void recheckTree(key);
            return { to: "[data-wt-no]" };
          }
        }
        const text = error instanceof ApiError && error.code === "session_busy"
          ? "Its agent is still using it. Stop the thread, or try again once it has gone quiet."
          : requestFailureMessage(error, "Couldn't remove the worktree.");
        state.removalError = { key, text };
        return {};
      }
    }, from);
  }

  /** A refused removal means the stored row was out of date: Space's check answers the exact one. @param {string} key */
  async function recheckTree(key) {
    const [chat, thread] = key.split("/");
    /** @type {Worktree | null} */
    let row = null;
    try {
      row = await chatActivityApi.checkWorktree(chat, thread, scope.signal);
    } catch (error) {
      if (error instanceof ApiError && error.code === "check_timeout" && "row" in error && isWorktree(error.row)) row = error.row;
      else reportFailure(error);
    }
    if (!row || scope.signal.aborted || !state.trees) return;
    const fresh = row;
    state.trees = fresh.removed_at !== undefined
      ? state.trees.filter((tree) => treeKey(tree) !== key)
      : state.trees.map((tree) => treeKey(tree) === key ? fresh : tree);
    render();
  }

  /** @param {string} key @param {Element} from */
  function askTree(key, from) {
    const tree = state.trees?.find((item) => treeKey(item) === key);
    state.removalError = null;
    if (tree && !tree.would_lose) {
      state.confirmation = { key };
      render();
      host.focusTo(PAGE, "[data-wt-no]");
    } else {
      void removeTree(key, undefined, from);
    }
  }

  return {
    open: loadTrees,
    dispose: scope.dispose,
    /** @param {Element} target */
    click(target) {
      if (scope.signal.aborted) return false;
      const remove = target.closest("button[data-wt]");
      const key = remove?.getAttribute("data-wt");
      if (remove && key && !remove.hasAttribute("disabled")) {
        askTree(key, remove);
        return true;
      }
      if (target.closest("[data-wt-no]")) {
        const previous = state.confirmation?.key;
        state.confirmation = null;
        state.removalError = null;
        render();
        host.focusTo(PAGE, previous ? host.sel("data-wt", previous) : null);
        return true;
      }
      const yes = target.closest("[data-wt-yes]");
      const confirmed = yes?.getAttribute("data-wt-yes");
      if (yes && confirmed) {
        void removeTree(confirmed, undefined, yes);
        return true;
      }
      return false;
    },
  };
}
