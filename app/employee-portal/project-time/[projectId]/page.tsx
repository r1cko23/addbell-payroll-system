"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { ArrowLeft, Clock, CheckCircle } from "lucide-react";

interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface ActiveTimeEntry {
  id: string;
  project_id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
}

export default function EmployeePortalProjectClockPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const supabase = createClient();
  const session = useEmployeeSession();
  const employeeId = session?.employee?.id ?? null;

  const [project, setProject] = useState<Project | null>(null);
  const [activeEntry, setActiveEntry] = useState<ActiveTimeEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId && employeeId) {
      fetchProject();
      checkActiveEntry();
    }
  }, [projectId, employeeId]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name, status")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      setProject(data);
    } catch {
      toast.error("Failed to load project");
      setProject(null);
    }
  };

  const checkActiveEntry = async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("project_time_entries")
        .select("*")
        .eq("project_id", projectId)
        .eq("employee_id", employeeId)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setActiveEntry(data);
    } catch {
      setActiveEntry(null);
    } finally {
      setLoading(false);
    }
  };

  const getElapsedTime = () => {
    if (!activeEntry) return null;
    const start = new Date(activeEntry.clock_in);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    return {
      hours: Math.floor(diffMs / (1000 * 60 * 60)),
      minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diffMs % (1000 * 60)) / 1000),
    };
  };

  if (!employeeId) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Link href="/employee-portal/project-time">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back to Project Assignments</Button>
        </Link>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Employee not found. Please log in again.</CardContent></Card>
      </div>
    );
  }

  if (loading && !project) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="animate-pulse h-8 w-48 bg-muted rounded" />
        <div className="animate-pulse h-48 bg-muted rounded" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Link href="/employee-portal/project-time">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back to Project Assignments</Button>
        </Link>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Project not found.</CardContent></Card>
      </div>
    );
  }

  const elapsed = getElapsedTime();
  const isClockedIn = !!activeEntry;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <Link href="/employee-portal/project-time">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back to Project Assignments</Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-2">Project Details</h1>
        <p className="text-muted-foreground text-sm">{project.name} ({project.code})</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Time Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Time in and time out is now based on your location only. Per-project clocking has been disabled.
              </p>
            </div>
            {elapsed && activeEntry && (
              <div className="text-center space-y-2">
                <Badge variant="outline" className="px-4 py-1 text-sm">Most recent project work</Badge>
                <div className="text-sm text-muted-foreground">
                  You last worked on this project starting at{" "}
                  {new Date(activeEntry.clock_in).toLocaleString()}
                  {activeEntry.clock_out && ` and ended at ${new Date(activeEntry.clock_out).toLocaleString()}`}.
                </div>
              </div>
            )}
            <div className="flex justify-center">
              <Link href="/employee-portal/bundy">
                <Button size="lg">
                  <Clock className="h-5 w-5 mr-2" />
                  Open Location Time Clock
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
