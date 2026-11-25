declare module "../../core/kernel/types" {
  interface Services {
    shapeView: ReturnType<typeof import("./shape-page.js").createShapeView>;
    shortcuts: ReturnType<typeof import("./shortcuts-sheet.js").createShortcutsSheet>;
    settingsFrame: ReturnType<typeof import("./surface.js").mountSettingsSurface>;
  }
}
export {};
