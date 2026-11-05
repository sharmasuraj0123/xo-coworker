// Files, as a place in the main area (the owner, 4 November: the right panel was too narrow to read a
// file in): a 40 px head, then the tree (js/files.js) at a width you drag, and the file (js/viewer.js)
// taking the rest. A file opened from anywhere (a chip in a turn, the panel's Changes, Artifacts: all
// through VW.open) comes here. Closing a file that brought the place up closes the place too.
//
// Beside a conversation on a desktop, the file and the chat share the main area (Layout A, the owner's
// pick, 5 November; design-research/2026-11-vision/fileview-ux): the file in the middle, the same #conv
// and #dock in a column on the right (body.chat-docked, --cw wide: 400 px, dragged 360–560, kept), and the
// panel steps aside (js/stage.js). Nothing closes by itself:
//   · put away (— in the head, or Esc): the file waits, as it was, as a chip in the thread's header
//     (app.js); the chat goes back to the middle. Its × really closes it;
//   · the chat folds to a 44 px rail (›| or ⌘J), the tree to a 44 px rail (◧ or ⌘B) (js/files.js).
// On a phone the same rule runs vertically (body.chat-sheet): the file fills the screen and the chat is a
// sheet that folds to one bar (who, what it's doing, new messages; amber when it asks) and never closes; up
// it covers the lower 70 %. Where the view has no conversation (Home, Artifacts), Files covers the main area.
// follow.js keeps the row you were reading through the chat's change of width; nothing here scrolls it.
//
// app.js calls: open, close, minimise, restore, escape, sync (every render), isOpen, docked, putAway, owns.

import { ICON, $ } from "./ui.js";
import { esc } from "./util.js";
import { ready as diffsReady } from "./diffview.js";

const TW_KEY = "xo-files-tree", TW_DEF = 280, TW_MIN = 200, TW_MAX = 480;
const CW_KEY = "xo-chat-w", CW_DEF = 400, CW_MIN = 360, CW_MAX = 560;
const FOLD_KEY = "xo-files-folds"; // {tree: "open"|"folded", chat: "open"|"folded"}: what you chose, per browser
const PHONE = 760, RAIL = 44, FILE_MIN = 640, COMPACT_FILE = 560, SLIDE = 200;
const TREE_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/></svg>';

