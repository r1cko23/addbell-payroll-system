/**
 * Resolve employee pay rates (Frappe HR Salary Structure pattern).
 * Supports Addbell `employees` row shapes used on payslips and payroll runs.
 */

import { calculateMonthlySalary } from "@/utils/ph-deductions";

export type RateEmployee = {
  salary_basis?: string | null;
  base_rate?: number | null;
  monthly_rate?: number | null;
  per_day?: number | null;
  rate_per_day?: number | null;
  rate_per_hour?: number | null;
};

export function getRatePerHour(emp: RateEmployee): number {
  const explicit = Number(emp.rate_per_hour ?? 0);
  if (explicit > 0 && Number.isFinite(explicit)) return explicit;

  const baseRate = Number(emp.base_rate ?? 0);
  if (baseRate > 0 && Number.isFinite(baseRate)) {
    const basis = String(emp.salary_basis || "").toLowerCase();
    const monthlyRate = basis === "monthly" ? baseRate : baseRate * 26;
    const perDay = basis === "daily" ? baseRate : monthlyRate / 26;
    const perHour = perDay / 8;
    if (perHour > 0 && Number.isFinite(perHour)) return perHour;
  }

  if (emp.monthly_rate && emp.monthly_rate > 0) {
    return emp.monthly_rate / (26 * 8);
  }

  const perDay = emp.per_day ?? emp.rate_per_day;
  if (perDay && perDay > 0) {
    return perDay / 8;
  }

  return 0;
}

export function getMonthlySalary(emp: RateEmployee): number {
  const basis = String(emp.salary_basis || "").toLowerCase();
  const baseRate = Number(emp.base_rate ?? 0);

  if (baseRate > 0 && Number.isFinite(baseRate)) {
    return basis === "monthly" ? baseRate : baseRate * 26;
  }

  if (emp.monthly_rate && emp.monthly_rate > 0) {
    return emp.monthly_rate;
  }

  const perDay = emp.per_day ?? emp.rate_per_day;
  if (perDay && perDay > 0) {
    return calculateMonthlySalary(perDay, 26);
  }

  return 0;
}

export function getRatePerDay(emp: RateEmployee): number {
  const hourly = getRatePerHour(emp);
  if (hourly > 0) return hourly * 8;

  const perDay = emp.per_day ?? emp.rate_per_day;
  if (perDay && perDay > 0) return perDay;

  const monthly = getMonthlySalary(emp);
  return monthly > 0 ? monthly / 26 : 0;
}
