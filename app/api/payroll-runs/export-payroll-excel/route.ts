import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import XLSX from "xlsx-js-style";
import { buildPayrollRunTemplateTable } from "@/lib/payroll-export/build-payroll-run-template";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function styleRgb(rgb: string) {
  return { rgb };
}

const styles = {
  title: {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "center", vertical: "center" },
  } as XLSX.CellStyle,
  subtitle: {
    font: { bold: true, sz: 12 },
    alignment: { horizontal: "center", vertical: "center" },
  } as XLSX.CellStyle,
  header: {
    font: { bold: true, sz: 10 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { fgColor: styleRgb("FFEFEFEF") },
    border: {
      top: { style: "thin", color: styleRgb("FFBDBDBD") },
      left: { style: "thin", color: styleRgb("FFBDBDBD") },
      bottom: { style: "thin", color: styleRgb("FFBDBDBD") },
      right: { style: "thin", color: styleRgb("FFBDBDBD") },
    },
  } as XLSX.CellStyle,
  money: {
    numFmt: "#,##0.00",
    alignment: { horizontal: "right", vertical: "center" },
  } as XLSX.CellStyle,
  hours: {
    numFmt: "0.00",
    alignment: { horizontal: "right", vertical: "center" },
  } as XLSX.CellStyle,
  text: {
    alignment: { horizontal: "left", vertical: "center" },
  } as XLSX.CellStyle,
  num: {
    alignment: { horizontal: "right", vertical: "center" },
  } as XLSX.CellStyle,
  earningsFill: { fill: { fgColor: styleRgb("FFEAF6EA") } } as XLSX.CellStyle,
  deductionsFill: { fill: { fgColor: styleRgb("FFFFEAEA") } } as XLSX.CellStyle,
  netFill: { fill: { fgColor: styleRgb("FFEAF1FF") } } as XLSX.CellStyle,
};

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const payroll_run_id = body?.payroll_run_id as string | undefined;
    if (!payroll_run_id) {
      return NextResponse.json({ error: "payroll_run_id is required" }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: run, error: runErr } = await admin
      .from("payroll_runs")
      .select("id, cutoff_start, cutoff_end, status, companies:company_id ( name )")
      .eq("id", payroll_run_id)
      .single();
    if (runErr) throw runErr;
    if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    if (String(run.status) !== "finalized") {
      return NextResponse.json(
        { error: "Finalize the payroll run before exporting this payroll Excel." },
        { status: 400 }
      );
    }

    const cutoffStart = String(run.cutoff_start);
    const cutoffEnd = String(run.cutoff_end);
    const [{ data: slips, error: slipsErr }, { data: holidays }] = await Promise.all([
      admin
        .from("payslips")
        .select(
          "id, employee_id, gross_pay, total_deductions, net_pay, earnings_breakdown, deductions_breakdown, employees:employee_id ( company_id_no, first_name, middle_name, last_name, salary_basis, base_rate )"
        )
        .eq("payroll_run_id", payroll_run_id)
        .order("created_at", { ascending: true }),
      admin
        .from("holidays")
        .select("holiday_date, is_regular")
        .gte("holiday_date", cutoffStart)
        .lte("holiday_date", cutoffEnd),
    ]);
    if (slipsErr) throw slipsErr;

    const table = buildPayrollRunTemplateTable({
      run: {
        cutoff_start: cutoffStart,
        cutoff_end: cutoffEnd,
        company_name: String((run as any)?.companies?.name || "ADD-BELL TECHNICAL SERVICES INC."),
      },
      holidays: (holidays || []) as any[],
      slips: (slips || []) as any[],
    });

    const columns = table.columns;
    const aoa: any[][] = [...table.headerRows, ...table.dataRows];
    const lastColIndex = columns.length - 1;

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = columns.map((c) => ({ wch: c.wch }));
    // Prevent the header from looking "compressed" in Excel.
    ws["!rows"] = [
      { hpt: 20 }, // company name
      { hpt: 18 }, // subtitle
      { hpt: 26 }, // header row 1
      { hpt: 30 }, // header row 2 (has long holiday labels)
    ];

    // Merges similar to the template (best-effort).
    ws["!merges"] = [
      { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },
      { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } },
      { s: { r: 2, c: 3 }, e: { r: 3, c: 3 } },
      { s: { r: 2, c: 7 }, e: { r: 3, c: 7 } },
      { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } },
    ];

    // Apply styles
    function setCellStyle(addr: string, style: XLSX.CellStyle) {
      if (!ws[addr]) ws[addr] = { t: "s", v: "" };
      ws[addr].s = { ...(ws[addr].s || {}), ...style };
    }

    // Titles
    setCellStyle("D1", styles.title);
    setCellStyle("D2", styles.subtitle);

    // Header rows 3-4
    for (let c = 0; c <= lastColIndex; c++) {
      const a3 = XLSX.utils.encode_cell({ r: 2, c });
      const a4 = XLSX.utils.encode_cell({ r: 3, c });
      if (ws[a3]?.v != null && String(ws[a3].v).trim() !== "") setCellStyle(a3, styles.header);
      if (ws[a4]?.v != null && String(ws[a4].v).trim() !== "") setCellStyle(a4, styles.header);
    }

    // Color-coded column groups for data rows
    const dataStartRow = 4; // 0-based row index; first data row begins after headers
    const dataEndRow = aoa.length - 1;
    const earningsCols = new Set(table.colorGroups.earningsCols);
    const deductionCols = new Set(table.colorGroups.deductionCols);
    const netCols = new Set(table.colorGroups.netCols);

    for (let r = dataStartRow; r <= dataEndRow; r++) {
      for (let c = 0; c <= lastColIndex; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;

        let base: XLSX.CellStyle | null = null;
        if (c === 1 || c === 3) base = styles.text;
        else if (c === 2) base = styles.num;
        else if (earningsCols.has(c)) base = c === 8 || c === 12 ? styles.hours : styles.money;
        else if (deductionCols.has(c)) base = styles.money;
        else if (netCols.has(c)) base = styles.money;
        else if (typeof cell.v === "number") base = styles.money;

        const fills: XLSX.CellStyle[] = [];
        if (earningsCols.has(c)) fills.push(styles.earningsFill);
        if (deductionCols.has(c)) fills.push(styles.deductionsFill);
        if (netCols.has(c)) fills.push(styles.netFill);

        cell.s = {
          ...(cell.s || {}),
          ...(base || {}),
          ...(fills.reduce((acc, s) => ({ ...acc, ...s }), {}) as XLSX.CellStyle),
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const fileBody = new Uint8Array(buf);

    const fileName = `payroll_${cutoffStart}_to_${cutoffEnd}.xlsx`;
    return new NextResponse(fileBody, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Error exporting payroll excel:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to export payroll excel" },
      { status: 500 }
    );
  }
}

