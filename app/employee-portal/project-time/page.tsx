"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { Clock, MapPin } from "lucide-react";
import { PageTitle } from "@/components/ui/typography";
import { epCardInteractive, epPageStack } from "@/lib/employee-portal-ui";
import { cn } from "@/lib/utils";

interface Assignment {
  id: string;
  project_id: string;
  role: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  projects: { id: string; code: string; name: string; status: string } | null;
}

export default function EmployeePortalProjectTimePage() {
  const supabase = createClient();
  const session = useEmployeeSession();
  const employeeId = session?.employee?.id ?? null;
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) return;
    fetchAssignments();
  }, [employeeId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("project_assignments")
        .select("id, project_id, role, start_date, end_date, is_active, projects:project_id ( id, code, name, status )")
        .eq("employee_id", employeeId)
        .eq("is_active", true)
        .order("start_date", { ascending: false });

      if (error) throw error;
      const rows = data ?? [];
      setAssignments(
        rows.map((row) => {
          const p = row.projects;
          const project = Array.isArray(p) ? p[0] ?? null : p;
          return { ...row, projects: project } as Assignment;
        })
      );
    } catch (e) {
      toast.error("Failed to load projects");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!employeeId) {
    return (
      <div className="space-y-6">
        <PageTitle>Project Assignments</PageTitle>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Employee session not found. Please log in again.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={epPageStack}>
      <PageTitle>Project Assignments</PageTitle>

      {loading ? (
        <div className="animate-pulse h-32 bg-muted rounded-lg" />
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No project assignments yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assignments.map((a) => {
            const project = a.projects;
            if (!project) return null;
            const isActive = project.status === "active";
            return (
              <Card
                key={a.id}
                className={cn(
                  "border-border/80 bg-card/95",
                  epCardInteractive
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>{project.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">{project.code}</p>
                    </div>
                    <Badge variant={isActive ? "default" : "secondary"} className="capitalize">
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  {a.role ? (
                    <p className="text-sm text-muted-foreground">
                      Role: {a.role}
                    </p>
                  ) : null}
                  <div className="flex w-full flex-col items-stretch gap-2 sm:items-end">
                    <p className="text-xs text-muted-foreground">
                      Time in and out is based on your location, not per project.
                    </p>
                    <Link href="/employee-portal/bundy" className="w-full md:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full justify-center text-xs md:min-h-9 md:w-auto md:text-sm"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Open Time Clock
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
