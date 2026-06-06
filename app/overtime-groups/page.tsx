"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

export default function OvertimeGroupsPage() {
  return (
    <DashboardLayout>
      <div className={cn("w-full max-w-2xl", dbPageWrapper)}>
        <DashboardPageHeader
          title="Approval groups removed"
          description="Group-based approval routing is no longer used. Requests now route by employee position and the first approver is handled from the approval queues."
        />
        <div>
          <Button asChild>
            <Link href="/settings">Back to settings</Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
