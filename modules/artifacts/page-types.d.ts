// @ts-check

import type { Group, Made } from "./types.d.ts";
import type { createMadeStore } from "./store.js";
import type { createPreviews } from "./previews.js";
import type { createCards } from "./cards.js";

type Line = ReturnType<typeof import("../../core/ui/virtual.js").galleryLines<Group>>["lines"][number];

export interface GalleryState {
  kind: string;
  pid: string;
  q: string;
  els: Map<string, HTMLElement>;
  byKey: Map<string, Made>;
  lines?: Line[] | null;
  box?: HTMLElement | null;
  built?: boolean;
  M?: { cols: number; gap: number; headH: number; cardH: number };
  placeT?: number;
  arrive?: boolean;
  tio?: IntersectionObserver;
  filter?: string;
  placeholder?: string;
}

export interface GalleryDeps {
  MS: ReturnType<typeof createMadeStore>;
  PV: ReturnType<typeof createPreviews>;
  syncCards: ReturnType<typeof createCards>["syncCards"];
  PROJ: (id: string) => string;
  sk: { tile: (where: boolean | "page", i?: number) => string; bar: (width?: string, cls?: string) => string };
}

export interface MadeDeps {
  scope?: ReturnType<typeof import("../../core/kernel/scope.js").createScope>;
  world: import("./read-types.d.ts").MadeWorld & {
    thread: (id: string | null) => Parameters<typeof import("../../core/services/world/relay.js").sharedFileRoute>[0];
  };
  go: (view: string) => void;
  VW: { open: (file: MadeFile, from: Element | null) => void };
  PROJ: (id: string) => string;
  schedule: () => void;
  announce: (words: string) => void;
  skTile: GalleryDeps["sk"]["tile"];
  skBar: GalleryDeps["sk"]["bar"];
  rememberedMade: () => number | null | undefined;
}

interface MadeFile {
  path: string;
  name: string;
  type: string;
  bytes: number | null;
  project?: string;
  rel?: string;
  why?: string;
}
