"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { dbPageWrapper } from "@/lib/dashboard-ui";

/** Project clock retired — masterlist jobs are SoT; redirect to job detail. */
export default function ProjectClockRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  useEffect(() => {
    router.replace(jobId ? `/projects/${jobId}` : "/projects");
  }, [jobId, router]);

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <p className="text-sm text-muted-foreground">
          Project clock is no longer available. Redirecting…
        </p>
      </div>
    </DashboardLayout>
  );
}
