import React, { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./card";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/to-title-case";

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
        <CardHeader className={cn("px-4 pb-4 pt-4 sm:px-6 sm:pt-6", headerClassName)}>
          {title && (
            <CardTitle>
              {typeof title === "string" ? toTitleCase(title) : title}
            </CardTitle>
          )}
          {description && (
            <CardDescription>{description}</CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent className="w-full space-y-4 p-4 sm:p-6">{children}</CardContent>
    </Card>
  );
}