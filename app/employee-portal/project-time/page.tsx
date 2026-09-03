"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { epPageWrapper } from "@/lib/employee-portal-ui";

/** Project time tracking retired with the projects catalog. */
export default function ProjectTimeRetiredPage() {
  return (
    <div className={epPageWrapper}>
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <h1 className="text-lg font-semibold">Project time retired</h1>
          <p className="text-sm text-muted-foreground">
            Project clock-in is no longer available. Use Bundy for timekeeping.
          </p>
          <Button asChild>
            <Link href="/employee-portal">Back to portal</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
