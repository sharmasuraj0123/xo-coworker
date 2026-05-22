"use client";

import { AgentDetailPage } from "@/components/agents/agent-detail-page";
import { HermesProfileDetailPage } from "@/components/agents/hermes/profile-detail-page";
import { useActiveAgentId } from "@/hooks/use-active-agent-id";
import { useAgents } from "@/hooks/use-agents";

export function AgentPageClient(_props: { agentId: string }) {
  const agentId = useActiveAgentId();
  // The agents list carries `metadata.backend` for every entry; the basic
  // detail endpoint (`/api/agents/{id}`) does not. We piggyback on the list
  // cache (10-min staleTime) so the dispatch is essentially free.
  const agents = useAgents();

  if (!agentId) return null;

  const entry = agents.data?.find((a) => a.name === agentId);
  if (entry?.metadata?.backend === "hermes") {
    const profile = entry.metadata.hermes_profile || agentId;
    return <HermesProfileDetailPage profile={profile} />;
  }

  return <AgentDetailPage agentId={agentId} />;
}
