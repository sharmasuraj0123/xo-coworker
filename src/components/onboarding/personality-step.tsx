"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowRight, Loader2, RotateCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useAgentPersona,
  type PersonalityContent,
} from "@/hooks/use-personality-files";

interface PersonalityStepProps {
  /** Current edit state. Lives in OnboardingScreen so Back→Continue preserves edits. */
  content: PersonalityContent | null;
  /** Called with the disk-loaded content on first successful fetch. */
  onInitialLoad: (content: PersonalityContent) => void;
  /** Called on every keystroke / reset. */
  onChange: (content: PersonalityContent) => void;
  /** Called after the persona saves successfully. */
  onNext: () => void;
  /** Called when the user opts out — skip without saving. */
  onSkip: () => void;
}

export function PersonalityStep({
  content,
  onInitialLoad,
  onChange,
  onNext,
  onSkip,
}: PersonalityStepProps) {
  const persona = useAgentPersona();
  const { fields, defaults, supported } = persona;

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed the hoisted state on first successful load.
  useEffect(() => {
    if (persona.content && !content) onInitialLoad(persona.content);
  }, [persona.content, content, onInitialLoad]);

  const baseline = persona.content ?? null;

  const isDirty = useMemo(() => {
    if (!content || !baseline) return {} as Record<string, boolean>;
    return Object.fromEntries(
      fields.map((f) => [f.key, content[f.key] !== baseline[f.key]]),
    ) as Record<string, boolean>;
  }, [content, baseline, fields]);

  // Backend has no persona model (e.g. claude_code) — let the user move on
  // without writing files anywhere.
  if (supported === false) {
    return (
      <div className="flex flex-col">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
          Shape your agent
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          This agent doesn&apos;t use editable personality files. You can
          configure its behavior later from its settings.
        </p>
        <Button className="w-full mt-2" onClick={onNext}>
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Error — checked before loading so a settled error doesn't get
  // swallowed by `!content` (parent's hoisted state stays null on failure).
  if (persona.error) {
    return (
      <div className="flex flex-col">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
          Shape your agent
        </h2>
        <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-destructive)]" />
            <div className="flex-1">
              <p className="text-sm text-[var(--text-primary)]">
                Couldn&apos;t load the agent&apos;s personality files.
              </p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                The agent may still be setting up its workspace. You can skip
                this step and configure your agent later.
              </p>
              <p className="mt-2 text-[10px] text-[var(--text-tertiary)]/70 font-mono">
                {persona.error instanceof Error
                  ? persona.error.message
                  : "Unknown error"}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => persona.refetch()}
                  className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                >
                  Try again
                </button>
                <button
                  onClick={onSkip}
                  className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (persona.isPending || !content) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          Reading agent files…
        </p>
        <button
          onClick={onSkip}
          className="mt-6 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Skip for now
        </button>
      </div>
    );
  }

  const tab = activeTab ?? fields[0]?.key;
  const activeDef = fields.find((f) => f.key === tab) ?? fields[0];
  const activeValue = content[activeDef.key] ?? "";
  const activeDefault = defaults[activeDef.key] ?? activeDef.default;
  const canReset = activeValue !== activeDefault;

  const handleTextareaChange = (value: string) => {
    onChange({ ...content, [activeDef.key]: value });
  };

  const handleReset = () => {
    onChange({ ...content, [activeDef.key]: activeDefault });
  };

  const handleContinue = async () => {
    try {
      setSaving(true);
      // Save silently and advance — during onboarding the persona is applied
      // as part of first-run setup (the gateway is started/restarted when
      // onboarding completes), so we don't nag about restarting here. The
      // post-onboarding persona editor surfaces the restart prompt instead.
      await persona.save(content);
      onNext();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(`Couldn't save agent files: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const multiFile = fields.length > 1;

  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
        Shape your agent
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        {multiFile
          ? "These files define your agent's identity, voice, workspace rules, and what it knows about you. Tweak them now or leave the defaults — you can revisit anytime."
          : "This defines your agent's persona, tone, and boundaries. Tweak it now or leave the default — you can revisit anytime."}
      </p>

      {/* Tabs (only when there's more than one file) */}
      {multiFile && (
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--surface-primary)] border border-[var(--border-default)] mb-3">
          {fields.map((f) => {
            const dirty = isDirty[f.key];
            const active = activeDef.key === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveTab(f.key)}
                className={`relative flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                  active
                    ? "bg-[var(--surface-secondary)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {f.tabLabel}
                  {dirty && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"
                      aria-label="unsaved changes"
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Caption */}
      <p className="text-xs text-[var(--text-tertiary)] mb-2">
        {activeDef.caption}{" "}
        <span className="font-mono text-[10px] text-[var(--text-tertiary)]/70">
          {activeDef.filename}
        </span>
      </p>

      {/* Editor */}
      <textarea
        value={activeValue}
        onChange={(e) => handleTextareaChange(e.target.value)}
        spellCheck={false}
        className="w-full h-[clamp(9rem,26vh,18rem)] resize-none rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 focus:border-[var(--color-primary)]"
      />

      {/* Reset row */}
      <div className="mt-2 flex justify-end">
        <button
          onClick={handleReset}
          disabled={!canReset}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Reset to default
        </button>
      </div>

      <Button className="w-full mt-5" onClick={handleContinue} disabled={saving}>
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
      <button
        onClick={onSkip}
        className="mt-3 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}
