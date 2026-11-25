// @ts-check

import { casesForHeld, synthetic } from "../lib/held-sessions.mjs";

export const cases = [false, true].flatMap((explicit) => casesForHeld(synthetic(explicit)));
