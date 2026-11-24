// @ts-check

import { $ } from "../../core/platform/dom.js";
import * as K from "../../core/platform/keys.js";
import { itemParts } from "../../core/services/review.js";
import { radioKeys } from "../../core/ui/a11y/keynav.js";
import * as Kit from "./kit.js";

/** @import { CardFrame, NoteMode } from "./card-events-types.d.ts" */

/** @import { DecisionKeyboardDeps, CardKeysOptions } from "./keyboard-types.d.ts" */

/** @param {DecisionKeyboardDeps} options */
export function wireDecisionKeyboard({ panel, stage, F, undo, onOpenThread, close, confirmAll, setLater, skip }) {
  /** @param {KeyboardEvent} e @param {CardFrame | null} card @param {CardKeysOptions} options */
  function cardKeys(e, card, { onEsc, inPanel }) {
    if (e.isComposing || e.keyCode === 229) return false;
    const inField = (/** @type {Element} */ (e.target)).matches?.("textarea, input");
    if (e.key === "Escape") {
      if (card && card._quietOff && card._quietOff()) { e.preventDefault(); e.stopPropagation(); return true; }
      if (card && card._noting && card._noting()) { e.preventDefault(); e.stopPropagation(); (/** @type {() => void} */ (card._closeNote))(); return true; }
      if (onEsc) { e.preventDefault(); e.stopPropagation(); onEsc(); return true; }
      return false;
    }
    if (inField || e.metaKey || e.ctrlKey || e.altKey) return false;
    if ((/** @type {Element} */ (e.target)).closest?.(".b-hold") && (e.key === "Enter" || e.key === " ")) return false;
    if (e.repeat && card && card._n) { e.preventDefault(); e.stopPropagation(); return true; }
    const n = card && card._n;
    if (!n) return false;
    const k = e.key;
    const own = () => { e.preventDefault(); e.stopPropagation(); };
    if (card._quiet && k.length === 1) { own(); return true; }
    /** @param {string} text */
    const refuse = (text) => (/** @type {(message: string) => void} */ ((/** @type {CardFrame} */ (card))._quietOn))(text);
    const it = n.ask.item;
    if (K.is(e, "allow")) { own(); (/** @type {() => void} */ (card._allow))(); }
    else if (K.is(e, "back")) {
      own();
      if (it) { const b = /** @type {HTMLButtonElement | null} */ (card.querySelector('[data-act="back"], [data-act="back-now"]')); if (b) b.click(); else refuse("This one has no way to say no."); }
      else if (n.group === "stopped" || n.ask.replyOnly) (/** @type {(mode: NoteMode) => void} */ (card._openNote))("reply"); else (/** @type {(mode: NoteMode) => void} */ (card._openNote))("back");
    }
    else if (K.is(e, "reply")) {
      if (it ? it.kind === "question" && card.querySelector('[data-act="reply"]') : !Kit.isBinary(n.ask)) { own(); (/** @type {(mode: NoteMode) => void} */ (card._openNote))("reply"); }
      else if (it) { own(); const P = itemParts(it); refuse(`This one is answered with its buttons${P.primary ? `: ${[P.primary.label, P.back && P.back.label].filter(Boolean).join(" or ")}` : ""}.`); }
    }
    else if (K.is(e, "done")) {
      own();
      const b = /** @type {HTMLButtonElement | null} */ (card.querySelector('[data-act="done"]'));
      if (b) b.click(); else refuse("Done is for a thread that replied and waits; this one is answered with its buttons.");
    }
    else if (K.is(e, "details")) { own(); (/** @type {(which: string) => void} */ (card._dis))("ev"); }
    else if (K.is(e, "rule")) { own(); (/** @type {() => void} */ (card._teach))(); }
    else if (K.is(e, "undo")) { own(); undo(); }
    else if (inPanel && K.is(e, "open")) { own(); onOpenThread && onOpenThread(n.t.id, "panel"); }
    else if (/^[1-9]$/.test(k) && it && it.kind === "question") {
      const b = /** @type {HTMLButtonElement | null} */ (card.querySelector(`button[data-pick="${k}"]`));
      const r = !b ? /** @type {HTMLInputElement | null} */ (card.querySelector(`[data-qform] input[data-pick="${k}"]`)) : null;
      if (b) { own(); b.click(); } else if (r) { own(); r.checked = r.type === "checkbox" ? !r.checked : true; r.focus(); } else return false;
    }
    else if (/^[1-9]$/.test(k) && Array.isArray(n.ask.options) && !Kit.isBinary(n.ask)) {
      const o = n.ask.options[+k - 1];
      if (o != null) { own(); (/** @type {HTMLButtonElement | null} */ (card.querySelector(`[data-opt="${+k - 1}"]`)))?.click(); }
    } else return false;
    return true;
  }
  radioKeys(panel);
  panel.addEventListener("keydown", (e) => {
    if (!F.open || e.isComposing || e.keyCode === 229) return;
    const card = $("#card");
    if (e.key === "Escape") {
      const cf = stage.querySelector(".confirm");
      if (cf) { e.preventDefault(); e.stopPropagation(); cf.remove(); card?.focus(); return; }
      if (cardKeys(e, card, {})) return;
      e.preventDefault(); e.stopPropagation(); close(); return;
    }
    if ((/** @type {Element} */ (e.target)).matches?.("textarea, input") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (F.done || F.busy || F.vig || stage.querySelector(".confirm")) return;
    if (/^Arrow/.test(e.key) && (/** @type {Element} */ (e.target)).closest?.('[role="radiogroup"]')) return;
    const n = F.items.get(/** @type {string} */ (F.cur));
    if (!card || !n) return;
    const k = e.key;
    const own = () => { e.preventDefault(); e.stopPropagation(); };
    if (card._quiet && k.length === 1) { own(); return; }
    if (K.is(e, "allowAll")) { own(); confirmAll(); return; }
    if (K.is(e, "later") && n.effort === "think") { own(); setLater(); return; }
    if (K.is(e, "next") || k === "ArrowRight") { own(); skip(1); return; }
    if (K.is(e, "prev") || k === "ArrowLeft") { own(); skip(-1); return; }
    cardKeys(e, card, { inPanel: true });
  });

  return cardKeys;
}
