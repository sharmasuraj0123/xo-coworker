import assert from "node:assert/strict";
import { dom, same, settle } from "../../../tests/lib/dom.mjs";
import { createSettingsHost } from "../host.js";

const page = "routing";
await dom('<article data-page="routing"><div class="set-live" id="unrelated">Unrelated page</div></article>'
  + '<section id="settings"><button data-set="routing">Settings</button>'
  + '<div data-page="routing"><div class="set-live"></div></div></section>');
const host = createSettingsHost();
const controls = '<button data-request>Apply</button><button data-next>Continue</button><button data-elsewhere>Other</button>';
host.paint(page, controls);
assert.equal(document.getElementById("unrelated").textContent, "Unrelated page");
same(host.box(page), document.querySelector("#settings .set-live"));
const request = document.querySelector("[data-request]");
const next = document.querySelector("[data-next]");
const elsewhere = document.querySelector("[data-elsewhere]");
const tab = document.querySelector("[data-set]");

const gate = Promise.withResolvers();
let calls = 0;
const work = () => { calls++; return gate.promise; };
request.focus();
const first = host.pend("test:apply", page, () => host.paint(page, controls), work, request);
const second = host.pend("test:apply", page, () => host.paint(page, controls), work, request);
await settle();
assert.equal(calls, 1);
same(document.activeElement, request);
gate.resolve({ to: "[data-next]" });
await Promise.all([first, second]);
same(document.activeElement, next);

const background = Promise.withResolvers();
const job = host.pend("test:background", page, () => {}, () => background.promise, next);
elsewhere.focus();
background.resolve({ to: "[data-request]" });
await job;
same(document.activeElement, elsewhere);

request.disabled = true;
host.focusTo(page, "[data-request]");
same(document.activeElement, tab);
