"use client";

import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "phosphor-react";
import { cn } from "@/lib/utils";

/**
 * Tall payslip preview — pinned to viewport (not vertically centered) so footer
 * actions are always visible without browser zoom.
 */
export function PayslipPreviewDialogContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border bg-background shadow-lg duration-200",
          "inset-x-2 top-2 bottom-2 w-auto max-w-none gap-0 p-0",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "sm:inset-x-auto sm:left-1/2 sm:right-auto sm:top-[2dvh] sm:bottom-[2dvh] sm:w-[min(56rem,calc(100vw-2rem))] sm:max-w-4xl sm:-translate-x-1/2 sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-md opacity-70 ring-offset-background transition-opacity hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <X className="size-4" weight="bold" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function PayslipPreviewDialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "shrink-0 border-b bg-background px-4 pb-2 pt-3 pr-12 sm:px-6 sm:pr-14",
        className
      )}
      {...props}
    />
  );
}

export function PayslipPreviewDialogBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain bg-muted/20 px-2 py-2 pb-6 sm:px-4 sm:py-3 sm:pb-8",
        className
      )}
      {...props}
    />
  );
}

export function PayslipPreviewDialogFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "shrink-0 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-6",
        className
      )}
      {...props}
    />
  );
}

/** Letter-size preview; zoom shrinks layout box (not just visual transform). */
export function PayslipPreviewDocument({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-fit origin-top",
        "[zoom:0.45] sm:[zoom:0.58] md:[zoom:0.72] lg:[zoom:0.88] xl:[zoom:1]",
        className
      )}
    >
      {children}
    </div>
  );
}
