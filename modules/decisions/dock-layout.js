// @ts-check

import { ICON } from "../../core/ui/icons/names.js";

const DOCK_Q_ROOM = 8; // under the question's last line: the body's own bottom padding and a little air
/** @param {Element | null} frame */
export function fitDock(frame) {
  const body = frame && frame.querySelector(".c-body");
  if (!body || !frame.isConnected) return;
  const h = body.querySelector(".c-h");
  if (frame.classList.contains("is-one")) frame.classList.remove("is-one");
  const one = !!h && h.getBoundingClientRect().bottom - body.getBoundingClientRect().top + DOCK_Q_ROOM > body.clientHeight + 0.5;
  frame.classList.toggle("is-one", one);
  // one scroll: the answers can start below the card's edge, so a pill on that edge says they're there
  let more = /** @type {HTMLButtonElement | null} */ (body.querySelector(".dock-more"));
  if (one && !more) {
    more = document.createElement("button");
    more.type = "button";
    more.className = "dock-more";
    more.dataset.dockMore = "";
    more.innerHTML = `<span class="dm-p">Answers${ICON.chevron}</span>`;
    body.appendChild(more);
  } else if (!one && more) more.remove();
  dockEdges(frame);
}
/** @param {Element} frame @param {ScrollBehavior} behavior */
export function revealDockAnswers(frame, behavior) {
  const scroller = frame.querySelector(".card-in");
  const answers = scroller?.querySelector(".c-act");
  if (!scroller || !answers) return;
  const bottom = scroller.getBoundingClientRect().top + scroller.clientTop + scroller.clientHeight;
  scroller.scrollTo({ top: scroller.scrollTop + answers.getBoundingClientRect().bottom - bottom, behavior });
}

/** @param {Element} frame */
export function dockEdges(frame) {
  const sc = frame.classList.contains("is-one") ? frame.querySelector(".card-in") : frame.querySelector(".c-body");
  if (!sc) return;
  const more = sc.scrollHeight - sc.clientHeight > 1;
  sc.classList.toggle("fade-t", more && sc.scrollTop > 1);
  // in one scroll the "Answers" pill's own band is the bottom edge
  sc.classList.toggle("fade-b", more && !sc.matches(".card-in") && sc.scrollTop < sc.scrollHeight - sc.clientHeight - 1);
  // the answers in view: the "Answers" pill has said its piece and fades away
  const act = frame.querySelector(".c-act");
  if (act) frame.classList.toggle("ans-in", act.getBoundingClientRect().top < sc.getBoundingClientRect().bottom - 40);
  // the other scroller of the two never keeps a fade from the other mode
  const other = sc.matches(".c-body") ? frame.querySelector(".card-in") : frame.querySelector(".c-body");
  other?.classList.remove("fade-t", "fade-b");
}
