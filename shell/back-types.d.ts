export interface BackSteps {
  S: { view: string, trail: string[], retrace: boolean };
  LAYERS: { open: () => boolean, back: () => boolean };
  placeOk: (view: string) => boolean;
  go: (view: string) => void;
  back: () => void;
}
