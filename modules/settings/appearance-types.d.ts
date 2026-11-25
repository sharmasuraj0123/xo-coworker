export type PreferenceScope = Pick<import("../../core/kernel/types").ModuleContext, "listen" | "effect" | "signal">;

export type AppearanceDeps = Pick<ReturnType<typeof import("../../core/ui/theme.js").createTheme>, "THEME"> & {
  deviceSaid: (control: HTMLElement, result: { kept: boolean }, message: string) => void;
};

export type DeviceNotice = ReturnType<typeof import("./device-notice.js").createDeviceNotice>;

export interface Preferences {
  THEME: AppearanceDeps["THEME"];
  shape: AppearanceShape & { onChange(fn: () => void): () => void };
  webPictures: string;
}
export interface AppearanceShape {
  on: (id: string) => boolean;
  setDevice: (override: { surfaces: Record<string, { on: boolean }> }) => { kept?: boolean; error?: string | null };
}
