// ─────────────────────────────────────────────────────────────────────────────
// The Decision Kit · finalists.md §3.4 · reference implementation (F2 Audience Desk)
//
// Copy this file whole into any concept. It knows nothing about the desk: it
// gives you the honest ask list, the risk weights, the one place that turns a
// decision into a world call, the 3 s commit window with Undo, the press-and-
// hold guard for destructive asks, the breakpoint-deferred announcer, the
// Teach sentence and the tab title. The rules it enforces:
//
//   • destructive is never batched, never one key, never a gesture: hold 1.2 s
//     on the button, after the detail has been on screen ≥ 300 ms, and only
//     from a fresh key press (a key still held from the last card is ignored);
//   • "no" is as cheap as "yes" (callers render Send back at the same size);
//   • every decision waits 3 s in a commit window you can Undo;
//   • Teach is an explicit sentence the person reads before it is sent;
//   • a waiting thread with no ask still gets one (synthetic), so the
//     needs-you channel is complete.
// ─────────────────────────────────────────────────────────────────────────────
import { WAITING } from "./world.js";
import { itemBody } from "./review.js";
import { typing } from "./keys.js";

export const COMMIT_MS = 3000;   // commit window before the world call
export const HOLD_MS = 1200;     // destructive press-and-hold
export const READ_MS = 300;      // detail must be on screen this long before a hold / notable key
export const GROUPS = ["rope", "notable", "routine", "stopped"]; // needs-you order

/** routine | notable | destructive. Live asks have no risk: treat as notable. */
export const riskOf = (ask) => (ask && (ask.risk === "routine" || ask.risk === "destructive") ? ask.risk : "notable");

/** Permission and approval asks are yes/no; questions and actions take options or text. */
export const isBinary = (ask) => !!ask && (ask.kind === "permission" || ask.kind === "approval");

/** Stable key for one ask. Live ids are per thread, so the title is part of the key. */
export const askKey = (t, ask) => `${ask.id ?? `${t.id}:synthetic`}|${ask.title}`;

/** Which needs-you group an ask belongs to. */
export function groupOf(t, ask) {
  if (t.state === "failed") return "stopped";
  const r = riskOf(ask);
  return r === "destructive" ? "rope" : r;
}

/** The thread's asks, or one synthetic ask when it waits on the person with none (live). */
export function asksOf(t) {
  if (t.asks && t.asks.length) return t.asks;
  // a thread continued on another runtime is frozen, not waiting on you (mixed runtimes F4)
  if (!WAITING(t.state) || t.frozen) return [];
  return [{
    id: null,
    kind: t.state === "needs_approval" ? "approval" : "question",
    title: t.needsYou || "Open the thread to see what it needs",
    risk: "notable",
    synthetic: true,
  }];
}

/** "Run: npm test -- x" → "npm test -- x"; null when the ask is not a command. */
export function commandOf(ask) {
  const m = /^run:\s*(.+)$/i.exec((ask && ask.title) || "");
  return m ? m[1].trim() : null;
}

/** Normalised command prefix used for "you've allowed this 3 of 3 times". */
export function prefixOf(cmd) {
  const w = String(cmd || "").trim().split(/\s+/);
  const tool = /^(npm|pnpm|yarn|npx|bun|git|python3?|pip3?|make|cargo|go|docker|kubectl|terraform)$/;
  return (tool.test(w[0]) && w[1] && !w[1].startsWith("-") ? w.slice(0, 2) : w.slice(0, 1)).join(" ");
}

/** The exact sentence Teach appends. Shown on screen before anything is sent. */
export const teachSentence = (house, cmd) => `Standing rule for ${house}: you may run "${cmd}" without asking.`;

/**
 * The only place a decision becomes a world call (§3.2 traps applied).
 * choice: "allow" | "deny" | { option } | { text }
 */
