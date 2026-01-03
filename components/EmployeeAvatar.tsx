"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface EmployeeAvatarProps {
  profilePictureUrl?: string | null;
  fullName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-10 w-10", // Increased from h-8 w-8
  md: "h-12 w-12", // Increased from h-10 w-10
  lg: "h-16 w-16", // Increased from h-12 w-12
};

export function EmployeeAvatar({
  profilePictureUrl,
  fullName,
  size = "md",
  className,
}: EmployeeAvatarProps) {
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Avatar className={cn(sizeMap[size], className)}>
      <AvatarImage src={profilePictureUrl || undefined} alt={fullName} />
      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
        {getInitials(fullName)}
      </AvatarFallback>
    </Avatar>
  );
}
