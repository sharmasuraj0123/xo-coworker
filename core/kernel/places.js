// @ts-check

/** @typedef {import("./types").Entry} Entry @typedef {import("./types").At} At @typedef {import("./types").PlaceDef} PlaceDef @typedef {import("./types").Places} Places @typedef {import("./types").Arranger} Arranger @typedef {import("./types").Contributed} Contributed */

const ID = /^(preview:)?[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;
const KINDS = new Set(["single", "list", "keyed", "chain"]);
const SCOPES = new Set(["app", "project", "conversation"]);

/** @param {import("./types").Warn} [warn] @returns {Places} */
export function createPlaces(warn = console.error) {
  /** @type {Map<string, { def: PlaceDef, owner: string, entries: Contributed[], seq: Map<Contributed, number>, arranger?: Arranger, watchers: Set<() => void> }>} */
  const places = new Map();
  let seq = 0;

  /** @param {string} id */
  function need(id) {
    const p = places.get(id);
    if (!p) throw new Error(`no place "${id}" (is the module that defines it active?)`);
    return p;
  }
  /** @param {ReturnType<typeof need>} p */
  function changed(p) {
    for (const fn of [...p.watchers]) { try { fn(); } catch (e) { warn({ module: "places", phase: "watch", subject: p.def.id }, e); } }
  }
  /** @param {Contributed} e @param {At} at */
  function visible(e, at) {
    if (typeof e.when !== "function") return true;
    try { return e.when(at) !== false; } catch (err) { warn({ module: e.owner, phase: "visibility", subject: e.id }, err); return false; }
  }
  /** @param {ReturnType<typeof need>} p @param {At} at @returns {Contributed[]} */
  function ordered(p, at) {
    const { kind } = p.def;
    let list = p.entries.slice();
    if (kind === "list") list.sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || ((p.seq.get(a) ?? 0) - (p.seq.get(b) ?? 0)));
    else if (kind === "chain") list.sort((a, b) => ((b.priority ?? 0) - (a.priority ?? 0)) || ((p.seq.get(a) ?? 0) - (p.seq.get(b) ?? 0)));
    else if (kind === "keyed") list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (kind !== "single") list = list.filter((e) => visible(e, at));
    if (kind === "list" && p.arranger) {
      try { list = p.arranger(list, at); } catch (e) { warn({ module: "places", phase: "arrange", subject: p.def.id }, e); }
    }
    return list;
  }

  /** @type {Places} */
  const api = {
    define(def, owner = "kernel") {
      if (!def || !ID.test(def.id)) throw new Error(`a place needs a dotted lower-case id, got "${def && def.id}"`);
      if (!KINDS.has(def.kind)) throw new Error(`place "${def.id}": kind must be single, list, keyed or chain`);
      if (!SCOPES.has(def.scope)) throw new Error(`place "${def.id}": scope must be app, project or conversation`);
      if (!def.description) throw new Error(`place "${def.id}": say in one sentence what goes here (description)`);
      if (places.has(def.id)) throw new Error(`place "${def.id}" is already defined by ${places.get(def.id)?.owner}`);
      const p = { def: Object.freeze({ ...def }), owner, entries: [], seq: new Map(), watchers: new Set() };
      places.set(def.id, p);
      return () => { if (places.get(def.id) === p) { places.delete(def.id); changed(p); } };
    },
    contribute(place, entry, owner) {
      const p = need(place);
      if (!entry || typeof entry.id !== "string" || !entry.id) throw new Error(`place "${place}": an entry needs an id`);
      if (p.def.kind === "single" && p.entries.length) throw new Error(`place "${place}" holds one entry, and ${p.entries[0].owner} has it`);
      if (p.def.kind === "keyed" && p.entries.some((e) => e.id === entry.id)) throw new Error(`place "${place}": "${entry.id}" is already contributed by ${p.entries.find((e) => e.id === entry.id)?.owner}`);
      if (p.def.check) p.def.check(entry);
      /** @type {Contributed} */
      const c = Object.freeze(Object.assign(Object.create(null), entry, { owner }));
      p.entries.push(c);
      p.seq.set(c, ++seq);
      changed(p);
      return () => {
        const i = p.entries.indexOf(c);
        if (i < 0) return;
        p.entries.splice(i, 1);
        p.seq.delete(c);
        changed(p);
      };
    },
    entries(place, at = {}) {
      return /** @type {import("./types").Contributed<import("./types").PlaceEntry<typeof place>>[]} */ (ordered(need(place), at));
    },
    get(place, id) {
      const entry = need(place).entries.find((e) => e.id === id);
      return /** @type {import("./types").Contributed<import("./types").PlaceItem<typeof place, typeof id>> | undefined} */ (entry);
    },
    first(place, at = {}) { return api.entries(place, at)[0]; },
    arrange(place, fn) {
      const p = need(place);
      if (p.def.kind !== "list") throw new Error(`place "${place}" is a ${p.def.kind}; only lists can be arranged`);
      if (p.arranger) throw new Error(`place "${place}" already has an arranger`);
      p.arranger = fn;
      changed(p);
      return () => { if (p.arranger === fn) { p.arranger = undefined; changed(p); } };
    },
    watch(place, fn) {
      const p = need(place);
      p.watchers.add(fn);
      return () => { p.watchers.delete(fn); };
    },
    has: (place) => places.has(place),
    catalog: () => [...places.values()].map((p) => ({ ...p.def, owner: p.owner, entries: p.entries.length })).sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
  return api;
}
