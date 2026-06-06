"use client";

import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSection } from "@/components/ui/card-section";
import { BodySmall } from "@/components/ui/typography";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

export default function ActivityPage() {
  return (
    <DashboardLayout>
      <div className={cn("w-full", dbPageWrapper)}>
        <DashboardPageHeader
          title="Activity"
          description="Coming soon: consolidated time and location activity feed."
        />
        <CardSection>
          <BodySmall>
            This page will show activity logs (time, location) without affecting
            approval routes.
          </BodySmall>
        </CardSection>
      </div>
    </DashboardLayout>
  );
}