// @ts-check

import { requireHtml } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { fileIcon } from "../../core/ui/icons/fileicons.js";
import { redraw } from "../../core/ui/redraw.js";

/** @import { FileQuestionDeps } from "./file-question-types.d.ts" */

/** @param {Pick<FileQuestionDeps, "view" | "fileReferences">} deps */
export function createFileReferenceLine({ view, fileReferences }) {
  /** @type {WeakMap<Element, string>} */
  const painted = new WeakMap();
  return function lrefRender() {
    const reference = fileReferences.get(view());
    const el = requireHtml("#cref");
    const html = reference ? referenceHtml(reference) : "";
    el.hidden = !reference;
    if (painted.get(el) === html) return;
    redraw(el, html);
    painted.set(el, html);
  };
}

/** @param {NonNullable<ReturnType<FileQuestionDeps["fileReferences"]["get"]>>} reference */
function referenceHtml({ path, name, a, b }) {
  const lines = a ? (b > a ? `${a}–${b}` : String(a)) : "";
  const single = a === b;
  const title = lines ? `${path}, ${single ? "line" : "lines"} ${lines}` : path;
  const attrs = lines ? ` data-ref-a="${a}" data-ref-b="${b}"` : "";
  const text = lines ? `${esc(name)} · ${lines}` : esc(name);
  const target = lines ? (single ? "the line" : "the lines") : esc(name || path.split("/").pop());
  const hint = lines ? (single ? "Take it out" : "Take them out") : "Take the file out";
  return `<a href="#${esc(path)}" class="lk lk-in lk-file" data-ref="${esc(path)}"${attrs} title="${esc(title)}">`
    + `<span class="lk-ic">${fileIcon(name)}</span><span class="lk-t">${text}</span></a>`
    + `<button type="button" class="cref-x" data-lref-x aria-label="Take ${target} out of this message"`
    + ` title="${hint}">${ICON.close}</button>`;
}
