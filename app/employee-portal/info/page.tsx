"use client";

import { useMemo } from "react";
import { CardSection } from "@/components/ui/card-section";
import { Card, CardContent } from "@/components/ui/card";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { H2, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { useSessionQuery } from "@/lib/hooks/useSessionQuery";
import { bustCache } from "@/lib/cache-client";
import { format } from "date-fns";
import { epPageWrapper } from "@/lib/employee-portal-ui";
import { cn } from "@/lib/utils";
import { ProfilePictureUpload } from "@/components/ProfilePictureUpload";
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
  const profileKey = `employee-profile:${employee.id}`;
  const profileUrl = `/api/employee-portal/employee-profile?employee_id=${encodeURIComponent(
    employee.id
  )}`;

  const { data: profileData, loading, error, refresh } = useSessionQuery<{
    error?: string;
    company_id_no?: string | null;
    employee_code?: string | null;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    middle_name?: string | null;
    address?: string | null;
    date_of_birth?: string | null;
    tin?: string | null;
    sss_number?: string | null;
    philhealth_number?: string | null;
    pagibig_number?: string | null;
    is_active?: boolean | null;
    created_at?: string | null;
  }>(profileKey, profileUrl, { enabled: !!employee?.id });

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

  const info = useMemo((): EmployeeInfo | null => {
    if (loading && !profileData) return null;
    if (error) return fallbackInfo;
    if (
      profileData &&
      (profileData.full_name || profileData.company_id_no || profileData.employee_code)
    ) {
      return {
        employee_id:
          profileData.company_id_no ??
          profileData.employee_code ??
          employee.employee_id,
        full_name: profileData.full_name ?? employee.full_name,
        first_name: profileData.first_name ?? null,
        last_name: profileData.last_name ?? null,
        middle_initial: profileData.middle_name
          ? profileData.middle_name.charAt(0).toUpperCase()
          : null,
        assigned_hotel: null,
        assigned_locations: [],
        address: profileData.address ?? null,
        birth_date: profileData.date_of_birth ?? null,
        tin_number: profileData.tin ?? null,
        sss_number: profileData.sss_number ?? null,
        philhealth_number: profileData.philhealth_number ?? null,
        pagibig_number: profileData.pagibig_number ?? null,
        hmo_provider: null,
        profile_picture_url: null,
        is_active: profileData.is_active ?? true,
        created_at: profileData.created_at ?? employee.loginTime,
      };
    }
    return fallbackInfo;
  }, [loading, profileData, error, fallbackInfo, employee]);

  const errorMessage = error
    ? "Unable to load the HR record right now. Showing the information we have on file."
    : profileData &&
        !(profileData.full_name || profileData.company_id_no || profileData.employee_code)
      ? "We could not find your HR profile, so we are showing the basic information from your session."
      : null;

  if (loading || !info) {
    return (
      <div className={cn("w-full", epPageWrapper)}>
        <SkeletonCard />
        <div className="w-full grid gap-4 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="py-3 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
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

  return (
    <div className={cn("w-full", epPageWrapper)}>
      <PortalPageHeader
        title="My Information"
        description="Your profile and government IDs on file."
      />
      <CardSection>
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
                await bustCache();
                await refresh({ force: true });
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
                className="w-full flex-col items-start gap-1 sm:flex-row sm:gap-2"
              >
                <dt className="text-sm font-semibold text-muted-foreground min-w-0 break-words">
                  {row.label}
                </dt>
                <dd className="w-full min-w-0 break-words text-left text-sm font-medium text-foreground whitespace-normal sm:flex-1">
                  {row.value}
                </dd>
              </HStack>
            </div>
          ))}
        </dl>
      </CardSection>

      <Card className="w-full border-primary/20 bg-primary/5 p-5 shadow-sm">
        <VStack gap="2" align="start">
          <HStack gap="2" align="center">
            <Icon
              name="Info"
              size={IconSizes.sm}
              className="text-primary"
            />
            <BodySmall className="font-semibold text-primary">
              Need to update something?
            </BodySmall>
          </HStack>
          <BodySmall className="pl-6 text-primary/85">
            Contact your HR representative to request changes to your profile.
          </BodySmall>
        </VStack>
      </Card>
    </div>
  );
}