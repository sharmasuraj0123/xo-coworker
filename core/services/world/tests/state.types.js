// @ts-check
export {};

/** @import { WorldState } from "../state-types.d.ts" */

/** @template T @typedef {string extends keyof T ? "open row" : never} OpenRow */

/** @template {never} T @typedef {T} Closed */

/** @typedef {NonNullable<WorldState["timeline"][string]>[number]} Message */

/** @typedef {WorldState["review"] extends Map<string, infer R> ? R : never} Review */

/** @typedef {WorldState["hops"] extends Map<string, infer R> ? R : never} Hop */

/** @typedef {WorldState["projects"][number] | WorldState["threads"][number] | WorldState["hosts"][number]} Projection */

/** @template T @typedef {T extends unknown ? OpenRow<T> : never} OpenMember */

/** @typedef {Closed<OpenMember<Projection | Message | Review | Hop | WorldState["sessions"][string] | WorldState["activity"][number]>>} StateRows */

/** @typedef {WorldState["threads"][number]} Thread */

/** @typedef {Closed<OpenMember<Thread["asks"][number] | Thread["messages"][number] | Thread["messages"][number]["reactions"][number]>>} Projections */

/** @template T @typedef {0 extends (1 & T) ? "unchecked field" : never} Unchecked */

/** @typedef {Closed<Unchecked<import("../../storm/types").Row[string]>>} StreamInput */

/** @typedef {NonNullable<ReturnType<WorldState["turns"]["get"]>>} Turn */

/** @typedef {Closed<OpenMember<NonNullable<Turn["end"] | Turn["stopped"]> | import("../../storm/types").StoredThread>>} PrivateRecords */
