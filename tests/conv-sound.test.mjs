// Soft sounds (C117, the create-project grader on 7e0db5b): the Sounds switch says what is so.
//   - a storage that refuses to keep "on" leaves sounds off, and says why; once it keeps choices again, one press turns
//     them on; turning off always works on the page, and says when it won't be remembered
//   - a browser that won't play (no AudioContext, or it refuses) leaves sounds off, and that's said
//   - a suspended context is woken by the press that turns sounds on; play() never queues notes into a sleeping one
// No browser: js/ui.js's sound engine, run against stand-ins for localStorage and AudioContext; and the app's switch
// handler, read from js/app.js.
//   node tests/conv-sound.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + (e.stack || e.message)); process.exitCode = 1; } };

// what ui.js needs to load in Node
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const store = { data: {}, refuse: false };
globalThis.localStorage = {
  getItem: (k) => (k in store.data ? store.data[k] : null),
  setItem: (k, v) => { if (store.refuse) throw new DOMException("QuotaExceededError"); store.data[k] = String(v); },
};
// an AudioContext the test drives: starts as it's told, resume() works or is refused, oscillators are counted
const audio = { start: "running", resumeOk: true, refuseNew: false, made: 0, notes: 0 };
globalThis.AudioContext = class {
  constructor() { if (audio.refuseNew) throw new DOMException("NotAllowedError"); audio.made++; this.state = audio.start; this.currentTime = 0; this.destination = {}; }
  async resume() { if (!audio.resumeOk) throw new DOMException("NotAllowedError"); this.state = "running"; }
  createOscillator() { return { type: "", frequency: {}, connect: (g) => g, start() { audio.notes++; }, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d) => d }; }
};
// each case gets a fresh module (its choice and its audio context are module state)
let n = 0;
const fresh = async () => (await import(new URL(`../js/ui.js?case=${++n}`, import.meta.url))).sound;
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

await t("the app's switch turns sounds through sound.turn and says what it found (refused, or not kept)", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const h = /\$\("#sound-tog"\)\.addEventListener\("click", async \(\) => \{([\s\S]*?)\n\}\);/.exec(app);
  assert.ok(h, "the switch's handler");
  assert.match(h[1], /const want = !sound\.on;[\s\S]*await sound\.turn\(want\)/, "it asks the engine, and waits for its answer");
  assert.match(h[1], /r\.refused \? "This browser won't play sound here, so sounds stay off\."/, "a refusal to play is said");
  assert.match(h[1], /want \? "This browser won't remember sounds here, so they stay off\."/, "a storage that won't keep \"on\" is said");
  assert.match(h[1], /"Sounds are off for now: this browser won't remember it after a reload\."/, "an off that won't last is said");
  assert.doesNotMatch(app, /sound\.on = !sound\.on/, "never sets the choice without asking the engine");
});

console.log(`${passed} passed`);
