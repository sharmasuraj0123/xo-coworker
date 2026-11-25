// @ts-check
import { mountPressRoutes, valuePress } from "../../shell/conversation-press.js";
import { createDrafts } from "./drafts.js";
import { createDelivery } from "./delivery.js";
import { createFileReferenceLine } from "./file-reference-line.js";
import { createFileReferences } from "./file-references.js";
import { createComposerTarget } from "./target.js";
import { createMentionList } from "./mention-input.js";
import { createConversationStarts } from "./start.js";
import { createComposerControls } from "./composer-controls.js";
import { createComposer } from "./composer.js";
import { createComposerAttachments } from "./composer-attachments.js";
import { mountMainComposer } from "./main-composer.js";
import { createTray } from "../../core/services/media/attachment-tray.js";
import { uploadAttachment } from "../../core/platform/api.js";
import { ICON } from "../../core/ui/icons/names.js";

/** @param {import("./composer-types").ComposerScope} scope @param {import("./composer-surface-types").ComposerHost} host */
export function createComposerSurface(scope, host) {
  const { view, session, localMessages, world, CH, STAGE, PROJ, chatOf, convOfChat, convThread, convProject,
    announce, heraldShow, heraldFor, schedule, render, go, PHONE, isBusy, sendWhileRunning, noun, IQ, sessionOf, running,
    projects, projectIcon, stopRun, VW, SHAPE } = host;
  const STOP_ICON = ICON.stop;
  const MK = session.composer;
  const { say } = MK;
  const { composerAt } = session.focus;
  const { saveDraft, loadDraft } = createDrafts(MK, (composer) => { mentions.reset(composer); updateComposer(composer); });
  const { startHtml, startDraft } = createConversationStarts({
    SHAPE, PROJ, say, growSay: () => growSay(), saveDraft, updateComposer: () => updateComposer(),
  });
  let trayFrame = false;
  const tray = createTray({ upload: uploadAttachment, onChange: () => {
    if (trayFrame) return;
    trayFrame = true;
    scope.frame(() => { trayFrame = false; trayRender(); sendRender(); });
  } });
  const canAttach = (/** @type {string} */ v) => !CH.isChats(v);

  const attachChat = (/** @type {string} */ v) => { const p = chatOf(v); return p && world.act.chatId ? world.act.chatId(p) : null; };
  const filesHere = (target = view()) => canAttach(target) ? tray.status(target) : { count: 0, busy: false, failed: false };
  const { trayRender, addFiles, insertText, wireTray, dropThumb } = createComposerAttachments({
    MK, tray, canAttach, attachChat, announce, heraldShow, updateComposer: (K) => updateComposer(K), saveDraft, VW,
  });
  const fileReferences = createFileReferences();
  const lrefRender = createFileReferenceLine({ view, fileReferences });
  const { liveBlock, blockFor, refuse, connDest, deliverLive, send, retry, putBack, editFailed } = createDelivery({
    view, signal: scope.signal, localMessages, fileReferences, world, MK, say, CH, STAGE, PROJ, chatOf, convOfChat, convThread,
    convProject, composerAt: (node) => composerAt(node),
    filesHere, tray, dropThumb, saveDraft, updateComposer: (K) => updateComposer(K), growSay: (K) => growSay(K),
    announce, heraldShow, heraldFor, schedule, render, go,
  });

  const { targetLineRender, syncPlaceholder } = createComposerTarget({
    MK, world, CH, PHONE, PROJ, convThread, convProject, liveBlock, isBusy, sendWhileRunning, noun,
  });
  const { chipRender, sendRender, chatTargetRender } = createComposerControls({
    MK, CH, IQ, PHONE, STOP_ICON, sessionOf, filesHere, running, liveBlock,
  });
  const mentions = createMentionList({ MK, world, projects, projectIcon, isBusy, saveDraft, updateComposer: (K) => updateComposer(K) });
  const { wireComposer, growSay, updateComposer } = createComposer({
    MK, say, trayRender, chipRender, lrefRender, chatTargetRender, syncPlaceholder, sendRender,
    targetLineRender, connDest, schedule, mentions, saveDraft, send, stopRun,
  });
  mountMainComposer(scope, MK, { wireTray, wireComposer, composerAt, canAttach, addFiles });
  scope.effect(() => mountPressRoutes(host.places, "xo.conversation", {
    start: valuePress("data-start", (id) => startDraft(+id), true),
    retry: valuePress("data-retry", retry),
    edit: valuePress("data-edit", (id, control) => editFailed(id, composerAt(control))),
    "remove-reference": valuePress("data-lref-x", () => { fileReferences.remove(view()); lrefRender(); say.focus(); }, true),
  }));
  return { saveDraft, loadDraft, startHtml, addFiles, insertText, wireTray,
    fileReferences, lrefRender, liveBlock, blockFor, refuse, connDest, deliverLive, putBack, targetLineRender,
    syncPlaceholder, chipRender, sendRender, chatTargetRender, mentions, wireComposer, updateComposer };
}
