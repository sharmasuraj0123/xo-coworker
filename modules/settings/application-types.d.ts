declare module "../../core/kernel/types" {
  interface Services {
    shapeView: ReturnType<typeof import("./shape-page.js").createShapeView>;
    shortcuts: { keys: HTMLElement; openKeys(): void; closeKeys(): void };
    settingsFrame: ReturnType<typeof import("./surface.js").mountSettingsSurface>;
  }
}
export {};
