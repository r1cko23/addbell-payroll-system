import { redirect } from "next/navigation";

/** Payroll Register is disabled for now; payroll run exports live under /payroll. */
export default function ReportsPage() {
  redirect("/payroll");
}
