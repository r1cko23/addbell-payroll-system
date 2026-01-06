/**
 * Auth Module - Public API
 *
 * This module handles all authentication functionality:
 * - User authentication
 * - Role management
 * - Session handling
 *
 * Import from this file only - internal implementation may change.
 */

// Hooks
export { useUserRole, clearUserRoleCache } from "@/lib/hooks/useUserRole";

// Supabase Client
export { createClient, resetClient } from "@/lib/supabase/client";

// API Utilities
export {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  badRequestResponse,
  validateRequiredFields,
} from "@/lib/api-utils";