export function answer(world, t, ask, choice, note = "") {
  note = String(note || "").trim();
  // A storm review item: the decision route, with the item's own options (never a thread message,
  // which would withdraw the item instead of answering it).
  if (ask && ask.item) return world.act.decideItem(ask.item.id, itemBody(ask.item, choice, note));
  // A pending approval whose item hasn't arrived: never answer it with a message.
  if (ask && ask.pending) return Promise.reject(new Error("Open the thread to see what it needs."));
  if (choice && typeof choice === "object") {
    if (choice.text != null) return world.act.reply(t.id, choice.text);
    return world.act.reply(t.id, choice.option + (note ? ` (${note})` : ""));
  }
  // A live question is answered in words only: never post a placeholder non-answer.
  if (ask.replyOnly) return Promise.reject(new Error("Answer this one in words."));
  const allow = choice === "allow";
  // Real permission/approval ids go through decide() (it only knows allow vs anything else).
  if (isBinary(ask) && ask.id && !ask.synthetic) return world.act.decide(ask.id, allow ? "allow" : "deny", note);
  // Synthetic or unknown asks become a plain reply, worded like live decide().
  if (isBinary(ask) || ask.synthetic) {
    return world.act.reply(t.id, (allow ? "Approved." : "Not approved.") + (note ? " " + note : ""));
  }
  // A question or action sent back without an answer.
  return world.act.reply(t.id, `Sending this back without an answer.${note ? " " + note : ""}`);
}

/**
 * The commit window. push() shows the consequence at once (caller hides the
 * card, moves a receipt to a tray); the world call happens after `delay`.
 * One item may hold many parts (Allow all routine): one window, one Undo.
 * onChange(type, item, results?) with type: queued | undone | sending | settled.
 */
export function createCommitQueue({ delay = COMMIT_MS, exec, onChange }) {
  const queued = [];
  const inflight = [];
  let n = 0;
  async function fire(item) {
    const i = queued.indexOf(item);
    if (i < 0) return;
    queued.splice(i, 1);
    inflight.push(item);
    onChange("sending", item);
    const results = await Promise.all(item.parts.map((p) =>
      Promise.resolve().then(() => exec(p)).then(() => ({ part: p, ok: true }), (err) => ({ part: p, ok: false, err }))));
    inflight.splice(inflight.indexOf(item), 1);
    onChange("settled", item, results);
  }
  return {
    push(parts, meta = {}) {
      const item = { id: ++n, parts, meta, startedAt: Date.now(), due: Date.now() + delay };
      item.timer = setTimeout(() => fire(item), delay);
      queued.push(item);
      onChange("queued", item);
      return item;
    },
    /** Undo the newest queued item (or one by id). Sent items can't be undone. */
    undo(id) {
      const item = id ? queued.find((x) => x.id === id) : queued[queued.length - 1];
      if (!item) return null;
      clearTimeout(item.timer);
      queued.splice(queued.indexOf(item), 1);
      onChange("undone", item);
      return item;
    },
    has: (key) => [...queued, ...inflight].some((i) => i.parts.some((p) => p.key === key)),
    hasThread: (tid) => [...queued, ...inflight].some((i) => i.parts.some((p) => p.t && p.t.id === tid)),
    get queued() { return queued.slice(); },
    get inflight() { return inflight.slice(); },
  };
}

/**
 * Press-and-hold guard for destructive Allow. Pointer or Enter/Space on the
 * focused button. Releasing early does nothing. A click alone does nothing.
 * ready() returns true or a reason string (shown by onRefuse).
 */
/**
 * The one hold-to-confirm button (allow a destructive ask, remove a worktree), built on holdToConfirm: a solid
 * danger fill that grows with the time held, linearly, so the first moment already moves; a label slot that
 * holds both of its words, so nothing shifts when "Keep holding…" takes over; a calm return when it's let go
 * early. Nothing overshoots. The fill is a transform; the progress is one custom property (--p).
 */
export function holdButton(btn, { ready, onConfirm, onRefuse, onRelease, holding = "Keep holding…" }) {
  const txt = btn.querySelector(".hold-txt");
  if (txt && !txt.querySelector(".ht-a")) {
    const a = document.createElement("span"); a.className = "ht-a"; a.textContent = txt.textContent;
    const b = document.createElement("span"); b.className = "ht-b"; b.setAttribute("aria-hidden", "true"); b.textContent = holding;
    txt.replaceChildren(a, b);
  }
  let back = 0;
  return holdToConfirm(btn, {
    ready,
    onProgress: (p) => {
      if (p > 0 && btn.classList.contains("is-releasing")) { clearTimeout(back); btn.classList.remove("is-releasing"); } // held again mid-drain: the fill follows the hand
      btn.style.setProperty("--p", String(p)); btn.classList.toggle("tense", p > 0.8 && p < 1);
    },
    onConfirm: () => { btn.classList.remove("tense"); onConfirm(); },
    onRefuse,
    onRelease: () => {
      btn.classList.remove("tense"); btn.classList.add("is-releasing");
      clearTimeout(back); back = setTimeout(() => btn.classList.remove("is-releasing"), 260);
      onRelease && onRelease();
    },
  });
}

