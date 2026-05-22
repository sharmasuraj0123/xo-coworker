"use client";

import { Loader2, Play, Square, RotateCw, Circle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useHermesGateway,
  useHermesGatewayStart,
  useHermesGatewayStop,
  useHermesGatewayRestart,
  useHermesInsights,
} from "@/hooks/use-hermes-profile";
import type { HermesGatewayProbe } from "@/types/hermes-profile";

const fmt = new Intl.NumberFormat();

function formatApiError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function ProbeBadge({ probe }: { probe: HermesGatewayProbe }) {
  const color = {
    up: "text-emerald-500",
    unauthorized: "text-amber-500",
    down: "text-red-500",
    unknown: "text-[var(--text-tertiary)]",
  }[probe];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
      <Circle className={`h-2 w-2 fill-current ${color}`} />
      <span className="text-[var(--text-secondary)]">{probe}</span>
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-[11px] text-[var(--text-tertiary)]">{label}</dt>
      <dd className="text-[12px] font-mono text-[var(--text-primary)]">{value}</dd>
    </>
  );
}

export function OverviewTab({ profile }: { profile: string }) {
  const gateway = useHermesGateway(profile);
  const start = useHermesGatewayStart(profile);
  const stop = useHermesGatewayStop(profile);
  const restart = useHermesGatewayRestart(profile);
  const insights = useHermesInsights(profile, 30);

  const onAction = (
    mutation: { mutateAsync: () => Promise<unknown>; isPending: boolean },
    verb: string,
  ) => async () => {
    try {
      await mutation.mutateAsync();
      toast.success(`Gateway ${verb}.`);
    } catch (e) {
      toast.error(`Gateway ${verb} failed: ${formatApiError(e)}`);
    }
  };

  const entry = gateway.data?.entry;
  const probe = gateway.data?.probe ?? "unknown";
  const managedBy = gateway.data?.managed_by ?? "—";
  const running = Boolean(entry?.alive || entry?.listening || entry?.running);
  const startedAt =
    typeof entry?.started_at === "number" ? new Date(entry.started_at * 1000).toLocaleString() : "—";

  return (
    <div className="flex flex-col gap-6">
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">Gateway</h2>
        {gateway.data && <ProbeBadge probe={probe} />}
      </div>

      {gateway.isLoading ? (
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Probing…
        </div>
      ) : gateway.data ? (
        <>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 gap-x-3 mb-4">
            <Row label="Managed by" value={managedBy} />
            <Row label="Port" value={entry?.port ?? "—"} />
            <Row label="PID" value={entry?.pid ?? "—"} />
            <Row label="Running" value={running ? "yes" : "no"} />
            <Row label="Started" value={startedAt} />
          </dl>

          <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-default)]">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-[11px]"
              onClick={onAction(start, "started")}
              disabled={start.isPending || running}
            >
              {start.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-[11px]"
              onClick={onAction(stop, "stopped")}
              disabled={stop.isPending || !running}
            >
              {stop.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
              Stop
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-[11px] ml-auto"
              onClick={onAction(restart, "restarted")}
              disabled={restart.isPending}
            >
              {restart.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
              Restart
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[12px] text-[var(--text-tertiary)]">Gateway status unavailable.</p>
      )}
    </section>

    {/* ── Activity (rich insights from hermes engine — last 30 days) ──────── */}
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">Activity</h2>
        <span className="text-[10px] text-[var(--text-tertiary)]">last 30 days</span>
      </div>

      {insights.isLoading ? (
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : insights.data && !insights.data.empty ? (
        <>
          {/* Headline stats */}
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 gap-x-3 mb-4">
            <Row label="Sessions" value={fmt.format(insights.data.overview.total_sessions ?? 0)} />
            <Row label="Messages" value={fmt.format(insights.data.overview.total_messages ?? 0)} />
            <Row label="Tool calls" value={fmt.format(insights.data.overview.total_tool_calls ?? 0)} />
            <Row label="Input tokens" value={fmt.format(insights.data.overview.total_input_tokens ?? 0)} />
            <Row label="Output tokens" value={fmt.format(insights.data.overview.total_output_tokens ?? 0)} />
            <Row label="Cache read" value={fmt.format(insights.data.overview.total_cache_read_tokens ?? 0)} />
          </dl>

          {/* Platforms — sessions + messages per platform */}
          {insights.data.platforms.length > 0 && (
            <div className="mt-2 mb-4">
              <p className="text-[11px] text-[var(--text-tertiary)] mb-1.5">Platforms</p>
              <div className="space-y-1">
                {insights.data.platforms.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between text-[12px]">
                    <span className="font-mono text-[var(--text-secondary)]">{p.platform}</span>
                    <span className="text-[var(--text-tertiary)]">
                      {p.sessions} sess · {p.messages} msgs · {fmt.format(p.total_tokens)} tok
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top tools — call counts with percent share */}
          {insights.data.tools.length > 0 && (
            <div>
              <p className="text-[11px] text-[var(--text-tertiary)] mb-1.5">Top tools</p>
              <div className="space-y-1">
                {insights.data.tools.slice(0, 6).map((t) => (
                  <div key={t.tool} className="flex items-center justify-between text-[12px]">
                    <span className="font-mono text-[var(--text-secondary)]">{t.tool}</span>
                    <span className="text-[var(--text-tertiary)]">
                      {t.count} ({t.percentage.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-[12px] text-[var(--text-tertiary)]">No activity in the last 30 days.</p>
      )}
    </section>
    </div>
  );
}
