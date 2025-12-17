"use client";

import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall } from "@/components/ui/typography";
import { VStack } from "@/components/ui/stack";

export default function ActivityPage() {
  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full">
        <VStack gap="2" align="start">
          <H1>Activity</H1>
          <BodySmall>
            Coming soon: consolidated time and location activity feed.
          </BodySmall>
        </VStack>
        <CardSection>
          <BodySmall>
            This page will show activity logs (time, location) without affecting
            approval routes.
          </BodySmall>
        </CardSection>
      </VStack>
    </DashboardLayout>
  );
}
