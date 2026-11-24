// @ts-check

export interface ListDraw<T> {
  make: (item: T) => HTMLElement;
  update: (element: HTMLElement, item: T) => void;
}

export interface ExpandOptions {
  onStep?: (() => void) | null;
  frame?: Element | null;
}
