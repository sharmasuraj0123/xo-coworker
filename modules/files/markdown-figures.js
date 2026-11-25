// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { reportFailure } from "../../core/services/notices/failures.js";

/** @import {CodeMirror, EditorView} from "./cm-types.d.ts" */

/** @typedef {(src: string, signal: AbortSignal) => Promise<string | null>} ImageSource */

const IMAGE = /!\[([^\]\n]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"([^"]*)")?\s*\)/g;

/** The pictures a line of Markdown shows, in order. @param {string} source */
function imagesIn(source) {
  return Array.from(source.matchAll(IMAGE), (m) => ({ alt: m[1].trim(), src: m[2], title: m[3] || "" }));
}

/** A picture's project path from the document's folder, or null outside the project. @param {string} docRel @param {string} src */
export function resolveImage(docRel, src) {
  if (/^[a-z][a-z\d+.-]*:/i.test(src) || src.startsWith("//")) return null;
  let path;
  try { path = decodeURI(src.split(/[?#]/, 1)[0]); }
  catch (error) { if (error instanceof URIError) return null; throw error; }
  const parts = path.startsWith("/") ? [] : docRel.split("/").slice(0, -1);
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (!parts.length) return null; parts.pop(); }
    else parts.push(part);
  }
  return parts.length ? parts.join("/") : null;
}

/** @param {CodeMirror["WidgetType"]} WidgetType @param {ImageSource | null} images */
export function createImageWidget(WidgetType, images) {
  /** @type {WeakMap<HTMLElement, ReturnType<typeof createScope>>} */
  const scopes = new WeakMap();

  class ImageWidget extends WidgetType {
    /** @param {string} src @param {number} from */
    constructor(src, from, preview = false) { super(); this.src = src; this.from = from; this.preview = preview; }
    /** @override @param {ImageWidget} other */
    eq(other) { return other.src === this.src && other.from === this.from && other.preview === this.preview; }
    /** @override @param {EditorView} view */
    toDOM(view) {
      const d = document.createElement("div");
      const scope = createScope();
      scopes.set(d, scope);
      const pictures = imagesIn(this.src);
      d.className = `cm-md-block cm-md-figure${pictures.length > 1 ? " is-row" : ""}${this.preview ? " is-preview" : ""}`;
      for (const picture of pictures) {
        const frame = document.createElement("div");
        frame.className = "cm-md-pic is-loading";
        const img = document.createElement("img");
        img.setAttribute("alt", picture.alt);
        if (picture.title) img.setAttribute("title", picture.title);
        img.setAttribute("decoding", "async");
        frame.appendChild(img);
        d.appendChild(frame);
        const failed = () => {
          frame.className = "cm-md-pic is-missing";
          frame.textContent = `${picture.alt || "Picture"} isn't there: ${picture.src}`;
        };
        scope.listen(img, "load", () => { frame.classList.remove("is-loading"); });
        scope.listen(img, "error", failed);
        if (/^https:\/\//i.test(picture.src)) { img.setAttribute("referrerpolicy", "no-referrer"); img.setAttribute("src", picture.src); }
        else if (images) {
          images(picture.src, scope.signal).then((url) => {
            if (scope.signal.aborted) return;
            if (url) img.setAttribute("src", url);
            else failed();
          }, (error) => {
            if (scope.signal.aborted) return;
            failed();
            reportFailure(error);
          });
        } else failed();
      }
      scope.listen(d, "mousedown", (event) => {
        event.preventDefault();
        view.dispatch({ selection: { anchor: Math.min(view.state.doc.length, this.from) } });
        view.focus();
      });
      return d;
    }
    /** @override @param {HTMLElement} node */
    destroy(node) { scopes.get(node)?.dispose(); scopes.delete(node); }
    /** @override */
    ignoreEvent() { return false; }
    /** @override */
    get estimatedHeight() { return 240; }
  }
  return ImageWidget;
}
