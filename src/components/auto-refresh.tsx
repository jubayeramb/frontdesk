"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renders the page's server components every few seconds while the tab is
// visible, so ownership changes show up without a reload. Client state, and the
// inbox frame, are kept.
export function AutoRefresh({ everyMs }: { everyMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, everyMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, everyMs]);
  return null;
}
