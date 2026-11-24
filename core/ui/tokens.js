// @ts-check

import { rootToken } from "../platform/style-token.js";

/** @param {string} name */
function milliseconds(name) {
  const token = rootToken(name);
  const value = Number.parseFloat(token);
  if (!Number.isFinite(value)) return 0;
  return token.endsWith("ms") ? value : value * 1000;
}

export const IN = milliseconds("--d-in");
export const MOVE = milliseconds("--d-move");
export const OUT = milliseconds("--d-out");
export const LOOP = milliseconds("--d-loop");
