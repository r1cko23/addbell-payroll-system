import React from "react";
import * as PhosphorIcons from "phosphor-react";
import { cn } from "@/lib/utils";

// Common icon names used in the app - extend as needed
type PhosphorIconName =
  | "Plus"
  | "MagnifyingGlass"
  | "User"
  | "PencilSimple"
  | "Key"
  | "Power"
  | "ArrowsClockwise"
  | "CalendarBlank"
  | "Check"
  | "MapPin"
  | "X"
  | "CaretRight"
  | "CaretDown"
  | "CaretUp"
  | "Clock"
  | "SignOut"
  | "List"
  | "WarningCircle"
  | "Timer"
  | "ChartPieSlice"
  | "ChatCircleDots"
  | "ClockClockwise"
  | "CalendarCheck"
  | "CurrencyDollarSimple"
  | "ChartLineUp"
  | "Gear"
  | "UsersThree"
  | "Receipt"
  | "CaretLeft"
  | "Buildings"
  | "FileText"
  | "Printer"
  | "Eye"
  | "Info"
  | "ArrowLeft"
  | "CalendarBlank"
  | "CheckCircle"
  | "Hourglass"
  | "Paperclip"
  | "XCircle"
  | "TrashSimple"
  | "Trash"
  | "UserMinus"
  | "UserPlus"
  | "DotsThreeVertical"
  | "FloppyDisk"
  | "Clock"
  | "ArrowRight"
  | "Camera"
  | "Lock"
  | "SignIn"
  | "CalendarX"
  | "Moon"
  | "Download"
  | "FileArrowDown"
  | "ArrowDown"
  | "FileCsv";

interface PhosphorIconProps {
  name: PhosphorIconName;
  size?: 16 | 20 | 24 | 32 | 40;
  weight?: "thin" | "light" | "regular" | "bold" | "fill";
  className?: string;
  color?: string;
}

export function Icon({
  name,
  size = 20,
  weight = "regular",
  className = "",
  color,
}: PhosphorIconProps) {
  const IconComponent = PhosphorIcons[name] as React.ComponentType<any>;

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in Phosphor Icons`);
    return null;
  }

  return (
    <IconComponent
      size={size}
      weight={weight}
      color={color}
      className={cn("inline-block", className)}
    />
  );
}

// Size presets for common UI patterns
export const IconSizes = {
  xs: 16 /* Small badges, tight UI */,
  sm: 20 /* Inputs, buttons, nav items */,
  md: 24 /* Standard UI, cards */,
  lg: 32 /* Feature highlights */,
  xl: 40 /* Hero sections */,
} as const;
