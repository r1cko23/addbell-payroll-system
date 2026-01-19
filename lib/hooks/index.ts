/**
 * Custom Hooks - Centralized Export
 */

export { useDebounce } from "./use-debounce";
export { useToast, toast } from "./use-toast";
export { useSelectionState } from "./useSelectionState";
export { useUserRole, clearUserRoleCache } from "./useUserRole";
export {
  usePermissions,
  clearPermissionsCache,
  getDefaultPermissionsForRole,
  mergePermissions,
  MODULES,
  ACTIONS,
  MODULE_INFO,
  DEFAULT_PERMISSIONS,
} from "./usePermissions";
export type {
  ModuleName,
  ActionName,
  ModulePermissions,
  UserPermissions,
  ModuleInfo,
} from "./usePermissions";