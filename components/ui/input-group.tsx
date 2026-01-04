import { ReactNode } from "react";
import { Input } from "./input";
import { Label } from "./label";
import { cn } from "@/lib/utils";

interface InputGroupProps {
  label?: string;
  description?: string;
  error?: string;
  children?: ReactNode;
  className?: string;
  [key: string]: any;
}

export function InputGroup({
  label,
  description,
  error,
  children,
  className,
  ...inputProps
}: InputGroupProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      {children || <Input {...inputProps} />}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}