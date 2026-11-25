import type { Api } from "../../core/platform/api-types.d.ts";
import type { sharedFileRoute } from "../../core/services/world/relay.js";

export interface PreviewDeps {
  world: { thread: (id: string | null) => Parameters<typeof sharedFileRoute>[0] };
  api: Pick<Api, "projectFile" | "projectImage">;
  sharedFileRoute: typeof sharedFileRoute;
  box: () => HTMLElement | null;
  landed: () => void;
  scope?: import("../../core/kernel/types").Lifetime;
}
