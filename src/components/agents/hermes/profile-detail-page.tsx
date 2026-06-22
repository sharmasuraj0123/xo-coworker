"use client";

/**
 * Hermes per-profile detail page. Dispatched from `agent-page-client.tsx`
 * when `metadata.backend === "hermes"`. Page id is the hermes profile
 * name (1:1 by BE design — see `_agent_info_hermes` in agents.py).
 *
 * Layout mirrors `AgentDetailPage`: back button, header with display name
 * and #id badge, then a tab strip with animated indicator. Each tab fetches
 * its own slice of the profile via the `useHermes*` hooks.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  LayoutDashboard,
  Ghost,
  KeyRound,
  MessageSquare,
  Lock,
  Brain,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAppRouter } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteAgent } from "@/hooks/use-agents";
import { cn } from "@/lib/utils";
import { OverviewTab } from "./tabs/overview-tab";
import { PersonaTab } from "./tabs/persona-tab";
import { ProvidersTab } from "./tabs/providers-tab";
import { ChannelsTab } from "./tabs/channels-tab";
import { SecretsTab } from "./tabs/secrets-tab";
import { MemoryTab } from "./tabs/memory-tab";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "persona", label: "Persona", icon: Ghost },
  { id: "providers", label: "Providers", icon: KeyRound },
  { id: "channels", label: "Channels", icon: MessageSquare },
  { id: "secrets", label: "Secrets", icon: Lock },
  { id: "memory", label: "Memory", icon: Brain },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props {
  profile: string;
}

export function HermesProfileDetailPage({ profile }: Props) {
  const router = useAppRouter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const del = useDeleteAgent();

  const isDefault = profile === "default";

  const onDelete = async () => {
    try {
      await del.mutateAsync(profile);
      toast.success(`Profile "${profile}" deleted.`);
      router.push("/agents");
    } catch (e) {
      toast.error("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
        {/* Top bar — matches AgentDetailPage */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 -ml-2"
            onClick={() => router.back()}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <span className="text-[11px] font-mono text-[var(--text-tertiary)]">#{profile}</span>
          {/* Default profile is hermes.sh-managed; deleting would break
              the whole hermes install — so the button is hidden for it. */}
          {!isDefault && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto gap-1.5 text-[11px] text-red-400 hover:text-red-300"
              onClick={() => setDeleteOpen(true)}
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
        </div>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete profile?</DialogTitle>
              <DialogDescription>
                This permanently removes <code className="font-mono">~/.hermes/profiles/{profile}/</code> — sessions, memory, persona, and connected channels. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)} type="button">
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={onDelete}
                disabled={del.isPending}
                type="button"
              >
                {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                Delete profile
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {profile}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Hermes profile</p>
        </header>

        {/* Tab strip — mirrors AgentFileTabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-default)] mb-5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all duration-200",
                  isActive
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
                )}
                type="button"
              >
                {isActive && (
                  <motion.div
                    layoutId="hermes-profile-tab-indicator"
                    className="absolute inset-0 rounded-lg bg-[var(--sidebar-active)] shadow-sm border border-[var(--border-default)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <tab.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Active tab body */}
        <div className="flex flex-col gap-6">
          {activeTab === "overview" && <OverviewTab profile={profile} />}
          {activeTab === "persona" && <PersonaTab profile={profile} />}
          {activeTab === "providers" && <ProvidersTab profile={profile} />}
          {activeTab === "channels" && <ChannelsTab profile={profile} />}
          {activeTab === "secrets" && <SecretsTab profile={profile} />}
          {activeTab === "memory" && <MemoryTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}
