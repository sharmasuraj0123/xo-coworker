// @ts-check

import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";

/** @param {{ SHAPE: { word(noun: string): string }, PROJ(id: string): string, say: HTMLTextAreaElement, growSay(): void, saveDraft(): void, updateComposer(): void }} options */
export function createConversationStarts({ SHAPE, PROJ, say, growSay, saveDraft, updateComposer }) {
  /** @type {{ic: keyof typeof ICON, label: string, say(): string}[]} */
  const STARTS = [
    { ic: "plus", label: "Make something new", say: () => `Start a ${SHAPE.word("thread")} to make ` },
    { ic: "edit", label: "Fix or change something", say: () => "Fix " },
    { ic: "search", label: "Explain how this project works", say: () => "Read through this project and explain how it works." },
    { ic: "clock", label: "Do something on a schedule", say: () => "Every weekday at 9:00, " },
  ];
  /** @param {string} pid */
  function startHtml(pid) {
    return `<div class="m-start"><h2 class="st-h">What should get done in ${esc(PROJ(pid))}?</h2><ul class="st-list">${STARTS.map((o, i) =>
      `<li><button type="button" class="st-o" data-start="${i}"><span class="st-ic" aria-hidden="true">${ICON[o.ic]}</span>${esc(o.label)}</button></li>`).join("")}</ul></div>`;
  }
  /** @param {number} i */
  function startDraft(i) {
    const o = STARTS[i];
    if (!o || say.value.trim()) return;
    say.value = o.say();
    growSay(); saveDraft(); updateComposer(); say.focus();
    say.setSelectionRange(say.value.length, say.value.length);
  }

  return { startHtml, startDraft };
}
