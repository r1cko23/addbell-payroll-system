"use client";

import { useState } from "react";
import { Key } from "phosphor-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  epDialogContentForm,
  epFormActionButton,
  epFormActions,
} from "@/lib/employee-portal-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BodySmall, Caption } from "@/components/ui/typography";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ChangePasswordDialogProps = {
  employeeId?: string;
  /** Dashboard staff use Supabase Auth; employees use portal_password. */
  variant?: "employee" | "dashboard";
  className?: string;
  /** Hide button label below this Tailwind breakpoint (md = employee portal mobile). */
  compactBelow?: "sm" | "md";
};

export function ChangePasswordDialog({
  employeeId,
  variant = "employee",
  className,
  compactBelow = "sm",
}: ChangePasswordDialogProps) {
  const compactClass =
    compactBelow === "md"
      ? "h-9 w-9 px-0 md:h-9 md:w-auto md:px-3"
      : "h-9 w-9 px-0 sm:h-9 sm:w-auto sm:px-3";
  const labelHiddenClass =
    compactBelow === "md" ? "hidden md:inline" : "hidden sm:inline";
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

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
      const endpoint =
        variant === "dashboard"
          ? "/api/auth/change-password"
          : "/api/employee/change-password";

      if (variant === "employee" && !employeeId) {
        throw new Error("Employee account is required to change password");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          variant === "dashboard"
            ? {
                current_password: currentPassword.trim(),
                new_password: newPassword.trim(),
              }
            : {
                employee_id: employeeId,
                current_password: currentPassword.trim(),
                new_password: newPassword.trim(),
              }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      toast.success("Password updated successfully!");
      handleOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update password. Please try again.";
      setPasswordError(message);
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium",
            compactClass,
            className
          )}
          aria-label="Change password"
        >
          <Key className="h-4 w-4 shrink-0" weight="bold" />
          <span className={labelHiddenClass}>Change password</span>
        </Button>
      </DialogTrigger>
      <DialogContent className={epDialogContentForm}>
        <DialogHeader className="space-y-1 pr-10 text-left">
          <DialogTitle className="text-base leading-snug sm:text-lg">
            Change password
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handlePasswordChange} className="space-y-3 sm:space-y-4">
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="current-password" className="text-sm">
              Current password
            </Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setPasswordError(null);
              }}
              required
              disabled={isChangingPassword}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="new-password" className="text-sm">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordError(null);
              }}
              required
              disabled={isChangingPassword}
              autoComplete="new-password"
            />
            <Caption className="text-muted-foreground">
              At least 4 characters
            </Caption>
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="confirm-password" className="text-sm">
              Confirm new password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError(null);
              }}
              required
              disabled={isChangingPassword}
              autoComplete="new-password"
            />
          </div>
          {passwordError ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 sm:px-4 sm:py-3">
              <BodySmall className="text-sm leading-snug text-destructive">
                {passwordError}
              </BodySmall>
            </div>
          ) : null}
          <div className={epFormActions}>
            <Button
              type="button"
              variant="outline"
              className={epFormActionButton}
              onClick={() => handleOpenChange(false)}
              disabled={isChangingPassword}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={epFormActionButton}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
