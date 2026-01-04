import React, { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./card";
import { cn } from "@/lib/utils";

interface CardSectionProps {
  title?: string | ReactNode;
  description?: string | ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}

export function CardSection({
  title,
  description,
  children,
  className = "",
  headerClassName = "",
}: CardSectionProps) {
  return (
    <Card className={cn("w-full", className)}>
      {(title || description) && (
        <CardHeader className={cn("pb-4", headerClassName)}>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className="p-6 space-y-4 w-full">{children}</CardContent>
    </Card>
  );
}