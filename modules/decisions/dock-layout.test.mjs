import assert from "node:assert/strict";
import { dom } from "../../tests/lib/dom.mjs";
import { fitDock, dockEdges } from "./dock-layout.js";

const { document } = await dom(`<article class="card"><div class="card-in">
  <div class="c-body"><h3 class="c-h">Allow this operation?</h3></div>
  <div class="c-act"><button>Allow</button></div>
</div></article>`);
const card = document.querySelector(".card");
const inner = card.querySelector(".card-in");
const body = card.querySelector(".c-body");
const question = card.querySelector(".c-h");
const answers = card.querySelector(".c-act");
let questionBottom = 180;
let answerTop = 200;
question.getBoundingClientRect = () => ({ bottom: questionBottom });
body.getBoundingClientRect = () => ({ top: 0 });
inner.getBoundingClientRect = () => ({ bottom: 160 });
answers.getBoundingClientRect = () => ({ top: answerTop });
Object.defineProperties(body, { clientHeight: { value: 100 }, scrollHeight: { value: 240 } });
Object.defineProperties(inner, { clientHeight: { value: 160 }, scrollHeight: { value: 340 } });
inner.scrollTop = 0;
body.scrollTop = 0;

fitDock(card);
const more = card.querySelector("[data-dock-more]");
assert.ok(more);
assert.equal(more.textContent, "Answers");
assert.ok(card.classList.contains("is-one"));
assert.ok(!card.classList.contains("ans-in"));
fitDock(card);
assert.ok(more === card.querySelector("[data-dock-more]"), "the Answers control survives measurement");

inner.scrollTop = 100;
answerTop = 90;
dockEdges(card);
assert.ok(card.classList.contains("ans-in"));
assert.ok(inner.classList.contains("fade-t"));

questionBottom = 65;
fitDock(card);
assert.ok(!card.classList.contains("is-one"));
assert.ok(card.querySelector("[data-dock-more]") === null);
assert.ok(body.classList.contains("fade-b"));
assert.ok(!inner.classList.contains("fade-t"));
