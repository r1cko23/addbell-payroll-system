"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { BodySmall, H1 } from "@/components/ui/typography";
import { VStack } from "@/components/ui/stack";

export default function OvertimeGroupsPage() {
  return (
    <DashboardLayout>
      <VStack gap="4" className="w-full max-w-2xl pb-24">
        <VStack gap="2" align="start">
          <H1>Approval groups removed</H1>
          <BodySmall>
            Group-based approval routing is no longer used. Requests now route by
            employee position and the first approver is handled from the
            approval queues.
          </BodySmall>
        </VStack>
        <div>
          <Button asChild>
            <Link href="/settings">Back to settings</Link>
          </Button>
        </div>
      </VStack>
    </DashboardLayout>
  );
}
