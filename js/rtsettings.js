// Settings › Runtimes: the agents XO can run threads on, how healthy each is and how much of its usage
// is left; then the defaults, in four plain lines. A project's own runtime is chosen where its model is,
// in the composer's picker, never here.
//
// Every value is the server's (GET /api/chat/runtimes, /runtime-policy). The runtimes are read when the
// page opens and every 30 s while it is on screen, never faster: each read probes the CLIs. A default
// is saved as it is changed (a PUT that replaces the Space's policy); a refusal is said under it.
//
// The page is drawn in place (js/redraw.js): the control under the keyboard stays the same node. A save answers
// once until it settles (js/pending.js): the defaults say they're waiting (aria-busy, not disabled, so focus and
// the Tab order stay), a repeat joins it, and a failure keeps what was typed.

import { esc } from "./world.js";
import { clockWords, rtName, isInstalled, healthOf, windowsOf, resetWords, allowedOf, defaultOf, errorField } from "./runtimes.js";
import { once, isPending, busyAttrs } from "./pending.js";
import { redraw } from "./redraw.js";
import { rovingTab } from "./keynav.js";

const REFRESH_MS = 30000;
const PREF_MAX = 2000;
const blank = () => ({ allowed: null, default: null, preferences: null, fallback: null });
const pct = (u) => `${Math.round(u * 100)}%`;
// the Space's policy is replaced whole by each save, so saves go one at a time
const POLICY = "runtime-policy";

/**
 * The runtime new work actually goes to when its coordinator doesn't choose, as XO itself picks it (xo-space
 * runtime_policy.choose, d2eaedf): the policy's default if it's allowed, else XO's own runtime if allowed, else the
 * first allowed runtime that's installed, in XO's order. XO keeps default:null in the policy and decides this itself,
 * so Settings works it out the same way to show what applies (a default that's excluded is never shown chosen).
 */
export function usualOf(policy, rts) {
  const list = rts || [];
  const permits = (a) => !!a && !(policy && Array.isArray(policy.allowed) && !policy.allowed.includes(a));
  const own = defaultOf({ default: null }, list);
  return [policy && policy.default, own].find(permits) || (list.find((r) => permits(r.name) && isInstalled(r)) || {}).name || null;
}

/**
 * "Saved", said beside a field for a while (ms): each receipt clears only itself, never a newer one on the same
 * field (a timer keyed by the field alone cut a second save's "Saved" short). onClear redraws. A receipt holds what
 * the server took (value), and says Saved only while the field still shows exactly that (says): a newer draft typed
 * while an older save was out is not saved, so it's never said to be (the create-project/Launchpad grader on 9d1f71b,
 * S098: the server held A and "Saved" stood beside B).
 */
export const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export function receipts(ms, onClear) {
  let cur = null;
  return {
    /** The field whose "Saved" shows now, or null. */
    get field() { return cur && cur.field; },
    /** Is "Saved" true beside this field, which now shows `now`? */
    says(field, now) { return !!cur && cur.field === field && sameValue(cur.value, now); },
    set(field, value) {
      const r = { field, value };
      cur = r;
      const t = setTimeout(() => { if (cur === r) { cur = null; onClear(); } }, ms);
      t.unref?.();
    },
    clear() { cur = null; },
  };
}

