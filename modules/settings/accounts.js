// @ts-check

// Settings › Accounts: the accounts XO works with for you, one control row each (state, then its one or two actions).

import { createScope } from "../../core/kernel/scope.js";
import { esc } from "../../core/platform/util.js";
import { xi } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";
import { busyAttrs } from "../../core/platform/pending.js";
import { createGithubAccount } from "./github-account.js";
import { wireAccounts } from "./account-controls.js";
import { canRestoreFocus } from "./control-focus.js";

/** @import { Action, View, GitHubStatus, GitHubFlow, GithubAccountState } from "./accounts-types" */

const NEEDS = ["repo", "workflow"];

/** @param {unknown} scopes */
export function missingScopes(scopes) {
  if (scopes == null || scopes === "") return [];
  const have = String(scopes).split(",").map((s) => s.trim());
  return NEEDS.filter((s) => !have.includes(s));
}

/** @param {GitHubStatus | null} st @param {GitHubFlow | null} flow @returns {View} */
export function ghView(st, flow = null) {
  if (flow && flow.code) return { key: "code", tone: "", line: "Enter this code on GitHub to sign in.", actions: [{ id: "open", label: "Copy code and open GitHub", pri: true }, { id: "cancel", label: "Cancel" }] };
  const starting = !!(flow && flow.starting);
  if (!st) return { key: "checking", tone: "", line: "Checking…", actions: [] };
  if (st.status === "connected") {
    const who = `Signed in as @${st.username || "?"}${st.name ? ` (${st.name})` : ""}`;
    const miss = missingScopes(st.scopes);
    if (miss.includes("repo")) return { key: "partial", tone: "warn", line: `${who}, without access to private repositories. Sign in again to grant it.`, actions: [again(starting, true), OUT] };
    if (miss.includes("workflow")) return { key: "partial", tone: "warn", line: `${who}, without permission to add workflows, so Launchpad can't deploy. Sign in again to grant it.`, actions: [again(starting, true), OUT] };
    return { key: "in", tone: "ok", line: `${who}. XO clones private repositories and deploys to Launchpad with it.`, actions: [again(starting, false), OUT] };
  }
  if (st.status === "failed") return { key: "unreachable", tone: "bad", line: `Can't reach GitHub. ${st.error || ""}`.trim(), actions: [{ id: "check", label: "Check again" }] };
  const gh = st.gh_login;
  const local = gh && gh.usable && gh.username ? ` This machine's gh is signed in as @${gh.username}: Sign in uses it.` : "";
  if (st.error) return { key: "expired", tone: "bad", line: `GitHub no longer accepts XO's sign-in.${local}`, actions: [signIn(starting)] };
  return { key: "out", tone: "", line: `Not signed in. Sign in so XO can clone private repositories and deploy to Launchpad.${local}`, actions: [signIn(starting)] };
}

/** @param {boolean} busy */
const signIn = (busy) => ({ id: "in", label: busy ? "Signing in…" : "Sign in", pri: true, busy });
/** @param {boolean} busy @param {boolean} pri */
const again = (busy, pri) => ({ id: "again", label: busy ? "Signing in…" : "Sign in again", pri, busy });
const OUT = { id: "out", label: "Sign out" };

/** @param {Readonly<GithubAccountState>} state */
function rowHtml(state) {
  const v = ghView(state.gh, state.flow);
  const btn = (/** @type {Action} */ a) => a.id === "open"
    ? `<a class="btn btn-pri" href="${esc(/** @type {GitHubFlow} */ (state.flow).uri)}" target="_blank" rel="noopener" data-acct="open">${esc(a.label)}</a>`
    : `<button type="button" class="btn${a.pri ? " btn-pri" : ""}" data-acct="${a.id}"${a.busy ? ' aria-busy="true" aria-disabled="true"' : busyAttrs(`acct:${a.id}`)}>${esc(a.label)}</button>`;
  const ask = state.confirm
    ? `<p class="acct-q">Sign out of GitHub? XO stops cloning private repositories and deploying until you sign in again.</p><div class="set-fa"><button type="button" class="btn" data-acct="keep">Stay signed in</button><button type="button" class="btn btn-danger" data-acct="out-yes"${busyAttrs("acct:out")}>Sign out</button></div>`
    : "";
  const code = v.key === "code" ? `<p class="acct-code"><b class="cp-code">${esc(/** @type {GitHubFlow} */ (state.flow).code)}</b><span class="set-note"><i class="spin" aria-hidden="true"></i> Waiting for GitHub…</span></p>` : "";
  return `<div class="set-row acct${ask || code ? " is-stack" : ""}" data-key="acct:github">` +
    `<div class="acct-top"><div class="set-l"><b><span class="acct-ic" aria-hidden="true">${xi("github")}</span>GitHub</b><span class="acct-s t-${v.tone || "none"}" role="status">${v.key === "checking" ? `<i class="spin" aria-hidden="true"></i> ` : ""}${esc(v.line)}</span></div>` +
    (ask ? "" : `<div class="set-fa">${v.actions.map(btn).join("")}</div>`) + `</div>` +
    code + ask + (state.err ? `<p class="set-err" role="alert">${esc(state.err)}</p>` : "") + `</div>`;
}
/** @param {{announce: (text: string) => void, scope?: ReturnType<typeof createScope>}} options */
export function createAccounts({ announce, scope = createScope() }) {
  const box = () => document.getElementById("settings")?.querySelector('[data-page="accounts"] .set-live') ?? null;
  const draw = () => {
    const el = box();
    if (!el || scope.signal.aborted) return;
    redraw(el, `<section class="set-sec" aria-labelledby="acct-gh-h"><h3 id="acct-gh-h">Connectors</h3>`
      + rowHtml(github.get()) + "</section>");
  };

  /** @param {string} sel @param {Element} [from] */
  function focus(sel, from) {
    const target = box()?.querySelector(sel);
    if (!(target instanceof HTMLElement)) return;
    if (from && (target.closest("[hidden], [inert]") || !canRestoreFocus(from))) return;
    target.focus({ preventScroll: true });
  }
  const github = createGithubAccount({ scope, announce, draw, focus });

  wireAccounts({ scope, box, github, focus, announce });

  return {
    /** The page was opened: read GitHub's state again (a sign-in under way keeps its code). */
    open() {
      if (!github.get().flow) void github.read();
      else draw();
    },
    dispose: scope.dispose,
  };
}
