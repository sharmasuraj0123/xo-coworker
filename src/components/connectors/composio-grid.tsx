"use client";

import { Cpu } from "lucide-react";
import { ComposioConnector } from "@/components/connectors/composio-connector";
import {
  useComposioInstallIntoGateway,
  useComposioToolkits,
} from "@/hooks/use-composio";
import { COMPOSIO_TOOLKITS } from "@/lib/composio-toolkits";
import { Button } from "@/components/ui/button";

type CardsProps = { search?: string };

/**
 * Composio cards only — no banner, no grid wrapper. Returns a Fragment so the
 * parent grid lays them out alongside other connector cards.
 */
export function ComposioCards({ search = "" }: CardsProps) {
  const { data, isLoading, error } = useComposioToolkits();

  if (isLoading || error) return null;

  const byId = new Map((data?.toolkits ?? []).map((t) => [t.id, t]));
  const q = search.trim().toLowerCase();
  // The backend TOOLKITS map is authoritative: a toolkit it no longer serves
  // would 400 on /connect, so never render a card for it.
  const cards = COMPOSIO_TOOLKITS.filter((m) => {
    if (!byId.has(m.id)) return false;
    if (!q) return true;
    return (
      m.displayName.toLowerCase().includes(q) ||
      m.id.includes(q) ||
      m.description.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {cards.map((meta) => (
        <ComposioConnector key={meta.id} meta={meta} toolkit={byId.get(meta.id)!} />
      ))}
    </>
  );
}

export function ComposioProviderNotice() {
  const install = useComposioInstallIntoGateway();
  return <ProviderNotice install={install} />;
}

/**
 * Tools execute in the chat only when the active provider can route to
 * Composio's MCP server. claude_code wires it automatically per session;
 * openclaw and hermes need a one-time install into the gateway config.
 */
function ProviderNotice({
  install,
}: {
  install: ReturnType<typeof useComposioInstallIntoGateway>;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] p-3 space-y-2 text-xs text-[var(--text-secondary)]">
      <div className="flex items-start gap-2">
        <Cpu className="h-4 w-4 text-[var(--text-primary)] shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="text-[var(--text-primary)] font-medium">How tools reach the agent</p>
          <p>
            On the <strong>Claude</strong> provider, Composio tools are wired automatically every
            chat turn. On <strong>OpenClaw</strong> and <strong>Hermes</strong>, install Composio
            once into the gateway config; restart the gateway to pick it up.
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => install.mutate("openclaw")}
              disabled={install.isPending}
            >
              Install into OpenClaw
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => install.mutate("hermes")}
              disabled={install.isPending}
            >
              Install into Hermes
            </Button>
          </div>
          {install.data?.ok && (
            <p className="text-emerald-600 dark:text-emerald-400">
              Installed. Restart the gateway to activate.
            </p>
          )}
          {install.data?.ok && install.data.multi_tenant_warning && (
            <p className="text-amber-600 dark:text-amber-400">
              {install.data.multi_tenant_warning}
            </p>
          )}
          {install.data && !install.data.ok && (
            <p className="text-amber-600 dark:text-amber-400">
              {install.data.error ?? "Install failed."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
