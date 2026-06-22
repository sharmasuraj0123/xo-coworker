"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API, queryKeys } from "@/lib/constants";
import type { AgentFullDetail, AgentInfo, CreateAgentRequest, UpdateAgentRequest } from "@/types/agent";

export function useAgents() {
  return useQuery({
    queryKey: queryKeys.agents,
    queryFn: () => api.get<AgentInfo[]>(API.AGENTS),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAgentRequest) => api.post<AgentInfo>(API.AGENTS, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents });
      // The model picker surfaces hermes profiles as models — without
      // this invalidation the picker keeps the stale list for up to 5min
      // (useModels staleTime) and a freshly-created agent looks missing.
      void queryClient.invalidateQueries({ queryKey: queryKeys.models });
    },
  });
}

export function useAgentDetail(agentId: string | null) {
  return useQuery({
    queryKey: ["agents", "detail", agentId],
    queryFn: () => api.get<AgentFullDetail>(API.AGENT(agentId!)),
    enabled: Boolean(agentId),
    staleTime: 60 * 1000,
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & UpdateAgentRequest) =>
      api.patch<AgentFullDetail>(API.AGENT(id), patch),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents });
      void queryClient.invalidateQueries({ queryKey: ["agents", "detail", id] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.models });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean; id: string }>(API.AGENT(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents });
      void queryClient.invalidateQueries({ queryKey: queryKeys.models });
    },
  });
}
