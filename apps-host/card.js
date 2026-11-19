// @ts-check

/** @typedef {import("./manifest.js").App} App @typedef {import("./manifest.js").Surface} Surface @typedef {import("../core/kernel/types").At} At @typedef {import("./contributions.js").Mounted} Mounted @typedef {{ app?: string, tool?: string, card?: string, snapshot?: string, caption?: string, structured?: unknown }} AppBlock @typedef {{ doc: Document, find(appId: string, project: string | undefined): App | null, mountView(el: HTMLElement, v: { app: App, surface: Surface, kind: string, at: At, input?: unknown }): Mounted }} CardDeps */

export const MAX_LIVE = 3;
const PICTURE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/** Inline app cards: a picture and caption drawn by XO, live only once touched, three live at most. @param {CardDeps} d */
export function createCards(d) {
  /** @type {Array<{ close(): void }>} */
  const live = [];

  /** The conversation.block "app" render. @param {HTMLElement} el @param {AppBlock} block @param {At} [at] */
  function render(el, block, at = {}) {
    const { doc } = d;
    const project = typeof at.project === "string" ? at.project : undefined;
    const app = block && typeof block.app === "string" ? d.find(block.app, project) : null;
    const surface = app && (app.surfaces.inline || []).find((s) => s.id === block.card);
    const box = doc.createElement("div");
    box.className = "xa-card";
    box.dataset.m = "apps-host";
    const pic = doc.createElement("figure");
    pic.className = "xa-card-picture";
    if (typeof block.snapshot === "string" && block.snapshot.length < (2 << 20) && PICTURE.test(block.snapshot)) {
      const img = doc.createElement("img");
      img.src = block.snapshot;
      img.alt = typeof block.caption === "string" ? block.caption : "";
      pic.append(img);
    }
    const cap = doc.createElement("figcaption");
    cap.textContent = typeof block.caption === "string" ? block.caption : app ? `${app.name}` : "An app's result";
    pic.append(cap);
    box.append(pic);
    el.append(box);
    if (!app || !surface) return () => box.remove();

    pic.tabIndex = 0;
    pic.setAttribute("role", "button");
    pic.setAttribute("aria-label", `Open ${app.name}'s card`);
    /** @type {Mounted | null} */
    let view = null;
    const handle = {
      close() {
        if (!view) return;
        const refocus = box.contains(doc.activeElement);
        view.destroy();
        view = null;
        box.dataset.live = "";
        pic.hidden = false;
        const i = live.indexOf(handle);
        if (i >= 0) live.splice(i, 1);
        if (refocus) pic.focus();
      },
    };
    const open = () => {
      if (view) return;
      const refocus = doc.activeElement === pic;
      while (live.length >= MAX_LIVE) live[0].close();
      box.style.setProperty("--xa-card-max", `${surface.maxHeight || 360}px`);
      view = d.mountView(box, { app, surface, kind: "inline", at, input: block.structured });
      box.dataset.live = "true";
      pic.hidden = true;
      live.push(handle);
      if (refocus) { box.tabIndex = -1; box.focus(); }
    };
    pic.addEventListener("click", open);
    pic.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    return () => { handle.close(); box.remove(); };
  }
  return { render, closeAll() { for (const h of [...live]) h.close(); } };
}
