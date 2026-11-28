// @ts-check

export const PHONE_MAX_WIDTH = 760;
export const PHONE = typeof matchMedia === "function" ? matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`) : null;
