/**
 * Utility functions for formatting employee names
 */

/**
 * Formats employee name as "Last Name, First Name Middle Initial"
 * @param fullName - Full name string (e.g., "ANGELIQUE ANA MAE P. ABARRA")
 * @param lastName - Last name (optional, for more accurate parsing)
 * @param firstName - First name (optional, for more accurate parsing)
 * @param middleInitial - Middle initial (optional, for more accurate parsing)
 * @returns Formatted name (e.g., "ABARRA, ANGELIQUE ANA MAE P.")
 */
export function formatEmployeeNameForDisplay(
  fullName: string | null | undefined,
  lastName?: string | null,
  firstName?: string | null,
  middleInitial?: string | null
): string {
  if (!fullName) return "";

  // If we have separate name fields, use them for more accurate formatting
  if (lastName && firstName) {
    const parts: string[] = [];
    
    // Add last name first
    parts.push(lastName.trim().toUpperCase());
    
    // Add first name
    parts.push(firstName.trim().toUpperCase());
    
    // Add middle initial if available
    if (middleInitial) {
      parts.push(middleInitial.trim().toUpperCase());
    } else {
      // Try to extract middle name/initial from full name
      const nameParts = fullName.trim().split(/\s+/);
      if (nameParts.length > 2) {
        // Middle parts are between first and last
        const middleParts = nameParts.slice(1, -1);
        parts.push(...middleParts.map(p => p.toUpperCase()));
      }
    }
    
    return parts.join(" ");
  }

  // Fallback: Parse from full name string
  const nameParts = fullName.trim().split(/\s+/);
  
  if (nameParts.length === 0) return fullName;
  if (nameParts.length === 1) return nameParts[0].toUpperCase();
  
  // Last name is the last part
  const lastNamePart = nameParts[nameParts.length - 1];
  // First name is the first part
  const firstNamePart = nameParts[0];
  // Middle parts are everything in between
  const middleParts = nameParts.slice(1, -1);
  
  const parts: string[] = [
    lastNamePart.toUpperCase(),
    firstNamePart.toUpperCase(),
    ...middleParts.map(p => p.toUpperCase())
  ];
  
  return parts.join(" ");
}

/**
 * Formats employee name with ID for dropdown display
 * @param fullName - Full name string
 * @param employeeId - Employee ID
 * @param lastName - Last name (optional)
 * @param firstName - First name (optional)
 * @param middleInitial - Middle initial (optional)
 * @returns Formatted string (e.g., "ABARRA, ANGELIQUE ANA MAE P. (25546)")
 */
export function formatEmployeeNameWithId(
  fullName: string | null | undefined,
  employeeId: string,
  lastName?: string | null,
  firstName?: string | null,
  middleInitial?: string | null
): string {
  const formattedName = formatEmployeeNameForDisplay(
    fullName,
    lastName,
    firstName,
    middleInitial
  );
  
  return `${formattedName} (${employeeId})`;
}
