// @ts-check

import { rootToken } from "./style-token.js";
export const EASE = rootToken("--ease") || "ease";
/** The person's reduced-motion setting, live; reads as reduced where there is no page. @type {MediaQueryList | { matches: boolean }} */
export const RM = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: true };
