// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { RM } from "../../core/ui/motion.js";
import { redraw } from "../../core/ui/redraw.js";
import { paintComposerTarget } from "./target-markup.js";

/** @import { ComposerControlsDeps, Composer } from "./composer-types.d.ts" */

/** @param {ComposerControlsDeps} options */
export function createComposerControls({ MK, CH, IQ, PHONE, STOP_ICON, sessionOf, filesHere, running, liveBlock }) {
  /** @type {WeakMap<HTMLElement, string>} */
  const markup = new WeakMap();
  /** @param {boolean} [fade] @param {Composer} [K] */
  function chipRender(fade = false, K = MK) {
    const chip = K.iq;
    if (!chip) return;
    const s = sessionOf(K.view);
    const chat = CH.isChats(K.view) && K === MK, fixed = chat && K.view !== "chats";
    chip.hidden = chat ? !CH.chipHtml(K.view) : CH.isChats(K.view) || !IQ.kindOf(s);
    if (chip.hidden) return;
    const html = chat ? CH.chipHtml(K.view) : IQ.chipHtml(s, PHONE.matches);
    const title = chat ? CH.chipTitle(K.view) : IQ.chipTitle(s);
    chip.title = title;
    chip.setAttribute("aria-label", `Intelligence: ${title.replace(/ \([^)]*\)$/, "")}`);
    chip.setAttribute("aria-controls", chat ? "cs-pop" : "iq-pop");
    fixChip(chip, fixed);
    chip.classList.toggle("is-pinned", !chat && IQ.current(s).pinned);
    if (markup.get(chip) === html) return;
    const swap = () => { redraw(chip, html); markup.set(chip, html); };
    if (fade && markup.get(chip) && !RM.matches) {
      chip.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 80, fill: "forwards" }).finished.then(() => { swap(); chip.getAnimations().forEach((a) => a.cancel()); chip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 80 }); });
    } else swap();
  }

  /** @param {Composer} [K] */
  function sendRender(K = MK) {
    const btn = K.send;
    const files = filesHere(K.view);
    const empty = !K.say.value.replace(/(^|\s)@[\w.-]+/, "").trim() && !files.count;
    const run = empty ? running(K.view) : null;
    const mode = run ? "stop" : "send";
    if (btn.dataset.mode !== mode) {
      btn.dataset.mode = mode;
      redraw(btn, run ? STOP_ICON : ICON.send);
      btn.classList.toggle("is-stop", !!run);
    }
    btn.disabled = !run && (empty || !!liveBlock(K.view, K.say.value) || files.busy || files.failed);
    const wait = files.busy ? "Waiting for the files to upload" : files.failed ? "A file didn't upload: retry or remove it" : "";
    btn.setAttribute("aria-label", run ? (run.kind === "coord" ? "Stop the reply" : "Stop this run") : wait ? `Send · ${wait}` : "Send");
    btn.title = run ? (run.kind === "coord" ? "Stop the coordinator" : "Stop the agent (it keeps what's done)") : wait || "Send (Enter)";
  }
  /** @param {HTMLElement} el @param {boolean} on */
  function fixChip(el, on) {
    el.classList.toggle("is-fixed", on);
    if (on) { el.setAttribute("aria-disabled", "true"); el.removeAttribute("aria-haspopup"); }
    else { el.removeAttribute("aria-disabled"); el.setAttribute("aria-haspopup", "dialog"); }
  }
  function chatTargetRender() {
    const view = MK.view;
    sendNowRender(view);
    const perm = $("#cs-perm"), ph = CH.isChats(view) && !liveBlock() ? CH.permHtml(view) : "";
    perm.hidden = !ph;
    perm.title = CH.permTitle(view);
    fixChip(perm, view !== "chats");
    if (markup.get(perm) !== ph) { perm.innerHTML = ph; markup.set(perm, ph); }
    if (!CH.isChats(view)) { $("#target").hidden = false; return false; }
    const html = CH.blocked(view) ? CH.targetHtml(view) : liveBlock() ? `<span class="tg-warn">${ICON.pause}</span><span>Sending is paused · ${esc(liveBlock())}</span>` : CH.targetHtml(view);
    paintComposerTarget($("#target"), html);
    $("#target").hidden = !html;
    $("#target").title = view === "chats" ? "The folder a new chat works in" : "";
    return true;
  }

  /** @param {string} view */
  function sendNowRender(view) {
    const b = $("#send-now");
    const st = CH.isChats(view) && !liveBlock() ? CH.nowState(view) : null;
    b.hidden = !st;
    if (st) { b.setAttribute("aria-pressed", String(st.on)); b.classList.toggle("is-on", st.on); }
  }

  return { chipRender, sendRender, chatTargetRender };
}
