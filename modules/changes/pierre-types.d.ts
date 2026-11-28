import type { DiffOptions } from "./types.d.ts";

interface ParsedFile {
  name: string;
  prevName?: string;
  lang?: string;
}

interface ThemePair {
  dark: string;
  light: string;
}

interface DiffConfig {
  theme: ThemePair;
  themeType: string;
  preferredHighlighter: string;
  disableFileHeader: boolean;
  overflow: string;
  tokenizeMaxLineLength: number;
  diffStyle: "split" | "unified";
  diffIndicators: "bars";
  lineDiffType: "word";
  hunkSeparators: "line-info";
  expansionLineCount: number;
  loadDiffFiles?: (file: ParsedFile) => ReturnType<NonNullable<DiffOptions["loadFiles"]>> | undefined;
  enableLineSelection?: boolean;
  onLineSelected?: NonNullable<DiffOptions["onSelect"]>;
}

export interface RenderedDiff {
  options: DiffConfig;
  render(input: {fileDiff: ParsedFile, containerWrapper: HTMLElement}): void;
  setOptions(options: DiffConfig): void;
  setThemeType(theme: string): void;
  rerender(): void;
  cleanUp(): void;
}

export interface DiffWorkerPool {
  initialize(languages: string[]): Promise<unknown>;
}

export interface PierreDiffs {
  registerCustomTheme(name: string, create: () => Promise<typeof import("./diffthemes.js").XO_DARK>): void;
  parsePatchFiles(patch: string, options?: {cacheKeyPrefix: string}): {files: ParsedFile[]}[];
  getOrCreateWorkerPoolSingleton(options: {
    poolOptions: {workerFactory: () => Worker, poolSize: number, mainThreadMaxCharacters: number},
    highlighterOptions: {theme: ThemePair, langs: string[], preferredHighlighter: string},
  }): DiffWorkerPool;
  FileDiff: new (options: DiffConfig, pool: DiffWorkerPool) => RenderedDiff;
}
