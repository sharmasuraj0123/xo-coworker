declare module "../kernel/types" {
  interface Services { theme: ReturnType<typeof import("./theme.js").createTheme> }
  interface Topics { "theme:applied": "dark" | "light" }
}
export {};
