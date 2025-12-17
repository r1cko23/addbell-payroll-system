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

/**
 * Format date to Philippine timezone (Asia/Manila, UTC+8)
 * Converts UTC timestamps to Philippine local time
 * Uses date-fns compatible format strings
 */
export function formatPHTime(date: Date | string, formatStr: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Get Philippine time components using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true
  });
  
  // Format to get all components
  const parts = formatter.formatToParts(dateObj);
  
  // Extract components
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1; // 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  let hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const ampm = parts.find(p => p.type === 'dayPeriod')?.value || 'AM';
  
  // Convert to 24-hour format first, then to 12-hour if needed
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const hours12 = hours % 12 || 12;
  
  let result = formatStr;
  
  // Replace format patterns (order matters - longer patterns first)
  result = result.replace('MMMM', monthNamesFull[month]);
  result = result.replace('MMM', monthNames[month]);
  result = result.replace('MM', String(month + 1).padStart(2, '0'));
  result = result.replace('dd', String(day).padStart(2, '0'));
  result = result.replace('yyyy', String(year));
  result = result.replace('yy', String(year).slice(-2));
  result = result.replace('h:mm a', `${hours12}:${String(minutes).padStart(2, '0')} ${ampm}`);
  result = result.replace('h:mm', `${hours12}:${String(minutes).padStart(2, '0')}`);
  result = result.replace('HH:mm', `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  
  return result;
}

