// @ts-check
import { esc } from "../../core/platform/util.js";
import { fromSharedFile } from "../../core/services/media/items.js";
import { mediaHtml, webImagesHtml } from "../../core/services/media/render.js";
import { setWebImages } from "../../core/ui/markdown/markdown.js";
import { startRich } from "../../core/ui/markdown/rich.js";

/** @import { FileRoute } from "../../core/services/media/types.d.ts" */

export const WEBPICS = "xo:conversation/webpics";

/** @typedef {{ on(key: string): boolean; word(key: string): string }} Shape */

/** @typedef {(path: string | null | undefined) => FileRoute | null | undefined} ResolveFile */

/** @param {Pick<import("../../core/kernel/types").ModuleContext, "effect">} scope @param {Shape} shape @param {ResolveFile} route */
export function mountConversationMarkdown(scope, shape, route) {
  /** @param {{ alt: string, url?: string, file?: string }[]} list */
  function pictures(list) {
    const web = list.flatMap(({ url, alt }) => url ? [{ url, alt }] : []);
    if (web.length && !shape.on(WEBPICS)) return null;
    const own = list.flatMap(({ file, alt }) => {
      if (!file) return [];
      return [fromSharedFile({ path: file, name: file.split("/").pop(), title: alt || null }, { route })];
    });
    if (!web.length) return mediaHtml(own, { side: "them" });
    return (own.length ? mediaHtml(own, { side: "them" }) : "") + webImagesHtml(web);
  }
  scope.effect(() => { setWebImages(pictures); return () => setWebImages(null); });
  startRich();
  /** @param {string} word */
  return (word) => {
    const chosen = shape.word(word);
    return chosen === word ? esc(word) : `<span title="${esc(`XO's word: ${word}`)}">${esc(chosen)}</span>`;
  };
}
