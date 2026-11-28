// @ts-check

/** @param {unknown} value */
export const optionalText = (value) => value === undefined || typeof value === "string";

/** @param {unknown} value */
export const optionalNullableText = (value) => value === null || optionalText(value);

/** @param {unknown} value */
export const optionalNumber = (value) => value === undefined || typeof value === "number" && Number.isFinite(value);

/** @param {unknown} value */
export const optionalFlag = (value) => value === undefined || typeof value === "boolean";
