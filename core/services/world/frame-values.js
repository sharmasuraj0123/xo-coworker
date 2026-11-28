// @ts-check

/** @param {unknown} value */
export const text = (value) => typeof value === "string" ? value : undefined;

/** @param {unknown} value */
export const number = (value) => typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** @param {unknown} value */
export const strings = (value) => Array.isArray(value) ? value.filter((v) => typeof v === "string") : undefined;
