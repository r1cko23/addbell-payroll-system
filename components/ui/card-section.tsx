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
    <Card className={cn("w-full min-w-0 max-w-full overflow-hidden", className)}>
      {(title || description) && (
        <CardHeader className={cn("px-3 pb-2 pt-3 sm:px-6 sm:pb-4 sm:pt-6", headerClassName)}>
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
      <CardContent className="w-full min-w-0 max-w-full space-y-3 overflow-hidden p-3 sm:space-y-4 sm:p-6">{children}</CardContent>
    </Card>
  );
}