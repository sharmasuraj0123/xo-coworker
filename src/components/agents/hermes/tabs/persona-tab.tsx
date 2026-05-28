"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHermesSoul, useHermesSoulPut } from "@/hooks/use-hermes-profile";

export function PersonaTab({ profile }: { profile: string }) {
  const soul = useHermesSoul(profile);
  const put = useHermesSoulPut(profile);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (soul.data && !dirty) setContent(soul.data.content);
  }, [soul.data, dirty]);

  const onSave = async () => {
    try {
      await put.mutateAsync({ content });
      setDirty(false);
      toast.success("Persona saved. Restart gateway to apply.");
    } catch (e) {
      toast.error("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">Persona</h2>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            <code className="font-mono">SOUL.md</code> — the agent&apos;s system prompt. Restart required to apply.
          </p>
        </div>
        <button
          onClick={() => soul.refetch()}
          disabled={soul.isFetching}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-40"
          title="Reload"
          type="button"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", soul.isFetching && "animate-spin")} />
        </button>
      </div>

      {soul.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
      ) : (
        <>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
            rows={16}
            spellCheck={false}
            className={cn(
              "w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 py-2",
              "font-mono text-[12px] leading-relaxed text-[var(--text-primary)]",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] resize-y",
            )}
            placeholder="# Persona for this profile…"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-tertiary)]">
              {soul.data?.exists ? `${soul.data.path}` : "SOUL.md not yet created"}
            </span>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-[11px]"
              onClick={onSave}
              disabled={!dirty || put.isPending}
            >
              {put.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
