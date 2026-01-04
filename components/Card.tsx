"use client";

import React from "react";

import {
  Card as ShadCard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string | React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Card({
  children,
  className = "",
  title,
  subtitle,
  action,
}: CardProps) {
  const titleNode =
    typeof title === "string" ? (
      <CardTitle className="text-lg">{title}</CardTitle>
    ) : (
      title
    );

  return (
    <ShadCard className={cn("border border-border shadow-sm", className)}>
      {(title || subtitle || action) && (
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            {title && titleNode}
            {subtitle && <CardDescription>{subtitle}</CardDescription>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(title || subtitle ? "pt-0 sm:pt-0" : "pt-4")}>
        {children}
      </CardContent>
    </ShadCard>
  );
}