// "Continue on another runtime…" (mixed runtimes F4): a thread moves by starting a linked new thread on
// another runtime from its work. XO stops the old one, saves its work as a commit and freezes it.
//
// The dialog says what happens before the click, always in full (the consequence block is part of the
// dialog's accessible description): the work goes to another provider, the new agent starts from a
// summary, earlier approvals don't carry over, the old thread is frozen. The runtimes, their health,
// the models and efforts all come from the server; a model list that is slow never holds the dialog.

import { esc } from "./world.js";
import { api } from "./api.js";
import { rtName, moveTargets } from "./runtimes.js";

const MODELS_MS = 20000;
const EFFORT_WORD = { low: "Quick", medium: "Balanced", high: "Deep", xhigh: "Deeper", max: "Deepest" };

export function createMove({ world, announce, go, ICON }) {
  const dlg = document.getElementById("move-dlg");
  const mine = new Set(); // threads this tab moved: their own frames need no second word
  const M = { t: null, agent: null, model: "", effort: "", reason: "", busy: false, err: null, retry: false, models: {}, modelErr: {}, returnTo: null };

  const targets = () => moveTargets(M.t.agentName, world.act.policyFor(M.t.project), world.state.runtimes || []);
  function pickDefault() {
    const list = targets();
    const first = list.find((x) => !x.own && x.usable) || list.find((x) => x.usable);
    M.agent = first ? first.name : null;
  }
  /** A runtime's models, read once per dialog with a deadline: until then "Default" is the choice. */
  function loadModels(name) {
    if (!name || M.models[name] || M.modelErr[name] === "loading") return;
    M.modelErr[name] = "loading";
    const late = new Promise((_, no) => setTimeout(() => no(new Error("slow")), MODELS_MS));
    Promise.race([api.models(name), late]).then((d) => { M.models[name] = d.models || []; delete M.modelErr[name]; }, (err) => { M.modelErr[name] = err.message === "slow" ? "Its models are slow to read; Default still works." : "Its models can't be read now; Default still works."; })
      .finally(() => { if (dlg.open) draw(); });
  }

  function draw() {
    const t = M.t;
    const list = targets();
    const name = rtName(M.agent);
    const models = M.models[M.agent];
    const model = models && models.find((m) => m.id === M.model);
    const efforts = model ? (model.takes_effort ? model.efforts || [] : []) : [];
    const loading = M.modelErr[M.agent] === "loading";
    const own = rtName(t.agentName);
    dlg.innerHTML = `<form method="dialog" novalidate data-move>` +
      `<header class="dlg-head"><span class="dlg-ic">${ICON.runtime}</span><div><h2 id="mv-title">Continue on another runtime</h2><p>“${esc(t.title)}” runs on ${esc(own)}. A new thread picks up its work on the runtime you choose.</p></div></header>` +
      `<fieldset class="mv-f"><legend>Runtime</legend><div class="set-choices">${list.map((x) => {
        const on = M.agent === x.name;
        const sub = !x.usable ? x.why : x.own ? "The same runtime, starting from a fresh context." : "";
        return `<label class="set-choice mv-rt${on ? " is-on" : ""}${x.usable ? "" : " is-off"}"><input type="radio" name="mv-rt" value="${esc(x.name)}"${on ? " checked" : ""}${x.usable && !M.busy ? "" : " disabled"}><span class="sc-dot" aria-hidden="true"></span><span class="sc-b"><b>${esc(rtName(x.name))}${x.own ? " again" : ""}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</span></label>`;
      }).join("")}</div></fieldset>` +
      (M.agent ? `<div class="mv-row"><label class="mv-sel"><span>Model</span><select data-mv-model${M.busy ? " disabled" : ""}><option value="">${loading ? "Default (reading the models…)" : "Default"}</option>${(models || []).filter((m) => !m.is_default).map((m) => `<option value="${esc(m.id)}"${M.model === m.id ? " selected" : ""}>${esc(m.name || m.id)}</option>`).join("")}</select></label>` +
        `<label class="mv-sel"><span>Effort</span><select data-mv-effort${!efforts.length || M.busy ? " disabled" : ""}><option value="">Default</option>${efforts.map((e) => `<option value="${esc(e)}"${M.effort === e ? " selected" : ""}>${esc(EFFORT_WORD[e] || e)}</option>`).join("")}</select></label></div>` +
        (M.modelErr[M.agent] && !loading ? `<p class="mv-note">${esc(M.modelErr[M.agent])}</p>` : "") : "") +
      `<label class="field"><span>Why <em>optional</em></span><input data-mv-reason maxlength="200" value="${esc(M.reason)}" placeholder="For example: ${esc(own)} is at its limit"${M.busy ? " disabled" : ""}></label>` +
      `<div class="mv-cons" id="mv-cons"><p class="mv-cons-h">What happens</p><ul>` +
        `<li>The thread's messages and work go to ${esc(M.agent ? name : "the runtime you choose")}.</li>` +
        `<li>The new agent starts from a summary and the code, and re-reads files.</li>` +
        `<li>Earlier approvals don't carry over.</li>` +
        `<li>This thread is frozen; write in it to pick it back up.</li></ul></div>` +
      (M.err ? `<p class="dlg-err" role="alert">${esc(M.err)}</p>` : "") +
      (M.busy ? `<p class="mv-note" role="status"><i class="spin" aria-hidden="true"></i> Stopping the thread and saving its work…</p>` : "") +
      `<footer class="dlg-foot"><button type="button" class="btn" data-mv-cancel${M.busy ? " disabled" : ""}>Cancel</button>` +
      `<button type="submit" class="btn btn-pri"${M.agent && !M.busy ? "" : " disabled"}>${M.retry ? "Try again" : M.agent ? `Continue on ${esc(name)}` : "No runtime can take it"}</button></footer></form>`;
  }

  async function submit() {
    if (!M.agent || M.busy) return;
    M.busy = true; M.err = null; draw();
    const t = M.t;
    mine.add(t.id);
    try {
      const r = await api.continueThread(t.chatId, t.id, { agent: M.agent, model: M.model || null, effort: M.effort || null, ...(M.reason.trim() ? { reason: M.reason.trim() } : {}) });
      const next = r && r.thread_id ? await world.act.fetchThread(t.chatId, r.thread_id).catch(() => null) : null;
      M.busy = false;
      close(false);
      announce(`Continuing on ${rtName(r.agent || M.agent)}. This thread is frozen; write in it to pick it back up.`);
      if (next) go(`t:${next.id}`);
    } catch (err) {
      M.busy = false;
      M.retry = err.code === "still_busy" || err.code === "timeout" || err.status === 0;
      M.err = err.code === "still_busy" ? "The thread didn't stop in time. Nothing moved; try again." : err.message;
      draw();
      dlg.querySelector('button[type="submit"]')?.focus();
    }
  }
  function close(restore = true) {
    if (!dlg.open || M.busy) return;
    dlg.close();
    if (restore) (M.returnTo && M.returnTo.isConnected ? M.returnTo : null)?.focus?.({ preventScroll: true });
  }

  dlg.addEventListener("change", (e) => {
    if (e.target.name === "mv-rt") { M.agent = e.target.value; M.model = ""; M.effort = ""; M.err = null; M.retry = false; loadModels(M.agent); draw(); dlg.querySelector(`input[name="mv-rt"][value="${CSS.escape(M.agent)}"]`)?.focus(); }
    else if (e.target.matches("[data-mv-model]")) { M.model = e.target.value; const m = (M.models[M.agent] || []).find((x) => x.id === M.model); M.effort = m && m.takes_effort && m.default_effort ? m.default_effort : ""; draw(); dlg.querySelector("[data-mv-model]")?.focus(); }
    else if (e.target.matches("[data-mv-effort]")) M.effort = e.target.value;
  });
  dlg.addEventListener("input", (e) => { if (e.target.matches("[data-mv-reason]")) M.reason = e.target.value; });
  dlg.addEventListener("click", (e) => { if (e.target.closest("[data-mv-cancel]")) close(); else if (e.target === dlg) close(); });
  dlg.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });

  return {
    /** Offered only where another allowed runtime can take work now (and the thread hasn't moved yet). */
    open(t, agentName) {
      M.t = { ...t, agentName }; M.model = ""; M.effort = ""; M.reason = ""; M.err = null; M.retry = false; M.busy = false; M.models = {}; M.modelErr = {};
      M.returnTo = document.activeElement;
      pickDefault();
      draw();
      dlg.showModal();
      loadModels(M.agent);
      dlg.querySelector('input[name="mv-rt"]:checked')?.focus();
    },
    get isOpen() { return dlg.open; },
    /** Did this tab move that thread (so the stream's frame for it needs no herald)? */
    mine: (id) => mine.has(id),
  };
}
