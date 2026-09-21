"use client";

import { useEffect } from "react";
import { useAppRouter } from "@/lib/navigation";

/**
 * Root redirect. Every visit lands on a new chat.
 *
 * Uses `useAppRouter` rather than a server-side `redirect()` so the
 * preserved query params (e.g. `coder_session_token`) ride along to
 * the destination.
 */
export default function Home() {
  const router = useAppRouter();

  useEffect(() => {
    router.replace("/c/new");
  }, [router]);

  return null;
}
