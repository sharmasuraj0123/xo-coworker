// Settings › Runtimes (mixed runtimes F2, F3): the agents XO can run threads on, how healthy each is
// and how much of its usage is left; then where work may run, for the Space and for each project.
//
// Every value is the server's (GET /api/chat/runtimes, …/runtime-policy). The runtimes are read when
// the page opens and every 30 s while it is on screen, never faster: each read probes the CLIs. A
// policy is changed only by Save (a PUT that replaces it), and a refusal lands on its field.

import { esc } from "./world.js";
import { rtName, isInstalled, healthOf, windowsOf, resetWords, allowedOf, defaultOf, policyWords, policyErrors, errorField } from "./runtimes.js";

const REFRESH_MS = 30000;
const PREF_MAX = 2000;
const FIELDS = ["allowed", "default", "preferences", "fallback"];
const blank = () => ({ allowed: null, default: null, preferences: null, fallback: null });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pct = (u) => `${Math.round(u * 100)}%`;

export function createRuntimeSettings({ world, announce, PROJ }) {
  const R = { timer: null, drafts: {}, errs: {}, saving: null, editing: null, loadErr: null };
  const page = () => document.querySelector('[data-page="runtimes"]');
  const live = () => page()?.querySelector(".set-live");
  const onScreen = () => { const p = page(); return !!p && !p.hidden && !document.querySelector("#settings").hidden; };
  const rts = () => world.state.runtimes || [];
  const installed = () => rts().filter(isInstalled);

  // ── the runtimes, as they are now (F2) ────────────────────────────────────
  function cardHtml(rt) {
    const h = rt.health || {}, hl = healthOf(rt);
    const ver = h.cli_version || (rt.cli && rt.cli.version);
    const acct = h.logged_in ? `Logged in${h.account ? ` as <span class="rt-acct">${esc(h.account)}</span>` : ""}` : "";
    const wins = windowsOf(rt);
    const meters = wins.map((w) => {
      const tone = w.state === "closed" ? "bad" : w.state === "warn" || w.state === "paid" ? "warn" : "ok";
      const word = w.state === "closed" ? "At limit" : w.state === "paid" ? "Paid usage" : w.utilization != null ? `${pct(w.utilization)} used` : w.state === "warn" ? "Near limit" : "Open";
      const reset = w.resetsAt ? `${w.state === "closed" ? "Opens" : "Resets"} ${resetWords(w.resetsAt)}` : "";
      return `<li class="rt-w t-${tone}"><span class="rt-wn">${esc(w.name)}</span>` +
        (w.utilization != null || w.state === "closed" ? `<span class="rt-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((w.utilization ?? 1) * 100)}" aria-label="${esc(w.name)}: ${esc(word)}"><i style="--u:${w.utilization ?? 1}"></i></span>` : `<span class="rt-bar is-none"></span>`) +
        `<span class="rt-wu">${esc(word)}</span><span class="rt-wr">${esc(reset)}</span></li>`;
    }).join("");
    const trouble = hl.tone === "off" || hl.tone === "bad";
    return `<li class="rt-card${trouble ? " is-down" : ""}">` +
      `<div class="rt-hd"><b>${esc(rtName(rt.name))}</b>${ver ? `<span class="rt-v">${esc(ver)}</span>` : ""}${rt.default ? `<span class="rt-v">XO's own</span>` : ""}<span class="rt-pill t-${hl.tone}">${esc(hl.word)}</span></div>` +
      (acct ? `<p class="rt-sub">${acct}</p>` : "") +
      (hl.why || hl.fix ? `<p class="rt-why">${esc(hl.why)}${hl.fix ? ` <span class="rt-fix">${fixHtml(hl.fix)}</span>` : ""}</p>` : "") +
      (meters ? `<ul class="rt-ws" aria-label="${esc(rtName(rt.name))}'s usage">${meters}</ul>` : "") + `</li>`;
  }
  /** A fix may name a command in backticks: shown as code, never run. */
  const fixHtml = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
  function listHtml() {
    if (!world.state.runtimes) return `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`;
    if (!rts().length) return `<p class="set-empty"><b>No runtimes.</b> XO didn't list any agent runtime on this server.</p>`;
    const at = rts().map((r) => r.health && r.health.checked_at).filter(Boolean).sort().pop();
    return `<ul class="rt-list">${rts().map(cardHtml).join("")}</ul>` +
      `<p class="rt-checked">${at ? `Checked at ${esc(new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}. ` : ""}Read again every 30 seconds while this page is open.</p>`;
  }

  // ── the policy (F3) ───────────────────────────────────────────────────────
  // key "space" is the Space's own policy; a chat id is that project's override (null fields follow the Space)
  const baseOf = (k) => (k === "space" ? world.state.policy && world.state.policy.space : world.state.chatPolicy[k] && world.state.chatPolicy[k].project) || blank();
  const draftOf = (k) => R.drafts[k] || baseOf(k);
  const dirty = (k) => !!R.drafts[k] && !same(R.drafts[k], { ...blank(), ...baseOf(k) });
  const effOf = (k) => (k === "space" ? world.state.policy && world.state.policy.effective : world.state.chatPolicy[k] && world.state.chatPolicy[k].effective);
  const spaceEff = () => (world.state.policy && world.state.policy.effective) || blank();
  /** The policy the draft would make, for the default's choices (a project's null fields are the Space's). */
  const wouldBe = (k) => { const d = draftOf(k); if (k === "space") return d; const s = spaceEff(); const o = {}; for (const f of FIELDS) o[f] = d[f] ?? s[f]; return o; };

  function seg(k, name, opts, cur, label) {
    return `<div class="rt-seg" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v, w]) => `<button type="button" role="radio" aria-checked="${cur === v}" data-rtp-${name}="${esc(v)}">${esc(w)}</button>`).join("")}</div>`;
  }
  function formHtml(k) {
    const d = draftOf(k), proj = k !== "space", e = R.errs[k] || {};
    const s = spaceEff();
    const err = (f) => (e[f] ? `<p class="rt-ferr" id="rte-${esc(k)}-${f}" role="alert">${esc(e[f])}</p>` : "");
    const desc = (f, hint) => `aria-describedby="rth-${esc(k)}-${f}${e[f] ? ` rte-${esc(k)}-${f}` : ""}"${hint ? "" : ""}`;
    // allowed: the Space's (projects) / every runtime / only these
    const mode = d.allowed == null ? (proj ? "space" : "all") : "only";
    const names = [...new Set([...installed().map((r) => r.name), ...(d.allowed || [])])];
    const allowed = `<div class="rt-f"><div class="rt-fl"><b id="rtl-${esc(k)}-allowed">Runtimes it may use</b><span id="rth-${esc(k)}-allowed">Limit it to one and its work never goes to another provider: no moves, no fallback.</span></div>` +
      seg(k, "allowed", [...(proj ? [["space", `As all projects (${s.allowed ? s.allowed.map(rtName).join(", ") : "all"})`]] : []), ["all", "All"], ["only", "Only these"]], mode, "Runtimes it may use") +
      (mode === "only" ? `<div class="rt-checks" role="group" aria-labelledby="rtl-${esc(k)}-allowed" ${desc("allowed")}>${names.map((n) => `<label class="rt-check"><input type="checkbox" data-rtp-rt="${esc(n)}"${(d.allowed || []).includes(n) ? " checked" : ""}><span>${esc(rtName(n))}</span></label>`).join("")}</div>` : "") + err("allowed") + `</div>`;
    // default: one of what it may use
    const pool = allowedOf(wouldBe(k), rts());
    const serverDefault = defaultOf({ default: null }, rts());
    const def = `<div class="rt-f"><label class="rt-fl" for="rtd-${esc(k)}"><b>Usual runtime</b><span id="rth-${esc(k)}-default">Where a thread runs when its coordinator doesn't choose.</span></label>` +
      `<select class="set-sel" id="rtd-${esc(k)}" data-rtp-default ${desc("default")}><option value="">${proj ? `As all projects (${esc(rtName(s.default || serverDefault))})` : `XO's own (${esc(rtName(serverDefault))})`}</option>` +
      [...new Set([...pool, ...(d.default ? [d.default] : [])])].map((n) => `<option value="${esc(n)}"${d.default === n ? " selected" : ""}>${esc(rtName(n))}</option>`).join("") + `</select>` + err("default") + `</div>`;
    // preferences: the owner's words, read by the coordinator
    const len = (d.preferences || "").length;
    const pref = `<div class="rt-f"><label class="rt-fl" for="rtp-${esc(k)}"><b>How to choose</b><span id="rth-${esc(k)}-preferences">In your words. The coordinator reads this when it picks a runtime for a new thread.${proj ? " Left empty, the words for all projects apply." : ""}</span></label>` +
      `<div class="field"><textarea id="rtp-${esc(k)}" rows="3" maxlength="${PREF_MAX}" data-rtp-pref placeholder="${esc(proj && s.preferences ? s.preferences : "Refactors and tests on Codex, UI work on Claude Code.")}" ${desc("preferences")}>${esc(d.preferences || "")}</textarea></div>` +
      `<span class="rt-count${len > PREF_MAX * 0.9 ? " is-near" : ""}" data-rtp-count aria-live="polite">${len.toLocaleString()} / ${PREF_MAX.toLocaleString()}</span>` + err("preferences") + `</div>`;
    // fallback: off unless set; its consequence always said
    const fbOn = d.fallback === true;
    const fb = `<div class="rt-f"><div class="rt-fl"><b id="rtl-${esc(k)}-fallback">Start elsewhere when the usual one can't</b><span id="rth-${esc(k)}-fallback">When the chosen runtime can't take work, a new thread may start on another allowed runtime. <strong>Threads may start on another provider without asking you.</strong></span></div>` +
      (proj ? seg(k, "fb", [["space", `As all projects (${s.fallback ? "on" : "off"})`], ["on", "On"], ["off", "Off"]], d.fallback == null ? "space" : fbOn ? "on" : "off", "Start elsewhere")
        : `<button type="button" class="switch" role="switch" aria-checked="${fbOn}" aria-labelledby="rtl-${esc(k)}-fallback" aria-describedby="rth-${esc(k)}-fallback" data-rtp-fb="${fbOn ? "off" : "on"}"><span class="th-track" aria-hidden="true"><span class="th-knob"></span></span></button>`) +
      err("fallback") + `</div>`;
    const busy = R.saving === k;
    return `<form class="rt-form" data-rtp="${esc(k)}" novalidate>${allowed}${def}${pref}${fb}${err("form")}` +
      `<div class="set-fa"><button type="button" class="btn" data-rtp-cancel>${dirty(k) ? "Discard" : "Close"}</button><button type="submit" class="btn btn-pri"${dirty(k) && !busy ? "" : " disabled"}>${busy ? `<i class="spin" aria-hidden="true"></i> Saving` : "Save"}</button></div></form>`;
  }
  /** One row per scope (the Space, then each project): what is in effect, and Change to open its form under it. */
  function policyHtml() {
    if (!world.state.policy) return "";
    const ps = world.state.projects.filter((p) => p.kind === "project" && p.chatId && world.state.chatPolicy[p.chatId]);
    const row = (k, name, sub) => {
      const open = R.editing === k;
      return `<div class="set-row rt-prow${open ? " is-open" : ""}"><div class="set-l"><b>${esc(name)}</b><span>${esc(sub)}</span></div>` +
        (open ? "" : `<button type="button" class="btn" data-rtp-edit="${esc(k)}" aria-label="Change where ${esc(name)} runs">Change</button>`) + `</div>` + (open ? formHtml(k) : "");
    };
    return `<section class="set-sec" aria-labelledby="rtsp-h"><h3 id="rtsp-h">Where work runs</h3>` +
      `<p class="set-lead">Each thread runs on one runtime for its whole life. Its coordinator chooses which, within these limits.</p><div class="rt-projects">` +
      row("space", "All projects", policyWords(effOf("space"), rts())) +
      ps.map((p) => { const own = baseOf(p.chatId); return row(p.chatId, PROJ(p.id), FIELDS.some((f) => own[f] != null) ? policyWords(effOf(p.chatId), rts()) : "As all projects"); }).join("") +
      `</div></section>`;
  }

  // ── drawing ───────────────────────────────────────────────────────────────
  function draw() {
    const el = live();
    if (!el) return;
    const a = document.activeElement;
    let focusSel = null;
    if (a && el.contains(a)) {
      const form = a.closest("[data-rtp]");
      const d = [...a.attributes].find((x) => x.name.startsWith("data-rtp"));
      if (d) focusSel = `${form ? `[data-rtp="${CSS.escape(form.dataset.rtp)}"] ` : ""}[${d.name}${d.value ? `="${CSS.escape(d.value)}"` : ""}]`;
    }
    el.innerHTML = `<section class="set-sec" aria-labelledby="rtl-h"><h3 id="rtl-h">On this machine</h3><div class="rt-live">${listHtml()}</div></section>` + policyHtml() +
      (R.loadErr ? `<p class="set-err" role="alert">${esc(R.loadErr)}</p>` : "");
    if (focusSel) el.querySelector(focusSel)?.focus({ preventScroll: true });
  }
  /** Only the runtimes' cards: a refresh never touches a form under the person's fingers. */
  function drawList() { const l = live()?.querySelector(".rt-live"); if (l) l.innerHTML = listHtml(); else draw(); }

  async function refresh() {
    clearTimeout(R.timer);
    if (!onScreen()) return;
    try { await world.act.loadRuntimes(); } catch { /* the cards keep the last reading */ }
    if (!onScreen()) return;
    drawList();
    R.timer = setTimeout(refresh, REFRESH_MS);
  }

  // ── changes ───────────────────────────────────────────────────────────────
  const setDraft = (k, patch) => { R.drafts[k] = { ...blank(), ...draftOf(k), ...patch }; if (R.errs[k]) { for (const f of Object.keys(patch)) delete R.errs[k][f]; delete R.errs[k].form; } };
  async function save(k) {
    const d = { ...blank(), ...draftOf(k) };
    if (d.preferences != null && !d.preferences.trim()) d.preferences = null;
    const errs = policyErrors(d);
    if (Object.keys(errs).length) { R.errs[k] = errs; draw(); focusFirstError(k); return; }
    R.saving = k; R.errs[k] = {}; draw();
    try {
      await world.act.setPolicy(k === "space" ? null : k, d);
      delete R.drafts[k];
      R.editing = null;
      announce(k === "space" ? "Saved. New threads follow it." : `Saved for ${PROJ(world.act.projectOf ? world.act.projectOf(k) : k)}.`);
    } catch (err) {
      R.errs[k] = { [errorField(err)]: err.message };
    }
    R.saving = null; draw();
    if (R.errs[k] && Object.keys(R.errs[k]).length) focusFirstError(k);
  }
  function focusFirstError(k) {
    const f = live()?.querySelector(`[data-rtp="${CSS.escape(k)}"]`);
    const first = FIELDS.find((x) => R.errs[k] && R.errs[k][x]);
    const sels = { allowed: ["[data-rtp-rt]", '[data-rtp-allowed][aria-checked="true"]'], default: ["[data-rtp-default]"], preferences: ["[data-rtp-pref]"], fallback: ["[data-rtp-fb]"] }[first] || [];
    for (const sel of sels) { const el = f?.querySelector(sel); if (el) { el.focus(); break; } }
  }

  const root = document.querySelector("#settings");
  root.addEventListener("click", (e) => {
    const t = e.target;
    const ed = t.closest("[data-rtp-edit]");
    if (ed) { R.editing = ed.dataset.rtpEdit; draw(); live()?.querySelector(`[data-rtp="${CSS.escape(R.editing)}"] [role="radio"][aria-checked="true"]`)?.focus(); return; }
    const form = t.closest("[data-rtp]");
    if (!form) return;
    const k = form.dataset.rtp;
    const al = t.closest("[data-rtp-allowed]");
    if (al) {
      const v = al.dataset.rtpAllowed;
      const cur = draftOf(k).allowed;
      setDraft(k, { allowed: v === "only" ? (cur || allowedOf(wouldBe(k), rts())) : null });
      draw(); return;
    }
    const fb = t.closest("[data-rtp-fb]");
    if (fb) { const v = fb.dataset.rtpFb; setDraft(k, { fallback: v === "space" ? null : v === "on" }); draw(); return; }
    if (t.closest("[data-rtp-cancel]")) {
      delete R.drafts[k]; delete R.errs[k];
      R.editing = null; draw(); live()?.querySelector(`[data-rtp-edit="${CSS.escape(k)}"]`)?.focus();
    }
  });
  root.addEventListener("change", (e) => {
    const form = e.target.closest("[data-rtp]");
    if (!form) return;
    const k = form.dataset.rtp;
    if (e.target.matches("[data-rtp-rt]")) {
      const picked = [...form.querySelectorAll("[data-rtp-rt]:checked")].map((x) => x.dataset.rtpRt);
      const d = draftOf(k);
      setDraft(k, { allowed: picked, ...(d.default && !picked.includes(d.default) ? { default: null } : {}) });
      draw();
    } else if (e.target.matches("[data-rtp-default]")) { setDraft(k, { default: e.target.value || null }); draw(); }
  });
  root.addEventListener("input", (e) => {
    if (!e.target.matches("[data-rtp-pref]")) return;
    const form = e.target.closest("[data-rtp]"), k = form.dataset.rtp;
    const v = e.target.value;
    setDraft(k, { preferences: v === "" ? null : v });
    // no re-draw while typing: the counter and Save follow in place
    const c = form.querySelector("[data-rtp-count]");
    if (c) { c.textContent = `${v.length.toLocaleString()} / ${PREF_MAX.toLocaleString()}`; c.classList.toggle("is-near", v.length > PREF_MAX * 0.9); }
    const sv = form.querySelector('button[type="submit"]');
    if (sv) sv.disabled = !dirty(k) || R.saving === k;
    const cancel = form.querySelector("[data-rtp-cancel]");
    if (cancel) cancel.textContent = dirty(k) ? "Discard" : "Close";
    form.querySelector(".rt-ferr[id$='-preferences']")?.remove();
  });
  root.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-rtp]");
    if (!form) return;
    e.preventDefault();
    save(form.dataset.rtp);
  });
  // what the stream changes (a new reading, another tab's save) shows while the page is open, never mid-edit
  if (world.subscribe) {
    let sig = "";
    world.subscribe(() => {
      if (!onScreen()) return;
      const next = JSON.stringify([world.state.policy, world.state.chatPolicy]);
      if (next === sig) return;
      sig = next;
      if (!R.saving && !Object.keys(R.drafts).some(dirty)) draw();
    });
  }

  return {
    /** The page was opened: read the runtimes and the policies now, then every 30 s while it shows. */
    open() {
      R.loadErr = null;
      draw();
      refresh();
      world.act.loadPolicies?.().then(() => { if (onScreen() && !Object.keys(R.drafts).some(dirty)) draw(); });
    },
  };
}
