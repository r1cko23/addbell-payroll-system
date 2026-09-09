/**
 * Server-safe permission types, defaults, and merge helpers.
 * Used by middleware, API routes, and the usePermissions hook.
 */

// Define all available modules in the system
export const MODULES = {
  dashboard: "dashboard",
  employees: "employees",
  loans: "loans",
  payslips: "payslips",
  fund_requests: "fund_requests",
  purchase_orders: "purchase_orders",
  timesheet: "timesheet",
  time_entries: "time_entries",
  leave_approval: "leave_approval",
  overtime_approval: "overtime_approval",
  failure_to_log: "failure_to_log",
  audit: "audit",
  bir_reports: "bir_reports",
  reports: "reports",
  settings: "settings",
  user_management: "user_management",
  clients: "clients",
  projects: "projects",
  vendors: "vendors",
} as const;

export type ModuleName = (typeof MODULES)[keyof typeof MODULES];

// Define actions
export const ACTIONS = {
  create: "create",
  read: "read",
  update: "update",
  delete: "delete",
} as const;

export type ActionName = (typeof ACTIONS)[keyof typeof ACTIONS];

// Module permission structure
export interface ModulePermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

// Full permissions object
export type UserPermissions = Record<ModuleName, ModulePermissions>;

// Module display information for UI
export interface ModuleInfo {
  key: ModuleName;
  label: string;
  description: string;
  category: "overview" | "people" | "time" | "admin" | "settings";
}

// Define module metadata for the UI
export const MODULE_INFO: ModuleInfo[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Executive and workforce dashboards",
    category: "overview",
  },
  {
    key: "employees",
    label: "Employees",
    description: "Employee directory and management",
    category: "people",
  },
  {
    key: "loans",
    label: "Loans",
    description: "Employee loan management",
    category: "people",
  },
  {
    key: "payslips",
    label: "Payslips",
    description: "Payroll and payslip generation",
    category: "people",
  },
  {
    key: "fund_requests",
    label: "Fund Requests",
    description: "Fund request filing and tracking",
    category: "admin",
  },
  {
    key: "purchase_orders",
    label: "Purchase Orders",
    description: "Purchase order viewing and processing",
    category: "admin",
  },
  {
    key: "timesheet",
    label: "Time Attendance",
    description: "Attendance records and timesheet",
    category: "time",
  },
  {
    key: "time_entries",
    label: "Time Entries",
    description: "Clock in/out entries",
    category: "time",
  },
  {
    key: "leave_approval",
    label: "Leave Approvals",
    description: "Leave request management",
    category: "time",
  },
  {
    key: "overtime_approval",
    label: "OT Approvals",
    description: "Overtime request management",
    category: "time",
  },
  {
    key: "failure_to_log",
    label: "Failure to Log",
    description: "Missed clock-in/out requests",
    category: "time",
  },
  {
    key: "audit",
    label: "Audit Dashboard",
    description: "System audit logs",
    category: "admin",
  },
  {
    key: "bir_reports",
    label: "BIR Reports",
    description: "Tax and compliance reports",
    category: "admin",
  },
  {
    key: "reports",
    label: "Payroll Register",
    description: "Payroll reports and summaries",
    category: "admin",
  },
  {
    key: "settings",
    label: "Settings",
    description: "System settings",
    category: "settings",
  },
  {
    key: "user_management",
    label: "User Management",
    description: "Admin user accounts and permissions",
    category: "settings",
  },
  {
    key: "clients",
    label: "Clients",
    description: "Client companies and contacts",
    category: "admin",
  },
  {
    key: "projects",
    label: "Projects",
    description: "Construction projects and tracking",
    category: "admin",
  },
  {
    key: "vendors",
    label: "Vendors",
    description: "Suppliers for purchase orders",
    category: "admin",
  },
];

// Full system admin permissions (Jericko / role `admin` only)
const FULL_MODULE_PERMISSIONS: ModulePermissions = {
  create: true,
  read: true,
  update: true,
  delete: true,
};

const ADMIN_DIRECTORY_MODULES: ModuleName[] = ["clients", "projects", "vendors"];

const ADMIN_PERMISSIONS = Object.fromEntries(
  Object.values(MODULES).map((module) => [module, { ...FULL_MODULE_PERMISSIONS }])
) as UserPermissions;

// Upper management: same as admin except user_management and project-directory writes
const UPPER_MANAGEMENT_PERMISSIONS: UserPermissions = {
  ...ADMIN_PERMISSIONS,
  user_management: { create: false, read: false, update: false, delete: false },
  clients: { create: false, read: true, update: false, delete: false },
  projects: { create: false, read: true, update: false, delete: false },
  vendors: { create: false, read: true, update: false, delete: false },
};

