export interface Sheet {
  host: HTMLElement;
  fraction?: number;
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
}
