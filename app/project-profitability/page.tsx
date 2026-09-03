"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dbPageWrapper } from "@/lib/dashboard-ui";

/** Legacy profitability report — retired with projects catalog. */
export default function ProjectProfitabilityRetiredPage() {
  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <h1 className="text-xl font-semibold">Project profitability retired</h1>
            <p className="text-sm text-muted-foreground">
              Costing reports tied to the old projects catalog are no longer
              available. Use Operations → Projects for masterlist jobs.
            </p>
            <Button asChild>
              <Link href="/projects">Go to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
