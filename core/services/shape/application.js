// @ts-check
import { api } from "../../platform/api.js";
import { createShapeStore } from "./store.js";

/** @import { ApplicationShape } from "./application-types" */

/** @param {ApplicationShape} options */
export function createApplicationShape({ scope, events, notice }) {
  let terminalAvailable = () => true;
  const shape = createShapeStore({
    caps: { has: (/** @type {string} */ capability) => capability !== "terminal" || terminalAvailable() },
    remote: { get: () => api.shape(), put: (body) => api.putShape(body) },
    notice,
  }, scope);
  scope.effect(() => events.onEvent((event) => { if (event.kind === "shape") shape.heard(event.value); }));
  /** @param {() => boolean} available */
  function terminal(available) {
    terminalAvailable = available;
    return () => { if (terminalAvailable === available) terminalAvailable = () => true; };
  }
  return { shape, terminal };
}
