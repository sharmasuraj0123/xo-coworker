// @ts-check

import { esc } from "../../core/platform/index.js";
import { redraw } from "../../core/ui/redraw.js";
import { ICON } from "../../core/ui/icons/names.js";
import * as K from "../../core/platform/keys.js";
import { isRunning, isDetached, stateLine, dotOf, runningOf, listRows, whereOf } from "./model.js";

/** @param {import('./dock-types.js').DockState} R @param {import('./dock-types.js').DockViewOptions} view */
export function createDockView(R, { root, side, tabsEl, actsEl, listEl, confirmEl, byId, nameOf, PROJ, wanted, LIST }) {
  function render() {
    const show = R.enabled && wanted();
    side.hidden = !show;
    if (show) {
      const n = runningOf(R.list).length;
      const nEl = /** @type {HTMLElement} */ (side.querySelector(".sh-n"));
      const h = n ? String(n) : "";
      if (nEl.textContent !== h) nEl.textContent = h;
      const up = R.open && !R.min;
      side.setAttribute("aria-label", n ? `Shells, ${n} running` : "Shells");
      side.setAttribute("aria-pressed", String(up));
      side.title = `${up ? "Hide" : "Show"} shells (${K.label("shells")})`;
      side.classList.toggle("is-on", up);
    }
    root.hidden = !show || !R.open;
    root.classList.toggle("is-min", R.min);
    root.classList.toggle("is-half", R.half);
    document.getElementById("app")?.classList.toggle("has-shd", show && R.open);
    root.style.setProperty("--shd-h", `${R.h}px`);
    if (root.hidden) return;
    renderTabs();
    renderActs();
    renderConfirm();
    listEl.hidden = R.active !== LIST;
    for (const [id, tab] of R.tabs) {
      tab.pane.hidden = R.active !== id;
      const note = noteFor(id, tab);
      const el = /** @type {import("./dock-types.js").DockElement} */ (tab.pane.querySelector(".shd-note"));
      el.hidden = !note;
      if (note && el._h !== note) { redraw(el, note); el._h = note; }
      tab.pane.classList.toggle("is-ended", tab.state === "ended" || tab.state === "off");
    }
    if (R.active === LIST) renderList();
  }

  function renderTabs() {
    // a name being typed is never replaced under the person's fingers
    if (R.edit && tabsEl.querySelector("[data-sh-name]") === document.activeElement) return;
    const n = runningOf(R.list).length;
    const tabs = [`<button type="button" role="tab" class="shd-tab shd-tab-list" data-sh-tab="${LIST}" aria-selected="${R.active === LIST}" title="Every shell">${ICON.list}<span class="shd-tn">Shells</span>${n ? `<span class="shd-c">${n}</span>` : ""}</button>`];
    for (const id of R.order) {
      const tab = /** @type {import("./dock-types.js").DockTab} */ (R.tabs.get(id));
      const t = byId(id);
      const dot = tab.state === "live" ? "on" : tab.state === "connecting" || tab.state === "retrying" ? "wait" : "ended";
      const tip = [nameOf(id), t ? whereOf(t, PROJ) : "", tab.title].filter(Boolean).join(" · ");
      if (R.edit === id && R.active === id) {
        tabs.push(`<span class="shd-tabw is-on is-edit"><i class="shd-dot d-${dot}" aria-hidden="true"></i><input class="shd-in" data-sh-name="${esc(id)}" maxlength="60" value="${esc(nameOf(id))}" aria-label="Shell name" title="Enter keeps it, Esc cancels"></span>`);
        continue;
      }
      tabs.push(`<span class="shd-tabw${R.active === id ? " is-on" : ""}"><button type="button" role="tab" class="shd-tab" data-sh-tab="${esc(id)}" aria-selected="${R.active === id}" title="${esc(tip)}"><i class="shd-dot d-${dot}" aria-hidden="true"></i><span class="shd-tn">${esc(nameOf(id))}</span></button>` +
        `<button type="button" class="shd-tx" data-sh-detach="${esc(id)}" aria-label="Stop watching ${esc(nameOf(id))}" title="Stop watching (it keeps running)">${ICON.close}</button></span>`);
    }
    const html = tabs.join("");
    if (tabsEl._h !== html) { redraw(tabsEl, html); tabsEl._h = html; }
  }

  function renderActs() {
    const id = R.active;
    const tab = R.tabs.get(id);
    let html = "";
    if (tab) {
      const t = byId(id);
      // where it runs ("In demo"), never the same word as its name beside it; the whole path on hover
      const sub = [t ? `In ${whereOf(t, PROJ)}` : "", tab.title && tab.title !== nameOf(id) ? tab.title : ""].filter(Boolean).join(" · ");
      const closing = R.busy.has(id);
      html += `<span class="shd-where" title="${esc(t?.cwd || "")}">${esc(sub)}</span>` +
        `<button type="button" class="shd-act" data-sh-rename="${esc(id)}" title="Rename"${R.edit === id ? ' aria-disabled="true"' : ""}>${ICON.edit}<span>Rename</span></button>` +
        `<button type="button" class="shd-act is-danger" data-sh-close="${esc(id)}"${closing ? ' aria-disabled="true"' : ""} title="Close the shell and everything running in it">${closing ? '<span class="spin" aria-hidden="true"></span><span>Closing…</span>' : `${ICON.close}<span>Close<span class="shd-long"> shell</span></span>`}</button>`;
    }
    // − folds the dock to its bar, and minimised a chevron points up, the way it comes back; ↓ puts it away
    html += `<button type="button" class="shd-act shd-ic${R.min ? " is-up" : ""}" data-sh-min aria-label="${R.min ? "Show shells" : "Minimise shells"}" title="${R.min ? "Show" : "Minimise"} (${esc(K.label("shells"))})">${R.min ? ICON.chevron : ICON.minimize}</button>` +
      `<button type="button" class="shd-act shd-ic" data-sh-hide aria-label="Hide shells" title="Hide (they keep running)">${ICON.hide}</button>`;
    if (actsEl._h !== html) { redraw(actsEl, html); actsEl._h = html; }
  }

  function renderConfirm() {
    const c = R.confirm && !R.confirm.row ? R.confirm : null; // a row's question is asked in its row
    confirmEl.hidden = !c;
    if (!c) { confirmEl.innerHTML = ""; confirmEl._h = ""; return; }
    const html = c.kind === "close"
      ? `<p><b>${esc(c.fg)}</b> is running in <b>${esc(nameOf(c.id))}</b>. Closing the shell stops it, and everything else started there.</p><div class="shd-ca"><button type="button" class="btn" data-sh-no>Keep it</button><button type="button" class="btn btn-danger" data-sh-yes>Close shell</button></div>`
      : `<p>Close <b>${c.ids.length} detached shell${c.ids.length === 1 ? "" : "s"}</b>? Everything running in ${c.ids.length === 1 ? "it" : "them"} stops.</p><div class="shd-ca"><button type="button" class="btn" data-sh-no>Keep them</button><button type="button" class="btn btn-danger" data-sh-yes>Close ${c.ids.length}</button></div>`;
    if (confirmEl._h !== html) { redraw(confirmEl, html); confirmEl._h = html; }
    confirmEl.setAttribute("aria-label", c.kind === "close" ? "Close this shell" : "Close detached shells");
  }

  /** @param {string} id @param {import("./dock-types.js").DockTab} tab */
  function noteFor(id, tab) {
    const d = tab.detail || {};
    if (tab.state === "connecting") return "";
    if (tab.state === "retrying") return `<span class="spin" aria-hidden="true"></span><span>${esc(d.reason || "Reconnecting")} · trying again${tab.until ? ` in <span data-left>${Math.max(1, Math.ceil((tab.until - Date.now()) / 1000))}</span> s` : ""}</span><button type="button" class="btn" data-sh-retry="${esc(id)}">Retry now</button>`;
    if (tab.state === "ended") {
      const x = tab.exit;
      const what = x ? (x.reason && x.reason !== "exited" ? x.reason : x.code == null ? "ended" : `exited${x.code ? ` with code ${x.code}` : ""}`) : d.reason || "ended";
      return `<span>This shell ${esc(what)}.</span><button type="button" class="btn" data-sh-detach="${esc(id)}">Close tab</button>`;
    }
    if (tab.state === "off") return `<span>Shells are off. ${esc(d.reason || "")}</span>`;
    if (tab.state === "error") return `<span>${esc(d.reason || "Couldn't attach.")}</span><button type="button" class="btn" data-sh-retry="${esc(id)}">Try again</button>`;
    return "";
  }

  function renderList() {
    // a name being typed is never replaced under the person's fingers
    if (R.edit && listEl.querySelector("[data-sh-name]") === document.activeElement) return;
    const f = R.filter;
    const rows = listRows(R.list, f);
    const where = f == null ? null : f === "workspace" ? "Workspace" : PROJ(f);
    const detached = rows.filter(isDetached).length;
    const now = Date.now();
    const head =
      `<div class="shl-head">` +
      (where ? `<span class="shl-f">${esc(where)}<button type="button" class="shl-all" data-sh-filter="">Show every shell</button></span>` : `<span class="shl-f">Every shell</span>`) +
      `<span class="shl-sp"></span>` +
      (detached ? `<button type="button" class="btn shl-cd" data-sh-closedet>Close all detached<span>${detached}</span></button>` : "") +
      (R.opening ? `<button type="button" class="btn btn-pri" data-sh-new aria-disabled="true"><span class="spin" aria-hidden="true"></span>Opening…</button>`
        : `<button type="button" class="btn btn-pri" data-sh-new>${ICON.plus}New shell${where ? ` in ${esc(where)}` : " in the workspace"}</button>`) +
      `</div>`;
    let body;
    if (!R.loaded && R.err) body = `<p class="shl-empty"><b>Couldn't read the shells.</b> ${esc(R.err)}</p>`;
    else if (!R.loaded) body = `<p class="shl-empty"><span class="spin" aria-hidden="true"></span> Reading…</p>`;
    else if (!rows.length) body = `<p class="shl-empty"><b>No shells${where ? ` in ${esc(where)}` : ""} yet.</b> New shell opens one in ${where ? (f === "workspace" ? "the projects folder" : "the project's folder") : "the projects folder"}. A shell keeps running when you look away, and comes back with its output.</p>`;
    else body = `<ul class="shl-list">${rows.map((t) => rowHtml(t, now)).join("")}</ul>`;
    const html = head + body + (R.err && R.loaded ? `<p class="shl-err">Couldn't refresh: ${esc(R.err)}</p>` : "");
    if (listEl._h !== html) { redraw(listEl, html); listEl._h = html; }
    if (R.edit) (/** @type {HTMLInputElement | null} */ (listEl.querySelector("[data-sh-name]")))?.focus();
  }

  /** @param {import("./model.js").Shell} t @param {number} now */
  function rowHtml(t, now) {
    const id = esc(t.id);
    const run = isRunning(t);
    const name = R.edit === t.id
      ? `<input class="shd-in" data-sh-name="${id}" maxlength="60" value="${esc(t.name)}" aria-label="Shell name">`
      : `<b class="shl-n">${esc(t.name)}</b>`;
    const fg = run && t.foreground ? `<code class="shl-fg">${esc(t.foreground)}</code>` : "";
    const watched = R.tabs.has(t.id), busy = R.busy.has(t.id);
    const ask = R.confirm?.kind === "close" && R.confirm.row && R.confirm.id === t.id ? R.confirm : null;
    const state = busy ? "closing…" : stateLine(t, now) + (watched ? " · open here" : "");
    return `<li class="shl-row${run ? "" : " is-ended"}${busy ? " is-busy" : ""}${ask ? " is-asking" : ""}">` +
      `<i class="shd-dot d-${dotOf(t)}" aria-hidden="true"></i>` +
      `<div class="shl-main">${name}<span class="shl-w" title="${esc(t.cwd || "")}">${esc(whereOf(t, PROJ))}</span>` +
      (ask ? `<span class="shl-s shl-q" role="alert"><b>${esc(ask.fg)}</b> is running in it. Closing the shell stops it, and everything else started there.</span></div>` +
          `<div class="shl-acts shl-ask"><button type="button" class="btn" data-sh-no>Keep it</button><button type="button" class="btn btn-danger" data-sh-yes>Close shell</button></div></li>`
        : `<span class="shl-s">${fg}${esc(state)}</span></div>` +
          `<div class="shl-acts">` +
          (run ? `<button type="button" class="btn" data-sh-open="${id}"${busy ? ' aria-disabled="true"' : ""}>${watched ? "Show" : "Open"}</button>` : "") +
          (run ? `<button type="button" class="shd-act shd-ic" data-sh-rename="${id}" aria-label="Rename ${esc(t.name)}" title="Rename"${busy ? ' aria-disabled="true"' : ""}>${ICON.edit}</button>` : "") +
          `<button type="button" class="shd-act shd-ic is-danger" data-sh-close="${id}"${busy ? ' aria-disabled="true"' : ""} aria-label="${run ? "Close" : "Forget"} ${esc(t.name)}" title="${run ? "Close the shell and everything running in it" : "Forget it"}">${busy ? '<span class="spin" aria-hidden="true"></span>' : ICON.close}</button>` +
          `</div></li>`);
  }

  return { render, renderTabs };
}
