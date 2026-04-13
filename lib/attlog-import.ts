export type AttlogStateMode = "file_state" | "infer_sequence";

export type AttlogColumnMapping = {
  employeeCode: string | null;
  timestamp: string | null;
  date: string | null;
  time: string | null;
  state: string | null;
  deviceSerial: string | null;
  deviceName: string | null;
};

export type AttlogPreview = {
  headers: string[];
  rows: string[][];
  hasHeaderRow: boolean;
  suggestedMapping: AttlogColumnMapping;
  presetName: string | null;
  mappingLocked: boolean;
};

export type NormalizedAttlogPunch = {
  source_row_number: number;
  employee_code: string;
  punched_at: string;
  punch_type: "in" | "out";
  device_serial: string | null;
  device_name: string | null;
  warnings: string[];
};

export type AttlogNormalizationIssue = {
  source_row_number: number;
  reason: string;
};

export type AttlogNormalizationResult = {
  punches: NormalizedAttlogPunch[];
  errors: AttlogNormalizationIssue[];
  warnings: AttlogNormalizationIssue[];
};

type PendingPunch = {
  source_row_number: number;
  employee_code: string;
  punched_at: string;
  raw_state: string | null;
  device_serial: string | null;
  device_name: string | null;
  warnings: string[];
};

const ZKTECO_ATTLOG_HEADERS = [
  "Employee PIN",
  "Timestamp",
  "Verify Mode",
  "State",
  "Work Code",
  "Reserved",
];

const EMPTY_MAPPING: AttlogColumnMapping = {
  employeeCode: null,
  timestamp: null,
  date: null,
  time: null,
  state: null,
  deviceSerial: null,
  deviceName: null,
};

const HEADER_HINTS: Record<keyof AttlogColumnMapping, string[]> = {
  employeeCode: [
    "employee code",
    "employee id",
    "user id",
    "userid",
    "uid",
    "pin",
    "enroll no",
    "enrollno",
    "enroll number",
    "enroll",
    "badge number",
    "badge no",
    "no.",
  ],
  timestamp: [
    "timestamp",
    "date/time",
    "datetime",
    "record time",
    "transaction time",
    "punch time",
    "clock time",
  ],
  date: ["date", "record date", "punch date", "clock date"],
  time: ["time", "record time", "punch time", "clock time"],
  state: [
    "state",
    "status",
    "attendance state",
    "attendance status",
    "punch state",
    "punch type",
    "in/out",
    "check type",
    "type",
  ],
  deviceSerial: ["serial", "device serial", "sn", "machine serial", "terminal serial"],
  deviceName: ["device", "device name", "terminal", "terminal name", "machine"],
};

function toText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every((cell) => toText(cell) === "");
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeDateish(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  return (
    /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text) ||
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(text) ||
    /^\d{1,2}:\d{2}/.test(text)
  );
}

function looksLikeHeader(firstRow: string[]): boolean {
  const normalized = firstRow.map(normalizeHeader).filter(Boolean);
  if (normalized.length === 0) return false;

  const hintHits = normalized.filter((cell) =>
    Object.values(HEADER_HINTS).some((hints) =>
      hints.some((hint) => cell === hint || cell.includes(hint))
    )
  ).length;

  if (hintHits > 0) return true;

  const alphaCells = normalized.filter((cell) => /[a-z]/.test(cell)).length;
  const dateishCells = normalized.filter(looksLikeDateish).length;
  return alphaCells >= Math.max(2, Math.ceil(normalized.length / 2)) && dateishCells === 0;
}

function indexToColumnLabel(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return `Column ${label}`;
}

function detectSuggestedColumn(
  headers: string[],
  key: keyof AttlogColumnMapping
): string | null {
  const hints = HEADER_HINTS[key];
  const indexed = headers.map((header) => ({
    header,
    normalized: normalizeHeader(header),
  }));

  for (const hint of hints) {
    const exact = indexed.find((entry) => entry.normalized === hint);
    if (exact) return exact.header;
  }

  for (const hint of hints) {
    const partial = indexed.find((entry) => entry.normalized.includes(hint));
    if (partial) return partial.header;
  }

  return null;
}

function detectHeuristicColumn(
  rows: string[][],
  predicate: (values: string[]) => boolean
): number | null {
  if (rows.length === 0) return null;
  const columnCount = Math.max(...rows.map((row) => row.length), 0);
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const values = rows
      .map((row) => toText(row[columnIndex] ?? ""))
      .filter(Boolean);
    if (values.length === 0) continue;
    if (predicate(values)) {
      return columnIndex;
    }
  }
  return null;
}

function isLikelyZktecoAttlogDat(rows: string[][]): boolean {
  if (rows.length === 0) return false;

  const nonEmptyRows = rows.filter((row) => row.some((cell) => toText(cell) !== ""));
  if (nonEmptyRows.length === 0) return false;

  return nonEmptyRows.every((row) => {
    const employeeCode = toText(row[0] ?? "");
    const timestamp = toText(row[1] ?? "");
    const state = toText(row[3] ?? "");

    return (
      /^\d+(\.0+)?$/.test(employeeCode) &&
      parseTimestampText(timestamp) !== null &&
      parsePunchType(state) !== null
    );
  });
}

