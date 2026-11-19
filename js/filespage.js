// Files, a page of the right panel (design-research/2026-11-vision/canvas-editing/FILES-IN-PANEL.md; the owner,
// 19 Nov 14:57Z: "instead, i want the whole thing to move to the right panel. expand it accordingly", approved 17:41Z).
// The conversation never moves: a file opens in the panel, which widens for it; the browser (tree, Find, Changed,
// All files) sits beside the file and folds to a thin rail (⌘B, or its fold button) so the file has the panel's
// width (the owner, 17:41Z: "have a minimize the browsing panel, so we have space while reading in the right").
// ‹ Sections (or Esc) goes back to Threads, Changes and Map with the file kept as the Files tab; reopening it is
// instant. One page in the panel's page model (js/stage.js page()): one tab for Files, its own inner tabs (js/viewer.js),
// asked before it closes (unsaved files), its Esc first.
//
// createFilesPage({stage, files, viewer, view, announce}) → {show({focus}), toggleTree(), treeFolded(folded), reset(),
// sync(), get isOpen}.

import { fileIcon } from "./fileicons.js";

const TW_KEY = "xo-files-tree", TW_DEF = 240, TW_MIN = 160, TW_MAX = 420;
const FOLD_KEY = "xo-files-folds"; // {tree: "open" | "folded"}: what you chose, per browser
const FILE_W = 640, RAIL_W = 44;   // the file's own width at first; the tree beside it, or its rail

export function createFilesPage({ stage, files, viewer, view, announce = () => {} }) {
  // the page's own pane, made once and kept: when its tab closes it waits here, off the page, with the tree and the
  // viewer in it (the viewer is one element for the app's whole life)
  const pane = document.createElement("section");
  pane.className = "fv";
  pane.setAttribute("aria-label", "Files");
  pane.innerHTML = `<div class="fv-b"></div>`;
  const body = pane.querySelector(".fv-b");
  let mounted = false;

  // the tree's width: dragged, keyboard (← →), double-click for the default; kept per browser
  let tw = TW_DEF;
  try { tw = Number(localStorage.getItem(TW_KEY)) || TW_DEF; } catch { /* private mode */ }
  const setTw = (w, save = false) => {
    tw = Math.round(Math.max(TW_MIN, Math.min(TW_MAX, w)));
    pane.style.setProperty("--tw", `${tw}px`);
    if (save) { try { localStorage.setItem(TW_KEY, String(tw)); } catch { /* private mode */ } }
  };
  setTw(tw);
  // folded or open: your choice, kept per browser (open until you fold it)
  let folds = {};
  try { folds = JSON.parse(localStorage.getItem(FOLD_KEY) || "{}") || {}; } catch { /* private mode */ }
  const treeOpen = () => folds.tree !== "folded";
  const keepFold = (open) => { folds.tree = open ? "open" : "folded"; try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch { /* private mode */ } };

  function mountOnce() {
    if (mounted) return;
    mounted = true;
    files.mount(body);
    files.fold(!treeOpen());
    const line = body.querySelector(".fl-split");
    if (!line) return;
    line.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      line.setPointerCapture(e.pointerId);
      document.body.classList.add("fv-sizing");
      const left = body.getBoundingClientRect().left; // read once, at the press
      const move = (ev) => setTw(ev.clientX - left);
      const up = () => { line.removeEventListener("pointermove", move); document.body.classList.remove("fv-sizing"); setTw(tw, true); stage.refit(); };
      line.addEventListener("pointermove", move);
      line.addEventListener("pointerup", up, { once: true });
      line.addEventListener("pointercancel", up, { once: true });
    });
    line.addEventListener("dblclick", () => { setTw(TW_DEF, true); stage.refit(); });
    line.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setTw(tw + (e.key === "ArrowRight" ? 16 : -16), true); stage.refit();
    });
  }

  const nameOf = (f) => (f ? f.name || String(f.path || f.rel || "").split("/").pop() : "");
  // the tree follows the file the viewer shows: found and marked in its folder, and on a narrow panel (a phone) the
  // file takes the tree's place. Once per file; the panel refits when a file comes or goes (its width is the file's)
  let seen = null, had = false;
  function follow() {
    const f = viewer.hasFile ? viewer.file : null;
    if (f !== seen) { seen = f; if (f && !files.auto) files.reveal(f); }
    if (viewer.hasFile !== had) { had = viewer.hasFile; stage.refit(); }
  }
  stage.page("files", {
    single: true,
    // the file keeps 640 px, the tree its own width beside it (or its rail); never more than the room beside the
    // chat's 560. A width you drag the panel to is kept (per page).
    width: ({ room }) => Math.max(480, Math.min(room, viewer.hasFile ? FILE_W + (treeOpen() ? tw + 1 : RAIL_W) : tw + 240)),
    title: () => (viewer.hasFile ? nameOf(viewer.file) : "Files"),
    icon: () => fileIcon(viewer.hasFile ? nameOf(viewer.file) : ""),
    mount: (host) => { host.append(pane); mountOnce(); },
    onShow: (key, { focus } = {}) => {
      if (!pane.isConnected) return;
      files.show(view());
      seen = null; follow();
      if (focus) (document.getElementById("viewer")?.hidden === false ? document.getElementById("viewer") : body.querySelector(".fl-tree [data-fl-q]"))?.focus({ preventScroll: true });
    },
    onHide: () => files.hide(),
    // the tab closes: the file goes (its unsaved text was saved or let go in canClose); the pane waits off the page
    unmount: () => { if (viewer.hasFile) viewer.close({ restore: false }); files.hide(); pane.remove(); },
    // unsaved files: Save, Don't save or Cancel (the viewer asks); nothing unsaved: yes at once
    canClose: () => viewer.confirmClose(),
    escape: () => viewer.escape(),
  });

  const P = {
    /** Show Files in the panel, on the file the viewer has (or the tree alone). focus: into the file. */
    show({ focus = false } = {}) {
      const f = viewer.hasFile ? viewer.file : null;
      stage.show("files", f ? f.rel || f.path || nameOf(f) : "files", { focus });
    },
    /** ⌘B: fold the browser to its rail, or open it again (only while Files shows). */
    toggleTree() {
      if (stage.pageShown?.name !== "files") return false;
      const open = !treeOpen();
      keepFold(open);
      files.fold(!open);
      stage.refit();
      announce(open ? "The files are beside the file." : "The files are folded: the file has the panel.");
      return true;
    },
    /** The tree's own fold button (and its rail's icons) said so: kept, and the panel fits again. */
    treeFolded(folded) { keepFold(!folded); stage.refit(); },
    /** Another place: the file closes (unsaved text waits as a draft), and so does the Files tab. */
    reset() {
      if (viewer.hasFile) viewer.close({ restore: false });
      if (stage.pages().some((t) => t.name === "files")) stage.closeTab("files");
    },
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
