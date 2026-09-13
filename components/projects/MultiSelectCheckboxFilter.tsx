"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dbFilterSelect } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
};

type MultiSelectCheckboxFilterProps = {
  label: string;
  allLabel: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
  emptyMeansAll?: boolean;
  /** Show a mini search box above the option list (useful for long lists). */
  searchable?: boolean;
  searchPlaceholder?: string;
};

function summarizeSelection(
  selected: string[],
  options: MultiSelectOption[],
  allLabel: string,
  label: string
): string {
  if (selected.length === 0) return allLabel;
  if (selected.length === 1) {
    const match = options.find((option) => option.value === selected[0]);
    return match?.label ?? selected[0];
  }
  return `${label} (${selected.length})`;
}

export function MultiSelectCheckboxFilter({
  label,
  allLabel,
  options,
  selected,
  onChange,
  className,
  emptyMeansAll = true,
  searchable = false,
  searchPlaceholder,
}: MultiSelectCheckboxFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedSet = new Set(selected);

  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(needle)
    );
  }, [options, query, searchable]);

  function toggle(value: string, checked: boolean) {
    if (checked) {
      onChange([...selected, value]);
      return;
    }
    onChange(selected.filter((item) => item !== value));
  }

  function selectAll() {
    onChange(emptyMeansAll ? [] : options.map((option) => option.value));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            dbFilterSelect,
            "justify-between font-normal",
            className
          )}
          aria-label={label}
        >
          <span className="truncate">
            {summarizeSelection(selected, options, allLabel, label)}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-[min(22rem,90vw)]">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {searchable ? (
          <div
            className="px-2 pb-2"
            onKeyDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}…`}
                className="h-8 pl-7 text-sm"
                aria-label={`Search ${label.toLowerCase()}`}
              />
            </div>
          </div>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={selected.length === 0}
          onCheckedChange={(checked) => {
            if (checked) selectAll();
          }}
          onSelect={(event) => event.preventDefault()}
        >
          {allLabel}
        </DropdownMenuCheckboxItem>
        {selected.length > 0 ? (
          <DropdownMenuCheckboxItem
            checked={false}
            onCheckedChange={() => clearAll()}
            onSelect={(event) => event.preventDefault()}
          >
            Clear selection
          </DropdownMenuCheckboxItem>
        ) : null}
        <DropdownMenuSeparator />
        {filteredOptions.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">No matches</p>
        ) : (
          filteredOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selectedSet.has(option.value)}
              onCheckedChange={(checked) =>
                toggle(option.value, Boolean(checked))
              }
              onSelect={(event) => event.preventDefault()}
            >
              <span className="truncate" title={option.label}>
                {option.label}
              </span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
