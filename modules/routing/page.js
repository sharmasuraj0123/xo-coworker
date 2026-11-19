// @ts-check

// Settings › Routing: who routes a new message, the decision models and their keys, and chats with their own routing.

import { api } from "../../core/platform/api.js";
import { esc } from "../../js/world.js";
import { isPending, busyAttrs } from "../../core/platform/index.js";
import { rovingTab } from "../../core/ui/a11y/keynav.js";

const PCT = [0.5, 0.6, 0.7, 0.8, 0.9];
/** The confidence choices, always including the server's own value. @param {number} v */
const pcts = (v) => (PCT.some((p) => Math.abs(p - v) < 0.001) || !(v >= 0 && v <= 1) ? PCT : [...PCT, v].sort((a, b) => a - b));
// one router setting: a choice and its confidence are sent one at a time
const ROUTER = "router";

/** @param {import("./types").SettingsHost} host @param {import("./types").PageDeps} deps */
export function createRoutingPage(host, { world, announce, PROJ, onChange }) {
  const { R, box, paint, focusTo, pend, sel, errHtml, waits } = host;

  async function loadRouting() {
    try { const [r, m] = await Promise.all([api.router(), api.routerModels()]); R.router = r; R.models = m.models || []; R.err.routing = null; }
    catch (/** @type {any} */ err) { R.err.routing = err.message; }
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
    /** @param {string} mode @param {string | null} dm @param {string} title @param {string} sub */
    const opt = (mode, dm, title, sub, disabled = false) => {
      const on = r.mode === mode && (mode !== "decision" || r.decision_model === dm);
      const tab = disabled ? "" : rovingTab(on, first);
      if (!disabled) first = false;
      return `<button type="button" class="set-choice${on ? " is-on" : ""}" role="radio" aria-checked="${on}" data-route="${mode}"${dm ? ` data-dm="${esc(dm)}"` : ""}${disabled ? " disabled" : `${tab}${busy}`}><span class="sc-dot" aria-hidden="true"></span><span class="sc-b"><b>${esc(title)}</b><span>${esc(sub)}</span></span></button>`;
    };
    const overrides = /** @type {any[]} */ (world.state.projects.filter((/** @type {any} */ p) => p.routing && p.routing.mode));
    // chats naming a decision model that isn't connected: said from the routing as it is, never from an action's flag
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
      // said per model: "Levanto Sage isn't connected, and demo still names it: use the Space's routing for it below"
      [...new Set(orphans.map((p) => p.routing.decision_model))].map((id) => {
        const chats = orphans.filter((p) => p.routing.decision_model === id).map((p) => p.name), one = chats.length === 1;
        const label = (R.models.find((m) => m.id === id) || {}).label || id;
        return `<p class="set-err" data-orphans>${esc(label)} isn't connected, and ${esc(chats.length > 1 ? chats.slice(0, -1).join(", ") + " and " + chats.at(-1) : chats[0])} still ${one ? "names" : "name"} it: use the Space's routing for ${one ? "it" : "them"} below.</p>`;
      }).join("") +
      `</section>` +
      `<section class="set-sec" aria-labelledby="dm-h"><h3 id="dm-h">Decision models</h3>` +
      `<p class="set-lead">A small model that routes quickly. Its key is saved on this machine and never shown again.</p>` +
      R.models.map((m) => modelHtml(m, r)).join("") + `</section>` +
      (overrides.length ? `<section class="set-sec" aria-labelledby="ov-h"><h3 id="ov-h">Chats with their own routing</h3>` +
        overrides.map((p) => `<div class="set-row" data-key="ov:${esc(p.chatId)}"><div class="set-l"><b>${esc(p.name)}</b><span>${p.routing.mode === "decision" ? `Routed by ${esc((R.models.find((m) => m.id === p.routing.decision_model) || {}).label || p.routing.decision_model)}` : p.routing.mode === "agent" ? "Routed by its coordinator" : "Routing off"}</span>${R.err.ov && R.err.ov.chat === p.chatId ? errHtml(R.err.ov.text) : ""}</div><button type="button" class="btn" data-ov-clear="${esc(p.chatId)}"${busyAttrs(`ov:${p.chatId}`)}>Use the Space's</button></div>`).join("") + `</section>` : "");
  }
  /** @param {any} m @param {any} r */
  function modelHtml(m, r) {
    const f = R.form === m.id, c = R.confirm && R.confirm.dm === m.id ? R.confirm : null;
    const n = c ? c.chats.length : 0;
    return `<div class="set-row dm${m.connected ? " is-on" : ""}" data-key="dm:${esc(m.id)}"><div class="set-l"><b>${esc(m.label)}</b><span>${m.connected ? `Connected · model ${esc(m.model)}` : "Not connected"}${m.docs_url ? ` · <a href="${esc(m.docs_url)}" target="_blank" rel="noopener noreferrer">about it</a>` : ""}</span></div>` +
      (m.connected ? (c ? "" : `<button type="button" class="btn" data-dm-off="${esc(m.id)}">Disconnect</button>`) : f ? "" : `<button type="button" class="btn btn-pri" data-dm-on="${esc(m.id)}">Connect</button>`) + `</div>` +
      (f ? `<form class="set-form" data-dm-form="${esc(m.id)}" autocomplete="off"><label class="field"><span>API key</span><input type="password" name="key" required autocomplete="new-password" spellcheck="false" placeholder="Paste the key"></label>` +
        `<label class="field"><span>Model <em>optional</em></span><input name="model" placeholder="${esc(m.model || "")}" spellcheck="false"></label>` +
        errHtml(R.err.dm) +
        `<div class="set-fa"><button type="button" class="btn" data-dm-cancel${waits(`dm-on:${m.id}`)}>Cancel</button><button type="submit" class="btn btn-pri" data-dm-submit${busyAttrs(`dm-on:${m.id}`)}>Connect</button></div></form>` : "") +
      (c ? `<div class="set-confirm" role="alertdialog" aria-labelledby="dmc-${esc(m.id)}"><p id="dmc-${esc(m.id)}"><b>Disconnect ${esc(m.label)}?</b> Its key is removed from this machine.${r.mode === "decision" && r.decision_model === m.id ? " Routing goes back to the coordinator." : ""}${n ? ` ${n} ${n === 1 ? "chat routes" : "chats route"} with it (${c.chats.map((/** @type {string} */ x) => esc(PROJ(x))).join(", ")}); they go back to the Space's routing too.` : ""}</p>` +
        errHtml(R.err.dmOff) +
        `<div class="set-fa"><button type="button" class="btn" data-dm-no${waits(`dm-off:${m.id}`)}>Keep it</button><button type="button" class="btn btn-danger" data-dm-yes="${esc(m.id)}"${busyAttrs(`dm-off:${m.id}`)}>Disconnect</button></div></div>` : "");
  }
  // what the Routing page shows, so a change from the stream (another tab, a chat's own routing) re-renders it
  let routeSig = "";
  const routingSig = () => JSON.stringify([world.state.router, world.state.projects.map((/** @type {any} */ p) => [p.id, p.routing])]);
  /** @param {string} mode @param {string | null} dm @param {number} [abstain] */
  async function setRoute(mode, dm, abstain) {
    const r = world.state.router || R.router || {};
    // choosing what is already chosen changes nothing (the PUT is a full replace)
    if (abstain == null && r.mode === mode && (mode !== "decision" || r.decision_model === dm)) return;
    if (!isPending(ROUTER)) R.err.route = null;
    await pend(ROUTER, "routing", renderRouting, async () => {
      try {
        // a full replace: abstain_below is sent every time, or it resets
        R.router = await api.setRouter({ mode, ...(mode === "decision" ? { decision_model: dm } : {}), abstain_below: abstain ?? r.abstain_below ?? 0.5 });
        world.state.router = R.router;
        announce(mode === "off" ? "Routing is off." : mode === "agent" ? "The coordinator routes new messages." : `${(R.models.find((m) => m.id === dm) || {}).label || dm} routes new messages.`);
        onChange();
      } catch (/** @type {any} */ err) { R.err.route = err.message; }
    });
  }
  /** @param {any} f @param {Element | null} from */
  async function connect(f, from) {
    const id = f.dataset.dmForm, key = f.key.value.trim(), model = f.model.value.trim();
    if (isPending(`dm-on:${id}`)) return;
    if (!key) { R.err.dm = "Paste the key first."; renderRouting(); f.key.focus(); return; }
    R.err.dm = null;
    await pend(`dm-on:${id}`, "routing", renderRouting, async () => {
      try { R.models = (await api.connectRouterModel({ provider: id, ...(model ? { model } : {}), api_key: key })).models || R.models; }
      catch (/** @type {any} */ err) {
        // a malformed key goes, and the keyboard with it; after any other failure the key stays for the retry
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
  /** @param {string} id @param {Element | null} from */
  async function disconnect(id, from) {
    R.err.dmOff = null;
    await pend(`dm-off:${id}`, "routing", renderRouting, async () => {
      const chats = R.confirm && R.confirm.dm === id ? R.confirm.chats : [];
      try { R.models = (await api.disconnectRouterModel(id)).models || R.models; }
      catch (/** @type {any} */ err) { R.err.dmOff = err.message; return {}; }
      // the server resets only the Space setting; chats that named it are cleared here
      const left = [];
      for (const c of chats) {
        const p = world.project(c);
        if (!p) continue;
        try { const x = await api.patchChat(p.chatId, { routing: null }); p.routing = (x && x.routing) || null; }
        catch { left.push(PROJ(c)); }
      }
      try { R.router = await api.router(); world.state.router = R.router; } catch { /* the stream brings it */ }
      // a chat whose PATCH failed still names it: the page says so from the routing itself, and here, once, aloud
      announce(`Disconnected. Its key is removed.${left.length ? ` ${left.join(", ")} still ${left.length === 1 ? "names" : "name"} it: use the Space's routing for ${left.length === 1 ? "it" : "them"}.` : ""}`);
      onChange();
      R.confirm = null; // the question goes: the keyboard goes to the model's Connect
      return { to: sel("data-dm-on", id) };
    }, from);
  }
  /** @param {string} chat @param {Element | null} from */
  async function clearOverride(chat, from) {
    const next = host.neighbour(from, ".set-row", "data-ov-clear");
    if (!isPending(`ov:${chat}`)) R.err.ov = null;
    await pend(`ov:${chat}`, "routing", renderRouting, async () => {
      try {
        const c = await api.patchChat(chat, { routing: null });
        const p = world.state.projects.find((/** @type {any} */ x) => x.chatId === chat);
        if (p) p.routing = (c && c.routing) || null;
        announce("It uses the Space's routing again.");
        onChange();
        // its row goes: the next chat's button, else the Space's own choice
        return { to: next ? sel("data-ov-clear", next) : '[data-route][aria-checked="true"]' };
      } catch (/** @type {any} */ err) { R.err.ov = { chat, text: err.message }; return {}; }
    }, from);
  }

  // while the Routing page is open, show what the stream changed (never mid-form or mid-question)
  if (world.subscribe) world.subscribe(() => {
    const page = box("routing")?.closest("[data-page]");
    if (!R.router || R.form || (R.confirm && R.confirm.dm) || !page || page.hidden || /** @type {HTMLElement} */ (document.querySelector("#settings")).hidden) return;
    const sig = routingSig();
    if (sig !== routeSig) { routeSig = sig; renderRouting(); }
  });

  return {
    open: loadRouting,
    /** The presses Settings answers before its waiting-question guard. @param {any} t @returns {boolean} */
    clickFirst(t) {
      const rt = t.closest("[data-route]");
      if (rt && !rt.disabled) { setRoute(rt.dataset.route, rt.dataset.dm || null); return true; }
      const on = t.closest("[data-dm-on]");
      if (on) { R.form = on.dataset.dmOn; R.err.dm = null; renderRouting(); focusTo("routing", `${sel("data-dm-form", /** @type {string} */ (R.form))} input[name="key"]`); return true; }
      return false;
    },
    /** @param {any} t @returns {boolean} */
    click(t) {
      if (t.closest("[data-dm-cancel]")) { const id = R.form; R.form = null; R.err.dm = null; renderRouting(); focusTo("routing", sel("data-dm-on", /** @type {string} */ (id))); return true; }
      const off = t.closest("[data-dm-off]");
      if (off) { R.err.dmOff = null; R.confirm = { dm: off.dataset.dmOff, chats: world.state.projects.filter((/** @type {any} */ p) => p.routing && p.routing.decision_model === off.dataset.dmOff).map((/** @type {any} */ p) => p.id) }; renderRouting(); focusTo("routing", "[data-dm-no]"); return true; }
      if (t.closest("[data-dm-no]")) { const id = R.confirm && R.confirm.dm; R.confirm = null; R.err.dmOff = null; renderRouting(); focusTo("routing", id && sel("data-dm-off", id)); return true; }
      const yes = t.closest("[data-dm-yes]");
      if (yes) { disconnect(yes.dataset.dmYes, yes); return true; }
      const ov = t.closest("[data-ov-clear]");
      if (ov) { clearOverride(ov.dataset.ovClear, ov); return true; }
      return false;
    },
    /** The confidence: the same router setting, sent whole. @param {any} target */
    change(target) {
      if (target.closest("[data-abstain]")) { const r = world.state.router || R.router; setRoute(r.mode, r.decision_model, +target.closest("[data-abstain]").value); }
    },
    /** @param {Event} e */
    submit(e) {
      const f = /** @type {any} */ (e.target).closest("[data-dm-form]");
      if (!f) return;
      e.preventDefault();
      connect(f, document.activeElement);
    },
  };
}
