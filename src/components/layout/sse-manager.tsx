"use client";

import { useChatStore } from "@/stores/chat-store";
import { useSSE } from "@/hooks/use-sse";

/**
 * Single SSE owner for the app shell. Mounted by the route layout so the
 * EventSource survives Landing → ChatView remounts (`useSSE` used to live
 * in `useChat`, which unmounts on the route change and dropped the
 * connection mid-stream). Renders nothing.
 */
export function SSEManager() {
  const streamId = useChatStore((s) => s.streamId);
  useSSE(streamId);
  return null;
}
