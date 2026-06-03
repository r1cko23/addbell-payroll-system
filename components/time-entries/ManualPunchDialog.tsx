"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";

export type ManualPunchEmployee = {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
};

function formatEmployeeLabel(emp: ManualPunchEmployee): string {
  const nameParts = emp.full_name?.trim().split(/\s+/) || [];
  const lastName =
    emp.last_name || (nameParts.length > 0 ? nameParts[nameParts.length - 1] : "");
  const firstName =
    emp.first_name || (nameParts.length > 0 ? nameParts[0] : "");
  const middleParts = nameParts.length > 2 ? nameParts.slice(1, -1) : [];
  if (lastName && firstName) {
    return `${lastName.toUpperCase()}, ${firstName.toUpperCase()}${middleParts.length > 0 ? " " + middleParts.join(" ").toUpperCase() : ""} (${emp.employee_id})`;
  }
  return `${emp.full_name} (${emp.employee_id})`;
}

function formatForDatetimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildDeviceInfo(punchType: "in" | "out", notes: string): string {
  const label = punchType === "in" ? "time in" : "time out";
  const trimmed = notes.trim();
  return trimmed
    ? `admin:manual ${label} — ${trimmed}`
    : `admin:manual ${label}`;
}

type ManualPunchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: ManualPunchEmployee[];
  onSuccess: () => void | Promise<void>;
};

export function ManualPunchDialog({
  open,
  onOpenChange,
  employees,
  onSuccess,
}: ManualPunchDialogProps) {
  const supabase = createClient();
  const [punchType, setPunchType] = useState<"in" | "out">("in");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [punchedAt, setPunchedAt] = useState(() => formatForDatetimeLocal(new Date()));
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(
      (emp) =>
        emp.full_name?.toLowerCase().includes(q) ||
        emp.employee_id.toLowerCase().includes(q) ||
        emp.last_name?.toLowerCase().includes(q) ||
        emp.first_name?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const resetForm = () => {
    setPunchType("in");
    setSelectedIds(new Set());
    setPunchedAt(formatForDatetimeLocal(new Date()));
    setNotes("");
    setSearch("");
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const toggleEmployee = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredEmployees.forEach((emp) => next.add(emp.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one employee");
      return;
    }
    if (!punchedAt) {
      toast.error("Enter a date and time for the punch");
      return;
    }

    const punchedAtIso = new Date(punchedAt).toISOString();
    const deviceInfo = buildDeviceInfo(punchType, notes);
    const label = punchType === "in" ? "Time in" : "Time out";

    setSaving(true);
    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const employeeId of selectedIds) {
        const { error } = await supabase.from("time_entries").insert({
          employee_id: employeeId,
          punch_type: punchType,
          punched_at: punchedAtIso,
          device_info: deviceInfo,
          source: "admin_correction",
        });

        if (error) {
          failCount += 1;
          const emp = employees.find((e) => e.id === employeeId);
          errors.push(`${emp ? formatEmployeeLabel(emp) : employeeId}: ${error.message}`);
        } else {
          successCount += 1;
        }
      }

      if (failCount > 0 && successCount === 0) {
        toast.error(`Failed to add ${label.toLowerCase()}`, {
          description: errors[0],
        });
        return;
      }

      if (failCount > 0) {
        toast.warning(`${label} added for ${successCount}; ${failCount} failed`, {
          description: errors[0],
        });
      } else {
        toast.success(`${label} added for ${successCount} employee${successCount === 1 ? "" : "s"}`, {
          description: deviceInfo,
        });
      }

      await onSuccess();
      handleClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to add punch: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manual punch</DialogTitle>
          <DialogDescription>
            Add a single time in or time out for one or more employees. Use this for
            bundy backfills and corrections (entries are marked as admin manual punches).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Punch type</Label>
            <Tabs
              value={punchType}
              onValueChange={(value) => setPunchType(value as "in" | "out")}
              className="mt-2"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="in">Time in</TabsTrigger>
                <TabsTrigger value="out">Time out</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div>
            <Label htmlFor="manual-punch-datetime">
              {punchType === "in" ? "Time in" : "Time out"} date &amp; time *
            </Label>
            <Input
              id="manual-punch-datetime"
              type="datetime-local"
              value={punchedAt}
              onChange={(e) => setPunchedAt(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <Label>Employees * ({selectedIds.size} selected)</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectFiltered}>
                  Select shown
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
            <Input
              placeholder="Search by name or employee ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
              {filteredEmployees.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  No employees match your search.
                </p>
              ) : (
                filteredEmployees.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.has(emp.id)}
                      onCheckedChange={(checked) =>
                        toggleEmployee(emp.id, checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span className="text-sm leading-snug">{formatEmployeeLabel(emp)}</span>
                  </label>
                ))
              )}
            </div>
            <Caption className="text-muted-foreground mt-1">
              You can add time in only, time out only, or run this twice for a pair.
            </Caption>
          </div>

          <div>
            <Label htmlFor="manual-punch-notes">Reason / notes (optional)</Label>
            <Textarea
              id="manual-punch-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Bundy bug — could not clock in on May 28"
              className="mt-1"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || selectedIds.size === 0 || !punchedAt}
          >
            {saving ? (
              <>
                <Icon
                  name="ArrowsClockwise"
                  size={IconSizes.sm}
                  className="animate-spin mr-2"
                />
                Saving...
              </>
            ) : (
              <>
                <Icon name="Check" size={IconSizes.sm} className="mr-2" />
                Add {punchType === "in" ? "time in" : "time out"}
                {selectedIds.size > 1 ? ` (${selectedIds.size})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
