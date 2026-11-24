interface FlowchartOptions {
  curve?: string;
  padding?: number;
  nodeSpacing?: number;
  rankSpacing?: number;
  htmlLabels?: boolean;
}

interface MermaidConfig {
  startOnLoad?: boolean;
  securityLevel?: "strict" | "loose" | "antiscript" | "sandbox";
  theme?: "base" | "dark" | "default" | "forest" | "neutral" | "null";
  darkMode?: boolean;
  fontFamily?: string;
  fontSize?: number;
  flowchart?: FlowchartOptions;
  themeVariables?: Record<string, string | boolean>;
}

declare const mermaid: {
  initialize(config: MermaidConfig): void;
  render(id: string, source: string): Promise<{ svg: string }>;
};

export default mermaid;
