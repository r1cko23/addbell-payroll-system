"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/lib/hooks/useProfile";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { ArrowLeft, Clock, LogIn, LogOut, CheckCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  project_status: string;
}

interface ActiveTimeEntry {
  id: string;
  project_id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
}

export default function ProjectClockPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const session = useEmployeeSession();
  
  const [project, setProject] = useState<Project | null>(null);
  const [activeEntry, setActiveEntry] = useState<ActiveTimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [notes, setNotes] = useState("");
  
  const employeeId = session?.employee?.id ?? null;

  useEffect(() => {
    if (projectId) {
      fetchProject();
      checkActiveEntry();
    }
  }, [projectId, employeeId, supabase]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_code, project_name, project_status")
        .eq("id", projectId)
        .single();
      
      if (error) throw error;
      setProject(data);
    } catch (error) {
      toast.error("Failed to load project");
      console.error(error);
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
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      setActiveEntry(data);
    } catch (error) {
      console.error("Failed to check active entry:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!employeeId) {
      toast.error("Employee not found");
      return;
    }

    // Check if employee is assigned to this project
    const { data: assignment } = await supabase
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .eq("employee_id", employeeId)
      .eq("is_active", true)
      .maybeSingle();

    if (!assignment) {
      toast.error("You are not assigned to this project");
      return;
    }

    // Check if there's an active entry for this project
    if (activeEntry) {
      toast.error("You already have an active clock entry for this project");
      return;
    }

    setClocking(true);
    try {
      const { error } = await supabase
        .from("project_time_entries")
        .insert({
          project_id: projectId,
          employee_id: employeeId,
          clock_in: new Date().toISOString(),
          notes: notes.trim() || null,
          created_by: profile?.id || null,
        });
      
      if (error) throw error;
      
      toast.success("Clocked in successfully");
      setNotes("");
      checkActiveEntry();
    } catch (error: any) {
      toast.error(error.message || "Failed to clock in");
      console.error(error);
    } finally {
      setClocking(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) {
      toast.error("No active clock entry found");
      return;
    }

    setClocking(true);
    try {
      const clockOutTime = new Date().toISOString();
      const clockInTime = new Date(activeEntry.clock_in);
      const totalHours = (new Date(clockOutTime).getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
      
      // For now, set regular_hours = total_hours (can be refined with schedule logic later)
      const { error } = await supabase
        .from("project_time_entries")
        .update({
          clock_out: clockOutTime,
          total_hours: totalHours,
          regular_hours: totalHours,
          notes: notes.trim() || activeEntry.notes || null,
          updated_at: clockOutTime,
        })
        .eq("id", activeEntry.id);
      
      if (error) throw error;
      
      toast.success("Clocked out successfully");
      setNotes("");
      checkActiveEntry();
    } catch (error: any) {
      toast.error(error.message || "Failed to clock out");
      console.error(error);
    } finally {
      setClocking(false);
    }
  };

  const getElapsedTime = () => {
    if (!activeEntry) return null;
    
    const start = new Date(activeEntry.clock_in);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return { hours, minutes, seconds };
  };

  if (profileLoading || loading) {
    return <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />;
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Link href="/projects">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Project not found
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!employeeId) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Employee not found. Please contact HR.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const elapsed = getElapsedTime();
  const isClockedIn = !!activeEntry;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-2">
            Project Time Clock
          </h1>
          <p className="text-muted-foreground text-sm">
            {project.project_name} ({project.project_code})
          </p>
        </div>
      </div>

      {/* Clock Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isClockedIn && activeEntry ? (
            <>
              <div className="text-center space-y-2">
                <Badge variant="default" className="text-lg px-4 py-2">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Clocked In
                </Badge>
                <div className="text-sm text-muted-foreground">
                  Clocked in at {format(new Date(activeEntry.clock_in), "MMM d, yyyy h:mm a")}
                </div>
              </div>
              
              {elapsed && (
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">
                    {String(elapsed.hours).padStart(2, "0")}:
                    {String(elapsed.minutes).padStart(2, "0")}:
                    {String(elapsed.seconds).padStart(2, "0")}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Elapsed Time
                  </div>
                </div>
              )}
              
              <div>
                <Label htmlFor="clock_out_notes">Notes (Optional)</Label>
                <Textarea
                  id="clock_out_notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about your work..."
                  rows={3}
                  className="mt-2"
                />
              </div>
              
              <Button
                onClick={handleClockOut}
                disabled={clocking}
                className="w-full"
                size="lg"
                variant="destructive"
              >
                <LogOut className="h-5 w-5 mr-2" />
                {clocking ? "Processing..." : "Clock Out"}
              </Button>
            </>
          ) : (
            <>
              <div className="text-center space-y-2">
                <Badge variant="outline" className="text-lg px-4 py-2">
                  Not Clocked In
                </Badge>
                <div className="text-sm text-muted-foreground">
                  Click the button below to start tracking your time on this project
                </div>
              </div>
              
              <div>
                <Label htmlFor="clock_in_notes">Notes (Optional)</Label>
                <Textarea
                  id="clock_in_notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about what you'll be working on..."
                  rows={3}
                  className="mt-2"
                />
              </div>
              
              <Button
                onClick={handleClockIn}
                disabled={clocking || project.project_status !== "active"}
                className="w-full"
                size="lg"
              >
                <LogIn className="h-5 w-5 mr-2" />
                {clocking ? "Processing..." : "Clock In"}
              </Button>
              
              {project.project_status !== "active" && (
                <p className="text-sm text-muted-foreground text-center">
                  This project is not active. Only active projects allow clock in.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            View all time entries on the project detail page
          </div>
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" className="mt-4 w-full">
              View Project Details
            </Button>
          </Link>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}
