// @ts-check

import { esc } from "../../core/platform/util.js";
import { parseTarget as targetOf } from "../../core/services/world/conversation.js";
import { ICON } from "../../core/ui/icons/names.js";
import { paintComposerTarget } from "./target-markup.js";

/** @import { TargetDeps, Thread, Composer } from "./target-types.d.ts" */

/** @param {TargetDeps} options */
export function createComposerTarget({ MK, world, CH, PHONE, PROJ, convThread, convProject, liveBlock, isBusy, sendWhileRunning, noun }) {
  /** @param {Thread} t */
  function threadTargetHtml(t) {
    if (t.frozen) return `<span class="tg-t">${ICON.thread}</span><span><span class="tg-w">Reply in </span><b>this ${noun("thread")}</b></span><span class="muted">· sending picks it back up</span>`;
    const how = isBusy(t) && t.state !== "resolved" ? sendWhileRunning(t) : null;
    const tail = how === "steered" ? `<span class="muted">· sent into the current turn</span>` : how === "queued" ? `<span class="muted">· queued for the next turn</span>` : "";
    return `<span class="tg-t">${ICON.thread}</span><span><span class="tg-w">Reply in </span><b>this ${noun("thread")}</b></span>${tail}`;
  }

  /** @param {Composer} [K] */
  function targetLineRender(K = MK) {
    const tg = targetOf(K.say.value, world.state.projects);
    const pid = tg.pid;
    const t = convThread(K.view);
    const block = liveBlock(K.view, K.say.value);
    let html;
    if (block) html = `<span class="tg-warn">${ICON.pause}</span><span>Sending is paused · ${esc(block)}</span>`;
    else if (pid === "workspace") html = `${ICON.arrow}<span><span class="tg-w">To the </span><b>Workspace</b><span class="tg-w"> coordinator</span></span>`;
    else if (pid) html = `${ICON.arrow}<span>New work for <b>${esc(PROJ(pid))}</b></span>`;
    else if (t) html = threadTargetHtml(t);
    else if (K.view === "ws" || K.view === "home") html = `${ICON.arrow}<span><span class="tg-w">To the </span><b>Workspace</b><span class="tg-w"> coordinator</span></span><span class="muted">· @ to aim at a project</span>`;
    else html = `${ICON.arrow}<span><span class="tg-w">To the </span><b>${esc(PROJ(convProject(K.view)))}</b><span class="tg-w"> coordinator</span></span>`;
    paintComposerTarget(K.target, html);
    K.target.title = "Aim at a project (@)";
  }

  /** @param {Composer} [K] */
  function syncPlaceholder(K = MK) {
    if (CH.isChats(K.view)) { const ph = CH.placeholder(K.view); if (K.say.placeholder !== ph) { K.say.placeholder = ph; K.label.textContent = ph; } return; }
    const t = convThread(K.view), pid = convProject(K.view);
    // (a thread that isn't here has no project to name: its composer isn't drawn, and its label says only "Message")
    const ph = t ? (t.state === "resolved" ? "Reply to reopen it…" : t.frozen ? "Write here to pick this thread back up…" : "Reply to the agent…") : K.view === "home" ? (PHONE.matches ? "What should get done?" : "What should get done? Use @project to aim it") : K.view === "ws" ? "Ask anything across your projects…" : pid ? `Message ${PROJ(pid)}…` : "Message";
    if (K.say.placeholder !== ph) { K.say.placeholder = ph; K.label.textContent = ph; }
  }

  return { targetLineRender, syncPlaceholder };
}
