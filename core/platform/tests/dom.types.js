// @ts-check

/** @import { $, $$ } from "../dom.js" */

/** @template T @typedef {0 extends (1 & T) ? false : true} Checked */

/** @template {true} T @typedef {T} Assert */

/** @typedef {Assert<Checked<NonNullable<ReturnType<typeof $>>>>} SingleLookup */

/** @typedef {Assert<null extends ReturnType<typeof $> ? true : false>} MissingLookup */

/** @typedef {Assert<Checked<ReturnType<typeof $$>[number]>>} MultipleLookup */
