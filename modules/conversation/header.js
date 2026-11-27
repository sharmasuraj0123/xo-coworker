// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { busyAttrs } from "../../core/platform/pending.js";
import { heldBadge } from "../../core/services/world/held.js";
import { stateMark, xi } from "../../core/ui/icons/icon.js";
import { ICON } from "../../core/ui/icons/names.js";
import { headerActionsHtml } from "../../shell/header.js";

/** @import { HeaderDeps, HeaderNeed, HeaderThread } from "./header-types.d.ts" */

/** @template {HeaderNeed} N @param {HeaderDeps<N>} options */
export function createConversationHeader({
  threadControls, description, world, PICK, LP, LW, STAGE, places, atOf, convHost, isHeld,
  threadCounts, PROJ, projectIcon, projectTint, threadsCtl, threadTitleInput, threadLabelInput, threadMenuHtml, stOf, glyphOf, wordOf, rtTag,
}) {
  /** @param {string} v @param {N[]} needs */
  function hostNeedHtml(v, needs) {
    const h = convHost(v);
    if (!h) return "";
    const n = needs.find((x) => x.t.id === h.id && !x.later && (x.admitted || x.held));
    if (!n) return "";
    const k = h.asks.length;
    const who = h.asker ? "Coordinator" : h.title;
    return `<button type="button" class="pj-need" data-dock-open="${esc(n.key)}" title="Open the decision, above the composer">` +
      `${stateMark("needs_approval")}<span class="pj-nt">${esc(who)} needs you</span>${k > 1 ? ` <span class="pj-k">${k}</span>` : ""}</button>`;
  }

  /** @param {string} v @param {HeaderThread | null | undefined} t @param {N[]} needs */
  function conversationHeaderHtml(v, t, needs) {
    let who;
    let controls = "";
    if (v === "ws") {
      who = `<span class="tw-ic" aria-hidden="true">${xi("layers")}</span><span class="tw-t is-one"><h1 id="conv-title">Workspace</h1>${hostNeedHtml(v, needs)}</span>`;
    } else if (v.startsWith("p:")) {
      const pid = v.slice(2);
      const by = threadCounts(pid, needs);
      const need = hostNeedHtml(v, needs);
      const desc = description(pid);
      who = `<button type="button" class="pj-pick" data-pj-icon="${esc(pid)}" aria-haspopup="dialog" aria-expanded="${PICK.pid === pid}" title="Change ${esc(PROJ(pid))}'s icon" aria-label="Change ${esc(PROJ(pid))}'s icon"><span class="tw-ic" data-tint="${projectTint(pid)}" aria-hidden="true">${projectIcon(pid)}</span></button><span class="tw-t is-one"><h1 id="conv-title"${desc ? ` title="${esc(desc)}"` : ""}>${esc(PROJ(pid))}</h1>${need}</span>`;
      controls = threadsCtl(by.all, by);
    } else if (t) {
      const current = threadControls.edit(), edit = current?.tid === t.id ? current : null;
      const ed = edit?.field, edVal = edit?.value || "", edBusy = edit?.busy ? ' aria-busy="true" readonly' : "";
      const title = ed === "title"
        ? threadTitleInput(edVal, edBusy)
        : `<h1 class="tw-h" id="conv-title">${esc(t.title)}</h1>`;
      const label = ed === "label"
        ? threadLabelInput(edVal, edBusy)
        : t.label ? `<span class="tw-label" title="Label">${esc(t.label)}</span>` : "";
      const resolved = t.state === "resolved";
      const menu = threadControls.menuOpen(t.id, "main");
      const acts = world.act.storm ? `<span class="tw-acts"><button type="button" class="tw-act" data-key="tw-resolve" data-resolve="${esc(t.id)}" data-to="${resolved ? "open" : "resolve"}"${busyAttrs(`resolve:${t.id}`)} title="${resolved ? "Reopen it: its agent can pick it up again" : "Mark it resolved: nothing more is owed"}">${resolved ? ICON.retry : ICON.check}<span>${resolved ? "Reopen" : "Resolve"}</span></button>` +
        `<button type="button" class="tw-act tw-more" data-tmenu="${esc(t.id)}" aria-haspopup="menu" aria-expanded="${menu}" title="Everything this thread can do" aria-label="Thread actions">${ICON.more}</button>` +
        (menu ? threadMenuHtml(t) : "") + `</span>` : "";
      const ext = headerActionsHtml(places, atOf(v)), allActs = acts ? acts.replace(/<\/span>$/, `${ext}${LP.button(v, LW.isOpen)}${STAGE.button(v)}</span>`) : `<span class="tw-acts">${ext}${LP.button(v, LW.isOpen)}${STAGE.button(v)}</span>`;
      who = `${title}${label}<span class="badge st-${stOf(t)}">${stateMark(glyphOf(t))}${isHeld(t) ? heldBadge(t.held) : wordOf(t)}</span>${rtTag(t)}${allActs}`;
      if (ed && $("#tw-edit")) who = null;
    } else who = `<span class="tw-t"><h1 id="conv-title">Thread</h1></span>`;
    return { who, controls };
  }

  return conversationHeaderHtml;
}
