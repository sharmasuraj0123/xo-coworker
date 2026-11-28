// @ts-check

/** @import { api, chatActivityApi, ruleApi, uploadAttachment } from "../api.js" */

/** @template Method @typedef {Method extends (...args: never[]) => infer Response ? Awaited<Response> : unknown} Reply */

/** @template Api @typedef {{ [Key in keyof Api]: unknown extends Reply<Api[Key]> ? Key : never }[keyof Api]} Unchecked */

/** @template {never} Route @typedef {Route} NoUncheckedResponse */

/** @typedef {typeof api} Api */

/** @typedef {typeof chatActivityApi} Activity */

/** @typedef {typeof ruleApi} Rules */

/** @typedef {{ uploadAttachment: () => ReturnType<typeof uploadAttachment>["promise"] }} Upload */

/** @typedef {NoUncheckedResponse<Unchecked<Api> | Unchecked<Activity> | Unchecked<Rules> | Unchecked<Upload>>} AllResponsesTyped */
