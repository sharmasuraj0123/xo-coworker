// @ts-check
import { isResponseObject } from "./http.js";

/** @import { Policies, Router, RouterModel, Runtime, RuntimeModel } from "./runtime-response-types" */

/** @param {unknown} value */
const string = (value) => typeof value === "string";
/** @param {unknown} value */
const boolean = (value) => typeof value === "boolean";
/** @param {unknown} value */
const number = (value) => typeof value === "number" && Number.isFinite(value);
/** @param {unknown} value */
const strings = (value) => Array.isArray(value) && value.every(string);
/** @param {unknown} value @param {(value: unknown) => boolean} check */
const optional = (value, check) => value === undefined || check(value);
/** @param {unknown} value @param {(value: unknown) => boolean} check */
const nullable = (value, check) => value == null || check(value);

/** @param {unknown} value */
const isUsageWindow = (value) => isResponseObject(value) && optional(value.state, string)
  && nullable(value.utilization, number) && nullable(value.resets_at, string);

/** @param {unknown} value */
const isRuntimeError = (value) => isResponseObject(value) && optional(value.code, string) && optional(value.message, string);

/** @param {unknown} value */
function isHealth(value) {
  if (!isResponseObject(value)) return false;
  return [value.installed, value.logged_in, value.usable].every((flag) => optional(flag, boolean))
    && [value.cli_version, value.checked_at, value.account, value.pool, value.why_not, value.resets_at]
      .every((field) => nullable(field, string))
    && nullable(value.error, isRuntimeError) && optional(value.limit, string)
    && optional(value.windows, (windows) => isResponseObject(windows)
      && Object.values(windows).every((window) => nullable(window, isUsageWindow)));
}

/** @param {unknown} value */
const isCli = (value) => isResponseObject(value) && nullable(value.version, string) && nullable(value.account, string)
  && optional(value.logged_in, boolean);

/** @param {unknown} value */
const isFeature = (value) => isResponseObject(value) && optional(value.values, strings)
  && nullable(value.support, string) && nullable(value.behaviour, string);

/** @param {unknown} value */
const hasFeatures = (value) => isResponseObject(value) && optional(value.features, (features) => isResponseObject(features)
  && Object.values(features).every(isFeature));

/** @param {unknown} value @returns {value is Runtime} */
const isRuntime = (value) => isResponseObject(value) && string(value.name) && optional(value.default, boolean)
  && nullable(value.cli, isCli) && nullable(value.health, isHealth) && optional(value.features, hasFeatures)
  && nullable(value.error, (error) => string(error) || isRuntimeError(error));

/** @param {unknown} value @returns {value is { runtimes: Runtime[] }} */
export const isRuntimes = (value) => isResponseObject(value) && Array.isArray(value.runtimes) && value.runtimes.every(isRuntime);

/** @param {unknown} value @returns {value is RuntimeModel} */
const isModel = (value) => isResponseObject(value) && string(value.id) && string(value.name)
  && nullable(value.family, string) && nullable(value.default_effort, string) && optional(value.description, string)
  && [value.family_default, value.is_default, value.takes_effort].every((flag) => optional(flag, boolean))
  && optional(value.efforts, strings);

/** @param {unknown} value @returns {value is { models: RuntimeModel[] }} */
export const isModels = (value) => isResponseObject(value) && Array.isArray(value.models) && value.models.every(isModel);

/** @param {unknown} value */
const isPolicy = (value) => isResponseObject(value) && nullable(value.allowed, strings) && nullable(value.default, string)
  && nullable(value.fallback, boolean) && nullable(value.preferences, string);

/** @param {unknown} value @returns {value is Policies} */
export const isPolicies = (value) => isResponseObject(value) && optional(value.space, isPolicy)
  && nullable(value.project, isPolicy) && isPolicy(value.effective);

/** @param {unknown} value @returns {value is Router} */
export const isRouter = (value) => isResponseObject(value) && optional(value.mode, string)
  && nullable(value.decision_model, string) && optional(value.abstain_below, number);

/** @param {unknown} value @returns {value is RouterModel} */
const isRouterModel = (value) => isResponseObject(value) && string(value.id) && string(value.label)
  && boolean(value.connected) && optional(value.model, string) && optional(value.docs_url, string);

/** @param {unknown} value @returns {value is { models: RouterModel[] }} */
export const isRouterModels = (value) => isResponseObject(value) && Array.isArray(value.models) && value.models.every(isRouterModel);
