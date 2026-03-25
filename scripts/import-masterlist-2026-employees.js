/**
 * Import employees from Addbell MASTERLIST 2026 Excel format
 * (e.g. Copy-of-ADDBELL-Master-List-2026-FINAL.xlsx, sheet "MASTERLIST 2026").
 *
 * Usage:
 *   node scripts/import-masterlist-2026-employees.js [path/to/file.xlsx] [--dry-run]
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("-d");
const fileArg = args.find((a) => !a.startsWith("--"));
const defaultFile = path.join(
  __dirname,
  "..",
  "Copy-of-ADDBELL-Master-List-2026-FINAL.xlsx"
);
const excelFile = fileArg ? path.resolve(fileArg) : defaultFile;
const SHEET_NAME = "MASTERLIST 2026";

function excelSerialToISODate(n) {
  if (typeof n !== "number" || n < 200 || n > 60000) return null;
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(excelEpoch.getTime() + n * 86400000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const MONTHS = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  SEPT: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

function parseLooseDate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return excelSerialToISODate(value);
  let s = String(value).trim();
  if (!s || /^no\s+nbi$/i.test(s) || /^expired$/i.test(s)) return null;

  // Strip trailing junk e.g. "7/14/2026 POLICE CLEARANCE"
  const dateOnly = s.replace(/\s+(POLICE CLEARANCE|CLEARANCE).*$/i, "").trim();
  s = dateOnly;

  // Pure Excel-looking garbage
  if (/^\d{1,3}\/\d{4}$/.test(s)) return null;

  const isoTry = new Date(s);
  if (!Number.isNaN(isoTry.getTime()) && s.length > 6) {
    const y = isoTry.getFullYear();
    if (y > 1920 && y < 2100) return isoTry.toISOString().slice(0, 10);
  }

  // DD-MMM-YY or DD-MMM.-YY (19-SEPT.-24)
  const m1 = s.match(
    /^(\d{1,2})[-./]?\s*([A-Za-z]{3,9})\.?\s*[-.]?\s*(\d{2,4})$/i
  );
  if (m1) {
    const day = parseInt(m1[1], 10);
    const monKey = m1[2].toUpperCase().slice(0, 4);
    const month = MONTHS[monKey.slice(0, 3)] ?? MONTHS[monKey];
    if (month == null) return null;
    let year = parseInt(m1[3], 10);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    const d = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // M/D/YYYY or M/D/YY
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m2) {
    let month = parseInt(m2[1], 10) - 1;
    let day = parseInt(m2[2], 10);
    let year = parseInt(m2[3], 10);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    const d = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // MM-DD-YY or DD-MM-YY (ambiguous; prefer US MM-DD-YY when first part <= 12)
  const m3 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m3) {
    const a = parseInt(m3[1], 10);
    const b = parseInt(m3[2], 10);
    let year = parseInt(m3[3], 10);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    let month;
    let day;
    if (a <= 12 && b <= 31) {
      month = a - 1;
      day = b;
    } else {
      day = a;
      month = b - 1;
    }
    const d = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // "March 29,2026" / "FEB 14, 2026"
  const m4 = s.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4})$/i
  );
  if (m4) {
    const monKey = m4[1].toUpperCase().slice(0, 3);
    const month = MONTHS[monKey];
    if (month != null) {
      const day = parseInt(m4[2], 10);
      const year = parseInt(m4[3], 10);
      const d = new Date(Date.UTC(year, month, day));
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }

  // "october 20, 1992"
  const m5 = s.match(/^([a-z]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (m5) {
    const tryDate = new Date(s);
    if (!Number.isNaN(tryDate.getTime()))
      return tryDate.toISOString().slice(0, 10);
  }

  return null;
}

const COMPOUND_LAST_PREFIXES = new Set([
  "DE",
  "DEL",
  "DELA",
  "LA",
  "SAN",
  "SANTA",
  "STO",
  "STA",
  "DA",
  "DOS",
]);

function parseNameCell(raw) {
  if (raw == null) {
    return { first_name: "", last_name: "", middle_name: null };
  }
  const s = String(raw).trim().replace(/\s+/g, " ");
  const comma = s.indexOf(",");
  if (comma === -1) {
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return { first_name: "", last_name: "", middle_name: null };
    }
    if (parts.length === 1) {
      return { first_name: parts[0], last_name: "", middle_name: null };
    }
    // No comma: assume "LAST FIRST …" (PH masterlist); handle "DE CLARO EDWIN …"
    if (
      parts.length >= 4 &&
      COMPOUND_LAST_PREFIXES.has(parts[0].toUpperCase())
    ) {
      return {
        last_name: `${parts[0]} ${parts[1]}`,
        first_name: parts[2],
        middle_name: parts.slice(3).join(" ") || null,
      };
    }
    return {
      last_name: parts[0],
      first_name: parts[1],
      middle_name: parts.length > 2 ? parts.slice(2).join(" ") : null,
    };
  }
  const last_name = s.slice(0, comma).trim();
  const rest = s.slice(comma + 1).trim();
  const parts = rest.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first_name: "", last_name, middle_name: null };
  }
  if (parts.length === 1) {
    return { first_name: parts[0], last_name, middle_name: null };
  }
  return {
    first_name: parts[0],
    last_name,
    middle_name: parts.slice(1).join(" ") || null,
  };
}

/** Employee codes: no spaces; AX codes like AX2025-019 (no "AX -" or "AX-"). */
function normalizeCode(id) {
  if (id == null) return "";
  let s = String(id).trim().replace(/\s+/g, "");
  if (/^AX-/i.test(s)) s = s.replace(/^AX-/i, "AX");
  return s;
}

