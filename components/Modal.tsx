"use client";

import React from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
}

const sizeMap: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  footer,
}: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("gap-4 p-6", sizeMap[size])}>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold leading-tight">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm sm:text-base">{children}</div>

        {footer && <DialogFooter className="gap-2">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
