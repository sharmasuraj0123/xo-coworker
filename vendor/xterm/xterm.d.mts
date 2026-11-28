type Color = "Black" | "Red" | "Green" | "Yellow" | "Blue" | "Magenta" | "Cyan" | "White";
type TerminalTheme = Partial<Record<
  "background" | "foreground" | "cursor" | "cursorAccent" | "selectionBackground" | Lowercase<Color> | `bright${Color}`,
  string
>>;

interface TerminalOptions {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  cursorBlink?: boolean;
  scrollback?: number;
  allowProposedApi?: boolean;
  theme?: TerminalTheme;
}

export interface Disposable {
  dispose(): void;
}

export interface TerminalAddon extends Disposable {
  activate(terminal: Terminal): void;
}

export declare class Terminal implements Disposable {
  constructor(options?: TerminalOptions);
  readonly cols: number;
  readonly rows: number;
  options: TerminalOptions;
  attachCustomKeyEventHandler(handler: (event: KeyboardEvent) => boolean): void;
  getSelection(): string;
  loadAddon(addon: TerminalAddon): void;
  open(parent: HTMLElement): void;
  onData(listener: (data: string) => void): Disposable;
  onBinary(listener: (data: string) => void): Disposable;
  onTitleChange(listener: (title: string) => void): Disposable;
  onBell(listener: () => void): Disposable;
  write(data: string | Uint8Array, callback?: () => void): void;
  focus(): void;
  reset(): void;
  dispose(): void;
}
