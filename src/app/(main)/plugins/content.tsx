"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plug,
  RotateCw,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { API, IS_DESKTOP, queryKeys } from "@/lib/constants";
import { desktopAPI } from "@/lib/tauri-api";
import {
  usePluginsStatus,
  usePluginDetail,
  usePluginToggle,
  useSkills,
  useSkillToggle,
} from "@/hooks/use-plugins";
import {
  useConnectors,
  useConnectorToggle,
  useConnectorConnect,
  useConnectorDisconnect,
  useConnectorReconnect,
  useSetConnectorToken,
} from "@/hooks/use-connectors";
import type { PluginInfo, SkillInfo } from "@/types/plugins";
import type { ConnectorInfo } from "@/types/connectors";
import { GDriveConnectorTile } from "@/components/connectors/gdrive-connector";
import { OneDriveConnectorTile } from "@/components/connectors/onedrive-connector";
import { GitHubConnectorTile } from "@/components/connectors/github-connector";
import { VercelConnectorTile } from "@/components/connectors/vercel-connector";
import { ManusConnectorTile } from "@/components/connectors/manus-connector";
import { ComposioCards, ComposioProviderNotice } from "@/components/connectors/composio-grid";
import { ConnectorCard, type ConnectorCardStatus } from "@/components/connectors/connector-card";
import { ConnectorTile } from "@/components/connectors/connector-tile";
import { ConnectorDetailDialog } from "@/components/connectors/connector-detail-dialog";

const SOURCE_COLORS: Record<string, string> = {
  builtin: "bg-blue-500/10 text-blue-400",
  global: "bg-amber-500/10 text-amber-400",
  project: "bg-emerald-500/10 text-emerald-400",
  plugin: "bg-purple-500/10 text-purple-400",
  bundled: "bg-blue-500/10 text-blue-400",
  custom: "bg-orange-500/10 text-orange-400",
};

type Tab = "connectors" | "plugins" | "skills";

/* ------------------------------------------------------------------ */
/* Tab content (embedded in Settings)                                  */
/* ------------------------------------------------------------------ */

export function PluginsTabContent() {
  const { t } = useTranslation("plugins");
  const [tab, setTab] = useState<Tab>("connectors");
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border-default)]">
        {(["connectors", "plugins", "skills"] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => { setTab(tabKey); setSearch(""); }}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === tabKey
                ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tabKey === "connectors"
              ? t("connectorsTab")
              : tabKey === "plugins"
                ? t("pluginsTab")
                : t("skills")}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "connectors" ? (
        <ConnectorsTab search={search} />
      ) : tab === "plugins" ? (
        <PluginsTab search={search} />
      ) : (
        <SkillsTab search={search} />
      )}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Connectors Tab                                                      */
/* ------------------------------------------------------------------ */

const STATUS_COLORS: Record<string, string> = {
  connected: "bg-emerald-500",
  needs_auth: "bg-amber-500",
  failed: "bg-red-500",
  disconnected: "bg-[var(--text-tertiary)]",
  disabled: "bg-[var(--text-tertiary)]",
};

