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
  role: "admin" | "hr" | "account_manager";
  is_active: boolean;
  profile_picture_url: string | null;
  created_at: string;
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
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "hr" as "admin" | "hr" | "account_manager",
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

      // Load all users (admin only)
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .order("full_name");

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Load holidays
      const { data: holidaysData, error: holidaysError } = await supabase
        .from("holidays")
        .select("*")
        .eq("year", 2025)
        .order("holiday_date");

      if (holidaysError) throw holidaysError;
      setHolidays(holidaysData || []);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  const isAdmin = currentUser?.role === "admin";

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

      toast.success(`User created successfully!`, {
        description: `${data.user.full_name} • ${data.user.email} • Role: ${data.user.role}`,
      });
      setShowUserModal(false);
      setNewUser({
        email: "",
        full_name: "",
        password: "",
        role: "hr",
      });
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
                      {currentUser?.role?.toUpperCase()}
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-gray-200">
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
                              : user.role === "account_manager"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {user.role === "account_manager"
                            ? "ACCOUNT MANAGER"
                            : user.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Badge
                          variant={user.is_active ? "default" : "secondary"}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
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
            });
            setEmailError("");
            setPasswordError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              e.stopPropagation();

              const formData = {
                email: newUser.email,
                full_name: newUser.full_name,
                password: newUser.password,
                role: newUser.role,
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

              <VStack gap="2" align="start" className="w-full">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: "admin" | "hr" | "account_manager") =>
                    setNewUser({ ...newUser, role: value })
                  }
                  disabled={creatingUser}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="account_manager">
                      Account Manager
                    </SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </VStack>
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
                  });
                }}
                disabled={creatingUser}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creatingUser}
                className={creatingUser ? "opacity-50 cursor-not-allowed" : ""}
                onClick={(e) => {
                  // Also handle click directly as fallback
                  console.log("Button clicked directly", {
                    newUser,
                    creatingUser,
                    passwordLength: newUser.password?.length,
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
                    Creating...
                  </>
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
    </DashboardLayout>
  );
}