// Default permissions by role
export const DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
  admin: ADMIN_PERMISSIONS,
  upper_management: UPPER_MANAGEMENT_PERMISSIONS,
  hr: {
    dashboard: { create: false, read: true, update: false, delete: false },
    employees: { create: true, read: true, update: true, delete: false },
    loans: { create: true, read: true, update: true, delete: false },
    payslips: { create: true, read: true, update: true, delete: false },
    fund_requests: { create: true, read: true, update: true, delete: false },
    purchase_orders: { create: true, read: true, update: true, delete: false },
    timesheet: { create: false, read: true, update: true, delete: false },
    time_entries: { create: true, read: true, update: false, delete: true },
    leave_approval: { create: false, read: true, update: true, delete: false },
    overtime_approval: { create: false, read: true, update: true, delete: false },
    failure_to_log: { create: false, read: true, update: true, delete: false },
    audit: { create: false, read: true, update: false, delete: false },
    bir_reports: { create: false, read: true, update: false, delete: false },
    reports: { create: false, read: true, update: false, delete: false },
    settings: { create: false, read: true, update: false, delete: false },
    user_management: { create: false, read: false, update: false, delete: false },
    clients: { create: false, read: true, update: false, delete: false },
    projects: { create: false, read: true, update: false, delete: false },
    vendors: { create: false, read: true, update: false, delete: false },
  },
  // Addbell: Operations Manager - project oversight, approvals, fund requests
  operations_manager: {
    dashboard: { create: false, read: true, update: false, delete: false },
    employees: { create: false, read: false, update: false, delete: false },
    loans: { create: false, read: false, update: false, delete: false },
    payslips: { create: false, read: false, update: false, delete: false },
    fund_requests: { create: true, read: true, update: false, delete: false },
    purchase_orders: { create: false, read: true, update: false, delete: false },
    timesheet: { create: false, read: false, update: false, delete: false },
    time_entries: { create: false, read: false, update: false, delete: false },
    leave_approval: { create: false, read: true, update: true, delete: false },
    overtime_approval: { create: false, read: true, update: true, delete: false },
    failure_to_log: { create: false, read: true, update: true, delete: false },
    audit: { create: false, read: false, update: false, delete: false },
    bir_reports: { create: false, read: false, update: false, delete: false },
    reports: { create: false, read: false, update: false, delete: false },
    settings: { create: false, read: false, update: false, delete: false },
    user_management: { create: false, read: false, update: false, delete: false },
    clients: { create: false, read: true, update: false, delete: false },
    projects: { create: true, read: true, update: true, delete: true },
    vendors: { create: false, read: true, update: false, delete: false },
  },
  // Addbell: Purchasing Officer - fund request approval, limited dashboard
  purchasing_officer: {
    dashboard: { create: false, read: true, update: false, delete: false },
    employees: { create: false, read: false, update: false, delete: false },
    loans: { create: false, read: false, update: false, delete: false },
    payslips: { create: false, read: false, update: false, delete: false },
    fund_requests: { create: true, read: true, update: true, delete: false },
    purchase_orders: { create: true, read: true, update: true, delete: false },
    timesheet: { create: false, read: false, update: false, delete: false },
    time_entries: { create: false, read: false, update: false, delete: false },
    leave_approval: { create: false, read: true, update: true, delete: false },
    overtime_approval: { create: false, read: true, update: true, delete: false },
    failure_to_log: { create: false, read: true, update: true, delete: false },
    audit: { create: false, read: false, update: false, delete: false },
    bir_reports: { create: false, read: false, update: false, delete: false },
    reports: { create: false, read: false, update: false, delete: false },
    settings: { create: false, read: false, update: false, delete: false },
    user_management: { create: false, read: false, update: false, delete: false },
    clients: { create: false, read: true, update: false, delete: false },
    projects: { create: false, read: true, update: false, delete: false },
    vendors: { create: true, read: true, update: true, delete: true },
  },
  approver: {
    dashboard: { create: false, read: false, update: false, delete: false },
    employees: { create: false, read: false, update: false, delete: false },
    loans: { create: false, read: false, update: false, delete: false },
    payslips: { create: false, read: false, update: false, delete: false },
    fund_requests: { create: false, read: false, update: false, delete: false },
    purchase_orders: { create: false, read: false, update: false, delete: false },
    timesheet: { create: false, read: true, update: false, delete: false },
    time_entries: { create: false, read: true, update: false, delete: false },
    leave_approval: { create: false, read: true, update: true, delete: false },
    overtime_approval: { create: false, read: true, update: true, delete: false },
    failure_to_log: { create: false, read: true, update: true, delete: false },
    audit: { create: false, read: false, update: false, delete: false },
    bir_reports: { create: false, read: false, update: false, delete: false },
    reports: { create: false, read: false, update: false, delete: false },
    settings: { create: false, read: false, update: false, delete: false },
    user_management: { create: false, read: false, update: false, delete: false },
    clients: { create: false, read: true, update: false, delete: false },
    projects: { create: false, read: true, update: false, delete: false },
    vendors: { create: false, read: true, update: false, delete: false },
  },
  viewer: {
    dashboard: { create: false, read: false, update: false, delete: false },
    employees: { create: false, read: false, update: false, delete: false },
    loans: { create: false, read: false, update: false, delete: false },
    payslips: { create: false, read: false, update: false, delete: false },
    fund_requests: { create: false, read: false, update: false, delete: false },
    purchase_orders: { create: false, read: false, update: false, delete: false },
    timesheet: { create: false, read: true, update: false, delete: false },
    time_entries: { create: false, read: true, update: false, delete: false },
    leave_approval: { create: false, read: true, update: false, delete: false },
    overtime_approval: { create: false, read: true, update: false, delete: false },
    failure_to_log: { create: false, read: true, update: false, delete: false },
    audit: { create: false, read: false, update: false, delete: false },
    bir_reports: { create: false, read: false, update: false, delete: false },
    reports: { create: false, read: false, update: false, delete: false },
    settings: { create: false, read: false, update: false, delete: false },
    user_management: { create: false, read: false, update: false, delete: false },
    clients: { create: false, read: true, update: false, delete: false },
    projects: { create: false, read: true, update: false, delete: false },
    vendors: { create: false, read: true, update: false, delete: false },
  },
  project_manager: {
    dashboard: { create: false, read: true, update: false, delete: false },
    employees: { create: false, read: true, update: true, delete: false },
    loans: { create: false, read: false, update: false, delete: false },
    payslips: { create: false, read: true, update: false, delete: false },
    fund_requests: { create: true, read: true, update: true, delete: false },
    purchase_orders: { create: true, read: true, update: true, delete: false },
    timesheet: { create: false, read: true, update: true, delete: false },
    time_entries: { create: true, read: true, update: true, delete: true },
    leave_approval: { create: false, read: true, update: true, delete: false },
    overtime_approval: { create: false, read: true, update: true, delete: false },
    failure_to_log: { create: false, read: true, update: true, delete: false },
    audit: { create: false, read: true, update: false, delete: false },
    bir_reports: { create: false, read: false, update: false, delete: false },
    reports: { create: false, read: true, update: false, delete: false },
    settings: { create: false, read: false, update: false, delete: false },
    user_management: { create: false, read: false, update: false, delete: false },
    clients: { create: false, read: true, update: false, delete: false },
    projects: { create: false, read: true, update: false, delete: false },
    vendors: { create: false, read: true, update: false, delete: false },
  },
};

