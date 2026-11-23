// Settings › Accounts: the accounts XO works with for you, one control row each (state, then its one or two actions).

import { api } from "./api.js";
import { esc } from "./world.js";
import { xi } from "./icon.js";
import { redraw } from "./redraw.js";
import { once, isPending, busyAttrs } from "../core/platform/pending.js";
import { rtName, markOf } from "../core/services/runtimes.js";

const NEEDS = ["repo", "workflow"];
const POLL_MS = 5000;

/** The scopes a connection lacks of what XO needs, from GitHub's "repo, workflow, …" header. */
export function missingScopes(scopes) {
  if (scopes == null || scopes === "") return [];
  const have = String(scopes).split(",").map((s) => s.trim());
  return NEEDS.filter((s) => !have.includes(s));
}

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

/** The agents with a sign-in route in Space, and how each signs in: paste a code back, or enter one on their page. */
export const SIGN_IN = {
  claude_code: { route: "claude-code", kind: "paste", cancel: true },
  codex: { route: "codex", kind: "device" },
  antigravity: { route: "antigravity", kind: "paste" },
};
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;

/** Codex prints its device sign-in as terminal text: the page's address and a one-time code, once both are in. */
export function deviceCode(lines) {
  const text = lines.join("\n").replace(ANSI, "");
  const url = (text.match(/https:\/\/[^\s"'<>]+/) || [])[0];
  const code = (text.match(/\b[A-Z0-9]{4,}-[A-Z0-9]{4,}\b/) || [])[0];
  return url && code ? { url: url.replace(/[.,;)]+$/, ""), code } : null;
}

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

export function createAccounts({ announce }) {
  const S = { gh: null, flow: null, err: "", confirm: false, timer: null, rts: null, rtErr: "", f: {}, e: {}, missing: {} };
  const box = () => document.querySelector('[data-page="accounts"] .set-live');
  const draw = () => { const el = box(); if (el) redraw(el, html()); };

  async function read() {
    try { S.gh = await api.githubStatus(); }
    catch (err) { S.gh = { status: "failed", error: err.message }; }
    draw();
  }
  async function readRts() {
    try { S.rts = (await api.runtimes()).runtimes || []; S.rtErr = ""; }
    catch (err) { S.rtErr = err.message; }
    draw();
  }

  function agentHtml(rt) {
    const n = rt.name, f = S.f[n] || null, v = rtView(rt, f, { missing: !!S.missing[n] }), err = S.e[n] || "";
    const mark = markOf(n);
    const btn = (a) => a.id === "open"
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
  const agentsHtml = () => {
    const rts = (S.rts || []).filter((r) => SIGN_IN[r.name]);
    const body = S.rts == null
      ? (S.rtErr ? `<p class="set-err" role="alert">${esc(S.rtErr)}</p>` : `<div class="set-row"><span class="set-note"><i class="spin" aria-hidden="true"></i> Checking…</span></div>`)
      : rts.length ? rts.map(agentHtml).join("") : `<p class="set-note">No agents on this Space.</p>`;
    return `<section class="set-sec" aria-labelledby="acct-ag-h"><h3 id="acct-ag-h">Agents</h3>${body}</section>`;
  };

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
  const html = () => agentsHtml() + `<section class="set-sec" aria-labelledby="acct-gh-h"><h3 id="acct-gh-h">Connectors</h3>${rowHtml()}</section>`;

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

  async function agentIn(n, force) {
    const how = SIGN_IN[n];
    if (!how || S.f[n]) return;
    const ctl = new AbortController(), lines = [];
    const f = S.f[n] = { phase: "starting", ctl, abortable: how.kind === "device" || n === "antigravity" };
    S.e[n] = ""; draw();
    const mine = () => S.f[n] === f;
    let ended = false;
    const end = (ok, msg) => {
      if (ended) return; ended = true;
      if (!mine()) return;
      delete S.f[n]; ctl.abort();
      if (ok) announce(msg);
      else S.e[n] = msg;
      draw(); readRts();
    };
    const on = (ev) => {
      if (!mine()) return;
      switch (ev.type) {
        case "session": f.session = ev.session_id; return;
        case "auth_url": f.url = ev.url; if (f.phase === "starting") { f.phase = "paste"; draw(); focus(`[data-agent-form="${n}"] input`); } return;
        case "code_rejected": f.phase = "paste"; S.e[n] = "That code wasn't accepted. Copy it again from the sign-in page and paste it."; draw(); return;
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
      await api.signInStream(how.route, { force: force || how.route === "claude-code", signal: ctl.signal, on });
      end(false, `${rtName(n)}'s sign-in stopped before it finished. Sign in to try again.`);
    } catch (err) {
      if (err.name === "AbortError") return;
      if (err.status === 404) { S.missing[n] = true; ended = true; if (mine()) delete S.f[n]; draw(); return; }
      end(false, err.message || `${rtName(n)}'s sign-in didn't start.`);
    }
  }
  function agentCancel(n) {
    const f = S.f[n]; if (!f) return;
    delete S.f[n]; f.ctl.abort(); S.e[n] = ""; draw();
    if (SIGN_IN[n].cancel) api.signInCancel(SIGN_IN[n].route).catch(() => {});
    focus(`[data-agent="in"][data-rt="${n}"],[data-agent="again"][data-rt="${n}"]`);
  }
  async function agentCode(n, code) {
    const f = S.f[n]; if (!f || f.phase !== "paste" || !code) return;
    f.phase = "sending"; S.e[n] = ""; draw();
    try { await api.signInCode(SIGN_IN[n].route, f.session, code); }
    catch (err) { if (S.f[n] === f) { f.phase = "paste"; S.e[n] = err.message; draw(); } }
  }

  document.querySelector("#settings").addEventListener("submit", (e) => {
    const form = e.target.closest("[data-agent-form]");
    if (!form || !box()?.contains(form)) return;
    e.preventDefault();
    agentCode(form.dataset.agentForm, form.elements.code.value.trim());
  });

  document.querySelector("#settings").addEventListener("click", (e) => {
    const a = e.target.closest("[data-agent]");
    if (a && box()?.contains(a)) {
      const n = a.dataset.rt, id = a.dataset.agent, f = S.f[n];
      if (id === "open") { if (f && f.code) { navigator.clipboard?.writeText(f.code).catch(() => {}); announce("Code copied."); } if (f && !f.opened) { f.opened = true; setTimeout(draw); } return; }
      if (a.getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
      if (id === "in") agentIn(n, false);
      else if (id === "again") agentIn(n, true);
      else if (id === "cancel") agentCancel(n);
      return;
    }
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
    open() { if (!S.flow) read(); else draw(); if (!Object.keys(S.f).length) readRts(); },
  };
}
