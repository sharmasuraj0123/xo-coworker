// Settings pages for storm (U2): Routing (R6's "who routes", decision models), Rules (R2: what agents may
// do without asking), Worktrees (a thread's checkout, removed only after saying what would be lost).
// Every value shown is the server's; every change is the person's own click, said back plainly.
// Reads on open; the stream keeps the router setting current.
//
// A page is drawn in place (js/redraw.js): the control under the keyboard stays the same node through every
// redraw. A request answers once until it settles (js/pending.js): the control says it's waiting, a repeat joins
// it, a failure is said beside its cause and leaves a retry that works. Where an action takes its own control
// away (a question opens, a row goes), focus goes where that action's contract says (land).

import { api } from "./api.js";
import { esc } from "./world.js";
import { ICON } from "./ui.js";
import { renderInline } from "./markdown.js";
import { holdButton } from "./kit.js";
import { once, isPending, busyAttrs } from "./pending.js";
import { redraw } from "./redraw.js";
import { radioKeys, rovingTab } from "./keynav.js";

const PCT = [0.5, 0.6, 0.7, 0.8, 0.9];
/** The confidence choices, always including the server's own value (set elsewhere, e.g. 0.75). */
const pcts = (v) => (PCT.some((p) => Math.abs(p - v) < 0.001) || !(v >= 0 && v <= 1) ? PCT : [...PCT, v].sort((a, b) => a - b));
const when = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
const sel = (attr, v) => `[${attr}="${CSS.escape(v)}"]`;
const errHtml = (text) => (text ? `<p class="set-err" role="alert">${esc(text)}</p>` : "");
/** A question's other button (Keep, Cancel) while its answer is on its way: it waits with it, and can't take it back. */
const waits = (key) => (isPending(key) ? ' aria-disabled="true"' : "");
// one router setting: a choice and its confidence are sent one at a time
const ROUTER = "router";

