// @ts-check

import { createBus } from "./bus.js";

/** @import {Bus} from "./types" */

/** @template {object} T @param {T} initial @param {{bus?: Pick<Bus, "on" | "emit">, topic?: string}} [channel] */
export function createStore(initial, { bus = createBus(), topic = "change" } = {}) {
  let current = Object.freeze({ ...initial });

  /** @param {Partial<T>} patch */
  function set(patch) {
    current = Object.freeze({ ...current, ...patch });
    bus.emit(topic, current);
  }

  return {
    get: () => current,
    set,
    /** @param {(value: Readonly<T>) => void} listener */
    subscribe(listener) {
      return bus.on(topic, (payload) => listener(/** @type {Readonly<T>} */ (payload)));
    },
  };
}
