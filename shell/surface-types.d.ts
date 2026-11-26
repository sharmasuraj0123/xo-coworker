import type { Contributed, Entry, Places, Undo } from "../core/kernel/types";
import type { ModuleContext } from "../core/kernel/types";

export type SurfaceScope = Pick<ModuleContext, "signal" | "effect">;

export type SurfaceEntry<C> = Entry & {
  mount?(host: HTMLElement): Undo | void;
  render(host: HTMLElement, context: C): void;
};
export type Surface<C> = Contributed<SurfaceEntry<C>>;

export interface FileRouteEntry extends Entry {
  route(target: Element, event: MouseEvent): boolean;
}

export interface SurfaceOptions<C> {
  read(): Surface<C>[];
  places: Pick<Places, "watch" | "has">;
  place: string;
  scope: SurfaceScope;
  schedule: () => void;
  fallback: () => HTMLElement | null;
  hideOnRetire?: boolean;
}

declare module "../core/kernel/types" {
  interface PlaceEntries {
    "page": SurfaceEntry<import("./render-types").FrameNeeds>;
    "header.detail": SurfaceEntry<import("./app-service-types").ConversationHeaderPaint>;
    "header.action": import("./header.js").Action;
    "conversation.press": import("./conversation-press-types").PressEntry;
    "conversation.file-route": FileRouteEntry;
    "search.provider": import("./places.js").SearchProvider;
  }
}
