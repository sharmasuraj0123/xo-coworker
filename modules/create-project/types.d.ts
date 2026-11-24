export interface Repo { url: string; label: string; name: string | undefined; github: boolean }
export interface CreateCtx {
  world: { act: { refresh(): Promise<unknown> }; state: { projects: { id: string }[] } };
  welcome(id: string, description: string, text: string): void;
  go: (view: string, o?: { focus?: boolean }) => void;
  heraldShow: (notice: object, ms?: number) => void;
  announce: (text: string) => void;
  setDrawer: (open: boolean) => void;
  onPhoneClose: () => void;
}
