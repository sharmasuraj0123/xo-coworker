import type { PanelState } from "./panel-view-types.d.ts";

export type CardKeysOptions = { onEsc?: () => void; inPanel?: boolean };

export type DecisionKeyboardDeps = {
  panel: HTMLElement;
  stage: HTMLElement;
  F: PanelState;
  undo(): boolean;
  onOpenThread?: (id: string, surface: "panel") => void;
  close(): void;
  confirmAll(): void;
  setLater(): void;
  skip(direction: number): void;
};
