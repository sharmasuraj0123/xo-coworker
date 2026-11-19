// @ts-check

// Settings › Worktrees: a thread's checkout, removed only after saying what would be lost.

import { api } from "../../js/api.js";
import { esc } from "../../js/world.js";
import { ICON } from "../../js/ui.js";
import { holdButton } from "../../core/ui/components/hold.js";
import { isPending, busyAttrs } from "../../core/platform/index.js";

/** @param {import("./types").SettingsHost} host @param {Omit<import("./types").PageDeps, "onChange">} deps */
export function createWorktreesPage(host, { world, announce, PROJ }) {
  const { R, box, paint, focusTo, pend, neighbour, sel, errHtml, waits, when } = host;

  async function loadTrees() {
    try { const d = await api.worktrees(); R.trees = d.worktrees || []; R.reported = d.reported || []; R.err.trees = null; }
    catch (/** @type {any} */ err) { R.err.trees = err.message; }
    renderTrees();
  }
  /** @param {any} l */
  function lossHtml(l) {
    if (!l) return "";
    const files = [...(l.changed && l.changed.paths || []).map((/** @type {string} */ p) => `changed · ${p}`), ...(l.untracked && l.untracked.paths || []).map((/** @type {string} */ p) => `new · ${p}`)];
    return `<div class="wt-loss"><p><b>${esc(l.summary || "Work that isn't kept anywhere else")}</b></p>` +
      (l.commits ? `<p>${l.commits} commit${l.commits === 1 ? "" : "s"} only on ${esc(l.branch || "its branch")}</p>` : "") +
      (files.length ? `<pre class="tb-out">${esc(files.slice(0, 30).join("\n"))}${files.length > 30 ? `\n… ${files.length - 30} more` : ""}</pre>` : "") + `</div>`;
  }
  /** @param {any} w */
  const treeKey = (w) => `${w.chat_id}/${w.thread_ts}`;
  function renderTrees() {
    paint("worktrees", treesHtml());
    // the hold is wired once per button: a redraw keeps the same node
    const hb = box("worktrees")?.querySelector("[data-wt-hold]");
    if (hb && !hb._hold) {
      hb._hold = true;
      holdButton(hb, /** @type {any} */ ({
        ready: () => !isPending(`wt:${hb.dataset.wtHold}`),
        onConfirm: () => removeTree(hb.dataset.wtHold, R.confirm && R.confirm.token, hb),
      }));
    }
  }
  function treesHtml() {
    if (R.err.trees && !R.trees) return `<p class="set-empty"><b>Couldn't read the worktrees.</b> ${esc(R.err.trees)}</p>`;
    if (!R.trees) return `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`;
    /** @param {any} w */
    const title = (w) => { const t = world.thread(w.thread_ts); return t ? t.title : "A thread"; };
    /** @type {Map<string, any[]>} */
    const by = new Map();
    for (const w of R.trees) { const p = world.act.projectOf ? world.act.projectOf(w.chat_id) : w.chat_id; (by.get(p) || /** @type {any[]} */ (by.set(p, []).get(p))).push(w); }
    return `<p class="set-lead">Each thread works in its own checkout of the project. XO removes one by itself only when nothing would be lost; here you can remove one sooner.</p>` +
      (R.trees.length ? [...by].map(([p, list]) => `<section class="set-sec" data-key="wtp:${esc(p)}"><h3>${esc(PROJ(p))}</h3><ul class="wt-list">${list.map((w) => {
        const key = treeKey(w), pk = `wt:${key}`;
        const c = R.confirm && R.confirm.wt === key ? R.confirm : null;
        const busy = !!(w.session_state && w.session_state !== "cold");
        const state = w.error ? `Can't be read: ${w.error}` : w.exists === false ? "The checkout is already gone" : w.xo === false ? "XO didn't make this checkout, so it won't remove it" : busy ? "Its agent is still using it" : w.would_lose ? "Has work not kept anywhere else" : "Nothing would be lost";
        // offered where the server says it can go, or where it would lose work (shown first, then held)
        const can = !!(w.removable || (w.would_lose && w.xo !== false && !w.error));
        const err = R.err.wt && R.err.wt.key === key ? errHtml(R.err.wt.text) : "";
        const hold = isPending(pk);
        return `<li class="wt-row" data-key="wt:${esc(key)}"><div class="wt-main"><b>${esc(title(w))}</b><code>${esc(w.branch || w.path)}</code><span class="wt-s${w.would_lose ? " is-warn" : ""}">${esc(state)}${w.thread_state ? ` · thread ${esc(String(w.thread_state).replace("_", " "))}` : ""}</span>${c ? "" : err}</div>` +
          (c || !(can || busy) ? "" : `<button type="button" class="btn" data-wt="${esc(key)}"${busy ? " disabled" : busyAttrs(pk)}>Remove</button>`) +
          (c ? `<div class="wt-confirm" role="alertdialog" aria-label="Remove this worktree">${c.lose
            ? lossHtml(c.lose) + `<p class="wt-q">Removing it deletes that work. It can't be undone.</p>${err}<div class="set-fa"><button type="button" class="btn" data-wt-no${waits(pk)}>Keep it</button><button type="button" class="b b-hold wt-hold" data-wt-hold="${esc(key)}" aria-pressed="false"${hold ? ' style="--p:1"' : ""}${busyAttrs(pk)}><span class="hold-fill" aria-hidden="true"></span><span class="b-l"><span class="hold-ic">${ICON.lock}</span><span class="hold-txt"><span class="ht-a">Hold to remove</span><span class="ht-b" aria-hidden="true">Keep holding…</span></span></span></button></div>`
            : `<p class="wt-q">Remove this checkout? Nothing would be lost.</p>${err}<div class="set-fa"><button type="button" class="btn" data-wt-no${waits(pk)}>Keep it</button><button type="button" class="btn btn-danger" data-wt-yes="${esc(key)}"${busyAttrs(pk)}>Remove</button></div>`}</div>` : "") + `</li>`;
      }).join("")}</ul></section>`).join("") : `<p class="set-note">No worktrees right now.</p>`) +
      (R.reported.length ? `<section class="set-sec" data-key="wt-reported"><h3>Made by an agent's own tool</h3><p class="set-lead">XO didn't create these, so it never removes them.</p><ul class="wt-list">${R.reported.map((w) => `<li class="wt-row" data-key="rep:${esc(w.path)}"><div class="wt-main"><code>${esc(w.path)}</code><span class="wt-s">reported ${esc(when(w.reported_at))}</span></div></li>`).join("")}</ul></section>` : "");
  }
  /** @param {string} key @param {Element} from */
  function askTree(key, from) {
    const w = (R.trees || []).find((x) => treeKey(x) === key);
    R.err.wt = null;
    // nothing to lose: one question first; work to lose: the server says exactly what (below), then a hold
    if (w && !w.would_lose) { R.confirm = { wt: key }; renderTrees(); focusTo("worktrees", "[data-wt-no]"); return; }
    removeTree(key, null, from);
  }
  /** @param {string} key @param {any} confirm @param {Element | null} from */
  async function removeTree(key, confirm, from) {
    const [chat, ts] = key.split("/");
    const next = neighbour(from, ".wt-row", "data-wt");
    if (!isPending(`wt:${key}`)) R.err.wt = null;
    await pend(`wt:${key}`, "worktrees", renderTrees, async () => {
      try {
        const res = await api.removeWorktree(chat, ts, confirm);
        R.confirm = null;
        R.trees = /** @type {any[]} */ (R.trees).filter((w) => treeKey(w) !== key);
        announce(res && res.forced ? "Removed. The work in it is gone." : "Removed. Nothing was lost.");
        loadTrees();
        return { to: next && sel("data-wt", next) }; // its row goes: the next row's Remove
      } catch (/** @type {any} */ err) {
        // it would lose work: the server's list of it, and the hold, asked in place of the Remove button, on Keep it
        if (err.code === "would_lose_work") { R.confirm = { wt: key, lose: err.what, token: err.confirm }; return { to: "[data-wt-no]" }; }
        R.err.wt = { key, text: err.code === "session_busy" ? "Its agent is still using it. Stop the thread, or try again once it has gone quiet." : err.message };
        return {};
      }
    }, from);
  }

  return {
    open: loadTrees,
    /** @param {any} t @returns {boolean} */
    click(t) {
      const wt = t.closest("[data-wt]");
      if (wt && !wt.disabled) { askTree(wt.dataset.wt, wt); return true; }
      if (t.closest("[data-wt-no]")) { const k = R.confirm && R.confirm.wt; R.confirm = null; R.err.wt = null; renderTrees(); focusTo("worktrees", k && sel("data-wt", k)); return true; }
      const wy = t.closest("[data-wt-yes]");
      if (wy) { removeTree(wy.dataset.wtYes, null, wy); return true; }
      return false;
    },
  };
}
