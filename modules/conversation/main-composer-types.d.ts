import type { Composer, ComposerScope } from "./composer-types.d.ts";
import type { ComposerDropOptions } from "./drop-types.d.ts";

export interface Bindings extends Pick<ComposerDropOptions, "composerAt" | "canAttach"> {
  wireTray(composer: Composer, scope: ComposerScope): void;
  wireComposer(composer: Composer, scope: ComposerScope): void;
  addFiles(files: FileList | null, composer: Composer): void;
}
