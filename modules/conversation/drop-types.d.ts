import type { Composer } from "./composer-types.d.ts";

export interface ComposerDropOptions {
  veil: HTMLElement;
  icon: HTMLElement;
  composerAt(node: Node | null): Composer;
  canAttach(view: string): boolean;
  addFiles(files: FileList, composer: Composer): void;
}
