"use client";

import * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);

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

  const updateMenuPosition = () => {
    const el = inputWrapRef.current ?? containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, query, employees.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (
        typeof document !== "undefined" &&
        document.getElementById("employee-search-select-menu")?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onValueChange(id);
    setOpen(false);
    setQuery("");
  };

  const tryCommitQuery = () => {
    const q = query.trim();
    if (!q) return;
    const matches = employees.filter((emp) => matchEmployee(q, emp));
    if (matches.length === 1) {
      handleSelect(matches[0].id);
      return;
    }
    const exact = matches.find((emp) => {
      const label = formatEmployeeDisplay(emp).toLowerCase();
      return label === q.toLowerCase() || emp.full_name?.toLowerCase() === q.toLowerCase();
    });
    if (exact) handleSelect(exact.id);
  };

  const highlightAll =
    (value === "all" || !value) && (!open || !query.trim());

  const menu =
    open && menuRect && typeof document !== "undefined" ? (
      <ul
        id="employee-search-select-menu"
        role="listbox"
        style={{
          position: "fixed",
          top: menuRect.top,
          left: menuRect.left,
          width: menuRect.width,
          zIndex: 9999,
        }}
        className="max-h-60 overflow-auto rounded-md border border-input bg-popover py-1 text-sm shadow-lg"
      >
        {showAllOption && (
          <li
            role="option"
            className={cn(
              "cursor-pointer px-3 py-2 dropdown-item-highlight",
              highlightAll && "dropdown-item-selected"
            )}
            onMouseDown={(e) => e.preventDefault()}
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
                "cursor-pointer px-3 py-2 dropdown-item-highlight",
                value === emp.id && "dropdown-item-selected"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(emp.id)}
            >
              {formatEmployeeDisplay(emp)}
            </li>
          ))
        )}
      </ul>
    ) : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div ref={inputWrapRef} className="relative">
        <Icon
          name="MagnifyingGlass"
          size={IconSizes.sm}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          type="search"
          placeholder={placeholder}
          value={open ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery(value === "all" || !value ? "" : displayValue);
            requestAnimationFrame(updateMenuPosition);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              tryCommitQuery();
            }
            if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!containerRef.current?.contains(document.activeElement)) {
                tryCommitQuery();
                setOpen(false);
              }
            }, 150);
          }}
          disabled={disabled}
          className={cn("pl-9", triggerClassName)}
        />
      </div>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}