export type AppearanceDeps = ReturnType<typeof import("../../core/ui/theme.js").createTheme> & {
  deviceSaid: (control: HTMLElement, result: { kept: boolean }, message: string) => void;
};

export type DeviceNotice = ReturnType<typeof import("./device-notice.js").createDeviceNotice>;

export interface AppearanceShape {
  on: (id: string) => boolean;
  setDevice: (override: { surfaces: Record<string, { on: boolean }> }) => { kept?: boolean; error?: string | null };
}
