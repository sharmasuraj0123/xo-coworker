// @ts-check

import { ICON } from "../../core/ui/icons/names.js";
import { esc } from "../../core/platform/util.js";
import { redraw } from "../../core/ui/redraw.js";
import { paintComposerTarget } from "./target-markup.js";
import { fmtSize, kindOf, isLargePaste, pasteLabel, uploadErrorText, FINAL, MAX_FILES } from "../../core/services/media/attachment-rules.js";

/** @import { Composer } from "./composer-types.d.ts" */

/** @import { Chip } from "../../core/services/media/attachment-tray.js" */

/** @import { Notice } from "../../core/services/notices.js" */

/** @typedef {{name: string, type?: string, bytes: number, local?: string, att?: {chat: string, id: string}}} Preview */

/** @typedef {ReturnType<typeof import("../../core/services/media/attachment-tray.js").createTray>} Tray */

/** @typedef {{ MK: Composer, tray: Pick<Tray, "list" | "add" | "addPaste" | "remove" | "retry">, canAttach(view: string): boolean, attachChat(view: string): string | null, announce(text: string): void, heraldShow(notice: Notice, ms: number): void, updateComposer(composer: Composer): void, saveDraft(composer: Composer): void, VW: { open(file: Preview, button: HTMLButtonElement): unknown } }} AttachmentComposerDeps */

