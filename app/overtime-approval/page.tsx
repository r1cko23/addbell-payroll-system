"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { format } from "date-fns";
import { toast } from "sonner";

type OTRequest = {
  id: string;
  employee_id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string | null;
  attachment_url: string | null;
  status: "pending" | "approved" | "rejected";
  approved_by_account_manager?: string | null;
  approved_by_hr?: string | null;
  created_at: string;
  employees?: { full_name: string; employee_id: string };
};

export default function OvertimeApprovalPage() {
  const supabase = createClient();
  const { isAdmin, role, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OTRequest | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("overtime_requests")
      .select(
        `
        *,
        employees (
          full_name,
          employee_id
        )
      `
      )
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading OT requests", error);
      toast.error("Failed to load OT requests");
    } else {
      setRequests((data || []) as OTRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase.rpc("approve_overtime_request", {
      p_request_id: id,
    });
    if (error) {
      toast.error(error.message || "Failed to approve OT");
    } else {
      toast.success("OT approved and offset hours added");
      loadRequests();
    }
    setActioningId(null);
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase.rpc("reject_overtime_request", {
      p_request_id: id,
      p_reason: null,
    });
    if (error) {
      toast.error(error.message || "Failed to reject OT");
    } else {
      toast.success("OT rejected");
      loadRequests();
    }
    setActioningId(null);
  };

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin && role !== "account_manager") {
    return (
      <DashboardLayout>
        <VStack gap="4" className="p-8">
          <BodySmall>
            Only Account Managers or Admins can access OT approvals.
          </BodySmall>
        </VStack>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        <VStack gap="2" align="start">
          <H1>OT Approvals</H1>
          <BodySmall>
            Approve or reject employee-filed OT. Approved hours convert 1:1 to
            off-setting credits.
          </BodySmall>
        </VStack>

        <CardSection>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Icon
                name="ArrowsClockwise"
                size={IconSizes.lg}
                className="animate-spin text-muted-foreground"
              />
            </div>
          ) : requests.length === 0 ? (
            <BodySmall>No overtime requests yet.</BodySmall>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {requests.map((req) => (
                <Card
                  key={req.id}
                  className="h-full min-h-[200px] shadow-sm border-border bg-white"
                >
                  <CardContent className="p-4 flex flex-col gap-3 h-full">
                    <HStack
                      justify="between"
                      align="start"
                      className="flex-col md:flex-row gap-3"
                    >
                      <VStack gap="2" align="start" className="flex-1">
                        <p className="font-semibold text-foreground leading-tight">
                          {req.employees?.full_name || "Unknown"} (
                          {req.employees?.employee_id || "—"})
                        </p>
                        <BodySmall className="text-muted-foreground">
                          {format(new Date(req.ot_date), "MMM d, yyyy")} ·{" "}
                          {req.start_time} - {req.end_time} · {req.total_hours}h
                        </BodySmall>
                        {req.reason && (
                          <Caption className="line-clamp-2" title={req.reason}>
                            {req.reason}
                          </Caption>
                        )}
                        {req.attachment_url && (
                          <a
                            href={req.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-emerald-600 underline"
                          >
                            Attachment
                          </a>
                        )}
                        {req.status === "approved" && (
                          <VStack
                            gap="1"
                            align="start"
                            className="mt-1 text-xs text-gray-600"
                          >
                            <p className="font-semibold text-foreground">
                              Approved by Account Manager
                            </p>
                            <Caption>
                              {req.approved_by_account_manager ||
                                "Not captured"}
                            </Caption>
                            <p className="font-semibold text-foreground mt-1">
                              Approved by HR
                            </p>
                            <Caption>
                              {req.approved_by_hr || "Not captured"}
                            </Caption>
                          </VStack>
                        )}
                      </VStack>
                      <HStack gap="2" align="center">
                        <Badge
                          variant="outline"
                          className={
                            req.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : req.status === "rejected"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {req.status.toUpperCase()}
                        </Badge>
                        {req.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(req.id)}
                              disabled={actioningId === req.id}
                            >
                              <Icon name="Check" size={IconSizes.sm} />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleReject(req.id)}
                              disabled={actioningId === req.id}
                            >
                              <Icon name="X" size={IconSizes.sm} />
                              Reject
                            </Button>
                          </>
                        )}
                      </HStack>
                    </HStack>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardSection>
      </VStack>
    </DashboardLayout>
  );
}
