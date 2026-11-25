// @ts-check
import { cardState } from "./card-state.js";

import { esc } from "../../core/platform/util.js";
import { itemParts, questionsOf, VERB } from "../../core/services/review.js";
import { ICON } from "../../core/ui/icons/names.js";
import { RM, morph, expand } from "../../core/ui/motion.js";
import * as Kit from "./kit.js";
import { commandOf } from "./cardparts.js";
import { scopeWords } from "./card.js";

/** @import { CardEventsDeps, CardNeed, CardFrame, CardSurface, CardChoice, NoteMode } from "./card-events-types.d.ts" */

/** @param {CardEventsDeps} options */
export function createCardEvents({ timeout, F, PROJ, teach, decide, failedWords, onOpenThread, setLater, laterNow }) {
  /** @param {HTMLElement} el @param {string} text */
  function hint(el, text) {
    const h = /** @type {HTMLElement} */ (el.querySelector(".c-hint"));
    h.textContent = text;
    h.classList.remove("show"); void h.offsetWidth; h.classList.add("show");
  }

  /** @param {HTMLElement} inner @param {string} which @param {CardNeed} n @param {(() => void) | null} onStep */
  function toggleDis(inner, which, n, onStep) {
    const d = inner.querySelector(`[data-dis="${which}"]`);
    if (!d) return;
    const on = !d.classList.contains("is-open");
    (/** @type {HTMLElement} */ (d.querySelector(".dis-h"))).setAttribute("aria-expanded", String(on));
    const dock = d.closest(".card.is-dock");
    expand(d, d.querySelector(".dis-b"), on, { onStep, frame: dock || null });
    if (which === "ev") F.open0[n.key] = { ...(F.open0[n.key] || {}), ev: on };
    if (on && !d.closest(".is-dock")) timeout(() => d.scrollIntoView({ block: "nearest", behavior: RM.matches ? "auto" : "smooth" }), 340);
  }

  /** @param {CardFrame} frame @param {HTMLElement} el @param {CardNeed} n @param {CardSurface} ctx */
  function wireCard(frame, el, n, ctx) {
    /** @param {string} s */
    const q = (s) => /** @type {HTMLElement} */ (el.querySelector(s));
    const note = q(".c-note");
    const noteIn = /** @type {HTMLTextAreaElement} */ (q(".c-note-in"));
    const shownAt = performance.now();
    const ready = () => performance.now() - shownAt >= Kit.READ_MS;
    const secs = () => Math.max(2, Math.round((performance.now() - shownAt) / 1000));
    /** @param {CardChoice} choice @param {"allow" | "back"} how */
    const go = (choice, how, note = "") => {
      if (!ready()) { if (n.risk === "notable") hint(el, "A beat to read it first."); return null; }
      const entry = decide(n, choice, note, { secs: secs(), inline: ctx.surface === "dock" }); if (entry) ctx.after(how); return entry;
    };
    /** @type {NoteMode | null} */
    let noteMode = null;
    const body = frame;
    const step = ctx.onStep || null;
    /** @param {NoteMode} mode */
    const openNote = (mode) => {
      noteMode = mode;
      q(".c-note-l").textContent = mode === "reply" ? (n.group === "stopped" ? "What should it try?" : "Your answer, in your words") : "What should it do instead? (optional)";
      const no = n.ask.item ? itemParts(n.ask.item).back : null;
      q('[data-act="note-send"]').innerHTML = mode === "reply" ? "Send" : `${ICON.rewind}${esc((no && no.label) || "Send back")}`;
      noteIn.placeholder = mode === "reply" ? (n.group === "stopped" ? "e.g. use the read replica for this step" : "Type your answer") : "e.g. what it should try instead";
      if (!noteIn.value) noteIn.value = failedWords(n.key, mode);
      morph(body, () => { note.hidden = false; el.classList.add("noting"); }, { duration: 280, fade: note });
      if (step) step();
      noteIn.focus({ preventScroll: true });
    };
    const closeNote = () => { morph(body, () => { note.hidden = true; noteMode = null; el.classList.remove("noting"); }, { duration: 260 }); frame.focus({ preventScroll: true }); };
    const sendNote = () => {
      const v = noteIn.value.trim();
      if (noteMode === "reply") { if (!v) { noteIn.focus(); return; } go({ text: v }, "allow"); }
      else { go("deny", "back", v); }
    };
    noteIn.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); sendNote(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeNote(); }
    });
    const state = cardState(frame);
    state.openNote = openNote; state.closeNote = closeNote; state.noting = () => !note.hidden;

    const tryAllow = () => {
      if (n.risk === "destructive") { hint(el, "Destructive asks are never one key: press and hold the button."); return; }
      if (n.group === "stopped") { go({ text: "Please try again from the failing step." }, "allow"); return; }
      if (n.ask.item) {
        if (n.ask.item.kind === "question") { hint(el, "Pick an answer, or answer in words."); return; }
        if (itemParts(n.ask.item).hold) { hint(el, "This one needs a press and hold."); return; }
        el.querySelector('[data-act="allow"]')?.classList.add("pressed");
        const nameIn = /** @type {HTMLInputElement | null} */ (el.querySelector("[data-name]"));
        go(nameIn ? { name: nameIn.value } : "allow", "allow");
        return;
      }
      if (!Kit.isBinary(n.ask)) { hint(el, "Pick an answer, reply in words, or send it back."); return; }
      el.querySelector('[data-act="allow"]')?.classList.add("pressed");
      go("allow", "allow");
    };
    state.allow = tryAllow;
    const carried = !!state.quiet;
    state.quiet = false;
    state.quietOn = (text) => {
      state.quiet = true;
      const h = /** @type {HTMLElement} */ (el.querySelector(".c-hint"));
      h.textContent = `${text} Its keys are paused while you type: press Esc or click the card to use them again.`;
      h.classList.remove("show"); h.classList.add("stay");
    };
    state.quietOff = () => {
      if (!state.quiet) return false;
      state.quiet = false;
      const h = /** @type {HTMLElement} */ (el.querySelector(".c-hint"));
      h.classList.remove("stay"); h.textContent = "";
      return true;
    };
    if (!state.quietWired) {
      state.quietWired = true;
      frame.addEventListener("pointerdown", () => state.quietOff && state.quietOff());
      frame.addEventListener("focusout", (e) => { if (!frame.contains(/** @type {Node | null} */ (e.relatedTarget)) && state.quietOff) state.quietOff(); });
    }
    if (carried) state.quietOn("A new ask took this one's place.");
    state.need = n;

    const qform = /** @type {HTMLFormElement} */ (el.querySelector("[data-qform]"));
    const formChoice = (quiet = false) => {
      const qs = questionsOf(n.ask.item);
      /** @type {Record<string, string | string[]>} */
      const answers = {};
      for (const q of qs) {
        const ins = /** @type {(HTMLInputElement | HTMLTextAreaElement)[]} */ ([...qform.querySelectorAll(`[data-qid="${CSS.escape(q.id)}"]`)]);
        let v;
        if (q.options.length && !q.secret) { const on = ins.filter((x) => (/** @type {HTMLInputElement} */ (x)).checked).map((x) => x.value); v = q.multi ? on : on[0]; }
        else v = (ins[0] && ins[0].value.trim()) || "";
        if (!v || (Array.isArray(v) && !v.length)) { if (!quiet) { hint(el, "Answer every question first."); (ins[0] || qform).focus(); } return null; }
        answers[q.id] = v;
      }
      return qs.length === 1 && !qs[0].multi && !qs[0].secret && !qs[0].options.length ? { text: answers[qs[0].id] } : qs.length === 1 && !qs[0].multi && !qs[0].secret ? { option: answers[qs[0].id] } : { answers };
    };
    if (qform) qform.addEventListener("submit", (e) => {
      e.preventDefault();
      if (qform.querySelector('[data-act="hold"]')) { hint(el, "This one needs a press and hold."); return; }
      const c = formChoice();
      if (c) go(c, "allow");
    });
    el.addEventListener("click", (e) => {
      const io = /** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest("[data-iopt]"));
      if (io) { io.classList.add("pressed"); go({ option: questionsOf(n.ask.item)[0].options[+/** @type {string} */ (io.dataset.iopt)].label }, "allow"); return; }
      const isc = /** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest("[data-iscope]"));
      if (isc) { teach.set(n.key, /** @type {string} */ (isc.dataset.iscope)); paintItemScope(); return; }
      const b = /** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest("[data-act],[data-opt],[data-scope],.dis-h"));
      if (!b) return;
      if (b.classList.contains("dis-h")) { toggleDis(el, (/** @type {HTMLElement & {dataset: {dis: string}}} */ (b.closest("[data-dis]"))).dataset.dis, n, step); return; }
      if (b.dataset.opt != null) { b.classList.add("pressed"); go({ option: (/** @type {string[]} */ (n.ask.options))[+b.dataset.opt] }, "allow"); return; }
      if (b.dataset.scope) { teach.set(n.key, b.dataset.scope); paintTeach(); return; }
      const act = b.dataset.act;
      if (act === "allow") tryAllow();
      else if (act === "back") openNote("back");
      else if (act === "back-now") { go("deny", "back"); }
      else if (act === "reply" || act === "note-reply") openNote("reply");
      else if (act === "note-send") sendNote();
      else if (act === "note-cancel") closeNote();
      else if (act === "retry") { go({ text: "Please try again from the failing step." }, "allow"); }
      else if (act === "thread") onOpenThread && onOpenThread(n.t.id, ctx.surface);
      else if (act === "done") { b.classList.add("pressed"); go({ resolve: true }, "allow"); }
      else if (act === "teach") toggleTeach();
      else if (act === "later") { if (ctx.surface === "panel") setLater(); else { laterNow(n.key); ctx.after("later"); } }
    });

    const paintTeach = () => {
      const tog = q('[data-act="teach"]');
      if (!tog) return;
      const scope = teach.get(n.key);
      tog.setAttribute("aria-pressed", String(!!scope));
      const tb = q(".teach-body");
      if (tb.hidden === !!scope) expand(tb, tb, !!scope, { onStep: step, frame: frame.classList.contains("is-dock") ? frame : null });
      const cmd = commandOf(n.ask);
      for (const r of el.querySelectorAll("[data-scope]")) r.setAttribute("aria-checked", String((/** @type {HTMLElement} */ (r)).dataset.scope === (scope || "exact")));
      q(".teach-q q").textContent = Kit.teachSentence(PROJ(n.t.project), scope === "prefix" ? Kit.prefixOf(cmd) : cmd);
      const al = q('[data-act="allow"] .al-t');
      if (al) al.textContent = scope ? "Allow + rule" : "Allow";
    };
    const paintItemScope = () => {
      const P = itemParts(n.ask.item);
      const id = teach.get(n.key);
      const tog = q('[data-act="teach"]');
      if (tog) tog.setAttribute("aria-pressed", String(!!id));
      const tb = q(".teach-body");
      if (tb && tb.hidden === !!id) expand(tb, tb, !!id, { onStep: step, frame: frame.classList.contains("is-dock") ? frame : null });
      const cur = P.scopes.find((/** @type {{ id: string }} */ o) => o.id === id) || P.scopes[0];
      for (const r of el.querySelectorAll("[data-iscope]")) r.setAttribute("aria-checked", String((/** @type {HTMLElement} */ (r)).dataset.iscope === (id || cur.id)));
      const qq = q(".teach-q");
      if (qq && cur) { (/** @type {HTMLElement} */ (qq.querySelector("span"))).textContent = cur.scope === "rule" ? "Added to your rules, word for word:" : "For this thread only:"; (/** @type {HTMLElement} */ (qq.querySelector("q"))).textContent = cur.sentence || cur.label; }
      const al = q('[data-act="allow"] .al-t');
      if (al) al.textContent = scopeWords(P, id);
    };
    const toggleTeach = () => {
      if (!q('[data-act="teach"]')) return;
      if (n.ask.item) { const P = itemParts(n.ask.item); if (teach.get(n.key)) teach.delete(n.key); else teach.set(n.key, (P.scopes[0] || {}).id); paintItemScope(); return; }
      if (teach.get(n.key)) teach.delete(n.key); else teach.set(n.key, "exact"); paintTeach();
    };
    state.teach = toggleTeach;
    state.dis = (which) => toggleDis(el, which, n, step);

    const hold = q('[data-act="hold"]');
    let holder = null;
    if (hold) {
      holder = Kit.holdButton(hold, {
        ready: () => (!ready() ? "Read it first: the hold starts after a moment." : qform && !formChoice(true) ? "Answer every question first." : true),
        onConfirm: () => {
          hold.classList.add("locked");
          (/** @type {HTMLElement} */ (hold.querySelector(".hold-txt"))).textContent = n.ask.item ? (VERB[/** @type {keyof typeof VERB} */ ((itemParts(n.ask.item).primary || {}).decision)] || "Done") : "Allowed";
          const nameIn = /** @type {HTMLInputElement | null} */ (el.querySelector("[data-name]"));
          const c = qform ? formChoice() : nameIn ? { name: nameIn.value } : "allow";
          timeout(() => { if (c) go(c, "allow"); }, RM.matches ? 0 : 220);
        },
        onRefuse: (why) => { hint(el, why); hold.classList.remove("nope"); void hold.offsetWidth; hold.classList.add("nope"); },
        onRelease: () => hint(el, "Released early. Nothing was sent."),
      });
    }
    if (ctx.surface === "panel") F.hold = holder;
  }

  return wireCard;
}
