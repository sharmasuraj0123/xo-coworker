// @ts-check

import { createScope } from "./scope.js";
import { createBus } from "./bus.js";
import { createPlaces } from "./places.js";
import { createScheduler } from "./scheduler.js";
import { createLayers } from "./layers.js";
import { satisfies } from "./semver.js";
import { manifestProblems } from "./manifest.js";

/** @import {Kernel, ModuleContext, ModuleDef, ModuleManifest, ModuleStatus, ServiceValue, StartReport} from "./types" */

export const KERNEL_VERSION = "1.1.0";
/** @param {{ warn?: (...a: unknown[]) => void, log?: (...a: unknown[]) => void, request?: (fn: () => void) => unknown, timers?: { setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout, setInterval: typeof setInterval, clearInterval: typeof clearInterval } }} [opts] @returns {Kernel} */
export function createKernel(opts = {}) {
  const warn = opts.warn || console.error;
  const log = opts.log || console.log;
  const newScope = () => createScope({ timers: opts.timers, warn });
  const places = createPlaces(warn), bus = createBus(warn), layers = createLayers(warn);
  const scheduler = createScheduler({ request: opts.request, warn });
  /** @type {Map<string, { def: ModuleDef, status: ModuleStatus, error?: string, activation?: { scope: ReturnType<typeof createScope>, done: Promise<void> }, order: number }>} */
  const mods = new Map();
  /** @type {Map<string, { api: unknown, owner: string }>} */
  const services = new Map();
  let order = 0, safe = false, disposed = false;
  /** @type {Set<string>} */
  const off = new Set();

  const provider = (/** @type {string} */ svc) => [...mods.values()].find((r) => (r.def.manifest.provides || []).includes(svc));
  const missing = (/** @type {ModuleManifest} */ m) => (m.needs || []).filter((s) => !services.has(s));

  /** @param {ModuleManifest} m @param {ReturnType<typeof createScope>} U @returns {ModuleContext} */
  function contextFor(m, U) {
    const id = m.id;
    const allowed = (/** @type {string} */ place, /** @type {string} */ entryId) => {
      const c = m.contributes || [];
      return c.includes(place) || c.includes(`${place}:${entryId}`);
    };
    return {
      id, kernelVersion: KERNEL_VERSION,
      use(svc) {
        if (!(m.needs || []).includes(svc)) throw new Error(`${id}: ctx.use("${svc}") but "${svc}" is not in its manifest's needs`);
        const s = services.get(svc);
        if (!s) throw new Error(`${id}: service "${svc}" is not available`);
        return /** @type {ServiceValue<typeof svc>} */ (s.api);
      },
      optional(svc) {
        if (!m.optional?.includes(svc)) throw new Error('Undeclared optional service "' + svc + '" in ' + id);
        if (U.signal.aborted) return undefined;
        return /** @type {ServiceValue<typeof svc> | undefined} */ (services.get(svc)?.api);
      },
      has: (svc) => services.has(svc),
      provide: (name, api) => U.effect(() => {
        if (!(m.provides || []).includes(name)) throw new Error(`${id}: ctx.provide("${name}") but "${name}" is not in its manifest's provides`);
        if (services.has(name)) throw new Error(`${id}: service "${name}" is already provided by ${services.get(name)?.owner}`);
        services.set(name, { api, owner: id });
        return () => { if (services.get(name)?.owner === id) services.delete(name); };
      }),
      contribute: (place, entry) => U.effect(() => {
        if (!allowed(place, entry && entry.id)) throw new Error(`${id}: contributes to "${place}:${entry && entry.id}" but its manifest's contributes doesn't list it`);
        return places.contribute(place, entry, id);
      }),
      definePlace: (def) => U.effect(() => {
        if (!(m.defines || []).includes(def.id)) throw new Error(`${id}: defines place "${def.id}" but its manifest's defines doesn't list it`);
        return places.define(def, id);
      }),
      effect: U.effect,
      on: (topic, ...args) => U.effect(() => bus.on(topic, ...args)),
      emit: bus.emit,
      listen: U.listen, timeout: U.timeout, interval: U.interval, frame: U.frame, observe: U.observe, signal: U.signal,
      onFlush: (key, fn) => U.effect(() => scheduler.onFlush(key, fn)),
      invalidate: (key) => scheduler.invalidate(key),
      pushLayer: (layer) => U.effect(() => layers.push(layer, id)),
      places: { entries: places.entries, get: places.get, first: places.first, watch: (p, fn) => U.effect(() => places.watch(p, fn)), has: places.has },
      log: (...a) => log(`[${id}]`, ...a),
    };
  }

  /** @param {NonNullable<ReturnType<typeof mods.get>>} rec */
  function activate(rec) {
    const { id, core } = rec.def.manifest;
    if (disposed || off.has(id) || (safe && !core)) return;
    if (rec.activation) return rec.activation.done;
    if (missing(rec.def.manifest).length) { rec.status = "waiting"; return; }
    const scope = newScope(), { promise, resolve, reject } = /** @type {PromiseWithResolvers<void>} */ (Promise.withResolvers());
    rec.activation = { scope, done: promise };
    run().then(resolve, reject);
    return promise;
    async function run() {
      try {
        await rec.def.activate(contextFor(rec.def.manifest, scope));
        if (scope.signal.aborted) return;
        rec.status = "active";
        rec.error = undefined;
        bus.emit("kernel:module-active", { id });
      } catch (e) {
        if (scope.signal.aborted) return;
        rec.status = "failed";
        scope.dispose();
        rec.activation = undefined;
        rec.error = String((e && typeof e === "object" && "message" in e && e.message) || e);
        warn(`module ${id} failed to activate:`, e);
        bus.emit("kernel:module-failed", { id, error: rec.error });
      }
    }
  }
  async function settle() {
    for (let changed = true; changed;) {
      changed = false;
      for (const rec of [...mods.values()].sort((a, b) => a.order - b.order)) {
        if (rec.status === "active" || rec.status === "failed" || rec.status === "disabled") continue;
        const before = rec.status;
        await activate(rec);
        if (rec.status !== before) changed = true;
      }
    }
  }
  /** @returns {StartReport} */
  function report() {
    const all = [...mods.values()];
    return {
      active: all.filter((r) => r.status === "active").map((r) => r.def.manifest.id),
      waiting: all.filter((r) => r.status === "waiting" || r.status === "registered").map((r) => ({ id: r.def.manifest.id, missing: missing(r.def.manifest) })),
      failed: all.filter((r) => r.status === "failed").map((r) => ({ id: r.def.manifest.id, error: r.error || "" })),
      disabled: all.filter((r) => r.status === "disabled").map((r) => r.def.manifest.id),
    };
  }
  /** @param {string} id @returns {string[]} */
  function dependents(id, seen = new Set([id])) {
    const out = [];
    const provides = mods.get(id)?.def.manifest.provides || [];
    for (const r of mods.values()) {
      const rid = r.def.manifest.id;
      if (seen.has(rid) || !r.activation) continue;
      if ((r.def.manifest.needs || []).some((s) => provides.includes(s))) {
        seen.add(rid);
        out.push(...dependents(rid, seen), rid);
      }
    }
    return out;
  }
  /** @param {string} id @param {ModuleStatus} to */
  function deactivate(id, to) {
    const rec = mods.get(id);
    if (!rec) return;
    rec.activation?.scope.dispose();
    rec.activation = undefined;
    rec.status = to;
    bus.emit("kernel:module-inactive", { id, status: to });
  }

  return {
    version: KERNEL_VERSION, places, bus, scheduler, layers,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const id of [...mods.keys()].reverse()) {
        if (mods.get(id)?.status === "disabled") continue;
        for (const child of dependents(id)) deactivate(child, "disabled");
        deactivate(id, "disabled");
      }
    },
    register(def) {
      if (disposed) throw new Error("The kernel has been disposed");
      const p = manifestProblems(def && def.manifest);
      if (p.length) throw new Error(`module manifest: ${p.join("; ")}`);
      const m = def.manifest;
      if (mods.has(m.id)) throw new Error(`module ${m.id} is already registered`);
      if (typeof def.activate !== "function") throw new Error(`module ${m.id}: activate(ctx) is missing`);
      if (!satisfies(KERNEL_VERSION, m.kernel)) throw new Error(`module ${m.id} needs kernel ${m.kernel}; this is ${KERNEL_VERSION}`);
      for (const s of m.provides || []) { const p2 = provider(s); if (p2) throw new Error(`module ${m.id} provides "${s}", which ${p2.def.manifest.id} already provides`); }
      mods.set(m.id, { def, status: "registered", order: order++ });
    },
    async start(o = {}) {
      if (disposed) throw new Error("The kernel has been disposed");
      safe = !!o.safe;
      if (safe) for (const r of mods.values()) if (!r.def.manifest.core) r.status = "disabled";
      for (const id of o.disabled || []) {
        const r = mods.get(id);
        if (r && !r.def.manifest.core) { off.add(id); r.status = "disabled"; }
      }
      await settle();
      return report();
    },
    async enable(id) {
      if (disposed) throw new Error("The kernel has been disposed");
      const rec = mods.get(id);
      if (!rec) throw new Error(`no module ${id}`);
      off.delete(id);
      if (rec.status === "disabled" || rec.status === "failed") rec.status = "registered";
      await settle();
      return report();
    },
    async disable(id) {
      const rec = mods.get(id);
      if (!rec) throw new Error(`no module ${id}`);
      if (rec.def.manifest.core) throw new Error(`module ${id} is part of the core and can't be disabled`);
      const down = dependents(id);
      for (const d of down) deactivate(d, "waiting");
      deactivate(id, "disabled");
      off.add(id);
      return [...down, id];
    },
    status: (id) => mods.get(id)?.status,
    live: (id) => mods.get(id)?.activation?.scope.size ?? 0,
    modules: () => [...mods.values()].sort((a, b) => a.order - b.order).map((r) => ({ id: r.def.manifest.id, status: r.status, error: r.error, manifest: r.def.manifest })),
  };
}
