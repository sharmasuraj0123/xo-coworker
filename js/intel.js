// Intelligence per session (R6), on storm. The chip says what a conversation runs on; the
// popover changes it. Everything comes from the server: the models and efforts from the runtime's
// catalog (GET /api/chat/runtimes/{name}/models: family, description, takes_effort), the routing from
// the Space setting and the chat's own override, the thread's model from its session. A change is a
// PATCH (the chat: routing, model, effort; a thread: intelligence) applied from the next turn, said
// back as one record line with a 3 s Undo. A thread never takes its chat's pin (§0.103).
//
//   Workspace, a project   the runtime it runs on (a project: Auto, or one runtime for its coordinator and
//                          its new threads), the coordinator's model and effort, who routes a new message
//   a thread               its runtime (fixed for life: another one continues it in a new thread, said
//                          first), its agent's model and effort (the router chose them; you can pin)
// One choice, in order: runtime, then model, then effort.

import * as K from "./keys.js";
import { esc } from "./world.js";
import { ICON, RM } from "./ui.js";
import { api } from "./api.js";
import { mainRuntime } from "./timeline.js";
import { rtName, usable, allowedOf, moveTargets, findRt, healthOf, manyRuntimes } from "./runtimes.js";

const EFFORT_WORD = { low: "Quick", medium: "Balanced", high: "Deep", xhigh: "Deeper", max: "Deepest" };
const PIPS = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 };
// what each depth means, said once under the control (the words are the setting; there are no dot codes)
const EFFORT_HINT = { low: "Answers fast. For quick, simple asks.", medium: "A sensible default for most work.", high: "Thinks longer before it acts. For hard problems.", xhigh: "Thinks much longer. Slower, for the hardest work.", max: "Thinks as long as it needs. The slowest and most thorough." };
const effortWord = (e) => (e ? EFFORT_WORD[e] || e : "");

