"use client";

import { useState } from "react";
import { Loader2, Plug, Unplug, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useHermesProviders,
  useHermesProviderKeySet,
  useHermesProviderKeyClear,
  useHermesProviderLogout,
} from "@/hooks/use-hermes-profile";
import type { HermesProvider } from "@/types/hermes-profile";

export function ProvidersTab({ profile }: { profile: string }) {
  const providers = useHermesProviders(profile);

  if (providers.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  const list = providers.data?.providers ?? [];

  return (
    <section className="space-y-2">
      <p className="text-[11px] text-[var(--text-tertiary)]">
        API-key and OAuth providers wired into this profile&apos;s gateway. Restart after changes for the new credentials to take effect.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {list.map((p) => (
          <ProviderRow key={p.provider_id} profile={profile} provider={p} />
        ))}
        {list.length === 0 && (
          <p className="text-[12px] text-[var(--text-tertiary)] py-4">No providers declared in the hermes manifest.</p>
        )}
      </div>
    </section>
  );
}

function ProviderRow({ profile, provider }: { profile: string; provider: HermesProvider }) {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const setKey = useHermesProviderKeySet(profile);
  const clearKey = useHermesProviderKeyClear(profile);
  const logout = useHermesProviderLogout(profile);

  const onSave = async () => {
    const v = apiKey.trim();
    if (!v) {
      toast.error("API key is required.");
      return;
    }
    try {
      await setKey.mutateAsync({ providerId: provider.provider_id, body: { api_key: v } });
      setApiKey("");
      setExpanded(false);
      toast.success(`${provider.provider_id} key saved. Restart gateway to apply.`);
    } catch (e) {
      toast.error("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const onDisconnect = async () => {
    try {
      if (provider.auth_type === "oauth") {
        await logout.mutateAsync(provider.provider_id);
      } else {
        await clearKey.mutateAsync(provider.provider_id);
      }
      toast.success(`${provider.provider_id} disconnected.`);
    } catch (e) {
      toast.error("Disconnect failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div
      className={
        "rounded-lg border p-3 transition-colors " +
        (provider.configured
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-[var(--border-default)] bg-[var(--surface-primary)]")
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <span className="text-[13px] font-medium text-[var(--text-primary)]">{provider.provider_id}</span>
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">{provider.auth_type}</span>
          {provider.env_key && (
            <code className="text-[10px] font-mono text-[var(--text-tertiary)]">{provider.env_key}</code>
          )}
        </div>
        {provider.configured ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-red-400 hover:text-red-300"
            onClick={onDisconnect}
            disabled={clearKey.isPending || logout.isPending}
          >
            {clearKey.isPending || logout.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Unplug className="h-3 w-3" />
            )}
            Disconnect
          </Button>
        ) : provider.auth_type === "api_key" ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => setExpanded((e) => !e)}
            type="button"
          >
            {expanded ? "Cancel" : "Connect"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-[11px]" disabled>
            <Plug className="h-3 w-3" />
            OAuth (CLI)
          </Button>
        )}
      </div>

      {expanded && !provider.configured && provider.auth_type === "api_key" && (
        <div className="mt-3 space-y-2">
          <label className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">API key</label>
          <div className="relative">
            <Input
              type={reveal ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              spellCheck={false}
              autoComplete="off"
              className="font-mono text-[11px] h-8 pr-8"
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              tabIndex={-1}
            >
              {reveal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="h-7 text-[11px]" onClick={onSave} disabled={setKey.isPending}>
              {setKey.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
