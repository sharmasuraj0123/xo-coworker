// @ts-check

/** @import { Entry, Kernel, PlaceDef, Undo } from "../core/kernel/types" */

/** @param {string} place @param {string[]} strings @param {string[]} fns @returns {(e: Entry) => void} */
const needs = (place, strings, fns = []) => (e) => {
  for (const k of strings) {
    const value = Reflect.get(e, k);
    if (typeof value !== "string" || !value) throw new Error(`${place} "${e.id}": ${k} must be a non-empty string`);
  }
  for (const k of fns) if (typeof Reflect.get(e, k) !== "function") throw new Error(`${place} "${e.id}": ${k} must be a function`);
};

/** @type {[string, PlaceDef["kind"], PlaceDef["scope"], string, boolean, string[], string[]][]} */
const SPECS = [
  ["page", "keyed", "app", "A main page, keyed by route kind (home, ws, p, t, c, chats, artifacts).", false, [], ["mount"]],
  ["rail.entry", "list", "app", "An entry in the left rail's top list; the shape orders and hides them.", true, ["label", "icon"], ["onPress"]],
  ["rail.section", "list", "app", "A section of the left rail below its entries (Projects).", false, [], ["mount"]],
  ["rail.foot", "list", "app", "A control at the foot of the left rail (account, theme, settings).", false, ["label", "icon"], ["onPress"]],
  ["header.title", "keyed", "conversation", "How the header names what is open, keyed by route kind.", false, [], ["render"]],
  ["header.badge", "list", "conversation", "A small mark beside the header's title (runtime, needs you).", false, [], ["render"]],
  ["header.detail", "list", "conversation", "A detail drawn into a named host below the conversation header.", false, [], ["render"]],
  ["header.action", "list", "conversation", "A button in the header (Threads, Resolve, Deploy, Map, the panel).", true, ["label", "icon"], ["onPress"]],
  ["thread.menu", "list", "conversation", "An item in a thread's ⋯ menu, in a named group.", true, ["label", "group"], ["run"]],
  ["thread.head", "list", "conversation", "A strip under a thread's header (checklist, sub-agents).", false, [], ["mount"]],
  ["panel.frame", "list", "conversation", "A stacked frame in the right panel (Threads, Changes, Map, Launchpad).", true, ["title"], ["mount"]],
  ["panel.page", "keyed", "app", "A page the right panel shows in place of its frames (Shell, Files, Thread).", true, [], ["mount"]],
  ["panel.title-action", "list", "app", "A button in the right panel's title bar.", false, ["label", "icon"], ["onPress"]],
  ["dock.bottom", "single", "app", "The dock under the conversation; it can move into a panel page.", false, [], ["mount"]],
  ["conversation.source", "keyed", "app", "Where a conversation's rows come from, keyed by view prefix.", false, [], ["items"]],
  ["conversation.row", "keyed", "conversation", "How one kind of conversation row is drawn, keyed by its kind.", true, [], ["render"]],
  ["conversation.block", "keyed", "conversation", "How one block type of an agent's turn is drawn, keyed by type.", true, [], ["render"]],
  ["conversation.tool-words", "chain", "app", "Plain words for a tool call; the first that knows the tool wins.", true, [], ["words"]],
  ["conversation.typing", "chain", "conversation", "The line that says who is working or waiting; the first that applies wins.", false, [], ["render"]],
  ["message.action", "list", "conversation", "An action under a message (Copy, Reply, Good, Bad).", true, ["label"], ["run"]],
  ["message.decorator", "list", "conversation", "Something drawn onto a message after it renders (tails, quotes, marks).", false, [], ["decorate"]],
  ["composer.tool", "list", "conversation", "A tool in the composer (attach, intelligence, send now).", true, [], ["mount"]],
  ["composer.target", "chain", "conversation", "The line that says where a message goes; the first that applies wins.", false, [], ["render"]],
  ["composer.send-gate", "chain", "app", "A reason sending is held; the first refusal wins.", false, [], ["block"]],
  ["composer.above", "list", "conversation", "What stacks above the composer (notices, a docked decision, a file chip).", false, [], ["mount"]],
  ["decision.card", "single", "app", "How a decision is drawn, in the panel, the dock and Home.", false, [], ["render"]],
  ["decision.detail", "keyed", "app", "The details of one kind of decision, keyed by kind.", false, [], ["render"]],
  ["decision.evidence", "keyed", "app", "A view shown as evidence inside a decision.", true, [], ["mount"]],
  ["home.section", "list", "app", "A section of Home; the shape orders them.", false, [], ["mount"]],
  ["settings.section", "list", "app", "A section of Settings.", true, ["label", "icon"], ["render"]],
  ["files.viewer.kind", "chain", "app", "How a file is shown; the first kind that accepts it wins.", true, [], ["accepts", "mount"]],
  ["files.row.menu", "list", "project", "An item in a file row's ⋯ menu.", true, ["label"], ["run"]],
  ["files.viewer.head.action", "list", "project", "An action in an open file's head.", true, ["label"], ["run"]],
  ["files.tree.section", "list", "project", "A section of the files tree (changed here, all files).", false, [], ["mount"]],
  ["editor.extension", "list", "project", "An editor extension for a kind of file.", false, [], ["extension"]],
  ["search.provider", "list", "app", "A source of results for ⌘K and ⌘P.", true, [], ["items", "pick"]],
  ["command", "keyed", "app", "A named command, run by keys, menus or ⌘K; ids are <module>:<name>.", true, ["label"], ["run"]],
  ["shortcut", "keyed", "app", "A key binding for a command, in a scope (global, decision, editor, diff, panel).", false, ["keys", "command"], []],
  ["pre-paint", "list", "app", "A flag set on <html> before the first paint (theme, bubbles, density).", false, [], ["apply"]],
  ["world.reducer", "keyed", "app", "How one stream frame type changes the world, keyed by frame type.", false, [], ["reduce"]],
];
const DEFS = SPECS.map(([id, kind, scope, description, openToApps, strings, fns]) => ({
  id, kind, scope, description, openToApps, requires: [...strings, ...fns], check: needs(id, strings, fns),
}));

export const PLACES = Object.freeze(DEFS);

/** @typedef {{ name: string, sub: string, icon: string, run: () => void }} SearchMatch */

/** @typedef {{ id: string, items: (query: string) => SearchMatch[], pick: (match: SearchMatch) => void }} SearchProvider */

/** @param {Kernel["places"]} places @param {string} query */
export function contributedSearch(places, query) {
  if (!places.has("search.provider")) return [];
  /** @type {import("../core/kernel/types.d.ts").Contributed<SearchProvider>[]} */
  const providers = places.entries("search.provider");
  return providers.flatMap((provider) => provider.items(query).map((match) => ({ ...match, run: () => provider.pick(match) })));
}

/** @param {Kernel} kernel @returns {Undo} */
export function definePlaces(kernel) {
  const undos = PLACES.map(({ requires, ...def }) => kernel.places.define(def, "xo.shell"));
  return () => { for (const u of undos.reverse()) u(); };
}
