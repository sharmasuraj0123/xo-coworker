// @ts-check

export type Redraw = (element: HTMLElement, html: string) => boolean;
export interface Row { key: string; html: string }
export interface ReconcileOptions { quiet?: boolean; fallback?: (() => HTMLElement | null) | null }
export interface RedrawOptions { preserve?: (node: Node) => boolean }
