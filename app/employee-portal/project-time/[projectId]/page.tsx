"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { epPageWrapper } from "@/lib/employee-portal-ui";

export default function ProjectTimeDetailRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/employee-portal/project-time");
  }, [router]);

  return (
    <div className={epPageWrapper}>
      <p className="text-sm text-muted-foreground">Redirecting…</p>
    </div>
  );
}