function normalizeEmployeeCode(value: string): string {
  return value.replace(/\.0+$/, "").trim();
}

function getCellByHeader(row: string[], headers: string[], header: string | null): string {
  if (!header) return "";
  const index = headers.indexOf(header);
  if (index < 0) return "";
  return toText(row[index] ?? "");
}

function parseTimestampText(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\s+/g, " ");

  // LX50 AttLog exports usually contain local wall-clock timestamps with no timezone.
  // Treat them as Asia/Manila-style local time (+08:00) instead of letting JS guess.
  if (/^\d{4}-\d{2}-\d{2}\s\d{1,2}:\d{2}(:\d{2})?$/.test(normalized)) {
    const withSeconds = /^\d{4}-\d{2}-\d{2}\s\d{1,2}:\d{2}$/.test(normalized)
      ? `${normalized}:00`
      : normalized;
    const parsed = new Date(withSeconds.replace(" ", "T") + "+08:00");
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const isoFriendly = normalized;

  const parsed = new Date(isoFriendly);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function parseCombinedTimestamp(dateValue: string, timeValue: string): string | null {
  const dateText = dateValue.trim();
  const timeText = timeValue.trim();
  if (!dateText || !timeText) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return parseTimestampText(`${dateText}T${timeText}`);
  }

  return parseTimestampText(`${dateText} ${timeText}`);
}

function parsePunchType(stateValue: string): "in" | "out" | null {
  const normalized = stateValue.trim().toLowerCase();
  if (!normalized) return null;

  if (
    normalized === "0" ||
    normalized === "in" ||
    normalized === "checkin" ||
    normalized === "check in" ||
    normalized === "check_in" ||
    normalized === "time in" ||
    normalized === "login"
  ) {
    return "in";
  }

  if (
    normalized === "1" ||
    normalized === "out" ||
    normalized === "checkout" ||
    normalized === "check out" ||
    normalized === "check_out" ||
    normalized === "time out" ||
    normalized === "logout"
  ) {
    return "out";
  }

  return null;
}

function inferPunchTypes(rows: PendingPunch[]): NormalizedAttlogPunch[] {
  const grouped = new Map<string, PendingPunch[]>();

  for (const row of rows) {
    const dateKey = new Date(row.punched_at).toLocaleDateString("en-CA");
    const key = `${row.employee_code}|${dateKey}`;
    const existing = grouped.get(key);
    if (existing) existing.push(row);
    else grouped.set(key, [row]);
  }

  const normalized: NormalizedAttlogPunch[] = [];

  for (const groupRows of grouped.values()) {
    groupRows.sort((a, b) => a.punched_at.localeCompare(b.punched_at));
    const oddPunchCount = groupRows.length % 2 === 1;

    groupRows.forEach((row, index) => {
      const warnings = [...row.warnings, "Punch type inferred from sequence."];
      if (oddPunchCount && index === groupRows.length - 1) {
        warnings.push("Odd number of punches for this employee/day.");
      }
      normalized.push({
        source_row_number: row.source_row_number,
        employee_code: row.employee_code,
        punched_at: row.punched_at,
        punch_type: index % 2 === 0 ? "in" : "out",
        device_serial: row.device_serial,
        device_name: row.device_name,
        warnings,
      });
    });
  }

  normalized.sort((a, b) => a.source_row_number - b.source_row_number);
  return normalized;
}

