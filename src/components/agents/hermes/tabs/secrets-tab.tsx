"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, RefreshCw, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useHermesSecrets, useHermesSecretsPut } from "@/hooks/use-hermes-profile";
import type { HermesEnvEntry } from "@/types/hermes-profile";

export function SecretsTab({ profile }: { profile: string }) {
  const secrets = useHermesSecrets(profile);
  const put = useHermesSecretsPut(profile);
  const [entries, setEntries] = useState<HermesEnvEntry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (secrets.data && !dirty) setEntries(secrets.data.entries);
  }, [secrets.data, dirty]);

  const onChange = (i: number, field: "key" | "value", value: string) => {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
    setDirty(true);
  };
  const onDelete = (i: number) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };
  const onAdd = () => {
    setEntries((prev) => [...prev, { key: "", value: "" }]);
    setDirty(true);
  };

  const onSave = async () => {
    try {
      await put.mutateAsync({ entries: entries.filter((e) => e.key.trim()) });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Secrets saved. Restart gateway to apply.");
    } catch (e) {
      toast.error("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">Secrets</h2>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            Environment variables loaded by this profile&apos;s gateway from{" "}
            <code className="font-mono">{secrets.data?.env_file ?? "(loading)"}</code>
          </p>
        </div>
        <button
          onClick={() => secrets.refetch()}
          disabled={secrets.isFetching}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-40"
          title="Reload"
          type="button"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", secrets.isFetching && "animate-spin")} />
        </button>
      </div>

      {secrets.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
      ) : (
        <>
          <div className="space-y-2">
            {entries.length === 0 && (
              <p className="text-[12px] text-[var(--text-tertiary)] py-2">No entries. Add one below.</p>
            )}
            {entries.map((entry, i) => (
              <EntryRow
                key={i}
                entry={entry}
                index={i}
                onChange={onChange}
                onDelete={onDelete}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={onAdd}
              type="button"
            >
              <Plus className="h-3.5 w-3.5" />
              Add variable
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px] gap-1.5 ml-auto"
              onClick={onSave}
              disabled={!dirty || put.isPending}
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Saved
                </>
              ) : put.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" /> Save
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function EntryRow({
  entry,
  index,
  onChange,
  onDelete,
}: {
  entry: HermesEnvEntry;
  index: number;
  onChange: (i: number, field: "key" | "value", value: string) => void;
  onDelete: (i: number) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex items-center gap-2 group">
      <Input
        value={entry.key}
        onChange={(e) => onChange(index, "key", e.target.value)}
        placeholder="KEY"
        spellCheck={false}
        className="font-mono text-xs h-8 w-52 shrink-0 bg-[var(--surface-secondary)] border-[var(--border-default)]"
      />
      <span className="text-[var(--text-tertiary)] text-xs shrink-0">=</span>
      <div className="relative flex-1">
        <Input
          type={revealed ? "text" : "password"}
          value={entry.value}
          onChange={(e) => onChange(index, "value", e.target.value)}
          placeholder="value"
          spellCheck={false}
          className="font-mono text-xs h-8 pr-8 bg-[var(--surface-secondary)] border-[var(--border-default)]"
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          tabIndex={-1}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      <button
        type="button"
        onClick={() => onDelete(index)}
        className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--color-destructive)] transition-all shrink-0"
        tabIndex={-1}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
