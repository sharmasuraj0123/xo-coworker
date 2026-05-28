"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API, queryKeys } from "@/lib/constants";
import type {
  HermesChannelAddBody,
  HermesChannelMutationResponse,
  HermesChannelsResponse,
  HermesConfig,
  HermesConfigSetBody,
  HermesConfigSetResponse,
  HermesGatewayActionResponse,
  HermesGatewayStatus,
  HermesMemoryFileResponse,
  HermesMemoryListResponse,
  HermesMemoryPutBody,
  HermesMemoryPutResponse,
  HermesInsightsResponse,
  HermesModelsResponse,
  HermesProviderKeyBody,
  HermesProviderKeyClearResponse,
  HermesProviderKeyResponse,
  HermesProvidersResponse,
  HermesSecretsKeysResponse,
  HermesSecretsPutBody,
  HermesSecretsPutResponse,
  HermesSecretsResponse,
  HermesSoulPutBody,
  HermesSoulPutResponse,
  HermesSoulResponse,
} from "@/types/hermes-profile";

/* ── Gateway ─────────────────────────────────────────────────────────────── */

export function useHermesGateway(profile: string | null) {
  return useQuery({
    queryKey: profile ? queryKeys.hermes.gateway(profile) : ["hermes", "profile", "_disabled"],
    queryFn: () => api.get<HermesGatewayStatus>(API.HERMES.GATEWAY(profile!)),
    enabled: Boolean(profile),
    refetchInterval: 5_000,
  });
}

function useGatewayLifecycle(
  profile: string,
  url: (p: string) => string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<HermesGatewayActionResponse>(url(profile)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.gateway(profile) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.models(profile) });
    },
  });
}

export const useHermesGatewayStart   = (p: string) => useGatewayLifecycle(p, API.HERMES.GATEWAY_START);
export const useHermesGatewayStop    = (p: string) => useGatewayLifecycle(p, API.HERMES.GATEWAY_STOP);
export const useHermesGatewayRestart = (p: string) => useGatewayLifecycle(p, API.HERMES.GATEWAY_RESTART);

/* ── Config ──────────────────────────────────────────────────────────────── */

export function useHermesConfig(profile: string | null) {
  return useQuery({
    queryKey: profile ? queryKeys.hermes.config(profile) : ["hermes", "profile", "_disabled"],
    queryFn: () => api.get<HermesConfig>(API.HERMES.CONFIG(profile!)),
    enabled: Boolean(profile),
    // 404 means config.yaml hasn't been created yet — that's expected,
    // don't keep retrying.
    retry: false,
  });
}

export function useHermesConfigSet(profile: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: HermesConfigSetBody) =>
      api.put<HermesConfigSetResponse>(API.HERMES.CONFIG(profile), body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.config(profile) });
    },
  });
}

/* ── Channels ────────────────────────────────────────────────────────────── */

export function useHermesChannels(profile: string | null) {
  return useQuery({
    queryKey: profile ? queryKeys.hermes.channels(profile) : ["hermes", "profile", "_disabled"],
    queryFn: () => api.get<HermesChannelsResponse>(API.HERMES.CHANNELS(profile!)),
    enabled: Boolean(profile),
  });
}

export function useHermesChannelAdd(profile: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: HermesChannelAddBody) =>
      api.post<HermesChannelMutationResponse>(API.HERMES.CHANNELS(profile), body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.channels(profile) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.secrets(profile) });
    },
  });
}

export function useHermesChannelRemove(profile: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) =>
      api.delete<HermesChannelMutationResponse>(API.HERMES.CHANNEL(profile, platform)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.channels(profile) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.secrets(profile) });
    },
  });
}

/* ── Providers ───────────────────────────────────────────────────────────── */

export function useHermesProviders(profile: string | null) {
  return useQuery({
    queryKey: profile ? queryKeys.hermes.providers(profile) : ["hermes", "profile", "_disabled"],
    queryFn: () => api.get<HermesProvidersResponse>(API.HERMES.PROVIDERS(profile!)),
    enabled: Boolean(profile),
  });
}

export function useHermesProviderKeySet(profile: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ providerId, body }: { providerId: string; body: HermesProviderKeyBody }) =>
      api.post<HermesProviderKeyResponse>(API.HERMES.PROVIDER_KEY(profile, providerId), body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.providers(profile) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.secrets(profile) });
    },
  });
}

