export interface Sheet {
  host: HTMLElement;
  card?: () => HTMLElement | null;
  open: () => boolean;
  close: () => void;
}

export interface SurfaceGestures {
  phone(): boolean;
  overlay(): unknown;
  view(): string;
  back(): void;
  drawer(open: boolean): void;
  isDrawer(): boolean;
  closeSettings(): void;
  settingsOpen(): boolean;
  viewerOpen(): boolean;
  closeViewer(): void;
  sheets: Sheet[];
  panelOpen(): boolean;
  say?: HTMLElement;
  toast?: (message: string) => void;
}
