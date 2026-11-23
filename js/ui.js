// The optional soft sounds (off by default), $ and $$, and the core helpers the app still reads from here.
import { esc } from "./world.js";
export { reconcile } from "../core/ui/redraw.js";
export { morph, EASE, EXPAND_MS, expand, RM, wait, hold, keepTurning } from "../core/ui/motion.js";

export { xi, stateMark, ARC } from "../core/ui/icons/icon.js";
export { ICON, NEXT_GLYPH, DOTS, stepMark, dial, XO } from "../core/ui/icons/names.js";

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export { clock, dayOf, short, elapsed } from "../core/platform/index.js";
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

