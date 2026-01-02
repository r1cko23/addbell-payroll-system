import { formatCurrency } from "./format";
import { format } from "date-fns";

/**
 * Format a value for display in audit logs based on field name and table
 */
export function formatAuditValue(
  value: any,
  fieldName: string,
  tableName: string
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  // Format currency fields
  const currencyFields = [
    "original_balance",
    "current_balance",
    "monthly_payment",
    "vale_amount",
    "sss_salary_loan",
    "sss_calamity_loan",
    "pagibig_salary_loan",
    "pagibig_calamity_loan",
    "sss_contribution",
    "philhealth_contribution",
    "pagibig_contribution",
    "withholding_tax",
    "rate_per_day",
    "rate_per_hour",
    "per_day",
    "monthly_rate",
  ];

  if (currencyFields.includes(fieldName) && typeof value === "number") {
    return formatCurrency(value);
  }

  // Format date fields
  const dateFields = [
    "effectivity_date",
    "hire_date",
    "birth_date",
    "first_login_time",
    "first_logout_time",
    "created_at",
    "updated_at",
  ];

  if (dateFields.includes(fieldName)) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return format(date, "MMM dd, yyyy");
      }
    } catch (e) {
      // Fall through to default formatting
    }
  }

  // Format boolean fields
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  // Format arrays/objects as JSON (for complex fields)
  if (typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

/**
 * Get a human-readable label for a field name
 */
export function getFieldLabel(fieldName: string, tableName: string): string {
  // Common field mappings
  const fieldLabels: Record<string, string> = {
    employee_id: "Employee ID",
    full_name: "Full Name",
    employee_type: "Employee Type",
    position: "Position",
    job_level: "Job Level",
    rate_per_day: "Rate per Day",
    rate_per_hour: "Rate per Hour",
    per_day: "Daily Rate",
    monthly_rate: "Monthly Rate",
    is_active: "Status",
    loan_type: "Loan Type",
    original_balance: "Original Balance",
    current_balance: "Current Balance",
    monthly_payment: "Monthly Payment",
    total_terms: "Total Terms",
    remaining_terms: "Remaining Terms",
    effectivity_date: "Effectivity Date",
    cutoff_assignment: "Cutoff Assignment",
    notes: "Notes",
    vale_amount: "Vale Amount",
    sss_salary_loan: "SSS Salary Loan",
    sss_calamity_loan: "SSS Calamity Loan",
    pagibig_salary_loan: "Pag-IBIG Salary Loan",
    pagibig_calamity_loan: "Pag-IBIG Calamity Loan",
    sss_contribution: "SSS Contribution",
    philhealth_contribution: "PhilHealth Contribution",
    pagibig_contribution: "Pag-IBIG Contribution",
    withholding_tax: "Withholding Tax",
    location_id: "Location",
    hotel_id: "Hotel",
    day_of_week: "Day of Week",
    is_day_off: "Day Off",
    hire_date: "Hire Date",
    birth_date: "Birth Date",
  };

  if (fieldLabels[fieldName]) {
    return fieldLabels[fieldName];
  }

  // Convert snake_case to Title Case
  return fieldName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get table-specific field formatting rules
 */
export function getTableDisplayConfig(tableName: string): {
  primaryFields: string[];
  currencyFields: string[];
  dateFields: string[];
} {
  const configs: Record<string, any> = {
    employees: {
      primaryFields: ["full_name", "employee_id", "position", "is_active"],
      currencyFields: [
        "rate_per_day",
        "rate_per_hour",
        "per_day",
        "monthly_rate",
      ],
      dateFields: ["hire_date", "birth_date"],
    },
    employee_loans: {
      primaryFields: [
        "loan_type",
        "original_balance",
        "current_balance",
        "monthly_payment",
      ],
      currencyFields: [
        "original_balance",
        "current_balance",
        "monthly_payment",
      ],
      dateFields: ["effectivity_date"],
    },
    employee_deductions: {
      primaryFields: ["vale_amount", "sss_salary_loan", "pagibig_salary_loan"],
      currencyFields: [
        "vale_amount",
        "sss_salary_loan",
        "sss_calamity_loan",
        "pagibig_salary_loan",
        "pagibig_calamity_loan",
      ],
      dateFields: [],
    },
    employee_location_assignments: {
      primaryFields: ["location_id", "hotel_id"],
      currencyFields: [],
      dateFields: [],
    },
    employee_week_schedules: {
      primaryFields: ["day_of_week", "is_day_off"],
      currencyFields: [],
      dateFields: [],
    },
  };

  return (
    configs[tableName] || {
      primaryFields: [],
      currencyFields: [],
      dateFields: [],
    }
  );
}






