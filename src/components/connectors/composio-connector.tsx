"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  LogOut,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  ConnectorCard,
  type ConnectorCardStatus,
} from "@/components/connectors/connector-card";
import { ConnectorTile } from "@/components/connectors/connector-tile";
import { ConnectorDetailDialog } from "@/components/connectors/connector-detail-dialog";
import {
  useComposioConnect,
  useComposioConnectStatus,
  useComposioDisconnect,
  useComposioTools,
  useToggleComposioActions,
  type ComposioActionCategory,
  type ComposioStatus,
  type ComposioTool,
  type ComposioToolkit,
} from "@/hooks/use-composio";
import { useQueryClient } from "@tanstack/react-query";

// Resolve an iconKey to a URL.
// - "/icons/foo.svg" or "http(s)://…" → returned verbatim (locally-hosted or absolute)
// - "set/name?color=ffffff"          → iconify URL with hex color URL-encoded as
//   `%23ffffff` so the API emits a valid `fill="#ffffff"`. Without the `%23`,
//   iconify returns `fill="ffffff"` which browsers treat as invalid and render black.
// - "set/name"                       → iconify URL.
function iconifyUrl(iconKey: string): string {
  if (iconKey.startsWith("/") || iconKey.startsWith("http://") || iconKey.startsWith("https://")) {
    return iconKey;
  }
  const qIdx = iconKey.indexOf("?");
  if (qIdx === -1) return `https://api.iconify.design/${iconKey}.svg`;
  const path = iconKey.slice(0, qIdx);
  const query = iconKey.slice(qIdx + 1).replace(/color=([0-9a-fA-F]{3,8})\b/g, "color=%23$1");
  return `https://api.iconify.design/${path}.svg?${query}`;
}
import { queryKeys } from "@/lib/constants";
import type { ComposioToolkitMeta } from "@/lib/composio-toolkits";

type Props = {
  meta: ComposioToolkitMeta;
  toolkit: ComposioToolkit;
};

/**
 * Single Composio toolkit card. Disconnected → "Connect" (or scheme picker
 * when the toolkit supports both OAuth and API key). Connecting → opens an
 * OAuth popup or submits the API key, then polls /status until ACTIVE.
 * Connected → green dot + Disconnect.
 */
