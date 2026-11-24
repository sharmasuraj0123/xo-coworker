// @ts-check

import { once } from "../../core/platform/pending.js";
import { arrive } from "../../core/ui/motion.js";
import { sound } from "../../core/services/sound.js";
import { sendBlock, sendErrorTitle } from "../../core/services/world/conn.js";
import { parseTarget as targetOf, stripTarget } from "../../core/services/world/conversation.js";
import { noticeFor, refusedNotice } from "../../core/services/notices.js";
import { uploadErrorText } from "../../core/services/media/attachment-rules.js";

/** @import { DeliveryDeps, LocalMessage, Thread, SendFailure } from "./delivery-types.d.ts" */
/** @import { Composer } from "./composer-types.d.ts" */

/** @param {DeliveryDeps} options */
export function createDelivery({
  view: currentView, localMessages, fileReferences, world, MK, say, CH, STAGE, PROJ, chatOf, convOfChat, convThread, convProject, composerAt,
  filesHere, tray, dropThumb, saveDraft, updateComposer, growSay, announce, heraldShow, heraldFor, schedule, render, go,
}) {
  /** @param {string} [view] @param {string} [text] */
  function liveBlock(view = currentView(), text = say.value) {
    if (CH.isChats(view)) return CH.blocked(view) || sendBlock(world.state, { timeline: false });
    return blockFor(composerDest(view, text));
  }

  /** @param {{thread?: boolean, pid?: string | null}} dest */
  function blockFor(dest) {
    return sendBlock(world.state, { timeline: !dest.thread, pid: dest.thread ? null : dest.pid || "workspace" });
  }

  /** @param {string} block @param {string} [kept] */
  function refuse(block, kept = "your words are kept") {
    announce(`Not sent: ${block}. ${kept[0].toUpperCase()}${kept.slice(1)}.`);
    heraldShow(refusedNotice(block, kept), 6000);
  }

  function connDest() { const d = composerDest(); return d.thread ? { thread: true } : { pid: d.pid }; }

  /** @param {string} [view] @param {string} [text] */
  function composerDest(view = currentView(), text = say.value) {
    if (CH.isChats(view)) return { thread: true }; // a plain chat's message is never routed (as liveBlock sends it)
    const tg = targetOf(text, world.state.projects), t = convThread(view);
    return t && !tg.pid ? { thread: true } : { pid: tg.pid || chatOf(view) || "workspace" };
  }

  /** @param {string} raw @param {Composer} [K] */
  function sendLive(raw, K = MK) {
    const block = liveBlock(K.view, K.say.value);
    if (block) { refuse(block, "your text is kept"); return; }
    const tg = targetOf(raw, world.state.projects);
    let text = stripTarget(raw, tg.token);
    const files = filesHere(K.view);
    if (!text && !files.count) return;
    if (files.busy) { announce("Not sent yet: waiting for the files to upload."); return; }
    if (files.failed) { announce("Not sent: a file didn't upload. Retry or remove it first."); return; }
    const t = convThread(K.view);
    const thread = t && !tg.pid ? t : null;
    const chat = thread ? (/** @type {Thread} */ (t)).project : tg.pid || chatOf(K.view) || "workspace";
    const conv = thread ? K.view : convOfChat(chat);
    const here = conv === K.view;
    const ref = here && fileReferences.get(conv);
    if (ref && text) { text = `${ref.a ? `${ref.path}:${ref.a}${ref.b > ref.a ? `-${ref.b}` : ""}` : `File: ${ref.path}`}\n\n${text}`; fileReferences.remove(conv); }
    const chips = files.count ? tray.take(K.view) : undefined;
    chips?.forEach(dropThumb);
    const to = thread ? thread.title || "the thread" : chat === "workspace" ? "the coordinator" : PROJ(chat);
    const m = localMessages.send({ conv, text, target: thread ? null : chat, to, files: chips });
    K.say.value = ""; saveDraft(K); updateComposer(K);
    const btn = K.send; btn.classList.remove("fired"); void btn.offsetWidth; btn.classList.add("fired");
    sound.play("send");
    if (!here && K.view === "home") { go(conv, { carry: true }); K.conv.follow.toLatest(false); arrive(K.conv.msgs.querySelector(`[data-k="${m.id}"]`)); }
    else if (!here) heraldShow(noticeFor(m, "out"), 9000);
    else { render(); K.conv.follow.toLatest(false); arrive(K.conv.msgs.querySelector(`[data-k="${m.id}"]`)); }
    if (thread) STAGE.resumeFollow(conv);
    deliverLive(m, thread);
  }

  /** @param {LocalMessage} m @param {Thread | null} thread */
  function deliverLive(m, thread) { return once(`send:${m.cid}`, () => postLive(m, thread)); }
  /** @param {LocalMessage} m @param {Thread | null} thread */
  async function postLive(m, thread) {
    m.status = "sending"; delete m.err;
    heraldFor(m.id, () => noticeFor(m, "out"));
    try {
      await postWithFiles(m, thread);
      m.status = "sent";
      const where = thread ? "the thread" : m.target === "workspace" ? "the coordinator" : PROJ(m.target);
      announce(`Sent to ${where}.`);
      heraldFor(m.id, () => noticeFor(m, "sent"));
    } catch (err) {
      m.status = "failed";
      m.err = { title: (/** @type {SendFailure} */ (err)).fileErr ? `A file didn't upload: ${uploadErrorText(/** @type {SendFailure} */ (err))}` : (/** @type {SendFailure} */ (err)).code === "unknown_attachment" ? "A file is no longer on the server" : sendErrorTitle(/** @type {SendFailure} */ (err)), text: (/** @type {SendFailure} */ (err)).message || "" };
      announce(`${m.err.title}. ${m.err.text} Your message is kept; retry or edit it.`);
      const fail = noticeFor(m, "failed");
      if (!heraldFor(m.id, () => fail, 6000) && currentView() !== m.conv) heraldShow(fail, 6000);
    }
    schedule();
  }

  /** @param {LocalMessage} m @param {Thread | null} thread */
  async function postWithFiles(m, thread) {
    const project = thread ? thread.project : m.target || "workspace";
    /** @param {string[]} [attachments] */
    const postIt = (attachments) => (thread
      ? world.act.reply(thread.id, m.text, { clientId: m.cid, attachments })
      : world.act.ask(project, m.text, { clientId: m.cid, attachments }));
    const files = m.files;
    if (!files?.length) return postIt();
    const chat = world.act.chatId?.(project);
    /** @param {{again?: boolean}} [opts] */
    const up = (opts) => tray.ensure(files, chat, opts).catch((err) => { throw Object.assign(err, { fileErr: true }); });
    try {
      return await postIt(await up());
    } catch (err) {
      if ((/** @type {SendFailure} */ (err)).code !== "unknown_attachment") throw err;
      return postIt(await up({ again: true }));
    }
  }

  /** @param {Composer} [K] */
  function send(K = MK) {
    const raw = K.say.value;
    const fromSend = document.activeElement === K.send;
    if (CH.isChats(K.view)) {
      const text = raw.trim();
      if (!text) return;
      const block = liveBlock(K.view, K.say.value);
      if (block) { refuse(block, "your text is kept"); return; }
      K.say.value = ""; saveDraft(K); updateComposer(K);
      sound.play("send");
      CH.send(K.view, text);
    } else sendLive(raw, K);
    if (fromSend && document.activeElement !== K.say && !K.say.value) K.say.focus({ preventScroll: true });
  }

  /** @param {string} id */
  function retry(id) {
    const m = localMessages.get(id);
    if (m?.who !== "you") return;
    const block = blockFor(m.target ? { pid: m.target } : { thread: true });
    if (block) { refuse(block, "the message stays, to retry"); return; }
    const had = !!document.activeElement?.closest?.(`[data-retry="${CSS.escape(id)}"]`), K = composerAt(document.activeElement);
    deliverLive(m, m.target ? null : convThread(m.conv));
    schedule();
    if (had) K.say.focus({ preventScroll: true });
  }

  /** @param {string} text @param {Composer} [K] */
  function putBack(text, K = MK) {
    const f = K.say, now = f.value.trim();
    f.value = now ? `${text}\n\n${f.value.replace(/^\s+/, "")}` : text;
    growSay(K); saveDraft(K); updateComposer(K); f.focus();
    f.setSelectionRange(f.value.length, f.value.length);
  }

  /** @param {string} id @param {Composer} [K] */
  function editFailed(id, K = MK) {
    const view = K.view;
    const m = localMessages.removeSend(view, id);
    if (!m) return;
    if (m.files && m.files.length) tray.restore(view, m.files);
    putBack((m.target && m.target !== convProject(view) ? `@${m.target} ` : "") + m.text, K);
    render();
  }

  return { liveBlock, blockFor, refuse, connDest, deliverLive, send, retry, putBack, editFailed };
}
