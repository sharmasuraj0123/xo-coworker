import type { Terminal, TerminalAddon } from "./xterm.mjs";

export declare class FitAddon implements TerminalAddon {
  activate(terminal: Terminal): void;
  dispose(): void;
  fit(): void;
}
