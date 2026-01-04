"use client";

import { useEffect, useMemo, useState } from "react";
import { CardSection } from "@/components/ui/card-section";
import { Card, CardContent } from "@/components/ui/card";
import { H1, H2, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { format } from "date-fns";
import { ProfilePictureUpload } from "@/components/ProfilePictureUpload";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { toast } from "sonner";

interface EmployeeInfo {
  employee_id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  middle_initial: string | null;
  assigned_hotel: string | null;
  assigned_locations: string[];
  address: string | null;
  birth_date: string | null;
  tin_number: string | null;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
  hmo_provider: string | null;
  profile_picture_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function EmployeeInfoPage() {
  const { employee } = useEmployeeSession();
  const supabase = createClient();
  const [info, setInfo] = useState<EmployeeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const fallbackInfo = useMemo<EmployeeInfo>(
    () => ({
      employee_id: employee.employee_id,
      full_name: employee.full_name,
      first_name: null,
      last_name: null,
      middle_initial: null,
      assigned_hotel: null,
      assigned_locations: [],
      address: null,
      birth_date: null,
      tin_number: null,
      sss_number: null,
      philhealth_number: null,
      pagibig_number: null,
      hmo_provider: null,
      profile_picture_url: null,
      is_active: true,
      created_at: employee.loginTime,
    }),
    [employee.employee_id, employee.full_name, employee.loginTime]
  );

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const { data, error } = await supabase.rpc("get_employee_profile", {
          p_employee_uuid: employee.id,
        } as any);

        if (error) throw error;

        const profileData = data as Array<EmployeeInfo> | null;
        if (profileData && profileData.length > 0) {
          setInfo(profileData[0]);
        } else {
          setInfo(fallbackInfo);
          setErrorMessage(
            "We could not find your HR profile, so we are showing the basic information from your session."
          );
        }
      } catch (err) {
        console.error("Failed to load employee info:", err);
        setInfo(fallbackInfo);
        setErrorMessage(
          "Unable to load the HR record right now. Showing the information we have on file."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [employee.id, fallbackInfo, supabase]);

  if (loading || !info) {
    return (
      <VStack gap="6" className="w-full">
        <SkeletonCard />
        <div className="w-full grid gap-4 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="py-3 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </VStack>
    );
  }

  const rows = [
    { label: "Employee ID", value: info.employee_id },
    { label: "Full Name", value: info.full_name },
    { label: "First Name", value: info.first_name || "—" },
    { label: "Last Name", value: info.last_name || "—" },
    { label: "Middle Initial", value: info.middle_initial || "—" },
    { label: "Address", value: info.address || "—" },
    {
      label: "Birth Date",
      value: info.birth_date
        ? format(new Date(info.birth_date), "MMMM d, yyyy")
        : "—",
    },
    { label: "TIN #", value: info.tin_number || "—" },
    { label: "SSS #", value: info.sss_number || "—" },
    { label: "PhilHealth #", value: info.philhealth_number || "—" },
    { label: "Pag-IBIG #", value: info.pagibig_number || "—" },
    { label: "HMO", value: info.hmo_provider || "—" },
    {
      label: "Assigned Locations",
      value: info.assigned_locations.length
        ? info.assigned_locations.join(", ")
        : "—",
    },
    { label: "Status", value: info.is_active ? "Active" : "Inactive" },
    {
      label: "Date Added",
      value: format(new Date(info.created_at), "MMMM d, yyyy"),
    },
  ];

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    // Validation
    if (!currentPassword.trim()) {
      setPasswordError("Please enter your current password");
      return;
    }

    if (!newPassword.trim()) {
      setPasswordError("Please enter a new password");
      return;
    }

    if (newPassword.trim().length < 4) {
      setPasswordError("Password must be at least 4 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/employee/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employee_id: employee.employee_id,
          current_password: currentPassword.trim(),
          new_password: newPassword.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      toast.success("Password updated successfully!");
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
    } catch (error: any) {
      console.error("Error changing password:", error);
      setPasswordError(error.message || "Failed to update password. Please try again.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <VStack gap="6" className="w-full">
      <CardSection
        title="Employee Information"
        description="Details registered by HR"
      >
        {errorMessage && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
            <BodySmall className="text-yellow-800">{errorMessage}</BodySmall>
          </div>
        )}
        <VStack gap="6" align="center" className="mb-6">
          {employee?.id ? (
            <ProfilePictureUpload
              currentPictureUrl={info?.profile_picture_url || null}
              userId={employee.id}
              userName={info?.full_name || employee.full_name}
              userType="employee"
              onUploadComplete={async () => {
                // Reload employee info
                try {
                  const { data, error } = await supabase.rpc(
                    "get_employee_profile",
                    {
                      p_employee_uuid: employee.id,
                    } as any
                  );
                  const profileData = data as Array<EmployeeInfo> | null;
                  if (!error && profileData && profileData.length > 0) {
                    setInfo(profileData[0]);
                  }
                } catch (err) {
                  console.error("Failed to reload employee info:", err);
                }
              }}
              size="lg"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                <span className="text-muted-foreground text-lg">
                  {(info?.full_name || employee.full_name || "E")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase()}
                </span>
              </div>
              <Caption className="text-xs text-muted-foreground">
                Loading employee information...
              </Caption>
            </div>
          )}
        </VStack>
        <dl className="w-full grid gap-6 md:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="py-2 border-b border-border/50 last:border-0"
            >
              <HStack
                justify="between"
                align="start"
                className="flex-col sm:flex-row gap-2"
              >
                <dt className="text-sm font-semibold text-muted-foreground min-w-[140px]">
                  {row.label}
                </dt>
                <dd className="text-sm font-medium text-foreground text-right sm:text-left flex-1">
                  {row.value}
                </dd>
              </HStack>
            </div>
          ))}
        </dl>
      </CardSection>

      <CardSection
        title="Change Password"
        description="Update your portal password"
      >
        {!showPasswordForm ? (
          <VStack gap="4">
            <BodySmall className="text-muted-foreground">
              Keep your account secure by regularly updating your password.
            </BodySmall>
            <Button
              variant="outline"
              onClick={() => setShowPasswordForm(true)}
            >
              Change Password
            </Button>
          </VStack>
        ) : (
          <form
            onSubmit={handlePasswordChange}
            className="space-y-4"
          >
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setPasswordError(null);
              }}
              required
              disabled={isChangingPassword}
              placeholder="Enter your current password"
            />
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordError(null);
              }}
              required
              disabled={isChangingPassword}
              placeholder="Enter your new password"
              helperText="Must be at least 4 characters long"
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError(null);
              }}
              required
              disabled={isChangingPassword}
              placeholder="Confirm your new password"
            />
            {passwordError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
                <BodySmall className="text-destructive">{passwordError}</BodySmall>
              </div>
            )}
            <HStack gap="3" justify="end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPasswordForm(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordError(null);
                }}
                disabled={isChangingPassword}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isChangingPassword}
                isLoading={isChangingPassword}
              >
                Update Password
              </Button>
            </HStack>
          </form>
        )}
      </CardSection>

      <Card className="w-full p-5 bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200 shadow-sm">
        <VStack gap="2" align="start">
          <HStack gap="2" align="center">
            <Icon
              name="Info"
              size={IconSizes.sm}
              className="text-emerald-700"
            />
            <BodySmall className="font-semibold text-emerald-900">
              Need to update something?
            </BodySmall>
          </HStack>
          <BodySmall className="text-emerald-800 pl-6">
            Contact your HR representative to request changes to your profile.
          </BodySmall>
        </VStack>
      </Card>
    </VStack>
  );
}