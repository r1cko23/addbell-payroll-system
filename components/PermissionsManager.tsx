"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { H4, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  MODULE_INFO,
  DEFAULT_PERMISSIONS,
  MODULES,
  ACTIONS,
  clearPermissionsCache,
  type ModuleName,
  type ActionName,
  type UserPermissions,
  type ModulePermissions,
} from "@/lib/hooks/usePermissions";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "hr" | "approver" | "viewer";
  is_active: boolean;
  permissions: UserPermissions | null;
}

interface PermissionsManagerProps {
  users: User[];
  onPermissionsUpdate: () => void;
}

// Group modules by category
const CATEGORY_LABELS: Record<string, string> = {
  overview: "Overview",
  people: "People Management",
  time: "Time & Attendance",
  admin: "Administration",
  settings: "Settings",
};

const CATEGORY_ORDER = ["overview", "people", "time", "admin", "settings"];

export function PermissionsManager({ users, onPermissionsUpdate }: PermissionsManagerProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState<UserPermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const supabase = createClient();

  // Group modules by category
  const modulesByCategory = useMemo(() => {
    const grouped: Record<string, typeof MODULE_INFO> = {};
    for (const module of MODULE_INFO) {
      if (!grouped[module.category]) {
        grouped[module.category] = [];
      }
      grouped[module.category].push(module);
    }
    return grouped;
  }, []);

  // Filter out admin users (they always have full access)
  const editableUsers = useMemo(() => {
    return users.filter((user) => user.role !== "admin");
  }, [users]);

  // Get effective permissions for a user (custom or role defaults)
  const getEffectivePermissions = (user: User): UserPermissions => {
    if (user.permissions) {
      // Merge custom with defaults
      const defaults = DEFAULT_PERMISSIONS[user.role] || DEFAULT_PERMISSIONS.viewer;
      const merged = { ...defaults };
      for (const [module, perms] of Object.entries(user.permissions)) {
        if (merged[module as ModuleName]) {
          merged[module as ModuleName] = {
            ...merged[module as ModuleName],
            ...(perms as ModulePermissions),
          };
        }
      }
      return merged;
    }
    return DEFAULT_PERMISSIONS[user.role] || DEFAULT_PERMISSIONS.viewer;
  };

  // Open modal to edit user permissions
  const handleEditPermissions = (user: User) => {
    setSelectedUser(user);
    setEditingPermissions(getEffectivePermissions(user));
    setHasChanges(false);
    setShowModal(true);
  };

  // Toggle a single permission
  const handleTogglePermission = (module: ModuleName, action: ActionName) => {
    if (!editingPermissions) return;

    setEditingPermissions({
      ...editingPermissions,
      [module]: {
        ...editingPermissions[module],
        [action]: !editingPermissions[module][action],
      },
    });
    setHasChanges(true);
  };

  // Toggle all permissions for a module
  const handleToggleModuleAll = (module: ModuleName, enabled: boolean) => {
    if (!editingPermissions) return;

    setEditingPermissions({
      ...editingPermissions,
      [module]: {
        create: enabled,
        read: enabled,
        update: enabled,
        delete: enabled,
      },
    });
    setHasChanges(true);
  };

  // Reset to role defaults
  const handleResetToDefaults = () => {
    if (!selectedUser) return;
    setEditingPermissions(DEFAULT_PERMISSIONS[selectedUser.role] || DEFAULT_PERMISSIONS.viewer);
    setHasChanges(true);
  };

  // Save permissions
  const handleSavePermissions = async () => {
    if (!selectedUser || !editingPermissions) return;

    setSaving(true);
    try {
      // Calculate the diff from role defaults to only store customizations
      const defaults = DEFAULT_PERMISSIONS[selectedUser.role] || DEFAULT_PERMISSIONS.viewer;
      const customPerms: Partial<UserPermissions> = {};
      let hasCustomizations = false;

      for (const [module, perms] of Object.entries(editingPermissions)) {
        const defaultPerms = defaults[module as ModuleName];
        if (defaultPerms) {
          const moduleCustom: Partial<ModulePermissions> = {};
          let moduleHasCustom = false;

          for (const action of Object.values(ACTIONS)) {
            if ((perms as ModulePermissions)[action] !== defaultPerms[action]) {
              moduleCustom[action] = (perms as ModulePermissions)[action];
              moduleHasCustom = true;
              hasCustomizations = true;
            }
          }

          if (moduleHasCustom) {
            customPerms[module as ModuleName] = {
              ...defaultPerms,
              ...moduleCustom,
            };
          }
        }
      }

      // Save to database - only store customizations, or null if using defaults
      const { error } = await supabase
        .from("users")
        .update({
          permissions: hasCustomizations ? customPerms : null,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      // Clear permissions cache
      clearPermissionsCache();

      toast.success("Permissions updated successfully", {
        description: `Updated permissions for ${selectedUser.full_name}`,
      });

      setShowModal(false);
      setSelectedUser(null);
      setEditingPermissions(null);
      setHasChanges(false);
      onPermissionsUpdate();
    } catch (error: any) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to save permissions", {
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  // Count permissions for display
  const getPermissionSummary = (user: User): { total: number; enabled: number } => {
    const perms = getEffectivePermissions(user);
    let total = 0;
    let enabled = 0;

    for (const module of Object.values(perms)) {
      for (const action of Object.values(module)) {
        total++;
        if (action) enabled++;
      }
    }

    return { total, enabled };
  };

  // Check if all actions for a module are enabled
  const isModuleFullyEnabled = (module: ModuleName): boolean => {
    if (!editingPermissions) return false;
    const perms = editingPermissions[module];
    return perms.create && perms.read && perms.update && perms.delete;
  };

  // Check if module has mixed permissions
  const isModulePartiallyEnabled = (module: ModuleName): boolean => {
    if (!editingPermissions) return false;
    const perms = editingPermissions[module];
    const enabled = [perms.create, perms.read, perms.update, perms.delete].filter(Boolean).length;
    return enabled > 0 && enabled < 4;
  };

  return (
    <VStack gap="4" className="w-full">
      {/* User Permissions List */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Permissions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Custom
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-gray-200">
            {editableUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                  <Icon name="ShieldCheck" size={IconSizes.md} className="mx-auto mb-2 opacity-50" />
                  <p>No users to configure permissions for.</p>
                  <Caption>Admin users always have full access.</Caption>
                </td>
              </tr>
            ) : (
              editableUsers.map((user) => {
                const summary = getPermissionSummary(user);
                const hasCustom = user.permissions !== null;

                return (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <VStack gap="1" align="start">
                        <BodySmall className="font-medium">{user.full_name}</BodySmall>
                        <Caption className="text-muted-foreground">{user.email}</Caption>
                      </VStack>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="secondary">{user.role.toUpperCase()}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <HStack gap="2" align="center">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(summary.enabled / summary.total) * 100}%` }}
                          />
                        </div>
                        <Caption className="text-muted-foreground">
                          {summary.enabled}/{summary.total}
                        </Caption>
                      </HStack>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {hasCustom ? (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          Custom
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Default
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPermissions(user)}
                        disabled={!user.is_active}
                      >
                        <Icon name="Sliders" size={IconSizes.sm} className="mr-2" />
                        Configure
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Permissions Modal */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (!open && hasChanges) {
            // Confirm before closing with unsaved changes
            if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
              setShowModal(false);
              setSelectedUser(null);
              setEditingPermissions(null);
              setHasChanges(false);
            }
          } else {
            setShowModal(open);
            if (!open) {
              setSelectedUser(null);
              setEditingPermissions(null);
              setHasChanges(false);
            }
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="ShieldCheck" size={IconSizes.md} />
              Configure Permissions
            </DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <>
                  Managing permissions for{" "}
                  <strong>{selectedUser.full_name}</strong> ({selectedUser.role.toUpperCase()})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {editingPermissions && (
            <VStack gap="6" className="mt-4">
              {/* Quick Actions */}
              <HStack justify="between" align="center" className="border-b pb-4">
                <HStack gap="2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetToDefaults}
                    disabled={saving}
                  >
                    <Icon name="ArrowCounterClockwise" size={IconSizes.sm} className="mr-2" />
                    Reset to Defaults
                  </Button>
                </HStack>
                {hasChanges && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                    Unsaved changes
                  </Badge>
                )}
              </HStack>

              {/* Permissions Grid by Category */}
              {CATEGORY_ORDER.map((category) => {
                const modules = modulesByCategory[category];
                if (!modules || modules.length === 0) return null;

                return (
                  <Card key={category}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium">
                        {CATEGORY_LABELS[category] || category}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        {/* Header row */}
                        <div className="grid grid-cols-6 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                          <div className="col-span-2">Module</div>
                          <div className="text-center">Create</div>
                          <div className="text-center">Read</div>
                          <div className="text-center">Update</div>
                          <div className="text-center">Delete</div>
                        </div>

                        {/* Module rows */}
                        {modules.map((moduleInfo) => {
                          const moduleKey = moduleInfo.key;
                          const perms = editingPermissions[moduleKey];
                          const isFullyEnabled = isModuleFullyEnabled(moduleKey);
                          const isPartial = isModulePartiallyEnabled(moduleKey);

                          return (
                            <div
                              key={moduleKey}
                              className="grid grid-cols-6 gap-2 items-center py-2 hover:bg-accent/50 rounded px-2 -mx-2"
                            >
                              <div className="col-span-2">
                                <HStack gap="3" align="center">
                                  <Checkbox
                                    id={`${moduleKey}-all`}
                                    checked={isFullyEnabled}
                                    ref={(ref) => {
                                      if (ref) {
                                        (ref as any).indeterminate = isPartial;
                                      }
                                    }}
                                    onCheckedChange={(checked) => {
                                      handleToggleModuleAll(moduleKey, checked === true);
                                    }}
                                    disabled={saving}
                                  />
                                  <VStack gap="0" align="start">
                                    <Label
                                      htmlFor={`${moduleKey}-all`}
                                      className="text-sm font-medium cursor-pointer"
                                    >
                                      {moduleInfo.label}
                                    </Label>
                                    <Caption className="text-muted-foreground text-xs">
                                      {moduleInfo.description}
                                    </Caption>
                                  </VStack>
                                </HStack>
                              </div>

                              {/* CRUD Checkboxes */}
                              {(["create", "read", "update", "delete"] as ActionName[]).map(
                                (action) => (
                                  <div key={action} className="flex justify-center">
                                    <Checkbox
                                      id={`${moduleKey}-${action}`}
                                      checked={perms[action]}
                                      onCheckedChange={() =>
                                        handleTogglePermission(moduleKey, action)
                                      }
                                      disabled={saving}
                                    />
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </VStack>
          )}

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                if (hasChanges) {
                  if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
                    setShowModal(false);
                  }
                } else {
                  setShowModal(false);
                }
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={saving || !hasChanges}>
              {saving ? (
                <>
                  <Icon
                    name="ArrowsClockwise"
                    size={IconSizes.sm}
                    className="animate-spin mr-2"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <Icon name="Check" size={IconSizes.sm} className="mr-2" />
                  Save Permissions
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
}
