/**
 * Philippine Government Deductions Calculator
 *
 * Calculates SSS, Pag-IBIG, and PhilHealth contributions based on
 * monthly salary brackets as per Philippine regulations.
 *
 * Based on daily rate × working days per month (typically 22-26 days)
 */

/**
 * SSS Contribution Brackets (2025)
 * Based on monthly salary credit (MSC)
 * Employee share: 5% of MSC, Employer share: 10% of MSC
 * Total: 15% of MSC
 * Minimum MSC: ₱5,000, Maximum MSC: ₱35,000
 */
const SSS_BRACKETS = [
  { min: 5000, max: 5249.99, msc: 5000 },
  { min: 5250, max: 5749.99, msc: 5500 },
  { min: 5750, max: 6249.99, msc: 6000 },
  { min: 6250, max: 6749.99, msc: 6500 },
  { min: 6750, max: 7249.99, msc: 7000 },
  { min: 7250, max: 7749.99, msc: 7500 },
  { min: 7750, max: 8249.99, msc: 8000 },
  { min: 8250, max: 8749.99, msc: 8500 },
  { min: 8750, max: 9249.99, msc: 9000 },
  { min: 9250, max: 9749.99, msc: 9500 },
  { min: 9750, max: 10249.99, msc: 10000 },
  { min: 10250, max: 10749.99, msc: 10500 },
  { min: 10750, max: 11249.99, msc: 11000 },
  { min: 11250, max: 11749.99, msc: 11500 },
  { min: 11750, max: 12249.99, msc: 12000 },
  { min: 12250, max: 12749.99, msc: 12500 },
  { min: 12750, max: 13249.99, msc: 13000 },
  { min: 13250, max: 13749.99, msc: 13500 },
  { min: 13750, max: 14249.99, msc: 14000 },
  { min: 14250, max: 14749.99, msc: 14500 },
  { min: 14750, max: 15249.99, msc: 15000 },
  { min: 15250, max: 15749.99, msc: 15500 },
  { min: 15750, max: 16249.99, msc: 16000 },
  { min: 16250, max: 16749.99, msc: 16500 },
  { min: 16750, max: 17249.99, msc: 17000 },
  { min: 17250, max: 17749.99, msc: 17500 },
  { min: 17750, max: 18249.99, msc: 18000 },
  { min: 18250, max: 18749.99, msc: 18500 },
  { min: 18750, max: 19249.99, msc: 19000 },
  { min: 19250, max: 19749.99, msc: 19500 },
  { min: 19750, max: 20249.99, msc: 20000 },
  { min: 20250, max: 20749.99, msc: 20500 },
  { min: 20750, max: 21249.99, msc: 21000 },
  { min: 21250, max: 21749.99, msc: 21500 },
  { min: 21750, max: 22249.99, msc: 22000 },
  { min: 22250, max: 22749.99, msc: 22500 },
  { min: 22750, max: 23249.99, msc: 23000 },
  { min: 23250, max: 23749.99, msc: 23500 },
  { min: 23750, max: 24249.99, msc: 24000 },
  { min: 24250, max: 24749.99, msc: 24500 },
  { min: 24750, max: 25249.99, msc: 25000 },
  { min: 25250, max: 25749.99, msc: 25500 },
  { min: 25750, max: 26249.99, msc: 26000 },
  { min: 26250, max: 26749.99, msc: 26500 },
  { min: 26750, max: 27249.99, msc: 27000 },
  { min: 27250, max: 27749.99, msc: 27500 },
  { min: 27750, max: 28249.99, msc: 28000 },
  { min: 28250, max: 28749.99, msc: 28500 },
  { min: 28750, max: 29249.99, msc: 29000 },
  { min: 29250, max: 29749.99, msc: 29500 },
  { min: 29750, max: 30000, msc: 30000 },
  { min: 30000.01, max: 30749.99, msc: 30500 },
  { min: 30750, max: 31499.99, msc: 31000 },
  { min: 31500, max: 32249.99, msc: 31500 },
  { min: 32250, max: 32999.99, msc: 32000 },
  { min: 33000, max: 33749.99, msc: 32500 },
  { min: 33750, max: 34249.99, msc: 34000 },
  { min: 34250, max: 34749.99, msc: 34500 },
  { min: 34750, max: 999999, msc: 35000 },
  // Above 34,750 uses fixed MSC of 35,000 (per official SSS table 2025)
];

