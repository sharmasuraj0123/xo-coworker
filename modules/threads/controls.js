// @ts-check

import { createStore } from "../../core/kernel/store.js";

/** @import { EditField, ThreadEdit, ThreadMenu } from "./editing-types.d.ts" */

export function createThreadControls() {
  const state = createStore(/** @type {{ edit: ThreadEdit | null, menu: ThreadMenu | null }} */ ({ edit: null, menu: null }));
  const edit = () => state.get().edit;
  const menu = () => state.get().menu;

  /** @param {ThreadEdit} entry */
  const owns = (entry) => edit()?.token === entry.token;

  /** @param {string} tid @param {EditField} field @param {string} value */
  function startEdit(tid, field, value) {
    state.set({ edit: { token: Symbol(), tid, field, value } });
  }

  /** @param {ThreadEdit} entry @param {Partial<Pick<ThreadEdit, "value" | "busy" | "failed">>} patch */
  function updateEdit(entry, patch) {
    const current = edit();
    if (current?.token === entry.token) state.set({ edit: { ...current, ...patch } });
  }

  /** @param {ThreadEdit} entry */
  function clearEdit(entry) {
    if (!owns(entry)) return false;
    state.set({ edit: null });
    return true;
  }

  /** @param {string} id @param {ThreadMenu["location"]} location */
  function menuOpen(id, location) {
    const current = menu();
    return current?.id === id && current.location === location;
  }

  /** @param {string} id @param {ThreadMenu["location"]} location */
  function toggleMenu(id, location) {
    const next = menuOpen(id, location) ? null : { id, location };
    state.set({ menu: next });
    return !!next;
  }

  /** @param {ThreadMenu["location"]} [location] */
  function clearMenu(location) {
    if (!location || menu()?.location === location) state.set({ menu: null });
  }

  const clear = () => state.set({ edit: null, menu: null });
  return { edit, owns, startEdit, updateEdit, clearEdit, menu, menuOpen, toggleMenu, clearMenu, clear };
}
