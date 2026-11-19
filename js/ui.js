// Converged · small shared helpers: icons, a keyed DOM reconciler, time words, smooth disclosure,
// reduced motion and the optional soft sounds (off by default).
import { esc } from "./world.js";
export { reconcile } from "../core/ui/redraw.js";
export { morph, EASE, EXPAND_MS, expand, RM, wait, hold, keepTurning } from "../core/ui/motion.js";

export { xi } from "../core/ui/icons/icon.js";
export { ICON, NEXT_GLYPH, dial, XO } from "../core/ui/icons/names.js";

/** mm:ss for a countdown. */
export const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
/** "3 h 12 m" / "42 m" for how long something has waited. */
export function waited(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// one formatter each, made once: toLocale*String with options builds a new one per call (25 ms per redraw
// of a 400-row conversation; QA C5)
const CLOCK_F = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
const DAY_F = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
export function clock(ms) {
  return CLOCK_F.format(ms);
}
export function dayOf(ms, now = Date.now()) {
  const d = new Date(ms), t = new Date(now), y = new Date(now - 86400000);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return DAY_F.format(d);
}
export function short(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short" });
}
export function elapsed(secs) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ${String(secs % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
export const plain = (md) => String(md || "").replace(/```[\s\S]*?```/g, "[code]").replace(/[*_`#>]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();

// ── optional soft sounds (OFF by default; the person turns them on) ─────────
// Turning sounds on takes a choice the browser will keep (sound that came back after a reload, or didn't, would be a
// surprise either way): where it won't keep it, they stay off and that's said. Turning them off always works on this
// page, and says when it won't be remembered. Turning on is a press, so the audio is made or woken right then; where
// the browser won't play (no audio, or it refuses), they stay off and that's said.
// (create-project grader on 7e0db5b, C117: a refused write left the switch off, a refused audio left it on with
// nothing said, and a suspended context was never woken, its notes queueing silently.)
let actx = null, chosen = null;
const stored = () => { try { return localStorage.getItem("cv-sound") === "on"; } catch { return false; } };
const keep = (v) => { try { localStorage.setItem("cv-sound", v ? "on" : "off"); return localStorage.getItem("cv-sound") === (v ? "on" : "off"); } catch { return false; } };
export const sound = {
  get on() { return chosen ?? stored(); },
  /**
   * Turn sounds on or off from a press. Resolves to {on, kept, refused}: on, what the switch now says; kept, whether
   * the browser keeps the choice (asked for on and not kept: they stay off); refused, that the browser won't play
   * sound here (so they're off).
   */
  async turn(want) {
    if (!want) { chosen = false; return { on: false, kept: keep(false), refused: false }; }
    if (!keep(true)) { chosen = false; return { on: false, kept: false, refused: false }; }
    try {
      actx = actx || new AudioContext();
      if (actx.state === "suspended") await actx.resume();
    } catch { actx = null; }
    if (!actx || actx.state !== "running") { chosen = false; keep(false); return { on: false, kept: true, refused: true }; }
    chosen = true;
    return { on: true, kept: true, refused: false };
  },
  play(kind) {
    if (!this.on) return;
    try {
      actx = actx || new AudioContext();
      if (actx.state !== "running") return; // asleep (a tab in the background): never queue notes for later
      const notes = { allow: [660, 990], back: [520, 390], done: [523, 659, 784], lock: [880], send: [740] }[kind] || [660];
      notes.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = "sine"; o.frequency.value = f;
        const t = actx.currentTime + i * 0.07;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.25);
      });
    } catch { /* no audio */ }
  },
};

export { esc };