function govId(v) {
  if (v == null || v === "") return null;
  return String(v).trim();
}

function normalizeDesignation(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

/**
 * Build map: normalized designation key -> position UUID.
 * Designation text becomes `positions.name` (Excel column is the job title / position).
 */
async function buildPositionIdByDesignation(
  supabase,
  designationDisplayByNorm,
  companyId,
  dryRun
) {
  const positionIdByNorm = new Map();

  const { data: existing, error: loadErr } = await supabase
    .from("positions")
    .select("id, name");
  if (loadErr) {
    throw loadErr;
  }

  for (const p of existing || []) {
    const k = normalizeDesignation(p.name);
    if (k && !positionIdByNorm.has(k)) {
      positionIdByNorm.set(k, p.id);
    }
  }

  const wouldCreate = [];

  for (const [normKey, displayName] of designationDisplayByNorm) {
    if (!normKey || !displayName) continue;
    if (positionIdByNorm.has(normKey)) continue;

    if (dryRun) {
      wouldCreate.push(displayName);
      continue;
    }

    const insertPayload = { name: displayName };
    if (companyId) insertPayload.company_id = companyId;

    const { data: inserted, error: insErr } = await supabase
      .from("positions")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (!insErr && inserted?.id) {
      positionIdByNorm.set(normKey, inserted.id);
      continue;
    }

    const { data: found } = await supabase
      .from("positions")
      .select("id, name")
      .eq("name", displayName)
      .maybeSingle();

    if (found?.id) {
      positionIdByNorm.set(normKey, found.id);
      continue;
    }

    const { data: list } = await supabase
      .from("positions")
      .select("id, name");
    const loose = (list || []).find(
      (p) => normalizeDesignation(p.name) === normKey
    );
    if (loose) {
      positionIdByNorm.set(normKey, loose.id);
      continue;
    }

    throw new Error(
      `Could not create or resolve position "${displayName}": ${insErr?.message || "unknown"}`
    );
  }

  return { positionIdByNorm, wouldCreateInDryRun: wouldCreate };
}

function collectDesignationDisplayByNorm(matrix, IDX) {
  const designationDisplayByNorm = new Map();
  const seenCodes = new Map();
  for (let r = 3; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row) continue;
    const code = normalizeCode(row[IDX.id]);
    if (!code) continue;
    const nameCell = row[IDX.name];
    if (nameCell == null || String(nameCell).trim() === "") continue;

    if (seenCodes.has(code)) continue;
    seenCodes.set(code, r + 1);

    const raw = row[IDX.designation];
    if (raw == null || String(raw).trim() === "") continue;
    const display = String(raw).trim().replace(/\s+/g, " ");
    const k = normalizeDesignation(display);
    if (!k) continue;
    if (!designationDisplayByNorm.has(k)) {
      designationDisplayByNorm.set(k, display);
    }
  }
  return designationDisplayByNorm;
}

/**
 * CONTRACT EXPIRY: REGULAR → no end date, active.
 * Parsed date: active if end >= today (calendar), inactive if end is before today (expired).
 * Literal "EXPIRED" → inactive.
 */
