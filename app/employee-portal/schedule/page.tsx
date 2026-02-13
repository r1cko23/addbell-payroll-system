"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Schedule functionality removed for Addbell.
 * Redirect to employee portal home.
 */
export default function EmployeeSchedulePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/employee-portal");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
      Redirecting…
    </div>
  );
}
