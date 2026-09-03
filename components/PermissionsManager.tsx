"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { BodySmall, Caption } from "@/components/ui/typography";
import { VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GrantPicker } from "@/components/GrantPicker";
import {
  grantsMatchPack,
  packGrantKeys,
  STARTER_PACK_IDS,
  starterPackLabel,
} from "@/lib/access";
import { clearPermissionsCache } from "@/lib/hooks/usePermissions";
import type { UserPermissions } from "@/lib/permissions";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  permissions: UserPermissions | null;
}

interface PermissionsManagerProps {
  users: User[];
  onPermissionsUpdate: () => void;
}

type GrantsByUser = Record<string, string[]>;

function formatPackLabel(role: string): string {
  return starterPackLabel(role).replace(/_/g, " ").toUpperCase();
}

export function PermissionsManager({
  users,
  onPermissionsUpdate,
}: PermissionsManagerProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingKeys, setEditingKeys] = useState<string[]>([]);
  const [editingPack, setEditingPack] = useState<string>("viewer");
  const [grantsByUser, setGrantsByUser] = useState<GrantsByUser>({});
  const [loadingGrants, setLoadingGrants] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const editableUsers = useMemo(() => {
    return users.filter(
      (user) => user.role !== "admin" && user.role !== "upper_management"
    );
  }, [users]);

  const loadAllGrants = useCallback(async () => {
    setLoadingGrants(true);
    const next: GrantsByUser = {};
    try {
      await Promise.all(
        editableUsers.map(async (user) => {
          const res = await fetch(
            `/api/access/grants?userId=${encodeURIComponent(user.id)}`
          );
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(body?.error || `Failed to load grants for ${user.email}`);
          }
          const data = (await res.json()) as { keys: string[] };
          next[user.id] = data.keys ?? [];
        })
      );
      setGrantsByUser(next);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to load access grants", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoadingGrants(false);
    }
  }, [editableUsers]);

  useEffect(() => {
    void loadAllGrants();
  }, [loadAllGrants]);

  const handleEdit = async (user: User) => {
    setSelectedUser(user);
    setEditingPack(starterPackLabel(user.role));
    setHasChanges(false);
    setShowModal(true);

    let keys = grantsByUser[user.id];
    if (!keys) {
      try {
        const res = await fetch(
          `/api/access/grants?userId=${encodeURIComponent(user.id)}`
        );
        if (!res.ok) throw new Error("Failed to load grants");
        const data = (await res.json()) as { keys: string[] };
        keys = data.keys ?? [];
        setGrantsByUser((prev) => ({ ...prev, [user.id]: keys! }));
      } catch {
        keys = packGrantKeys(user.role);
      }
    }
    setEditingKeys(keys);
  };

  const handleApplyPack = (packId: string) => {
    setEditingPack(packId);
    setEditingKeys(packGrantKeys(packId));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await fetch("/api/access/grants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          keys: editingKeys,
          role: editingPack,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Failed to save grants");
      }
      const data = (await res.json()) as { keys: string[] };
      setGrantsByUser((prev) => ({
        ...prev,
        [selectedUser.id]: data.keys,
      }));
      clearPermissionsCache();
      toast.success("Access grants updated", {
        description: `Updated grants for ${selectedUser.full_name}`,
      });
      setShowModal(false);
      setSelectedUser(null);
      setHasChanges(false);
      onPermissionsUpdate();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to save grants", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setHasChanges(false);
  };

  return (
    <VStack gap="4" className="w-full">
      <Caption className="text-muted-foreground">
        Assign pages this user can open and functions they can run. Role is a
        starter pack only.
      </Caption>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Starter pack
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Grants
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-card">
            {editableUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-sm text-muted-foreground"
                >
                  <Icon
                    name="ShieldCheck"
                    size={IconSizes.md}
                    className="mx-auto mb-2 opacity-50"
                  />
                  <p>No users to configure grants for.</p>
                  <Caption>
                    Admin and Upper Management always have full access and are
                    not listed.
                  </Caption>
                </td>
              </tr>
            ) : (
              editableUsers.map((user) => {
                const keys = grantsByUser[user.id] ?? [];
                const isCustom = keys.length
                  ? !grantsMatchPack(keys, user.role)
                  : user.permissions !== null;
                const grantCount = loadingGrants && !grantsByUser[user.id]
                  ? "…"
                  : String(keys.length);

                return (
                  <tr key={user.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <VStack gap="1" align="start">
                        <BodySmall className="font-medium">
                          {user.full_name}
                        </BodySmall>
                        <Caption className="text-muted-foreground">
                          {user.email}
                        </Caption>
                      </VStack>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge variant="secondary">
                        {formatPackLabel(user.role)}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Caption className="text-muted-foreground">
                        {grantCount} grants
                      </Caption>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {isCustom ? (
                        <Badge
                          variant="outline"
                          className="border-yellow-200 bg-yellow-50 text-yellow-700"
                        >
                          Custom
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          Default
                        </Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleEdit(user)}
                        disabled={!user.is_active || loadingGrants}
                      >
                        <Icon
                          name="Sliders"
                          size={IconSizes.sm}
                          className="mr-2"
                        />
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

      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (!open && hasChanges) {
            if (
              window.confirm(
                "You have unsaved changes. Are you sure you want to close?"
              )
            ) {
              closeModal();
            }
          } else if (!open) {
            closeModal();
          } else {
            setShowModal(true);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="ShieldCheck" size={IconSizes.md} />
              Configure Access Grants
            </DialogTitle>
            <DialogDescription>
              {selectedUser ? (
                <>
                  Pages and functions for{" "}
                  <strong>{selectedUser.full_name}</strong>. Role is a starter
                  pack only.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <VStack gap="4" className="mt-2">
            <div className="flex flex-wrap items-end gap-3 border-b pb-4">
              <div className="space-y-1.5">
                <Label htmlFor="starter-pack">Starter pack</Label>
                <Select
                  value={editingPack}
                  onValueChange={handleApplyPack}
                  disabled={saving}
                >
                  <SelectTrigger id="starter-pack" className="w-[220px]">
                    <SelectValue placeholder="Select pack" />
                  </SelectTrigger>
                  <SelectContent>
                    {STARTER_PACK_IDS.map((id) => (
                      <SelectItem key={id} value={id}>
                        {formatPackLabel(id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => handleApplyPack(editingPack)}
              >
                <Icon
                  name="ArrowCounterClockwise"
                  size={IconSizes.sm}
                  className="mr-2"
                />
                Apply pack
              </Button>
              {hasChanges ? (
                <Badge
                  variant="outline"
                  className="bg-yellow-50 text-yellow-700"
                >
                  Unsaved changes
                </Badge>
              ) : null}
            </div>

            <GrantPicker
              selectedKeys={editingKeys}
              disabled={saving}
              onChange={(keys) => {
                setEditingKeys(keys);
                setHasChanges(true);
              }}
            />
          </VStack>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                if (hasChanges) {
                  if (
                    window.confirm(
                      "You have unsaved changes. Are you sure you want to close?"
                    )
                  ) {
                    closeModal();
                  }
                } else {
                  closeModal();
                }
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || !hasChanges}>
              {saving ? (
                <>
                  <Icon
                    name="ArrowsClockwise"
                    size={IconSizes.sm}
                    className="mr-2 animate-spin"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <Icon name="Check" size={IconSizes.sm} className="mr-2" />
                  Save Grants
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
}
