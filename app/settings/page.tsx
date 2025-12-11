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

interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "hr";
  is_active: boolean;
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
          <VStack gap="3">
            <HStack justify="between" align="center" className="w-full">
              <BodySmall>Name:</BodySmall>
              <span className="font-semibold">{currentUser?.full_name}</span>
            </HStack>
            <HStack justify="between" align="center" className="w-full">
              <BodySmall>Email:</BodySmall>
              <span className="font-semibold">{currentUser?.email}</span>
            </HStack>
            <HStack justify="between" align="center" className="w-full">
              <BodySmall>Role:</BodySmall>
              <Badge variant={isAdmin ? "default" : "secondary"}>
                {currentUser?.role?.toUpperCase()}
              </Badge>
            </HStack>
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
                            user.role === "admin" ? "default" : "secondary"
                          }
                        >
                          {user.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Badge
                          variant={user.is_active ? "default" : "secondary"}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
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

        {/* System Info */}
        <CardSection title="System Information">
          <VStack gap="3">
            <HStack justify="between" align="center" className="w-full">
              <BodySmall>Version:</BodySmall>
              <span className="font-semibold">2.0.0</span>
            </HStack>
            <HStack justify="between" align="center" className="w-full">
              <BodySmall>Database:</BodySmall>
              <span className="font-semibold">Supabase (PostgreSQL)</span>
            </HStack>
            <HStack justify="between" align="center" className="w-full">
              <BodySmall>Hosting:</BodySmall>
              <span className="font-semibold">Vercel</span>
            </HStack>
            <HStack justify="between" align="center" className="w-full">
              <BodySmall>Total Employees:</BodySmall>
              <span className="font-semibold">{users.length}</span>
            </HStack>
          </VStack>
        </CardSection>

        {/* Help */}
        <CardSection title="Need Help?">
          <VStack gap="2">
            <BodySmall>
              📖 <strong>Documentation:</strong> Check SETUP.md and README_V2.md
              in the project root
            </BodySmall>
            <BodySmall>
              🚀 <strong>Quick Start:</strong> See QUICKSTART.md for a 30-minute
              setup guide
            </BodySmall>
            <BodySmall>
              💡 <strong>Payroll Process:</strong> Enter Timesheet → Generate
              Payslips → Print/Export
            </BodySmall>
          </VStack>
        </CardSection>
      </VStack>

      {/* Modals */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <BodySmall>
            To add new users, please use the Supabase dashboard Authentication
            section, then add them to the public.users table.
          </BodySmall>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowUserModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => toast("Feature coming soon!")}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
