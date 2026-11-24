// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { RM } from "../../core/ui/motion.js";
import { redraw } from "../../core/ui/redraw.js";

/** @import { ComposerControlsDeps, Composer } from "./composer-types.d.ts" */

/** @param {ComposerControlsDeps} options */
export function createComposerControls({ MK, S, CH, IQ, PHONE, STOP_ICON, sessionOf, filesHere, running, liveBlock }) {
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
    if (chip._h === html) return;
    const swap = () => { redraw(chip, html); chip._h = html; };
    if (fade && chip._h && !RM.matches) {
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
    sendNowRender();
    const perm = $("#cs-perm"), ph = CH.isChats(S.view) && !liveBlock() ? CH.permHtml(S.view) : "";
    perm.hidden = !ph;
    perm.title = CH.permTitle(S.view);
    fixChip(perm, S.view !== "chats");
    if (perm._h !== ph) { perm.innerHTML = ph; perm._h = ph; }
    if (!CH.isChats(S.view)) { $("#target").hidden = false; return false; }
    const html = CH.blocked(S.view) ? CH.targetHtml(S.view) : liveBlock() ? `<span class="tg-warn">${ICON.pause}</span><span>Sending is paused · ${esc(liveBlock())}</span>` : CH.targetHtml(S.view);
    if ($("#target")._h !== html) { $("#target").innerHTML = html; $("#target")._h = html; }
    $("#target").hidden = !html;
    $("#target").title = S.view === "chats" ? "The folder a new chat works in" : "";
    return true;
  }

  function sendNowRender() {
    const b = $("#send-now");
    const st = CH.isChats(S.view) && !liveBlock() ? CH.nowState(S.view) : null;
    b.hidden = !st;
    if (st) { b.setAttribute("aria-pressed", String(st.on)); b.classList.toggle("is-on", st.on); }
  }

  return { chipRender, sendRender, chatTargetRender };
}
