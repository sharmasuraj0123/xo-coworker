// @ts-check

// Home's sections: each home.section entry draws into its own element of Home's body, in the place's order.

/** @typedef {{ needs: any[], patch: (el: HTMLElement, html: string) => boolean }} SectionCtx @typedef {import("../../core/kernel/types").Entry & { mount: (el: HTMLElement) => void, render: (el: HTMLElement, ctx: SectionCtx) => void }} Section */

/** Draw every section Home's body holds an element for; a section is mounted the first time its element is seen. @param {import("../../core/kernel/types").Places} places @param {HTMLElement | null} body @param {SectionCtx} ctx */
export function drawSections(places, body, ctx) {
  if (!body) return;
  for (const s of places.entries(/** @type {string} */ ("home.section"))) {
    const sec = /** @type {Section} */ (/** @type {unknown} */ (s));
    const el = /** @type {(HTMLElement & { _mounted?: boolean }) | null} */ (body.querySelector(`:scope > #${sec.id}`));
    if (!el) continue;
    if (!el._mounted) { el._mounted = true; sec.mount(el); }
    sec.render(el, ctx);
  }
}
