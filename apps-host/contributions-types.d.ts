import type { PlaceEntry } from "../core/kernel/types";
import type { SURFACE_PLACES } from "./manifest.js";

type CompiledPlace = (typeof SURFACE_PLACES)["panel" | "header" | "commands" | "canvas" | "evidence"];
export type Contribution = { [Place in CompiledPlace]: {
  place: Place;
  entry: PlaceEntry<Place> & { app: string; icon?: string; label?: string };
} }[CompiledPlace];
