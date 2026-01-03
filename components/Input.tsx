"use client";

import React, { useId } from "react";

import {
  Select as ShadSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input as ShadInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea as ShadTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  label,
  error,
  helperText,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id || useId();

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
          {props.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <ShadInput
        id={inputId}
        className={cn(
          error ? "border-destructive focus-visible:ring-destructive" : "",
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {helperText && !error && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Textarea({
  label,
  error,
  helperText,
  className = "",
  id,
  ...props
}: TextareaProps) {
  const textareaId = id || useId();

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <Label htmlFor={textareaId} className="text-sm font-medium">
          {label}
          {props.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <ShadTextarea
        id={textareaId}
        className={cn(
          error ? "border-destructive focus-visible:ring-destructive" : "",
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {helperText && !error && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  onChange?: (event: { target: { value: string } }) => void;
}

export function Select({
  label,
  error,
  helperText,
  options,
  value,
  placeholder,
  disabled,
  onValueChange,
  onChange,
}: SelectProps) {
  const selectId = useId();
  const resolvedPlaceholder =
    placeholder ||
    options.find((opt) => opt.value === "")?.label ||
    "Select an option";

  const handleValueChange = (next: string) => {
    onValueChange?.(next);
    onChange?.({ target: { value: next } });
  };

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <Label htmlFor={selectId} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <ShadSelect
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={selectId}
          className={cn(
            error ? "border-destructive focus:ring-destructive" : ""
          )}
        >
          <SelectValue placeholder={resolvedPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </ShadSelect>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {helperText && !error && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