/** @param {AttachmentComposerDeps} deps */
export function createComposerAttachments({ MK, tray, canAttach, attachChat, announce, heraldShow, updateComposer, saveDraft, VW }) {
  /** @type {WeakMap<Blob, string>} */
  const thumbs = new WeakMap();
  /** @param {Chip} c */
  const thumbOf = (c) => { let u = thumbs.get(c.blob); if (!u) { u = URL.createObjectURL(c.blob); thumbs.set(c.blob, u); } return u; };
  /** @param {Chip | null | undefined} c */
  const dropThumb = (c) => { const u = c && thumbs.get(c.blob); if (u) { URL.revokeObjectURL(u); thumbs.delete(/** @type {Chip} */ (c).blob); } };

  /** @param {Chip} c */
  function chipHtml(c) {
    const img = c.type ? kindOf(c.type) === "image" : /^image\//.test(c.blob?.type || "");
    const thumb = img && c.blob && c.state !== "failed";
    const ic = thumb ? `<img src="${esc(thumbOf(c))}" alt="" decoding="async">` : img ? ICON.image : ICON.doc;
    const state = c.state === "failed" ? `<span class="att-err">${esc(uploadErrorText(/** @type {{code?: string, message?: string}} */ (c.err)))}</span>`
      : c.state === "uploading" ? `<span class="att-pct">Uploading</span>` : "";
    const sub = [c.paste ? esc(c.name) : esc(fmtSize(c.bytes ?? c.size)), state].filter(Boolean).join(" · ");
    /** @param {string} a @param {string} label @param {string} icon */
    const btn = (a, label, icon, extra = "") => `<button type="button" class="att-b" data-a="${a}" aria-label="${esc(label)}" title="${esc(label)}"${extra}>${icon}</button>`;
    return `<li class="att st-${c.state}${c.paste ? " is-paste" : ""}" data-lid="${esc(c.lid)}"${c.err ? ` title="${esc((/** @type {{message?: string}} */ (c.err)).message || "")}"` : ""}>` +
      (thumb && c.id ? `<button type="button" class="att-ic is-img" data-a="view" aria-label="Preview ${esc(c.name)}" title="Preview">${ic}</button>` : `<span class="att-ic${thumb ? " is-img" : ""}">${ic}</span>`) +
      `<span class="att-t"><span class="att-n">${esc(c.paste ? pasteLabel(c.paste) : c.name)}</span><span class="att-m">${sub}</span></span>` +
      (c.paste ? btn("view", "Preview the pasted text", ICON.eye) + `<button type="button" class="att-tx" data-a="inline" title="Put it back in the message as text">As text</button>` : "") +
      (c.state === "failed" && !FINAL.has(/** @type {string} */ ((/** @type {{code?: string} | undefined} */ (c.err))?.code)) ? btn("retry", `Retry ${c.name}`, ICON.retry) : "") +
      btn("x", `Remove ${c.paste ? "the pasted text" : c.name}`, ICON.close) +
      `<i class="att-bar" aria-hidden="true"></i></li>`;
  }
  /** @param {Composer} [K] */
  function trayRender(K = MK) {
    const on = canAttach(K.view);
    K.attach.hidden = !on;
    const list = on ? tray.list(K.view) : [];
    K.tray.hidden = !list.length;
    K.note.hidden = !list.length;
    K.form.classList.toggle("has-files", !!list.length);
    const html = list.map(chipHtml).join("");
    paintComposerTarget(K.tray, html, redraw);
    for (const c of list) {
      const el = (/** @type {HTMLElement | null} */ (K.tray.querySelector(`[data-lid="${CSS.escape(c.lid)}"]`)));
      if (!el) continue;
      const p = c.state === "uploading" ? Math.min(1, (c.sent || 0) / Math.max(1, c.size)) : c.state === "done" ? 1 : 0;
      el.style.setProperty("--p", String(p));
      const pct = el.querySelector(".att-pct");
      if (pct) pct.textContent = c.sent ? `${Math.floor(p * 100)}%` : "Uploading";
    }
  }
  /** @param {Iterable<File> | null | undefined} files @param {Composer} [K] */
  function addFiles(files, K = MK) {
    const list = [...(files || [])];
    if (!list.length) return;
    if (!canAttach(K.view)) { announce("Files can't be attached in this conversation."); return; }
    const chat = attachChat(K.view);
    if (!chat) { heraldShow({ kind: "stopped", text: "Files can't be attached yet", sub: "still connecting to XO" }, 4600); return; }
    const refused = tray.add(K.view, chat, list);
    const took = list.length - refused.length;
    if (refused.length) {
      heraldShow({ kind: "stopped", text: refused.length === 1 ? `${refused[0].name} wasn't attached` : `${refused.length} files weren't attached`, sub: refused[0].why }, 6000);
      announce(`${refused.map((r) => `${r.name}: ${r.why}`).join(" ")}`);
    }
    if (took) announce(`${took === 1 ? "1 file" : `${took} files`} uploading.`);
    updateComposer(K);
    K.say.focus({ preventScroll: true });
  }
  /** @param {string} text @param {Composer} [K] */
  function insertText(text, K = MK) {
    K.say.focus({ preventScroll: true });
    K.say.setRangeText(text, K.say.selectionStart, K.say.selectionEnd, "end");
    updateComposer(K); saveDraft(K);
  }

  /** @param {Composer} K @param {ReturnType<typeof import("../../core/kernel/scope.js").createScope>} scope */
  function wireTray(K, scope) {
    scope.listen(K.tray, "click", (e) => {
      const b = /** @type {HTMLButtonElement} */ ((/** @type {Element} */ (e.target)).closest("[data-a]"));
      const li = b && /** @type {HTMLElement & {dataset: {lid: string}} | null} */ (b.closest("[data-lid]"));
      if (!li) return;
      const lid = li.dataset.lid, c = tray.list(K.view).find((x) => x.lid === lid);
      if (!c) return;
      if (b.dataset.a === "x") {
        const next = li.nextElementSibling?.querySelector("[data-a=x]") || li.previousElementSibling?.querySelector("[data-a=x]");
        if (li.contains(document.activeElement)) (/** @type {HTMLElement} */ (next || K.say)).focus({ preventScroll: true });
        dropThumb(tray.remove(K.view, lid));
        announce(`${c.paste ? "The pasted text" : c.name} removed.`);
        trayRender(K);
      } else if (b.dataset.a === "retry") {
        if (b === document.activeElement) (/** @type {HTMLElement | null} */ (li.querySelector("[data-a=x]")))?.focus({ preventScroll: true });
        tray.retry(K.view, lid);
        trayRender(K);
      }
      else if (b.dataset.a === "view" && c.paste != null) VW.open({ name: c.name, bytes: c.size, local: c.paste }, b);
      else if (b.dataset.a === "view" && c.chat && c.id) {
        VW.open({ name: c.name, type: c.type, bytes: c.bytes ?? c.size, att: { chat: c.chat, id: c.id } }, b);
      }
      else if (b.dataset.a === "inline") { tray.remove(K.view, lid); insertText(/** @type {string} */ (c.paste), K); announce("The pasted text is back in the message."); }
    });
    scope.listen(K.say, "paste", (e) => {
      const cd = (/** @type {ClipboardEvent} */ (e)).clipboardData;
      if (!cd || !canAttach(K.view)) return;
      const files = [...(cd.files || [])];
      if (files.length) { e.preventDefault(); addFiles(files, K); return; }
      const text = cd.getData("text/plain");
      if (!text || !isLargePaste(text)) return;
      const chat = attachChat(K.view);
      if (!chat) return;
      e.preventDefault();
      if (!tray.addPaste(K.view, chat, text)) { insertText(text, K); announce(`A message takes at most ${MAX_FILES} files, so the paste went in as text.`); return; }
      announce("The long paste was added as a file. As text puts it back in the message.");
      updateComposer(K);
    });
  }

  return { trayRender, addFiles, insertText, wireTray, dropThumb };
}
