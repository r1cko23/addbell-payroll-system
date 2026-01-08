/**
 * Module Exports
 *
 * Central export point for all modules.
 * Use specific module imports for better tree-shaking:
 *
 * Good:  import { calculateSSS } from "@/modules/payroll";
 * Avoid: import { calculateSSS } from "@/modules";
 */

export * as payroll from "./payroll";
export * as attendance from "./attendance";
export * as employees from "./employees";
export * as leave from "./leave";
export * as auth from "./auth";