"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { dbPageWrapper } from "@/lib/dashboard-ui";

export default function ProjectProfitabilityDetailRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/project-profitability");
  }, [router]);

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </div>
    </DashboardLayout>
  );
}
