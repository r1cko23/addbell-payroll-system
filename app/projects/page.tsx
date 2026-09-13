"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PageSubtitle } from "@/components/ui/typography";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { PoMasterlistProjectsGrid } from "@/components/projects/PoMasterlistProjectsGrid";

export default function ProjectsPage() {
  const router = useRouter();
  const { isHR, loading: roleLoading } = useUserRole();
  const { canRead } = usePermissions();

  useEffect(() => {
    if (!roleLoading && isHR) {
      router.replace("/dashboard");
    }
  }, [isHR, roleLoading, router]);

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className={dbPageWrapper}>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (isHR || !canRead("projects")) {
    return (
      <DashboardLayout>
        <div className={dbPageWrapper}>
          <p className="text-sm text-muted-foreground">
            You do not have access to Projects.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="Projects"
          description={
            <PageSubtitle>
              Browse ADD-BELL jobs like the masterlist sheet. Filter by year,
              client, and status; P.O. number is the reference.
            </PageSubtitle>
          }
        />
        <PoMasterlistProjectsGrid />
      </div>
    </DashboardLayout>
  );
}
