// Settings › Accounts: the accounts XO works with for you, one control row each (state, then its one or two actions).
// GitHub's state and its sign-in are Space's own (GET /api/connectors/github/status, the cli device flow, disconnect).

import { api } from "./api.js";
import { esc } from "./world.js";
import { xi } from "./icon.js";
import { redraw } from "./redraw.js";
import { once, isPending, busyAttrs } from "./pending.js";

const NEEDS = ["repo", "workflow"];
const POLL_MS = 5000;

/** The scopes a connection lacks of what XO needs, from GitHub's "repo, workflow, …" header. */
export function missingScopes(scopes) {
  if (scopes == null || scopes === "") return [];
  const have = String(scopes).split(",").map((s) => s.trim());
  return NEEDS.filter((s) => !have.includes(s));
}

/**
 * GitHub's row from Space's status and the sign-in under way.
 * → {key, tone, line, actions: [{id, label, pri?}]}
 *   key: checking | in | partial | expired | out | unreachable | code | starting
 */
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
const signIn = (busy) => ({ id: "in", label: busy ? "Signing in…" : "Sign in", pri: true, busy });
const again = (busy, pri) => ({ id: "again", label: busy ? "Signing in…" : "Sign in again", pri, busy });
const OUT = { id: "out", label: "Sign out" };

export function createAccounts({ announce }) {
  const S = { gh: null, flow: null, err: "", confirm: false, timer: null };
  const box = () => document.querySelector('[data-page="accounts"] .set-live');
  const draw = () => { const el = box(); if (el) redraw(el, html()); };

  async function read() {
    try { S.gh = await api.githubStatus(); }
    catch (err) { S.gh = { status: "failed", error: err.message }; }
    draw();
  }

  function rowHtml() {
    const v = ghView(S.gh, S.flow);
    const btn = (a) => a.id === "open"
      ? `<a class="btn btn-pri" href="${esc(S.flow.uri)}" target="_blank" rel="noopener" data-acct="open">${esc(a.label)}</a>`
      : `<button type="button" class="btn${a.pri ? " btn-pri" : ""}" data-acct="${a.id}"${a.busy ? ' aria-busy="true" aria-disabled="true"' : busyAttrs(`acct:${a.id}`)}>${esc(a.label)}</button>`;
    const ask = S.confirm
      ? `<p class="acct-q">Sign out of GitHub? XO stops cloning private repositories and deploying until you sign in again.</p><div class="set-fa"><button type="button" class="btn" data-acct="keep">Stay signed in</button><button type="button" class="btn btn-danger" data-acct="out-yes"${busyAttrs("acct:out")}>Sign out</button></div>`
      : "";
    const code = v.key === "code" ? `<p class="acct-code"><b class="cp-code">${esc(S.flow.code)}</b><span class="set-note"><i class="spin" aria-hidden="true"></i> Waiting for GitHub…</span></p>` : "";
    return `<div class="set-row acct${ask || code ? " is-stack" : ""}" data-key="acct:github">` +
      `<div class="acct-top"><div class="set-l"><b><span class="acct-ic" aria-hidden="true">${xi("github")}</span>GitHub</b><span class="acct-s t-${v.tone || "none"}" role="status">${v.key === "checking" ? `<i class="spin" aria-hidden="true"></i> ` : ""}${esc(v.line)}</span></div>` +
      (ask ? "" : `<div class="set-fa">${v.actions.map(btn).join("")}</div>`) + `</div>` +
      code + ask + (S.err ? `<p class="set-err" role="alert">${esc(S.err)}</p>` : "") + `</div>`;
  }
  const html = () => `<section class="set-sec">${rowHtml()}</section>`;

  const focus = (sel) => box()?.querySelector(sel)?.focus({ preventScroll: true });
  function stop() { clearTimeout(S.timer); S.timer = null; }

  async function signIn(fresh) {
    if (S.flow) return;
    stop(); S.err = ""; S.flow = { starting: true }; draw();
    let s;
    try { s = await api.githubConnect(fresh); }
    catch (err) { S.flow = null; S.err = err.message || "GitHub didn't start a sign-in."; draw(); focus('[data-acct="in"],[data-acct="again"]'); return; }
    if (s.status === "connected") { S.flow = null; S.gh = s; announce(`GitHub signed in as @${s.username}${s.imported ? ", with this machine's gh login" : ""}.`); draw(); focus('[data-acct="again"]'); read(); return; }
    S.flow = { code: s.user_code, uri: s.verification_uri, id: s.session_id, until: Date.now() + (s.expires_in || 900) * 1000 };
    draw(); focus('[data-acct="open"]');
    const poll = async () => {
      if (!S.flow || S.flow.id !== s.session_id) return;
      let r;
      try { r = await api.githubConnectPoll(s.session_id); }
      catch (err) { r = { status: "failed", error: err.status === 404 ? "That code expired." : err.message }; }
      if (!S.flow || S.flow.id !== s.session_id) return;
      if (r.status === "pending" && Date.now() < S.flow.until) { S.timer = setTimeout(poll, POLL_MS); return; }
      S.flow = null;
      if (r.status === "connected") { S.gh = r; announce(`GitHub signed in as @${r.username}.`); }
      else S.err = r.status === "pending" ? "That code expired. Sign in to get a new one." : r.error || "GitHub didn't sign in.";
      draw(); read();
    };
    S.timer = setTimeout(poll, POLL_MS);
  }
  function cancel() {
    const id = S.flow && S.flow.id;
    stop(); S.flow = null; draw();
    if (id) api.githubConnectCancel(id).catch(() => {});
    focus('[data-acct="in"],[data-acct="again"]');
  }
  async function signOut() {
    if (isPending("acct:out")) return;
    const p = once("acct:out", async () => {
      try { await api.githubDisconnect(); S.confirm = false; S.err = ""; announce("Signed out of GitHub."); return true; }
      catch (err) { S.err = err.message; return false; }
    });
    draw();
    if (await p) { await read(); focus('[data-acct="in"]'); } else draw();
  }

  document.querySelector("#settings").addEventListener("click", (e) => {
    const b = e.target.closest("[data-acct]");
    if (!b || !box()?.contains(b)) return;
    const id = b.dataset.acct;
    if (id === "open") { navigator.clipboard?.writeText(S.flow ? S.flow.code : "").catch(() => {}); announce("Code copied."); return; }
    if (b.getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
    if (id === "in") signIn(false);
    else if (id === "again") signIn(true);
    else if (id === "cancel") cancel();
    else if (id === "check") { S.gh = null; S.err = ""; draw(); read(); }
    else if (id === "out") { S.confirm = true; S.err = ""; draw(); focus('[data-acct="keep"]'); }
    else if (id === "keep") { S.confirm = false; draw(); focus('[data-acct="out"]'); }
    else if (id === "out-yes") signOut();
  });

  return {
    /** The page was opened: read GitHub's state again (a sign-in under way keeps its code). */
    open() { if (!S.flow) read(); else draw(); },
  };
}