export function ComposioConnector({ meta, toolkit }: Props) {
  const qc = useQueryClient();
  const connectMutation = useComposioConnect();
  const disconnectMutation = useComposioDisconnect();

  const [scheme, setScheme] = useState<"OAUTH2" | "API_KEY">(meta.schemes[0]);
  const [apiKey, setApiKey] = useState("");
  const [connectionRequestId, setConnectionRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  const statusQuery = useComposioConnectStatus(
    meta.id,
    connectionRequestId,
    /* poll */ true,
  );

  // When polling shows ACTIVE or FAILED, surface and refresh the catalog.
  useEffect(() => {
    if (!connectionRequestId || !statusQuery.data) return;
    const s = statusQuery.data.status;
    if (s === "ACTIVE") {
      setConnectionRequestId(null);
      popupRef.current?.close();
      popupRef.current = null;
      qc.invalidateQueries({ queryKey: queryKeys.composio.toolkits });
    } else if (s === "FAILED") {
      setConnectionRequestId(null);
      setError(statusQuery.data.error ?? "Connection failed.");
      popupRef.current?.close();
      popupRef.current = null;
    }
  }, [statusQuery.data, connectionRequestId, qc]);

  // Listen for the callback page's postMessage (faster than polling).
  useEffect(() => {
    if (!connectionRequestId) return;
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.connector !== "composio" || data.toolkit !== meta.id) return;
      if (data.type === "connector-auth-complete") {
        qc.invalidateQueries({ queryKey: queryKeys.composio.toolkits });
      } else if (data.type === "connector-auth-error") {
        setError(typeof data.error === "string" ? data.error : "Authorization failed.");
        setConnectionRequestId(null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [connectionRequestId, meta.id, qc]);

  const handleConnect = async () => {
    setError(null);
    try {
      const result = await connectMutation.mutateAsync({
        toolkit: meta.id,
        auth_scheme: scheme,
        api_key: scheme === "API_KEY" ? apiKey.trim() : undefined,
      });
      if (result.auth_url) {
        popupRef.current = window.open(
          result.auth_url,
          "_blank",
          "popup,width=600,height=720,noopener",
        );
      }
      setConnectionRequestId(result.connection_request_id);
      if (!result.auth_url) {
        // API-key path — invalidate immediately so status query picks it up.
        qc.invalidateQueries({ queryKey: queryKeys.composio.toolkits });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start authorization.");
    }
  };

  const handleDisconnect = async () => {
    if (!toolkit.connected_account_id) return;
    setError(null);
    try {
      await disconnectMutation.mutateAsync({
        toolkit: meta.id,
        connected_account_id: toolkit.connected_account_id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed.");
    }
  };

  const connecting = connectMutation.isPending || Boolean(connectionRequestId);
  const isActive = toolkit.status === "ACTIVE";
  const supportsTogglePanel = toolkit.supports_action_prefs;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const cardStatus = mapStatus(toolkit.status);
  const cardStatusLabel =
    toolkit.status === "ACTIVE"
      ? toolkit.scheme
        ? `Connected · ${toolkit.scheme.toLowerCase()}`
        : "Connected"
      : undefined;

  const icon = (
    <img
      src={iconifyUrl(meta.iconKey)}
      alt=""
      className="h-5 w-5 object-contain"
      aria-hidden
    />
  );

  const inlineChildren = (
    <>
      {!isActive && (
        <ConnectView
          meta={meta}
          scheme={scheme}
          setScheme={setScheme}
          apiKey={apiKey}
          setApiKey={setApiKey}
        />
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 p-2">
          <AlertCircle className="h-4 w-4 text-[var(--color-destructive)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--text-primary)]">{error}</p>
        </div>
      )}
      {!isActive && toolkit.status === "PENDING" && (
        <p className="text-[10px] text-[var(--text-secondary)]">
          Complete the authorization in the popup, then this card will update automatically.
        </p>
      )}
      {isActive && supportsTogglePanel && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              aria-label="Configure tools"
              title="Configure tools"
              className="w-full justify-center"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Configure tools</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-full max-w-[640px] sm:max-w-[640px] flex flex-col p-0"
          >
            <ActionTogglePanel meta={meta} toolkit={toolkit} />
          </SheetContent>
        </Sheet>
      )}
    </>
  );

  const primaryAction = isActive
    ? {
        label: "Disconnect",
        onClick: handleDisconnect,
        icon: <LogOut className="h-3.5 w-3.5" />,
        loading: disconnectMutation.isPending,
        variant: "ghost" as const,
      }
    : {
        label: connecting
          ? "Connecting…"
          : scheme === "OAUTH2"
            ? `Connect with ${meta.displayName}`
            : "Save API key",
        onClick: handleConnect,
        loading: connecting,
        disabled: scheme === "API_KEY" && !apiKey.trim(),
      };

  return (
    <>
      <ConnectorTile
        icon={icon}
        name={meta.displayName}
        status={cardStatus}
        onClick={() => setDialogOpen(true)}
      />
      <ConnectorDetailDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ConnectorCard
          icon={icon}
          name={meta.displayName}
          description={meta.description}
          status={cardStatus}
          statusLabel={cardStatusLabel}
          primaryAction={primaryAction}
        >
          {inlineChildren}
        </ConnectorCard>
      </ConnectorDetailDialog>
    </>
  );
}

function mapStatus(status: ComposioStatus): ConnectorCardStatus {
  switch (status) {
    case "ACTIVE":
      return "connected";
    case "PENDING":
      return "pending";
    case "FAILED":
      return "failed";
    case "NEEDS_AUTH":
      return "needs_auth";
    default:
      return "disconnected";
  }
}

/**
 * Per-action enable/disable switches for one toolkit, rendered inside a
 * right-side Sheet so the row list has real estate to breathe (the tile
 * grid columns are too narrow for a comfortable read).
 *
 * Fetches the full catalogue (including currently-disabled actions) and
 * groups it into Write / Read sections — exactly the layout the user
 * requested. Each row's switch reflects `enabled`; toggling fires the
 * `useToggleComposioActions` mutation, which optimistically updates the
 * cached tool list so the switch flips instantly.
 *
 * Backend chokepoint: even if a UI bug allowed a stale render,
 * `composio_service.execute_tool` blocks disabled slugs on the agent path.
 */
function ActionTogglePanel({
  meta,
  toolkit,
}: {
  meta: ComposioToolkitMeta;
  toolkit: ComposioToolkit;
}) {
  const toolsQuery = useComposioTools(meta.id);
  const toggleMutation = useToggleComposioActions(meta.id);

  const grouped = useMemo(() => {
    const tools = toolsQuery.data?.tools ?? [];
    const byCategory: Record<ComposioActionCategory | "other", ComposioTool[]> = {
      write: [],
      read: [],
      other: [],
    };
    for (const t of tools) {
      const key: ComposioActionCategory | "other" = t.category ?? "other";
      byCategory[key].push(t);
    }
    for (const key of ["write", "read", "other"] as const) {
      byCategory[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return byCategory;
  }, [toolsQuery.data]);

  const totalEnabled = useMemo(
    () => (toolsQuery.data?.tools ?? []).filter((t) => t.enabled).length,
    [toolsQuery.data],
  );
  const totalActions = toolsQuery.data?.tools.length ?? 0;

  const isEmpty =
    !toolsQuery.isLoading && !toolsQuery.isError && totalActions === 0;

  return (
    <div className="flex h-full flex-col bg-[var(--sidebar-bg)]">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-[var(--border-default)] px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-tertiary)]">
          <img
            src={iconifyUrl(meta.iconKey)}
            alt=""
            className="h-5 w-5 object-contain"
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1 pr-8">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {meta.displayName} actions
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-secondary)]">
            Choose which actions the agent can use. Disabled actions are hidden
            from the agent and blocked at execution.
          </p>
          {toolsQuery.data && totalActions > 0 && (
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
              {totalEnabled} of {totalActions} enabled
              {toolkit.scheme ? ` · ${toolkit.scheme.toLowerCase()}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {toolsQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-[var(--text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2">Loading actions…</span>
          </div>
        ) : toolsQuery.isError ? (
          <div className="rounded-lg border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 p-4 text-sm text-[var(--text-primary)]">
            Failed to load actions.{" "}
            {toolsQuery.error instanceof Error ? toolsQuery.error.message : ""}
          </div>
        ) : isEmpty ? (
          <div className="rounded-lg border border-dashed border-[var(--border-default)] p-6 text-center text-xs text-[var(--text-secondary)]">
            No actions are available for {meta.displayName} yet.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {grouped.write.length > 0 && (
              <ActionGroup
                title="Write actions"
                tools={grouped.write}
                onToggle={(slug, enabled) =>
                  toggleMutation.mutate({ actions: { [slug]: enabled } })
                }
                onBulk={(enabled) =>
                  toggleMutation.mutate({
                    actions: Object.fromEntries(
                      grouped.write.map((t) => [t.slug, enabled]),
                    ),
                  })
                }
              />
            )}
            {grouped.read.length > 0 && (
              <ActionGroup
                title="Read actions"
                tools={grouped.read}
                onToggle={(slug, enabled) =>
                  toggleMutation.mutate({ actions: { [slug]: enabled } })
                }
                onBulk={(enabled) =>
                  toggleMutation.mutate({
                    actions: Object.fromEntries(
                      grouped.read.map((t) => [t.slug, enabled]),
                    ),
                  })
                }
              />
            )}
            {grouped.other.length > 0 && (
              <ActionGroup
                title="Other actions"
                tools={grouped.other}
                onToggle={(slug, enabled) =>
                  toggleMutation.mutate({ actions: { [slug]: enabled } })
                }
                onBulk={(enabled) =>
                  toggleMutation.mutate({
                    actions: Object.fromEntries(
                      grouped.other.map((t) => [t.slug, enabled]),
                    ),
                  })
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionGroup({
  title,
  tools,
  onToggle,
  onBulk,
}: {
  title: string;
  tools: ComposioTool[];
  onToggle: (slug: string, enabled: boolean) => void;
  onBulk: (enabled: boolean) => void;
}) {
  const allEnabled = tools.every((t) => t.enabled);
  const noneEnabled = tools.every((t) => !t.enabled);
  return (
    <section className="flex flex-col">
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            {title}
          </h3>
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {tools.filter((t) => t.enabled).length} / {tools.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onBulk(noneEnabled ? true : !allEnabled)}
          className="text-[10px] font-medium text-[var(--text-tertiary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
        >
          {allEnabled ? "Uncheck all" : "Check all"}
        </button>
      </header>
      <ul className="flex flex-col divide-y divide-[var(--border-default)]/60 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)]">
        {tools.map((t) => (
          <li
            key={t.slug}
            className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--surface-tertiary)]/40"
          >
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[13px] font-medium text-[var(--text-primary)]"
                title={t.slug}
              >
                {t.name || t.slug}
              </p>
              {t.description && (
                <p
                  className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]"
                  title={t.description}
                >
                  {t.description}
                </p>
              )}
            </div>
            <Switch
              checked={t.enabled}
              onCheckedChange={(checked) => onToggle(t.slug, checked)}
              aria-label={`${t.enabled ? "Disable" : "Enable"} ${t.name || t.slug}`}
              className="shrink-0 scale-90"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConnectView({
  meta,
  scheme,
  setScheme,
  apiKey,
  setApiKey,
}: {
  meta: ComposioToolkitMeta;
  scheme: "OAUTH2" | "API_KEY";
  setScheme: (s: "OAUTH2" | "API_KEY") => void;
  apiKey: string;
  setApiKey: (v: string) => void;
}) {
  const multi = meta.schemes.length > 1;

  return (
    <div className="space-y-2">
      {multi && (
        <div className="flex gap-1 rounded-lg bg-[var(--surface-tertiary)] p-0.5 text-xs">
          {meta.schemes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScheme(s)}
              className={`flex-1 rounded px-2 py-1 transition-colors ${
                scheme === s
                  ? "bg-[var(--surface-secondary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {s === "OAUTH2" ? "OAuth" : "API key"}
            </button>
          ))}
        </div>
      )}

      {scheme === "API_KEY" && (
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={`Paste your ${meta.displayName} API key`}
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
        />
      )}
    </div>
  );
}
