// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { esc } from "../../core/platform/util.js";
import { isPending, busyAttrs } from "../../core/platform/index.js";
import { rovingTab } from "../../core/ui/a11y/keynav.js";
import { createRoutingActions } from "./actions.js";
import { DEFAULT_ABSTAIN, PAGE, ROUTER } from "./constants.js";
import { createRoutingData } from "./data.js";

/** @import {DecisionModel, RoutingHost, RoutingOptions, RoutingProject, RoutingState} from "./types" */

const PCT = [DEFAULT_ABSTAIN, 0.6, 0.7, 0.8, 0.9];
const CONFIDENCE_EQUAL = 0.001;
/** The confidence choices, always including the server's own value. @param {number} v */
const pcts = (v) => (PCT.some((p) => Math.abs(p - v) < CONFIDENCE_EQUAL) || !(v >= 0 && v <= 1) ? PCT : [...PCT, v].sort((a, b) => a - b));

/** @param {RoutingState} R @param {RoutingOptions["world"]["state"]} world @param {RoutingHost} host @param {RoutingOptions["PROJ"]} PROJ */
function routingHtml(R, world, { errHtml, waits }, PROJ) {
    if (R.err.routing && !R.router) return `<p class="set-empty"><b>Couldn't read the routing.</b> ${esc(R.err.routing)}</p>`;
    if (!R.router) return `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`;
    const r = world.router || R.router;
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
    const overrides = world.projects.filter((p) => p.routing?.mode);
    const orphans = overrides.filter((p) => p.routing?.mode === "decision"
      && !R.models.find((m) => m.id === p.routing?.decision_model)?.connected);
    const ab = r.abstain_below ?? DEFAULT_ABSTAIN;
    return `<section class="set-sec" aria-labelledby="rt-h"><h3 id="rt-h">Who routes a new message</h3>` +
      `<p class="set-lead">When you write to the Workspace or a project, this decides where it goes. A reply inside a thread always goes straight to its agent.</p>` +
      `<div class="set-choices" role="radiogroup" aria-labelledby="rt-h">` +
      opt("agent", null, "The coordinator", "Reads your message and decides itself: answer, forward, or start a thread.") +
      R.models.map((m) => opt("decision", m.id, m.label, m.connected ? `A decision model routes it; when it isn't sure, the coordinator decides.` : "Connect it below to use it.", !m.connected)).join("") +
      opt("off", null, "Off", "Chats using this setting refuse new messages; one with its own routing keeps it. Replies inside threads still work.") +
      `</div>` +
      (r.mode === "decision" ? `<div class="set-row is-sub"><div class="set-l"><b>When it isn't sure</b><span>Below this confidence, the coordinator decides instead.</span></div><xo-select class="set-sel" data-abstain aria-label="Confidence needed"${busy}>${pcts(ab).map((p) => `<option value="${p}"${Math.abs(ab - p) < CONFIDENCE_EQUAL ? " selected" : ""}>${Math.round(p * 100)}% sure</option>`).join("")}</xo-select></div>` : "") +
      errHtml(R.err.route) +
      [...new Set(orphans.map((p) => p.routing?.decision_model))].map((id) => {
        const chats = orphans.filter((p) => p.routing?.decision_model === id).map((p) => p.name), one = chats.length === 1;
        const label = R.models.find((m) => m.id === id)?.label || id;
        return `<p class="set-err" data-orphans>${esc(label)} isn't connected, and ${esc(chats.length > 1 ? chats.slice(0, -1).join(", ") + " and " + chats.at(-1) : chats[0])} still ${one ? "names" : "name"} it: use the Space's routing for ${one ? "it" : "them"} below.</p>`;
      }).join("") +
      `</section>` +
      `<section class="set-sec" aria-labelledby="dm-h"><h3 id="dm-h">Decision models</h3>` +
      `<p class="set-lead">A small model that routes quickly. Its key is saved on this machine and never shown again.</p>` +
      R.models.map(modelHtml).join("") + `</section>` +
      (overrides.length ? `<section class="set-sec" aria-labelledby="ov-h"><h3 id="ov-h">Chats with their own routing</h3>` +
        overrides.map(overrideHtml).join("") + `</section>` : "");
  /** @param {RoutingProject} project */
  function overrideHtml({ chatId, name, routing }) {
    const id = routing?.decision_model;
    const label = R.models.find((model) => model.id === id)?.label || id;
    const mode = routing?.mode;
    const text = mode === "decision" ? `Routed by ${esc(label)}` : mode === "agent" ? "Routed by its coordinator" : "Routing off";
    const error = R.err.ov?.chat === chatId ? errHtml(R.err.ov.text) : "";
    return `<div class="set-row" data-key="ov:${esc(chatId)}"><div class="set-l"><b>${esc(name)}</b><span>${text}</span>${error}</div>`
      + `<button type="button" class="btn" data-ov-clear="${esc(chatId)}"${busyAttrs(`ov:${chatId}`)}>Use the Space's</button></div>`;
  }
  /** @param {DecisionModel} m */
  function modelHtml(m) {
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
}

/** @param {RoutingHost} host @param {RoutingOptions} options */
export function createRoutingPage(host, options) {
  const { world, PROJ } = options;
  const scope = createScope();
  const { box, paint, focusTo, sel } = host;
  /** @type {RoutingState} */
  const R = { router: null, models: [], err: {}, form: null, confirm: null };

  function renderRouting() {
    if (scope.signal.aborted) return;
    routeSig = routingSig();
    paint(PAGE, routingHtml(R, world.state, host, PROJ));
    const select = box(PAGE)?.querySelector("[data-abstain]");
    const router = world.state.router || R.router;
    if (select && "value" in select && router && !isPending(ROUTER)) {
      const value = String(router.abstain_below ?? DEFAULT_ABSTAIN);
      if (select.value !== value) select.value = value;
    }
  }
  let routeSig = "";
  const routingSig = () => JSON.stringify([world.state.router, world.state.projects.map((project) => [project.id, project.routing])]);
  const data = createRoutingData(R, scope.signal, renderRouting);
  const { setRoute, connect, disconnect, clearOverride } = createRoutingActions(R, host, options, { ...data, render: renderRouting });

  scope.effect(() => world.subscribe?.(() => {
    const page = box(PAGE)?.closest("[data-page]");
    const settings = document.getElementById("settings");
    if (!R.router || R.form || R.confirm || !page || page.hasAttribute("hidden") || settings?.hidden) return;
    const sig = routingSig();
    if (sig !== routeSig) { routeSig = sig; renderRouting(); }
  }));

  return {
    open: data.open,
    dispose: scope.dispose,
    /** @param {Element} target */
    clickFirst(target) {
      if (scope.signal.aborted) return false;
      const route = target.closest("[data-route]");
      const mode = route?.getAttribute("data-route");
      if (route && mode && !route.hasAttribute("disabled")) {
        void setRoute(mode, route.getAttribute("data-dm"));
        return true;
      }
      const model = target.closest("[data-dm-on]")?.getAttribute("data-dm-on");
      if (model) {
        R.form = model;
        R.err.dm = null;
        renderRouting();
        focusTo(PAGE, `${sel("data-dm-form", model)} input[name="key"]`);
        return true;
      }
      return false;
    },
    /** @param {Element} target */
    click(target) {
      if (scope.signal.aborted) return false;
      if (target.closest("[data-dm-cancel]")) {
        const id = R.form;
        R.form = null;
        R.err.dm = null;
        renderRouting();
        focusTo(PAGE, id && sel("data-dm-on", id));
        return true;
      }
      const off = target.closest("[data-dm-off]")?.getAttribute("data-dm-off");
      if (off) {
        R.err.dmOff = null;
        const chats = world.state.projects.filter((project) => project.routing?.decision_model === off).map((project) => project.id);
        R.confirm = { dm: off, chats };
        renderRouting();
        focusTo(PAGE, "[data-dm-no]");
        return true;
      }
      if (target.closest("[data-dm-no]")) {
        const id = R.confirm?.dm ?? null;
        R.confirm = null;
        R.err.dmOff = null;
        renderRouting();
        focusTo(PAGE, id && sel("data-dm-off", id));
        return true;
      }
      const yes = target.closest("[data-dm-yes]");
      const model = yes?.getAttribute("data-dm-yes");
      if (yes && model) { void disconnect(model, yes); return true; }
      const override = target.closest("[data-ov-clear]");
      const chat = override?.getAttribute("data-ov-clear");
      if (override && chat) { void clearOverride(chat, override); return true; }
      return false;
    },
    /** @param {Element} target */
    change(target) {
      if (scope.signal.aborted) return;
      const select = target.closest("[data-abstain]");
      const router = world.state.router || R.router;
      if (select && "value" in select && router?.mode) {
        void setRoute(router.mode, router.decision_model ?? null, Number(select.value));
      }
    },
    /** @param {Event} e */
    submit(e) {
      if (scope.signal.aborted) return;
      const f = e.target instanceof Element && e.target.closest("[data-dm-form]");
      if (!f) return;
      e.preventDefault();
      void connect(f, document.activeElement);
    },
  };
}
