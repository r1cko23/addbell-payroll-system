/**
 * Employees Module - Public API
 *
 * This module handles all employee-related functionality:
 * - Employee profiles
 * - Employee schedules
 * - Location assignments
 *
 * Import from this file only - internal implementation may change.
 */

// Components
export { EmployeeAvatar } from "@/components/EmployeeAvatar";
export { ProfilePictureUpload } from "@/components/ProfilePictureUpload";

// Services
export { resolveLocationDetails, type OfficeLocation } from "@/lib/location";