function ConnectorsTab({ search }: { search: string }) {
  const { data } = useConnectors();

  const connectors = data?.connectors ?? {};
  const entries = Object.entries(connectors);

  const filtered = search
    ? entries.filter(
        ([id, c]) =>
          id.toLowerCase().includes(search.toLowerCase()) ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.description.toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  const gridClass = "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7";

  return (
    <div className="space-y-4">
      <ComposioProviderNotice />
      <div className={gridClass}>
        <GDriveConnectorTile />
        <OneDriveConnectorTile />
        <GitHubConnectorTile />
        <VercelConnectorTile />
        <ManusConnectorTile />
        {filtered.map(([id, connector]) => (
          <MCPConnectorCard key={id} id={id} connector={connector} />
        ))}
        <ComposioCards search={search} />
      </div>
    </div>
  );
}

function mcpStatus(s: ConnectorInfo["status"]): ConnectorCardStatus {
  switch (s) {
    case "connected":
      return "connected";
    case "needs_auth":
      return "needs_auth";
    case "failed":
      return "failed";
    default:
      return "disconnected";
  }
}

function MCPConnectorCard({
  id,
  connector,
}: {
  id: string;
  connector: ConnectorInfo;
}) {
  const { t } = useTranslation("plugins");
  const toggle = useConnectorToggle();
  const connect = useConnectorConnect();
  const disconnect = useConnectorDisconnect();
  const reconnect = useConnectorReconnect();
  const setToken = useSetConnectorToken();
  const [tokenInput, setTokenInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const isPending =
    toggle.isPending || connect.isPending || disconnect.isPending || reconnect.isPending;

  const qc = useQueryClient();

  const handleConnect = async () => {
    const isGoogle = id === "google-workspace";
    const result = isGoogle
      ? await api.post<{ success: boolean; auth_url?: string; state?: string; error?: string }>(API.GOOGLE.AUTH_START)
      : await connect.mutateAsync(id);

    if (result.success && result.auth_url) {
      if (IS_DESKTOP) {
        await desktopAPI.openExternal(result.auth_url);
        const poll = setInterval(async () => {
          await qc.invalidateQueries({ queryKey: queryKeys.connectors });
        }, 3000);
        setTimeout(() => clearInterval(poll), 300_000);
      } else {
        const popup = window.open(
          result.auth_url,
          "connector-auth",
          "width=600,height=700,menubar=no,toolbar=no",
        );
        const handler = (event: MessageEvent) => {
          if (
            event.data?.type === "connector-auth-complete" ||
            event.data?.type === "mcp-auth-complete"
          ) {
            window.removeEventListener("message", handler);
            qc.invalidateQueries({ queryKey: queryKeys.connectors });
          }
        };
        window.addEventListener("message", handler);
        if (popup) {
          const timer = setInterval(() => {
            if (popup.closed) {
              clearInterval(timer);
              window.removeEventListener("message", handler);
              qc.invalidateQueries({ queryKey: queryKeys.connectors });
            }
          }, 1000);
        }
      }
    }
  };

  const handleToggle = async (checked: boolean) => {
    await toggle.mutateAsync({ id, enable: checked });
    if (checked && (connector.type === "remote" || id === "google-workspace")) {
      await new Promise((r) => setTimeout(r, 500));
      await qc.invalidateQueries({ queryKey: queryKeys.connectors });
      handleConnect();
    } else if (checked) {
      await new Promise((r) => setTimeout(r, 1000));
      await qc.invalidateQueries({ queryKey: queryKeys.connectors });
    }
  };

  const status = mcpStatus(connector.status);
  const description =
    connector.status === "connected" && connector.tools_count > 0
      ? `${connector.description} (${connector.tools_count} ${t("tools")})`
      : connector.description;

  const primaryAction = !connector.enabled
    ? {
        label: t("connect"),
        onClick: () => handleToggle(true),
        loading: toggle.isPending,
      }
    : connector.status === "connected"
      ? {
          label: t("disconnect"),
          onClick: () => disconnect.mutate(id),
          loading: disconnect.isPending,
          variant: "ghost" as const,
        }
      : connector.status === "failed"
        ? {
            label: t("retry"),
            onClick: () => reconnect.mutate(id),
            icon: <RotateCw className="h-3.5 w-3.5" />,
            loading: isPending,
          }
        : {
            label: `Connect with ${connector.name}`,
            onClick: handleConnect,
            loading: isPending,
          };

  const badges = (
    <>
      {connector.type === "local" && id !== "google-workspace" && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
          {t("localSetup")}
        </span>
      )}
      {connector.source === "custom" && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${SOURCE_COLORS.custom}`}>
          {t("custom")}
        </span>
      )}
    </>
  );

  const showTokenForm =
    (connector.status === "needs_auth" || connector.status === "failed") && connector.enabled;

  const icon = <Plug className="h-5 w-5 text-[var(--text-secondary)]" />;

  return (
    <>
      <ConnectorTile
        icon={icon}
        name={connector.name}
        status={status}
        onClick={() => setDialogOpen(true)}
      />
      <ConnectorDetailDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ConnectorCard
          icon={icon}
          name={connector.name}
          description={description}
          status={status}
          badge={badges}
          primaryAction={primaryAction}
        >
          {showTokenForm && (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (tokenInput.trim()) {
                  setToken.mutate({ id, token: tokenInput.trim() });
                  setTokenInput("");
                }
              }}
            >
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={t("tokenPatPlaceholder")}
                className="flex-1 h-7 rounded-md border border-[var(--border-default)] bg-[var(--surface-primary)] px-2 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2.5"
                disabled={!tokenInput.trim() || setToken.isPending}
              >
                {setToken.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
              </Button>
            </form>
          )}
          <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
            <span>{connector.enabled ? "Enabled" : "Disabled"}</span>
            <Switch
              checked={connector.enabled}
              onCheckedChange={handleToggle}
              disabled={toggle.isPending}
            />
          </div>
        </ConnectorCard>
      </ConnectorDetailDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Plugins Tab                                                         */
/* ------------------------------------------------------------------ */

function PluginsTab({ search }: { search: string }) {
  const { t } = useTranslation("plugins");
  const { data, isLoading } = usePluginsStatus();
  const [expanded, setExpanded] = useState<string | null>(null);

  const plugins = data?.plugins ?? {};
  const entries = Object.entries(plugins);
  const enabledCount = entries.filter(([, p]) => p.enabled).length;

  const filtered = search
    ? entries.filter(
        ([name, p]) =>
          name.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  return (
    <>
      {!isLoading && (
        <p className="text-[11px] text-[var(--text-tertiary)] mb-3">
          {t("enabledCount", { count: enabledCount })} / {entries.length}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-[var(--surface-tertiary)] animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)] text-center py-8">
          {t("noPlugins")}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(([name, plugin]) => (
            <PluginCard
              key={name}
              name={name}
              plugin={plugin}
              expanded={expanded === name}
              onToggleExpand={() =>
                setExpanded(expanded === name ? null : name)
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Skills Tab                                                          */
/* ------------------------------------------------------------------ */

function SkillsTab({ search }: { search: string }) {
  const { t } = useTranslation("plugins");
  const { data: skills, isLoading } = useSkills();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-10 rounded-lg bg-[var(--surface-tertiary)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const allSkills = skills ?? [];

  const bundled = allSkills.filter((s) => s.source === "bundled");
  const plugin = allSkills.filter((s) => s.source === "plugin");
  const project = allSkills.filter((s) => s.source === "project");

  const filterSkills = (list: SkillInfo[]) =>
    search
      ? list.filter(
          (s) =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.description.toLowerCase().includes(search.toLowerCase()),
        )
      : list;

  const filteredBundled = filterSkills(bundled);
  const filteredPlugin = filterSkills(plugin);
  const filteredProject = filterSkills(project);

  const total = filteredBundled.length + filteredPlugin.length + filteredProject.length;

  if (total === 0) {
    return (
      <p className="text-xs text-[var(--text-tertiary)] text-center py-8">
        {t("noSkills")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {filteredBundled.length > 0 && (
        <SkillGroup
          title={t("bundledSkills")}
          skills={filteredBundled}
          source="bundled"
        />
      )}
      {filteredPlugin.length > 0 && (
        <SkillGroup
          title={t("pluginSkills")}
          skills={filteredPlugin}
          source="plugin"
        />
      )}
      {filteredProject.length > 0 && (
        <SkillGroup
          title={t("projectSkills")}
          skills={filteredProject}
          source="project"
        />
      )}
    </div>
  );
}

function SkillGroup({
  title,
  skills,
  source,
}: {
  title: string;
  skills: SkillInfo[];
  source: string;
}) {
  const { t } = useTranslation("plugins");
  const toggle = useSkillToggle();

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)]">
          {title}
        </h3>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          ({skills.length})
        </span>
      </div>
      <div className="space-y-1">
        {skills.map((skill) => (
          <div
            key={skill.name}
            className="flex items-center gap-3 rounded-lg border border-[var(--border-default)] p-2.5"
          >
            <div className={`flex items-start gap-3 min-w-0 flex-1 ${!skill.enabled ? "opacity-50" : ""}`}>
              <Sparkles className="h-3.5 w-3.5 text-[var(--text-tertiary)] mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium text-[var(--text-primary)]">
                    {skill.name}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                      SOURCE_COLORS[source] ?? SOURCE_COLORS.bundled
                    }`}
                  >
                    {skill.name.includes(":") ? skill.name.split(":")[0] : t(source, source)}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
                  {skill.description}
                </p>
              </div>
            </div>
            <Switch
              checked={skill.enabled}
              onCheckedChange={(checked) =>
                toggle.mutate({ name: skill.name, enable: checked })
              }
              disabled={toggle.isPending}
              className="shrink-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plugin Card + Detail                                                */
/* ------------------------------------------------------------------ */

function PluginCard({
  name,
  plugin,
  expanded,
  onToggleExpand,
}: {
  name: string;
  plugin: PluginInfo;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { t } = useTranslation("plugins");
  const toggle = usePluginToggle();

  return (
    <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={onToggleExpand}
          className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <span
          className={`h-2 w-2 rounded-full shrink-0 ${
            plugin.enabled ? "bg-emerald-500" : "bg-[var(--text-tertiary)]"
          }`}
        />

        <div className="flex-1 min-w-0" onClick={onToggleExpand} role="button">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {name}
            </p>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {t("version", { version: plugin.version })}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                SOURCE_COLORS[plugin.source] ?? SOURCE_COLORS.builtin
              }`}
            >
              {t(plugin.source)}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5">
            {plugin.description}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-[11px] text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            {plugin.skills_count}
          </span>
          {plugin.mcp_count > 0 && (
            <span className="flex items-center gap-1">
              <Workflow className="h-3 w-3" />
              {plugin.mcp_count}
            </span>
          )}
        </div>

        <Switch
          checked={plugin.enabled}
          onCheckedChange={(checked) =>
            toggle.mutate({ name, enable: checked })
          }
          disabled={toggle.isPending}
          className="shrink-0"
        />
      </div>

      {expanded && <PluginDetailPanel name={name} />}
    </div>
  );
}

function PluginDetailPanel({ name }: { name: string }) {
  const { t } = useTranslation("plugins");
  const { data, isLoading } = usePluginDetail(name);
  const { data: connectorsData } = useConnectors();

  const connectors = connectorsData?.connectors ?? {};

  if (isLoading) {
    return (
      <div className="border-t border-[var(--border-default)] p-3">
        <div className="h-8 rounded bg-[var(--surface-tertiary)] animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const connectorIds = data.connector_ids ?? [];

  return (
    <div className="border-t border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 py-3">
      {/* Skills */}
      {data.skills.length > 0 && (
        <div className="mb-3">
          <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            {t("skills")} ({data.skills.length})
          </h4>
          <div className="space-y-1">
            {data.skills.map((skill) => (
              <div key={skill.name} className="flex gap-2">
                <span className="text-xs font-mono text-[var(--text-primary)] shrink-0">
                  {skill.name}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)] truncate">
                  {skill.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Required connectors */}
      {connectorIds.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            {t("requiredConnectors")} ({connectorIds.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {connectorIds.map((cid) => {
              const connector = connectors[cid];
              const statusColor = connector
                ? STATUS_COLORS[connector.status] ?? STATUS_COLORS.disconnected
                : STATUS_COLORS.disconnected;

              return (
                <span
                  key={cid}
                  className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-primary)] rounded border border-[var(--border-default)] bg-[var(--surface-primary)] px-2 py-1"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
                  {connector?.name ?? cid}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

