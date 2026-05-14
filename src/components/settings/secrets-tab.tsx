"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Eye, EyeOff, Plus, Trash2, Save, RefreshCw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api";
import { API } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  ListSecretsResponse,
  RevealSecretResponse,
} from "@/types/bff";

const KEY_REGEX = /^[A-Z_][A-Z0-9_]*$/;
const INVALID_VALUE_CHARS = /[\n\r\0]/;

interface Row {
  /** Stable client-side id for React keys (survives renames). */
  uid: string;
  /** Original server key, or null when this row was added locally. */
  originalKey: string | null;
  key: string;
  /** Current plaintext value. Empty string until revealed or edited. */
  value: string;
  /** Was the original server entry set (had non-empty value)? */
  wasSet: boolean;
  /** Masked preview from server (shown when not revealed). */
  preview: string | null;
  /** Plaintext fetched / edited locally. */
  hasPlaintext: boolean;
  /** Eye-toggle: show value field as text vs password. */
  revealed: boolean;
  /** Reveal fetch in progress. */
  revealing: boolean;
  /** Row was edited or added — needs PATCH on save. */
  dirty: boolean;
}

interface EntryRowProps {
  row: Row;
  onChange: (uid: string, field: "key" | "value", value: string) => void;
  onDelete: (uid: string) => void;
  onReveal: (uid: string) => void;
}

