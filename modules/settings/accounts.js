// @ts-check

// Settings › Accounts: the accounts XO works with for you, one control row each (state, then its one or two actions).

import { createScope } from "../../core/kernel/scope.js";
import { api } from "../../core/platform/api.js";
import { missingRoute } from "../../core/platform/http.js";
import { esc } from "../../core/platform/util.js";
import { xi } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";
import { busyAttrs, latest } from "../../core/platform/pending.js";
import { rtName, markOf } from "../../core/services/runtimes.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { createGithubAccount } from "./github-account.js";
import { wireAccounts } from "./account-controls.js";
import { canRestoreFocus } from "./control-focus.js";

/** @import { Action, View, GitHubStatus, GitHubFlow, Agent, AgentFlow, SignInEvent, AccountsState, GithubAccountState, SignIn } from "./accounts-types" */

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

/** @type {Record<string, SignIn>} */
export const SIGN_IN = {
  claude_code: { route: "claude-code", kind: "paste", cancel: true },
  codex: { route: "codex", kind: "device" },
  antigravity: { route: "antigravity", kind: "paste" },
};
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;

/** @param {string[]} lines */
export function deviceCode(lines) {
  const text = lines.join("\n").replace(ANSI, "");
  const url = (text.match(/https:\/\/[^\s"'<>]+/) || [])[0];
  const code = (text.match(/\b[A-Z0-9]{4,}-[A-Z0-9]{4,}\b/) || [])[0];
  return url && code ? { url: url.replace(/[.,;)]+$/, ""), code } : null;
}

/** @param {Agent | null} rt @param {Partial<AgentFlow> | null} flow @returns {View} */
export function rtView(rt, flow = null, { missing = false } = {}) {
  const name = rtName(rt && rt.name);
  const can = !!(rt && SIGN_IN[rt.name] && SIGN_IN[rt.name].cancel);
  const stop = { id: "cancel", label: "Cancel" };
  if (flow) {
    if (flow.phase === "installing") return { key: "installing", tone: "", line: `Installing ${name} first…`, actions: [stop] };
    if (flow.phase === "code") return { key: "code", tone: "", line: `Enter this code on the sign-in page.`, actions: [{ id: "open", label: "Copy code and open sign-in page", pri: true }, stop] };
    if (flow.phase === "paste" || flow.phase === "sending") return { key: flow.phase, tone: "", line: "Open the sign-in page, approve, then paste the code it shows you below.", actions: [{ id: "open", label: "Open sign-in page", pri: !flow.opened }, stop] };
    return { key: "starting", tone: "", line: "Starting the sign-in…", actions: [{ id: "in", label: "Signing in…", pri: true, busy: true }, ...(can || flow.abortable ? [stop] : [])] };
  }
  if (!rt) return { key: "checking", tone: "", line: "Checking…", actions: [] };
  const h = rt.health || {};
  if (h.installed === false) return { key: "absent", tone: "", line: "Not installed on this Space.", actions: [] };
  const on = h.logged_in === true;
  if (missing) return { key: "unavailable", tone: "bad", line: `${on ? "Signed in. " : "Not signed in. "}Space doesn't offer ${name}'s sign-in here: its sign-in route answers 404 on this Space.`, actions: [] };
  if (on) return { key: "in", tone: "ok", line: `Signed in. New threads on ${name} use this account.`, actions: [{ id: "again", label: "Sign in again" }] };
  return { key: "out", tone: "warn", line: `Not signed in. XO can't run ${name} until it is.`, actions: [{ id: "in", label: "Sign in", pri: true }] };
}

/** @param {Agent} rt @param {AccountsState} state */
function agentHtml(rt, state) {
  const n = rt.name, f = state.f[n] || null, v = rtView(rt, f, { missing: !!state.missing[n] }), err = state.e[n] || "";
  const mark = markOf(n);
  const btn = (/** @type {Action} */ a) => a.id === "open"
    ? `<a class="btn${a.pri ? " btn-pri" : ""}" href="${esc(f.url)}" target="_blank" rel="noopener" data-agent="open" data-rt="${esc(n)}">${esc(a.label)}</a>`
    : `<button type="button" class="btn${a.pri ? " btn-pri" : ""}" data-agent="${a.id}" data-rt="${esc(n)}"${a.busy ? ' aria-busy="true" aria-disabled="true"' : ""}>${esc(a.label)}</button>`;
  const code = v.key === "code" ? `<p class="acct-code"><b class="cp-code">${esc(f.code)}</b><span class="set-note"><i class="spin" aria-hidden="true"></i> Waiting for ${esc(rtName(n))}…</span></p>` : "";
  const log = v.key === "installing" && f.log ? `<p class="set-note acct-log">${esc(f.log)}</p>` : "";
  const sending = v.key === "sending";
  const paste = v.key === "paste" || sending
    ? `<form class="acct-paste" data-agent-form="${esc(n)}" autocomplete="off"><label class="field"><span>Code from the sign-in page</span><input name="code" required spellcheck="false" autocomplete="off" placeholder="Paste the code"${sending ? " readonly" : ""}></label>` +
      `<div class="set-fa"><button type="submit" class="btn btn-pri"${sending ? ' aria-busy="true" aria-disabled="true"' : ""}>${sending ? "Signing in…" : "Sign in"}</button></div></form>`
    : "";
  return `<div class="set-row acct" data-key="agent:${esc(n)}">` +
    `<div class="acct-top"><div class="set-l"><b>${mark ? `<i class="agm agm-${mark}" aria-hidden="true"></i>` : ""}${esc(rtName(n))}${rt.default ? `<span class="badge acct-rec">Recommended</span>` : ""}</b>` +
    `<span class="acct-s t-${v.tone || "none"}" role="status">${v.key === "checking" || v.key === "starting" || v.key === "installing" ? `<i class="spin" aria-hidden="true"></i> ` : ""}${esc(v.line)}</span></div>` +
    (v.actions.length ? `<div class="set-fa">${v.actions.map(btn).join("")}</div>` : "") + `</div>` +
    code + log + paste + (err ? `<p class="set-err" role="alert">${esc(err)}</p>` : "") + `</div>`;
}
/** @param {AccountsState} state */
function agentsHtml(state) {
  const rts = (state.rts || []).filter((r) => SIGN_IN[r.name]);
  const body = state.rts == null
    ? (state.rtErr ? `<p class="set-err" role="alert">${esc(state.rtErr)}</p>` : `<div class="set-row"><span class="set-note"><i class="spin" aria-hidden="true"></i> Checking…</span></div>`)
    : rts.length ? rts.map((runtime) => agentHtml(runtime, state)).join("") : `<p class="set-note">No agents on this Space.</p>`;
  return `<section class="set-sec" aria-labelledby="acct-ag-h"><h3 id="acct-ag-h">Agents</h3>${body}</section>`;
}

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
  /** @type {AccountsState} */
  const state = { rts: null, rtErr: "", f: {}, e: {}, missing: {} };
  const runtimeKey = Symbol("settings:runtime-status");
  const box = () => document.getElementById("settings")?.querySelector('[data-page="accounts"] .set-live') ?? null;
  const draw = () => {
    const el = box();
    if (!el || scope.signal.aborted) return;
    redraw(el, agentsHtml(state) + `<section class="set-sec" aria-labelledby="acct-gh-h"><h3 id="acct-gh-h">Connectors</h3>`
      + rowHtml(github.get()) + "</section>");
  };

  async function readRts() {
    try {
      await latest(runtimeKey, (signal) => api.runtimes({ signal }), {
        signal: scope.signal,
        commit(reply) {
          state.rts = reply.runtimes || [];
          state.rtErr = "";
        },
      });
    } catch (error) {
      if (scope.signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
      state.rtErr = requestFailureMessage(error, "Couldn't read the agents.");
    }
    draw();
  }

  /** @param {string} sel @param {Element} [from] */
  function focus(sel, from) {
    const target = box()?.querySelector(sel);
    if (!(target instanceof HTMLElement)) return;
    if (from && (target.closest("[hidden], [inert]") || !canRestoreFocus(from))) return;
    target.focus({ preventScroll: true });
  }
  const github = createGithubAccount({ scope, announce, draw, focus });
  scope.effect(() => () => { for (const flow of Object.values(state.f)) flow.ctl.abort(); });

  /** @param {string} n @param {boolean} force */
  async function agentIn(n, force) {
    const how = SIGN_IN[n];
    if (!how || state.f[n]) return;
    const ctl = new AbortController(), lines = /** @type {string[]} */ ([]);
    const f = state.f[n] = /** @type {AgentFlow} */ ({ phase: "starting", ctl, abortable: how.kind === "device" || n === "antigravity" });
    state.e[n] = ""; draw();
    const mine = () => !scope.signal.aborted && state.f[n] === f;
    let ended = false;
    /** @param {boolean} ok @param {string} msg */
    const end = (ok, msg) => {
      if (ended) return; ended = true;
      if (!mine()) return;
      delete state.f[n]; ctl.abort();
      if (ok) announce(msg);
      else state.e[n] = msg;
      draw(); readRts();
    };
    const on = (/** @type {SignInEvent} */ ev) => {
      if (!mine()) return;
      switch (ev.type) {
        case "session": f.session = ev.session_id; return;
        case "auth_url": f.url = ev.url; if (f.phase === "starting") { f.phase = "paste"; draw(); focus(`[data-agent-form="${n}"] input`); } return;
        case "code_rejected": f.phase = "paste"; state.e[n] = "That code wasn't accepted. Copy it again from the sign-in page and paste it."; draw(); return;
        case "installing": f.phase = "installing"; draw(); return;
        case "install_log": f.log = ev.line; draw(); return;
        case "stdout": {
          if (how.kind !== "device") return;
          lines.push(ev.line || "");
          const d = f.phase === "code" ? null : deviceCode(lines);
          if (d) { f.phase = "code"; f.url = d.url; f.code = d.code; draw(); focus('[data-agent="open"]'); }
          return;
        }
        case "done":
          if (ev.returncode === 0) end(true, f.url || f.code ? `${rtName(n)} signed in.` : `${rtName(n)} says it's already signed in.`);
          else end(false, `${rtName(n)}'s sign-in ended without signing in (exit ${ev.returncode}).`);
          return;
        case "error": end(false, ev.error || `${rtName(n)}'s sign-in failed.`); return;
      }
    };
    try {
      await api.signInStream(how.route, /** @type {Parameters<typeof api.signInStream>[1]} */ ({ force: force || how.route === "claude-code", signal: ctl.signal, on }));
      end(false, `${rtName(n)}'s sign-in stopped before it finished. Sign in to try again.`);
    } catch (err) {
      if (!mine() || (err instanceof Error && err.name === "AbortError")) return;
      if (missingRoute(err)) {
        state.missing[n] = true;
        ended = true;
        delete state.f[n];
        draw();
        return;
      }
      end(false, requestFailureMessage(err, `${rtName(n)}'s sign-in didn't start.`));
    }
  }
  /** @param {string} n */
  function agentCancel(n) {
    const f = state.f[n]; if (!f) return;
    delete state.f[n]; f.ctl.abort(); state.e[n] = ""; draw();
    if (SIGN_IN[n].cancel) {
      void api.signInCancel(SIGN_IN[n].route).catch((error) => {
        if (!missingRoute(error)) requestFailureMessage(error, "Couldn't cancel sign-in.");
      });
    }
    focus(`[data-agent="in"][data-rt="${n}"],[data-agent="again"][data-rt="${n}"]`);
  }
  /** @param {string} n @param {string} code */
  async function agentCode(n, code) {
    const f = state.f[n]; if (!f || f.phase !== "paste" || !code) return;
    f.phase = "sending"; state.e[n] = ""; draw();
    try { await api.signInCode(/** @type {"claude-code" | "antigravity"} */ (SIGN_IN[n].route), /** @type {string} */ (f.session), code); }
    catch (error) {
      if (scope.signal.aborted || state.f[n] !== f) return;
      f.phase = "paste";
      state.e[n] = missingRoute(error)
        ? (error instanceof Error ? error.message : "This Space doesn't accept a sign-in code.")
        : requestFailureMessage(error, "Couldn't send the sign-in code.");
      draw();
    }
  }

  wireAccounts({ scope, box, state, github, agentIn, agentCancel, agentCode, draw, focus, announce });

  return {
    /** The page was opened: read GitHub's state again (a sign-in under way keeps its code). */
    open() {
      if (!github.get().flow) void github.read();
      else draw();
      if (!Object.keys(state.f).length) void readRts();
    },
    dispose: scope.dispose,
  };
}
