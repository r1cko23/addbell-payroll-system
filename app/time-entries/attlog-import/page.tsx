"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/useUserRole";
import {
  buildAttlogPreview,
  normalizeAttlogRows,
  type AttlogColumnMapping,
  type AttlogStateMode,
} from "@/lib/attlog-import";

type OfficeLocationOption = {
  id: string;
  name: string;
};

type ImportResult = {
  inserted: number;
  skipped: number;
  unresolved: Array<{ row: number; employee_code: string; reason: string }>;
};

const NONE = "__none__";

const EMPTY_UI_MAPPING: Record<keyof AttlogColumnMapping, string> = {
  employeeCode: NONE,
  timestamp: NONE,
  date: NONE,
  time: NONE,
  state: NONE,
  deviceSerial: NONE,
  deviceName: NONE,
};

function toUiMapping(mapping: AttlogColumnMapping): Record<keyof AttlogColumnMapping, string> {
  return {
    employeeCode: mapping.employeeCode ?? NONE,
    timestamp: mapping.timestamp ?? NONE,
    date: mapping.date ?? NONE,
    time: mapping.time ?? NONE,
    state: mapping.state ?? NONE,
    deviceSerial: mapping.deviceSerial ?? NONE,
    deviceName: mapping.deviceName ?? NONE,
  };
}

function fromUiMapping(
  mapping: Record<keyof AttlogColumnMapping, string>
): AttlogColumnMapping {
  return {
    employeeCode: mapping.employeeCode === NONE ? null : mapping.employeeCode,
    timestamp: mapping.timestamp === NONE ? null : mapping.timestamp,
    date: mapping.date === NONE ? null : mapping.date,
    time: mapping.time === NONE ? null : mapping.time,
    state: mapping.state === NONE ? null : mapping.state,
    deviceSerial: mapping.deviceSerial === NONE ? null : mapping.deviceSerial,
    deviceName: mapping.deviceName === NONE ? null : mapping.deviceName,
  };
}

function detectFallbackMatrix(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = lines[0].includes("\t")
    ? "\t"
    : lines[0].includes(";")
      ? ";"
      : ",";

  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
}