function EntryRow({ row, onChange, onDelete, onReveal }: EntryRowProps) {
  const showAsText = row.revealed && row.hasPlaintext;
  const placeholder = !row.hasPlaintext && row.wasSet ? row.preview ?? "•••••••" : "value";

  return (
    <div className="flex items-center gap-2 group">
      <Input
        value={row.key}
        onChange={(e) => onChange(row.uid, "key", e.target.value)}
        placeholder="KEY"
        className="font-mono text-xs h-8 w-52 shrink-0 bg-[var(--surface-secondary)] border-[var(--border-default)]"
        spellCheck={false}
      />
      <span className="text-[var(--text-tertiary)] text-xs shrink-0">=</span>
      <div className="relative flex-1">
        <Input
          type={showAsText ? "text" : "password"}
          value={row.value}
          onChange={(e) => onChange(row.uid, "value", e.target.value)}
          placeholder={placeholder}
          className="font-mono text-xs h-8 pr-8 bg-[var(--surface-secondary)] border-[var(--border-default)]"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => onReveal(row.uid)}
          disabled={row.revealing}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-40"
          tabIndex={-1}
          title={row.revealed ? "Hide value" : "Reveal value"}
        >
          {row.revealing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : row.revealed ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={() => onDelete(row.uid)}
        className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--color-destructive)] transition-all shrink-0"
        tabIndex={-1}
        title="Delete entry"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface ApiErrorDetail {
  code?: string;
  message?: string;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body;
    if (body && typeof body === "object" && "detail" in body) {
      const d = (body as { detail: unknown }).detail;
      if (d && typeof d === "object" && "message" in (d as object)) {
        const msg = (d as ApiErrorDetail).message;
        if (typeof msg === "string") return msg;
      }
    }
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

let uidCounter = 0;
const nextUid = () => `row-${++uidCounter}`;

export function SecretsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListSecretsResponse>(API.SECRETS.LIST);
      setRows(
        res.items.map((item) => ({
          uid: nextUid(),
          originalKey: item.key,
          key: item.key,
          value: "",
          wasSet: item.is_set,
          preview: item.preview,
          hasPlaintext: false,
          revealed: false,
          revealing: false,
          dirty: false,
        })),
      );
      setPendingDeletes(new Set());
    } catch (e) {
      setError(extractErrorMessage(e, "Failed to load secrets"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = useCallback(
    (uid: string, field: "key" | "value", value: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.uid !== uid) return r;
          if (field === "key") {
            return { ...r, key: value, dirty: true };
          }
          // field === "value"
          return { ...r, value, hasPlaintext: true, dirty: true };
        }),
      );
    },
    [],
  );

  const handleDelete = useCallback((uid: string) => {
    setRows((prev) => {
      const target = prev.find((r) => r.uid === uid);
      if (target?.originalKey) {
        setPendingDeletes((d) => {
          const next = new Set(d);
          next.add(target.originalKey!);
          return next;
        });
      }
      return prev.filter((r) => r.uid !== uid);
    });
  }, []);

  const handleAdd = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        uid: nextUid(),
        originalKey: null,
        key: "",
        value: "",
        wasSet: false,
        preview: null,
        hasPlaintext: true, // new row: empty value is "the plaintext"
        revealed: false,
        revealing: false,
        dirty: false, // becomes dirty as soon as user types
      },
    ]);
  }, []);

  const handleReveal = useCallback(async (uid: string) => {
    const row = rows.find((r) => r.uid === uid);
    if (!row) return;

    // Already have plaintext (locally edited or previously revealed) — just toggle visibility.
    if (row.hasPlaintext) {
      setRows((prev) =>
        prev.map((r) => (r.uid === uid ? { ...r, revealed: !r.revealed } : r)),
      );
      return;
    }

    // No plaintext yet — fetch it. Only meaningful if the server has a value.
    if (!row.originalKey || !row.wasSet) {
      setRows((prev) =>
        prev.map((r) => (r.uid === uid ? { ...r, revealed: !r.revealed } : r)),
      );
      return;
    }

    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, revealing: true } : r)));
    try {
      const res = await api.get<RevealSecretResponse>(
        API.SECRETS.REVEAL(row.originalKey),
      );
      setRows((prev) =>
        prev.map((r) =>
          r.uid === uid
            ? {
                ...r,
                value: res.value,
                hasPlaintext: true,
                revealed: true,
                revealing: false,
              }
            : r,
        ),
      );
    } catch (e) {
      setError(extractErrorMessage(e, "Failed to reveal value"));
      setRows((prev) =>
        prev.map((r) => (r.uid === uid ? { ...r, revealing: false } : r)),
      );
    }
  }, [rows]);

  // Compute write plan: deletes (originalKey removed or renamed) + patches (dirty rows).
  // Surface client-side validation errors before hitting the network.
  const writePlan = useMemo(() => {
    const deletes = new Set(pendingDeletes);
    const patches: { key: string; value: string }[] = [];
    const errors: string[] = [];
    const seenKeys = new Set<string>();

    for (const r of rows) {
      // Rename: original key was X, new key is Y → delete X.
      if (r.originalKey && r.originalKey !== r.key) {
        deletes.add(r.originalKey);
      }
      if (!r.dirty) continue;
      const key = r.key.trim();
      if (!key) {
        errors.push("Key cannot be empty.");
        continue;
      }
      if (!KEY_REGEX.test(key)) {
        errors.push(`Invalid key "${key}" — must match ^[A-Z_][A-Z0-9_]*$.`);
        continue;
      }
      if (seenKeys.has(key)) {
        errors.push(`Duplicate key "${key}".`);
        continue;
      }
      seenKeys.add(key);
      if (INVALID_VALUE_CHARS.test(r.value)) {
        errors.push(`Value for "${key}" must not contain newline or null bytes.`);
        continue;
      }
      patches.push({ key, value: r.value });
    }

    return { deletes, patches, errors };
  }, [rows, pendingDeletes]);

  const handleSave = useCallback(async () => {
    if (writePlan.errors.length > 0) {
      setError(writePlan.errors[0]);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Order matters when a rename collides: delete the old name first
      // so PATCH of the new name doesn't fight the to-be-removed key.
      await Promise.all(
        [...writePlan.deletes].map((key) => api.delete(API.SECRETS.DELETE(key))),
      );
      await Promise.all(
        writePlan.patches.map(({ key, value }) =>
          api.patch(API.SECRETS.PATCH(key), { value }),
        ),
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Re-fetch so previews / `wasSet` reflect server truth.
      await load();
    } catch (e) {
      setError(extractErrorMessage(e, "Failed to save secrets"));
    } finally {
      setSaving(false);
    }
  }, [writePlan, load]);

  const hasUnsavedChanges =
    writePlan.patches.length > 0 || writePlan.deletes.size > 0;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Secrets</h2>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Environment variables loaded by OpenClaw from{" "}
              <code className="font-mono">~/.openclaw/.env</code>
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-40"
            title="Reload"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </section>

      <Separator />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div className="h-8 w-52 rounded-md bg-[var(--surface-secondary)] animate-pulse" />
              <div className="h-8 flex-1 rounded-md bg-[var(--surface-secondary)] animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-xs text-[var(--text-tertiary)] py-2">
              No entries found. Add one below.
            </p>
          )}
          {rows.map((row) => (
            <EntryRow
              key={row.uid}
              row={row}
              onChange={handleChange}
              onDelete={handleDelete}
              onReveal={handleReveal}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-[var(--color-destructive)]">{error}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={handleAdd}
          disabled={loading}
        >
          <Plus className="h-3.5 w-3.5" />
          Add variable
        </Button>

        <Button
          size="sm"
          className="h-7 text-xs gap-1.5 ml-auto"
          onClick={handleSave}
          disabled={loading || saving || !hasUnsavedChanges}
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Saved
            </>
          ) : saving ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
