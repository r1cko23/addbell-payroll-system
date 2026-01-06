"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { H1, BodySmall } from "@/components/ui/typography";
import { VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface OvertimeGroup {
  id: string;
  name: string;
  description: string | null;
  approver_id: string | null;
  viewer_id: string | null;
  is_active: boolean;
  approver?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  viewer?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function OvertimeGroupsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [groups, setGroups] = useState<OvertimeGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "ot_approver" as "ot_approver" | "ot_viewer",
  });
  const [accountError, setAccountError] = useState("");

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [roleLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  async function loadData() {
    setLoading(true);
    try {
      // Load groups with approver/viewer info
      const { data: groupsData, error: groupsError } = await supabase
        .from("overtime_groups")
        .select(
          `
          *,
          approver:users!overtime_groups_approver_id_fkey(id, full_name, email),
          viewer:users!overtime_groups_viewer_id_fkey(id, full_name, email)
        `
        )
        .order("name");

      if (groupsError) throw groupsError;

      // Load users for dropdowns (include all roles that can be approvers/viewers)
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .eq("is_active", true)
        .in("role", ["admin", "account_manager", "ot_approver", "ot_viewer"])
        .order("full_name");

      if (usersError) throw usersError;

      setGroups((groupsData || []) as OvertimeGroup[]);
      setUsers(usersData || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error(error.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function updateGroup(
    groupId: string,
    field: "approver_id" | "viewer_id",
    value: string | null
  ) {
    setSaving(groupId);
    try {
      const updateData = field === "approver_id"
        ? { approver_id: value }
        : { viewer_id: value };

      const { error } = await (supabase.from("overtime_groups") as any)
        .update(updateData)
        .eq("id", groupId);

      if (error) throw error;

      toast.success("Group updated successfully");
      await loadData();
    } catch (error: any) {
      console.error("Error updating group:", error);
      toast.error(error.message || "Failed to update group");
    } finally {
      setSaving(null);
    }
  }

  async function createAccount() {
    if (!newAccount.email || !newAccount.full_name || !newAccount.password) {
      setAccountError("Please fill all fields");
      return;
    }

    if (newAccount.password.length < 8) {
      setAccountError("Password must be at least 8 characters");
      return;
    }

    setCreatingAccount(true);
    setAccountError("");

    try {
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newAccount.email,
          full_name: newAccount.full_name,
          password: newAccount.password,
          role: newAccount.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      toast.success("Account created successfully!");
      setShowCreateAccountModal(false);
      setNewAccount({ email: "", full_name: "", password: "", role: "ot_approver" });
      await loadData();
    } catch (error: any) {
      console.error("Error creating account:", error);
      setAccountError(error.message || "Failed to create account");
    } finally {
      setCreatingAccount(false);
    }
  }

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

  if (!isAdmin) {
    return null;
  }

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full pb-24">
        <VStack gap="2" align="start">
          <div className="flex items-center justify-between w-full">
            <div>
              <H1>Overtime Groups Management</H1>
              <BodySmall>
                Assign approvers and viewers for each employee group. Employees in a
                group will have their OT requests approved/viewed by the assigned
                approver/viewer.
              </BodySmall>
            </div>
            <Button onClick={() => setShowCreateAccountModal(true)}>
              <Icon name="Plus" size={IconSizes.sm} className="mr-2" />
              Create Account
            </Button>
          </div>
        </VStack>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icon
              name="ArrowsClockwise"
              size={IconSizes.lg}
              className="animate-spin text-muted-foreground"
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.id} className="w-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    {!group.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  {group.description && (
                    <BodySmall className="text-muted-foreground">
                      {group.description}
                    </BodySmall>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`approver-${group.id}`}>
                      OT Approver
                    </Label>
                    <Select
                      value={group.approver_id || ""}
                      onValueChange={(value) =>
                        updateGroup(
                          group.id,
                          "approver_id",
                          value === "" ? null : value
                        )
                      }
                      disabled={saving === group.id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select approver (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">
                          None (any account manager/admin)
                        </SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name} ({user.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {group.approver && (
                      <BodySmall className="text-muted-foreground">
                        Current: {group.approver.full_name}
                      </BodySmall>
                    )}
                    <BodySmall className="text-xs text-muted-foreground">
                      Who can approve OT requests for employees in this group
                    </BodySmall>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`viewer-${group.id}`}>OT Viewer</Label>
                    <Select
                      value={group.viewer_id || ""}
                      onValueChange={(value) =>
                        updateGroup(
                          group.id,
                          "viewer_id",
                          value === "" ? null : value
                        )
                      }
                      disabled={saving === group.id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select viewer (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">
                          None (any account manager/admin)
                        </SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name} ({user.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {group.viewer && (
                      <BodySmall className="text-muted-foreground">
                        Current: {group.viewer.full_name}
                      </BodySmall>
                    )}
                    <BodySmall className="text-xs text-muted-foreground">
                      Who can view OT requests for employees in this group
                    </BodySmall>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Account Modal */}
        <Dialog open={showCreateAccountModal} onOpenChange={setShowCreateAccountModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create OT Approver/Viewer Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-email">Email</Label>
                <Input
                  id="account-email"
                  type="email"
                  value={newAccount.email}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, email: e.target.value })
                  }
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-name">Full Name</Label>
                <Input
                  id="account-name"
                  value={newAccount.full_name}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, full_name: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-role">Role</Label>
                <Select
                  value={newAccount.role}
                  onValueChange={(value: "ot_approver" | "ot_viewer") =>
                    setNewAccount({ ...newAccount, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ot_approver">OT Approver (can approve/reject)</SelectItem>
                    <SelectItem value="ot_viewer">OT Viewer (view only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-password">Password</Label>
                <Input
                  id="account-password"
                  type="password"
                  value={newAccount.password}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, password: e.target.value })
                  }
                  placeholder="Minimum 8 characters"
                />
              </div>
              {accountError && (
                <BodySmall className="text-destructive">{accountError}</BodySmall>
              )}
              <BodySmall className="text-muted-foreground">
                This account will only have access to the OT approval page. They can
                {newAccount.role === "ot_approver"
                  ? " approve/reject"
                  : " view"}{" "}
                OT requests for groups they are assigned to.
              </BodySmall>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateAccountModal(false);
                  setNewAccount({ email: "", full_name: "", password: "", role: "ot_approver" });
                  setAccountError("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={createAccount} disabled={creatingAccount}>
                {creatingAccount ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </VStack>
    </DashboardLayout>
  );
}