export function useHermesProviderKeyClear(profile: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) =>
      api.delete<HermesProviderKeyClearResponse>(API.HERMES.PROVIDER_KEY(profile, providerId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.providers(profile) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.secrets(profile) });
    },
  });
}

export function useHermesProviderLogout(profile: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) =>
      api.post(API.HERMES.PROVIDER_LOGOUT(profile, providerId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.providers(profile) });
    },
  });
}

/* ── Secrets ─────────────────────────────────────────────────────────────── */

export function useHermesSecrets(profile: string | null) {
  return useQuery({
    queryKey: profile ? queryKeys.hermes.secrets(profile) : ["hermes", "profile", "_disabled"],
    queryFn: () => api.get<HermesSecretsResponse>(API.HERMES.SECRETS(profile!)),
    enabled: Boolean(profile),
  });
}

export function useHermesSecretsKeys(profile: string | null) {
  return useQuery({
    queryKey: profile ? [...queryKeys.hermes.secrets(profile), "keys"] : ["hermes", "profile", "_disabled"],
    queryFn: () => api.get<HermesSecretsKeysResponse>(API.HERMES.SECRETS_KEYS(profile!)),
    enabled: Boolean(profile),
  });
}

export function useHermesSecretsPut(profile: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: HermesSecretsPutBody) =>
      api.put<HermesSecretsPutResponse>(API.HERMES.SECRETS(profile), body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.secrets(profile) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.providers(profile) });
    },
  });
}

/* ── Persona / SOUL.md ───────────────────────────────────────────────────── */

export function useHermesSoul(profile: string | null) {
  return useQuery({
    queryKey: profile ? queryKeys.hermes.soul(profile) : ["hermes", "profile", "_disabled"],
    queryFn: () => api.get<HermesSoulResponse>(API.HERMES.SOUL(profile!)),
    enabled: Boolean(profile),
  });
}

export function useHermesSoulPut(profile: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: HermesSoulPutBody) =>
      api.put<HermesSoulPutResponse>(API.HERMES.SOUL(profile), body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.soul(profile) });
    },
  });
}

/* ── Memory ──────────────────────────────────────────────────────────────── */

export function useHermesMemory(profile: string | null) {
  return useQuery({
    queryKey: profile ? queryKeys.hermes.memory(profile) : ["hermes", "profile", "_disabled"],
    queryFn: () => api.get<HermesMemoryListResponse>(API.HERMES.MEMORY(profile!)),
    enabled: Boolean(profile),
  });
}

export function useHermesMemoryFile(profile: string | null, filename: string | null) {
  return useQuery({
    queryKey:
      profile && filename
        ? queryKeys.hermes.memoryFile(profile, filename)
        : ["hermes", "profile", "_disabled"],
    queryFn: () => api.get<HermesMemoryFileResponse>(API.HERMES.MEMORY_FILE(profile!, filename!)),
    enabled: Boolean(profile && filename),
  });
}

export function useHermesMemoryPut(profile: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ filename, body }: { filename: string; body: HermesMemoryPutBody }) =>
      api.put<HermesMemoryPutResponse>(API.HERMES.MEMORY_FILE(profile, filename), body),
    onSuccess: (_, { filename }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.memory(profile) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hermes.memoryFile(profile, filename) });
    },
  });
}

/* ── Models proxy ────────────────────────────────────────────────────────── */

export function useHermesModels(profile: string | null) {
  return useQuery({
    queryKey: profile ? queryKeys.hermes.models(profile) : ["hermes", "profile", "_disabled"],
    queryFn: () => api.get<HermesModelsResponse>(API.HERMES.MODELS(profile!)),
    enabled: Boolean(profile),
  });
}

/* ── Insights (rich engine output) ───────────────────────────────────────── */

export function useHermesInsights(profile: string | null, days = 30) {
  return useQuery({
    queryKey: profile ? queryKeys.hermes.insights(profile, days) : ["hermes", "profile", "_disabled"],
    queryFn: () => api.get<HermesInsightsResponse>(API.HERMES.INSIGHTS(profile!, days)),
    enabled: Boolean(profile),
    // Insights run a subprocess on the BE (~200-400ms) and aggregate slow-moving
    // SQL data. No need to refetch aggressively.
    staleTime: 60 * 1000,
  });
}
