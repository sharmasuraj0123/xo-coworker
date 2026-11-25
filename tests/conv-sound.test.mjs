import assert from "node:assert/strict";
import { wireSound } from "../modules/settings/sound.js";
import { dom, settle } from "./lib/dom.mjs";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + (e.stack || e.message)); process.exitCode = 1; } };

const store = { data: {}, refuse: false };
globalThis.localStorage = {
  getItem: (k) => (k in store.data ? store.data[k] : null),
  setItem: (k, v) => { if (store.refuse) throw new DOMException("Storage is full", "QuotaExceededError"); store.data[k] = String(v); },
};
// an AudioContext the test drives: starts as it's told, resume() works or is refused, oscillators are counted
const audio = { start: "running", resumeOk: true, refuseNew: false, made: 0, notes: 0 };
globalThis.AudioContext = class {
  constructor() {
    if (audio.refuseNew) throw new DOMException("Audio is blocked", "NotAllowedError");
    audio.made++; this.state = audio.start; this.currentTime = 0; this.destination = {};
  }
  async resume() { if (!audio.resumeOk) throw new DOMException("Audio is blocked", "NotAllowedError"); this.state = "running"; }
  createOscillator() { return { type: "", frequency: {}, connect: (g) => g, start() { audio.notes++; }, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d) => d }; }
};
// each case gets a fresh module (its choice and its audio context are module state)
let n = 0;
const fresh = async () => (await import(new URL(`../core/services/sound.js?case=${++n}`, import.meta.url))).sound;
const reset = () => { store.data = {}; store.refuse = false; Object.assign(audio, { start: "running", resumeOk: true, refuseNew: false, made: 0, notes: 0 }); };

await t("a storage that won't keep \"on\" leaves sounds off (nothing played, nothing saved); once it keeps choices, one press turns them on", async () => {
  reset(); store.data["cv-sound"] = "off"; store.refuse = true;
  const sound = await fresh();
  assert.equal(typeof sound.turn, "function", "the engine turns sounds on from a press (sound.turn)");
  assert.deepEqual(await sound.turn(true), { on: false, kept: false, refused: false });
  assert.equal(sound.on, false, "the switch says Off");
  assert.equal(store.data["cv-sound"], "off", "what was saved stays");
  sound.play("allow");
  assert.equal(audio.notes, 0, "and nothing plays");
  store.refuse = false;
  assert.deepEqual(await sound.turn(true), { on: true, kept: true, refused: false }, "storage back: one press");
  assert.equal(sound.on, true); assert.equal(store.data["cv-sound"], "on");
});

await t("turning off works on the page even when the browser won't remember it", async () => {
  reset(); store.data["cv-sound"] = "on";
  const sound = await fresh();
  store.refuse = true;
  assert.deepEqual(await sound.turn(false), { on: false, kept: false, refused: false });
  assert.equal(sound.on, false);
  sound.play("allow");
  assert.equal(audio.notes, 0, "silent now");
});

await t("a broken preference store reports the failure and keeps audio off", async () => {
  reset();
  const previous = globalThis.localStorage, reporter = globalThis.reportError;
  const failure = new Error("broken sound preferences"), reported = [];
  globalThis.reportError = (error) => reported.push(error);
  globalThis.localStorage = { ...previous, setItem() { throw failure; } };
  try {
    const sound = await fresh();
    assert.deepEqual(await sound.turn(true), { on: false, kept: false, refused: false });
    assert.deepEqual(reported, [failure]);
    assert.equal(audio.made, 0);
  } finally {
    globalThis.localStorage = previous;
    if (reporter) globalThis.reportError = reporter;
    else Reflect.deleteProperty(globalThis, "reportError");
  }
});

await t("a browser that won't make audio leaves sounds off, and says it refused", async () => {
  reset(); audio.refuseNew = true;
  const sound = await fresh();
  const r = await sound.turn(true);
  assert.deepEqual(r, { on: false, kept: true, refused: true });
  assert.equal(sound.on, false, "the switch says Off, never On with nothing to hear");
});

await t("a context that won't wake (resume refused) leaves sounds off, and says so", async () => {
  reset(); audio.start = "suspended"; audio.resumeOk = false;
  const sound = await fresh();
  const r = await sound.turn(true);
  assert.equal(r.on, false); assert.equal(r.refused, true);
  assert.equal(sound.on, false);
});

await t("a suspended context is woken by the press that turns sounds on, and then plays", async () => {
  reset(); audio.start = "suspended";
  const sound = await fresh();
  const r = await sound.turn(true);
  assert.deepEqual(r, { on: true, kept: true, refused: false });
  sound.play("allow");
  assert.equal(audio.notes, 2, "Allow's two notes, at once");
});

await t("play() never queues notes into a sleeping context", async () => {
  reset(); store.data["cv-sound"] = "on"; audio.start = "suspended";
  const sound = await fresh();
  assert.equal(sound.on, true, "the remembered choice");
  sound.play("allow");
  assert.equal(audio.notes, 0);
});

await t("turning them off: off, remembered when the browser keeps it", async () => {
  reset(); store.data["cv-sound"] = "on";
  const sound = await fresh();
  assert.deepEqual(await sound.turn(false), { on: false, kept: true, refused: false });
  assert.equal(store.data["cv-sound"], "off");
});

await t("the Settings switch shows and announces the sound engine's response", async () => {
  const { document } = await dom('<div class="set-row"><button id="sound-tog" role="switch"></button></div>');
  const toggle = document.querySelector("#sound-tog");
  const notices = [];
  reset(); audio.refuseNew = true;
  const sound = await fresh();
  wireSound({ sound, announce: (message) => notices.push(message) })();
  const press = async () => {
    toggle.click();
    assert.equal(toggle.getAttribute("aria-busy"), "true");
    await settle();
    assert.equal(toggle.hasAttribute("aria-busy"), false);
  };
  const status = () => document.querySelector(".sound-note[role=status]")?.textContent;
  assert.equal(toggle.getAttribute("aria-checked"), "false");
  await press();
  assert.equal(status(), "This browser won't play sound here, so sounds stay off.");
  assert.equal(toggle.getAttribute("aria-checked"), "false");
  audio.refuseNew = false; store.refuse = true;
  await press();
  assert.equal(status(), "This browser won't remember sounds here, so they stay off.");
  assert.equal(toggle.getAttribute("aria-checked"), "false");
  store.refuse = false;
  await press();
  assert.equal(toggle.getAttribute("aria-checked"), "true");
  assert.equal(status(), undefined);
  assert.equal(audio.notes, 2);
  store.refuse = true;
  await press();
  assert.equal(status(), "Sounds are off for now: this browser won't remember it after a reload.");
  assert.equal(toggle.getAttribute("aria-checked"), "false");
  assert.deepEqual(notices, [
    "This browser won't play sound here, so sounds stay off.",
    "This browser won't remember sounds here, so they stay off.",
    "Sounds are off for now: this browser won't remember it after a reload.",
  ]);
});

console.log(`${passed} passed`);