// Empty permissions (deny all)
export const EMPTY_PERMISSIONS: UserPermissions = Object.fromEntries(
  Object.values(MODULES).map((module) => [
    module,
    { create: false, read: false, update: false, delete: false },
  ])
) as UserPermissions;

/**
 * Get default permissions for a role
 */
export function getDefaultPermissionsForRole(role: string): UserPermissions {
  return DEFAULT_PERMISSIONS[role] || EMPTY_PERMISSIONS;
}

/**
 * Merge custom permissions with role defaults
 */
export function mergePermissions(
  role: string,
  customPermissions: Partial<UserPermissions> | null
): UserPermissions {
  const defaults = getDefaultPermissionsForRole(role);
  if (!customPermissions) return defaults;

  const merged = { ...defaults };
  for (const [module, perms] of Object.entries(customPermissions)) {
    if (merged[module as ModuleName]) {
      merged[module as ModuleName] = {
        ...merged[module as ModuleName],
        ...perms,
      };
    }
  }

  // System owner only — never grant user_management via custom overrides
  if (role !== "admin") {
    merged.user_management = {
      create: false,
      read: false,
      update: false,
      delete: false,
    };
  }

  // Admin always retains full CRUD on clients, projects, vendors, and subcontractors
  // (subcontractors share the vendors permission module).
  if (role === "admin") {
    for (const module of ADMIN_DIRECTORY_MODULES) {
      merged[module] = { ...FULL_MODULE_PERMISSIONS };
    }
  }

  return merged;
}