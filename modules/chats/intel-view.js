// @ts-check

import { esc } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";
import { ICON } from "../../core/ui/icons/names.js";
import { xi, stateMark } from "../../core/ui/icons/icon.js";
import { rtName, rtMark } from "../../core/services/runtimes.js";
import { EFFORT_WORD, EFFORT_HINT } from "./effort.js";

/** @import { IntelCurrent, IntelModel, IntelMove, IntelState, Routing, ViewOptions } from "./intel-types.js" */

/** @type {Record<string, number>} */
const PIPS = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 };

/** @param {IntelState} P @param {ViewOptions} options */
export function createIntelView(P, { pop, world, simple, catalogState, draftOf, draftChanged, place }) {
  const {
    kindOf, scopeWord, current, runtimeChoice, moving, effortsOf, modelOf, nameOf, shown,
    simpleOf, deepPick, running, runtimeOf, pendingOf, effortWord, cap,
  } = catalogState;

  /** @param {string} s */
  function runtimeHtml(s) {
    const ch = runtimeChoice(s);
    if (!ch.multi) return "";
    const kind = kindOf(s);
    const sel = kind === "thread" ? P.rt || ch.on : ch.on;
    // while a change is out (a runtime set, a move, a save), every choice here waits: aria-disabled, not disabled,
    const wait = P.busy || P.saving || (P.mv && P.mv.busy);
    const btns = ch.list.map((o) => `<button type="button" role="radio" data-lrt="${esc(o.id)}" aria-checked="${sel === o.id}"${!o.usable ? ` aria-disabled="true" title="${esc(o.why)}"` : wait ? ' aria-disabled="true"' : ""}>${rtMark(o.id, { withName: true }) || esc(o.label)}</button>`).join("");
    const off = ch.list.filter((o) => !o.usable);
    let line;
    if (kind === "thread") line = moving(s) ? "" : `This thread runs on ${esc(rtName(ch.on))} for its whole life.${ch.list.some((o) => o.id !== ch.on && o.usable) ? " Choose another to continue it there." : ""}`;
    else if (kind === "project") line = ch.on === "auto" ? `Its coordinator picks a runtime for each new thread.` : `Its coordinator and its new threads run on ${esc(rtName(ch.on))}.`;
    else line = `The Workspace coordinator runs on ${esc(rtName(ch.on))}.`;
    // a runtime that can't take work says why, in words, not only on hover
    const why = off.length ? off.map((o) => `${esc(o.label)}: ${esc(o.why.replace(/\.$/, ""))}.`).join(" ") : "";
    return `<div class="iq-sec iq-rts" data-key="rts"><p class="iq-lab" id="iq-rt-l">Runtime</p><div class="iq-route" role="radiogroup" aria-labelledby="iq-rt-l">${btns}</div>` +
      (line ? `<p class="iq-rl">${line}</p>` : "") + (why ? `<p class="iq-rl is-why">${why}</p>` : "") + `</div>`;
  }

  // wait: a change is out, so the choice on screen is the one being sent and can't change under it
  const WAIT = ' aria-disabled="true"';
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
      html += runtimeHtml(s);
      // continuing elsewhere: its model and effort there (its default unless chosen), then what happens
      const to = rtName(P.rt), mv = P.mv || (/** @type {Partial<IntelMove>} */ ({}));
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
    // ── one decision at a time: what it runs on (true now), the model, how long it thinks, then the rest ──
    const r = running(s);
    const d = draftOf(s);
    /** @param {string | null} m @param {string | null} e */
    const nowWords = (m, e) => `<b>${esc(m ? nameOf(m) : "its default model")}${e ? ` · ${esc(effortWord(e))}` : ""}</b>`;
    let truth;
    if (kind === "thread") {
      const rtw = esc(rtName(runtimeOf(s)) || "");
      const verb = r && r.working ? `${stateMark("working")}Running` : "Runs";
      truth = r && r.model ? `${verb} ${nowWords(r.model, r.effort)}${rtw ? ` on ${rtw}` : ""}.` : `${verb}${rtw ? ` on ${rtw}` : ""}; its session hasn't said which model yet.`;
      const p = pendingOf(s);
      if (p) truth += ` Next turn: <b>${esc(p.words)}</b>.`;
      else if (c.pinned && r && !r.model && c.model) truth += ` Next turn: ${nowWords(c.model, c.effort)}.`;
    } else truth = c.pinned ? `Its coordinator runs ${nowWords(c.model, c.effort)}. New threads get their own from the router.` : "Its coordinator runs its default model. New threads get their own from the router.";
    html += `<p class="iq-truth">${truth}</p>`;
    if (P.err) html += `<p class="iq-err">${esc(P.err)}</p>`;
    else if (!models) html += `<p class="iq-rl" data-key="reading"><i class="spin" aria-hidden="true"></i> Reading the models…</p>`;
    else {
      const rows = shown(models);
      const wait = P.saving ? WAIT : "";
      const autoRow = kind !== "thread" ? `<div class="iq-row${d.auto ? " is-sel" : ""}" role="radio" aria-checked="${d.auto}" tabindex="${d.auto ? 0 : -1}"${wait} data-dmodel=""><span class="iq-n">Auto</span><span class="iq-tr">Its default, and the router's pick for each thread</span>${CHECK}</div>` : "";
      html += `<p class="iq-lab" id="iq-m-l">Model</p><div class="iq-list" data-key="models" role="radiogroup" aria-labelledby="iq-m-l">${autoRow}` +
        rows.map((m, i) => { const on = !d.auto && d.model === m.id; const tab = on || (i === 0 && !d.auto && !rows.some((x) => x.id === d.model)); return `<div class="iq-row${on ? " is-sel" : ""}" role="radio" aria-checked="${on}" tabindex="${tab ? 0 : -1}"${wait} data-dmodel="${esc(m.id)}" title="${esc(m.description || "")}"><span class="iq-n">${esc(m.name)}</span>${m.description ? `<span class="iq-tr">${esc(m.description)}</span>` : ""}${CHECK}</div>`; }).join("") + `</div>`;
      const efs = d.auto ? [] : effortsOf(modelOf(d.model), s).filter((e) => PIPS[e]);
      if (efs.length) {
        html += `<p class="iq-lab" id="iq-e-l">Thinking</p><div class="iq-route iq-depth" data-key="depth" role="radiogroup" aria-labelledby="iq-e-l">` +
          efs.map((e, i) => `<button type="button" role="radio" aria-checked="${d.effort === e}" tabindex="${d.effort === e || (i === 0 && !efs.includes((/** @type {string} */ (d.effort)))) ? 0 : -1}"${wait} data-deffort="${esc(e)}">${esc(effortWord(e))}</button>`).join("") +
          `</div><p class="iq-rl">${esc(EFFORT_HINT[(/** @type {string} */ (d.effort))] || "")}</p>`;
      }
    }
    const more = runtimeHtml(s) + (kind !== "thread" ? routingHtml(s, c) : "");
    if (more) {
      const sum = [rtName(runtimeChoice(s).on === "auto" ? "" : runtimeChoice(s).on) || (runtimeChoice(s).on === "auto" ? "Auto runtime" : ""), kind !== "thread" ? routeWord(c) : ""].filter(Boolean).join(" · ");
      html += `<button type="button" class="iq-more" data-lmore aria-expanded="${P.more}"><span class="iq-more-k">${kind !== "thread" ? "Runtime, routing" : "Runtime"}</span><span class="iq-more-v">${esc(sum)}</span>${ICON.chevron || ""}</button>`;
      // each part of the picker is keyed, so a redraw keeps it whatever comes and goes before it: when the model list
      if (P.more) html += `<div class="iq-moreb" data-key="more">${more}</div>`;
    }
    const changed = draftChanged(s);
    html += changed
      ? (P.saveErr ? `<p class="iq-err" role="alert">${esc(P.saveErr)}</p>` : "") + `<footer class="iq-f"><span>${P.saving ? "Saving…" : "From the next turn · Esc cancels"}</span><button type="button" class="iq-done" data-ldone${P.saving ? ' aria-busy="true" aria-disabled="true"' : ""}>${P.saving ? "Saving…" : "Done"}</button></footer>`
      : `<footer class="iq-f"><span>Applies from the next turn.</span>${kind === "thread" && c.pinned ? `<button type="button" class="iq-back" data-lauto>Default model</button>` : ""}</footer>`;
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