const SSS_EMPLOYEE_RATE = 0.05; // 5%
const SSS_EMPLOYER_RATE = 0.1; // 10%
const SSS_TOTAL_RATE = 0.15; // 15%

/**
 * Pag-IBIG Contribution (2025)
 * Fixed amount: ₱200.00 per month
 * Employee share: ₱200.00 (100%)
 * Employer share: ₱0.00 (0%)
 */
const PAGIBIG_MONTHLY_AMOUNT = 200.0; // Fixed ₱200.00 per month

/**
 * PhilHealth Contribution (2025)
 * Based on monthly basic salary
 * Employee share: 2.5% of monthly basic salary (only this is deducted from employee)
 * Employer share: 2.5% of monthly basic salary (paid by employer)
 * Total: 5% of monthly basic salary
 */
const PHILHEALTH_EMPLOYEE_RATE = 0.025; // 2.5% employee share
const PHILHEALTH_EMPLOYER_RATE = 0.025; // 2.5% employer share
const PHILHEALTH_TOTAL_RATE = 0.05; // 5% total

/**
 * Calculate monthly salary from daily rate
 * @param dailyRate Daily rate in PHP
 * @param workingDaysPerMonth Number of working days per month (default: 22)
 * @returns Monthly salary
 */
export function calculateMonthlySalary(
  dailyRate: number,
  workingDaysPerMonth: number = 22
): number {
  return dailyRate * workingDaysPerMonth;
}

/**
 * Find SSS bracket based on monthly salary
 */
function findSSSBracket(monthlySalary: number): number {
  // If salary exceeds max bracket, use max MSC
  if (monthlySalary > 35000) {
    return 35000;
  }

  // If salary is below minimum, use minimum MSC
  if (monthlySalary < 5000) {
    return 5000;
  }

  // Find matching bracket
  for (const bracket of SSS_BRACKETS) {
    if (monthlySalary >= bracket.min && monthlySalary <= bracket.max) {
      return bracket.msc;
    }
  }

  // Default to minimum bracket
  return SSS_BRACKETS[0].msc;
}

/**
 * Calculate SSS contribution (including WISP for MSC > PHP 20,000)
 * Effective January 1, 2025:
 * - Regular SSS: MSC up to PHP 20,000 (15% total: 5% employee, 10% employer)
 * - WISP (Workers' Investment and Savings Program): Mandatory for MSC > PHP 20,000
 *   - WISP MSC = Excess over PHP 20,000 (up to PHP 35,000 max)
 *   - WISP Contribution: 15% of WISP MSC (5% employee, 10% employer)
 *
 * @param monthlySalary Monthly salary
 * @returns Object with employee share, employer share, total, msc, and WISP breakdown
 */
export function calculateSSS(monthlySalary: number): {
  employeeShare: number;
  employerShare: number;
  total: number;
  msc: number;
  regularMsc: number;
  wispMsc: number;
  regularEmployeeShare: number;
  regularEmployerShare: number;
  wispEmployeeShare: number;
  wispEmployerShare: number;
} {
  const msc = findSSSBracket(monthlySalary);

  // WISP is mandatory for MSC > PHP 20,000 (effective January 1, 2025)
  const WISP_THRESHOLD = 20000;
  const MAX_MSC = 35000;

  let regularMsc = msc;
  let wispMsc = 0;

  if (msc > WISP_THRESHOLD) {
    // Regular SSS: MSC up to PHP 20,000
    regularMsc = WISP_THRESHOLD;
    // WISP: Excess over PHP 20,000 (capped at PHP 35,000 total MSC)
    wispMsc = Math.min(msc, MAX_MSC) - WISP_THRESHOLD;
  }

  // Regular SSS contributions
  const regularEmployeeShare = regularMsc * SSS_EMPLOYEE_RATE;
  const regularEmployerShare = regularMsc * SSS_EMPLOYER_RATE;

  // WISP contributions (if applicable)
  const wispEmployeeShare = wispMsc * SSS_EMPLOYEE_RATE;
  const wispEmployerShare = wispMsc * SSS_EMPLOYER_RATE;

  // Total contributions
  const employeeShare = regularEmployeeShare + wispEmployeeShare;
  const employerShare = regularEmployerShare + wispEmployerShare;
  const total = employeeShare + employerShare;

  return {
    employeeShare: Math.round(employeeShare * 100) / 100,
    employerShare: Math.round(employerShare * 100) / 100,
    total: Math.round(total * 100) / 100,
    msc,
    regularMsc,
    wispMsc,
    regularEmployeeShare: Math.round(regularEmployeeShare * 100) / 100,
    regularEmployerShare: Math.round(regularEmployerShare * 100) / 100,
    wispEmployeeShare: Math.round(wispEmployeeShare * 100) / 100,
    wispEmployerShare: Math.round(wispEmployerShare * 100) / 100,
  };
}