export default function AttlogImportPage() {
  const supabase = createClient();
  const { isAdmin, isManagement, isHR, loading: roleLoading } = useUserRole();
  const canImport = isManagement || isHR;

  const [officeLocations, setOfficeLocations] = useState<OfficeLocationOption[]>([]);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<keyof AttlogColumnMapping, string>>(
    EMPTY_UI_MAPPING
  );
  const [presetName, setPresetName] = useState<string | null>(null);
  const [mappingLocked, setMappingLocked] = useState(false);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [stateMode, setStateMode] = useState<AttlogStateMode>("file_state");
  const [officeLocationId, setOfficeLocationId] = useState<string>(NONE);
  const [deviceName, setDeviceName] = useState("");
  const [parsingFile, setParsingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (!canImport) return;

    async function loadLocations() {
      const { data, error } = await supabase
        .from("office_locations")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.warn("Failed to load office locations", error);
        return;
      }

      setOfficeLocations((data ?? []) as OfficeLocationOption[]);
    }

    loadLocations();
  }, [canImport, supabase]);

  const normalizedPreview = useMemo(() => {
    if (headers.length === 0 || rows.length === 0) {
      return { punches: [], errors: [], warnings: [] };
    }

    return normalizeAttlogRows({
      headers,
      rows,
      mapping: fromUiMapping(mapping),
      stateMode,
    });
  }, [headers, rows, mapping, stateMode]);

  const previewPunches = normalizedPreview.punches.slice(0, 20);
  const previewErrors = normalizedPreview.errors.slice(0, 20);

  async function handleFileSelected(file: File) {
    setParsingFile(true);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      let matrix: unknown[][] = [];
      const lowerName = file.name.toLowerCase();
      const shouldPreferTextParsing =
        lowerName.endsWith(".dat") || lowerName.endsWith(".txt");

      if (shouldPreferTextParsing) {
        const text = new TextDecoder().decode(buffer);
        matrix = detectFallbackMatrix(text);
      }

      if (matrix.length === 0) {
        try {
          const workbook = XLSX.read(buffer, {
            type: "array",
            cellDates: false,
            raw: false,
          });
          const firstSheet = workbook.SheetNames[0];
          if (firstSheet) {
            matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
              header: 1,
              raw: false,
              defval: "",
              blankrows: false,
            }) as unknown[][];
          }
        } catch {
          // Some biometric exports are plain text even when the extension is unusual.
        }
      }

      if (matrix.length === 0) {
        const text = new TextDecoder().decode(buffer);
        matrix = detectFallbackMatrix(text);
      }

      const preview = buildAttlogPreview(matrix);
      if (preview.headers.length === 0 || preview.rows.length === 0) {
        throw new Error("No attendance rows found in the selected file");
      }

      setFileName(file.name);
      setHeaders(preview.headers);
      setRows(preview.rows);
      setMapping(toUiMapping(preview.suggestedMapping));
      setStateMode(preview.suggestedMapping.state ? "file_state" : "infer_sequence");
      setPresetName(preview.presetName);
      setMappingLocked(preview.mappingLocked);
      setShowAdvancedMapping(false);

      toast.success("AttLog file loaded", {
        description: preview.presetName
          ? `${preview.rows.length} rows detected as ${preview.presetName}.`
          : `${preview.rows.length} rows ready for mapping.`,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to read the selected AttLog file"
      );
      setFileName("");
      setHeaders([]);
      setRows([]);
      setMapping(EMPTY_UI_MAPPING);
      setPresetName(null);
      setMappingLocked(false);
      setShowAdvancedMapping(false);
    } finally {
      setParsingFile(false);
    }
  }

  async function handleImport() {
    if (normalizedPreview.punches.length === 0) {
      toast.error("No valid punches to import");
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const response = await fetch("/api/hr/biometric-attlog-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          punches: normalizedPreview.punches.map((punch) => ({
            employee_code: punch.employee_code,
            punched_at: punch.punched_at,
            punch_type: punch.punch_type,
            device_serial: punch.device_serial,
            device_name: punch.device_name,
            source_row_number: punch.source_row_number,
          })),
          office_location_id: officeLocationId === NONE ? null : officeLocationId,
          default_device_name: deviceName.trim() || null,
        }),
      });

      const json = (await response.json()) as
        | ({ ok: true } & ImportResult)
        | { error?: string };

      if (!response.ok || !("ok" in json)) {
        const message = "error" in json ? json.error : undefined;
        throw new Error(message || "Import failed");
      }

      setImportResult({
        inserted: json.inserted,
        skipped: json.skipped,
        unresolved: json.unresolved,
      });

      toast.success("AttLog import finished", {
        description: `${json.inserted} punches inserted, ${json.skipped} skipped.`,
      });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Loading importer</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!canImport) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>AttLog import is restricted</CardTitle>
              <CardDescription>
                Only HR and admin users can import biometric attendance files.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AttLog Import</h1>
            <p className="text-sm text-muted-foreground">
              Upload a ZKTeco LX50 `AttLog` file, review the preview, then import it into
              `time_entries`.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/time-entries">Back to Time Entries</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How to use this page</CardTitle>
            <CardDescription>
              Export `AttLog` from the LX50, upload the raw file here, then import. The importer
              now auto-detects the sample LX50 `.dat` format you provided.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Use `AttLog`, not `AttReport`</Badge>
            <Badge variant="secondary">LX50 PIN must match `employee_code`</Badge>
            <Badge variant="secondary">Repeated uploads skip exact duplicates</Badge>
            {presetName && <Badge variant="secondary">{presetName} preset detected</Badge>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>1. Upload file</CardTitle>
            <CardDescription>
              Supported inputs include `.txt`, `.csv`, `.xls`, `.xlsx`, and other spreadsheet-style
              exports that contain LX50 attendance rows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="attlog-file">AttLog file</Label>
              <Input
                id="attlog-file"
                type="file"
                accept=".txt,.csv,.xls,.xlsx,.dat"
                disabled={parsingFile}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFileSelected(file);
                  }
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {parsingFile
                ? "Reading file..."
                : fileName
                  ? `Loaded: ${fileName}`
                  : "No file selected yet."}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Import defaults</CardTitle>
            <CardDescription>
              These values are applied when the file does not already contain them.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Office location</Label>
              <Select value={officeLocationId} onValueChange={setOfficeLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="No location tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No location tag</SelectItem>
                  {officeLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="device-name">Default device name</Label>
              <Input
                id="device-name"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                placeholder="e.g. Addbell Main Office LX50"
              />
            </div>

            <div className="space-y-2">
              <Label>Punch type handling</Label>
              <Select
                value={stateMode}
                onValueChange={(value) => setStateMode(value as AttlogStateMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="file_state">Use IN/OUT from file</SelectItem>
                  <SelectItem value="infer_sequence">
                    Infer IN/OUT by punch order per employee/day
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {headers.length > 0 && !mappingLocked && (
          <Card>
            <CardHeader>
              <CardTitle>3. Map AttLog columns</CardTitle>
              <CardDescription>
                Adjust these only if the automatic detection picked the wrong columns.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(
                [
                  ["employeeCode", "Employee PIN / User ID"],
                  ["timestamp", "Combined timestamp"],
                  ["date", "Date column"],
                  ["time", "Time column"],
                  ["state", "IN/OUT state column"],
                  ["deviceSerial", "Device serial column"],
                  ["deviceName", "Device name column"],
                ] as Array<[keyof AttlogColumnMapping, string]>
              ).map(([field, label]) => (
                <div key={field} className="space-y-2">
                  <Label>{label}</Label>
                  <Select
                    value={mapping[field]}
                    onValueChange={(value) =>
                      setMapping((current) => ({
                        ...current,
                        [field]: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not selected" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not selected</SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={`${field}-${header}`} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {headers.length > 0 && mappingLocked && (
          <Card>
            <CardHeader>
              <CardTitle>3. LX50 `.dat` preset applied</CardTitle>
              <CardDescription>
                This file matches your sample LX50 `AttLog` layout, so the importer is already
                using the correct columns: `Employee PIN`, `Timestamp`, and `State`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Employee PIN {"->"} Column A</Badge>
                <Badge variant="outline">Timestamp {"->"} Column B</Badge>
                <Badge variant="outline">State {"->"} Column D</Badge>
              </div>
              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAdvancedMapping((value) => !value)}
                >
                  {showAdvancedMapping ? "Hide Advanced Mapping" : "Show Advanced Mapping"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {headers.length > 0 && mappingLocked && showAdvancedMapping && (
          <Card>
            <CardHeader>
              <CardTitle>Advanced mapping</CardTitle>
              <CardDescription>
                You usually do not need this. Only open it if a future branch export has a
                different LX50 layout.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(
                [
                  ["employeeCode", "Employee PIN / User ID"],
                  ["timestamp", "Combined timestamp"],
                  ["date", "Date column"],
                  ["time", "Time column"],
                  ["state", "IN/OUT state column"],
                  ["deviceSerial", "Device serial column"],
                  ["deviceName", "Device name column"],
                ] as Array<[keyof AttlogColumnMapping, string]>
              ).map(([field, label]) => (
                <div key={field} className="space-y-2">
                  <Label>{label}</Label>
                  <Select
                    value={mapping[field]}
                    onValueChange={(value) =>
                      setMapping((current) => ({
                        ...current,
                        [field]: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not selected" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not selected</SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={`${field}-${header}`} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {headers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>4. Preview</CardTitle>
              <CardDescription>
                Review the normalized punches before importing them into the payroll system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{rows.length} source rows</Badge>
                <Badge variant="outline">{normalizedPreview.punches.length} valid punches</Badge>
                <Badge variant="outline">{normalizedPreview.errors.length} rows with errors</Badge>
                <Badge variant="outline">
                  {normalizedPreview.warnings.length} warnings
                </Badge>
              </div>

              <div className="w-full max-w-full overflow-x-auto rounded-md border">
                <Table className="w-full min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Employee Code</TableHead>
                      <TableHead>Punched At</TableHead>
                      <TableHead>Punch Type</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewPunches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          No valid punches yet. Adjust the mapping above or choose a different file.
                        </TableCell>
                      </TableRow>
                    ) : (
                      previewPunches.map((punch) => (
                        <TableRow key={`${punch.source_row_number}-${punch.punched_at}`}>
                          <TableCell>{punch.source_row_number}</TableCell>
                          <TableCell className="font-mono">{punch.employee_code}</TableCell>
                          <TableCell>{new Date(punch.punched_at).toLocaleString()}</TableCell>
                          <TableCell className="uppercase">{punch.punch_type}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {punch.warnings.join(" ") || "Ready to import"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {previewErrors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Rows that still need fixing</div>
                  <div className="w-full max-w-full overflow-x-auto rounded-md border">
                    <Table className="w-full min-w-[540px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Issue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewErrors.map((error) => (
                          <TableRow key={`${error.source_row_number}-${error.reason}`}>
                            <TableCell>{error.source_row_number}</TableCell>
                            <TableCell>{error.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Importing inserts biometric punches into `time_entries` and skips exact
                  duplicates already present in the same employee/timestamp/state combination.
                </div>
                <Button
                  onClick={() => {
                    void handleImport();
                  }}
                  disabled={importing || normalizedPreview.punches.length === 0}
                >
                  {importing ? "Importing..." : `Import ${normalizedPreview.punches.length} Punches`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {importResult && (
          <Card>
            <CardHeader>
              <CardTitle>Import result</CardTitle>
              <CardDescription>
                Review skipped rows and unresolved employee codes after each upload.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{importResult.inserted} inserted</Badge>
                <Badge variant="outline">{importResult.skipped} skipped as duplicates</Badge>
                <Badge variant="outline">
                  {importResult.unresolved.length} unresolved employee rows
                </Badge>
              </div>

              {importResult.unresolved.length > 0 && (
                <div className="w-full max-w-full overflow-x-auto rounded-md border">
                  <Table className="w-full min-w-[540px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Employee Code</TableHead>
                        <TableHead>Issue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.unresolved.map((row) => (
                        <TableRow key={`${row.row}-${row.employee_code}-${row.reason}`}>
                          <TableCell>{row.row}</TableCell>
                          <TableCell className="font-mono">{row.employee_code}</TableCell>
                          <TableCell>{row.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
