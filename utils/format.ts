/**
 * Formatting utilities
 */

/**
 * Format currency to Philippine Peso
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
}

/**
 * Format number with 2 decimal places
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

/**
 * Format hours display
 */
export function formatHours(hours: number): string {
  return `${hours.toFixed(1)} hr${hours !== 1 ? 's' : ''}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Generate payslip number
 */
export function generatePayslipNumber(
  employeeId: string,
  weekNumber: number,
  year: number
): string {
  return `${employeeId}-${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

