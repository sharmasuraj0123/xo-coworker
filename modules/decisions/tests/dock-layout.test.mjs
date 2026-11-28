// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { fitDock, dockEdges, revealDockAnswers } from "../dock-layout.js";

const { document } = await dom(`<article class="card"><div class="card-in">
  <div class="c-body"><h3 class="c-h">Allow this operation?</h3></div>
  <div class="c-act"><button>Allow</button></div>
</div></article>`);
const card = document.querySelector(".card");
assert.ok(card instanceof HTMLElement);
const inner = card.querySelector(".card-in");
const body = card.querySelector(".c-body");
const question = card.querySelector(".c-h");
const answers = card.querySelector(".c-act");
assert.ok(inner && body && question && answers);
let questionBottom = 180;
let answerTop = 200;
Object.defineProperty(question, "getBoundingClientRect", { value: () => ({ bottom: questionBottom }) });
Object.defineProperty(body, "getBoundingClientRect", { value: () => ({ top: 0 }) });
Object.defineProperty(inner, "getBoundingClientRect", { value: () => ({ top: 40, bottom: 200 }) });
Object.defineProperty(answers, "getBoundingClientRect", { value: () => ({ top: answerTop, bottom: answerTop + 120 }) });
Object.defineProperties(body, { clientHeight: { value: 100 }, scrollHeight: { value: 240 } });
Object.defineProperties(inner, { clientHeight: { value: 160 }, clientTop: { value: 0 }, scrollHeight: { value: 340 } });
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
let scroll;
inner.scrollTo = (options) => { scroll = options; };
answers.scrollIntoView = () => assert.fail("scrollIntoView would also move the ancestors");
revealDockAnswers(card, "smooth");
assert.deepEqual(scroll, { top: 120, behavior: "smooth" });

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
