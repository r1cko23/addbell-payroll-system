"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import {
  ACCESS_CATEGORY_LABELS,
  ACCESS_CATEGORY_ORDER,
  ACCESS_FUNCTION_CAPABILITIES,
  ACCESS_PAGE_CAPABILITIES,
  type AccessCapability,
  type AccessCategory,
} from "@/lib/access";
import { MODULE_INFO, type ModuleName } from "@/lib/permissions";

type GrantPickerProps = {
  selectedKeys: Set<string> | string[];
  onChange: (nextKeys: string[]) => void;
  disabled?: boolean;
};

function toSet(selectedKeys: Set<string> | string[]): Set<string> {
  return selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys);
}

function groupByCategory(
  capabilities: AccessCapability[]
): { category: AccessCategory; items: AccessCapability[] }[] {
  return ACCESS_CATEGORY_ORDER.map((category) => ({
    category,
    items: capabilities.filter((c) => c.category === category),
  })).filter((g) => g.items.length > 0);
}

function moduleLabel(module: ModuleName): string {
  return MODULE_INFO.find((m) => m.key === module)?.label ?? module;
}

function CategorySelectAll({
  label,
  keys,
  selected,
  onToggleMany,
  disabled,
}: {
  label: string;
  keys: string[];
  selected: Set<string>;
  onToggleMany: (keys: string[], checked: boolean) => void;
  disabled?: boolean;
}) {
  const enabled = keys.filter((k) => selected.has(k)).length;
  const all = enabled === keys.length && keys.length > 0;
  const partial = enabled > 0 && !all;
  const id = `grant-cat-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <HStack gap="2" align="center" className="mb-2">
      <Checkbox
        id={id}
        checked={all}
        disabled={disabled || keys.length === 0}
        ref={(ref) => {
          if (ref) {
            (ref as HTMLButtonElement & { indeterminate?: boolean }).indeterminate =
              partial;
          }
        }}
        onCheckedChange={(value) => onToggleMany(keys, value === true)}
      />
      <Label
        htmlFor={id}
        className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
        <span className="ml-1.5 font-normal normal-case tracking-normal">
          ({enabled}/{keys.length})
        </span>
      </Label>
    </HStack>
  );
}

function PagesColumn({
  selected,
  onToggle,
  onToggleMany,
  disabled,
}: {
  selected: Set<string>;
  onToggle: (key: string, checked: boolean) => void;
  onToggleMany: (keys: string[], checked: boolean) => void;
  disabled?: boolean;
}) {
  const groups = groupByCategory(ACCESS_PAGE_CAPABILITIES);

  return (
    <section className="rounded-md border">
      <header className="border-b bg-muted/40 px-4 py-3">
        <h3 className="text-sm font-medium">Pages</h3>
        <Caption className="text-muted-foreground">
          Screens this user can open. Read access is implied by a page grant.
        </Caption>
      </header>
      <div className="max-h-[28rem] space-y-4 overflow-y-auto p-3 sm:max-h-[32rem]">
        {groups.map(({ category, items }) => (
          <div key={category}>
            <CategorySelectAll
              label={ACCESS_CATEGORY_LABELS[category]}
              keys={items.map((i) => i.key)}
              selected={selected}
              onToggleMany={onToggleMany}
              disabled={disabled}
            />
            <ul className="space-y-0.5 border-l border-border/60 pl-2 ml-1.5">
              {items.map((cap) => {
                const id = `grant-${cap.key}`;
                return (
                  <li key={cap.key}>
                    <HStack
                      gap="3"
                      align="start"
                      className="rounded px-2 py-1.5 hover:bg-accent/40"
                    >
                      <Checkbox
                        id={id}
                        checked={selected.has(cap.key)}
                        disabled={disabled}
                        onCheckedChange={(value) =>
                          onToggle(cap.key, value === true)
                        }
                      />
                      <VStack gap="0" align="start" className="min-w-0">
                        <Label
                          htmlFor={id}
                          className="cursor-pointer text-sm font-medium"
                        >
                          {cap.label}
                        </Label>
                        {cap.description ? (
                          <Caption className="text-xs text-muted-foreground">
                            {cap.description}
                          </Caption>
                        ) : null}
                      </VStack>
                    </HStack>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function FunctionsColumn({
  selected,
  onToggle,
  onToggleMany,
  disabled,
}: {
  selected: Set<string>;
  onToggle: (key: string, checked: boolean) => void;
  onToggleMany: (keys: string[], checked: boolean) => void;
  disabled?: boolean;
}) {
  const groups = groupByCategory(ACCESS_FUNCTION_CAPABILITIES);

  return (
    <section className="rounded-md border">
      <header className="border-b bg-muted/40 px-4 py-3">
        <h3 className="text-sm font-medium">Functions</h3>
        <Caption className="text-muted-foreground">
          Create, update, and delete actions grouped by area and page.
        </Caption>
      </header>
      <div className="max-h-[28rem] space-y-4 overflow-y-auto p-3 sm:max-h-[32rem]">
        {groups.map(({ category, items }) => {
          const byModule = new Map<ModuleName, AccessCapability[]>();
          for (const cap of items) {
            const list = byModule.get(cap.module) ?? [];
            list.push(cap);
            byModule.set(cap.module, list);
          }

          return (
            <div key={category}>
              <CategorySelectAll
                label={ACCESS_CATEGORY_LABELS[category]}
                keys={items.map((i) => i.key)}
                selected={selected}
                onToggleMany={onToggleMany}
                disabled={disabled}
              />
              <div className="space-y-2 border-l border-border/60 pl-2 ml-1.5">
                {[...byModule.entries()].map(([module, caps]) => (
                  <div
                    key={module}
                    className="rounded-md bg-muted/20 px-2 py-2"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {moduleLabel(module)}
                      </span>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                        disabled={disabled}
                        onClick={() => {
                          const keys = caps.map((c) => c.key);
                          const allOn = keys.every((k) => selected.has(k));
                          onToggleMany(keys, !allOn);
                        }}
                      >
                        {caps.every((c) => selected.has(c.key))
                          ? "Clear"
                          : "All actions"}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {caps.map((cap) => {
                        const id = `grant-${cap.key}`;
                        const actionLabel = cap.action ?? cap.label;
                        return (
                          <label
                            key={cap.key}
                            htmlFor={id}
                            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-accent/50"
                          >
                            <Checkbox
                              id={id}
                              checked={selected.has(cap.key)}
                              disabled={disabled}
                              onCheckedChange={(value) =>
                                onToggle(cap.key, value === true)
                              }
                            />
                            <span className="text-xs capitalize text-muted-foreground">
                              {actionLabel}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function GrantPicker({
  selectedKeys,
  onChange,
  disabled,
}: GrantPickerProps) {
  const selected = toSet(selectedKeys);

  const handleToggle = (key: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    onChange([...next].sort());
  };

  const handleToggleMany = (keys: string[], checked: boolean) => {
    const next = new Set(selected);
    for (const key of keys) {
      if (checked) next.add(key);
      else next.delete(key);
    }
    onChange([...next].sort());
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PagesColumn
        selected={selected}
        onToggle={handleToggle}
        onToggleMany={handleToggleMany}
        disabled={disabled}
      />
      <FunctionsColumn
        selected={selected}
        onToggle={handleToggle}
        onToggleMany={handleToggleMany}
        disabled={disabled}
      />
    </div>
  );
}
