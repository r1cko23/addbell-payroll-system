import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StackProps {
  children: ReactNode;
  gap?: "0" | "1" | "2" | "3" | "4" | "6" | "8" | "10";
  direction?: "row" | "col";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "between" | "end";
  className?: string;
}

const gapMap = {
  "0": "gap-0",
  "1": "gap-1",
  "2": "gap-2",
  "3": "gap-3",
  "4": "gap-4",
  "6": "gap-6",
  "8": "gap-8",
  "10": "gap-10",
};

const directionMap = {
  row: "flex-row",
  col: "flex-col",
};

const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const justifyMap = {
  start: "justify-start",
  center: "justify-center",
  between: "justify-between",
  end: "justify-end",
};

export function Stack({
  children,
  gap = "4",
  direction = "col",
  align = "start",
  justify = "start",
  className = "",
}: StackProps) {
  return (
    <div
      className={cn(
        "flex",
        directionMap[direction],
        gapMap[gap],
        alignMap[align],
        justifyMap[justify],
        className
      )}
    >
      {children}
    </div>
  );
}

// Convenience variants
export function HStack({
  children,
  gap = "4",
  ...props
}: Omit<StackProps, "direction">) {
  return (
    <Stack direction="row" gap={gap} {...props}>
      {children}
    </Stack>
  );
}

export function VStack({
  children,
  gap = "4",
  ...props
}: Omit<StackProps, "direction">) {
  return (
    <Stack direction="col" gap={gap} {...props}>
      {children}
    </Stack>
  );
}
