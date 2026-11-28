// The last Settings card keeps its space above the window's bottom edge in every engine.
import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";

const css = sheet(new URL("../modules/settings/settings.css", import.meta.url));
const rule = (sel) => (css.match(new RegExp(`(?:^|})\\s*${sel.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`)) || [])[1] || "";

const body = rule(".set-body"), page = rule(".set-page");
const pad = /padding:\s*([^;]+)/.exec(body)?.[1].trim().split(/\s+/) ?? [];
assert.ok(pad.length === 3 && pad[2] === "var(--ring-room)", `the scroller's bottom padding is only the ring's room (Firefox drops it on a grid): ${pad.join(" ")}`);
assert.match(page, /padding-bottom:\s*var\(--s-12\)/, "the page itself carries the end space");
console.log("  ok  Settings end space sits inside the page");
