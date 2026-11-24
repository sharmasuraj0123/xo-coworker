// @ts-check

import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @typedef {{ saved: boolean, wanted: boolean }} PinIntent */

/** @type {import("./read-types").CreateMadePins} */
export const createMadePins = (write, setPin, signal, failed) => {
  /** @type {Map<string, PinIntent>} */
  const intents = new Map();

  /** @param {string} chat @param {string} id @param {string} key @param {PinIntent} intent */
  async function save(chat, id, key, intent) {
    try {
      while (!signal.aborted && intent.saved !== intent.wanted) {
        const next = intent.wanted;
        try {
          await write(chat, id, next);
          intent.saved = next;
        } catch (error) {
          if (signal.aborted) return;
          const action = next ? "pin" : "unpin";
          const message = requestFailureMessage(error, `Couldn't ${action} it.`);
          if (intent.wanted === next) {
            intent.wanted = intent.saved;
            setPin(chat, id, intent.saved, false);
            failed(`Couldn't ${action} it: ${message}`);
          }
        }
      }
      if (!signal.aborted) setPin(chat, id, intent.saved, false);
    } finally {
      intents.delete(key);
    }
  }

  /** @param {string} chat @param {string} id @param {boolean} current */
  return function toggle(chat, id, current) {
    if (signal.aborted) return;
    const key = JSON.stringify([chat, id]);
    const previous = intents.get(key);
    const intent = previous ?? { saved: current, wanted: current };
    intent.wanted = !intent.wanted;
    setPin(chat, id, intent.wanted, true);
    if (!previous) {
      intents.set(key, intent);
      void save(chat, id, key, intent);
    }
  };
};
