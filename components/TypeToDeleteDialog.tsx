"use client";

import { useState, type ReactNode } from "react";
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
import { Input } from "@/components/ui/input";
import { Caption } from "@/components/ui/typography";

const CONFIRM_WORD = "delete";

interface TypeToDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  deleting?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function TypeToDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  deleting = false,
  onConfirm,
}: TypeToDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const isConfirmed = confirmText.toLowerCase() === CONFIRM_WORD;
  const showMismatch = confirmText.length > 0 && !isConfirmed;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setConfirmText("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {description}
              <p>
                Type <strong className="text-destructive">{CONFIRM_WORD}</strong>{" "}
                to confirm:
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-1">
          <Input
            type="text"
            placeholder={`Type '${CONFIRM_WORD}' to confirm`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={deleting}
            className={showMismatch ? "border-destructive" : ""}
          />
          {showMismatch ? (
            <Caption className="mt-1 text-destructive">
              Please type &quot;{CONFIRM_WORD}&quot; exactly to confirm
            </Caption>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            disabled={deleting || !isConfirmed}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Deleting..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
