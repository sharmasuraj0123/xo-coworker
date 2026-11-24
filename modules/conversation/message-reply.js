// @ts-check
import { copyText, COPY_REFUSED, space } from "../../core/platform/index.js";
import { IC } from "./decoration-icons.js";

/** @typedef {import("./decoration-types.js").Conversation} Conversation */


/** @typedef {{who: string, text: string, conv: string, source?: string}} Reply */


/** @typedef {{generation: number, cancel?: () => void}} CopyState */


/** @param {Conversation} E @param {ReturnType<typeof import("../../core/kernel/scope.js").createScope>} scope @param {{nameIn: (msg: HTMLElement) => string, textOf: (msg: HTMLElement) => string, runText: (msg: HTMLElement) => string, rate: (btn: HTMLElement) => void}} actions */
export function wireMessageReply(E, scope, { nameIn, textOf, runText, rate }) {
  const msgs = E.msgs;
  /** @type {WeakMap<HTMLElement, CopyState>} */
  const copies = new WeakMap();
  const composer = E.composer, sayEl = E.say;
  /** @type {Reply | null} */
  let reply = null;
  /** @type {Map<string, Reply>} */
  const replies = new Map(); // conversation id → its reply on the way
  const chip = document.createElement("div");
  chip.className = "mx-reply"; chip.hidden = true;
  chip.innerHTML = `<span class="mx-r-ic">${IC.reply}</span><span class="mx-r-t"><b></b><span></span></span><button type="button" class="mx-r-x" aria-label="Don't reply to this" title="Don't reply (Esc)">${IC.close}</button>`;
  composer.insertBefore(chip, composer.querySelector(".composer-field"));
  scope.effect(() => () => chip.remove());
  /** @param {string} s */
  const clip = (s, n = 220) => { s = s.replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };

  const convNow = () => (E.view ? E.view() : (/** @type {HTMLElement} */ (document.getElementById("app"))).dataset.conv || "");
  /** @param {Reply | null} r @param {boolean} [animate] */
  function showReply(r, animate) {
    reply = r;
    chip.hidden = !r;
    if (!r) return;
    (/** @type {HTMLElement} */ (chip.querySelector("b"))).textContent = r.who === "You" ? "Yourself" : r.who;
    const t = (/** @type {HTMLElement} */ (chip.querySelector(".mx-r-t>span")));
    t.textContent = clip(r.text); t.title = r.text.length > 220 ? r.text : "";
    chip.classList.remove("is-in");
    if (animate) { void chip.offsetWidth; chip.classList.add("is-in"); }
  }
  /** @param {HTMLElement} m @param {string} [text] */
  function startReply(m, text) {
    const who = nameIn(m);
    const excerpt = text ? text.trim() : clip(textOf(m) || (m.querySelector(".mx-stack, .tb-files") ? "A picture" : ""));
    const r = { who, text: excerpt, conv: convNow(), source: m.dataset.k };
    replies.set(r.conv, r);
    showReply(r, true);
    m.classList.remove("mx-flash"); void m.offsetWidth; m.classList.add("mx-flash");
    sayEl.focus();
  }
  function endReply() { if (reply) replies.delete(reply.conv); showReply(null); }
  const syncReply = () => showReply(replies.get(convNow()) || null);
  if (E.main) {
    const observer = new MutationObserver(syncReply);
    scope.observe(observer);
    observer.observe(E.host, { attributes: true, attributeFilter: ["data-conv"] });
  } else if (E.onView) scope.effect(() => E.onView?.(syncReply));
  scope.listen(/** @type {HTMLElement} */ (chip.querySelector(".mx-r-x")), "click", () => { endReply(); sayEl.focus(); });

  function withQuote() {
    if (!reply || reply.conv !== convNow() || !sayEl.value.trim()) return;
    const before = sayEl.value;
    const source = reply.source ? ` [↩](#xo-message-${encodeURIComponent(reply.source).replaceAll(")", "%29")})` : "";
    const prefix = `> **${reply.who}**${source}\n${reply.text.split("\n").map((l) => `> ${l}`.trimEnd()).join("\n")}\n\n`;
    sayEl.value = prefix + before;
    scope.timeout(() => { if (sayEl.value === prefix + before) sayEl.value = before; else endReply(); }, 0);
  }
  scope.listen(document, "keydown", (event) => {
    const e = /** @type {KeyboardEvent} */ (event);
    if (e.key === "Escape" && reply && chip.contains(/** @type {Node | null} */ (e.target))) { e.preventDefault(); e.stopImmediatePropagation(); endReply(); sayEl.focus(); return; }
    if (e.target !== sayEl || !reply) return;
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && (!E.atList || E.atList.hidden)) withQuote();
    if (e.key === "Escape" && (!E.atList || E.atList.hidden)) { e.preventDefault(); e.stopImmediatePropagation(); endReply(); }
  }, true);
  scope.listen(document, "submit", (e) => { if (e.target === composer && E.send.dataset.mode !== "stop") withQuote(); }, true);

  scope.listen(msgs, "click", async (e) => {
    const g = (/** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest("[data-mx-rate]")));
    if (g) { rate(g); return; }
    const r = (/** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest("[data-mx-reply]")));
    if (r) { startReply((/** @type {HTMLElement} */ (r.closest(".m")))); return; }
    const c = (/** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest("[data-mx-copy]")));
    if (c) {
      const state = copies.get(c) || { generation: 0 };
      copies.set(c, state);
      const gen = ++state.generation;
      const current = () => !scope.signal.aborted && state.generation === gen;
      const ok = await copyText(c.closest(".mx-actrow") ? runText((/** @type {HTMLElement} */ (c.closest(".m")))) : textOf((/** @type {HTMLElement} */ (c.closest(".m")))));
      if (!current()) return;
      const live = document.getElementById("live");
      /** @param {string} w */
      const say = (w) => { if (live) { live.textContent = ""; scope.timeout(() => { if (current()) live.textContent = w; }, 40); } };
      state.cancel?.();
      if (ok) { c.innerHTML = IC.check; say("Copied the message."); state.cancel = scope.timeout(() => { if (current()) c.innerHTML = IC.copy; }, 1200); }
      else { c.innerHTML = IC.copy; say(COPY_REFUSED); }
      return;
    }
    const q = (/** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest("[data-mx-jump]")));
    if (q) {
      const key = q.dataset.mxJump;
      if (!key) return;
      const hit = msgs.querySelector(`:scope > .m[data-k="${CSS.escape(key)}"]`);
      if (!hit || hit === q.closest(".m")) return;
      E.follow.toRow(hit, true);
      hit.classList.remove("mx-flash");
      void (/** @type {HTMLElement} */ (hit)).offsetWidth;
      hit.classList.add("mx-flash");
    }
  });

  const qpop = document.createElement("button");
  qpop.type = "button"; qpop.className = "mx-qpop"; qpop.hidden = true;
  qpop.innerHTML = `${IC.reply}<span>Reply to this</span>`;
  document.body.append(qpop);
  scope.effect(() => () => qpop.remove());
  /** @type {{m: HTMLElement, text: string} | null} */
  let picked = null;
  function onSelect() {
    const s = /** @type {Selection} */ (getSelection());
    const text = s && !s.isCollapsed ? s.toString().trim() : "";
    const m0 = text && s.anchorNode && s.anchorNode.parentElement?.closest(".m"), m = /** @type {HTMLElement | null} */ (m0 && m0.parentElement === msgs ? m0 : null);
    if (!m || !m.contains(s.focusNode) || text.length < 2) { qpop.hidden = true; picked = null; return; }
    const r = s.getRangeAt(0).getBoundingClientRect();
    picked = { m, text };
    qpop.hidden = false;
    const w = qpop.offsetWidth;
    const gap = space("--s-2"); // the window's edge and the words keep --s-2 (8, written here before)
    qpop.style.left = `${Math.max(gap, Math.min(innerWidth - w - gap, r.left + r.width / 2 - w / 2))}px`;
    qpop.style.top = `${Math.max(gap, r.top - qpop.offsetHeight - gap)}px`;
  }
  scope.listen(document, "mouseup", () => scope.timeout(onSelect, 0));
  scope.listen(document, "keyup", (event) => { if ((/** @type {KeyboardEvent} */ (event)).shiftKey) onSelect(); });
  scope.listen(document, "selectionchange", () => { if (!qpop.hidden && (/** @type {Selection} */ (getSelection())).isCollapsed) qpop.hidden = true; });
  scope.listen(E.scroller, "scroll", () => { qpop.hidden = true; }, { passive: true });
  scope.listen(qpop, "mousedown", (e) => e.preventDefault());
  scope.listen(qpop, "click", () => { if (picked) startReply(picked.m, picked.text); qpop.hidden = true; (/** @type {Selection} */ (getSelection())).removeAllRanges(); });
  return startReply;
}
