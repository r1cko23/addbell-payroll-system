"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";

export interface EmployeeOption {
  id: string;
  employee_id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
}

function formatEmployeeDisplay(emp: EmployeeOption): string {
  const nameParts = emp.full_name?.trim().split(/\s+/) || [];
  const lastName = emp.last_name ?? (nameParts.length > 0 ? nameParts[nameParts.length - 1] : "");
  const firstName = emp.first_name ?? (nameParts.length > 0 ? nameParts[0] : "");
  const middleParts = nameParts.length > 2 ? nameParts.slice(1, -1) : [];
  if (lastName && firstName) {
    return `${lastName.toUpperCase()}, ${firstName.toUpperCase()}${middleParts.length > 0 ? " " + middleParts.join(" ").toUpperCase() : ""} (${emp.employee_id})`;
  }
  return emp.full_name ? `${emp.full_name} (${emp.employee_id})` : emp.employee_id;
}

function matchEmployee(query: string, emp: EmployeeOption): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return (
    emp.full_name?.toLowerCase().includes(q) ||
    emp.last_name?.toLowerCase().includes(q) ||
    emp.first_name?.toLowerCase().includes(q) ||
    emp.employee_id.toLowerCase().includes(q)
  );
}

export interface EmployeeSearchSelectProps {
  employees: EmployeeOption[];
  value: string;
  onValueChange: (value: string) => void;
  showAllOption?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function EmployeeSearchSelect({
  employees,
  value,
  onValueChange,
  showAllOption = true,
  placeholder = "Search by name or employee ID...",
  className,
  triggerClassName,
  disabled = false,
}: EmployeeSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = value && value !== "all" ? employees.find((e) => e.id === value) : null;
  const displayValue =
    value === "all" || !value
      ? showAllOption
        ? "All Employees"
        : ""
      : selectedEmployee
        ? formatEmployeeDisplay(selectedEmployee)
        : "";

  const filtered = query.trim()
    ? employees.filter((emp) => matchEmployee(query, emp))
    : employees;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onValueChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Icon
          name="MagnifyingGlass"
          size={IconSizes.sm}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          type="search"
          placeholder={showAllOption ? "All Employees" : placeholder}
          value={open ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          className={cn("pl-9", triggerClassName)}
        />
      </div>
      {open && (
        <ul
          className="absolute z-50 mt-1 max-h-60 w-full min-w-full overflow-auto rounded-md border border-input bg-popover py-1 text-sm shadow-md"
        >
          {showAllOption && (
            <li
              role="option"
              className={cn(
                "cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground",
                (value === "all" || !value) && "bg-accent/50"
              )}
              onClick={() => handleSelect("all")}
            >
              All Employees
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No employees found.</li>
          ) : (
            filtered.map((emp) => (
              <li
                key={emp.id}
                role="option"
                className={cn(
                  "cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground",
                  value === emp.id && "bg-accent/50"
                )}
                onClick={() => handleSelect(emp.id)}
              >
                {formatEmployeeDisplay(emp)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}