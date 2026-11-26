// @ts-check

import { esc } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";
import { xi, stateMark } from "../../core/ui/icons/icon.js";
import { rtName, rtMark } from "../../core/services/runtimes.js";
import { EFFORT_WORD, EFFORT_HINT } from "./effort.js";
import { createIntelPages, PIPS, PROJECT, item, pips, pageHead } from "./intel-pages.js";

/** @import { IntelCurrent, IntelModel, IntelMove, IntelState, Routing, ViewOptions } from "./intel-types.js" */

/** @param {IntelState} P @param {ViewOptions} options */
export function createIntelView(P, { pop, world, simple, catalogState, draftOf, draftChanged, place }) {
  const {
    kindOf, scopeWord, current, runtimeChoice, moving, effortsOf, modelOf, nameOf, shown,
    simpleOf, deepPick, running, runtimeOf, pendingOf, effortWord, cap,
  } = catalogState;
  // wait: a change is out, so the choice on screen is the one being sent and can't change under it
  const WAIT = ' aria-disabled="true"';
  const { runtimePage, modelPage, thinkPage } = createIntelPages(P, { world, catalogState, WAIT });
  /** @param {IntelModel} m @param {string} s @param {string | null} name @param {boolean} sel @param {string | null | undefined} selEffort @param {{row: string}} attrs */
  function modelRow(m, s, name, sel, selEffort, attrs, first = false, wait = false) {
    return `<div class="iq-row${sel ? " is-sel" : ""}" role="radio" aria-checked="${sel}" tabindex="${sel || first ? 0 : -1}"${wait ? WAIT : ""} ${attrs.row}="${esc(m.id)}" title="${esc(m.description || "")}"><span class="iq-n">${esc(m.name)}</span>${m.description ? `<span class="iq-tr">${esc(m.description)}</span>` : ""}${CHECK}</div>`;
  }
  /** @param {string[]} efs @param {string | null | undefined} sel @param {string} attr */
  function depthHtml(efs, sel, attr, wait = false) {
    if (!efs.length) return "";
    return `<p class="iq-lab">Thinking</p><div class="iq-route iq-depth" data-key="mv-depth" role="radiogroup" aria-label="Thinking">${efs.map((e, i) => `<button type="button" role="radio" aria-checked="${sel === e}" tabindex="${sel === e || (i === 0 && !efs.includes((/** @type {string} */ (sel)))) ? 0 : -1}"${wait ? WAIT : ""} ${attr}="${esc(e)}">${esc(effortWord(e))}</button>`).join("")}</div><p class="iq-rl">${esc(EFFORT_HINT[(/** @type {string} */ (sel))] || "")}</p>`;
  }
  function renderSimple() {
    const s = (/** @type {string} */ (P.session)), c = current(s), on = simpleOf(s, c);
    const deep = P.models ? deepPick(s) : null;
    const line = on === "deep" ? "Thinks longer before it answers: slower, for the hard problems."
      : on === "auto" ? "XO picks the model and how long it thinks, turn by turn."
      : `Runs ${esc(nameOf(c.model) || "a model you picked")}${c.effort ? ` · ${esc(EFFORT_WORD[c.effort] || c.effort)}` : ""}, set in More options.`;
    const why = !P.models ? (P.err ? esc(P.err) : `<i class="spin" aria-hidden="true"></i> Reading the models…`) : deep ? "" : "None of these models can think longer.";
    redraw(pop, `<header class="iq-h"><h2 id="iq-hh">Intelligence <span>for ${esc(scopeWord(s))}</span></h2></header>` +
      `<div class="iq-sec" data-key="simple"><div class="iq-route iq-simple" role="radiogroup" aria-labelledby="iq-hh">` +
      `<button type="button" role="radio" data-lsimple="auto" aria-checked="${on === "auto"}">Auto</button>` +
      `<button type="button" role="radio" data-lsimple="deep" aria-checked="${on === "deep"}"${deep ? "" : ` aria-disabled="true"`}>Deep</button></div>` +
      `<p class="iq-rl">${line}</p>${why && on !== "deep" ? `<p class="iq-rl is-why">${why}</p>` : ""}</div>` +
      `<footer class="iq-f"><span>Applies from its next turn.</span><button type="button" class="iq-back" data-lfull aria-expanded="false">More options</button></footer>`);
    place();
  }

  function render() {
    if (!P.open) return;
    if (simple() && !P.full && !moving((/** @type {string} */ (P.session)))) { renderSimple(); return; }
    const s = (/** @type {string} */ (P.session)), kind = kindOf(s), c = current(s);
    const models = P.models;
    let html = `<header class="iq-h"><h2 id="iq-hh">Intelligence <span>for ${esc(scopeWord(s))}</span></h2></header>`;
    if (moving(s)) {
      // continuing elsewhere: its model and effort there (its default unless chosen), then what happens
      const to = rtName(P.rt), mv = P.mv || (/** @type {Partial<IntelMove>} */ ({}));
      html = pageHead(`Continue on ${to}`, "");
      html += `<div class="iq-sec" data-key="mv"><p class="iq-now">${mv.model ? `On ${esc(to)} it will use <b>${esc(nameOf(mv.model))}${mv.effort ? ` · ${esc(EFFORT_WORD[mv.effort] || mv.effort)}` : ""}</b>.` : `On ${esc(to)} it will use its default model, unless you pick one.`}</p>`;
      if (mv.modelsErr) html += `<p class="iq-err">${esc(mv.modelsErr)}</p>`;
      else if (!mv.models) html += `<p class="iq-rl" data-key="mv-reading"><i class="spin" aria-hidden="true"></i> Reading ${esc(to)}'s models…</p>`;
      else html += `<div class="iq-list" data-key="mv-models" role="radiogroup" aria-label="${esc(to)}'s models">${shown(mv.models).map((m, i) => modelRow(m, s, P.rt, mv.model === m.id, mv.effort, { row: "data-mvm" }, !mv.model && i === 0, !!mv.busy)).join("")}</div>` + (mv.model ? depthHtml(effortsOf((mv.models || []).find((x) => x.id === mv.model), s, P.rt).filter((e) => PIPS[e]), mv.effort, "data-mvp", !!mv.busy) : "");
      html += `</div><div class="iq-sec iq-mv" id="iq-mv-cons"><p class="iq-lab">Continuing on ${esc(to)}</p><ul>` +
        `<li>Its messages and work go to ${esc(to)}.</li><li>The new agent starts from a summary and the code, and re-reads files.</li>` +
        `<li>Earlier approvals don't carry over.</li><li>This thread is frozen; write in it to pick it back up.</li></ul>` +
        (mv.err ? `<p class="iq-err" role="alert">${esc(mv.err)}</p>` : "") +
        `<div class="iq-mv-acts">${mv.busy ? `<span class="iq-rl"><i class="spin" aria-hidden="true"></i> Stopping the thread and saving its work…</span>` : ""}<button type="button" class="btn" data-mv-cancel${mv.busy ? WAIT : ""}>Cancel</button><button type="button" class="btn btn-pri" data-mv-go aria-describedby="iq-mv-cons"${mv.busy ? WAIT + ' aria-busy="true"' : ""}>${mv.retry ? "Try again" : `Continue on ${esc(to)}`}</button></div></div>`;
      redraw(pop, html);
      place();
      return;
    }
    const r = running(s), d = draftOf(s), page = P.page || "root";
    const wait = P.saving ? WAIT : "";
    const rc = runtimeChoice(s), on = rtName(runtimeOf(s));
    const efs = d.auto ? [] : effortsOf(modelOf(d.model), s).filter((e) => PIPS[e]);
    /** @param {string} head @param {string} body */
    const show = (head, body) => { redraw(pop, head + body); place(); };
    if (page === "rt" && rc.multi) return show(pageHead("Runtime", ""), runtimePage(s, rc));
    if (page === "model" && models) return show(pageHead("Model", on ? `On ${on}` : ""), modelPage(kind, d, wait));
    if (page === "think" && efs.length) return show(pageHead("Thinking", `How long ${nameOf(d.model)} thinks first`), thinkPage(efs, d, wait));
    if (page === "route" && kind === "workspace") return show(pageHead("Routing", "Who reads a new message first"), routingHtml(s, c));
    /** @param {string | null} m @param {string | null} e */
    const nowWords = (m, e) => `<b>${esc(m ? nameOf(m) : "its default model")}${e ? ` · ${esc(effortWord(e))}` : ""}</b>`;
    if (kind === "thread") {
      const rtw = esc(rtName(runtimeOf(s)) || "");
      const verb = r && r.working ? `${stateMark("working")}Running` : "Runs";
      let truth = r && r.model ? `${verb} ${nowWords(r.model, r.effort)}${rtw ? ` on ${rtw}` : ""}.` : `${verb}${rtw ? ` on ${rtw}` : ""}; its session hasn't said which model yet.`;
      const p = pendingOf(s);
      if (p) truth += ` Next turn: <b>${esc(p.words)}</b>.`;
      else if (c.pinned && r && !r.model && c.model) truth += ` Next turn: ${nowWords(c.model, c.effort)}.`;
      html += `<p class="iq-truth">${truth}</p>`;
    }
    if (P.err) html += `<p class="iq-err">${esc(P.err)}</p>`;
    const rows = [];
    const rtWords = rc.on === "auto" ? "Auto" : `${rtMark(/** @type {string} */ (rc.on)) || ""}${esc(rtName(rc.on))}`;
    if (rc.multi) rows.push(item("rt", "Runtime", rtWords, P.busy ? WAIT : ""));
    const modelWords = !models ? `<i class="spin" aria-hidden="true"></i>Reading…` : d.auto ? "Auto" : esc(nameOf(d.model) || "Default");
    rows.push(item("model", "Model", modelWords, models ? wait : WAIT));
    const depth = PIPS[/** @type {string} */ (d.effort)] || 0;
    if (efs.length) rows.push(item("think", "Thinking", `${pips(depth)}${esc(effortWord(d.effort) || "Default")}`, wait));
    if (kind === "workspace") rows.push(item("route", "Routing", esc(routeWord(c)), wait));
    html += `<div class="iq-items" data-key="items" role="group" aria-labelledby="iq-hh">${rows.join("")}</div>`;
    if (kind === "project") html += `<div class="iq-items" data-key="proj">${PROJECT}</div>`;
    const changed = draftChanged(s);
    if (changed) html += (P.saveErr ? `<p class="iq-err" role="alert">${esc(P.saveErr)}</p>` : "") + `<footer class="iq-f"><span>${P.saving ? "Saving…" : "From the next turn · Esc cancels"}</span><button type="button" class="iq-done" data-ldone${P.saving ? ' aria-busy="true" aria-disabled="true"' : ""}>${P.saving ? "Saving…" : "Done"}</button></footer>`;
    else if (kind === "thread" && c.pinned) html += `<footer class="iq-f"><span>Applies from the next turn.</span><button type="button" class="iq-back" data-lauto>Default model</button></footer>`;
    redraw(pop, html);
    place();
  }
  const CHECK = xi("check", "iq-ck");
  /** @param {IntelCurrent} c */
  const routeWord = (c) => { const r = c.routing || {}; return !c.ownRouting ? "the Space's routing" : r.mode === "off" ? "routing off" : r.mode === "decision" ? `${cap(r.decision_model)} routes` : "its coordinator routes"; };
  /** @param {string} s @param {IntelCurrent} c */
  function routingHtml(s, c) {
    const space = world.state.router || { mode: "agent" };
    const dms = (P.dms || []).filter((m) => m.connected);
    const opts = [
      { id: "space", label: "The Space's", on: !c.ownRouting, line: space.mode === "decision" ? `${cap(space.decision_model)} routes, as set in Settings.` : space.mode === "off" ? "Routing is off for the whole Space." : "The coordinator routes, as set in Settings." },
      { id: "agent", label: "Coordinator", on: c.ownRouting && (/** @type {Routing} */ (c.routing)).mode === "agent", line: "This chat's coordinator reads each message and decides." },
      ...dms.map((m) => ({ id: `dm:${m.id}`, label: m.label.replace(/^\S+ /, ""), on: c.ownRouting && (/** @type {Routing} */ (c.routing)).mode === "decision" && (/** @type {Routing} */ (c.routing)).decision_model === m.id, line: `${m.label} routes this chat's messages; the coordinator decides when it isn't sure.` })),
      { id: "off", label: "Off", on: c.ownRouting && (/** @type {Routing} */ (c.routing)).mode === "off", line: "New messages to this chat are refused. Its threads still take your replies." },
    ];
    const on = opts.find((o) => o.on) || opts[0];
    return `<div class="iq-sec" data-key="route"><p class="iq-lab" id="iq-ro-l">Who routes a new message</p><div class="iq-route" role="radiogroup" aria-labelledby="iq-ro-l">${opts.map((o) => `<button type="button" role="radio" data-lroute="${esc(o.id)}" aria-checked="${o.on}"${P.saving ? WAIT : ""}>${esc(o.label)}</button>`).join("")}</div><p class="iq-rl">${esc(on.line)}</p></div>`;
  }
  return { render };
}
