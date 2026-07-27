"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { API } from "@/lib/constants";
import {
  PERSONALITY_FILES,
  PERSONALITY_DEFAULTS,
  SOUL_DEFAULT,
  openclawPersonaFilePath,
} from "@/lib/personality-defaults";
import { useWorkspaceConfig } from "@/hooks/use-workspace-config";
import { useHermesSoul, useHermesSoulPut } from "@/hooks/use-hermes-profile";

/** Persona content keyed by field key (e.g. `soul`, `agents`). */
export type PersonalityContent = Record<string, string>;

/** A single editable persona artifact, rendered as one tab. */
export interface PersonaField {
  key: string;
  /** File name / artifact label shown to the user (e.g. `SOUL.md`). */
  filename: string;
  tabLabel: string;
  caption: string;
  /** Default template used when the file is missing or on "Reset to default". */
  default: string;
}

/**
 * Normalized, backend-aware persona model consumed by the onboarding
 * Personality step and any future persona editor.
 *
 * Each backend owns its own persona storage; this hook hides that difference:
 *   - hermes    → single `SOUL.md` via the per-profile soul endpoint.
 *   - openclaw  → four files in `~/.openclaw/workspace/` via the files API.
 *   - other     → `supported: false` (no persona model; the UI should skip).
 */
export interface AgentPersona {
  backend: string;
  /** False when the active backend has no persona-editing model. */
  supported: boolean;
  /** Ordered fields to render as tabs. */
  fields: PersonaField[];
  /** Loaded content; undefined while pending. */
  content: PersonalityContent | undefined;
  /** Default template per field key. */
  defaults: PersonalityContent;
  isPending: boolean;
  error: Error | null;
  refetch: () => void;
  save: (content: PersonalityContent) => Promise<void>;
  /** True when saving requires a gateway restart to take effect (hermes). */
  restartRequired: boolean;
}

/** Hermes uses the default profile during onboarding. */
const HERMES_PROFILE = "default";

const HERMES_FIELDS: PersonaField[] = [
  {
    key: "soul",
    filename: "SOUL.md",
    tabLabel: "Persona",
    caption:
      "Persona, tone, and boundaries — the agent's system prompt. A gateway restart is required to apply changes.",
    default: SOUL_DEFAULT,
  },
];

const OPENCLAW_FIELDS: PersonaField[] = PERSONALITY_FILES.map((f) => ({
  key: f.key,
  filename: f.filename,
  tabLabel: f.tabLabel,
  caption: f.caption,
  default: PERSONALITY_DEFAULTS[f.key],
}));

const openclawQueryKey = ["persona", "openclaw"] as const;

/**
 * OpenClaw persona: read/write the four workspace files via the files API.
 * Gated by `enabled` so the underlying queries stay idle on other backends
 * (hooks must still be called unconditionally — React rules of hooks).
 */
function useOpenclawPersona(enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: openclawQueryKey,
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PersonalityContent> => {
      const entries = await Promise.all(
        PERSONALITY_FILES.map(async (f) => {
          try {
            const res = await api.post<{ content: string }>(API.FILES.CONTENT, {
              path: openclawPersonaFilePath(f.filename),
            });
            return [f.key, res.content] as const;
          } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
              return [f.key, PERSONALITY_DEFAULTS[f.key]] as const;
            }
            throw err;
          }
        }),
      );
      return Object.fromEntries(entries) as PersonalityContent;
    },
  });

  // Sequential saves — tiny files, easier error attribution.
  const mutation = useMutation({
    mutationFn: async (content: PersonalityContent) => {
      for (const f of PERSONALITY_FILES) {
        await api.post(API.FILES.SAVE, {
          path: openclawPersonaFilePath(f.filename),
          content: content[f.key] ?? PERSONALITY_DEFAULTS[f.key],
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: openclawQueryKey });
    },
  });

  return { query, mutation };
}

export function useAgentPersona(): AgentPersona {
  const { backend, isReady } = useWorkspaceConfig();
  const isHermes = backend === "hermes";
  const isOpenclaw = backend === "openclaw";

  // Call every backend's hooks unconditionally; gate with enabled/profile so
  // only the active backend actually fetches.
  const hermesSoul = useHermesSoul(isReady && isHermes ? HERMES_PROFILE : null);
  const hermesSoulPut = useHermesSoulPut(HERMES_PROFILE);
  const { query: openclawQuery, mutation: openclawMutation } = useOpenclawPersona(
    isReady && isOpenclaw,
  );

  // Backend not resolved yet — report pending so the UI shows a spinner
  // instead of acting on the provisional fallback backend.
  if (!isReady) {
    return {
      backend,
      supported: true,
      fields: [],
      content: undefined,
      defaults: {},
      isPending: true,
      error: null,
      refetch: () => {},
      save: async () => {},
      restartRequired: false,
    };
  }

  if (isHermes) {
    const data = hermesSoul.data;
    const content: PersonalityContent | undefined = data
      ? { soul: data.exists && data.content.trim() ? data.content : SOUL_DEFAULT }
      : undefined;
    return {
      backend,
      supported: true,
      fields: HERMES_FIELDS,
      content,
      defaults: { soul: SOUL_DEFAULT },
      isPending: hermesSoul.isPending,
      error: (hermesSoul.error as Error | null) ?? null,
      refetch: () => void hermesSoul.refetch(),
      save: async (c) => {
        await hermesSoulPut.mutateAsync({ content: c.soul ?? SOUL_DEFAULT });
      },
      restartRequired: true,
    };
  }

  if (isOpenclaw) {
    return {
      backend,
      supported: true,
      fields: OPENCLAW_FIELDS,
      content: openclawQuery.data,
      defaults: PERSONALITY_DEFAULTS,
      isPending: openclawQuery.isPending,
      error: (openclawQuery.error as Error | null) ?? null,
      refetch: () => void openclawQuery.refetch(),
      save: (c) => openclawMutation.mutateAsync(c),
      restartRequired: false,
    };
  }

  // Unknown backend (e.g. claude_code) — no persona-editing model. The UI
  // surfaces this as a skippable step rather than writing files anywhere.
  return {
    backend,
    supported: false,
    fields: [],
    content: {},
    defaults: {},
    isPending: false,
    error: null,
    refetch: () => {},
    save: async () => {},
    restartRequired: false,
  };
}
