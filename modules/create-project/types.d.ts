export interface Repo { url: string; label: string; name: string | undefined; github: boolean }
export interface CreateCtx {
  world: { act: { refresh(): Promise<unknown> }; state: { projects: { id: string }[] } };
  S: { desc: Record<string, string>; local: Record<string, object[]>; n: number };
  go: (view: string, o?: { focus?: boolean }) => void;
  heraldShow: (notice: object, ms?: number) => void;
  announce: (text: string) => void;
  setDrawer: (open: boolean) => void;
  onPhoneClose: () => void;
}
