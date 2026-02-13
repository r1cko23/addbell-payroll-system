"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Schedules functionality has been removed for Addbell.
 * Redirect to dashboard.
 */
export default function SchedulesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard?type=workforce");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
      Redirecting…
    </div>
  );
}