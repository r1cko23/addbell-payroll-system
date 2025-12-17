"use client";

import * as React from "react";
import { SpinnerGap } from "phosphor-react";

import {
  Button as ShadButton,
  type ButtonProps as ShadButtonProps,
} from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LegacyVariant = "primary" | "secondary" | "danger" | "ghost";
type LegacySize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ShadButtonProps, "variant" | "size"> {
  variant?: LegacyVariant | ShadButtonProps["variant"];
  size?: LegacySize | ShadButtonProps["size"];
  isLoading?: boolean;
  children: React.ReactNode;
}

const variantMap: Record<LegacyVariant, ShadButtonProps["variant"]> = {
  primary: "default",
  secondary: "secondary",
  danger: "destructive",
  ghost: "ghost",
};

const sizeMap: Record<LegacySize, ShadButtonProps["size"]> = {
  sm: "sm",
  md: "default",
  lg: "lg",
};

export function Button({
  variant = "default",
  size = "default",
  isLoading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const resolvedVariant = (variantMap[variant as LegacyVariant] ??
    variant) as ShadButtonProps["variant"];
  const resolvedSize = (sizeMap[size as LegacySize] ??
    size) as ShadButtonProps["size"];

  return (
    <ShadButton
      variant={resolvedVariant}
      size={resolvedSize}
      disabled={disabled || isLoading}
      className={cn("gap-2", className)}
      {...props}
    >
      {isLoading && <SpinnerGap className="h-4 w-4 animate-spin" />}
      {children}
    </ShadButton>
  );
}