export function buildAttlogPreview(matrix: unknown[][]): AttlogPreview {
  const sanitizedRows = matrix
    .filter((row): row is unknown[] => Array.isArray(row))
    .filter((row) => !isEmptyRow(row))
    .map((row) => row.map(toText));

  if (sanitizedRows.length === 0) {
    return {
      headers: [],
      rows: [],
      hasHeaderRow: false,
      suggestedMapping: { ...EMPTY_MAPPING },
      presetName: null,
      mappingLocked: false,
    };
  }

  const firstRow = sanitizedRows[0];
  const hasHeaderRow = looksLikeHeader(firstRow);
  const columnCount = Math.max(...sanitizedRows.map((row) => row.length), 0);

  const rawRows = (hasHeaderRow ? sanitizedRows.slice(1) : sanitizedRows).map((row) =>
    Array.from({ length: columnCount }, (_, index) => toText(row[index] ?? ""))
  );

  const usesZktecoPreset = !hasHeaderRow && isLikelyZktecoAttlogDat(rawRows);

  const headers = usesZktecoPreset
    ? Array.from({ length: columnCount }, (_, index) => {
        return ZKTECO_ATTLOG_HEADERS[index] ?? indexToColumnLabel(index);
      })
    : hasHeaderRow
    ? Array.from({ length: columnCount }, (_, index) => {
        const cell = toText(firstRow[index] ?? "");
        return cell || indexToColumnLabel(index);
      })
    : Array.from({ length: columnCount }, (_, index) => indexToColumnLabel(index));

  const rows = rawRows;

  const heuristicEmployeeCodeIndex = !hasHeaderRow
    ? detectHeuristicColumn(
        rows,
        (values) => values.every((value) => /^\d+(\.0+)?$/.test(value))
      )
    : null;

  const heuristicTimestampIndex = !hasHeaderRow
    ? detectHeuristicColumn(rows, (values) =>
        values.every((value) => parseTimestampText(value) !== null)
      )
    : null;

  const heuristicStateIndex = !hasHeaderRow
    ? detectHeuristicColumn(rows, (values) => {
        const normalized = new Set(values.map((value) => value.trim().toLowerCase()));
        return (
          normalized.size > 1 &&
          [...normalized].every((value) =>
            ["0", "1", "in", "out", "checkin", "checkout"].includes(value)
          )
        );
      })
    : null;

  const mappingFromHeaders: AttlogColumnMapping = {
    employeeCode: detectSuggestedColumn(headers, "employeeCode"),
    timestamp: detectSuggestedColumn(headers, "timestamp"),
    date: detectSuggestedColumn(headers, "date"),
    time: detectSuggestedColumn(headers, "time"),
    state: detectSuggestedColumn(headers, "state"),
    deviceSerial: detectSuggestedColumn(headers, "deviceSerial"),
    deviceName: detectSuggestedColumn(headers, "deviceName"),
  };

  const suggestedMapping: AttlogColumnMapping = usesZktecoPreset
    ? {
        employeeCode: headers[0] ?? null,
        timestamp: headers[1] ?? null,
        date: null,
        time: null,
        state: headers[3] ?? null,
        deviceSerial: null,
        deviceName: null,
      }
    : hasHeaderRow
    ? mappingFromHeaders
    : {
        employeeCode:
          heuristicEmployeeCodeIndex != null ? headers[heuristicEmployeeCodeIndex] : null,
        timestamp:
          heuristicTimestampIndex != null ? headers[heuristicTimestampIndex] : null,
        date: null,
        time: null,
        state: heuristicStateIndex != null ? headers[heuristicStateIndex] : null,
        deviceSerial: null,
        deviceName: null,
      };

  return {
    headers,
    rows,
    hasHeaderRow,
    suggestedMapping,
    presetName: usesZktecoPreset ? "ZKTeco AttLog .dat" : null,
    mappingLocked: usesZktecoPreset,
  };
}

export function normalizeAttlogRows(input: {
  headers: string[];
  rows: string[][];
  mapping: AttlogColumnMapping;
  stateMode: AttlogStateMode;
}): AttlogNormalizationResult {
  const { headers, rows, mapping, stateMode } = input;
  const errors: AttlogNormalizationIssue[] = [];
  const warnings: AttlogNormalizationIssue[] = [];
  const pendingRows: PendingPunch[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const sourceRowNumber = rowIndex + 1;

    const employeeCodeValue = normalizeEmployeeCode(
      getCellByHeader(row, headers, mapping.employeeCode)
    );
    if (!employeeCodeValue) {
      errors.push({
        source_row_number: sourceRowNumber,
        reason: "Missing employee code / PIN.",
      });
      continue;
    }

    const timestampValue = getCellByHeader(row, headers, mapping.timestamp);
    const dateValue = getCellByHeader(row, headers, mapping.date);
    const timeValue = getCellByHeader(row, headers, mapping.time);

    let punchedAt = parseTimestampText(timestampValue);
    if (!punchedAt && mapping.date && mapping.time) {
      punchedAt = parseCombinedTimestamp(dateValue, timeValue);
    }

    if (!punchedAt) {
      errors.push({
        source_row_number: sourceRowNumber,
        reason: "Could not parse the punch date/time from this row.",
      });
      continue;
    }

    pendingRows.push({
      source_row_number: sourceRowNumber,
      employee_code: employeeCodeValue,
      punched_at: punchedAt,
      raw_state: getCellByHeader(row, headers, mapping.state) || null,
      device_serial: getCellByHeader(row, headers, mapping.deviceSerial) || null,
      device_name: getCellByHeader(row, headers, mapping.deviceName) || null,
      warnings: [],
    });
  }

  let punches: NormalizedAttlogPunch[] = [];

  if (stateMode === "infer_sequence") {
    punches = inferPunchTypes(pendingRows);
  } else {
    for (const row of pendingRows) {
      const punchType = parsePunchType(row.raw_state || "");
      if (!punchType) {
        errors.push({
          source_row_number: row.source_row_number,
          reason: "Missing or invalid IN/OUT state in the selected state column.",
        });
        continue;
      }

      punches.push({
        source_row_number: row.source_row_number,
        employee_code: row.employee_code,
        punched_at: row.punched_at,
        punch_type: punchType,
        device_serial: row.device_serial,
        device_name: row.device_name,
        warnings: row.warnings,
      });
    }
  }

  for (const punch of punches) {
    for (const warning of punch.warnings) {
      warnings.push({
        source_row_number: punch.source_row_number,
        reason: warning,
      });
    }
  }

  punches.sort((a, b) => a.source_row_number - b.source_row_number);

  return {
    punches,
    errors,
    warnings,
  };
}
