// @ts-check

// Press and hold to confirm a destructive action: one guard and the one button drawn on it.

export const HOLD_MS = 1200;

/** The one hold-to-confirm button: a danger fill grows linearly with the time held (--p), its label holding both its words, a calm return if let go. @param {HTMLElement} btn @param {{ ready: () => true | string, onConfirm: () => void, onRefuse?: (why: string) => void, onRelease?: () => void, holding?: string }} opts */
export function holdButton(btn, { ready, onConfirm, onRefuse, onRelease, holding = "Keep holding…" }) {
  const txt = btn.querySelector(".hold-txt");
  if (txt && !txt.querySelector(".ht-a")) {
    const a = document.createElement("span"); a.className = "ht-a"; a.textContent = txt.textContent;
    const b = document.createElement("span"); b.className = "ht-b"; b.setAttribute("aria-hidden", "true"); b.textContent = holding;
    txt.replaceChildren(a, b);
  }
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let back;
  return holdToConfirm(btn, {
    ready,
    onProgress: (p) => {
      if (p > 0 && btn.classList.contains("is-releasing")) { clearTimeout(back); btn.classList.remove("is-releasing"); } // held again mid-drain: the fill follows the hand
      btn.style.setProperty("--p", String(p)); btn.classList.toggle("tense", p > 0.8 && p < 1);
    },
    onConfirm: () => { btn.classList.remove("tense"); try { navigator.vibrate?.(24); } catch { /* not allowed */ } onConfirm(); }, // the one buzz is the hold completing
    onRefuse,
    onRelease: () => {
      btn.classList.remove("tense"); btn.classList.add("is-releasing");
      clearTimeout(back); back = setTimeout(() => btn.classList.remove("is-releasing"), 260);
      onRelease && onRelease();
    },
  });
}

/** Press-and-hold guard: a pointer or Enter/Space held for ms confirms; let go early, a click alone, or ready() refusing does nothing. @param {HTMLElement} btn @param {{ ms?: number, ready: () => true | string, onProgress: (p: number) => void, onConfirm: () => void, onRefuse?: (why: string) => void, onRelease?: () => void }} opts */
export function holdToConfirm(btn, { ms = HOLD_MS, ready, onProgress, onConfirm, onRefuse, onRelease }) {
  let t0 = 0, raf = 0;
  /** @type {"pointer" | "key" | null} */
  let via = null;
  const onAway = (/** @type {Event} */ e) => { if (e.type === "blur" || document.hidden) stop(true); };
  const stop = (/** @type {boolean} */ early) => {
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
  const start = (/** @type {"pointer" | "key"} */ src) => {
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
    btn.classList.add("by-pointer"); // held by a pointer it takes focus without a ring; a key on it brings the ring back
    btn.focus(/** @type {FocusOptions} */ ({ preventScroll: true, focusVisible: false }));
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
  btn.addEventListener("pointermove", (e) => { // the hold ends when the pointer leaves the button, 8 px of give
    if (via !== "pointer") return;
    const r = btn.getBoundingClientRect();
    if (e.clientX < r.left - 8 || e.clientX > r.right + 8 || e.clientY < r.top - 8 || e.clientY > r.bottom + 8) stop(true);
  });
  btn.addEventListener("touchstart", (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false }); // the browser's own long-press never buzzes first
  btn.addEventListener("click", (e) => e.preventDefault());
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
  return { cancel: () => stop(true) };
}
