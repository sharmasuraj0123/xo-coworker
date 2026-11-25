// @ts-check
import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { heldShort, heldWords, soonestHeld } from "../../core/services/world/held.js";
import { EASE, MOVE, RM, still } from "../../core/ui/motion.js";
import { reconcile, redraw } from "../../core/ui/redraw.js";
import { createCalmOrder } from "../sideorder.js";

/** @import { Hold, SideNeed, SideRowsDeps } from "./rows-types.d.ts" */

/** @template {SideNeed} N @param {SideRowsDeps<N>} deps */
export function createSideRows({ view, world, CH, places, D, projects, convThread, isBusy, isHeld, askShort, projectIcon, folded }) {
  const SIDE_CALM = Object.assign(createCalmOrder(), { over: false, pending: false, t: 0 });
  /** @type {Map<string, { n: number, until: number }>} */
  const washes = new Map();
  /** @type {Map<string, number>} */
  let previousNeeds = new Map();
  let signature = "", ready = false, homeCount = -1, workspaceCount = -1;
  /** @param {N[]} needs */
  const sideRender = (needs) => {
    const current = view();
    const mine = needs.filter((x) => x.admitted && !x.later);
    const n = mine.length;
    const hn = $("#home-n");
    const hnHtml = n ? `<span class="nv-dot" aria-hidden="true"></span>${n}` : "";
    if (homeCount !== n) { redraw(hn, hnHtml); homeCount = n; }
    $("#nv-home").setAttribute("aria-label", n ? `Home, ${n} need you` : "Home, nothing needs you");
    // the Workspace's own coordinator asking: the same amber mark on its row, as a project's row has
    const wsN = mine.filter((x) => x.t.host && x.t.project === "workspace").length;
    const wnHtml = wsN ? `<span class="nv-dot" aria-hidden="true"></span>${wsN}` : "";
    const wn = $("#ws-n");
    if (workspaceCount !== wsN) { redraw(wn, wnHtml); workspaceCount = wsN; }
    $("#nv-ws").setAttribute("aria-label", wsN ? `Workspace, its coordinator needs you` : "Workspace");
    $("#nv-home").classList.toggle("is-on", current === "home");
    $("#nv-ws").classList.toggle("is-on", current === "ws");
    $("#nv-chats").classList.toggle("is-on", CH.isChats(current));
    $("#nv-arts").classList.toggle("is-on", current === "artifacts");
    $("#nv-lp").classList.toggle("is-on", current === "launchpad");
    // the Artifacts row's count is quiet: a number, never a signal
    const artifacts = /** @type {import("../surface-types").ArtifactsPage | undefined} */ (places.get("page", "artifacts"));
    const count = artifacts?.count() ?? 0;
    const label = count ? String(count) : "";
    if ($("#arts-n").textContent !== label) $("#arts-n").textContent = label;
    $("#nv-arts").setAttribute("aria-label", count ? `Artifacts, ${count}` : "Artifacts");
    // (aria-current="page": an empty aria-current, as toggleAttribute writes it, reads as false)
    for (const b of [$("#nv-home"), $("#nv-ws"), $("#nv-chats"), $("#nv-arts"), $("#nv-lp")]) if (b.classList.contains("is-on")) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    $("#nv-more").classList.toggle("is-on", !!$("#side .nav .nrow.is-on[hidden]")); // a place kept in More marks More
    const now = Date.now();
    const rows = projects().map((p) => {
      const on = current === "p:" + p.id || convThread(current)?.project === p.id;
      const asks = mine.filter((x) => x.t.project === p.id);
      const lead = asks.find((x) => x.group !== "stopped" && x.risk !== "destructive") || asks[0];
      const nBusy = world.state.threads.filter((t) => t.project === p.id && (t.state === "resolved" ? t.busy === true : isBusy(t))).length;
      const coordBusy = !!world.act.coordinatorBusy(p.id);
      const busy = nBusy > 0 || coordBusy;
      const needsMe = asks.length > 0;
      const working = busy && !needsMe;
      const held = !busy && !needsMe ? soonestHeld(/** @type {Hold[]} */ ([...world.state.threads.filter((t) => t.project === p.id && isHeld(t)).map((t) => t.held), world.act.coordinatorHeld && world.act.coordinatorHeld(p.id)])) : null;
      const label = needsMe ? askShort(lead) : working ? (nBusy > 1 ? `${nBusy} threads working` : nBusy ? "Working" : "Coordinator working") : held ? heldShort(held) : "";
      const kind = needsMe ? (lead.risk === "destructive" || lead.group === "stopped" ? "red" : "amber") : "";
      const was = previousNeeds.get(p.id) || 0;
      if (asks.length > was && ready && !RM.matches) washes.set(p.id, { n: (washes.get(p.id)?.n || 0) + 1, until: now + 2600 });
      const w = washes.get(p.id);
      const washing = w && w.until > now;
      return { key: p.id, html:
        `<button type="button" class="prow${needsMe ? ` needs k-${kind}` : working ? " busy" : ""}${on ? " is-on" : ""}${washing ? " wash" : ""}" data-go="p:${esc(p.id)}" data-w="${washing ? w.n : 0}"${on ? ' aria-current="page"' : ""} aria-label="${esc(p.name)}${needsMe ? `. ${asks.length} need${asks.length === 1 ? "s" : ""} you: ${esc(label)}` : busy ? ". Working" : held ? `. ${esc(heldWords(held))}` : ""}"${folded() ? ` title="${esc(p.name)}${needsMe ? ` · ${asks.length} need${asks.length === 1 ? "s" : ""} you` : busy ? " · Working" : ""}"` : ""}>` +
        `<span class="pr-ic" aria-hidden="true">${projectIcon(p.id)}${busy && needsMe ? `<i class="pr-busy"></i>` : ""}</span>` +
        `<span class="pr-main"><span class="pr-l1"><span class="pr-name">${esc(p.name)}</span>${needsMe ? `<span class="pr-w" aria-hidden="true"><i class="pr-d"></i>${asks.length}</span>` : ""}</span>` +
        (label ? `<span class="pr-t">${esc(label)}</span>` : "") + `</span></button>`, active: busy || needsMe, urgent: needsMe };
    });
    const held = SIDE_CALM.over || ($("#side").matches(":focus-within") && !!document.activeElement?.matches(":focus-visible"));
    const calm = SIDE_CALM.order(rows.map((r) => ({ id: r.key, active: r.active, urgent: r.urgent })), now, { first: !ready, held });
    SIDE_CALM.pending = calm.pending;
    clearTimeout(SIDE_CALM.t);
    if (calm.next != null) SIDE_CALM.t = setTimeout(() => sideRender(D.needItems()), calm.next + 50);
    const up = new Set(calm.top);
    const items = [...rows.filter((r) => up.has(r.key)), ...(up.size && up.size < rows.length ? [{ key: "pr-sep", html: `<div class="pr-sep" aria-hidden="true"></div>` }] : []), ...rows.filter((r) => !up.has(r.key))];
    const box = $("#projects"), sig = items.map((r) => r.key).join();
    const from = ready && sig !== signature && !still() ? new Map([.../** @type {HTMLCollectionOf<HTMLElement>} */ (box.children)].map((el) => [el, el.getBoundingClientRect().top])) : null;
    previousNeeds = new Map(projects().map((p) => [p.id, mine.filter((x) => x.t.project === p.id).length]));
    // a row that changes (where you are, a count) is updated in place: its lines stay, so nothing replays its entrance
    reconcile(box, items, { quiet: !ready });
    signature = sig;
    if (from) for (const [el, y] of from) { const dy = el.isConnected ? y - el.getBoundingClientRect().top : 0; if (Math.abs(dy) > 0.5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: MOVE, easing: EASE }); }
    ready = true;
  };
  {
    const side = $("#side"), settle = () => { if (SIDE_CALM.pending) setTimeout(() => !SIDE_CALM.over && sideRender(D.needItems()), 800); };
    side.addEventListener("pointerenter", () => { SIDE_CALM.over = true; });
    side.addEventListener("pointerleave", () => { SIDE_CALM.over = false; settle(); });
    side.addEventListener("focusout", (/** @type {FocusEvent} */ e) => { if (!side.contains(/** @type {Node | null} */ (e.relatedTarget))) settle(); });
  }
  return sideRender;
}
