import { esc } from "../../core/platform/index.js";
import { attachmentUrl } from "../../core/platform/api.js";
import { kindOf, typeWord } from "../../core/services/media/attachment-rules.js";
import { fileIcon } from "../../core/ui/icons/fileicons.js";
import { ICON } from "../../core/ui/icons/names.js";
import { xi } from "../../core/ui/icons/icon.js";
import { redrawNode } from "../../core/ui/redraw.js";
import { countsHtml } from "../../core/ui/components/counts.js";
import { keyHtml } from "../../core/ui/a11y/keycap.js";
import { byWords } from "./documents.js";
import { whenWords } from "./version-time.js";

export const size = (n) => (n == null || !Number.isFinite(n) ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const extOf = (name) => (/\.([\w-]+)$/.exec(String(name || "")) || [])[1] || "";
const KIND_WORD = { markdown: "Markdown", html: "HTML", text: "Text", code: "Code", json: "JSON" };

const LOCK_IC = xi("lock", "", "sm");
const BOLT_IC = xi("runs-code", "", "sm");
const NOT_EDITABLE = {
  read_only_place: "Read only · XO keeps this file",
  too_large: "Too large to edit here",
  truncated: "Too large to edit here",
  not_utf8: "Not plain text",
  not_text: "Not plain text",
  historical: "An earlier version: read only",
  attachment: "Read only",
};
const MORE_IC = ICON.more;
const SPLIT_IC = ICON.split;
const SRC_IC = ICON.code;
const PAGE_IC = ICON.doc;
const PREV_IC = ICON.back;
const NEXT_IC = ICON.right;

export function createViewerHead({ V, TX, el, doc, canSave, chg, showsDiff, showsText, runsCode, ask, threadTitle }) {
  function moreHtml(f, canCopy, folds = []) {
    const url = f.att ? esc(attachmentUrl(f.att.chat, f.att.id)) : "";
    const items = [
      canCopy && `<button type="button" role="menuitem" data-vw-copy>${ICON.copy}<span>Copy</span></button>`,
      canSave() && `<button type="button" role="menuitem" data-vw-copy-path>${ICON.copy}<span>Copy path</span></button>`,
      f.att ? (kindOf(f.type || "") === "text"
        ? `<a role="menuitem" href="${url}" download="${esc(f.name || "file")}">${ICON.download}<span>Download</span></a>`
        : `<a role="menuitem" href="${url}" target="_blank" rel="noopener noreferrer">${ICON.out}<span>Open in a new tab</span></a>`)
        : canSave() && `<button type="button" role="menuitem" data-vw-download>${ICON.download}<span>Download</span></button>`,
    ].filter(Boolean);
    if (!items.length && !folds.length) return "";
    const busy = !!(V.busy && V.busy.shown), done = !busy && V.copied, word = busy ? (V.busy.kind === "copy" ? "Copying…" : "Downloading…") : done ? "Copied" : "";
    const only = items.length ? "" : ` only-folds${folds.some((x) => x.includes("f-wide")) ? " fw" : ""}${folds.some((x) => x.includes("f-narrow")) ? " fn" : ""}`;
    return `<span class="vw-mw${only}"><button type="button" class="vw-btn vw-more${done ? " is-done" : busy ? " is-busy" : ""}" data-vw-more aria-haspopup="menu" aria-expanded="${!!V.menu}" title="${word || "Copy, download"}" aria-label="${word || "More: copy, download"}"${busy ? ' aria-disabled="true" aria-busy="true"' : ""}>` +
      `${done ? ICON.check : busy ? `<i class="spin" aria-hidden="true"></i>` : MORE_IC}${word ? `<span>${word}</span>` : ""}</button>` +
      (V.menu ? `<span class="vw-menu" role="menu" aria-label="${esc(f.name || "This file")}">${folds.join("")}${items.join("")}</span>` : "") + `</span>`;
  }
  function menuOff(back = false) {
    if (!V.menu) return;
    V.menu = false;
    paintHead();
    if (back) el.querySelector("[data-vw-more]")?.focus({ preventScroll: true });
  }
  const shown = (root, sel) => [...root.querySelectorAll(sel)].find((x) => x.getClientRects().length > 0) || null;
  const menuItems = () => [...el.querySelectorAll(".vw-menu :is([role=menuitem],[role=menuitemradio])")].filter((x) => x.getClientRects().length > 0);
  function stateHtml(d) {
    if (!d || d.state === "readonly") return "";
    if (d.state === "conflict") { const n = d.merge ? d.merge.left : 0; return `<span class="xd-state is-need" role="status"><i></i>${n} ${n === 1 ? "place" : "places"} to choose</span>`; }
    if (d.state === "saving") return `<span class="xd-state is-quiet" role="status" title="Saving…"><span class="spin" aria-hidden="true"></span><span class="sr-only">Saving…</span></span>`;
    if (d.state === "dirty") return `<span class="xd-state is-unsaved" role="status" title="Unsaved · ${MODK}S saves it">${xi("save")}<span class="sr-only">Unsaved</span>${keyHtml(`${MODK}S`)}</span>`;
    if (d.state === "deleted") return `<span class="xd-state is-need" role="status" title="${esc(d.err || "")}"><i></i>Deleted on disk</span>`;
    if (d.state === "error") return `<span class="xd-state is-need" role="status" title="${esc(d.err || "")}"><i></i>Not saved</span>`;
    return V.savedFlash === d ? `<span class="xd-state is-quiet is-done" role="status" title="Saved">${ICON.check}<span class="sr-only">Saved</span></span>` : "";
  }
  function versionsHtml(d) {
    if (!d || d.versions.length < 2 || showsDiff()) return "";
    const n = d.versions.length, at = d.viewing ? d.versions.indexOf(d.viewing) : n - 1, v = d.versions[at];
    const who = byWords(v.by, threadTitle) || (at === 0 ? "When you opened it" : "");
    const when = whenWords(v.at);
    const words = [who, when].filter(Boolean).join(" · ");
    const step = `<span class="vw-vers" role="group" aria-label="Versions"><button type="button" class="vw-btn" data-vw-ver="-1" aria-label="The version before"${at <= 0 ? ' aria-disabled="true"' : ""}>${PREV_IC}</button>` +
      `<span class="vw-vn" title="${esc(words)}"><b>${at + 1}</b> of ${n}</span>` +
      `<button type="button" class="vw-btn" data-vw-ver="1" aria-label="The version after"${at >= n - 1 ? ' aria-disabled="true"' : ""}>${NEXT_IC}</button></span>`;
    const who2 = words ? `<span class="vw-who">${esc(words)}</span>` : "";
    if (d.viewing) {
      const can = d.viewing.text != null;
      return step + who2 + (can && d.state !== "readonly" ? `<button type="button" class="xd-btn" data-vw-restore title="Make this version the file again (a new version: nothing is lost)">Restore</button>` : "") +
        `<button type="button" class="xd-btn" data-vw-latest>Latest</button>`;
    }
    const prev = d.versions[n - 2];
    const canShow = prev && prev.text != null && d.state !== "conflict";
    return step + who2 + (canShow ? `<button type="button" class="xd-btn${V.showChanges ? " is-on" : ""}" data-vw-changes aria-pressed="${!!V.showChanges}" title="Mark what this version changed">Show changes</button>` : "");
  }
  const MODK = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl ";
  const unsavedPop = () => {
    const A = V.asking, n = A.docs.length;
    const what = n === 1 ? `your changes to ${esc(A.docs[0].rel.split("/").pop())}` : `your changes to ${n} files`;
    return `<div class="xd-pop" role="alertdialog" aria-label="Save ${what}?"><p><b>Save ${what}?</b> If you don't, they're gone.</p><div class="xd-pop-a"><button type="button" class="xd-btn" data-vw-unsaved="discard">Don't save</button><button type="button" class="xd-btn" data-vw-unsaved="cancel">Cancel</button><button type="button" class="xd-btn is-pri" data-vw-unsaved="save">Save</button></div></div>`;
  };
  const confirmPop = () => `<div class="xd-pop" role="dialog" aria-label="Save a file that runs code"><p><b>Git or an agent runs what this file says.</b> A slip here runs on the next commit or the next agent turn. Save it?</p><div class="xd-pop-a"><button type="button" class="xd-btn" data-vw-noconfirm>Not now</button><button type="button" class="xd-btn is-pri" data-vw-confirm>Save</button></div></div>`;
  function tabsHtml() {
    if (V.tabs.length < 2) return "";
    const cur = V.file;
    return `<div class="vw-tabs" role="tablist" aria-label="Open files">` + V.tabs.map((t, i) => {
      const on = t.file === cur, d = t.doc, dirty = d && (d.state === "dirty" || d.state === "saving" || d.state === "conflict" || d.state === "error");
      return `<span class="vw-tab${on ? " is-on" : ""}${t.preview ? " is-preview" : ""}" role="presentation"><button type="button" role="tab" class="vw-tab-b" data-vw-tab="${i}" aria-selected="${on}" title="${esc(t.file.where || t.file.name || "")}">` +
        `<span class="vw-ic" aria-hidden="true">${fileIcon(t.file.name || t.file.path || "")}</span><span class="vw-tn">${esc(t.file.name || t.file.path || "")}</span></button>` +
        `<button type="button" class="vw-tab-x${dirty ? " is-dirty" : ""}" data-vw-tabx="${i}" aria-label="Close ${esc(t.file.name || "")}${dirty ? " (not saved yet)" : ""}"><i aria-hidden="true"></i>${ICON.close}</button></span>`;
    }).join("") + `</div>`;
  }

  function head() {
    const f = V.file, d = V.data, D = doc();
    const kind = f.att || f.local != null ? typeWord(f.type || "", f.name) : d ? KIND_WORD[d.kind] || (extOf(f.name).toUpperCase() || "Text") : String(f.type || "").split("/").pop() || "";
    const c = chg(), diffing = showsDiff();
    const meta = diffing ? [] : [kind, V.dims && `${V.dims.w} × ${V.dims.h}`, size(d ? d.size_bytes : f.bytes)].filter(Boolean);
    const canCopy = !diffing && !!(d && typeof d.content === "string");
    const show = c ? `<div class="vw-seg is-words" role="group" aria-label="Show"><button type="button" data-vw-show="changes" aria-pressed="${diffing}">Changes</button><button type="button" data-vw-show="file" aria-pressed="${!diffing}">File</button></div>` +
      (diffing ? `<button type="button" class="vw-btn vw-split${V.split ? " is-on" : ""}" data-vw-split aria-pressed="${V.split}" title="${V.split ? "One column" : "Side by side"}" aria-label="Side by side">${SPLIT_IC}</button>` : "") : "";
    const toggle = diffing ? "" : d && d.kind === "markdown"
      ? `<div class="vw-seg" role="group" aria-label="Show"><button type="button" data-vw-mode="page" aria-pressed="${V.textMode !== "source"}" title="As a page" aria-label="Page">${PAGE_IC}<span>Page</span></button><button type="button" data-vw-mode="source" aria-pressed="${V.textMode === "source"}" title="Source" aria-label="Source">${SRC_IC}<span>Source</span></button></div>`
      : d && d.kind === "html"
        ? `<div class="vw-seg" role="group" aria-label="Show"><button type="button" data-vw-mode="preview" aria-pressed="${V.mode === "preview"}" title="Preview" aria-label="Preview">${ICON.eye}<span>Preview</span></button><button type="button" data-vw-mode="source" aria-pressed="${V.mode === "source"}" title="Source" aria-label="Source">${SRC_IC}<span>Source</span></button></div>`
        : d && d.kind === "image"
          ? `<div class="vw-seg" role="group" aria-label="Size"><button type="button" data-vw-mode="preview" aria-pressed="${V.imgMode !== "actual"}">Fit</button><button type="button" data-vw-mode="actual" aria-pressed="${V.imgMode === "actual"}" aria-label="Actual size"><span class="vw-wide">Actual size</span><span class="vw-narrow" aria-hidden="true">1:1</span></button></div>`
          : "";
    const state = !diffing ? stateHtml(D) : "";
    const name = `<span class="vw-ic" aria-hidden="true">${fileIcon(f.name || f.path || "")}</span>` +
      `<div class="vw-t"><h2 id="vw-h"${f.where ? ` title="${esc(f.where)}"` : ""}>${esc(f.name || f.path)}</h2>${c && diffing ? countsHtml(c.file) : ""}${meta.length && !state ? `<span class="vw-meta">${esc(meta.join(" · "))}</span>` : state}</div>`;
    const runs = !diffing && runsCode() ? `<span class="xd-runs" title="Git or an agent runs what this file says">${BOLT_IC}<span>Runs code</span></span>` : "";
    const why = !diffing && d && typeof d.content === "string" && (d.editable === false || (D && D.state === "readonly")) ? NOT_EDITABLE[d.not_editable_reason || (D && D.err)] || "Read only" : "";
    const ro = why ? `<span class="xd-ro" title="${d.not_editable_reason === "read_only_place" ? "XO keeps this file: change it from its own screen" : esc(why)}">${d.not_editable_reason === "read_only_place" ? LOCK_IC : ""}<span>${esc(why)}</span></span>` : "";
    const askT = ask && ask.file && f.project && f.rel && ask.target(f);
    const askB = askT && !diffing ? `<button type="button" class="xd-btn vw-ask" data-vw-askfile title="Ask ${esc(askT)} about this file">Ask about this</button>` : "";
    const fold = (cls, attrs, label, role = "menuitem") => `<button type="button" role="${role}" class="vw-fold ${cls}" ${attrs}><span>${label}</span></button>`;
    const folds = [
      askB && fold("f-wide", `data-vw-askfile title="Ask ${esc(askT)} about this file"`, "Ask about this"),
      runs && fold("f-wide", `aria-disabled="true" title="Git or an agent runs what this file says"`, "Runs code"),
      show && toggle && (d.kind === "image"
        ? fold("f-narrow", `data-vw-mode="preview" aria-checked="${V.imgMode !== "actual"}"`, "Fit", "menuitemradio") + fold("f-narrow", `data-vw-mode="actual" aria-checked="${V.imgMode === "actual"}"`, "Actual size", "menuitemradio")
        : d.kind === "markdown"
          ? fold("f-narrow", `data-vw-mode="page" aria-checked="${V.textMode !== "source"}"`, "Page", "menuitemradio") + fold("f-narrow", `data-vw-mode="source" aria-checked="${V.textMode === "source"}"`, "Source", "menuitemradio")
          : fold("f-narrow", `data-vw-mode="preview" aria-checked="${V.mode === "preview"}"`, "Preview", "menuitemradio") + fold("f-narrow", `data-vw-mode="source" aria-checked="${V.mode === "source"}"`, "Source", "menuitemradio")),
    ].filter(Boolean);
    const more = moreHtml(f, canCopy, folds);
    return `<header class="vw-top">${name}` +
      `<div class="vw-acts">${askB}${runs}${ro}${show}${toggle}${more}` +
      `<button type="button" class="vw-x" data-vw-close aria-label="Close the file" title="Close (Esc)">${ICON.close}</button></div>` +
      (D && D.confirm ? confirmPop() : V.asking ? unsavedPop() : "") + `</header>`;
  }
  function verBar() {
    const D = doc(), vers = showsDiff() ? "" : versionsHtml(D);
    return vers ? `<div class="vw-verbar${D && D.viewing ? " is-old" : ""}">${vers}</div>` : "";
  }

  const hookOf = (e) => { const a = e && e.attributes && [...e.attributes].find((x) => x.name.startsWith("data-vw-")); return a ? (a.value ? `[${a.name}="${CSS.escape(a.value)}"]` : `[${a.name}]`) : ""; };
  function paintHead() {
    const top = el.querySelector(".vw-top");
    if (!top) return;
    const ae = document.activeElement;
    const had = ae && top.contains(ae) ? hookOf(ae) : "";
    const fromMenu = !!(ae && ae.closest && ae.closest(".vw-menu"));
    if (ae && top.contains(ae)) el.focus({ preventScroll: true });
    redrawNode(top, head());
    paintBars();
    if (!had) return;
    const now = el.querySelector(".vw-top");
    const to = shown(now, had) || (fromMenu && shown(now, "[data-vw-more]")) || headFocus(false);
    if (to && to !== document.activeElement) to.focus({ preventScroll: true });
  }
  function paintBars() {
    const top = el.querySelector(".vw-top");
    if (!top) return;
    const ae = document.activeElement;
    const zone = (x) => !!x && !!x.closest && !!x.closest(".vw-tabs, .vw-verbar") && el.contains(x);
    const had = zone(ae) ? hookOf(ae) : "";
    if (had) el.focus({ preventScroll: true });
    const place = (cls, html, put) => {
      const now = el.querySelector(`:scope > .${cls}`);
      if (now && html) redrawNode(now, html); else if (now) now.remove(); else if (html) put(html);
    };
    place("vw-tabs", tabsHtml(), (h) => top.insertAdjacentHTML("beforebegin", h));
    place("vw-verbar", verBar(), (h) => el.querySelector(".vw-top").insertAdjacentHTML("afterend", h));
    if (!had) return;
    const to = shown(el, had) || headFocus(false);
    if (to && to !== document.activeElement) to.focus({ preventScroll: true });
  }
  function headFocus(go = true) {
    const head = el.querySelector(".vw-top");
    const to = (TX.h && showsText() && TX.h.view.contentDOM)
      || (head && [...head.querySelectorAll('button:not(:disabled), [tabindex="0"]')].find((x) => x.getClientRects().length && !x.closest("[inert]"))) || el;
    if (go) to.focus({ preventScroll: true });
    return to;
  }
  return { head, tabsHtml, verBar, paintHead, headFocus, hookOf, shown, menuItems, menuOff };
}
