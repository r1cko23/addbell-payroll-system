"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSection } from "@/components/ui/card-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { H1, H3, H4, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { formatDateDisplay } from "@/utils/holidays";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProfilePictureUpload } from "@/components/ProfilePictureUpload";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "hr" | "approver" | "viewer";
  is_active: boolean;
  can_access_salary?: boolean | null;
  profile_picture_url: string | null;
  created_at: string;
  assigned_ot_groups?: {
    id: string;
    name: string;
    approver_id: string | null;
    viewer_id: string | null;
  }[];
  employee_specific_assignments?: {
    id: string;
    employee_id: string;
    full_name: string;
    overtime_approver_id: string | null;
    overtime_viewer_id: string | null;
  }[];
}

interface OvertimeGroup {
  id: string;
  name: string;
  description: string | null;
}

interface Holiday {
  id: string;
  holiday_date: string;
  holiday_name: string;
  holiday_type: "regular" | "non-working";
  year: number;
}

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [overtimeGroups, setOvertimeGroups] = useState<OvertimeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedOTGroups, setSelectedOTGroups] = useState<string[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showOTDetailsModal, setShowOTDetailsModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "hr" as "admin" | "hr" | "approver" | "viewer",
    ot_groups: [] as string[],
  });
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);
  const [userToActivate, setUserToActivate] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        setCurrentUser(userData);
      }

      // Load all users (admin can see all, including inactive)
      // First check current user to debug
      const { data: { user: authUser } } = await supabase.auth.getUser();
      console.log("Current auth user:", authUser?.id, authUser?.email);

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .order("full_name", { ascending: true });

      if (usersError) {
        console.error("Error loading users:", usersError);
        console.error("Error details:", {
          message: usersError.message,
          details: usersError.details,
          hint: usersError.hint,
          code: usersError.code,
        });
        throw usersError;
      }

      console.log(`Loaded ${usersData?.length || 0} users`);
      console.log("Users data sample:", usersData?.slice(0, 3));
      console.log("Full users data:", usersData);

      if (!usersData || usersData.length === 0) {
        console.warn("No users returned from query - checking RLS policies");
        setUsers([]);
        // Don't return early - still load holidays and groups
      }

      // Load holidays (filter by date range instead of year column)
      const yearStart = new Date(2025, 0, 1).toISOString().split('T')[0];
      const yearEnd = new Date(2025, 11, 31).toISOString().split('T')[0];
      const { data: holidaysData, error: holidaysError } = await supabase
        .from("holidays")
        .select("*")
        .gte("holiday_date", yearStart)
        .lte("holiday_date", yearEnd)
        .order("holiday_date");

      if (holidaysError) {
        console.error("Error loading holidays:", holidaysError);
        // Don't throw - just set empty array
        setHolidays([]);
      } else {
        setHolidays(holidaysData || []);
      }

      // Load overtime groups (don't throw on error - just log it)
      const { data: groupsData, error: groupsError } = await supabase
        .from("overtime_groups")
        .select("id, name, description")
        .order("name");

      if (groupsError) {
        console.error("Error loading overtime groups:", groupsError);
        // Don't throw - just set empty array so users can still be displayed
        setOvertimeGroups([]);
      } else {
        setOvertimeGroups(groupsData || []);
      }

      // Load users with their assigned OT groups (after groups are loaded)
      // IMPORTANT: Set users immediately, even if group loading fails
      if (!usersData || usersData.length === 0) {
        console.warn("No users data available - setting empty array");
        setUsers([]);
      } else {
        console.log(`Processing ${usersData.length} users with OT groups...`);
        // Set users immediately with empty groups as fallback
        const usersWithEmptyGroups = usersData.map((user: any) => ({ ...user, assigned_ot_groups: [] }));
        console.log(`✅ Setting ${usersWithEmptyGroups.length} users immediately`);
        console.log("Sample user being set:", usersWithEmptyGroups[0]);
        setUsers(usersWithEmptyGroups);
        console.log("✅ setUsers() called successfully");

        try {
          const usersWithGroups = await Promise.all(
            usersData.map(async (user: any) => {
              try {
                // Find groups where this user is approver or viewer
                const { data: approverGroups, error: approverError } = await supabase
                  .from("overtime_groups")
                  .select("id, name, approver_id, viewer_id")
                  .eq("approver_id", user.id);

                if (approverError) {
                  console.warn(`Error loading approver groups for ${user.email}:`, approverError);
                }

                const { data: viewerGroups, error: viewerError } = await supabase
                  .from("overtime_groups")
                  .select("id, name, approver_id, viewer_id")
                  .eq("viewer_id", user.id);

                if (viewerError) {
                  console.warn(`Error loading viewer groups for ${user.email}:`, viewerError);
                }

                const assignedGroups = [
                  ...(approverGroups || []),
                  ...(viewerGroups || []).filter(
                    (vg: any) => !(approverGroups || []).some((ag: any) => ag.id === vg.id)
                  ),
                ];

                // Also find employee-specific assignments (where this user is directly assigned as approver or viewer)
                const { data: employeeAssignments, error: employeeError } = await supabase
                  .from("employees")
                  .select("id, employee_id, full_name, overtime_approver_id, overtime_viewer_id")
                  .or(`overtime_approver_id.eq.${user.id},overtime_viewer_id.eq.${user.id}`);

                if (employeeError) {
                  console.warn(`Error loading employee assignments for ${user.email}:`, employeeError);
                }

                return {
                  ...user,
                  assigned_ot_groups: assignedGroups,
                  employee_specific_assignments: employeeAssignments || [],
                };
              } catch (userError) {
                console.error(`Error processing user ${user.email}:`, userError);
                // Return user without groups if there's an error
                return {
                  ...user,
                  assigned_ot_groups: [],
                  employee_specific_assignments: [],
                };
              }
            })
          );

          console.log(`✅ Successfully processed ${usersWithGroups.length} users with groups`);
          console.log("Updating users state with groups:", usersWithGroups.length);
          setUsers(usersWithGroups);
        } catch (groupError) {
          console.error("❌ Error loading user groups:", groupError);
          // Users are already set above, so this is just a warning
          console.warn("Users displayed without OT group assignments");
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  const isAdmin = currentUser?.role === "admin";

  // Helper function to format role names nicely
  function formatRoleName(role: string): string {
    const roleMap: Record<string, string> = {
      admin: "Admin",
      hr: "HR",
      approver: "Approver",
      viewer: "Viewer",
    };
    return roleMap[role] || role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  async function assignUserToOTGroups(
    userId: string,
    userRole: "approver" | "viewer",
    groupIds: string[]
  ) {
    // First, remove user from all groups
    if (userRole === "approver") {
      await (supabase.from("overtime_groups") as any)
        .update({ approver_id: null })
        .eq("approver_id", userId);
    } else {
      await (supabase.from("overtime_groups") as any)
        .update({ viewer_id: null })
        .eq("viewer_id", userId);
    }

    // Then assign to selected groups
    for (const groupId of groupIds) {
      const updateField = userRole === "approver" ? "approver_id" : "viewer_id";
      const updateData: any = {};
      updateData[updateField] = userId;

      const { error } = await (supabase.from("overtime_groups") as any)
        .update(updateData)
        .eq("id", groupId);

      if (error) {
        throw new Error(`Failed to assign to group: ${error.message}`);
      }
    }
  }

  async function handleCreateUser() {
    console.log("handleCreateUser called", {
      newUser,
      creatingUser,
      passwordLength: newUser.password?.length,
    });

    // Client-side validation
    const trimmedEmail = newUser.email?.trim() || "";
    const trimmedFullName = newUser.full_name?.trim() || "";
    const trimmedPassword = newUser.password?.trim() || "";

    console.log("Validation check:", {
      hasEmail: !!trimmedEmail,
      hasFullName: !!trimmedFullName,
      hasPassword: !!trimmedPassword,
      passwordLength: trimmedPassword.length,
      hasRole: !!newUser.role,
    });

    if (
      !trimmedEmail ||
      !trimmedFullName ||
      !trimmedPassword ||
      !newUser.role
    ) {
      console.log("Validation failed: missing fields", {
        trimmedEmail,
        trimmedFullName,
        trimmedPassword: trimmedPassword ? "***" : "",
        passwordLength: trimmedPassword.length,
        role: newUser.role,
      });
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      console.log("Email validation failed:", trimmedEmail);
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate password length
    if (trimmedPassword.length < 8) {
      console.log("Password validation failed:", {
        length: trimmedPassword.length,
        required: 8,
      });
      toast.error(
        `Password must be at least 8 characters long (currently ${trimmedPassword.length})`
      );
      return;
    }

    console.log("All validations passed, proceeding with API call");

    setCreatingUser(true);
    try {
      console.log("Sending request to /api/users/create", { newUser });
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();
      console.log("API response:", { status: response.status, data });

      if (!response.ok) {
        const errorMessage = data.details
          ? `${data.error}: ${data.details}`
          : data.error || "Failed to create user";
        throw new Error(errorMessage);
      }

      // If Approver/Viewer, assign to selected groups
      if ((newUser.role === "approver" || newUser.role === "viewer") && selectedOTGroups.length > 0) {
        try {
          await assignUserToOTGroups(data.user.id, newUser.role, selectedOTGroups);
        } catch (error: any) {
          console.error("Error assigning OT groups:", error);
          toast.error("User created but failed to assign OT groups: " + error.message);
        }
      }

      // If editing user and role changed to Approver/Viewer, update groups
      if (editingUser && (newUser.role === "approver" || newUser.role === "viewer") && selectedOTGroups.length > 0) {
        try {
          await assignUserToOTGroups(editingUser.id, newUser.role, selectedOTGroups);
        } catch (error: any) {
          console.error("Error updating OT groups:", error);
          toast.error("Failed to update OT groups: " + error.message);
        }
      }

      toast.success(`User created successfully!`, {
        description: `${data.user.full_name} • ${data.user.email} • Role: ${data.user.role}`,
      });
      setShowUserModal(false);
      setNewUser({
        email: "",
        full_name: "",
        password: "",
        role: "hr",
        ot_groups: [],
      });
      setSelectedOTGroups([]);
      setEditingUser(null);
      // Reload users list
      await loadData();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleUpdateUserStatus(userId: string, isActive: boolean) {
    setUpdatingStatus(true);
    try {
      const response = await fetch("/api/users/update-status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          is_active: isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update user status");
      }

      toast.success(
        `User ${isActive ? "activated" : "deactivated"} successfully!`,
        {
          description: "User status has been updated",
        }
      );
      setUserToDeactivate(null);
      setUserToActivate(null);
      // Reload users list
      await loadData();
    } catch (error: any) {
      console.error("Error updating user status:", error);
      toast.error(error.message || "Failed to update user status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;

    if (deleteConfirmText.toLowerCase() !== "delete") {
      toast.error('Please type "delete" to confirm');
      return;
    }

    setDeletingUser(true);
    try {
      const response = await fetch("/api/users/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userToDelete.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      toast.success(`User deleted successfully!`, {
        description: `${userToDelete.full_name} • ${userToDelete.email}`,
      });
      setUserToDelete(null);
      setDeleteConfirmText("");
      // Reload users list
      await loadData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    } finally {
      setDeletingUser(false);
    }
  }

  function validateEmail(email: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError("Email is required");
      return false;
    }
    if (!emailRegex.test(email.trim())) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  }

  function validatePassword(password: string) {
    if (!password.trim()) {
      setPasswordError("Password is required");
      return false;
    }
    if (password.trim().length < 8) {
      setPasswordError(
        `Password must be at least 8 characters long (currently ${
          password.trim().length
        })`
      );
      return false;
    }
    setPasswordError("");
    return true;
  }

  if (loading) {
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

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full">
        <VStack gap="2" align="start">
          <H1>Settings</H1>
          <BodySmall>System configuration and user management</BodySmall>
        </VStack>

        {/* User Info */}
        <CardSection title="Your Account">
          <VStack gap="6" align="center" className="w-full">
            {currentUser?.id ? (
              <ProfilePictureUpload
                currentPictureUrl={currentUser?.profile_picture_url || null}
                userId={currentUser.id}
                userName={currentUser?.full_name || "User"}
                userType="user"
                onUploadComplete={async () => {
                  await loadData();
                }}
                size="lg"
              />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                  <span className="text-muted-foreground text-lg">US</span>
                </div>
                <Caption className="text-xs text-muted-foreground">
                  Loading user information...
                </Caption>
              </div>
            )}
            <VStack gap="3" align="center" className="w-full">
              <div className="flex flex-col items-center">
                <VStack gap="3" align="start">
                  <HStack gap="3" align="center">
                    <BodySmall className="w-16 text-left">Name:</BodySmall>
                    <span className="font-semibold">
                      {currentUser?.full_name}
                    </span>
                  </HStack>
                  <HStack gap="3" align="center">
                    <BodySmall className="w-16 text-left">Email:</BodySmall>
                    <span className="font-semibold">{currentUser?.email}</span>
                  </HStack>
                  <HStack gap="3" align="center">
                    <BodySmall className="w-16 text-left">Role:</BodySmall>
                    <Badge variant={isAdmin ? "default" : "secondary"}>
                      {formatRoleName(currentUser?.role || "")}
                    </Badge>
                  </HStack>
                </VStack>
              </div>
            </VStack>
          </VStack>
        </CardSection>

        {/* User Management (Admin Only) */}
        {isAdmin && (
          <CardSection
            title="User Management"
            description="Manage system users"
          >
            <HStack justify="end" align="center" className="mb-4">
              <Button size="sm" onClick={() => setShowUserModal(true)}>
                <Icon name="Plus" size={IconSizes.sm} />
                Add User
              </Button>
            </HStack>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Salary Access
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      OT Groups
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                        {loading ? (
                          <div className="flex items-center justify-center">
                            <Icon name="ArrowsClockwise" size={IconSizes.sm} className="animate-spin mr-2" />
                            Loading users...
                          </div>
                        ) : (
                          <div>
                            <Icon name="User" size={IconSizes.md} className="mx-auto mb-2 opacity-50" />
                            <p>No users found.</p>
                            <p className="text-xs mt-1">Check browser console for details.</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                        {user.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Badge
                          variant={
                            user.role === "admin"
                              ? "default"
                              : false
                              ? "default"
                              : "secondary"
                          }
                        >
                          {formatRoleName(user.role)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Badge
                          variant={user.is_active ? "default" : "secondary"}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {user.role === "admin" ? (
                          <Badge variant="default">Yes (Admin)</Badge>
                        ) : user.can_access_salary ? (
                          <Badge variant="default">Yes</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {user.role === "approver" || user.role === "viewer" || user.role === "admin" ? (
                          <div className="flex items-center gap-2">
                            {/* Summary badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {user.assigned_ot_groups && user.assigned_ot_groups.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-green-50 text-green-700 border-green-200"
                                >
                                  <Icon name="UsersThree" size={IconSizes.xs} className="mr-1" />
                                  {user.assigned_ot_groups.length} {user.assigned_ot_groups.length === 1 ? 'group' : 'groups'}
                                </Badge>
                              )}
                              {user.employee_specific_assignments && user.employee_specific_assignments.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                                >
                                  <Icon name="User" size={IconSizes.xs} className="mr-1" />
                                  {user.employee_specific_assignments.length} {user.employee_specific_assignments.length === 1 ? 'employee' : 'employees'}
                                </Badge>
                              )}
                              {user.role === "admin" &&
                               (!user.assigned_ot_groups || user.assigned_ot_groups.length === 0) &&
                               (!user.employee_specific_assignments || user.employee_specific_assignments.length === 0) && (
                                <Caption className="text-muted-foreground">Admin (all access)</Caption>
                              )}
                              {(user.role === "approver" || user.role === "viewer") &&
                               (!user.assigned_ot_groups || user.assigned_ot_groups.length === 0) &&
                               (!user.employee_specific_assignments || user.employee_specific_assignments.length === 0) && (
                                <Caption className="text-muted-foreground">None</Caption>
                              )}
                            </div>
                            {/* View details button */}
                            {((user.assigned_ot_groups && user.assigned_ot_groups.length > 0) ||
                              (user.employee_specific_assignments && user.employee_specific_assignments.length > 0)) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  setEditingUser(user);
                                  setShowOTDetailsModal(true);
                                }}
                                title="View assignment details"
                              >
                                <Icon name="Info" size={IconSizes.sm} />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={user.id === currentUser?.id}
                            >
                              <Icon
                                name="DotsThreeVertical"
                                size={IconSizes.sm}
                                className="h-4 w-4"
                              />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.is_active ? (
                              <DropdownMenuItem
                                onClick={() => setUserToDeactivate(user)}
                                disabled={user.id === currentUser?.id}
                                className="text-destructive focus:text-destructive"
                              >
                                <Icon
                                  name="UserMinus"
                                  size={IconSizes.sm}
                                  className="mr-2"
                                />
                                Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setUserToActivate(user)}
                              >
                                <Icon
                                  name="UserPlus"
                                  size={IconSizes.sm}
                                  className="mr-2"
                                />
                                Activate
                              </DropdownMenuItem>
                            )}
                            {(user.role === "approver" || user.role === "viewer") && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingUser(user);
                                  // Get currently assigned groups
                                  const assignedGroupIds = user.assigned_ot_groups?.map(g => g.id) || [];
                                  setSelectedOTGroups(assignedGroupIds);
                                  setShowUserModal(true);
                                }}
                              >
                                <Icon
                                  name="UsersThree"
                                  size={IconSizes.sm}
                                  className="mr-2"
                                />
                                Manage OT Groups
                              </DropdownMenuItem>
                            )}
                            {user.role !== "admin" && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const { error } = await (
                                      supabase.from("users") as any
                                    )
                                      .update({
                                        can_access_salary:
                                          !user.can_access_salary,
                                      })
                                      .eq("id", user.id);

                                    if (error) throw error;

                                    toast.success(
                                      `Salary access ${
                                        !user.can_access_salary
                                          ? "granted"
                                          : "revoked"
                                      } for ${user.full_name}`
                                    );
                                    loadData();
                                    // Clear cache for the updated user
                                    const { clearUserRoleCache } = await import(
                                      "@/lib/hooks/useUserRole"
                                    );
                                    clearUserRoleCache();
                                  } catch (error: any) {
                                    console.error(
                                      "Error updating salary access:",
                                      error
                                    );
                                    toast.error(
                                      error.message ||
                                        "Failed to update salary access"
                                    );
                                  }
                                }}
                              >
                                <Icon
                                  name={user.can_access_salary ? "Lock" : "Key"}
                                  size={IconSizes.sm}
                                  className="mr-2"
                                />
                                {user.can_access_salary
                                  ? "Revoke Salary Access"
                                  : "Grant Salary Access"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => setUserToDelete(user)}
                              disabled={user.id === currentUser?.id}
                              className="text-destructive focus:text-destructive"
                            >
                              <Icon
                                name="Trash"
                                size={IconSizes.sm}
                                className="mr-2"
                              />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </CardSection>
        )}

        {/* Holidays */}
        <CardSection
          title="Philippine Holidays 2025"
          description="System automatically detects these holidays"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <VStack gap="3" align="start">
              <H4>Regular Holidays (2x Pay)</H4>
              <VStack gap="2" className="w-full">
                {holidays
                  .filter((h) => h.holiday_type === "regular")
                  .map((holiday) => (
                    <HStack
                      key={holiday.id}
                      justify="between"
                      align="center"
                      className="p-2 bg-red-50 rounded w-full"
                    >
                      <BodySmall>{holiday.holiday_name}</BodySmall>
                      <Caption>
                        {formatDateDisplay(holiday.holiday_date)}
                      </Caption>
                    </HStack>
                  ))}
              </VStack>
            </VStack>

            <VStack gap="3" align="start">
              <H4>Non-Working Holidays (1.3x Pay)</H4>
              <VStack gap="2" className="w-full">
                {holidays
                  .filter((h) => h.holiday_type === "non-working")
                  .map((holiday) => (
                    <HStack
                      key={holiday.id}
                      justify="between"
                      align="center"
                      className="p-2 bg-yellow-50 rounded w-full"
                    >
                      <BodySmall>{holiday.holiday_name}</BodySmall>
                      <Caption>
                        {formatDateDisplay(holiday.holiday_date)}
                      </Caption>
                    </HStack>
                  ))}
              </VStack>
            </VStack>
          </div>
        </CardSection>
      </VStack>

      {/* Add User Modal */}
      <Dialog
        open={showUserModal}
        onOpenChange={(open) => {
          setShowUserModal(open);
          if (!open) {
            // Clear form and errors when closing
            setNewUser({
              email: "",
              full_name: "",
              password: "",
              role: "hr",
              ot_groups: [],
            });
            setSelectedOTGroups([]);
            setEditingUser(null);
            setEmailError("");
            setPasswordError("");
          } else if (editingUser) {
            // Pre-populate form when editing
            setNewUser({
              email: editingUser.email,
              full_name: editingUser.full_name,
              password: "", // Don't pre-fill password
              role: editingUser.role,
              ot_groups: editingUser.assigned_ot_groups?.map(g => g.id) || [],
            });
            setSelectedOTGroups(editingUser.assigned_ot_groups?.map(g => g.id) || []);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              e.stopPropagation();

              // Validate OT groups for Approver/Viewer roles
              if ((newUser.role === "approver" || newUser.role === "viewer") && selectedOTGroups.length === 0) {
                toast.error("Please select at least one OT group for Approver/Viewer roles");
                return;
              }

              // If editing, update user without password
              if (editingUser) {
                setCreatingUser(true);
                try {
                  // Update user role if changed
                  const { error: updateError } = await (supabase.from("users") as any)
                    .update({ role: newUser.role })
                    .eq("id", editingUser.id);

                  if (updateError) throw updateError;

                  // Update OT groups if Approver/Viewer
                  if ((newUser.role === "approver" || newUser.role === "viewer") && selectedOTGroups.length > 0) {
                    await assignUserToOTGroups(editingUser.id, newUser.role, selectedOTGroups);
                  }

                  toast.success("User updated successfully!");
                  setShowUserModal(false);
                  setEditingUser(null);
                  setSelectedOTGroups([]);
                  await loadData();
                  return;
                } catch (error: any) {
                  console.error("Error updating user:", error);
                  toast.error(error.message || "Failed to update user");
                  return;
                } finally {
                  setCreatingUser(false);
                }
              }

              const formData = {
                email: newUser.email,
                full_name: newUser.full_name,
                password: newUser.password,
                role: newUser.role,
                ot_groups: selectedOTGroups,
              };

              console.log("=== FORM SUBMIT TRIGGERED ===", {
                formData,
                creatingUser,
                passwordLength: formData.password?.length,
                passwordValue: formData.password ? "***" : "empty",
              });

              if (creatingUser) {
                console.warn("Form submission blocked - already creating user");
                toast.error("Please wait, user creation in progress...");
                return;
              }

              // Call handleCreateUser
              console.log("Calling handleCreateUser...");
              handleCreateUser().catch((error) => {
                console.error("Error in form submit handler:", error);
                toast.error(error.message || "Failed to create user");
              });
            }}
            onKeyDown={(e) => {
              // Allow Enter key to submit
              if (e.key === "Enter" && !creatingUser) {
                console.log("Enter key pressed in form");
              }
            }}
          >
            <VStack gap="4" className="mt-4">
              <VStack gap="2" align="start" className="w-full">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => {
                    setNewUser({ ...newUser, email: e.target.value });
                    if (e.target.value) {
                      validateEmail(e.target.value);
                    } else {
                      setEmailError("");
                    }
                  }}
                  onBlur={(e) => validateEmail(e.target.value)}
                  disabled={creatingUser}
                  className={emailError ? "border-destructive" : ""}
                />
                {emailError && (
                  <Caption className="text-destructive">{emailError}</Caption>
                )}
              </VStack>

              <VStack gap="2" align="start" className="w-full">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  type="text"
                  placeholder="John Doe"
                  value={newUser.full_name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, full_name: e.target.value })
                  }
                  disabled={creatingUser}
                />
              </VStack>

              {!editingUser && (
                <VStack gap="2" align="start" className="w-full">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={newUser.password}
                    onChange={(e) => {
                      setNewUser({ ...newUser, password: e.target.value });
                      if (e.target.value) {
                        validatePassword(e.target.value);
                      } else {
                        setPasswordError("");
                      }
                    }}
                    onBlur={(e) => validatePassword(e.target.value)}
                    disabled={creatingUser}
                    className={passwordError ? "border-destructive" : ""}
                  />
                  {passwordError ? (
                    <Caption className="text-destructive">
                      {passwordError}
                    </Caption>
                  ) : (
                    <Caption className="text-muted-foreground">
                      Password must be at least 8 characters long
                    </Caption>
                  )}
                </VStack>
              )}

              <VStack gap="2" align="start" className="w-full">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: "admin" | "hr" | "approver" | "viewer") =>
                    setNewUser({ ...newUser, role: value })
                  }
                  disabled={creatingUser}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="approver">Approver</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </VStack>

              {/* OT Groups Assignment (only for Approver/Viewer roles) */}
              {(newUser.role === "approver" || newUser.role === "viewer" || editingUser) && (
                <VStack gap="2" align="start" className="w-full">
                  <Label htmlFor="ot_groups">
                    OT Groups Assignment *
                    <BodySmall className="text-muted-foreground mt-1">
                      Select which employee groups this {newUser.role === "approver" ? "approver" : "viewer"} can manage
                    </BodySmall>
                  </Label>
                  <div className="grid grid-cols-2 gap-2 w-full max-h-48 overflow-y-auto border rounded-md p-2">
                    {overtimeGroups.map((group) => (
                      <label
                        key={group.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOTGroups.includes(group.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOTGroups([...selectedOTGroups, group.id]);
                            } else {
                              setSelectedOTGroups(
                                selectedOTGroups.filter((id) => id !== group.id)
                              );
                            }
                          }}
                          disabled={creatingUser}
                          className="rounded border-gray-300"
                        />
                        <BodySmall className="text-sm">{group.name}</BodySmall>
                      </label>
                    ))}
                  </div>
                  {selectedOTGroups.length === 0 && (
                    <Caption className="text-destructive">
                      Please select at least one OT group
                    </Caption>
                  )}
                </VStack>
              )}
            </VStack>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowUserModal(false);
                  setNewUser({
                    email: "",
                    full_name: "",
                    password: "",
                    role: "hr",
                    ot_groups: [],
                  });
                  setSelectedOTGroups([]);
                  setEditingUser(null);
                }}
                disabled={creatingUser}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creatingUser || (!editingUser && !newUser.password)}
                className={creatingUser ? "opacity-50 cursor-not-allowed" : ""}
                onClick={(e) => {
                  // Also handle click directly as fallback
                  console.log("Button clicked directly", {
                    newUser,
                    creatingUser,
                    passwordLength: newUser.password?.length,
                    editingUser: !!editingUser,
                  });
                  // Let form handle submission, but log for debugging
                }}
              >
                {creatingUser ? (
                  <>
                    <Icon
                      name="ArrowsClockwise"
                      size={IconSizes.sm}
                      className="animate-spin mr-2"
                    />
                    {editingUser ? "Updating..." : "Creating..."}
                  </>
                ) : editingUser ? (
                  "Update User"
                ) : (
                  "Create User"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate User Confirmation Dialog */}
      <AlertDialog
        open={!!userToDeactivate}
        onOpenChange={(open) => !open && setUserToDeactivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <strong>{userToDeactivate?.full_name}</strong>? They will not be
              able to log in until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingStatus}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                userToDeactivate &&
                handleUpdateUserStatus(userToDeactivate.id, false)
              }
              disabled={updatingStatus}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {updatingStatus ? (
                <>
                  <Icon
                    name="ArrowsClockwise"
                    size={IconSizes.sm}
                    className="animate-spin mr-2"
                  />
                  Deactivating...
                </>
              ) : (
                "Deactivate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate User Confirmation Dialog */}
      <AlertDialog
        open={!!userToActivate}
        onOpenChange={(open) => !open && setUserToActivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to activate{" "}
              <strong>{userToActivate?.full_name}</strong>? They will be able to
              log in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingStatus}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                userToActivate &&
                handleUpdateUserStatus(userToActivate.id, true)
              }
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <>
                  <Icon
                    name="ArrowsClockwise"
                    size={IconSizes.sm}
                    className="animate-spin mr-2"
                  />
                  Activating...
                </>
              ) : (
                "Activate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog
        open={!!userToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setUserToDelete(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <strong>{userToDelete?.full_name}</strong> and remove all their
              data from the system.
              <br />
              <br />
              Type <strong className="text-destructive">delete</strong> to
              confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="text"
              placeholder="Type 'delete' to confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              disabled={deletingUser}
              className={
                deleteConfirmText &&
                deleteConfirmText.toLowerCase() !== "delete"
                  ? "border-destructive"
                  : ""
              }
            />
            {deleteConfirmText &&
              deleteConfirmText.toLowerCase() !== "delete" && (
                <Caption className="text-destructive mt-1">
                  Please type "delete" exactly to confirm
                </Caption>
              )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={
                deletingUser || deleteConfirmText.toLowerCase() !== "delete"
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingUser ? (
                <>
                  <Icon
                    name="ArrowsClockwise"
                    size={IconSizes.sm}
                    className="animate-spin mr-2"
                  />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OT Assignment Details Modal */}
      <Dialog open={showOTDetailsModal} onOpenChange={setShowOTDetailsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              OT Assignments for {editingUser?.full_name}
            </DialogTitle>
          </DialogHeader>

          <VStack gap="6" className="mt-4">
            {/* Group-based assignments */}
            {editingUser?.assigned_ot_groups && editingUser.assigned_ot_groups.length > 0 && (
              <div>
                <H4 className="mb-3 flex items-center gap-2">
                  <Icon name="UsersThree" size={IconSizes.md} className="text-green-600" />
                  Group-Based Assignments ({editingUser.assigned_ot_groups.length})
                </H4>
                <div className="space-y-2">
                  {editingUser.assigned_ot_groups.map((group) => (
                    <Card key={group.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              group.approver_id === editingUser.id
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }
                          >
                            {group.approver_id === editingUser.id ? "Approver" : "Viewer"}
                          </Badge>
                          <BodySmall className="font-medium">{group.name}</BodySmall>
                        </div>
                        <Caption className="text-muted-foreground">
                          {group.approver_id === editingUser.id
                            ? "Can approve OT requests"
                            : "Can view OT requests"}
                        </Caption>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Employee-specific assignments */}
            {editingUser?.employee_specific_assignments && editingUser.employee_specific_assignments.length > 0 && (
              <div>
                <H4 className="mb-3 flex items-center gap-2">
                  <Icon name="User" size={IconSizes.md} className="text-purple-600" />
                  Employee-Specific Assignments ({editingUser.employee_specific_assignments.length})
                </H4>
                <div className="space-y-2">
                  {editingUser.employee_specific_assignments.map((emp) => (
                    <Card key={emp.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              emp.overtime_approver_id === editingUser.id
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-orange-50 text-orange-700 border-orange-200"
                            }
                          >
                            {emp.overtime_approver_id === editingUser.id ? "Approver" : "Viewer"}
                          </Badge>
                          <div>
                            <BodySmall className="font-medium">{emp.full_name}</BodySmall>
                            <Caption className="text-muted-foreground">ID: {emp.employee_id}</Caption>
                          </div>
                        </div>
                        <Caption className="text-muted-foreground">
                          {emp.overtime_approver_id === editingUser.id
                            ? "Can approve OT requests"
                            : "Can view OT requests"}
                        </Caption>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* No assignments */}
            {(!editingUser?.assigned_ot_groups || editingUser.assigned_ot_groups.length === 0) &&
             (!editingUser?.employee_specific_assignments || editingUser.employee_specific_assignments.length === 0) && (
              <div className="text-center py-8">
                <Icon name="User" size={IconSizes.lg} className="mx-auto mb-2 opacity-50 text-muted-foreground" />
                <BodySmall className="text-muted-foreground">No OT assignments</BodySmall>
              </div>
            )}
          </VStack>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOTDetailsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
