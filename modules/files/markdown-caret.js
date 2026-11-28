// @ts-check

/** @import {CodeMirror, Extension, Transaction} from "./cm-types.d.ts" */

/** A user's own move: a click, a selection key, typing or deleting. @param {Transaction} tr */
const placedBy = (tr) => tr.isUserEvent("select") || tr.isUserEvent("input") || tr.isUserEvent("delete");

/** @type {Record<string, string>} */
const PLACED = {};
const RESTING = { class: "cm-md-resting" };

/** The caret stays hidden until the reader clicks or types, and again after a blur. @param {CodeMirror} CM @returns {Extension} */
export function restingCaret(CM) {
  const { StateEffect, StateField, EditorView } = CM;
  const rest = StateEffect.define();
  const placed = StateField.define({
    create: () => false,
    update: (value, tr) => (tr.effects.some((e) => e.is(rest)) ? false : value || placedBy(tr)),
    provide: (field) => EditorView.editorAttributes.compute([field], (state) => (state.field(field) ? PLACED : RESTING)),
  });
  return [placed, EditorView.focusChangeEffect.of((state, focusing) => (focusing ? null : rest.of(null)))];
}
