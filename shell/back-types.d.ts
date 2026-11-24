import type { NavigationDeps, NavigationOptions } from "./navigation-types.d.ts";

export interface BackSteps {
  location: Pick<NavigationDeps["location"], "view" | "hasTrail" | "previousPlace">;
  LAYERS: { open: () => boolean, back: () => boolean };
  placeOk: (view: string) => boolean;
  go: (view: string, options: NavigationOptions) => void;
  back: () => void;
}