function contractToEndAndStatus(contractRaw) {
  const s = contractRaw == null ? "" : String(contractRaw).trim();
  if (!s) return { end_of_contract: null, employment_status: "active" };
  if (/^regular$/i.test(s)) {
    return { end_of_contract: null, employment_status: "active" };
  }
  if (/^expired$/i.test(s)) {
    return { end_of_contract: null, employment_status: "inactive" };
  }
  const end = parseLooseDate(s);
  if (!end) return { end_of_contract: null, employment_status: "active" };
  const todayStr = new Date().toISOString().slice(0, 10);
  const expired = end < todayStr;
  return {
    end_of_contract: end,
    employment_status: expired ? "inactive" : "active",
  };
}

async function main() {
  if (!fs.existsSync(excelFile)) {
    console.error("Excel file not found:", excelFile);
    process.exit(1);
  }

  const workbook = XLSX.readFile(excelFile);
  if (!workbook.SheetNames.includes(SHEET_NAME)) {
    console.error(
      'Sheet "' +
        SHEET_NAME +
        '" not found. Available:',
      workbook.SheetNames.join(", ")
    );
    process.exit(1);
  }

  const worksheet = workbook.Sheets[SHEET_NAME];
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    header: 1,
  });

  // Row 0: title, row 1: headers, row 2: often blank, row 3+: data
  const headerRow = matrix[1] || [];
  const col = (name) => {
    const i = headerRow.findIndex(
      (h) => h && String(h).trim() === name.trim()
    );
    return i >= 0 ? i : -1;
  };

  const IDX = {
    nos: col("NOS."),
    id: col("ID No.#"),
    name: col("NAME"),
    birth: col("BIRTHDATE"),
    hired: col("DATE HIRED "),
    rate: col("RATE"),
    designation: col("DESIGNATION"),
    nbi: col("NBI EXPIRY"),
    contract: col("CONTRACT EXPIRY "),
    address: col("ADDRESS"),
    sss: col("SSS No."),
    tin: col("Tin No."),
    philhealth: col("PhilHealth No. "),
    pagibig: col("Pag-ibig No. "),
  };

  if (IDX.id < 0 || IDX.name < 0) {
    console.error("Could not find ID No.# or NAME column. Header row:", headerRow);
    process.exit(1);
  }

  const { data: companyRow } = await supabase
    .from("companies")
    .select("id")
    .limit(1)
    .maybeSingle();

  const designationDisplayByNorm = collectDesignationDisplayByNorm(matrix, IDX);

  let positionIdByNorm;
  let wouldCreateInDryRun = [];
  try {
    const result = await buildPositionIdByDesignation(
      supabase,
      designationDisplayByNorm,
      companyRow?.id ?? null,
      dryRun
    );
    positionIdByNorm = result.positionIdByNorm;
    wouldCreateInDryRun = result.wouldCreateInDryRun || [];
  } catch (e) {
    console.error("Position sync failed:", e.message || e);
    process.exit(1);
  }

  const rows = [];
  const seenCodes = new Map();
  for (let r = 3; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row) continue;
    const code = normalizeCode(row[IDX.id]);
    if (!code) continue;
    const nameCell = row[IDX.name];
    if (nameCell == null || String(nameCell).trim() === "") continue;

    if (seenCodes.has(code)) {
      console.error(
        `⚠ Skipping duplicate ID No.# "${code}" at Excel row ${r + 1} (already used at row ${seenCodes.get(code)}). Fix the spreadsheet.`
      );
      continue;
    }
    seenCodes.set(code, r + 1);

    const { first_name, last_name, middle_name } = parseNameCell(nameCell);
    const birth_date = parseLooseDate(row[IDX.birth]);
    let hire_date = parseLooseDate(row[IDX.hired]);
    if (!hire_date) hire_date = "2000-01-01";

    const rateNum = row[IDX.rate];
    const base_rate =
      typeof rateNum === "number" && !Number.isNaN(rateNum)
        ? rateNum
        : parseFloat(String(rateNum || "").replace(/,/g, "")) || 0;

    const designation = row[IDX.designation];
    let position_id = null;
    if (designation != null && String(designation).trim() !== "") {
      const display = String(designation).trim().replace(/\s+/g, " ");
      const k = normalizeDesignation(display);
      if (k) position_id = positionIdByNorm.get(k) ?? null;
    }

    const nbi_clearance_expiration_date = parseLooseDate(row[IDX.nbi]);
    const { end_of_contract, employment_status } = contractToEndAndStatus(
      row[IDX.contract]
    );

    rows.push({
      company_id_no: code,
      first_name: first_name || "Unknown",
      middle_name,
      last_name: last_name || "Unknown",
      date_of_birth: birth_date,
      hire_date,
      address: govId(row[IDX.address]),
      sss_number: govId(row[IDX.sss]),
      tin: govId(row[IDX.tin]),
      philhealth_number: govId(row[IDX.philhealth]),
      pagibig_number: govId(row[IDX.pagibig]),
      nbi_clearance_expiration_date,
      end_of_contract,
      employment_status,
      employment_type: "regular",
      salary_basis: "daily",
      base_rate,
      position_id,
      _designation: designation ? String(designation).trim() : "",
      _row: r + 1,
    });
  }

  console.log("=".repeat(72));
  console.log("MASTERLIST 2026 employee import");
  console.log("File:", excelFile);
  console.log(
    "Unique designations (position titles):",
    designationDisplayByNorm.size
  );
  if (dryRun && wouldCreateInDryRun.length > 0) {
    console.log(
      "New position rows that would be created:",
      wouldCreateInDryRun.length
    );
  }
  console.log("Rows:", rows.length, dryRun ? "(dry run)" : "");
  console.log("=".repeat(72));

  const { data: existingList, error: exErr } = await supabase
    .from("employees")
    .select("id, company_id_no, employee_code");
  if (exErr) {
    console.error("Failed to fetch employees:", exErr);
    process.exit(1);
  }

  const byCompanyId = new Map(
    (existingList || []).map((e) => [normalizeCode(e.company_id_no), e.id])
  );

  const maxExistingPin = Math.max(
    0,
    ...((existingList || [])
      .map((e) => parseInt(String(e.employee_code), 10))
      .filter((n) => !Number.isNaN(n)))
  );
  let nextPin = maxExistingPin + 1;
  const existingById = new Map((existingList || []).map((e) => [e.id, e]));

  for (const row of rows) {
    const existingId = byCompanyId.get(normalizeCode(row.company_id_no));
    if (existingId) {
      const ex = existingById.get(existingId);
      row.employee_code =
        ex && String(ex.employee_code || "").match(/^\d+$/)
          ? String(ex.employee_code)
          : String(nextPin++);
    } else {
      row.employee_code = String(nextPin++);
    }
  }

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    const code = row.company_id_no;
    const existingId = byCompanyId.get(normalizeCode(code));
    const payload = {
      company_id_no: code,
      employee_code: row.employee_code,
      first_name: row.first_name,
      middle_name: row.middle_name,
      last_name: row.last_name,
      date_of_birth: row.date_of_birth,
      hire_date: row.hire_date,
      address: row.address,
      sss_number: row.sss_number,
      tin: row.tin,
      philhealth_number: row.philhealth_number,
      pagibig_number: row.pagibig_number,
      nbi_clearance_expiration_date: row.nbi_clearance_expiration_date,
      end_of_contract: row.end_of_contract,
      employment_status: row.employment_status,
      employment_type: row.employment_type,
      salary_basis: row.salary_basis,
      base_rate: row.base_rate,
      position_id: row.position_id,
    };

    try {
      if (existingId) {
        if (!dryRun) {
          const { error: upErr } = await supabase
            .from("employees")
            .update({
              ...payload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingId);
          if (upErr) throw upErr;
        }
        updated++;
        console.log(
          `✓ ${dryRun ? "[dry-run] would update" : "Updated"} ${code} — ${row.first_name} ${row.last_name}`
        );
        if (!row.position_id && row._designation && !dryRun) {
          console.log(
            `    (no position_id for designation: "${row._designation}")`
          );
        }
      } else {
        if (!dryRun) {
          const { error: insErr } = await supabase.from("employees").insert({
            ...payload,
            company_id: companyRow?.id ?? null,
            portal_password: code,
          });
          if (insErr) throw insErr;
        }
        created++;
        console.log(
          `+ ${dryRun ? "[dry-run] would create" : "Created"} ${code} — ${row.first_name} ${row.last_name}`
        );
        if (!row.position_id && row._designation && !dryRun) {
          console.log(
            `    (no position_id for designation: "${row._designation}")`
          );
        }
      }
    } catch (e) {
      errors++;
      console.error(`✗ ${code} row ${row._row}:`, e.message || e);
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log(`Done. Created: ${created}, Updated: ${updated}, Errors: ${errors}`);
  if (dryRun) {
    console.log("This was a dry run. Run without --dry-run to apply.");
  }
  console.log("=".repeat(72));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