export function createFilesView({ files, viewer, view, PROJ, world, announce, onChange, onDock = null }) {
  const F = { open: false, min: false, docked: false, sheet: false, fileOnly: false, seen: null, returnTo: null, head: "", toChip: false,
    chatMin: false, chatOver: false, rows: 0, had: false }; // the chat folded to its rail; open over the file (compact); rows when it folded
  const el = document.createElement("section");
  el.className = "fv";
  el.id = "fv";
  el.hidden = true;
  el.tabIndex = -1;
  el.setAttribute("aria-label", "Files");
  el.innerHTML = `<header class="fv-h"></header><div class="fv-b"></div><div class="fv-cgrip" role="separator" aria-orientation="vertical" aria-label="Resize the conversation" title="Drag to resize · double-click for the default" tabindex="0"></div>`;
  $("#main").appendChild(el);
  const body = el.querySelector(".fv-b");
  files.mount(body);
  const cls = document.body.classList;

  // the tree's width: dragged, keyboard (← →), double-click for the default; kept per browser
  let tw = TW_DEF;
  try { tw = Number(localStorage.getItem(TW_KEY)) || TW_DEF; } catch { /* private mode */ }
  const setTw = (w, save = false) => {
    tw = Math.round(Math.max(TW_MIN, Math.min(TW_MAX, w)));
    el.style.setProperty("--tw", `${tw}px`);
    if (save) { try { localStorage.setItem(TW_KEY, String(tw)); } catch { /* private mode */ } }
  };
  setTw(tw);
  // a line you drag (pointer, ← →, double-click for the default)
  function dragLine(line, { at, set, def }) {
    line.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      line.setPointerCapture(e.pointerId);
      cls.add("fv-sizing");
      const move = (ev) => set(at(ev.clientX));
      const up = () => { line.removeEventListener("pointermove", move); cls.remove("fv-sizing"); set(null, true); };
      line.addEventListener("pointermove", move);
      line.addEventListener("pointerup", up, { once: true });
      line.addEventListener("pointercancel", up, { once: true });
    });
    line.addEventListener("dblclick", () => set(def, true));
    line.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      set(at(null, e.key === "ArrowRight" ? 16 : -16), true);
    });
  }
  dragLine(body.querySelector(".fl-split"), {
    at: (x, step) => (x == null ? tw + step : x - body.getBoundingClientRect().left),
    set: (w, save) => setTw(w == null ? tw : w, save), def: TW_DEF,
  });

  // the docked chat's width, on the page (--cw): the line between the file and the chat
  let cw = CW_DEF;
  try { cw = Number(localStorage.getItem(CW_KEY)) || CW_DEF; } catch { /* private mode */ }
  const setCw = (w, save = false) => {
    cw = Math.round(Math.max(CW_MIN, Math.min(CW_MAX, w)));
    document.documentElement.style.setProperty("--cw", `${cw}px`);
    if (save) { try { localStorage.setItem(CW_KEY, String(cw)); } catch { /* private mode */ } }
  };
  setCw(cw);
  dragLine(el.querySelector(".fv-cgrip"), {
    at: (x, step) => (x == null ? cw - step : $("#main").getBoundingClientRect().right - x),
    set: (w, save) => { setCw(w == null ? cw : w, save); if (save) fit(); }, def: CW_DEF,
  });

  // what you chose for the folds, kept per browser; without a choice the widths decide (fit)
  let folds = {};
  try { folds = JSON.parse(localStorage.getItem(FOLD_KEY) || "{}") || {}; } catch { /* private mode */ }
  const keepFold = (k, v) => { folds[k] = v; try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch { /* private mode */ } };
  const sideW = () => { const sd = document.querySelector(".side"); return sd && getComputedStyle(sd).position !== "fixed" ? sd.getBoundingClientRect().width : 0; };
  /** Too narrow for the file (560 px) beside the open chat: the chat starts on its rail, and opening it lays it
   *  over the file's right edge. The line moves with the chat's width: 248 + 44 + 400 + 560 = 1252 px. */
  const compact = () => innerWidth < sideW() + RAIL + cw + COMPACT_FILE;

  /** The folds for this width: the chat (compact, or your choice), then the tree (the file keeps 640 px, unless
   *  you opened the tree yourself). */
  function fit() {
    if (!F.open || !F.docked) return;
    const tight = compact();
    setChat(tight ? (F.chatOver ? "over" : "min") : folds.chat === "folded" ? "min" : "open");
    if (!viewer.hasFile) return;
    const room = el.getBoundingClientRect().width;
    const tree = folds.tree === "open" ? true : folds.tree === "folded" ? false : room - tw - 1 >= FILE_MIN;
    files.fold(!tree);
    paint();
  }
  /** The chat: open in its column, folded to its rail, or (compact) open over the file's edge. Folding slides the
   *  column out on transform (it keeps its width, so nothing in it reflows) and the file widens at the end;
   *  opening narrows the file first, then the column slides in. */
  let slideT = 0;
  function setChat(state) {
    const min = state === "min", over = state === "over";
    if (min === F.chatMin && over === F.chatOver) return;
    const had = document.activeElement;
    F.chatMin = min; F.chatOver = over;
    clearTimeout(slideT);
    if (min) F.rows = document.getElementById("msgs")?.children.length || 0;
    if (F.sheet) {
      // the phone's sheet: up over the lower 70 %, or down to its bar; the conversation stays as it was
      cls.toggle("sheet-up", !min);
      for (const n of [$("#conv"), $("#dock")]) n && n.toggleAttribute("inert", min);
      if (min && had && had.closest && had.closest("#conv, #dock")) toFile();
      onChange && onChange();
      return;
    }
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches || cls.contains("dock-switch"); // no slide as the file opens
    cls.toggle("chat-over", over);
    if (min) {
      cls.add("chat-min");
      if (still) cls.add("chat-railed"); else slideT = setTimeout(() => cls.add("chat-railed"), SLIDE);
      for (const n of [$("#conv"), $("#dock")]) n && n.setAttribute("inert", "");
      if (had && had.closest && had.closest("#conv, #dock")) toFile();
    } else {
      cls.remove("chat-railed");
      for (const n of [$("#conv"), $("#dock")]) n && n.removeAttribute("inert");
      if (still) cls.remove("chat-min"); else requestAnimationFrame(() => cls.remove("chat-min"));
    }
    onChange && onChange();
  }
  function unChat() {
    cls.remove("chat-min", "chat-railed", "chat-over", "sheet-up");
    for (const n of [$("#conv"), $("#dock")]) n && n.removeAttribute("inert");
    F.chatMin = false; F.chatOver = false;
  }
  /** You folded or opened the chat (›|, the rail, ⌘J): kept, unless the width is what folds it. */
  function chat(open, { focus = open } = {}) {
    if (F.sheet) { setChat(open ? "open" : "min"); if (open) requestAnimationFrame(() => $("#chead")?.focus({ preventScroll: true })); return; }
    if (!F.docked) return;
    if (compact()) setChat(open ? "over" : "min");
    else { keepFold("chat", open ? "open" : "folded"); setChat(open ? "open" : "min"); }
    if (open && focus) requestAnimationFrame(() => document.getElementById("say")?.focus({ preventScroll: true }));
    fit();
  }
  /** ⌘J: the chat and nothing else. From the file, the chat opens (if folded) and its composer has focus;
   *  from the chat, it folds and the file has focus. */
  function chatKey() {
    if (!F.docked) return false;
    const a = document.activeElement;
    if (!F.chatMin && a && a.closest && a.closest("#conv, #dock")) chat(false);
    else chat(true);
    return true;
  }

  /** A file beside a conversation: the chat docks in a column on a desktop, is a sheet on a phone; a view with
   *  no conversation (Home, Artifacts) has Files cover it. "docked" | "sheet" | "" */
  const modeNow = () => ($("#conv").hidden ? "" : innerWidth > PHONE ? "docked" : "sheet");
  const modeOf = () => (F.docked ? "docked" : F.sheet ? "sheet" : "");
  const dockable = () => modeNow() !== "";
  function setDocked(on) {
    const m = on ? modeNow() : "";
    if (m === modeOf()) return;
    unChat();
    F.docked = m === "docked"; F.sheet = m === "sheet";
    cls.toggle("chat-sheet", F.sheet);
    if (F.sheet) setChat("min"); // the sheet starts as its bar
    on = F.docked;
    // the switch is one frame: the conversation's own 300 ms padding and offset transitions sit it out
    cls.add("dock-switch");
    cls.toggle("chat-docked", on);
    // the panel steps aside (or comes back) in the same moment, so the conversation goes straight from one
    // width to the other: a frame at a width in between could lose the row you were reading
    onDock && onDock(on);
    requestAnimationFrame(() => requestAnimationFrame(() => cls.remove("dock-switch")));
    F.head = "";
  }

  function headHtml() {
    const v = view();
    let name = "Your projects", sub = "";
    if (v.startsWith("t:")) { const t = world.thread(v.slice(2)); if (t) { name = PROJ(t.project); sub = t.branch || ""; } }
    else if (v.startsWith("p:")) name = PROJ(v.slice(2));
    const at = files.place; // a file opened from elsewhere takes the tree to its own folder: name that one
    if (at) { name = at.label; sub = at.sub; }
    const folded = files.listing ? false : F.sheet ? true : files.folded;
    const tree = viewer.hasFile ? `<button type="button" class="fv-ib" data-fv-tree aria-pressed="${!folded}" title="${folded ? "Show the files (⌘B)" : "Fold the files to a rail (⌘B)"}" aria-label="${folded ? "Show the files" : "Fold the files"}">${TREE_IC}</button>` : "";
    const where = `${tree}<h1 class="fv-t">${esc(name)}</h1>${sub ? `<span class="fv-s">${esc(sub)}</span>` : ""}`;
    // beside the chat: the file is put away (it waits in the thread's header), never closed from here
    if (F.docked || F.sheet) return `${where}<span class="fv-sp"></span><button type="button" class="fv-ib" data-fv-min title="Put the file away (Esc)" aria-label="Put the file away">${ICON.minimize}</button>`;
    const back = v === "home" ? "Home" : v === "ws" ? "Workspace" : v === "artifacts" ? "Artifacts" : v === "chats" ? "Chats" : "Conversation";
    return `<button type="button" class="fv-back" data-fv-back title="Back (Esc)">${ICON.back}<span>${esc(back)}</span></button><span class="fv-sep" aria-hidden="true"></span>${where}`;
  }
  function paint() {
    if (!F.open) return;
    const h = headHtml();
    if (h !== F.head) { el.querySelector(".fv-h").innerHTML = h; F.head = h; }
  }

  /** Shown: the file's classes on the page (a put-away file keeps its place, hidden, scroll and all). */
  function show(on) {
    el.hidden = false;
    cls.toggle("files-open", on);
    cls.toggle("fv-min", !on);
    // the viewer's own room-making is for a file floating over the conversation; here Files owns the room
    if (viewer.hasFile) cls.toggle("viewer-open", on);
    el.toggleAttribute("inert", !on);
  }

  function open({ fileOnly = false, focus = true } = {}) {
    if (F.min) { restore({ focus }); if (!fileOnly) F.fileOnly = false; return; }
    if (!F.open) {
      F.open = true; F.fileOnly = fileOnly;
      F.returnTo = document.activeElement;
      show(true);
      setDocked(dockable());
      diffsReady(); // a file is about to be read: Pierre starts now, not on the first click
      files.show(view());
      fit();
      announce(F.docked ? "The file is open, the conversation beside it. Esc puts the file away." : "Files. Esc goes back to the conversation.");
    } else if (!fileOnly) F.fileOnly = false;
    F.head = "";
    paint();
    if (focus) toFile();
    onChange && onChange();
  }
  function close({ restore: back = true } = {}) {
    if (!F.open && !F.min) return;
    const wasOpen = F.open;
    F.open = false; F.min = false; F.fileOnly = false; F.seen = null;
    el.hidden = true;
    cls.remove("files-open", "fv-min");
    el.removeAttribute("inert");
    setDocked(false);
    files.hide();
    if (viewer.hasFile) viewer.close({ restore: false });
    const to = F.returnTo;
    F.returnTo = null;
    if (back && wasOpen && to && to.isConnected) to.focus({ preventScroll: true });
    onChange && onChange();
  }
  /** Put the file away: it waits as it was (the tree, the file, their scroll and folds) until restore. Focus
   *  that was on it goes to its chip in the header, once drawn (not when the panel is what you asked for). */
  function minimise({ chip = true } = {}) {
    if (!F.open) return;
    F.toChip = chip && el.contains(document.activeElement);
    F.open = false; F.min = true;
    setDocked(false);
    show(false);
    files.hide();
    announce("The file is put away. Its chip in the header brings it back.");
    onChange && onChange();
  }
  function restore({ focus = true } = {}) {
    if (!F.min) return;
    F.min = false; F.open = true;
    show(true);
    setDocked(dockable());
    files.show(view());
    fit();
    F.head = "";
    paint();
    if (focus) toFile();
    onChange && onChange();
  }
  /** Focus on the file (the viewer), else on Files. */
  const toFile = () => { const v = document.getElementById("viewer"); (v && !v.hidden && el.contains(v) ? v : el).focus({ preventScroll: true }); };
  /** Esc: beside the chat, the file is put away (from the chat, an empty composer goes back to the file);
   *  covering the conversation, Files closes. True when it did something. */
  function escape(target) {
    if (F.sheet && F.open) { if (!F.chatMin) setChat("min"); else minimise(); return true; }
    if (F.docked && target && target.closest && target.closest("#conv, #dock")) {
      if (target.matches("textarea, input") && target.value) return false;
      toFile();
      return true;
    }
    if (F.docked) { minimise(); return true; }
    if (F.open) { close(); return true; }
    return false;
  }

  /** Every render: a file opened anywhere comes here; the one that brought us here, closed, takes us back. */
  function sync() {
    const f = viewer.hasFile ? viewer.file : null;
    if (f && f !== F.seen) {
      F.seen = f;
      // beside the chat, the file you opened has focus (Esc puts it away); covering the conversation, as before
      if (!F.open) open({ fileOnly: !files.auto, focus: modeNow() === "docked" });
      if (!files.auto) files.reveal(f);
    } else if (!f && F.seen) {
      F.seen = null;
      if ((F.open || F.min) && F.fileOnly) { close(); return; }
      if (F.min) close({ restore: false });
    }
    // a window crossing the phone's width, or a view that gained or lost its conversation
    if (F.open && modeNow() !== modeOf()) { setDocked(dockable()); fit(); }
    if (F.open && viewer.hasFile !== F.had) { F.had = viewer.hasFile; fit(); }
    if (F.open) { files.render(view()); paint(); }
    // focus that was on the file goes to its chip once the header has drawn it
    if (F.toChip) { const c = document.querySelector("[data-fv-restore]"); if (c) { F.toChip = false; c.focus({ preventScroll: true }); } }
  }

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-fv-back]")) viewer.leave(() => close());
    else if (e.target.closest("[data-fv-min]")) minimise();
    else if (e.target.closest("[data-fv-tree]")) toggleTree();
  });
  /** ◧, ⌘B: the tree folds to its rail or opens, and that's kept. */
  function toggleTree() {
    if (!F.open || !viewer.hasFile) return false;
    // one at a time (a phone): the list swaps in for the file, and picking a file (or ◧ again) swaps back
    if (files.list(!files.listing)) { F.head = ""; paint(); return true; }
    files.fold(!files.folded, { mine: true });
    return true;
  }
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (e.target.closest && e.target.closest("#viewer")) return; // the file closes itself first
    if (e.target.closest && e.target.closest("input") && e.target.value) return;
    e.preventDefault(); e.stopPropagation();
    escape(e.target);
  });
  // a phone's sheet: swipe its bar up, or its head down (a tap on the bar opens it too, as its click)
  const swipe = (node, dir, act) => {
    if (!node) return;
    let y0 = null;
    node.addEventListener("pointerdown", (e) => { y0 = F.sheet ? e.clientY : null; });
    node.addEventListener("pointerup", (e) => { if (y0 != null && dir * (e.clientY - y0) > 32) act(); y0 = null; });
    node.addEventListener("pointercancel", () => { y0 = null; });
  };
  swipe($("#crail"), -1, () => chat(true));
  swipe($("#chead"), 1, () => chat(false));
  addEventListener("resize", () => {
    if (!F.open) return;
    if (modeNow() !== modeOf()) { setDocked(dockable()); paint(); onChange && onChange(); }
    fit();
  });

  return {
    get isOpen() { return F.open; },
    /** The file beside the chat (a desktop conversation). */
    get docked() { return F.open && F.docked; },
    /** The file put away: {file} for its chip in the thread's header, or null. */
    get putAway() { return F.min && viewer.hasFile ? { file: viewer.file } : null; },
    /** The chat folded to its rail beside a file, and how many rows it had when it folded (new ones: a dot). */
    get chatFolded() { return (F.docked || F.sheet) && F.open && F.chatMin; },
    /** A phone: the chat is a sheet over the file. */
    get sheet() { return F.open && F.sheet; },
    get chatRows() { return F.rows; },
    open: () => open(),
    close,
    minimise,
    restore,
    escape,
    chat,
    chatKey,
    toggleTree,
    /** The tree was folded or opened by you (js/files.js): kept, and the head says so. */
    treeFolded(folded) { keepFold("tree", folded ? "folded" : "open"); F.head = ""; paint(); },
    sync,
    owns: (node) => !!(node && el.contains(node)),
  };
}
