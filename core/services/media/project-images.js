// @ts-check

import { createScope } from "../../kernel/scope.js";
import { api } from "../../platform/api.js";
import { latest, once } from "../../platform/pending.js";

/** @typedef {{ scope: ReturnType<typeof createScope>, consumers: number }} Flight */

/** @type {Map<string, Flight>} */
const flights = new Map();

/** @param {{ key: string, project: string, rel: string }} item @param {AbortSignal} signal */
export function subscribeProjectImage({ key, project, rel }, signal) {
  signal.throwIfAborted();
  const flight = flights.get(key) ?? { scope: createScope(), consumers: 0 };
  flights.set(key, flight);
  flight.consumers++;
  const subscription = createScope();
  subscription.listen(signal, "abort", subscription.dispose);
  subscription.effect(() => () => {
    if (--flight.consumers) return;
    flights.delete(key);
    flight.scope.dispose();
  });

  return () => once(flight, () => latest(flight, (transportSignal) => api.projectImage(project, rel, { signal: transportSignal }), { signal: flight.scope.signal }));
}