export function createSettings({ world, announce, PROJ, onChange }) {
  const R = { router: null, models: [], rules: null, defaults: [], trees: null, reported: [], err: {}, form: null, confirm: null };

  const box = (id) => document.querySelector(`[data-page="${id}"] .set-live`);
  const paint = (id, html) => { const el = box(id); if (el) redraw(el, html); };
  /** The control an action leads to (or, when it isn't there, the page's own tab in the rail). */
  function target(id, to) {
    const el = to && box(id)?.querySelector(to);
    return el && !el.disabled ? el : document.querySelector(`#settings [data-set="${id}"]`);
  }
  const focusOn = (el) => { if (!el) return; el.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest" }); };
  /** Focus goes where the action's contract says, now: the person just pressed the control it replaced. */
  const focusTo = (id, to) => focusOn(target(id, to));
  /** The same once a request settles, unless the person has moved on meanwhile to something still there. */
  function land(id, to, from) {
    const a = document.activeElement;
    if (a && a !== document.body && a !== from && a.isConnected) return;
    focusTo(id, to);
  }
  /**
   * A request from a control: drawn as waiting while it's out (a repeat press joins it), and drawn again once it
   * settles in the same step as the keyboard goes where the outcome leads (work's { to }), so focus never rests on
   * the page between the redraw that took its control away and its landing. Without { to } it stays where it is.
   */
  async function pend(key, page, render, work, from) {
    const p = once(key, work);
    render();
    let r;
    try { r = await p; return r; }
    finally { render(); if (r && "to" in r) land(page, r.to, from); }
  }
  /** Where focus goes when this row leaves: the nearest row after it in its list with that control, else before it. */
  function neighbour(from, row, attr) {
    const r = from && from.closest(row);
    if (!r) return null;
    for (const dir of ["nextElementSibling", "previousElementSibling"]) {
      for (let x = r[dir]; x; x = x[dir]) { const b = x.querySelector(`[${attr}]:not(:disabled)`); if (b) return b.getAttribute(attr); }
    }
    return null;
  }

  // ── Routing ─────────────────────────────────────────────────────────────
  async function loadRouting() {
    try { const [r, m] = await Promise.all([api.router(), api.routerModels()]); R.router = r; R.models = m.models || []; R.err.routing = null; }
    catch (err) { R.err.routing = err.message; }
    renderRouting();
  }
  function renderRouting() {
    paint("routing", routingHtml());
    // a custom element draws its own insides: its value follows the server's unless a change of it is out
    const a = box("routing")?.querySelector("[data-abstain]"), r = world.state.router || R.router;
    if (a && r && !isPending(ROUTER)) { const v = String(r.abstain_below ?? 0.5); if (a.value !== v) a.value = v; }
  }
  function routingHtml() {
    routeSig = routingSig();
    if (R.err.routing && !R.router) return `<p class="set-empty"><b>Couldn't read the routing.</b> ${esc(R.err.routing)}</p>`;
    if (!R.router) return `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`;
    const r = world.state.router || R.router;
    const busy = busyAttrs(ROUTER);
    const opts = [["agent", null], ...R.models.map((m) => ["decision", m.id]), ["off", null]];
    const anyOn = opts.some(([mode, dm]) => r.mode === mode && (mode !== "decision" || r.decision_model === dm));
    let first = !anyOn;
    const opt = (mode, dm, title, sub, disabled = false) => {
      const on = r.mode === mode && (mode !== "decision" || r.decision_model === dm);
      const tab = disabled ? "" : rovingTab(on, first);
      if (!disabled) first = false;
      return `<button type="button" class="set-choice${on ? " is-on" : ""}" role="radio" aria-checked="${on}" data-route="${mode}"${dm ? ` data-dm="${esc(dm)}"` : ""}${disabled ? " disabled" : `${tab}${busy}`}><span class="sc-dot" aria-hidden="true"></span><span class="sc-b"><b>${esc(title)}</b><span>${esc(sub)}</span></span></button>`;
    };
    const overrides = world.state.projects.filter((p) => p.routing && p.routing.mode);
    // chats whose own routing names a decision model that isn't connected: said from the routing as it is, so the
    // words go the moment the last of them uses the Space's routing, whichever way that happened (the create-project
    // grader on 65e84b7, S113: a Disconnect's own flag outlived the override it was about, after "Use the Space's")
    const orphans = overrides.filter((p) => p.routing.mode === "decision" && !(R.models.find((m) => m.id === p.routing.decision_model) || {}).connected);
    const ab = r.abstain_below ?? 0.5;
    return `<section class="set-sec" aria-labelledby="rt-h"><h3 id="rt-h">Who routes a new message</h3>` +
      `<p class="set-lead">When you write to the Workspace or a project, this decides where it goes. A reply inside a thread always goes straight to its agent.</p>` +
      `<div class="set-choices" role="radiogroup" aria-labelledby="rt-h">` +
      opt("agent", null, "The coordinator", "Reads your message and decides itself: answer, forward, or start a thread.") +
      R.models.map((m) => opt("decision", m.id, m.label, m.connected ? `A decision model routes it; when it isn't sure, the coordinator decides.` : "Connect it below to use it.", !m.connected)).join("") +
      opt("off", null, "Off", "Chats using this setting refuse new messages; one with its own routing keeps it. Replies inside threads still work.") +
      `</div>` +
      (r.mode === "decision" ? `<div class="set-row is-sub"><div class="set-l"><b>When it isn't sure</b><span>Below this confidence, the coordinator decides instead.</span></div><xo-select class="set-sel" data-abstain aria-label="Confidence needed"${busy}>${pcts(ab).map((p) => `<option value="${p}"${Math.abs(ab - p) < 0.001 ? " selected" : ""}>${Math.round(p * 100)}% sure</option>`).join("")}</xo-select></div>` : "") +
      errHtml(R.err.route) +
      (orphans.length ? `<p class="set-err" data-orphans>${esc(orphans.map((p) => p.name).join(", "))} still ${orphans.length === 1 ? "names" : "name"} a decision model that isn't connected: use the Space's routing for ${orphans.length === 1 ? "it" : "them"} below.</p>` : "") +
      `</section>` +
      `<section class="set-sec" aria-labelledby="dm-h"><h3 id="dm-h">Decision models</h3>` +
      `<p class="set-lead">A small model that routes quickly. Its key is saved on this machine and never shown again.</p>` +
      R.models.map((m) => modelHtml(m, r)).join("") + `</section>` +
      (overrides.length ? `<section class="set-sec" aria-labelledby="ov-h"><h3 id="ov-h">Chats with their own routing</h3>` +
        overrides.map((p) => `<div class="set-row" data-key="ov:${esc(p.chatId)}"><div class="set-l"><b>${esc(p.name)}</b><span>${p.routing.mode === "decision" ? `Routed by ${esc((R.models.find((m) => m.id === p.routing.decision_model) || {}).label || p.routing.decision_model)}` : p.routing.mode === "agent" ? "Routed by its coordinator" : "Routing off"}</span>${R.err.ov && R.err.ov.chat === p.chatId ? errHtml(R.err.ov.text) : ""}</div><button type="button" class="btn" data-ov-clear="${esc(p.chatId)}"${busyAttrs(`ov:${p.chatId}`)}>Use the Space's</button></div>`).join("") + `</section>` : "");
  }
  function modelHtml(m, r) {
    const f = R.form === m.id, c = R.confirm && R.confirm.dm === m.id ? R.confirm : null;
    const n = c ? c.chats.length : 0;
    return `<div class="set-row dm${m.connected ? " is-on" : ""}" data-key="dm:${esc(m.id)}"><div class="set-l"><b>${esc(m.label)}</b><span>${m.connected ? `Connected · model ${esc(m.model)}` : "Not connected"}${m.docs_url ? ` · <a href="${esc(m.docs_url)}" target="_blank" rel="noopener noreferrer">about it</a>` : ""}</span></div>` +
      (m.connected ? (c ? "" : `<button type="button" class="btn" data-dm-off="${esc(m.id)}">Disconnect</button>`) : f ? "" : `<button type="button" class="btn btn-pri" data-dm-on="${esc(m.id)}">Connect</button>`) + `</div>` +
      (f ? `<form class="set-form" data-dm-form="${esc(m.id)}" autocomplete="off"><label class="field"><span>API key</span><input type="password" name="key" required autocomplete="new-password" spellcheck="false" placeholder="Paste the key"></label>` +
        `<label class="field"><span>Model <em>optional</em></span><input name="model" placeholder="${esc(m.model || "")}" spellcheck="false"></label>` +
        errHtml(R.err.dm) +
        `<div class="set-fa"><button type="button" class="btn" data-dm-cancel${waits(`dm-on:${m.id}`)}>Cancel</button><button type="submit" class="btn btn-pri" data-dm-submit${busyAttrs(`dm-on:${m.id}`)}>Connect</button></div></form>` : "") +
      (c ? `<div class="set-confirm" role="alertdialog" aria-labelledby="dmc-${esc(m.id)}"><p id="dmc-${esc(m.id)}"><b>Disconnect ${esc(m.label)}?</b> Its key is removed from this machine.${r.mode === "decision" && r.decision_model === m.id ? " Routing goes back to the coordinator." : ""}${n ? ` ${n} ${n === 1 ? "chat routes" : "chats route"} with it (${c.chats.map((x) => esc(PROJ(x))).join(", ")}); they go back to the Space's routing too.` : ""}</p>` +
        errHtml(R.err.dmOff) +
        `<div class="set-fa"><button type="button" class="btn" data-dm-no${waits(`dm-off:${m.id}`)}>Keep it</button><button type="button" class="btn btn-danger" data-dm-yes="${esc(m.id)}"${busyAttrs(`dm-off:${m.id}`)}>Disconnect</button></div></div>` : "");
  }
  // what the Routing page shows, so a change from the stream (another tab, a chat's own routing) re-renders it
  let routeSig = "";
  const routingSig = () => JSON.stringify([world.state.router, world.state.projects.map((p) => [p.id, p.routing])]);
  async function setRoute(mode, dm, abstain) {
    const r = world.state.router || R.router || {};
    // choosing what is already chosen changes nothing (the PUT is a full replace)
    if (abstain == null && r.mode === mode && (mode !== "decision" || r.decision_model === dm)) return;
    if (!isPending(ROUTER)) R.err.route = null;
    await pend(ROUTER, "routing", renderRouting, async () => {
      try {
        // a full replace: abstain_below is sent every time, or it resets (UI-reference §2.3)
        R.router = await api.setRouter({ mode, ...(mode === "decision" ? { decision_model: dm } : {}), abstain_below: abstain ?? r.abstain_below ?? 0.5 });
        world.state.router = R.router;
        announce(mode === "off" ? "Routing is off." : mode === "agent" ? "The coordinator routes new messages." : `${(R.models.find((m) => m.id === dm) || {}).label || dm} routes new messages.`);
        onChange();
      } catch (err) { R.err.route = err.message; }
    });
  }
  async function connect(f, from) {
    const id = f.dataset.dmForm, key = f.key.value.trim(), model = f.model.value.trim();
    if (isPending(`dm-on:${id}`)) return;
    if (!key) { R.err.dm = "Paste the key first."; renderRouting(); f.key.focus(); return; }
    R.err.dm = null;
    await pend(`dm-on:${id}`, "routing", renderRouting, async () => {
      try { R.models = (await api.connectRouterModel({ provider: id, ...(model ? { model } : {}), api_key: key })).models || R.models; }
      catch (err) {
        // a key the server calls malformed goes, and the keyboard with it (paste the right one); after any other
        // failure the key stays for the retry, and so does the keyboard
        if (err.code === "invalid_key") { R.err.dm = "That doesn't look like a key: no spaces, not blank."; f.key.value = ""; return { to: `${sel("data-dm-form", id)} input[name="key"]` }; }
        R.err.dm = err.message;
        return {};
      }
      announce("Connected. Its key is saved and won't be shown again.");
      onChange();
      R.form = null; // the form, and the key typed in it, leave the page: the keyboard goes to its Disconnect
      return { to: sel("data-dm-off", id) };
    }, from);
  }
  async function disconnect(id, from) {
    R.err.dmOff = null;
    await pend(`dm-off:${id}`, "routing", renderRouting, async () => {
      const chats = R.confirm && R.confirm.dm === id ? R.confirm.chats : [];
      try { R.models = (await api.disconnectRouterModel(id)).models || R.models; }
      catch (err) { R.err.dmOff = err.message; return {}; }
      // the server resets only the Space setting; chats that named it are cleared here (UI-reference §4.8)
      const left = [];
      for (const c of chats) {
        const p = world.project(c);
        if (!p) continue;
        try { const x = await api.patchChat(p.chatId, { routing: null }); p.routing = (x && x.routing) || null; }
        catch { left.push(PROJ(c)); }
      }
      try { R.router = await api.router(); world.state.router = R.router; } catch { /* the stream brings it */ }
      // a chat whose PATCH failed still names it: the page says so from the routing itself (routingHtml's orphans),
      // and here, once, aloud
      announce(`Disconnected. Its key is removed.${left.length ? ` ${left.join(", ")} still ${left.length === 1 ? "names" : "name"} it: use the Space's routing for ${left.length === 1 ? "it" : "them"}.` : ""}`);
      onChange();
      R.confirm = null; // the question goes: the keyboard goes to the model's Connect
      return { to: sel("data-dm-on", id) };
    }, from);
  }
  async function clearOverride(chat, from) {
    const next = neighbour(from, ".set-row", "data-ov-clear");
    if (!isPending(`ov:${chat}`)) R.err.ov = null;
    await pend(`ov:${chat}`, "routing", renderRouting, async () => {
      try {
        const c = await api.patchChat(chat, { routing: null });
        const p = world.state.projects.find((x) => x.chatId === chat);
        if (p) p.routing = (c && c.routing) || null;
        announce("It uses the Space's routing again.");
        onChange();
        // its row goes: the next chat's button, else the Space's own choice
        return { to: next ? sel("data-ov-clear", next) : '[data-route][aria-checked="true"]' };
      } catch (err) { R.err.ov = { chat, text: err.message }; return {}; }
    }, from);
  }

  // ── Rules (R2) ──────────────────────────────────────────────────────────
  async function loadRules() {
    try {
      let after = 0; const rules = []; let defaults = [];
      for (let i = 0; i < 10; i++) {
        const d = await api.rules({ after_seq: after, limit: 500 });
        rules.push(...(d.rules || [])); defaults = d.defaults || defaults;
        if (!d.next_after_seq) break;
        after = d.next_after_seq;
      }
      R.rules = rules; R.defaults = defaults; R.err.rules = null;
    } catch (err) { R.err.rules = err.message; }
    renderRules();
  }
  const renderRules = () => paint("rules", rulesHtml());
  function rulesHtml() {
    if (R.err.rules && !R.rules) return `<p class="set-empty"><b>Couldn't read your rules.</b> ${esc(R.err.rules)}</p>`;
    if (!R.rules) return `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`;
    const scopeWord = (r) => {
      if (r.scope === "thread") { const t = r.thread_ts && world.thread(r.thread_ts); return t ? `Only in “${t.title}”` : "Only in one thread"; }
      return r.scope === "project" ? (r.project_pid ? PROJ(projectOfPid(r.project_pid)) : "A project") : "Every project";
    };
    const row = (r, def) => `<li class="rl-row${r.effect === "deny" ? " is-deny" : ""}" data-key="rule:${esc(r.id)}"><div class="rl-main"><q class="rl-s">${renderInline(r.sentence || "", true)}</q>` +
      `<span class="rl-m">${def ? "XO's default" : `${esc(scopeWord(r))}${r.tier ? ` · ${esc(r.tier)}` : ""}${r.uses ? ` · answered ${r.uses} ${r.uses === 1 ? "ask" : "asks"}` : ""}${r.created_at ? ` · since ${esc(when(r.created_at))}` : ""}`}</span>` +
      (R.err.rule && R.err.rule.id === r.id ? errHtml(R.err.rule.text) : "") + `</div>` +
      (R.confirm && R.confirm.rule === r.id
        ? `<span class="rl-c"><span>${def ? "A default can't be brought back." : "Agents will ask again."}</span><button type="button" class="btn" data-rule-no${waits(`rule:${r.id}`)}>Keep</button><button type="button" class="btn btn-danger" data-rule-yes="${esc(r.id)}"${busyAttrs(`rule:${r.id}`)}>Revoke</button></span>`
        : `<button type="button" class="btn" data-rule-off="${esc(r.id)}">Revoke</button>`) + `</li>`;
    const mine = R.rules.filter((r) => !r.revoked_at);
    const defs = R.defaults.filter((d) => !d.revoked_at);
    const gone = R.defaults.filter((d) => d.revoked_at);
    return `<p class="set-lead">What agents may do without asking you. A rule is only ever made by you: from a decision ("Make it a rule"), word for word. Revoke one and agents ask again.</p>` +
      `<section class="set-sec" aria-labelledby="rl-mine"><h3 id="rl-mine">Your rules <span>${mine.length}</span></h3>${mine.length ? `<ul class="rl-list">${mine.map((r) => row(r, false)).join("")}</ul>` : `<p class="set-note">None yet. When you allow something with "Make it a rule", it appears here.</p>`}</section>` +
      `<section class="set-sec" aria-labelledby="rl-def"><h3 id="rl-def">XO's defaults <span>${defs.length}</span></h3><p class="set-lead">Safe, routine things: reading inside the project, read-only git, XO's own tools.</p><ul class="rl-list">${defs.map((d) => row(d, true)).join("")}</ul>` +
        (gone.length ? `<h4 class="rl-gone-h">Revoked</h4><ul class="rl-list is-gone">${gone.map((d) => `<li class="rl-row is-revoked" data-key="gone:${esc(d.id)}"><div class="rl-main"><q class="rl-s">${renderInline(d.sentence || "", true)}</q><span class="rl-m">Revoked${d.revoked_at ? ` ${esc(when(d.revoked_at))}` : ""} · agents ask for this</span></div></li>`).join("")}</ul>` : "") + `</section>`;
  }
  const projectOfPid = (pid) => (world.state.projects.find((p) => p.id === pid || p.pid === pid) || {}).id || pid;
  async function revoke(id, from) {
    const next = neighbour(from, ".rl-row", "data-rule-off");
    if (!isPending(`rule:${id}`)) R.err.rule = null;
    await pend(`rule:${id}`, "rules", renderRules, async () => {
      try { await api.revokeRule(id); }
      catch (err) { R.err.rule = { id, text: err.message }; return {}; }
      // revoked: it leaves its list now (the keyboard to the next rule's Revoke); the read after brings the server's own record
      const at = new Date().toISOString();
      for (const r of [...R.rules, ...R.defaults]) if (r.id === id) r.revoked_at = r.revoked_at || at;
      R.confirm = null;
      announce("Revoked. Agents will ask again.");
      loadRules();
      return { to: next && sel("data-rule-off", next) };
    }, from);
  }

  // ── Worktrees ───────────────────────────────────────────────────────────
  async function loadTrees() {
    try { const d = await api.worktrees(); R.trees = d.worktrees || []; R.reported = d.reported || []; R.err.trees = null; }
    catch (err) { R.err.trees = err.message; }
    renderTrees();
  }
  function lossHtml(l) {
    if (!l) return "";
    const files = [...(l.changed && l.changed.paths || []).map((p) => `changed · ${p}`), ...(l.untracked && l.untracked.paths || []).map((p) => `new · ${p}`)];
    return `<div class="wt-loss"><p><b>${esc(l.summary || "Work that isn't kept anywhere else")}</b></p>` +
      (l.commits ? `<p>${l.commits} commit${l.commits === 1 ? "" : "s"} only on ${esc(l.branch || "its branch")}</p>` : "") +
      (files.length ? `<pre class="tb-out">${esc(files.slice(0, 30).join("\n"))}${files.length > 30 ? `\n… ${files.length - 30} more` : ""}</pre>` : "") + `</div>`;
  }
  const treeKey = (w) => `${w.chat_id}/${w.thread_ts}`;
  function renderTrees() {
    paint("worktrees", treesHtml());
    // the hold is wired once per button: a redraw keeps the same node
    const hb = box("worktrees")?.querySelector("[data-wt-hold]");
    if (hb && !hb._hold) {
      hb._hold = true;
      holdButton(hb, {
        ready: () => !isPending(`wt:${hb.dataset.wtHold}`),
        onConfirm: () => removeTree(hb.dataset.wtHold, R.confirm && R.confirm.token, hb),
      });
    }
  }
  function treesHtml() {
    if (R.err.trees && !R.trees) return `<p class="set-empty"><b>Couldn't read the worktrees.</b> ${esc(R.err.trees)}</p>`;
    if (!R.trees) return `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`;
    const title = (w) => { const t = world.thread(w.thread_ts); return t ? t.title : "A thread"; };
    const by = new Map();
    for (const w of R.trees) { const p = world.act.projectOf ? world.act.projectOf(w.chat_id) : w.chat_id; (by.get(p) || by.set(p, []).get(p)).push(w); }
    return `<p class="set-lead">Each thread works in its own checkout of the project. XO removes one by itself only when nothing would be lost; here you can remove one sooner.</p>` +
      (R.trees.length ? [...by].map(([p, list]) => `<section class="set-sec" data-key="wtp:${esc(p)}"><h3>${esc(PROJ(p))}</h3><ul class="wt-list">${list.map((w) => {
        const key = treeKey(w), pk = `wt:${key}`;
        const c = R.confirm && R.confirm.wt === key ? R.confirm : null;
        const busy = !!(w.session_state && w.session_state !== "cold");
        const state = w.error ? `Can't be read: ${w.error}` : w.exists === false ? "The checkout is already gone" : w.xo === false ? "XO didn't make this checkout, so it won't remove it" : busy ? "Its agent is still using it" : w.would_lose ? "Has work not kept anywhere else" : "Nothing would be lost";
        // offered where the server says it can go, or where it would lose work (shown first, then held)
        const can = !!(w.removable || (w.would_lose && w.xo !== false && !w.error));
        const err = R.err.wt && R.err.wt.key === key ? errHtml(R.err.wt.text) : "";
        const hold = isPending(pk);
        return `<li class="wt-row" data-key="wt:${esc(key)}"><div class="wt-main"><b>${esc(title(w))}</b><code>${esc(w.branch || w.path)}</code><span class="wt-s${w.would_lose ? " is-warn" : ""}">${esc(state)}${w.thread_state ? ` · thread ${esc(String(w.thread_state).replace("_", " "))}` : ""}</span>${c ? "" : err}</div>` +
          (c || !(can || busy) ? "" : `<button type="button" class="btn" data-wt="${esc(key)}"${busy ? " disabled" : busyAttrs(pk)}>Remove</button>`) +
          (c ? `<div class="wt-confirm" role="alertdialog" aria-label="Remove this worktree">${c.lose
            ? lossHtml(c.lose) + `<p class="wt-q">Removing it deletes that work. It can't be undone.</p>${err}<div class="set-fa"><button type="button" class="btn" data-wt-no${waits(pk)}>Keep it</button><button type="button" class="b b-hold wt-hold" data-wt-hold="${esc(key)}" aria-pressed="false"${hold ? ' style="--p:1"' : ""}${busyAttrs(pk)}><span class="hold-fill" aria-hidden="true"></span><span class="b-l"><span class="hold-ic">${ICON.lock}</span><span class="hold-txt"><span class="ht-a">Hold to remove</span><span class="ht-b" aria-hidden="true">Keep holding…</span></span></span></button></div>`
            : `<p class="wt-q">Remove this checkout? Nothing would be lost.</p>${err}<div class="set-fa"><button type="button" class="btn" data-wt-no${waits(pk)}>Keep it</button><button type="button" class="btn btn-danger" data-wt-yes="${esc(key)}"${busyAttrs(pk)}>Remove</button></div>`}</div>` : "") + `</li>`;
      }).join("")}</ul></section>`).join("") : `<p class="set-note">No worktrees right now.</p>`) +
      (R.reported.length ? `<section class="set-sec" data-key="wt-reported"><h3>Made by an agent's own tool</h3><p class="set-lead">XO didn't create these, so it never removes them.</p><ul class="wt-list">${R.reported.map((w) => `<li class="wt-row" data-key="rep:${esc(w.path)}"><div class="wt-main"><code>${esc(w.path)}</code><span class="wt-s">reported ${esc(when(w.reported_at))}</span></div></li>`).join("")}</ul></section>` : "");
  }
  function askTree(key, from) {
    const w = (R.trees || []).find((x) => treeKey(x) === key);
    R.err.wt = null;
    // nothing to lose: one question first; work to lose: the server says exactly what (below), then a hold
    if (w && !w.would_lose) { R.confirm = { wt: key }; renderTrees(); focusTo("worktrees", "[data-wt-no]"); return; }
    removeTree(key, null, from);
  }
  async function removeTree(key, confirm, from) {
    const [chat, ts] = key.split("/");
    const next = neighbour(from, ".wt-row", "data-wt");
    if (!isPending(`wt:${key}`)) R.err.wt = null;
    await pend(`wt:${key}`, "worktrees", renderTrees, async () => {
      try {
        const res = await api.removeWorktree(chat, ts, confirm);
        R.confirm = null;
        R.trees = R.trees.filter((w) => treeKey(w) !== key);
        announce(res && res.forced ? "Removed. The work in it is gone." : "Removed. Nothing was lost.");
        loadTrees();
        return { to: next && sel("data-wt", next) }; // its row goes: the next row's Remove
      } catch (err) {
        // it would lose work: the server's list of it, and the hold, asked in place of the Remove button, on Keep it
        if (err.code === "would_lose_work") { R.confirm = { wt: key, lose: err.what, token: err.confirm }; return { to: "[data-wt-no]" }; }
        R.err.wt = { key, text: err.code === "session_busy" ? "Its agent is still using it. Stop the thread, or try again once it has gone quiet." : err.message };
        return {};
      }
    }, from);
  }

  // while the Routing page is open, show what the stream changed (never mid-form or mid-question)
  if (world.subscribe) world.subscribe(() => {
    const page = box("routing")?.closest("[data-page]");
    if (!R.router || R.form || (R.confirm && R.confirm.dm) || !page || page.hidden || document.querySelector("#settings").hidden) return;
    const sig = routingSig();
    if (sig !== routeSig) { routeSig = sig; renderRouting(); }
  });

  // ── events ──────────────────────────────────────────────────────────────
  const root = document.querySelector("#settings");
  // every choice group in Settings (Routing, Shape's presets, the usual runtime): arrows move, Space or Enter chooses,
  // since each choice sends a request or changes what XO shows; one listener for them all
  radioKeys(root, { follow: false });
  root.addEventListener("click", (e) => {
    const t = e.target;
    const rt = t.closest("[data-route]");
    if (rt && !rt.disabled) { setRoute(rt.dataset.route, rt.dataset.dm || null); return; }
    const on = t.closest("[data-dm-on]");
    if (on) { R.form = on.dataset.dmOn; R.err.dm = null; renderRouting(); focusTo("routing", `${sel("data-dm-form", R.form)} input[name="key"]`); return; }
    // Keep and Cancel wait while their question's answer is on its way: it can't be taken back by closing the question
    if (t.closest('[aria-disabled="true"]')) return;
    if (t.closest("[data-dm-cancel]")) { const id = R.form; R.form = null; R.err.dm = null; renderRouting(); focusTo("routing", sel("data-dm-on", id)); return; }
    const off = t.closest("[data-dm-off]");
    if (off) { R.err.dmOff = null; R.confirm = { dm: off.dataset.dmOff, chats: world.state.projects.filter((p) => p.routing && p.routing.decision_model === off.dataset.dmOff).map((p) => p.id) }; renderRouting(); focusTo("routing", "[data-dm-no]"); return; }
    if (t.closest("[data-dm-no]")) { const id = R.confirm && R.confirm.dm; R.confirm = null; R.err.dmOff = null; renderRouting(); focusTo("routing", id && sel("data-dm-off", id)); return; }
    const yes = t.closest("[data-dm-yes]");
    if (yes) { disconnect(yes.dataset.dmYes, yes); return; }
    const ov = t.closest("[data-ov-clear]");
    if (ov) { clearOverride(ov.dataset.ovClear, ov); return; }
    const ro = t.closest("[data-rule-off]");
    if (ro) { R.confirm = { rule: ro.dataset.ruleOff }; R.err.rule = null; renderRules(); focusTo("rules", "[data-rule-no]"); return; }
    if (t.closest("[data-rule-no]")) { const id = R.confirm && R.confirm.rule; R.confirm = null; R.err.rule = null; renderRules(); focusTo("rules", id && sel("data-rule-off", id)); return; }
    const ry = t.closest("[data-rule-yes]");
    if (ry) { revoke(ry.dataset.ruleYes, ry); return; }
    const wt = t.closest("[data-wt]");
    if (wt && !wt.disabled) { askTree(wt.dataset.wt, wt); return; }
    if (t.closest("[data-wt-no]")) { const k = R.confirm && R.confirm.wt; R.confirm = null; R.err.wt = null; renderTrees(); focusTo("worktrees", k && sel("data-wt", k)); return; }
    const wy = t.closest("[data-wt-yes]");
    if (wy) { removeTree(wy.dataset.wtYes, null, wy); return; }
  });
  root.addEventListener("change", (e) => {
    // the confidence: the same router setting, sent whole; the select stays the same node under the keyboard
    if (e.target.closest("[data-abstain]")) { const r = world.state.router || R.router; setRoute(r.mode, r.decision_model, +e.target.closest("[data-abstain]").value); }
  });
  root.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-dm-form]");
    if (!f) return;
    e.preventDefault();
    connect(f, document.activeElement);
  });

  return {
    /** A page was opened: read what it shows. */
    open(id) {
      if (id === "routing") loadRouting();
      else if (id === "rules") loadRules();
      else if (id === "worktrees") loadTrees();
    },
  };
}
