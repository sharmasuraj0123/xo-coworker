"use client";

import { useState } from "react";
import { Loader2, Eye, EyeOff, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlackIcon, TelegramIcon, DiscordIcon, WhatsAppIcon } from "@/components/icons/platform-icons";
import { useHermesChannels, useHermesChannelAdd, useHermesChannelRemove } from "@/hooks/use-hermes-profile";

/**
 * Channels tab — manifests live on the BE (`config/agents/hermes/commands.json`).
 * The FE hardcodes only the visible bits: icon, label, field labels.
 *
 * Discord/WhatsApp are kept hidden until the hermes manifest ships matching
 * recipes — connecting them via this tab would write a token the gateway
 * never picks up.
 */

interface ChannelDef {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  fields: { key: string; label: string; placeholder: string }[];
  hidden?: boolean;
}

const CHANNELS: ChannelDef[] = [
  {
    id: "slack",
    name: "Slack",
    icon: <SlackIcon size={18} />,
    color: "text-[#E01E5A]",
    fields: [
      { key: "bot_token", label: "Bot Token", placeholder: "xoxb-…" },
      { key: "app_token", label: "App Token", placeholder: "xapp-…" },
    ],
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: <TelegramIcon size={18} />,
    color: "text-[#26A5E4]",
    fields: [{ key: "token", label: "Bot Token", placeholder: "123456:ABC-DEF…" }],
  },
  { id: "discord", name: "Discord", icon: <DiscordIcon size={18} />, color: "text-[#5865F2]", fields: [], hidden: true },
  { id: "whatsapp", name: "WhatsApp", icon: <WhatsAppIcon size={18} />, color: "text-[#25D366]", fields: [], hidden: true },
];

export function ChannelsTab({ profile }: { profile: string }) {
  const channels = useHermesChannels(profile);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (channels.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  const live = channels.data?.channels ?? {};
  const visible = CHANNELS.filter((c) => !c.hidden);

  return (
    <section className="space-y-2">
      <p className="text-[11px] text-[var(--text-tertiary)]">
        Each profile has its own messaging connections. Restart the gateway after any change for the new tokens to take effect.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {visible.map((c) => {
          const connected = Boolean(live[c.id]);
          return (
            <ChannelRow
              key={c.id}
              profile={profile}
              channel={c}
              connected={connected}
              status={live[c.id]?.status}
              account={live[c.id]?.account ?? null}
              expanded={expanded === c.id}
              onToggle={() => setExpanded((p) => (p === c.id ? null : c.id))}
            />
          );
        })}
      </div>
    </section>
  );
}

function ChannelRow({
  profile,
  channel,
  connected,
  status,
  account,
  expanded,
  onToggle,
}: {
  profile: string;
  channel: ChannelDef;
  connected: boolean;
  status?: string;
  account: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const add = useHermesChannelAdd(profile);
  const remove = useHermesChannelRemove(profile);
  const [values, setValues] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});

  const onSubmit = async () => {
    const extras: Record<string, string> = {};
    for (const f of channel.fields) {
      const v = (values[f.key] || "").trim();
      if (!v) {
        toast.error(`${f.label} is required.`);
        return;
      }
      extras[f.key] = v;
    }
    try {
      await add.mutateAsync({ platform: channel.id, ...extras });
      setValues({});
      onToggle();
      toast.success(`${channel.name} connected. Restart gateway to apply.`);
    } catch (e) {
      toast.error("Connect failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const onRemove = async () => {
    try {
      await remove.mutateAsync(channel.id);
      toast.success(`${channel.name} disconnected.`);
    } catch (e) {
      toast.error("Disconnect failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div
      className={
        "rounded-lg border p-3 transition-colors " +
        (connected
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-[var(--border-default)] bg-[var(--surface-primary)]")
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={channel.color}>{channel.icon}</span>
          <span className="text-[13px] font-medium text-[var(--text-primary)]">{channel.name}</span>
          {connected && <span className="text-[10px] text-emerald-400">{status ?? "connected"}</span>}
          {account && (
            <span className="text-[10px] text-[var(--text-tertiary)] truncate max-w-[200px]" title={account}>
              {account}
            </span>
          )}
        </div>
        {connected ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-red-400 hover:text-red-300"
            onClick={onRemove}
            disabled={remove.isPending}
          >
            {remove.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
            Disconnect
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onToggle} type="button">
            {expanded ? "Cancel" : "Connect"}
          </Button>
        )}
      </div>

      {expanded && !connected && (
        <div className="mt-3 space-y-2">
          {channel.fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">{f.label}</label>
              <div className="relative">
                <Input
                  type={show[f.key] ? "text" : "password"}
                  value={values[f.key] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  spellCheck={false}
                  autoComplete="off"
                  className="font-mono text-[11px] h-8 pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => ({ ...s, [f.key]: !s[f.key] }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  tabIndex={-1}
                >
                  {show[f.key] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button size="sm" className="h-7 text-[11px]" onClick={onSubmit} disabled={add.isPending}>
              {add.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Connect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
