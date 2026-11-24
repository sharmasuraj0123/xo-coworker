// @ts-check

import type { Made, Preview } from "./types.d.ts";

export interface CardsDeps {
  PV: {
    previewable: (item: Made) => boolean;
    failed: Set<string>;
    thumbs: Map<string, string>;
    texts: Map<string, Preview | null>;
  };
  PROJ: (project: string) => string;
  naming: (item: Made) => { file: string; tip: string; label: string; html: string; from: string };
}
