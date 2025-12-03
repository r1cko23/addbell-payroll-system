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
 * Employee share: 11% of MSC, Employer share: 8.5% of MSC
 * Total: 19.5% of MSC
 */
const SSS_BRACKETS = [
  { min: 0, max: 1000, msc: 1000 },
  { min: 1000.01, max: 1250, msc: 1250 },
  { min: 1250.01, max: 1750, msc: 1750 },
  { min: 1750.01, max: 2250, msc: 2250 },
  { min: 2250.01, max: 2750, msc: 2750 },
  { min: 2750.01, max: 3250, msc: 3250 },
  { min: 3250.01, max: 3750, msc: 3750 },
  { min: 3750.01, max: 4250, msc: 4250 },
  { min: 4250.01, max: 4750, msc: 4750 },
  { min: 4750.01, max: 5250, msc: 5250 },
  { min: 5250.01, max: 5750, msc: 5750 },
  { min: 5750.01, max: 6250, msc: 6250 },
  { min: 6250.01, max: 6750, msc: 6750 },
  { min: 6750.01, max: 7250, msc: 7250 },
  { min: 7250.01, max: 7750, msc: 7750 },
  { min: 7750.01, max: 8250, msc: 8250 },
  { min: 8250.01, max: 8750, msc: 8750 },
  { min: 8750.01, max: 9250, msc: 9250 },
  { min: 9250.01, max: 9750, msc: 9750 },
  { min: 9750.01, max: 10250, msc: 10250 },
  { min: 10250.01, max: 10750, msc: 10750 },
  { min: 10750.01, max: 11250, msc: 11250 },
  { min: 11250.01, max: 11750, msc: 11750 },
  { min: 11750.01, max: 12250, msc: 12250 },
  { min: 12250.01, max: 12750, msc: 12750 },
  { min: 12750.01, max: 13250, msc: 13250 },
  { min: 13250.01, max: 13750, msc: 13750 },
  { min: 13750.01, max: 14250, msc: 14250 },
  { min: 14250.01, max: 14750, msc: 14750 },
  { min: 14750.01, max: 15250, msc: 15250 },
  { min: 15250.01, max: 15750, msc: 15750 },
  { min: 15750.01, max: 16250, msc: 16250 },
  { min: 16250.01, max: 16750, msc: 16750 },
  { min: 16750.01, max: 17250, msc: 17250 },
  { min: 17250.01, max: 17750, msc: 17750 },
  { min: 17750.01, max: 18250, msc: 18250 },
  { min: 18250.01, max: 18750, msc: 18750 },
  { min: 18750.01, max: 19250, msc: 19250 },
  { min: 19250.01, max: 19750, msc: 19750 },
  { min: 19750.01, max: 20250, msc: 20250 },
  { min: 20250.01, max: 20750, msc: 20750 },
  { min: 20750.01, max: 21250, msc: 21250 },
  { min: 21250.01, max: 21750, msc: 21750 },
  { min: 21750.01, max: 22250, msc: 22250 },
  { min: 22250.01, max: 22750, msc: 22750 },
  { min: 22750.01, max: 23250, msc: 23250 },
  { min: 23250.01, max: 23750, msc: 23750 },
  { min: 23750.01, max: 24250, msc: 24250 },
  { min: 24250.01, max: 24750, msc: 24750 },
  { min: 24750.01, max: 25250, msc: 25250 },
  { min: 25250.01, max: 25750, msc: 25750 },
  { min: 25750.01, max: 26250, msc: 26250 },
  { min: 26250.01, max: 26750, msc: 26750 },
  { min: 26750.01, max: 27250, msc: 27250 },
  { min: 27250.01, max: 27750, msc: 27750 },
  { min: 27750.01, max: 28250, msc: 28250 },
  { min: 28250.01, max: 28750, msc: 28750 },
  { min: 28750.01, max: 29250, msc: 29250 },
  { min: 29250.01, max: 29750, msc: 29750 },
  { min: 29750.01, max: 30000, msc: 30000 },
  // Above 30,000 uses fixed MSC of 30,000
];

