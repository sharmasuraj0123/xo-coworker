"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Terminal,
  Search,
  Zap,
  Link2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolPart, ToolState } from "@/types/message";

const COMPOSIO_TOOLS = {
  workbench: "COMPOSIO_REMOTE_WORKBENCH",
  search: "COMPOSIO_SEARCH_TOOLS",
  multiExecute: "COMPOSIO_MULTI_EXECUTE_TOOL",
  manageConnections: "COMPOSIO_MANAGE_CONNECTIONS",
} as const;

export function isComposioTool(toolName: string): boolean {
  return (
    toolName === COMPOSIO_TOOLS.workbench ||
    toolName === COMPOSIO_TOOLS.search ||
    toolName === COMPOSIO_TOOLS.multiExecute ||
    toolName === COMPOSIO_TOOLS.manageConnections
  );
}

interface ComposioPartProps {
  data: ToolPart;
}

export function ComposioPart({ data }: ComposioPartProps) {
  switch (data.tool) {
    case COMPOSIO_TOOLS.workbench:
      return <WorkbenchCard data={data} />;
    case COMPOSIO_TOOLS.search:
      return <SearchToolsCard data={data} />;
    case COMPOSIO_TOOLS.multiExecute:
      return <MultiExecuteCard data={data} />;
    case COMPOSIO_TOOLS.manageConnections:
      return <ManageConnectionsCard data={data} />;
    default:
      return null;
  }
}

// ─── Shared scaffolding ───────────────────────────────────────────────────

function StatusBadge({ state }: { state: ToolState }) {
  if (state.status === "running" || state.status === "pending") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--brand-primary)]">
        <Loader2 className="h-3 w-3 animate-spin" />
        RUNNING
      </span>
    );
  }
  if (state.status === "error") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-danger,#dc2626)]">
        <AlertCircle className="h-3 w-3" />
        ERROR
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
      DONE
    </span>
  );
}

function ToolHeader({
  icon,
  label,
  state,
}: {
  icon: React.ReactNode;
  label: string;
  state: ToolState;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)] bg-[var(--surface-tertiary)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        {icon}
        {label}
      </div>
      <StatusBadge state={state} />
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--surface-secondary)] px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)]"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto px-3 py-3 text-[12px] leading-snug font-mono text-[var(--text-primary)] bg-[var(--surface-secondary)] whitespace-pre">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

// ─── Renderers ────────────────────────────────────────────────────────────

