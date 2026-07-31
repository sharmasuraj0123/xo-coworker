"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API, queryKeys } from "@/lib/constants";

export type ComposioStatus =
  | "ACTIVE"
  | "PENDING"
  | "FAILED"
  | "NEEDS_AUTH"
  | "UNKNOWN";

export type ComposioToolkit = {
  id: string;
  slug: string;
  display_name: string;
  schemes: ("OAUTH2" | "API_KEY")[];
  status: ComposioStatus;
  connected_account_id: string | null;
  scheme: string | null;
  /** Backend gate for the per-action "Configure tools" panel. */
  supports_action_prefs?: boolean;
};

export type ComposioActionCategory = "read" | "write";

export type ComposioTool = {
  slug: string;
  name: string;
  description: string;
  /** JSON-schema for the action's input arguments. Present on every entry. */
  parameters?: Record<string, unknown>;
  /** False only when the user has explicitly disabled this action. */
  enabled: boolean;
  /** Present for toolkits with a Write/Read classification (Google Calendar today). */
  category?: ComposioActionCategory;
};

export type ComposioPrefs = Record<string, boolean>;

type ToolkitsResponse = { toolkits: ComposioToolkit[] };
type ToolsResponse = { tools: ComposioTool[] };
type PrefsResponse = { actions: ComposioPrefs };
type ConnectResponse = {
  auth_url: string | null;
  connection_request_id: string | null;
};
type StatusResponse = {
  status: ComposioStatus;
  connected_account_id: string | null;
  error?: string;
};

export function useComposioToolkits() {
  return useQuery({
    queryKey: queryKeys.composio.toolkits,
    queryFn: () => api.get<ToolkitsResponse>(API.COMPOSIO.TOOLKITS),
    staleTime: 30_000,
  });
}

export function useComposioTools(toolkit: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.composio.tools(toolkit),
    queryFn: () =>
      api.get<ToolsResponse>(API.COMPOSIO.TOOLS(toolkit)),
    enabled,
    staleTime: 60_000,
  });
}

export function useComposioConnect() {
  return useMutation({
    mutationFn: (vars: {
      toolkit: string;
      auth_scheme: "OAUTH2" | "API_KEY";
      api_key?: string;
      redirect_uri?: string;
    }) =>
      api.post<ConnectResponse>(API.COMPOSIO.CONNECT(vars.toolkit), {
        auth_scheme: vars.auth_scheme,
        api_key: vars.api_key,
        redirect_uri: vars.redirect_uri,
      }),
  });
}

export function useComposioConnectStatus(
  toolkit: string,
  connection_request_id: string | null,
  poll = true,
) {
  return useQuery({
    queryKey: [...queryKeys.composio.all, "status", toolkit, connection_request_id],
    queryFn: () =>
      api.get<StatusResponse>(
        `${API.COMPOSIO.STATUS(toolkit)}?connection_request_id=${encodeURIComponent(
          connection_request_id ?? "",
        )}`,
      ),
    enabled: Boolean(connection_request_id),
    refetchInterval: poll && connection_request_id ? 2_000 : false,
  });
}

export function useComposioDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { toolkit: string; connected_account_id: string }) =>
      api.post<{ status: string }>(
        API.COMPOSIO.DISCONNECT(vars.toolkit),
        { connected_account_id: vars.connected_account_id },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.composio.toolkits });
    },
  });
}

export function useComposioInstallIntoGateway() {
  return useMutation({
    mutationFn: (agent: "openclaw" | "hermes") =>
      api.post<{ ok: boolean; restart_required?: boolean; error?: string }>(
        `${API.COMPOSIO.INSTALL_INTO_GATEWAY}?agent=${agent}`,
      ),
  });
}

/**
 * Toggle one or more actions for a toolkit's per-action enable/disable
 * preferences. Body: `{ actions: { SLUG: enabled } }`. Slugs set to `true`
 * are pruned from the on-disk store (enabled is the default).
 *
 * Server returns the updated disabled-slug map. We optimistically update
 * the cached tools list so the Switch flips immediately; on error the
 * onError handler rolls back to the previous data.
 */
export function useToggleComposioActions(toolkit: string) {
  const qc = useQueryClient();
  type Vars = { actions: ComposioPrefs };
  type PrevContext = { previousTools: ToolsResponse | undefined };

  return useMutation<PrefsResponse, Error, Vars, PrevContext>({
    mutationFn: (vars) =>
      api.put<PrefsResponse>(API.COMPOSIO.PREFS(toolkit), { actions: vars.actions }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.composio.tools(toolkit) });
      const previousTools = qc.getQueryData<ToolsResponse>(
        queryKeys.composio.tools(toolkit),
      );
      if (previousTools) {
        qc.setQueryData<ToolsResponse>(queryKeys.composio.tools(toolkit), {
          tools: previousTools.tools.map((t) =>
            vars.actions[t.slug] !== undefined
              ? { ...t, enabled: vars.actions[t.slug] }
              : t,
          ),
        });
      }
      return { previousTools };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousTools) {
        qc.setQueryData(queryKeys.composio.tools(toolkit), ctx.previousTools);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.composio.tools(toolkit) });
      qc.invalidateQueries({ queryKey: queryKeys.composio.prefs(toolkit) });
    },
  });
}
