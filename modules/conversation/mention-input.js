// @ts-check

import { closeMentionList, renderMentionList } from "./mention.js";

/** @import { MentionDeps, Composer, MentionSelection } from "./mention-types.d.ts" */

/** @param {MentionDeps} options */
export function createMentionList({ MK, world, projects, projectIcon, isBusy, saveDraft, updateComposer }) {
  /** @type {WeakMap<HTMLElement, MentionSelection>} */
  const lists = new WeakMap();

  /** @param {Composer} composer @returns {MentionSelection} */
  function stateFor(composer) {
    const known = lists.get(composer.at);
    if (known) return known;
    const state = { selected: 0, closedAt: null };
    lists.set(composer.at, state);
    return state;
  }

  /** @param {Composer} composer */
  function reset(composer) { stateFor(composer).selected = 0; }

  /** @param {Composer} composer */
  function render(composer) {
    renderMentionList(composer, stateFor(composer), { world, projects, projectIcon, isBusy });
  }

  /** @param {Composer} composer */
  function closeAtCaret(composer) {
    const { say } = composer;
    stateFor(composer).closedAt = say.value.slice(0, say.selectionStart);
    closeMentionList(composer);
  }

  /** @param {string} pid @param {Composer} [K] */
  function pickAt(pid, K = MK) {
    const f = K.say, pos = f.selectionStart;
    const before = f.value.slice(0, pos).replace(/(^|\s)@([\w.-]*)$/, `$1@${pid}`);
    const after = f.value.slice(pos).replace(/^[\w.-]*/, "");
    f.value = before + (/^\s/.test(after) ? "" : " ") + after;
    f.setSelectionRange(before.length + 1, before.length + 1);
    const state = stateFor(K);
    state.selected = 0;
    state.closedAt = null;
    saveDraft(K);
    updateComposer(K); f.focus();
  }

  /** @param {KeyboardEvent} event @param {Composer} composer */
  function keys(event, composer) {
    const { at } = composer;
    if (at.hidden || !at.children.length) return false;
    const selection = stateFor(composer);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const count = at.children.length;
      selection.selected = (selection.selected + (event.key === "ArrowDown" ? 1 : count - 1)) % count;
      updateComposer(composer);
      return true;
    }
    if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
      event.preventDefault();
      const row = /** @type {HTMLElement} */ (at.children[selection.selected]);
      if (row?.dataset.pid) pickAt(row.dataset.pid, composer);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAtCaret(composer);
      return true;
    }
    return false;
  }

  /** @param {Composer} composer @param {Pick<import("../../core/kernel/types").ModuleContext, "listen">} scope */
  function wire(composer, scope) {
    const { at, say } = composer;
    scope.listen(at, "mousedown", (event) => {
      if (!(event.target instanceof Element)) return;
      const id = event.target.closest("li")?.getAttribute("data-pid");
      if (id) { event.preventDefault(); pickAt(id, composer); }
    });
    scope.listen(at, "pointermove", (e) => {
      const event = /** @type {PointerEvent} */ (e);
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      if (!(event.target instanceof Element)) return;
      const row = event.target.closest("li[role=option]");
      if (!row) return;
      const index = Array.from(at.children).indexOf(row);
      const selection = stateFor(composer);
      if (index < 0 || index === selection.selected) return;
      at.querySelector('[aria-selected="true"]')?.setAttribute("aria-selected", "false");
      selection.selected = index;
      row.setAttribute("aria-selected", "true");
      say.setAttribute("aria-activedescendant", row.id);
    });
  }

  /** @param {Composer} composer */
  function aim(composer) {
    const { say } = composer;
    const token = /(^|\s)@([\w.-]*)/.exec(say.value);
    const selection = stateFor(composer);
    let caret = 1;
    if (token) {
      caret = token.index + token[1].length + 1;
      selection.selected = Math.max(0, projects().findIndex((p) => p.id.toLowerCase() === token[2].toLowerCase()));
    } else {
      say.value = "@" + (say.value ? " " + say.value : "");
      selection.selected = 0;
      saveDraft(composer);
    }
    selection.closedAt = null;
    say.focus();
    say.setSelectionRange(caret, caret);
    updateComposer(composer);
  }

  return { render, close: (/** @type {Composer} */ composer = MK) => closeMentionList(composer), closeAtCaret, reset, wire, keys, aim };
}
