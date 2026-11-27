// @ts-check
import assert from "node:assert/strict";
import { rules } from "./lib/cascade.mjs";

const all = rules(new URL("./lib/cascade.mjs", import.meta.url));
const decl = (sel, prop) => all.filter((r) => r.sel === sel && !r.at.length).flatMap((r) => r.d.split(";").map((x) => x.split(":").map((y) => y.trim())).filter(([k]) => k === prop).map(([, v]) => v)).at(-1);

assert.equal(decl(".lq-group.lp-check", "background"), "none", "what Launchpad looks for sits on the page, not in a card");
assert.equal(decl(".lp-ck", "box-shadow"), undefined, "a missing item shows no empty ring that reads as a radio");
assert.equal(decl(".lp-check .is-no .lp-ck::before", "border-radius"), "50%", "a missing item shows a status dot");
assert.equal(decl(".lq-note", "align-items"), "center", "a note's button sits level with its text");
console.log("launchpad-needs-look: 4 passed");