export function createRuntimeSettings({ world, announce, PROJ }) {
  // pref: what's typed in "How coordinators choose" and not saved yet (kept through a failed save);
  // next: the policy a save has out, shown (as waiting) until the server answers
  // saving: the field whose save is out (said "Saving…" beside it until XO answers, never as saved before);
  // saved: the receipt said after XO's answer
  // later: a draft was left while another save was out; it goes once that one lands
  const R = { timer: null, err: null, saved: receipts(1600, () => { if (onScreen()) draw(); }), saving: null, pref: null, next: null, later: false };
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
      `<p class="rt-checked">${at ? `Checked at ${esc(clockWords(at))}. ` : ""}Read again every 30 seconds while this page is open.</p>`;
  }

  // ── the defaults ──────────────────────────────────────────────────────────
  const space = () => ({ ...blank(), ...((world.state.policy && world.state.policy.space) || {}) });
  /** What the defaults show: the policy being saved while its save is out (said as waiting), else the server's. */
  const shown = () => R.next || space();
  /** Save one default: drawn as waiting while it's out, drawn again once it settles. True when it saved. */
  async function put(patch, field, words) {
    if (isPending(POLICY)) return false; // the one already out is answered first; this press joins nothing new
    const next = { ...space(), ...patch };
    if (next.preferences != null && !String(next.preferences).trim()) next.preferences = null;
    R.err = null; R.next = next; R.saving = field; R.saved.clear();
    const p = once(POLICY, async () => {
      try { await world.act.setPolicy(null, next); }
      catch (err) { R.err = { field: errorField(err) === "form" ? field : errorField(err), text: err.message }; return false; }
      finally { R.next = null; R.saving = null; } // saved: the server's own answer shows; refused: what was there before
      R.saved.set(field, next[field]); announce(words);
      return true;
    });
    draw();
    const ok = await p;
    draw();
    // a draft left while this save was out (it couldn't start then): saved now, in its turn, unless you're back in
    // the field typing (then leaving it saves it, as ever)
    if (R.later) { R.later = false; if (!(document.activeElement && document.activeElement.matches && document.activeElement.matches("[data-rtd-pref]"))) savePref(); }
    return ok;
  }
  /** What a field shows now: the preference's draft while there is one, else the defaults as drawn. */
  const fieldNow = (f) => (f === "preferences" && R.pref != null ? (R.pref.trim() || null) : shown()[f]);
  function defaultsHtml() {
    if (!world.state.policy) return "";
    const p = shown(), names = installed().map((r) => r.name);
    if (names.length < 2 && !p.allowed) return ""; // one runtime: nothing to choose
    const allowed = allowedOf(p, rts());
    const usual = usualOf(p, rts()); // what XO actually uses, even with default:null and its own runtime excluded
    // beside each default: its refusal, "Saving…" while its save is out (the choice shows, said as not yet saved),
    // then "Saved" only once XO has answered
    const note = (f) => (R.err && R.err.field === f ? `<p class="rt-ferr" role="alert">${esc(R.err.text)}</p>`
      : R.saving === f ? `<span class="rt-saved is-saving" role="status">Saving…</span>`
        : R.saved.says(f, fieldNow(f)) ? `<span class="rt-saved" role="status">Saved</span>` : "");
    const busy = busyAttrs(POLICY);
    const row = (f, label, sub, ctl) => `<div class="set-row rt-def"><div class="set-l"><b id="rtd-${f}">${label}</b><span>${sub}</span>${note(f)}</div>${ctl}</div>`;
    return `<section class="set-sec" aria-labelledby="rtsp-h"><h3 id="rtsp-h">Defaults</h3>` +
      `<p class="set-lead">Each thread runs on one runtime for its whole life. A project or a thread picks its own in the composer, beside its model.</p>` +
      `<div class="rt-defs">` +
      row("default", "Usual runtime", "Where new work runs when its coordinator doesn't choose.",
        `<div class="rt-seg" role="radiogroup" aria-labelledby="rtd-default">${allowed.map((n, i) => `<button type="button" role="radio" aria-checked="${usual === n}" data-rtd-default="${esc(n)}"${rovingTab(usual === n, i === 0 && !allowed.includes(usual))}${busy}>${esc(rtName(n))}</button>`).join("")}</div>`) +
      row("allowed", "Runtimes XO may use", "Work never goes to a runtime you turn off: no thread starts or moves there.",
        `<div class="rt-checks" role="group" aria-labelledby="rtd-allowed">${names.map((n) => `<label class="rt-check"><input type="checkbox" data-rtd-allowed="${esc(n)}"${allowed.includes(n) ? " checked" : ""}${busy}><span>${esc(rtName(n))}</span></label>`).join("")}</div>`) +
      row("fallback", "Start elsewhere at a limit", "When a runtime can't take work, a new thread may start on another one. <strong>It goes to another provider without asking you.</strong>",
        `<button type="button" class="switch" role="switch" aria-checked="${!!p.fallback}" aria-labelledby="rtd-fallback" data-rtd-fallback${busy}><span class="th-track" aria-hidden="true"><span class="th-knob"></span></span></button>`) +
      `<div class="set-row rt-def is-col"><div class="set-l"><label for="rtd-pref"><b id="rtd-preferences">How coordinators choose</b></label><span>In your words, read when a coordinator on Auto picks a runtime for a new thread.</span>${note("preferences")}</div>` +
      `<div class="field"><textarea id="rtd-pref" rows="2" maxlength="${PREF_MAX}" data-rtd-pref placeholder="Refactors and tests on Codex, UI work on Claude Code.">${esc(R.pref != null ? R.pref : p.preferences || "")}</textarea></div></div>` +
      `</div></section>`;
  }

  // ── drawing ───────────────────────────────────────────────────────────────
  function draw() {
    const el = live();
    if (el) redraw(el, `<section class="set-sec" aria-labelledby="rtl-h"><h3 id="rtl-h">On this machine</h3><div class="rt-live">${listHtml()}</div></section>` + defaultsHtml());
  }
  /** Only the runtimes' cards: a refresh never touches a default under the person's fingers. */
  function drawList() { const l = live()?.querySelector(".rt-live"); if (l) redraw(l, listHtml()); else draw(); }

  async function refresh() {
    clearTimeout(R.timer);
    if (!onScreen()) return;
    try { await world.act.loadRuntimes(); } catch { /* the cards keep the last reading */ }
    if (!onScreen()) return;
    drawList();
    R.timer = setTimeout(refresh, REFRESH_MS);
  }

  // ── changes: each one saves at once ─────────────────────────────────────────
  const root = document.querySelector("#settings");
  root.addEventListener("click", (e) => {
    // a box can't change while a save is out (aria-disabled doesn't stop a checkbox by itself)
    if (e.target.matches?.("[data-rtd-allowed]") && isPending(POLICY)) { e.preventDefault(); return; }
    const d = e.target.closest("[data-rtd-default]");
    // choosing what already applies changes nothing; choosing XO's own runtime (when it's allowed) stores null, as XO does
    if (d && !isPending(POLICY)) { const n = d.dataset.rtdDefault; if (n !== usualOf(space(), rts())) put({ default: n === defaultOf({ default: null }, rts()) ? null : n }, "default", `New work runs on ${rtName(n)} unless its coordinator chooses.`); return; }
    const f = e.target.closest("[data-rtd-fallback]");
    if (f && !isPending(POLICY)) { const on = !space().fallback; put({ fallback: on }, "fallback", on ? "A new thread may start on another runtime at a limit." : "A new thread waits for its runtime at a limit."); }
  });
  root.addEventListener("change", (e) => {
    if (!e.target.matches("[data-rtd-allowed]") || isPending(POLICY)) return;
    const names = installed().map((r) => r.name);
    const picked = [...live().querySelectorAll("[data-rtd-allowed]:checked")].map((x) => x.dataset.rtdAllowed);
    if (!picked.length) { e.target.checked = true; R.err = { field: "allowed", text: "Keep at least one runtime." }; draw(); return; }
    const p = space();
    const allowed = picked.length === names.length ? null : picked; // every runtime: null, so a new one is welcome too
    put({ allowed, ...(p.default && !picked.includes(p.default) ? { default: null } : {}) }, "allowed", allowed ? `XO uses only ${picked.map(rtName).join(" and ")}.` : "XO may use every runtime.");
  });
  root.addEventListener("input", (e) => { if (e.target.matches("[data-rtd-pref]")) R.pref = e.target.value; });
  // leaving the field saves it; the draft is kept until the save lands (a refusal keeps it on screen, to try again)
  root.addEventListener("focusout", (e) => { if (e.target.matches("[data-rtd-pref]")) savePref(); });
  async function savePref() {
    if (R.pref == null) return;
    // another default's save is out: this draft waits for it, then goes (it was dropped: S098)
    if (isPending(POLICY)) { R.later = true; return; }
    const v = R.pref;
    if ((v.trim() || null) === (space().preferences || null)) { R.pref = null; draw(); return; }
    const ok = await put({ preferences: v.trim() || null }, "preferences", "Saved. Coordinators read it when they choose.");
    // typed on while it saved: that's the new draft, still to save (Saved isn't said beside it: it isn't the server's)
    if (ok && R.pref === v) { R.pref = null; draw(); }
  }
  // a new reading from elsewhere (another tab's save) shows while the page is open, never mid-typing
  if (world.subscribe) {
    let sig = "";
    world.subscribe(() => {
      if (!onScreen()) return;
      const next = JSON.stringify(world.state.policy);
      if (next === sig) return;
      sig = next;
      if (!isPending(POLICY) && R.pref == null) draw();
    });
  }

  return {
    /** The page was opened: read the runtimes and the defaults now, then the runtimes every 30 s while it shows. */
    open() {
      R.err = null;
      draw();
      refresh();
      world.act.loadPolicies?.().then(() => { if (onScreen() && R.pref == null) draw(); });
    },
  };
}