/**
 * Calculate Pag-IBIG contribution
 * Fixed amount: ₱200.00 per month
 * @param monthlySalary Monthly salary (not used, but kept for consistency)
 * @returns Object with employee share, employer share, and total
 */
export function calculatePagIBIG(monthlySalary: number): {
  employeeShare: number;
  employerShare: number;
  total: number;
} {
  // Fixed ₱200.00 per month, employee pays full amount
  const total = PAGIBIG_MONTHLY_AMOUNT;
  const employeeShare = total; // ₱200.00
  const employerShare = 0; // ₱0.00

  return {
    employeeShare: Math.round(employeeShare * 100) / 100,
    employerShare: Math.round(employerShare * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Calculate PhilHealth contribution
 * Based on monthly basic salary: Employee pays 2.5%, Employer pays 2.5% (total 5%)
 * Only the employee share (2.5%) is deducted from the employee's salary
 * @param monthlyBasicSalary Monthly basic salary
 * @returns Object with employee share, employer share, and total
 */
export function calculatePhilHealth(monthlyBasicSalary: number): {
  employeeShare: number;
  employerShare: number;
  total: number;
} {
  // Ensure monthlyBasicSalary is a valid number (not NaN, undefined, or null)
  const validSalary =
    typeof monthlyBasicSalary === "number" &&
    !isNaN(monthlyBasicSalary) &&
    monthlyBasicSalary >= 0
      ? monthlyBasicSalary
      : 0;

  // Employee share: 2.5% of monthly basic salary (this is what gets deducted)
  const employeeShare = validSalary * PHILHEALTH_EMPLOYEE_RATE;
  // Employer share: 2.5% of monthly basic salary (paid by employer)
  const employerShare = validSalary * PHILHEALTH_EMPLOYER_RATE;
  // Total: 5% of monthly basic salary
  const total = validSalary * PHILHEALTH_TOTAL_RATE;

  return {
    employeeShare: Math.round(employeeShare * 100) / 100,
    employerShare: Math.round(employerShare * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Calculate Withholding Tax (BIR TRAIN Law - Effective January 1, 2023)
 * Based on monthly taxable income (after SSS, PhilHealth, Pag-IBIG deductions)
 *
 * Per Philippine Labor Code and BIR Revenue Regulations No. 11-2018:
 * - Withholding tax is calculated on MONTHLY taxable income
 * - Taxable income = Monthly BASIC salary - Mandatory contributions (SSS, PhilHealth, Pag-IBIG)
 * - IMPORTANT: Allowances (OT allowances, ND allowances, holiday allowances) for supervisors/managers
 *   are NON-TAXABLE and must be EXCLUDED from taxable income calculation
 * - Tax is deducted MONTHLY (typically on the 2nd cutoff/16-31 period)
 *
 * Tax Brackets (Monthly):
 * - 0 – 20,833: 0% (No tax)
 * - 20,833.01 – 33,333: 20% of excess over ₱20,833
 * - 33,333.01 – 66,666: ₱2,500 + 25% of excess over ₱33,333
 * - 66,666.01 – 166,666: ₱10,833.33 + 30% of excess over ₱66,666
 * - 166,666.01 – 666,666: ₱40,833.33 + 32% of excess over ₱166,666
 * - Over 666,666: ₱200,833.33 + 35% of excess over ₱666,666
 *
 * @param monthlyTaxableIncome Monthly taxable income (BASIC salary minus mandatory contributions, excludes allowances)
 * @returns Monthly withholding tax amount
 */
export function calculateWithholdingTax(monthlyTaxableIncome: number): number {
  // Ensure valid input
  const taxableIncome =
    typeof monthlyTaxableIncome === "number" &&
    !isNaN(monthlyTaxableIncome) &&
    monthlyTaxableIncome >= 0
      ? monthlyTaxableIncome
      : 0;

  // BIR Withholding Tax Table (TRAIN Law - Monthly, Effective January 1, 2023)
  // Source: BIR Revenue Regulations No. 11-2018, updated per TRAIN Law
  // Tax is calculated on monthly taxable income (after SSS, PhilHealth, Pag-IBIG deductions)

  if (taxableIncome <= 20833.0) {
    // 0 – 20,833: No tax
    return 0;
  } else if (taxableIncome <= 33333.0) {
    // 20,833.01 – 33,333: 20% of excess over ₱20,833
    const excess = taxableIncome - 20833.0;
    return Math.round(excess * 0.2 * 100) / 100;
  } else if (taxableIncome <= 66666.0) {
    // 33,333.01 – 66,666: ₱2,500 + 25% of excess over ₱33,333
    const baseTax = 2500.0;
    const excess = taxableIncome - 33333.0;
    return Math.round((baseTax + excess * 0.25) * 100) / 100;
  } else if (taxableIncome <= 166666.0) {
    // 66,666.01 – 166,666: ₱10,833.33 + 30% of excess over ₱66,666
    const baseTax = 10833.33;
    const excess = taxableIncome - 66666.0;
    return Math.round((baseTax + excess * 0.3) * 100) / 100;
  } else if (taxableIncome <= 666666.0) {
    // 166,666.01 – 666,666: ₱40,833.33 + 32% of excess over ₱166,666
    const baseTax = 40833.33;
    const excess = taxableIncome - 166666.0;
    return Math.round((baseTax + excess * 0.32) * 100) / 100;
  } else {
    // Over 666,666: ₱200,833.33 + 35% of excess over ₱666,666
    const baseTax = 200833.33;
    const excess = taxableIncome - 666666.0;
    return Math.round((baseTax + excess * 0.35) * 100) / 100;
  }
}

/**
 * Calculate all government contributions for bi-monthly period
 * @param dailyRate Daily rate in PHP
 * @param workingDaysPerMonth Number of working days per month (default: 22)
 * @returns Object with all contributions (for bi-monthly period = half of monthly)
 */
export function calculateAllContributions(
  dailyRate: number,
  workingDaysPerMonth: number = 22
): {
  monthlySalary: number;
  sss: {
    employeeShare: number;
    employerShare: number;
    total: number;
    msc: number;
  };
  pagibig: {
    employeeShare: number;
    employerShare: number;
    total: number;
  };
  philhealth: {
    employeeShare: number;
    employerShare: number;
    total: number;
  };
  biMonthly: {
    sss: number;
    pagibig: number;
    philhealth: number;
  };
} {
  const monthlySalary = calculateMonthlySalary(dailyRate, workingDaysPerMonth);
  const sss = calculateSSS(monthlySalary);
  const pagibig = calculatePagIBIG(monthlySalary);
  const philhealth = calculatePhilHealth(monthlySalary);

  // Bi-monthly contributions are half of monthly
  return {
    monthlySalary,
    sss,
    pagibig,
    philhealth,
    biMonthly: {
      // For bi-monthly payslip, divide monthly employee shares by 2
      sss: Math.round((sss.employeeShare / 2) * 100) / 100,
      pagibig: Math.round((pagibig.employeeShare / 2) * 100) / 100,
      philhealth: Math.round((philhealth.employeeShare / 2) * 100) / 100,
    },
  };
}