const SSS_EMPLOYEE_RATE = 0.11; // 11%
const SSS_EMPLOYER_RATE = 0.085; // 8.5%
const SSS_TOTAL_RATE = 0.195; // 19.5%

/**
 * Pag-IBIG Contribution Brackets (2025)
 * Employee share: 2% for salary ≥ 1,500, 1% for salary < 1,500
 * Employer share: 2% (fixed)
 * Total: 4% for salary ≥ 1,500, 3% for salary < 1,500
 */
const PAGIBIG_RATE_ABOVE_1500 = 0.04; // 4% total (2% employee + 2% employer)
const PAGIBIG_RATE_BELOW_1500 = 0.03; // 3% total (1% employee + 2% employer)
const PAGIBIG_THRESHOLD = 1500;

/**
 * PhilHealth Contribution (2025)
 * Based on monthly salary
 * Employee share: 2% of monthly salary
 * Employer share: 2% of monthly salary
 * Total: 4% of monthly salary
 * Minimum: 400/month, Maximum: 3,200/month
 */
const PHILHEALTH_RATE = 0.04; // 4% total (2% employee + 2% employer)
const PHILHEALTH_MIN = 400;
const PHILHEALTH_MAX = 3200;

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
  if (monthlySalary > 30000) {
    return 30000;
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
 * Calculate SSS contribution
 * @param monthlySalary Monthly salary
 * @returns Object with employee share, employer share, and total
 */
export function calculateSSS(monthlySalary: number): {
  employeeShare: number;
  employerShare: number;
  total: number;
  msc: number;
} {
  const msc = findSSSBracket(monthlySalary);
  const employeeShare = msc * SSS_EMPLOYEE_RATE;
  const employerShare = msc * SSS_EMPLOYER_RATE;
  const total = msc * SSS_TOTAL_RATE;

  return {
    employeeShare: Math.round(employeeShare * 100) / 100,
    employerShare: Math.round(employerShare * 100) / 100,
    total: Math.round(total * 100) / 100,
    msc,
  };
}

/**
 * Calculate Pag-IBIG contribution
 * @param monthlySalary Monthly salary
 * @returns Object with employee share, employer share, and total
 */
export function calculatePagIBIG(monthlySalary: number): {
  employeeShare: number;
  employerShare: number;
  total: number;
} {
  let employeeShare: number;
  let employerShare: number;
  let total: number;

  if (monthlySalary >= PAGIBIG_THRESHOLD) {
    // 2% employee + 2% employer = 4% total
    total = monthlySalary * PAGIBIG_RATE_ABOVE_1500;
    employeeShare = monthlySalary * 0.02;
    employerShare = monthlySalary * 0.02;
  } else {
    // 1% employee + 2% employer = 3% total
    total = monthlySalary * PAGIBIG_RATE_BELOW_1500;
    employeeShare = monthlySalary * 0.01;
    employerShare = monthlySalary * 0.02;
  }

  return {
    employeeShare: Math.round(employeeShare * 100) / 100,
    employerShare: Math.round(employerShare * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Calculate PhilHealth contribution
 * @param monthlySalary Monthly salary
 * @returns Object with employee share, employer share, and total
 */
export function calculatePhilHealth(monthlySalary: number): {
  employeeShare: number;
  employerShare: number;
  total: number;
} {
  let total = monthlySalary * PHILHEALTH_RATE;

  // Apply min/max limits
  if (total < PHILHEALTH_MIN) {
    total = PHILHEALTH_MIN;
  } else if (total > PHILHEALTH_MAX) {
    total = PHILHEALTH_MAX;
  }

  const employeeShare = total / 2; // 50% of total
  const employerShare = total / 2; // 50% of total

  return {
    employeeShare: Math.round(employeeShare * 100) / 100,
    employerShare: Math.round(employerShare * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
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
      sss: Math.round((sss.total / 2) * 100) / 100,
      pagibig: Math.round((pagibig.total / 2) * 100) / 100,
      philhealth: Math.round((philhealth.total / 2) * 100) / 100,
    },
  };
}

