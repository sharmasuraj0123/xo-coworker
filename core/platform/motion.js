// @ts-check

/** The one curve for everything that responds: tokens.css --ease. */
export const EASE = "cubic-bezier(.2,.8,.2,1)";
/** The person's reduced-motion setting, live; reads as reduced where there is no page. @type {MediaQueryList | { matches: boolean }} */
export const RM = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: true };
