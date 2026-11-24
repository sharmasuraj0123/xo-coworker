// @ts-check

import * as K from "../../core/platform/keys.js";
import { esc } from "../../core/platform/index.js";
import { mainRuntime } from "../../core/services/world/sessions.js";
import { rtName, rtMark, usable, allowedOf, moveTargets, findRt, healthOf, manyRuntimes } from "../../core/services/runtimes.js";
import { EFFORT_WORD } from "./effort.js";
import { createModelCatalog } from "./intel-model-catalog.js";

/** @import { CatalogOptions, IntelChat, IntelCurrent, IntelModel, IntelState } from "./intel-types.js" */

/** @param {string | null | undefined} e */
const effortWord = (e) => (e ? EFFORT_WORD[e] || e : "");

/** @param {IntelState} P @param {CatalogOptions} options */
export function createIntelCatalog(P, { world, PROJ, simple }) {
  const { models: catalogs, read: catalog, warm } = createModelCatalog(() => world.state.runtimes || []);

  /** @param {string} s */
  const kindOf = (s) => (s === "ws" ? "workspace" : String(s || "").startsWith("p:") ? "project" : String(s || "").startsWith("t:") ? "thread" : null);
  /** @param {string} s */
  const scopeWord = (s) => (s === "ws" ? "the Workspace" : s.startsWith("p:") ? `${PROJ(s.slice(2))}'s coordinator` : "this thread");
  /** @param {string} s */
  const chatOfSession = (s) => world.project(s === "ws" ? "workspace" : s.slice(2));
  /** @param {string} s */
  const threadOf = (s) => s.startsWith("t:") ? world.thread(s.slice(2)) ?? null : null;
  /** @param {string} s */
  const runtimeOf = (s) => {
    const t = threadOf(s);
    const c = t ? null : chatOfSession(s) || (/** @type {Partial<IntelChat>} */ ({}));
    // a thread: its session's agent; a chat: its pin, else its coordinator's own session
    const agent = t ? (t.session && t.session.agent) : (/** @type {Partial<IntelChat>} */ (c)).pin?.agent || (world.act.coordinatorAgent ? world.act.coordinatorAgent((/** @type {Partial<IntelChat>} */ (c)).chatId) : null);
    const rts = world.state.runtimes || [];
    return (rts.find((r) => r.name === agent) || mainRuntime(rts) || {}).name || null;
  };

  /** @param {IntelModel | null | undefined} m @param {string} s @param {string | null} [name] */
  const effortsOf = (m, s, name = runtimeOf(s)) => {
    if (!m || !m.takes_effort) return [];
    if (m.efforts && m.efforts.length) return m.efforts;
    const rt = (world.state.runtimes || []).find((r) => r.name === name);
    const f = rt && rt.features && rt.features.features && rt.features.features.effort;
    return f && f.support !== "unsupported" && Array.isArray(f.values) ? f.values : [];
  };
  /** @param {string | null | undefined} id */
  const modelOf = (id) => (P.models || []).find((x) => x.id === id) || null;
  /** @param {string | null | undefined} id */
  const nameOf = (id) => { for (const list of catalogs.values()) { const m = list.find((x) => x.id === id); if (m) return m.name; } return id; };

  /** What a conversation runs on now: {pinned, model, effort, routing, by}. @param {string} s @returns {IntelCurrent} */
  function current(s) {
    const t = threadOf(s);
    if (t) {
      const pin = t.pin || {};
      const se = t.session || {};
      return { pinned: !!(pin.model || pin.effort), model: pin.model || se.model || null, effort: pin.effort || se.effort || null, routing: null, by: "the router" };
    }
    const c = chatOfSession(s) || (/** @type {Partial<IntelChat>} */ ({}));
    const pin = c.pin || {};
    const space = world.state.router || { mode: "agent" };
    const own = c.routing && c.routing.mode ? c.routing : null;
    const r = own || space;
    return { pinned: !!(pin.model || pin.effort), model: pin.model || null, effort: pin.effort || null, routing: r, ownRouting: !!own, by: r.mode === "decision" ? r.decision_model ?? undefined : "coordinator" };
  }

  /** What a thread's session is running right now (the router's choice or a pin it already took). @param {string} s */
  const running = (s) => { const t = threadOf(s); const se = (t && t.session) || {}; return t ? { model: se.model || null, effort: se.effort || null, working: t.state === "working" } : null; };
  /** @param {string} s */
  function shownSetting(s) {
    const c = current(s), r = running(s);
    // A pin is labeled as next when the session has not reported its model.
    if (r) return r.model ? { model: r.model, effort: r.effort || null, next: false } : c.model ? { model: c.model, effort: c.effort, next: true } : { model: null, effort: r.effort || c.effort || null, next: false };
    return c.pinned ? { model: c.model, effort: c.effort, next: false } : { model: null, effort: null, next: false };
  }
  /** @param {string} s */
  const live = (s) => !!kindOf(s) && (kindOf(s) !== "thread" || !!threadOf(s));
  /** @param {string} s */
  function pendingOf(s) {
    const c = current(s), r = running(s);
    if (!r || !r.model || !c.pinned) return null;
    const model = c.model || r.model, effort = c.effort || r.effort || null;
    if (model === r.model && (effort || null) === (r.effort || null)) return null;
    return { model, effort, words: `${nameOf(model)}${effort ? ` · ${effortWord(effort)}` : ""}` };
  }
  /** @param {string} s @param {boolean} [phone] */
  function chipHtml(s, phone) {
    if (!live(s)) return "";
    const c = current(s);
    const mark = rtMark((/** @type {string} */ (runtimeOf(s))), { lead: true }) || "";
    if (simple() && !phone && !threadOf(s)) { const w = simpleOf(s, c); return `<span class="iq-l">${mark}<span class="${w === "auto" ? "iq-a" : "iq-t"}">${esc(w === "auto" ? "Auto" : w === "deep" ? "Deep" : nameOf(c.model) || "Pinned")}</span></span>`; }
    const { model, effort, next } = shownSetting(s);
    const rtn = runtimeOf(s), main = (mainRuntime(world.state.runtimes) || {}).name;
    // a runtime without a mark is named only where it differs from the usual one
    const rt = !mark && manyRuntimes(world.state.runtimes) && rtn && rtn !== main && !phone ? rtName(rtn) : null;
    const words = [];
    if (rt) words.push(`<span class="iq-a">${esc(rt)}</span>`);
    if (next) words.push(`<span class="iq-a">Next turn</span>`);
    // a thread never runs on Auto: a session that names no model runs its runtime's default
    words.push(model ? `<span class="iq-t">${esc(nameOf(model))}</span>` : threadOf(s) ? `<span class="iq-a">Default</span>` : `<span class="iq-a">Auto</span>`);
    if (effort) words.push(`<span class="iq-e">${esc(effortWord(effort))}</span>`);
    const p = !next ? pendingOf(s) : null;
    const now = words.join(`<span class="iq-sep" aria-hidden="true">·</span>`);
    // Keep the pending setting visible at every width.
    if (p) return `<span class="iq-l is-pending"><span class="iq-cur">${mark}${now}</span><span class="iq-next"><span class="iq-nk">Next</span><span class="iq-nw">${esc(p.words)}</span></span></span>`;
    return `<span class="iq-l">${mark}${now}</span>`;
  }

  /** @param {string} s */
  function chipTitle(s) {
    if (!live(s)) return "";
    const c = current(s);
    if (kindOf(s) === "thread") {
      const r = (/** @type {NonNullable<ReturnType<typeof running>>} */ (running(s))), { model, effort, next } = shownSetting(s);
      const what = `${model ? nameOf(model) : "its default model"}${effort ? ` · ${effortWord(effort)}` : ""}`;
      if (next) return `Its session hasn't reported which model it runs. From its next turn: ${what}. Change it${K.hint("intel")}`;
      if (!r.model) return `Its session names no model, so it runs its runtime's default${effort ? ` · ${effortWord(effort)}` : ""}. Change it${K.hint("intel")}`;
      const p = pendingOf(s);
      return `${r.working ? "Running" : "Runs"} ${what}${p ? `; next turn: ${p.words}` : ""}. Change it${K.hint("intel")}`;
    }
    const r = c.routing || {};
    return `${c.pinned ? `Its coordinator runs ${nameOf(c.model)}${c.effort ? ` · ${effortWord(c.effort)}` : ""}` : "Auto: its coordinator runs its default model"}; ${r.mode === "off" ? "routing is off" : r.mode === "decision" ? `${cap(r.decision_model)} routes new messages` : "the coordinator routes new messages"}. Change it${K.hint("intel")}`;
  }
  /** @param {string | null | undefined} x */
  const cap = (x) => String(x || "").replace(/^\w/, (m) => m.toUpperCase());

  const rts = () => world.state.runtimes || [];
  /** @param {Partial<IntelChat> | null} c */
  const chatPolicy = (c) => {
    if (!c || !c.chatId) return null;
    const own = world.state.chatPolicy && world.state.chatPolicy[c.chatId];
    if (!own) world.act.loadChatPolicy?.(c.chatId);
    return own || null;
  };
  const spaceEff = () => (world.state.policy && world.state.policy.effective) || null;
  /** The runtimes offered here, which one is on, and whether there is a choice at all. @param {string} s */
  function runtimeChoice(s) {
    const t = threadOf(s);
    if (t) {
      const cur = (t.session && t.session.agent) || runtimeOf(s);
      const eff = (world.act.policyFor && world.act.policyFor(t.project)) || spaceEff();
      const others = eff ? moveTargets(cur, eff, rts()).filter((x) => !x.own) : [];
      const list = [{ id: cur, label: rtName(cur), usable: true, why: "" },
        ...others.map((x) => ({ id: x.name, label: rtName(x.name), usable: x.usable && !t.movedTo, why: t.movedTo ? "This thread has already continued in another thread." : x.why }))];
      return { list, on: cur, multi: list.length > 1 };
    }
    const c = chatOfSession(s) || (/** @type {Partial<IntelChat>} */ ({}));
    const kind = kindOf(s);
    const eff = (kind === "project" && (chatPolicy(c) || {}).effective) || spaceEff();
    const list = allowedOf(eff, rts()).map((n) => { const rt = findRt(rts(), n); const h = healthOf(rt); return { id: n, label: rtName(n), usable: usable(rt), why: usable(rt) ? "" : h.why || h.word }; });
    if (kind === "project" && chatPolicy(c)) {
      const own = (/** @type {NonNullable<ReturnType<typeof chatPolicy>>} */ (chatPolicy(c))).project || {};
      return { list: [{ id: "auto", label: "Auto", usable: true, why: "" }, ...list], on: own.default || (c.pin && c.pin.agent) || "auto", multi: list.length > 1 };
    }
    return { list, on: runtimeOf(s), multi: list.length > 1 };
  }
  /** @param {string} s */
  const moving = (s) => !!(threadOf(s) && P.rt && P.rt !== runtimeChoice(s).on);

  /** @param {IntelModel[] | null} models */
  const shown = (models) => (models || []).filter((m) => !m.is_default && (m.family_default || !m.family));

  /** @type {Set<string | null>} */
  const DEEP = new Set(["high", "xhigh", "max"]);
  /** @param {string | null | undefined} id */
  const isDefaultModel = (id) => !id || id === "default" || [...catalogs.values()].some((l) => l.some((m) => m.id === id && m.is_default));
  /** Which of the two a conversation is on: "auto", "deep", or null (a model picked in More options). @param {string} s */
  function simpleOf(s, c = current(s)) {
    if (c.pinned && DEEP.has(c.effort)) return "deep";
    return !c.pinned || isDefaultModel(c.model) ? "auto" : null;
  }
  /** Deep: the model it runs on (else the default) thinking longer; the first model that can, if that one can't. @param {string} s */
  function deepPick(s) {
    const c = current(s);
    const cands = [modelOf(c.model), (P.models || []).find((m) => m.is_default), ...shown(P.models)].filter(Boolean);
    for (const m of cands) { const ef = effortsOf(m, s); if (ef.includes("high")) return { model: (/** @type {IntelModel} */ (m)).id, effort: "high" }; }
    return null;
  }
  return {
    kindOf, scopeWord, chatOfSession, threadOf, runtimeOf, catalogs, catalog, warm, modelOf, nameOf, current,
    running, live, chipHtml, chipTitle, cap, chatPolicy, runtimeChoice, moving, effortsOf, deepPick,
    shown, simpleOf, pendingOf, effortWord,
  };
}
