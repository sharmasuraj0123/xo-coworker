// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { fileIcon } from "../../core/ui/icons/fileicons.js";
import { redraw } from "../../core/ui/redraw.js";
import { noticeFor } from "../../core/services/notices.js";
import { sound } from "../../core/services/sound.js";

/** @import { FileQuestionDeps, FileReference, QuestionFile } from "./file-question-types.d.ts" */

/** @import { LocalMessage } from "./delivery-types.d.ts" */

/** @import { FileScope } from "../../core/services/types.d.ts" */

/** @param {FileQuestionDeps} deps */
export function createFileQuestion({
  S, world, PROJ, convOfChat, CH, say, VW, STAGE, go, announce, heraldShow, schedule, blockFor, refuse, deliverLive,
  fileScope, localIn, lineRef, fileRef,
}) {
  /** @param {string} text */
  function youText(text) {
    const r = lineRef(text);
    if (!r) {
      const f = fileRef(text);
      if (!f) return esc(text);
      return `<a href="#${esc(f.path)}" class="lk lk-in lk-file" data-ref="${esc(f.path)}" title="${esc(f.path)}"><span class="lk-ic">${fileIcon(f.path.split("/").pop())}</span><span class="lk-t">${esc(f.path.split("/").pop())}</span></a>\n${esc(f.rest)}`;
    }
    const name = r.path.split("/").pop(), lines = r.a === r.b ? `${r.a}` : `${r.a}–${r.b}`;
    return `<a href="#${esc(r.path)}" class="lk lk-in lk-file" data-ref="${esc(r.path)}" data-ref-a="${r.a}" data-ref-b="${r.b}" title="${esc(`${r.path}, ${r.a === r.b ? "line" : "lines"} ${lines}`)}"><span class="lk-ic">${fileIcon(name)}</span><span class="lk-t">${esc(name)} · ${lines}</span></a>\n${esc(r.rest)}`;
  }
  /** @param {QuestionFile | null | undefined} f */
  function askPlace(f) {
    if (!f || !f.project || !f.rel) return null;
    const fs = /** @type {FileScope} */ (fileScope(f, { threads: world.state.threads, project: PROJ }));
    const path = fs && localIn(fs, f);
    if (path == null) return null;
    const thread = fs.tid ? world.thread(fs.tid) : null;
    return thread ? { conv: `t:${thread.id}`, thread, chat: thread.project, name: thread.title || "this thread", path } : { conv: convOfChat(f.project), thread: null, chat: f.project, name: PROJ(f.project), path };
  }
  /** @param {QuestionFile} f @param {number} a @param {number} b @param {string} text */
  function askAboutLines(f, a, b, text) {
    const at = askPlace(f);
    return !!at && sendAbout(f, `${at.path}:${a}${b > a ? `-${b}` : ""}\n\n${text}`);
  }
  /** @param {QuestionFile} f @param {number} a @param {number} b */
  function composeAbout(f, a, b) {
    const at = askPlace(f);
    if (!at || at.conv !== S.view || CH.isChats(S.view)) return false;
    S.lref[S.view] = { path: at.path, a, b, name: f.name || at.path.split("/").pop() };
    lrefRender();
    say.focus({ preventScroll: true });
    announce(`Lines ${a}${b > a ? ` to ${b}` : ""} of ${(/** @type {FileReference} */ (S.lref[S.view])).name} are in your message. Write your question.`);
    return true;
  }
  /** @param {QuestionFile} f */
  function askAboutFile(f) {
    const at = askPlace(f);
    if (!at) { announce("This file isn't in a project XO can ask about."); return false; }
    const ref = { path: at.path, a: null, b: null, name: f.name || at.path.split("/").pop() };
    if (at.conv !== S.view) { VW.close({ restore: false }); go(at.conv); }
    S.lref[at.conv] = ref;
    lrefRender();
    say.focus({ preventScroll: true });
    announce(`${ref.name} is in your message to ${at.name}. Write your question.`);
    return true;
  }
  function lrefRender() {
    const r = S.lref[S.view], el = $("#cref");
    const lines = r && r.a ? ` · ${r.a}${(/** @type {number} */ (r.b)) > r.a ? `–${r.b}` : ""}` : "";
    const html = r ? `<a href="#${esc(r.path)}" class="lk lk-in lk-file" data-ref="${esc(r.path)}"${r.a ? ` data-ref-a="${r.a}" data-ref-b="${r.b}"` : ""} title="${esc(r.a ? `${r.path}, ${r.a === r.b ? "line" : "lines"} ${r.a}${(/** @type {number} */ (r.b)) > r.a ? `–${r.b}` : ""}` : r.path)}"><span class="lk-ic">${fileIcon(r.name)}</span><span class="lk-t">${esc(r.name)}${lines}</span></a>` +
      `<button type="button" class="cref-x" data-lref-x aria-label="${r.a ? `Take ${r.a === r.b ? "the line" : "the lines"} out of this message` : `Take ${esc(r.name || r.path.split("/").pop())} out of this message`}" title="${r.a ? (r.a === r.b ? "Take it out" : "Take them out") : "Take the file out"}">${ICON.close}</button>` : "";
    el.hidden = !r;
    if (el._h !== html) { redraw(el, html); el._h = html; }
  }
  /** @param {QuestionFile} f @param {string} text */
  function sendAbout(f, text) {
    const at = askPlace(f);
    if (!at) return false;
    const block = blockFor(at.thread ? { thread: true } : { pid: at.chat });
    if (block) { refuse(block); return false; }
    /** @type {LocalMessage} */
    const m = { id: `l${++S.n}_${Date.now().toString(36)}`, conv: at.conv, at: Date.now(), who: "you", text, status: "sending", target: at.thread ? null : at.chat, to: at.name, cid: `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}` };
    (S.local[at.conv] = S.local[at.conv] || []).push(m);
    sound.play("send");
    heraldShow(noticeFor(m, "out"), 9000);
    if (at.thread) STAGE.resumeFollow(at.conv);
    deliverLive(m, at.thread);
    schedule();
    return true;
  }

  return { youText, askPlace, askAboutLines, composeAbout, askAboutFile, lrefRender };
}
