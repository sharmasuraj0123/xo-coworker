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
  /** @type {import("../../kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.shape", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["shape"] },
    activate(ctx) { ctx.provide("shape", shape); },
  };
  /** @param {() => boolean} available */
  function terminal(available) { terminalAvailable = available; }
  return { shape, module, terminal };
}
