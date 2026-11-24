// @ts-check

// Files, a page of the right panel: the tree and the open file beside the chat, the tree folding to a rail (⌘B).

import { createScope } from "../../core/kernel/scope.js";
import { read, write } from "../../core/platform/storage.js";
import { ICON } from "../../core/ui/icons/names.js";

const TW_KEY = "xo-files-tree", TW_DEF = 240, TW_MIN = 160, TW_MAX = 420;
const FOLD_KEY = "xo-files-folds"; // {tree: "open" | "folded"}: what you chose, per browser

/** @param {{ stage: any, files: any, viewer: any, view: () => string, announce?: (s: string) => void }} deps */
export function createFilesPage({ stage, files, viewer, view, announce = () => {} }) {
  // the page's own pane, made once and kept off the page while its tab is closed: the viewer is one element for the app's whole life
  const pane = document.createElement("section");
  pane.className = "fv";
  pane.setAttribute("aria-label", "Files");
  pane.innerHTML = `<div class="fv-b"></div>`;
  const body = /** @type {HTMLElement} */ (pane.querySelector(".fv-b"));
  /** @type {ReturnType<typeof createScope> | undefined} */
  let mounted;

  // the tree's width: dragged, keyboard (← →), double-click for the default; kept per browser
  let tw = read(TW_KEY, (raw) => Number(raw) || TW_DEF, TW_DEF);
  const setTw = (/** @type {number} */ w, save = false) => {
    tw = Math.round(Math.max(TW_MIN, Math.min(TW_MAX, w)));
    pane.style.setProperty("--tw", `${tw}px`);
    if (save) write(TW_KEY, String(tw));
  };
  setTw(tw);
  // folded or open: your choice, kept per browser (open until you fold it)
  const folds = read(FOLD_KEY, (raw) => JSON.parse(raw) || {}, {});
  const treeOpen = () => folds.tree !== "folded";
  const keepFold = (/** @type {boolean} */ open) => { folds.tree = open ? "open" : "folded"; write(FOLD_KEY, JSON.stringify(folds)); };

  /** @param {HTMLElement} host */
  function mount(host) {
    mounted?.dispose();
    const scope = createScope();
    mounted = scope;
    host.append(pane);
    scope.effect(() => () => { mounted = undefined; pane.remove(); });
    files.mount(body, scope);
    files.fold(!treeOpen());
    const line = /** @type {HTMLElement | null} */ (body.querySelector(".fl-split"));
    if (!line) return scope.dispose;
    scope.listen(line, "pointerdown", (event) => {
      const e = /** @type {PointerEvent} */ (event);
      if (e.button !== 0) return;
      e.preventDefault();
      line.setPointerCapture(e.pointerId);
      document.body.classList.add("fv-sizing");
      const left = body.getBoundingClientRect().left; // read once, at the press
      const move = (/** @type {Event} */ ev) => setTw(/** @type {PointerEvent} */ (ev).clientX - left);
      const stopMove = scope.listen(line, "pointermove", move);
      const clearSizing = scope.effect(() => () => document.body.classList.remove("fv-sizing"));
      const up = () => { stopMove(); stopUp(); stopCancel(); clearSizing(); setTw(tw, true); };
      const stopUp = scope.listen(line, "pointerup", up);
      const stopCancel = scope.listen(line, "pointercancel", up);
    });
    scope.listen(line, "dblclick", () => { setTw(TW_DEF, true); });
    scope.listen(line, "keydown", (event) => {
      const e = /** @type {KeyboardEvent} */ (event);
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setTw(tw + (e.key === "ArrowRight" ? 16 : -16), true);
    });
    return scope.dispose;
  }

  const nameOf = (/** @type {any} */ f) => (f ? f.name || String(f.path || f.rel || "").split("/").pop() : "");
  // the tree follows the file the viewer shows: found and marked in its folder, and on a narrow panel (a phone) the file takes the tree's place.
  let seen = /** @type {unknown} */ (null);
  function follow() {
    const f = viewer.hasFile ? viewer.file : null;
    if (f !== seen) { seen = f; if (f && !files.auto) files.reveal(f); }
  }
  stage.page("files", {
    title: () => (viewer.hasFile ? nameOf(viewer.file) : "Files"),
    // the one control that shows or hides the file list beside a file, first in the panel's head with the sidebar's own icon
    lead: () => {
      if (!viewer.hasFile) return "";
      const shown = listShown();
      return `<button type="button" class="stg-ic pg-lead" data-stg-act="tree" aria-pressed="${shown}" title="${shown ? "Hide" : "Show"} the files (⌘B)" aria-label="${shown ? "Hide" : "Show"} the files" aria-keyshortcuts="Meta+B Control+B">${ICON.sidebar}</button>`;
    },
    act: (/** @type {string} */ name) => { if (name === "tree") P.toggleTree({ focus: true }); },
    mount,
    onShow: (/** @type {string} */ key, /** @type {{ focus?: boolean }} */ { focus } = {}) => {
      if (!pane.isConnected) return;
      files.show(view());
      seen = null; follow();
      if (focus) (document.getElementById("viewer")?.hidden === false ? document.getElementById("viewer") : /** @type {HTMLElement | null} */ (body.querySelector(".fl-tree [data-fl-q]")))?.focus({ preventScroll: true });
    },
    onHide: () => files.hide(),
    // the page closes: the file goes (unsaved text waits as a draft in this browser)
    close: () => { if (viewer.hasFile) viewer.close({ restore: false }); files.hide(); },
    // unsaved files: Save, Don't save or Cancel (the viewer asks); nothing unsaved: yes at once
    canClose: () => viewer.confirmClose(),
    escape: () => viewer.escape(),
  });

  // the files' list shown beside (or, narrow, instead of) the file
  const listShown = () => (files.listing || (files.wide ? !files.folded : false));
  // the head's control keeps focus as the head redraws (it's redrawn in place, the same button)
  const refocus = (/** @type {boolean} */ on) => { if (on) mounted?.frame(() => /** @type {HTMLElement | null} */ (document.querySelector('#stage [data-stg-act="tree"]'))?.focus({ preventScroll: true })); };
  const P = {
    /** Show Files in the panel, on the file the viewer has (or the tree alone). focus: into the file. @param {{ focus?: boolean }} [o] */
    show({ focus = false } = {}) {
      stage.show("files", "files", { focus });
    },
    /** ⌘B or the head's control: the file list folds to its rail, or opens again (only while Files shows a file). @param {{ focus?: boolean }} [o] */
    toggleTree({ focus = false } = {}) {
      if (stage.pageShown?.name !== "files" || !viewer.hasFile) return false;
      if (files.list(!files.listing)) { refocus(focus); announce(files.listing ? "The files." : "The file."); return true; }
      const open = !treeOpen();
      keepFold(open);
      files.fold(!open);
      refocus(focus);
      announce(open ? "The files are beside the file." : "The files are folded: the file has the panel.");
      return true;
    },
    /** @param {boolean} folded */
    treeFolded(folded) { keepFold(!folded); },
    get isOpen() { return stage.pageShown?.name === "files"; },
    /** Every app render: while Files shows, the tree follows the view (its marks, a new place) and the file. */
    sync() {
      if (!P.isOpen) return;
      follow();
      files.render(view());
    },
  };
  return P;
}
