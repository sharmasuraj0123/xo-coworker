// node core/platform/tests/time.test.mjs: the time words, at their boundaries.
import assert from "node:assert/strict";
import { elapsed, since, short, dayOf, clock, toMs, clockWords, untilWords } from "../time.js";

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
const NOW = Date.UTC(2026, 10, 19, 12, 0, 0);

t("elapsed: seconds, then minutes and seconds, then hours and minutes", () => {
  assert.deepEqual([0, 59, 60, 61, 3599, 3600, 3661, 86399].map(elapsed), ["0s", "59s", "1m 00s", "1m 01s", "59m 59s", "1h 00m", "1h 01m", "23h 59m"]);
});
t("since: elapsed() from a moment, never negative, empty for no moment", () => {
  assert.equal(since(NOW - 61_000, NOW), "1m 01s");
  assert.equal(since(NOW - 999, NOW), "0s");
  assert.equal(since(NOW + 5000, NOW), "0s");
  assert.equal(since(NaN, NOW), "");
  assert.equal(Reflect.apply(since, null, [undefined, NOW]), "");
});
t("short: now under 45 s, then rounded minutes and hours, then the weekday", () => {
  assert.equal(short(NOW - 44_000, NOW), "now");
  assert.equal(short(NOW - 45_000, NOW), "1m");
  assert.equal(short(NOW - 59 * 60_000, NOW), "59m");
  assert.equal(short(NOW - 90 * 60_000, NOW), "2h");
  assert.equal(short(NOW + 60_000, NOW), "now");
  const old = NOW - 3 * 86400_000;
  assert.equal(short(old, NOW), new Date(old).toLocaleDateString(undefined, { weekday: "short" }));
});
t("dayOf: Today, Yesterday, else the date", () => {
  assert.equal(dayOf(NOW, NOW), "Today");
  assert.equal(dayOf(NOW - 86400_000, NOW), "Yesterday");
  assert.notEqual(dayOf(NOW - 3 * 86400_000, NOW), "Today");
});
t("clock gives the time of day", () => assert.match(clock(NOW), /\d/));
t("toMs and since agree on an ISO time", () => assert.equal(since(toMs("2026-11-19T11:59:00Z"), NOW), "1m 00s"));

const now = new Date(2026, 0, 5, 10).getTime();
const at = (offset) => new Date(now + offset);
const iso = (offset) => at(offset).toISOString();
const minute = 60_000;
const day = 24 * 60 * minute;

for (const [offset, words] of [
  [-minute, ""],
  [29_999, ""],
  [30_000, "in 1 min"],
  [59 * minute, "in 59 min"],
  [60 * minute, "in 1 h"],
  [61 * minute, "in 1 h 1 min"],
  [day, "in 1 day"],
  [2 * day, "in 2 days"],
]) assert.equal(untilWords(iso(offset), now), words);
assert.equal(untilWords("invalid", now), "");

const hm = (date) => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const weekday = (date) => date.toLocaleDateString(undefined, { weekday: "short" });
const monthDay = (date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
assert.equal(clockWords(iso(minute), now), hm(at(minute)));
assert.equal(clockWords(iso(6 * day - 1), now), `${weekday(at(6 * day - 1))} ${hm(at(6 * day - 1))}`);
assert.equal(clockWords(iso(6 * day), now), `${monthDay(at(6 * day))}, ${hm(at(6 * day))}`);
assert.equal(clockWords(iso(-day), now), `${monthDay(at(-day))}, ${hm(at(-day))}`);
assert.equal(clockWords("invalid", now), "");
assert.equal(short(now - 44_499, now), "now");
assert.equal(short(now - 44_500, now), "1m");
assert.equal(short(now - 4 * minute, now), "4m");
assert.equal(short(now - 3 * day, now), weekday(at(-3 * day)));
console.log(`\n${passed} named cases and the wording table passed`);
