// Files, as a place in the main area (the owner, 4 November: the right panel was too narrow to read a
// file in). It covers the conversation, never the sidebar: a 40 px head (back to the conversation, the
// project and its branch), then the tree (js/files.js) at a width you drag, and the file (js/viewer.js)
// taking the rest. A file opened from anywhere (a chip in a turn, the panel's Changes, Artifacts: all
// through VW.open) comes here. Closing a file that brought the place up closes the place too.
//
// app.js calls: open, close, sync (every render), isOpen, owns.

import { ICON, $ } from "./ui.js";
import { esc } from "./util.js";

const TW_KEY = "xo-files-tree", TW_DEF = 280, TW_MIN = 200, TW_MAX = 480;

export function createFilesView({ files, viewer, view, PROJ, world, announce, onChange }) {
  const F = { open: false, fileOnly: false, seen: null, returnTo: null, head: "" };
  const el = document.createElement("section");
  el.className = "fv";
  el.id = "fv";
  el.hidden = true;
  el.tabIndex = -1;
  el.setAttribute("aria-label", "Files");
  el.innerHTML = `<header class="fv-h"></header><div class="fv-b"></div>`;
  $("#main").appendChild(el);
  const body = el.querySelector(".fv-b");
  files.mount(body);

  // the tree's width: dragged, keyboard (← →), double-click for the default; kept per browser
  let tw = TW_DEF;
  try { tw = Number(localStorage.getItem(TW_KEY)) || TW_DEF; } catch { /* private mode */ }
  const setTw = (w, save = false) => {
    tw = Math.round(Math.max(TW_MIN, Math.min(TW_MAX, w)));
    el.style.setProperty("--tw", `${tw}px`);
    if (save) { try { localStorage.setItem(TW_KEY, String(tw)); } catch { /* private mode */ } }
  };
  setTw(tw);
  const split = body.querySelector(".fl-split");
  split.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    split.setPointerCapture(e.pointerId);
    const left = body.getBoundingClientRect().left;
    document.body.classList.add("fv-sizing");
    const move = (ev) => setTw(ev.clientX - left);
    const up = () => { split.removeEventListener("pointermove", move); document.body.classList.remove("fv-sizing"); setTw(tw, true); };
    split.addEventListener("pointermove", move);
    split.addEventListener("pointerup", up, { once: true });
    split.addEventListener("pointercancel", up, { once: true });
  });
  split.addEventListener("dblclick", () => setTw(TW_DEF, true));
  split.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setTw(tw + (e.key === "ArrowRight" ? 16 : -16), true);
  });

  function headHtml() {
    const v = view();
    let name = "Your projects", sub = "";
    if (v.startsWith("t:")) { const t = world.thread(v.slice(2)); if (t) { name = PROJ(t.project); sub = t.branch || ""; } }
    else if (v.startsWith("p:")) name = PROJ(v.slice(2));
    const at = files.place; // a file opened from elsewhere takes the tree to its own folder: name that one
    if (at) { name = at.label; sub = at.sub; }
    const back = v === "home" ? "Home" : v === "ws" ? "Workspace" : v === "artifacts" ? "Artifacts" : v === "chats" ? "Chats" : "Conversation";
    return `<button type="button" class="fv-back" data-fv-back title="Back (Esc)">${ICON.back}<span>${esc(back)}</span></button><span class="fv-sep" aria-hidden="true"></span>` +
      `<h1 class="fv-t">${esc(name)}</h1>${sub ? `<span class="fv-s">${esc(sub)}</span>` : ""}`;
  }
  function paint() {
    if (!F.open) return;
    const h = headHtml();
    if (h !== F.head) { el.querySelector(".fv-h").innerHTML = h; F.head = h; }
  }

  function open({ fileOnly = false, focus = true } = {}) {
    if (!F.open) {
      F.open = true; F.fileOnly = fileOnly;
      F.returnTo = document.activeElement;
      el.hidden = false;
      document.body.classList.add("files-open");
      files.show(view());
      announce("Files. Esc goes back to the conversation.");
    } else if (!fileOnly) F.fileOnly = false;
    F.head = "";
    paint();
    if (focus) el.focus({ preventScroll: true });
    onChange && onChange();
  }
  function close({ restore = true } = {}) {
    if (!F.open) return;
    F.open = false; F.fileOnly = false; F.seen = null;
    el.hidden = true;
    document.body.classList.remove("files-open");
    files.hide();
    if (viewer.hasFile) viewer.close({ restore: false });
    const back = F.returnTo;
    F.returnTo = null;
    if (restore && back && back.isConnected) back.focus({ preventScroll: true });
    onChange && onChange();
  }

  /** Every render: a file opened anywhere comes here; the one that brought us here, closed, takes us back. */
  function sync() {
    const f = viewer.hasFile ? viewer.file : null;
    if (f && f !== F.seen) {
      F.seen = f;
      if (!F.open) open({ fileOnly: !files.auto, focus: false });
      if (!files.auto) files.reveal(f);
    } else if (!f && F.seen) {
      F.seen = null;
      if (F.open && F.fileOnly) { close(); return; }
    }
    if (F.open) { files.render(view()); paint(); }
  }

  el.addEventListener("click", (e) => { if (e.target.closest("[data-fv-back]")) viewer.leave(() => close()); });
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (e.target.closest && e.target.closest("#viewer")) return; // the file closes itself first
    if (e.target.closest && e.target.closest("input") && e.target.value) return;
    e.preventDefault(); e.stopPropagation();
    close();
  });

  return {
    get isOpen() { return F.open; },
    open: () => open(),
    close,
    sync,
    owns: (node) => !!(node && el.contains(node)),
  };
}