// simple(): the person's shape asks for the simple choice (xo:composer/intel "simple"): the chip opens
// Auto · Deep first, and "More options" shows everything below, unchanged.
export function createIntel({ world, PROJ, onChange, record, onMoved, simple = () => false }) {
  const P = { open: false, session: null, anchor: null, returnTo: null, models: null, err: null, busy: false, rt: null, mv: null, full: false, draft: null, more: false };
  const movedHere = new Set(); // threads this tab continued elsewhere (their stream frame needs no second word)
  const catalogs = new Map(); // runtime → models
  const pop = document.getElementById("iq-pop");

  const kindOf = (s) => (s === "ws" ? "workspace" : s.startsWith("p:") ? "project" : "thread");
  const scopeWord = (s) => (s === "ws" ? "the Workspace" : s.startsWith("p:") ? `${PROJ(s.slice(2))}'s coordinator` : "this thread");
  const chatOfSession = (s) => world.project(s === "ws" ? "workspace" : s.slice(2));
  const threadOf = (s) => (s.startsWith("t:") ? world.thread(s.slice(2)) : null);
  const runtimeOf = (s) => {
    const t = threadOf(s);
    const c = t ? null : chatOfSession(s) || {};
    // a thread: its session's agent; a chat: its pin, else its coordinator's own session
    const agent = t ? (t.session && t.session.agent) : c.pin?.agent || (world.act.coordinatorAgent ? world.act.coordinatorAgent(c.chatId) : null);
    const rts = world.state.runtimes || [];
    return (rts.find((r) => r.name === agent) || mainRuntime(rts) || {}).name || null;
  };
  /** A runtime's models, read fresh each time the popover opens (the chip uses the last read). */
  async function catalog(name, { fresh = false } = {}) {
    if (!name) return [];
    if (catalogs.has(name) && !fresh) return catalogs.get(name);
    const d = await api.models(name);
    catalogs.set(name, d.models || []);
    return catalogs.get(name);
  }
  // the chip names models before the popover was ever opened: read the catalog once, quietly
  const reading = new Set();
  const warm = (s) => {
    const name = runtimeOf(s);
    if (!name || catalogs.has(name) || reading.has(name)) return;
    reading.add(name);
    catalog(name).then(() => onChange(), () => {}).finally(() => reading.delete(name));
  };
  /** The efforts a model takes: its own list, else the runtime's feature list (UI-reference §2.7). */
  const effortsOf = (m, s, name = runtimeOf(s)) => {
    if (!m || !m.takes_effort) return [];
    if (m.efforts && m.efforts.length) return m.efforts;
    const rt = (world.state.runtimes || []).find((r) => r.name === name);
    const f = rt && rt.features && rt.features.features && rt.features.features.effort;
    return f && f.support !== "unsupported" && Array.isArray(f.values) ? f.values : [];
  };
  const modelOf = (id) => (P.models || []).find((x) => x.id === id) || null;
  const nameOf = (id) => { for (const list of catalogs.values()) { const m = list.find((x) => x.id === id); if (m) return m.name; } return id; };

  /** What a conversation runs on now: {pinned, model, effort, routing, by}. */
  function current(s) {
    const t = threadOf(s);
    if (t) {
      const pin = t.pin || {};
      const se = t.session || {};
      return { pinned: !!(pin.model || pin.effort), model: pin.model || se.model || null, effort: pin.effort || se.effort || null, routing: null, by: "the router" };
    }
    const c = chatOfSession(s) || {};
    const pin = c.pin || {};
    const space = world.state.router || { mode: "agent" };
    const own = c.routing && c.routing.mode ? c.routing : null;
    const r = own || space;
    return { pinned: !!(pin.model || pin.effort), model: pin.model || null, effort: pin.effort || null, routing: r, ownRouting: !!own, by: r.mode === "decision" ? r.decision_model : "coordinator" };
  }

  /** What a thread's session is running right now (the router's choice or a pin it already took). */
  const running = (s) => { const t = threadOf(s); const se = (t && t.session) || {}; return t ? { model: se.model || null, effort: se.effort || null, working: t.state === "working" } : null; };
  /** The chip says what the conversation runs on, in words: a thread's model and depth as its session runs
      them now (so a working thread shows the setting it is working in), a chat's pin, else Auto. A runtime
      other than the Space's own is named first. No codes: no pin dot, no effort dots. */
  /** {model, effort} the chip names: a thread's session (what it runs now; a pin waiting for the next turn
      only fills what the session doesn't report), a chat's pin, else nothing (Auto). */
  function shownSetting(s) {
    const c = current(s), r = running(s);
    if (r) return { model: r.model || c.model || null, effort: r.effort || c.effort || null };
    return c.pinned ? { model: c.model, effort: c.effort } : { model: null, effort: null };
  }
  function chipHtml(s, phone) {
    warm(s);
    const c = current(s);
    if (simple() && !phone && !threadOf(s)) { const w = simpleOf(s, c); return `<span class="iq-l"><span class="${w === "auto" ? "iq-a" : "iq-t"}">${esc(w === "auto" ? "Auto" : w === "deep" ? "Deep" : nameOf(c.model) || "Pinned")}</span></span>`; }
    const { model, effort } = shownSetting(s);
    const rtn = runtimeOf(s), main = (mainRuntime(world.state.runtimes) || {}).name;
    const rt = manyRuntimes(world.state.runtimes) && rtn && rtn !== main && !phone ? rtName(rtn) : null;
    const words = [];
    if (rt) words.push(`<span class="iq-a">${esc(rt)}</span>`);
    words.push(model ? `<span class="iq-t">${esc(nameOf(model))}</span>` : `<span class="iq-a">Auto</span>`);
    if (effort) words.push(`<span class="iq-e">${esc(effortWord(effort))}</span>`);
    return `<span class="iq-l">${words.join(`<span class="iq-sep" aria-hidden="true">·</span>`)}</span>`;
  }
  const AUTO = `<span class="iq-a">Auto</span>`;
  /** {dot: pinned, words: the label's parts (HTML), effort} */
  function chipParts(s, c) {
    if (kindOf(s) === "thread") return { dot: c.pinned, words: [...(c.pinned ? [] : [AUTO]), `<span class="iq-t">${esc(c.model ? nameOf(c.model) : "Default")}</span>`], effort: c.effort };
    const who = c.routing && c.routing.mode === "decision" ? cap(c.routing.decision_model || "decision") : c.routing && c.routing.mode === "off" ? "Off" : "Router";
    return c.pinned
      ? { dot: true, words: [`<span class="iq-t">${esc(nameOf(c.model) || "Pinned")}</span>`], effort: c.effort }
      : { dot: false, words: [AUTO, `<span class="iq-t">${esc(who)}</span>`], effort: null };
  }
  function chipTitle(s) {
    const c = current(s);
    if (kindOf(s) === "thread") {
      const r = running(s), { model, effort } = shownSetting(s);
      const what = `${model ? nameOf(model) : "its default model"}${effort ? ` · ${effortWord(effort)}` : ""}`;
      const pending = c.pinned && r && r.model && c.model && c.model !== r.model ? `, ${nameOf(c.model)} from its next turn` : "";
      return `${r && r.working ? "Running" : "Runs"} ${what}${pending}. Change it${K.hint("intel")}`;
    }
    const r = c.routing || {};
    return `${c.pinned ? `Its coordinator runs ${nameOf(c.model)}${c.effort ? ` · ${effortWord(c.effort)}` : ""}` : "Auto: its coordinator runs its default model"}; ${r.mode === "off" ? "routing is off" : r.mode === "decision" ? `${cap(r.decision_model)} routes new messages` : "the coordinator routes new messages"}. Change it${K.hint("intel")}`;
  }
  const cap = (x) => String(x || "").replace(/^\w/, (m) => m.toUpperCase());

  // ── runtimes: the first of the three choices ───────────────────────────────
  const rts = () => world.state.runtimes || [];
  const chatPolicy = (c) => (c && c.chatId && world.state.chatPolicy && world.state.chatPolicy[c.chatId]) || null;
  const spaceEff = () => (world.state.policy && world.state.policy.effective) || null;
  /** The runtimes offered here, which one is on, and whether there is a choice at all. */
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
    const c = chatOfSession(s) || {};
    const kind = kindOf(s);
    const eff = (kind === "project" && (chatPolicy(c) || {}).effective) || spaceEff();
    const list = allowedOf(eff, rts()).map((n) => { const rt = findRt(rts(), n); const h = healthOf(rt); return { id: n, label: rtName(n), usable: usable(rt), why: usable(rt) ? "" : h.why || h.word }; });
    if (kind === "project" && chatPolicy(c)) {
      const own = chatPolicy(c).project || {};
      return { list: [{ id: "auto", label: "Auto", usable: true, why: "" }, ...list], on: own.default || (c.pin && c.pin.agent) || "auto", multi: list.length > 1 };
    }
    return { list, on: runtimeOf(s), multi: list.length > 1 };
  }
  /** The runtime whose models the list shows: the one a thread would continue on, else the one it runs on. */
  const listRuntime = (s) => (threadOf(s) && P.rt) || runtimeOf(s);
  const moving = (s) => !!(threadOf(s) && P.rt && P.rt !== runtimeChoice(s).on);

  function runtimeHtml(s) {
    const ch = runtimeChoice(s);
    if (!ch.multi) return "";
    const kind = kindOf(s);
    const sel = kind === "thread" ? P.rt || ch.on : ch.on;
    const btns = ch.list.map((o) => `<button type="button" role="radio" data-lrt="${esc(o.id)}" aria-checked="${sel === o.id}"${o.usable ? "" : ` aria-disabled="true" title="${esc(o.why)}"`}${P.busy ? " disabled" : ""}>${esc(o.label)}</button>`).join("");
    const off = ch.list.filter((o) => !o.usable);
    let line;
    if (kind === "thread") line = moving(s) ? "" : `This thread runs on ${esc(rtName(ch.on))} for its whole life.${ch.list.some((o) => o.id !== ch.on && o.usable) ? " Choose another to continue it there." : ""}`;
    else if (kind === "project") line = ch.on === "auto" ? `Its coordinator picks a runtime for each new thread.` : `Its coordinator and its new threads run on ${esc(rtName(ch.on))}.`;
    else line = `The Workspace coordinator runs on ${esc(rtName(ch.on))}.`;
    // a runtime that can't take work says why, in words, not only on hover
    const why = off.length ? off.map((o) => `${esc(o.label)}: ${esc(o.why.replace(/\.$/, ""))}.`).join(" ") : "";
    return `<div class="iq-sec iq-rts"><p class="iq-lab" id="iq-rt-l">Runtime</p><div class="iq-route" role="radiogroup" aria-labelledby="iq-rt-l">${btns}</div>` +
      (line ? `<p class="iq-rl">${line}</p>` : "") + (why ? `<p class="iq-rl is-why">${why}</p>` : "") + `</div>`;
  }

  // ── the popover ───────────────────────────────────────────────────────────
  function modelRow(m, s, name, sel, selEffort, attrs, first = false) {
    return `<div class="iq-row${sel ? " is-sel" : ""}" role="radio" aria-checked="${sel}" tabindex="${sel || first ? 0 : -1}" ${attrs.row}="${esc(m.id)}" title="${esc(m.description || "")}"><span class="iq-n">${esc(m.name)}</span>${m.description ? `<span class="iq-tr">${esc(m.description)}</span>` : ""}${CHECK}</div>`;
  }
  function depthHtml(efs, sel, attr) {
    if (!efs.length) return "";
    return `<p class="iq-lab">Thinking</p><div class="iq-route iq-depth" role="radiogroup" aria-label="Thinking">${efs.map((e) => `<button type="button" role="radio" aria-checked="${sel === e}" tabindex="${sel === e ? 0 : -1}" ${attr}="${esc(e)}">${esc(effortWord(e))}</button>`).join("")}</div><p class="iq-rl">${esc(EFFORT_HINT[sel] || "")}</p>`;
  }
  // one row per family's default (claude: opus, fable, sonnet, haiku), then models in no family
  const shown = (models) => (models || []).filter((m) => !m.is_default && (m.family_default || !m.family));

  // ── the simple choice: Auto or Deep ─────────────────────────────────────────
  const DEEP = new Set(["high", "xhigh", "max"]);
  const isDefaultModel = (id) => !id || id === "default" || [...catalogs.values()].some((l) => l.some((m) => m.id === id && m.is_default));
  /** Which of the two a conversation is on: "auto", "deep", or null (a model picked in More options). */
  function simpleOf(s, c = current(s)) {
    if (c.pinned && DEEP.has(c.effort)) return "deep";
    return !c.pinned || isDefaultModel(c.model) ? "auto" : null;
  }
  /** Deep: the model it runs on (else the default) thinking longer; the first model that can, if that one can't. */
  function deepPick(s) {
    const c = current(s);
    const cands = [modelOf(c.model), (P.models || []).find((m) => m.is_default), ...shown(P.models)].filter(Boolean);
    for (const m of cands) { const ef = effortsOf(m, s); if (ef.includes("high")) return { model: m.id, effort: "high" }; }
    return null;
  }
  function renderSimple() {
    const s = P.session, c = current(s), on = simpleOf(s, c);
    const deep = P.models ? deepPick(s) : null;
    const line = on === "deep" ? "Thinks longer before it answers: slower, for the hard problems."
      : on === "auto" ? "XO picks the model and how long it thinks, turn by turn."
      : `Runs ${esc(nameOf(c.model) || "a model you picked")}${c.effort ? ` · ${esc(EFFORT_WORD[c.effort] || c.effort)}` : ""}, set in More options.`;
    const why = !P.models ? (P.err ? esc(P.err) : `<i class="spin" aria-hidden="true"></i> Reading the models…`) : deep ? "" : "None of these models can think longer.";
    pop.innerHTML = `<header class="iq-h"><h2 id="iq-hh">Intelligence <span>for ${esc(scopeWord(s))}</span></h2></header>` +
      `<div class="iq-sec"><div class="iq-route iq-simple" role="radiogroup" aria-labelledby="iq-hh">` +
      `<button type="button" role="radio" data-lsimple="auto" aria-checked="${on === "auto"}">Auto</button>` +
      `<button type="button" role="radio" data-lsimple="deep" aria-checked="${on === "deep"}"${deep ? "" : ` aria-disabled="true"`}>Deep</button></div>` +
      `<p class="iq-rl">${line}</p>${why && on !== "deep" ? `<p class="iq-rl is-why">${why}</p>` : ""}</div>` +
      `<footer class="iq-f"><span>Applies from its next turn.</span><button type="button" class="iq-back" data-lfull aria-expanded="false">More options</button></footer>`;
    place();
  }

  function render() {
    if (!P.open) return;
    if (simple() && !P.full && !moving(P.session)) { renderSimple(); return; }
    const s = P.session, kind = kindOf(s), c = current(s);
    const models = P.models;
    let html = `<header class="iq-h"><h2 id="iq-hh">Intelligence <span>for ${esc(scopeWord(s))}</span></h2></header>`;
    if (moving(s)) {
      html += runtimeHtml(s);
      // continuing elsewhere: its model and effort there (its default unless chosen), then what happens
      const to = rtName(P.rt), mv = P.mv || {};
      html += `<div class="iq-sec"><p class="iq-now">${mv.model ? `On ${esc(to)} it will use <b>${esc(nameOf(mv.model))}${mv.effort ? ` · ${esc(EFFORT_WORD[mv.effort] || mv.effort)}` : ""}</b>.` : `On ${esc(to)} it will use its default model, unless you pick one.`}</p>`;
      if (mv.modelsErr) html += `<p class="iq-err">${esc(mv.modelsErr)}</p>`;
      else if (!mv.models) html += `<p class="iq-rl"><i class="spin" aria-hidden="true"></i> Reading ${esc(to)}'s models…</p>`;
      else html += `<div class="iq-list" role="radiogroup" aria-label="${esc(to)}'s models">${shown(mv.models).map((m, i) => modelRow(m, s, P.rt, mv.model === m.id, mv.effort, { row: "data-mvm" }, !mv.model && i === 0)).join("")}</div>` + (mv.model ? depthHtml(effortsOf((mv.models || []).find((x) => x.id === mv.model), s, P.rt).filter((e) => PIPS[e]), mv.effort, "data-mvp") : "");
      html += `</div><div class="iq-sec iq-mv" id="iq-mv-cons"><p class="iq-lab">Continuing on ${esc(to)}</p><ul>` +
        `<li>Its messages and work go to ${esc(to)}.</li><li>The new agent starts from a summary and the code, and re-reads files.</li>` +
        `<li>Earlier approvals don't carry over.</li><li>This thread is frozen; write in it to pick it back up.</li></ul>` +
        (mv.err ? `<p class="iq-err" role="alert">${esc(mv.err)}</p>` : "") +
        `<div class="iq-mv-acts">${mv.busy ? `<span class="iq-rl"><i class="spin" aria-hidden="true"></i> Stopping the thread and saving its work…</span>` : ""}<button type="button" class="btn" data-mv-cancel${mv.busy ? " disabled" : ""}>Cancel</button><button type="button" class="btn btn-pri" data-mv-go aria-describedby="iq-mv-cons"${mv.busy ? " disabled" : ""}>${mv.retry ? "Try again" : `Continue on ${esc(to)}`}</button></div></div>`;
      pop.innerHTML = html;
      place();
      return;
    }
    // ── one decision at a time: what it runs on (true now), the model, how long it thinks, then the rest ──
    const r = running(s);
    const d = draftOf(s);
    const nowWords = (m, e) => `<b>${esc(m ? nameOf(m) : "its default model")}${e ? ` · ${esc(effortWord(e))}` : ""}</b>`;
    let truth;
    if (kind === "thread") {
      const rtw = esc(rtName(runtimeOf(s)) || "");
      const verb = r && r.working ? `<i class="g g-working" aria-hidden="true"></i>Running` : "Runs";
      truth = r && r.model ? `${verb} ${nowWords(r.model, r.effort)}${rtw ? ` on ${rtw}` : ""}.` : `${verb}${rtw ? ` on ${rtw}` : ""}; its session hasn't said which model yet.`;
      if (c.pinned && (c.model && c.model !== (r && r.model) || c.effort && c.effort !== (r && r.effort))) truth += ` From its next turn: ${nowWords(c.model, c.effort)}.`;
    } else truth = c.pinned ? `Its coordinator runs ${nowWords(c.model, c.effort)}. New threads get their own from the router.` : "Its coordinator runs its default model. New threads get their own from the router.";
    html += `<p class="iq-truth">${truth}</p>`;
    if (P.err) html += `<p class="iq-err">${esc(P.err)}</p>`;
    else if (!models) html += `<p class="iq-rl"><i class="spin" aria-hidden="true"></i> Reading the models…</p>`;
    else {
      const rows = shown(models);
      const autoRow = kind !== "thread" ? `<div class="iq-row${d.auto ? " is-sel" : ""}" role="radio" aria-checked="${d.auto}" tabindex="${d.auto ? 0 : -1}" data-dmodel=""><span class="iq-n">Auto</span><span class="iq-tr">Its default, and the router's pick for each thread</span>${CHECK}</div>` : "";
      html += `<p class="iq-lab" id="iq-m-l">Model</p><div class="iq-list" role="radiogroup" aria-labelledby="iq-m-l">${autoRow}` +
        rows.map((m) => { const on = !d.auto && d.model === m.id; return `<div class="iq-row${on ? " is-sel" : ""}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-dmodel="${esc(m.id)}" title="${esc(m.description || "")}"><span class="iq-n">${esc(m.name)}</span>${m.description ? `<span class="iq-tr">${esc(m.description)}</span>` : ""}${CHECK}</div>`; }).join("") + `</div>`;
      const efs = d.auto ? [] : effortsOf(modelOf(d.model), s).filter((e) => PIPS[e]);
      if (efs.length) {
        html += `<p class="iq-lab" id="iq-e-l">Thinking</p><div class="iq-route iq-depth" role="radiogroup" aria-labelledby="iq-e-l">` +
          efs.map((e) => `<button type="button" role="radio" aria-checked="${d.effort === e}" tabindex="${d.effort === e ? 0 : -1}" data-deffort="${esc(e)}">${esc(effortWord(e))}</button>`).join("") +
          `</div><p class="iq-rl">${esc(EFFORT_HINT[d.effort] || "")}</p>`;
      }
    }
    const more = runtimeHtml(s) + (kind !== "thread" ? routingHtml(s, c) : "");
    if (more) {
      const sum = [rtName(runtimeChoice(s).on === "auto" ? "" : runtimeChoice(s).on) || (runtimeChoice(s).on === "auto" ? "Auto runtime" : ""), kind !== "thread" ? routeWord(c) : ""].filter(Boolean).join(" · ");
      html += `<button type="button" class="iq-more" data-lmore aria-expanded="${P.more}"><span class="iq-more-k">${kind !== "thread" ? "Runtime, routing" : "Runtime"}</span><span class="iq-more-v">${esc(sum)}</span>${ICON.chevron || ""}</button>`;
      if (P.more) html += `<div class="iq-moreb">${more}</div>`;
    }
    const changed = draftChanged(s);
    html += `<footer class="iq-f"><span>${changed ? "Applies when this closes, from the next turn." : "Applies from the next turn."}</span>${kind === "thread" && c.pinned ? `<button type="button" class="iq-back" data-lauto>Default model</button>` : ""}</footer>`;
    pop.innerHTML = html;
    place();
  }
  const CHECK = `<svg class="iq-ck" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  const routeWord = (c) => { const r = c.routing || {}; return !c.ownRouting ? "the Space's routing" : r.mode === "off" ? "routing off" : r.mode === "decision" ? `${cap(r.decision_model)} routes` : "its coordinator routes"; };
  function routingHtml(s, c) {
    const space = world.state.router || { mode: "agent" };
    const dms = (P.dms || []).filter((m) => m.connected);
    const opts = [
      { id: "space", label: "The Space's", on: !c.ownRouting, line: space.mode === "decision" ? `${cap(space.decision_model)} routes, as set in Settings.` : space.mode === "off" ? "Routing is off for the whole Space." : "The coordinator routes, as set in Settings." },
      { id: "agent", label: "Coordinator", on: c.ownRouting && c.routing.mode === "agent", line: "This chat's coordinator reads each message and decides." },
      ...dms.map((m) => ({ id: `dm:${m.id}`, label: m.label.replace(/^\S+ /, ""), on: c.ownRouting && c.routing.mode === "decision" && c.routing.decision_model === m.id, line: `${m.label} routes this chat's messages; the coordinator decides when it isn't sure.` })),
      { id: "off", label: "Off", on: c.ownRouting && c.routing.mode === "off", line: "New messages to this chat are refused. Its threads still take your replies." },
    ];
    const on = opts.find((o) => o.on) || opts[0];
    return `<div class="iq-sec"><p class="iq-lab" id="iq-ro-l">Who routes a new message</p><div class="iq-route" role="radiogroup" aria-labelledby="iq-ro-l">${opts.map((o) => `<button type="button" role="radio" data-lroute="${esc(o.id)}" aria-checked="${o.on}">${esc(o.label)}</button>`).join("")}</div><p class="iq-rl">${esc(on.line)}</p></div>`;
  }
  /** The choice on screen: what you picked while it's open, else what it runs on. {auto, model, effort} */
  function draftOf(s) {
    if (P.draft) return P.draft;
    const c = current(s), r = running(s);
    if (threadOf(s)) return { auto: false, model: c.model || (r && r.model) || defaultId(), effort: c.effort || (r && r.effort) || null };
    return c.pinned ? { auto: false, model: c.model, effort: c.effort } : { auto: true, model: null, effort: null };
  }
  function draftChanged(s) {
    if (!P.draft) return false;
    const c = current(s), d = P.draft;
    if (!threadOf(s) && d.auto) return c.pinned;
    return d.model !== c.model || (d.effort || null) !== (c.effort || null) || (!threadOf(s) && !c.pinned);
  }
  /** Pick a model: it keeps the depth you had when it can, else takes its own default. */
  function pickModel(id) {
    const s = P.session;
    if (!id) { P.draft = { auto: true, model: null, effort: null }; render(); return; }
    const m = modelOf(id), efs = effortsOf(m, s), was = draftOf(s).effort;
    P.draft = { auto: false, model: id, effort: !efs.length ? null : efs.includes(was) ? was : m.default_effort && efs.includes(m.default_effort) ? m.default_effort : efs[Math.floor((efs.length - 1) / 2)] };
    render();
  }
  /** Continuing elsewhere: a model there, at its own default depth. */
  function pickMove(id) {
    const m = (P.mv.models || []).find((x) => x.id === id);
    const efs = effortsOf(m, P.session, P.rt);
    P.mv.model = id; P.mv.effort = efs.length ? (m.default_effort && efs.includes(m.default_effort) ? m.default_effort : efs[Math.floor((efs.length - 1) / 2)]) : null;
    render();
  }
  function pickEffort(e) { const d = draftOf(P.session); P.draft = { ...d, auto: false, effort: e }; render(); }
  /** Closing applies what is on screen (one change, one record line with Undo). */
  function commit(s) {
    if (!draftChanged(s)) { P.draft = null; return; }
    const d = P.draft; P.draft = null;
    if (d.auto) toAuto(s); else pin(s, d.model, d.effort);
  }
  function place() {
    if (!P.anchor) return;
    if (matchMedia("(max-width: 760px)").matches) { pop.style.left = pop.style.top = pop.style.width = ""; pop.classList.add("is-sheet"); return; }
    pop.classList.remove("is-sheet");
    const r = P.anchor.getBoundingClientRect();
    const w = Math.min(360, innerWidth - 24);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.max(12, Math.min(r.right - w + 10, innerWidth - w - 12))}px`;
    pop.style.top = `${Math.max(12, r.top - pop.offsetHeight - 10)}px`;
  }
  /** Read the models the list shows (the runtime it runs on now). */
  async function loadModels(s) {
    P.err = null;
    try {
      const name = runtimeOf(s);
      if (catalogs.has(name)) { P.models = catalogs.get(name); render(); }
      const [models, dms] = await Promise.all([catalog(name, { fresh: true }), kindOf(s) === "thread" ? null : api.routerModels().then((d) => d.models || []).catch(() => [])]);
      if (!P.open || P.session !== s) return;
      P.models = models; if (dms) P.dms = dms;
    } catch (err) { P.err = err.status === 503 ? "The models can't be read right now." : err.message; }
    render();
  }
  /** A thread looks at continuing on `name`: its models there, read with a deadline (Default never waits). */
  function lookAt(name) {
    P.draft = null;
    const s = P.session;
    P.rt = name;
    P.mv = moving(s) ? { model: null, effort: null, models: catalogs.get(name) || null } : null;
    render();
    if (!P.mv || P.mv.models) return;
    const late = new Promise((_, no) => setTimeout(() => no(new Error("slow")), 20000));
    Promise.race([catalog(name), late]).then((m) => { if (P.mv && P.rt === name) { P.mv.models = m; render(); } },
      (err) => { if (P.mv && P.rt === name) { P.mv.modelsErr = err.message === "slow" ? `${rtName(name)}'s models are slow to read; its default still works.` : `${rtName(name)}'s models can't be read now; its default still works.`; render(); } });
  }
  /** opts.rt: open a thread's picker looking at continuing on that runtime (the thread menu's way in). */
  async function open(s, anchor, opts = {}) {
    P.open = true; P.session = s; P.anchor = anchor; P.returnTo = document.activeElement; P.err = null; P.models = null; P.busy = false; P.rt = null; P.mv = null; P.full = false; P.draft = null; P.more = false;
    pop.hidden = false; pop.classList.remove("is-out");
    if (opts.rt) lookAt(opts.rt); else render();
    anchor?.setAttribute("aria-expanded", "true");
    if (opts.rt) pop.querySelector(`[data-lrt="${CSS.escape(opts.rt)}"]`)?.focus({ preventScroll: true });
    else pop.focus({ preventScroll: true });
    await loadModels(s);
  }
  function close({ restore = true, apply = true } = {}) {
    if (!P.open) return;
    if (apply && !P.mv) commit(P.session); else P.draft = null;
    P.rt = null; P.mv = null;
    P.open = false;
    P.anchor?.setAttribute("aria-expanded", "false");
    if (RM.matches) pop.hidden = true;
    else { pop.classList.add("is-out"); setTimeout(() => { if (!P.open) { pop.hidden = true; pop.classList.remove("is-out"); } }, 140); }
    if (restore) (P.returnTo && P.returnTo.isConnected ? P.returnTo : P.anchor)?.focus?.({ preventScroll: true });
  }

  // ── changes: a PATCH, one record line, a 3 s Undo (the same PATCH back) ─────
  async function patch(s, body) {
    const t = threadOf(s);
    if (t) return api.patchThread(t.chatId, t.id, { intelligence: body });
    const c = chatOfSession(s);
    return api.patchChat(c.chatId, body);
  }
  async function change(s, body, undoBody, text) {
    try {
      await patch(s, body);
      await world.act.refresh?.();
      onChange();
      record(s, { text, undo: undoBody ? async () => { try { await patch(s, undoBody); await world.act.refresh?.(); onChange(); } catch (err) { record(s, { text: `Couldn't undo: ${err.message}`, refused: true }); } } : null });
    } catch (err) {
      record(s, { text: `Nothing changed: ${err.message}`, refused: true });
    }
  }
  // The catalog's "no override" model. Storm stores and runs it as no override, and unlike null it
  // reaches a live session (a null pin is stored but skipped until the session restarts).
  const defaultId = () => { const m = (P.models || []).find((x) => x.is_default); return m ? m.id : "default"; };
  /** What to send to put a conversation back exactly as it ran before a change. */
  function restoreBody(s, before) {
    if (kindOf(s) === "thread") {
      // a thread's pin can't be cleared (backend gap): Undo pins what it ran on, the router's choice
      return { model: before.model || defaultId(), ...(before.effort ? { effort: before.effort } : {}) };
    }
    return before.pinned ? { model: before.model || defaultId(), effort: before.effort || null } : { model: defaultId(), effort: null };
  }
  function pin(s, model, effort) {
    const before = current(s);
    const kind = kindOf(s);
    const body = kind === "thread" ? { model, ...(effort ? { effort } : {}) } : { model, effort: effort || null };
    change(s, body, restoreBody(s, before), `${kind === "thread" ? "This thread" : cap(scopeWord(s))} now runs ${nameOf(model)}${effort ? ` · ${EFFORT_WORD[effort] || effort}` : ""}, from its next turn`);
  }
  function toAuto(s) {
    const before = current(s);
    if (kindOf(s) === "thread") {
      // the closest a thread can come to "no pin": the CLI's own model at its own effort
      const d = modelOf(defaultId());
      const ef = d && d.takes_effort ? d.default_effort || null : null;
      change(s, { model: defaultId(), ...(ef ? { effort: ef } : {}) }, restoreBody(s, before), "This thread is back on the CLI's default model");
    } else change(s, { model: defaultId(), effort: null }, restoreBody(s, before), `${cap(scopeWord(s))} is back on its default`);
  }
  function route(s, id) {
    const c = chatOfSession(s);
    const before = c && c.routing ? c.routing : null;
    const body = id === "space" ? { routing: null } : id === "agent" ? { routing: { mode: "agent" } } : id === "off" ? { routing: { mode: "off" } } : { routing: { mode: "decision", decision_model: id.slice(3) } };
    const label = id === "space" ? "uses the Space's routing" : id === "agent" ? "is routed by its coordinator" : id === "off" ? "refuses new messages: routing is off" : `is routed by ${cap(id.slice(3))}`;
    change(s, body, { routing: before }, `${s === "ws" ? "The Workspace" : PROJ(s.slice(2))} ${label}`);
  }

  const blankPolicy = { allowed: null, default: null, preferences: null, fallback: null };
  /** A project's or the Workspace's runtime: its coordinator (from its next pause) and, for a project, its new threads. */
  async function setRuntime(s, id) {
    P.draft = null;
    const c = chatOfSession(s), kind = kindOf(s);
    if (!c || P.busy || id === runtimeChoice(s).on) return;
    const pin0 = { agent: (c.pin && c.pin.agent) || null, model: (c.pin && c.pin.model) || null, effort: (c.pin && c.pin.effort) || null };
    const pol0 = kind === "project" && chatPolicy(c) ? { ...blankPolicy, ...(chatPolicy(c).project || {}) } : null;
    const agent = id === "auto" ? null : id;
    P.busy = true; render();
    try {
      // a model belongs to its runtime: a new runtime starts on its own default model
      await api.patchChat(c.chatId, { agent, model: null, effort: null });
      if (pol0) await world.act.setPolicy(c.chatId, { ...pol0, default: agent });
      await world.act.refresh?.();
      const who = kind === "project" ? PROJ(s.slice(2)) : "The Workspace";
      record(s, {
        text: kind === "project" ? (agent ? `${who} runs on ${rtName(agent)}: its coordinator from its next pause, and its new threads` : `${who} is on Auto: its coordinator picks a runtime for each new thread`) : `The Workspace coordinator runs on ${rtName(agent)} from its next pause`,
        undo: async () => {
          try { await api.patchChat(c.chatId, pin0); if (pol0) await world.act.setPolicy(c.chatId, pol0); await world.act.refresh?.(); onChange(); }
          catch (err) { record(s, { text: `Couldn't undo: ${err.message}`, refused: true }); }
        },
      });
    } catch (err) { record(s, { text: `Nothing changed: ${err.message}`, refused: true }); }
    P.busy = false;
    onChange();
    if (P.open && P.session === s) { P.models = null; render(); loadModels(s); }
  }
  /** Continue the thread on the runtime it looks at: XO stops it, saves its work, and a linked thread starts there. */
  async function moveGo() {
    const s = P.session, t = threadOf(s), mv = P.mv;
    if (!t || !mv || mv.busy) return;
    mv.busy = true; mv.err = null; render();
    movedHere.add(t.id);
    try {
      const r = await api.continueThread(t.chatId, t.id, { agent: P.rt, model: mv.model || null, effort: mv.effort || null });
      const next = r && r.thread_id ? await world.act.fetchThread(t.chatId, r.thread_id).catch(() => null) : null;
      mv.busy = false;
      close({ restore: false });
      onMoved && onMoved(next, r.agent || P.rt);
    } catch (err) {
      mv.busy = false;
      mv.retry = err.code === "still_busy" || err.code === "timeout" || err.status === 0;
      mv.err = err.code === "still_busy" ? "The thread didn't stop in time. Nothing moved; try again." : err.message;
      render();
      pop.querySelector("[data-mv-go]")?.focus();
    }
  }

  pop.addEventListener("click", (e) => {
    const sm = e.target.closest("[data-lsimple]");
    if (sm) {
      if (sm.getAttribute("aria-disabled") === "true" || sm.getAttribute("aria-checked") === "true") return;
      const s = P.session;
      if (sm.dataset.lsimple === "auto") { close(); toAuto(s); return; }
      const d = deepPick(s);
      if (d) { close(); pin(s, d.model, d.effort); }
      return;
    }
    if (e.target.closest("[data-lfull]")) { P.full = true; render(); pop.focus({ preventScroll: true }); return; }
    const rt = e.target.closest("[data-lrt]");
    if (rt) {
      if (rt.getAttribute("aria-disabled") === "true" || rt.disabled) return;
      if (threadOf(P.session)) { lookAt(rt.dataset.lrt); return; }
      setRuntime(P.session, rt.dataset.lrt); return;
    }
    if (e.target.closest("[data-mv-cancel]")) { lookAt(null); pop.querySelector(`[data-lrt][aria-checked="true"]`)?.focus(); return; }
    if (e.target.closest("[data-mv-go]")) { moveGo(); return; }
    const mvp = e.target.closest("[data-mvp]");
    if (mvp && P.mv) { P.mv.effort = mvp.dataset.mvp || null; render(); return; }
    const mvm = e.target.closest("[data-mvm]");
    if (mvm && P.mv) { pickMove(mvm.dataset.mvm); pop.querySelector(`[data-mvm="${CSS.escape(mvm.dataset.mvm)}"]`)?.focus({ preventScroll: true }); return; }
    const r = e.target.closest("[data-lroute]");
    if (r) { const s = P.session; close(); route(s, r.dataset.lroute); return; }
    if (e.target.closest("[data-lauto]")) { const s = P.session; P.draft = null; close({ apply: false }); toAuto(s); return; }
    if (e.target.closest("[data-lmore]")) { P.more = !P.more; render(); pop.querySelector("[data-lmore]")?.focus({ preventScroll: true }); return; }
    const dm = e.target.closest("[data-dmodel]");
    if (dm) { pickModel(dm.dataset.dmodel); pop.querySelector(`[data-dmodel="${CSS.escape(dm.dataset.dmodel)}"]`)?.focus({ preventScroll: true }); return; }
    const de = e.target.closest("[data-deffort]");
    if (de) { pickEffort(de.dataset.deffort); pop.querySelector(`[data-deffort="${CSS.escape(de.dataset.deffort)}"]`)?.focus({ preventScroll: true }); }
  });
  pop.addEventListener("keydown", (e) => {
    if (P.busy || (P.mv && P.mv.busy)) { if (e.key !== "Escape") return; }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (e.target.closest(".iq-route:not(.iq-depth), .iq-moreb")) return;   // runtime and routing keep the browser's own keys
      const vertical = e.key === "ArrowDown" || e.key === "ArrowUp";
      const group = e.target.closest(".iq-depth") || (vertical ? pop.querySelector(".iq-list") : pop.querySelector(".iq-depth"));
      if (!group) return;
      const items = [...group.querySelectorAll("[role=radio]")];
      const cur = Math.max(0, items.findIndex((x) => x.getAttribute("aria-checked") === "true"));
      const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
      const next = items[Math.max(0, Math.min(items.length - 1, cur + step))];
      if (!next) return;
      e.preventDefault();
      if (next.dataset.mvm != null) { pickMove(next.dataset.mvm); pop.querySelector(`[data-mvm="${CSS.escape(next.dataset.mvm)}"]`)?.focus({ preventScroll: true }); }
      else if (next.dataset.mvp != null) { P.mv.effort = next.dataset.mvp || null; render(); pop.querySelector(`[data-mvp="${CSS.escape(next.dataset.mvp)}"]`)?.focus({ preventScroll: true }); }
      else if (next.dataset.deffort != null) { pickEffort(next.dataset.deffort); pop.querySelector(`[data-deffort="${CSS.escape(next.dataset.deffort)}"]`)?.focus({ preventScroll: true }); }
      else if (next.dataset.dmodel != null) { pickModel(next.dataset.dmodel); pop.querySelector(`[data-dmodel="${CSS.escape(next.dataset.dmodel)}"]`)?.focus({ preventScroll: true }); }
      return;
    }
    else if (e.key === "Enter" && !P.mv && !e.target.closest("button:not([role=radio])")) { e.preventDefault(); close(); return; }
    else if (K.is(e, "auto") && !e.target.closest("input,textarea")) { e.preventDefault(); if (threadOf(P.session)) { const s = P.session; close({ apply: false }); toAuto(s); } else pickModel(""); return; }
    if (e.key !== "Escape") return;
    e.preventDefault(); e.stopPropagation();
    // Esc steps back out of continuing elsewhere first, then closes
    if (P.mv && !P.mv.busy) { lookAt(null); pop.querySelector(`[data-lrt][aria-checked="true"]`)?.focus(); } else if (!(P.mv && P.mv.busy)) close({ apply: false });
  });
  document.addEventListener("pointerdown", (e) => { if (P.open && !(P.mv && P.mv.busy) && !pop.contains(e.target) && !e.target.closest("#iq")) close({ restore: false }); });
  addEventListener("resize", () => { if (P.open) place(); });

  return {
    current, chipHtml, chipTitle, open, close,
    routed: () => null, spawnSetup: () => null, set: () => {}, setRouting: () => {},
    get isOpen() { return P.open; },
    /** Did this tab continue that thread elsewhere (so the stream's frame for it needs no herald)? */
    movedHere: (id) => movedHere.has(id),
    runtimeChoice,
    get session() { return P.session; },
    kindOf, scopeWord,
  };
}
