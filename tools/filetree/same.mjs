// The tree drawn a folder at a time must show exactly what the whole-list redraw showed: the same rows, in
// the same order, with the same state, after every step of a run of clicks, searches and file picks.
// Runs the same steps on the old (before) and new (after) pages and compares the rows after each one.
import { loadSet, open } from "./lib.mjs";
const [before, after] = process.argv.slice(2);
const set = loadSet("real");
const pages = [];
for (const port of [before, after]) {
  const o = await open({ port, set, throttle: 1 });
  await o.page.evaluate(() => timed(async () => { B.mountOurs(); await waitFor("#ours .fl-r"); }));
  pages.push(o);
}
const settle = (page) => page.evaluate(() => new Promise((r) => { const f = () => (document.querySelector("#ours .fl-note .spin") ? setTimeout(f, 10) : requestAnimationFrame(() => r())); setTimeout(f, 10); }));
const rows = (page) => page.evaluate(() => [...document.querySelectorAll("#ours .fl-list .fl-r, #ours .fl-list .fl-note")].map((r) =>
  [r.dataset.flDir ?? r.dataset.flFile ?? r.dataset.flChange ?? r.dataset.flTouch ?? r.textContent.trim(), r.className, r.getAttribute("aria-expanded"), r.style.getPropertyValue("--d"), r.getBoundingClientRect().height > 0 ? "" : "invisible"].join(" ")));
const focus = (page) => page.evaluate(() => { const a = document.activeElement; return a && a.closest("#ours") ? (a.dataset.flDir ?? a.dataset.flFile ?? (a.matches("[data-fl-q]") ? `q=${a.value}` : a.className)) : null; });
let steps = 0, bad = 0;
async function step(name, fn, arg) {
  for (const { page } of pages) { await page.evaluate(fn, arg); await settle(page); }
  const [a, b] = await Promise.all(pages.map(({ page }) => rows(page)));
  steps++;
  const same = a.length === b.length && a.every((x, i) => x === b[i]);
  if (!same) {
    bad++;
    const i = a.findIndex((x, j) => x !== b[j]);
    console.log(`DIFF at "${name}": ${a.length} vs ${b.length} rows; first difference at ${i}:\n  before ${a[i]}\n  after  ${b[i]}`);
  }
  const fb = await focus(pages[1].page);
  return { n: b.length, focus: fb };
}
const click = (sel) => { const b = document.querySelector(sel); if (!b) throw new Error("no " + sel); b.focus(); b.click(); };
const dir = (p) => `#ours [data-fl-dir="${p}"]`;
const log = (k, v) => console.log(k, JSON.stringify(v));
// open a few folders, nested, and some siblings
for (const p of ["css", "js", "js/vendor", "js/vendor/xterm", "design-research", "tests", "fonts"]) log(`open ${p}`, await step(`open ${p}`, click, dir(p)));
// close a parent with open children, reopen it: the children come back open
log("close js", await step("close js", click, dir("js")));
log("reopen js", await step("reopen js", click, dir("js")));
// pick a file deep inside, then close and reopen its folder: still marked
log("pick a file", await step("pick a file", click, '#ours [data-fl-file="js/vendor/xterm/xterm.mjs"]'));
log("close vendor", await step("close vendor", click, dir("js/vendor")));
log("reopen vendor", await step("reopen vendor", click, dir("js/vendor")));
log("pick another", await step("pick another", click, '#ours [data-fl-file="css/base.css"]'));
// search: narrows, an open folder whose name doesn't match stays with what's found in it
const type = (v) => { const q = document.querySelector("#ours [data-fl-q]"); q.focus(); q.value = v; q.dispatchEvent(new Event("input", { bubbles: true })); };
for (const v of ["p", "pa", "pan", "pa", ""]) log(`search "${v}"`, await step(`search ${v}`, type, v));
await step("search di", type, "di");
log("close js while searching", await step("close js while searching", click, dir("js")));
log("open a found folder", await step("open a found folder", click, dir("design-research")));
log("clear", await step("clear", type, ""));
log("reopen js", await step("reopen js", click, dir("js")));
// a breadth of folders, then close and open at the top and the bottom
await step("many", async () => { for (let i = 0; i < 40; i++) { const b = document.querySelector('#ours [data-fl-dir][aria-expanded="false"]'); if (!b) break; b.click(); await new Promise((r) => setTimeout(r, 30)); } });
await step("close first", () => document.querySelector('#ours [data-fl-dir][aria-expanded="true"]').click());
await step("close last", () => [...document.querySelectorAll('#ours [data-fl-dir][aria-expanded="true"]')].pop().click());
log("reopen", await step("reopen first", () => document.querySelector('#ours [data-fl-dir][aria-expanded="false"]').click()));
console.log(`${steps} steps, ${bad} with differences`);
for (const { browser } of pages) await browser.close();
process.exitCode = bad ? 1 : 0;
