// @ts-check
import { esc } from "../../core/platform/util.js";
import { createDialog } from "../../core/ui/components/dialog.js";
import { rtName, rtMark, sessionThreads } from "../../core/services/runtimes.js";

/** @import { InUse, UninstallDeps } from "./lifecycle-types" */

/** What an uninstall leaves on the machine, by runtime. @type {Record<string, string>} */
const KEEPS = { claude_code: "~/.claude" };

/** @param {number} count @param {string} n */
function leadOf(count, n) {
  if (!count) return `XO removes ${n}'s CLI from this machine. Threads can't run on it until it's installed again.`;
  const one = count === 1;
  return `${one ? "A thread is" : `${count} threads are`} running on ${n} now. Uninstalling stops ${one ? "it" : "them"} first; ` +
    `${one ? "its" : "their"} work so far stays in ${one ? "its conversation" : "their conversations"}.`;
}

/** @param {InUse} u */
const useHtml = (u) => {
  const title = `<b>${esc(u.title)}</b>`;
  const head = u.go ? `<button type="button" class="rt-go" data-go="${esc(u.go)}">${title}</button>` : title;
  return `<li>${head}${u.where ? `<span>${esc(u.where)}</span>` : ""}</li>`;
};

/** @param {string} name @param {"confirm" | "busy" | "inuse"} phase @param {InUse[]} using */
function uninstallHtml(name, phase, using, err = "") {
  const n = esc(rtName(name)), keep = KEEPS[name], count = phase === "inuse" ? using.length : 0;
  const list = count ? `<ul class="rt-uses">${using.map(useHtml).join("")}</ul>` : "";
  const kept = keep ? `<p class="cp-note"><span>Keeps <code>${esc(keep)}</code>, ` +
    "so you won't need to sign in again after reinstalling.</span></p>" : "";
  const busy = phase === "busy" ? ' aria-busy="true" aria-disabled="true"' : "";
  const go = count ? `Stop ${count} and uninstall` : phase === "busy" ? "Uninstalling…" : "Uninstall";
  return `<form method="dialog"><header class="dlg-head"><span class="dlg-ic">${rtMark(name) || ""}</span>` +
    `<div><h2 id="rtu-title">Uninstall ${n}?</h2><p>${leadOf(count, n)}</p></div></header>` +
    list + kept + (err ? `<p class="set-err" role="alert">${esc(err)}</p>` : "") +
    `<footer class="dlg-foot"><button type="button" class="btn" data-rtu="keep">Keep ${n}</button>` +
    `<button type="button" class="btn btn-danger" data-rtu="go"${busy}>${esc(go)}</button></footer></form>`;
}

/** A plain confirm, or the threads running on it and a forced uninstall. @param {UninstallDeps} deps */
export function createUninstall({ run, state, go, pushLayer, scope }) {
  const d = createDialog();
  d.setAttribute("aria-labelledby", "rtu-title");
  /** @type {{ name: string, phase: "confirm" | "busy" | "inuse", using: InUse[], err: string, pop?: () => void } | null} */
  let open = null;
  const paint = () => { if (open) d.innerHTML = uninstallHtml(open.name, open.phase, open.using, open.err); };
  const close = () => {
    if (!open) return false;
    const pop = open.pop;
    open = null;
    if (d.open) d.close();
    pop?.();
    return true;
  };
  scope.effect(() => () => { close(); d.remove(); });
  scope.listen(d, "cancel", (e) => { e.preventDefault(); close(); });
  /** @param {NonNullable<typeof open>} now */
  async function confirm(now) {
    const force = now.phase === "inuse";
    now.phase = "busy"; now.err = ""; paint();
    /** @param {unknown} err */
    const failed = (err) => { now.err = err instanceof Error ? err.message : String(err); return null; };
    const r = await run(now.name, force).catch(failed);
    if (open !== now) return;
    if (r && r.inUse.length) {
      now.phase = "inuse"; now.using = sessionThreads(r.inUse, state()); paint();
      /** @type {HTMLElement | null} */ (d.querySelector('[data-rtu="go"]'))?.focus();
    } else if (now.err) { now.phase = force ? "inuse" : "confirm"; paint(); }
    else close();
  }
  scope.listen(d, "click", (e) => {
    if (e.target === d) { close(); return; }
    const t = e.target instanceof Element ? e.target : null;
    const to = t?.closest("[data-go]")?.getAttribute("data-go");
    if (to) { close(); go(to); return; }
    const b = t?.closest("[data-rtu]")?.getAttribute("data-rtu");
    if (b === "keep") close();
    else if (b === "go" && open && open.phase !== "busy") void confirm(open);
  });
  return {
    /** @param {string} name @param {Element | null} [from] */
    ask(name, from = null) {
      if (open) close();
      open = { name, phase: "confirm", using: [], err: "" };
      paint();
      if (!d.isConnected) document.body.append(d);
      d.showModal();
      open.pop = pushLayer({ id: "runtime-uninstall", back: close, escape: close, returnFocus: from });
      /** @type {HTMLElement | null} */ (d.querySelector('[data-rtu="keep"]'))?.focus();
    },
  };
}