export function holdToConfirm(btn, { ms = HOLD_MS, ready, onProgress, onConfirm, onRefuse, onRelease }) {
  let t0 = 0, raf = 0, via = null;
  const onAway = (e) => { if (e.type === "blur" || document.hidden) stop(true); };
  const stop = (early) => {
    if (!t0) return;
    cancelAnimationFrame(raf);
    t0 = 0; via = null;
    removeEventListener("blur", onAway); document.removeEventListener("visibilitychange", onAway);
    btn.classList.remove("is-holding");
    btn.setAttribute("aria-pressed", "false");
    if (early) { onProgress(0); onRelease && onRelease(); }
  };
  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / ms);
    onProgress(p);
    if (p >= 1) { stop(false); onConfirm(); } else raf = requestAnimationFrame(tick);
  };
  const start = (src) => {
    if (t0) return;
    const r = ready();
    if (r !== true) { onRefuse && onRefuse(r); return; }
    via = src; t0 = performance.now();
    addEventListener("blur", onAway); document.addEventListener("visibilitychange", onAway);
    btn.classList.add("is-holding");
    btn.setAttribute("aria-pressed", "true");
    raf = requestAnimationFrame(tick);
  };
  btn.addEventListener("keydown", () => btn.classList.remove("by-pointer"));
  btn.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    // held by a pointer, it takes focus without a ring (the default it prevents would have given it focus the same way):
    // a ring round a button you're pressing read as a border (the owner, 11 Nov 08:19Z); a key on it brings the ring back
    btn.classList.add("by-pointer");
    btn.focus({ preventScroll: true, focusVisible: false });
    try { btn.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
    start("pointer");
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) btn.addEventListener(ev, () => via === "pointer" && stop(true));
  btn.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault(); e.stopPropagation();
    if (!e.repeat) start("key"); // a key still held from the previous card is a repeat: ignored
  });
  btn.addEventListener("keyup", (e) => { if ((e.key === "Enter" || e.key === " ") && via === "key") stop(true); });
  btn.addEventListener("blur", () => stop(true));
  // a safety control: the hold ends when the window loses focus or the page hides (listened to only while a hold
  // runs, so a removed card leaves nothing behind), and when the pointer leaves the button (pointer capture keeps
  // the events coming, so it's checked by position, 8 px of give)
  btn.addEventListener("pointermove", (e) => {
    if (via !== "pointer") return;
    const r = btn.getBoundingClientRect();
    if (e.clientX < r.left - 8 || e.clientX > r.right + 8 || e.clientY < r.top - 8 || e.clientY > r.bottom + 8) stop(true);
  });
  btn.addEventListener("click", (e) => e.preventDefault());
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
  return { cancel: () => stop(true) };
}

/**
 * One polite live region. Messages wait for a breakpoint: ≥ quietMs since the
 * person last typed in a field. Never call it per tick, only for arrivals.
 */
export function createAnnouncer(region, { quietMs = 2000 } = {}) {
  let lastTyped = 0;
  const q = [];
  addEventListener("keydown", (e) => {
    if (typing(e)) lastTyped = Date.now(); // a field, even in a shadow root (Pierre's editor)
  }, true);
  const flush = () => {
    if (!q.length || Date.now() - lastTyped < quietMs) return;
    const msg = q.splice(0).join(" ");
    region.textContent = "";
    setTimeout(() => { region.textContent = msg; }, 60);
  };
  setInterval(flush, 400);
  return {
    say(text) { if (text && !q.includes(text)) q.push(text); },
    /** For direct feedback to the person's own action (not arrivals). */
    now(text) { region.textContent = ""; setTimeout(() => { region.textContent = text; }, 60); },
  };
}

/** Honest tab title: the number of asks waiting, never inflated. */
/** The tab says "Needs you" only while it is true; it never counts upward to pull you back (the favicon turns amber). */
export const titleFor = (n, base) => (n ? "Needs you · " : "") + base;
