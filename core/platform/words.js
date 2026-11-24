// @ts-check

/** @param {number} n @param {string} one @param {string} [many] */
export const plural = (n, one, many = one + "s") => n === 1 ? one : many;

/** @param {number} n @param {string} one @param {string} [many] */
export const count = (n, one, many) => `${n} ${plural(n, one, many)}`;
