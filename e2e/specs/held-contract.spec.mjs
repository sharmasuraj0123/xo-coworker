// @ts-check

import { casesForHeld, contract, heldSeed } from "../lib/held-sessions.mjs";

export const cases = casesForHeld({ seed: heldSeed(contract.sessions, contract.threads), coordinator: contract.coordinator,
  session: contract.thread_session, thread: contract.thread_ts, events: contract.events, label: "Space held-session contract" });
