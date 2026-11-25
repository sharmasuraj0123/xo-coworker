// @ts-check
import { read, write, reportStorageFailure } from "../platform/storage.js";
import { reportFailure } from "./notices/failures.js";

const STORE = "cv-sound";

/** @type {AudioContext | null} */
let actx = null;
/** @type {boolean | null} */
let chosen = null;
const stored = () => read(STORE, (v) => v === "on", false, "local", reportStorageFailure);
/** @param {boolean} v */
const keep = (v) => {
  const value = v ? "on" : "off";
  return write(STORE, value, "local", reportStorageFailure).kept
    && read(STORE, (raw) => raw === value, false, "local", reportStorageFailure);
};
/** @param {unknown} error */
const audioFailure = (error) => {
  if (!(error instanceof DOMException) || !["NotAllowedError", "NotSupportedError", "InvalidStateError"].includes(error.name)) {
    reportFailure(error);
  }
};
export const sound = {
  get on() { return chosen ?? stored(); },
  /** @param {boolean} want */
  async turn(want) {
    if (!want) { chosen = false; return { on: false, kept: keep(false), refused: false }; }
    if (!keep(true)) { chosen = false; return { on: false, kept: false, refused: false }; }
    try {
      if (typeof AudioContext === "function") actx ||= new AudioContext();
      if (actx?.state === "suspended") await actx.resume();
    } catch (error) { actx = null; audioFailure(error); }
    if (!actx || actx.state !== "running") { chosen = false; keep(false); return { on: false, kept: true, refused: true }; }
    chosen = true;
    return { on: true, kept: true, refused: false };
  },
  /** @param {"allow" | "back" | "done" | "lock" | "send"} kind */
  play(kind) {
    if (!this.on || typeof AudioContext !== "function") return;
    try {
      actx = actx || new AudioContext();
      if (actx.state !== "running") return; // asleep (a tab in the background): never queue notes for later
      const notes = { allow: [660, 990], back: [520, 390], done: [523, 659, 784], lock: [880], send: [740] }[kind] || [660];
      notes.forEach((f, i) => {
        const o = /** @type {AudioContext} */ (actx).createOscillator(), g = /** @type {AudioContext} */ (actx).createGain();
        o.type = "sine"; o.frequency.value = f;
        const t = /** @type {AudioContext} */ (actx).currentTime + i * 0.07;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(/** @type {AudioContext} */ (actx).destination); o.start(t); o.stop(t + 0.25);
      });
    } catch (error) { audioFailure(error); }
  },
};
