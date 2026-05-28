"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useHermesMemory,
  useHermesMemoryFile,
  useHermesMemoryPut,
} from "@/hooks/use-hermes-profile";

export function MemoryTab({ profile }: { profile: string }) {
  const list = useHermesMemory(profile);
  const files = useMemo(() => list.data?.files ?? [], [list.data]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && files.length > 0) setSelected(files[0].name);
  }, [files, selected]);

  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">Memory</h2>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            Markdown files under <code className="font-mono">{list.data?.memories_dir ?? "(loading)"}</code>. Picked up automatically on the next session.
          </p>
        </div>
        <button
          onClick={() => list.refetch()}
          disabled={list.isFetching}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-40"
          title="Reload"
          type="button"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", list.isFetching && "animate-spin")} />
        </button>
      </div>

      {list.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
      ) : files.length === 0 ? (
        <p className="text-[12px] text-[var(--text-tertiary)] py-2">No memory files yet.</p>
      ) : (
        <div className="grid grid-cols-[180px_1fr] gap-4">
          <ul className="border-r border-[var(--border-default)] pr-3 space-y-1">
            {files.map((f) => (
              <li key={f.name}>
                <button
                  onClick={() => setSelected(f.name)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-md text-[12px] flex items-center gap-1.5",
                    selected === f.name
                      ? "bg-[var(--sidebar-active)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]",
                  )}
                  type="button"
                >
                  <FileText className="h-3 w-3 text-[var(--text-tertiary)] shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <div>{selected ? <MemoryEditor profile={profile} filename={selected} /> : null}</div>
        </div>
      )}
    </section>
  );
}

function MemoryEditor({ profile, filename }: { profile: string; filename: string }) {
  const file = useHermesMemoryFile(profile, filename);
  const put = useHermesMemoryPut(profile);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setContent(file.data?.content ?? "");
    setDirty(false);
  }, [file.data, filename]);

  const onSave = async () => {
    try {
      await put.mutateAsync({ filename, body: { content } });
      setDirty(false);
      toast.success(`${filename} saved.`);
    } catch (e) {
      toast.error("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  if (file.isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{filename}</span>
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
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
        rows={14}
        spellCheck={false}
        className={cn(
          "w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 py-2",
          "font-mono text-[12px] leading-relaxed text-[var(--text-primary)]",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] resize-y",
        )}
      />
    </div>
  );
}