function WorkbenchCard({ data }: { data: ToolPart }) {
  const input = (data.state.input ?? {}) as Record<string, unknown>;
  const code = typeof input.code === "string" ? input.code : "";
  const output = data.state.output ?? "";
  const [outputExpanded, setOutputExpanded] = useState(false);

  const outputPreview = useMemo(() => {
    if (!output) return "";
    const lines = output.split("\n");
    return lines.length > 40 ? lines.slice(0, 40).join("\n") : output;
  }, [output]);

  const shouldTruncate = output.split("\n").length > 40;

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] overflow-hidden my-2">
      <ToolHeader
        icon={<Terminal className="h-3.5 w-3.5 text-[var(--brand-primary)]" />}
        label="COMPOSIO_WORKBENCH"
        state={data.state}
      />

      {code ? (
        <CodeBlock code={code} language="python" />
      ) : (
        <div className="px-3 py-2 text-[12px] text-[var(--text-tertiary)] italic">
          (no code provided)
        </div>
      )}

      {output && (
        <div className="border-t border-[var(--border-default)]">
          <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)] bg-[var(--surface-tertiary)]">
            Output
          </div>
          <pre className="overflow-x-auto px-3 py-2 text-[12px] leading-snug font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words">
            {outputExpanded || !shouldTruncate ? output : outputPreview}
          </pre>
          {shouldTruncate && (
            <button
              type="button"
              onClick={() => setOutputExpanded((v) => !v)}
              className="w-full border-t border-[var(--border-default)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)] flex items-center justify-center gap-1"
            >
              {outputExpanded ? (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3" />
                  Show all {output.split("\n").length} lines
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SearchToolsCard({ data }: { data: ToolPart }) {
  const input = (data.state.input ?? {}) as Record<string, unknown>;
  const query =
    (typeof input.query === "string" && input.query) ||
    (typeof input.task === "string" && input.task) ||
    (typeof input.description === "string" && input.description) ||
    "";

  const discovered = useMemo(() => extractDiscoveredTools(data.state.output), [
    data.state.output,
  ]);

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] overflow-hidden my-2">
      <ToolHeader
        icon={<Search className="h-3.5 w-3.5 text-[var(--brand-primary)]" />}
        label="COMPOSIO_SEARCH_TOOLS"
        state={data.state}
      />
      {query && (
        <div className="px-3 py-2 text-[12px] text-[var(--text-primary)]">
          <span className="text-[var(--text-tertiary)]">query: </span>
          <span className="font-mono">{query}</span>
        </div>
      )}
      {discovered.length > 0 && (
        <div className="border-t border-[var(--border-default)] px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
            Discovered ({discovered.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {discovered.slice(0, 12).map((slug) => (
              <span
                key={slug}
                className="rounded-md border border-[var(--border-default)] bg-[var(--surface-tertiary)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--text-secondary)]"
              >
                {slug}
              </span>
            ))}
            {discovered.length > 12 && (
              <span className="text-[11px] text-[var(--text-tertiary)] self-center">
                +{discovered.length - 12} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MultiExecuteCard({ data }: { data: ToolPart }) {
  const input = (data.state.input ?? {}) as Record<string, unknown>;
  const actionsRaw = input.actions ?? input.tools ?? input.calls ?? [];
  const actions = Array.isArray(actionsRaw) ? actionsRaw : [];

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] overflow-hidden my-2">
      <ToolHeader
        icon={<Zap className="h-3.5 w-3.5 text-[var(--brand-primary)]" />}
        label="COMPOSIO_MULTI_EXECUTE"
        state={data.state}
      />
      {actions.length > 0 ? (
        <ul className="divide-y divide-[var(--border-default)]">
          {actions.map((action, i) => {
            const slug =
              (typeof action === "object" && action !== null &&
                ((action as Record<string, unknown>).slug as string)) ||
              (typeof action === "object" && action !== null &&
                ((action as Record<string, unknown>).tool as string)) ||
              `action_${i}`;
            return (
              <li
                key={i}
                className="px-3 py-2 text-[12px] font-mono text-[var(--text-secondary)]"
              >
                {String(slug)}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-3 py-2 text-[12px] text-[var(--text-tertiary)]">
          {data.state.output || "(no actions)"}
        </div>
      )}
    </div>
  );
}

function ManageConnectionsCard({ data }: { data: ToolPart }) {
  const input = (data.state.input ?? {}) as Record<string, unknown>;
  const toolkit =
    (typeof input.toolkit === "string" && input.toolkit) ||
    (typeof input.app === "string" && input.app) ||
    "app";

  const authUrl = useMemo(() => extractAuthUrl(data.state.output), [
    data.state.output,
  ]);

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] overflow-hidden my-2">
      <ToolHeader
        icon={<Link2 className="h-3.5 w-3.5 text-[var(--brand-primary)]" />}
        label="COMPOSIO_MANAGE_CONNECTIONS"
        state={data.state}
      />
      <div className="px-3 py-2 text-[12px] text-[var(--text-primary)] flex items-center justify-between gap-3">
        <span>
          <span className="text-[var(--text-tertiary)]">Connect </span>
          <span className="font-mono">{toolkit}</span>
        </span>
        {authUrl && (
          <button
            type="button"
            onClick={() => window.open(authUrl, "_blank", "noopener,noreferrer")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium",
              "border border-[var(--brand-primary)] text-[var(--brand-primary)]",
              "hover:bg-[var(--brand-primary)] hover:text-white transition-colors",
            )}
          >
            Connect <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Output parsing helpers ───────────────────────────────────────────────

function extractDiscoveredTools(output: string | null): string[] {
  if (!output) return [];
  // Composio search results vary by version. Try parsing JSON; fall back to
  // grepping uppercase action slugs out of the raw text.
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) {
      return parsed
        .map((row) =>
          typeof row === "object" && row !== null
            ? ((row as Record<string, unknown>).slug as string) ||
              ((row as Record<string, unknown>).name as string) ||
              ""
            : String(row),
        )
        .filter(Boolean);
    }
    const tools = (parsed as Record<string, unknown>).tools;
    if (Array.isArray(tools)) {
      return tools
        .map((row) =>
          typeof row === "object" && row !== null
            ? ((row as Record<string, unknown>).slug as string) ||
              ((row as Record<string, unknown>).name as string) ||
              ""
            : String(row),
        )
        .filter(Boolean);
    }
  } catch {
    // not JSON
  }
  const slugs = output.match(/\b[A-Z][A-Z0-9_]{5,}\b/g) ?? [];
  return Array.from(new Set(slugs));
}

function extractAuthUrl(output: string | null): string | null {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    const url =
      (typeof parsed.auth_url === "string" && parsed.auth_url) ||
      (typeof parsed.redirect_url === "string" && parsed.redirect_url) ||
      (typeof parsed.url === "string" && parsed.url) ||
      "";
    if (url) return url;
  } catch {
    // not JSON
  }
  const match = output.match(/https?:\/\/[^\s"')<>]+/);
  return match ? match[0] : null;
}
