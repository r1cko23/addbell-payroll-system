/**
 * Display label for `users.role` (snake_case in DB).
 */
export function formatRoleName(role: string): string {
  if (!role) return "";
  const roleMap: Record<string, string> = {
    admin: "Admin",
    upper_management: "Upper Management",
    hr: "HR",
    operations_manager: "Operations Manager",
    project_manager: "Project Manager",
    purchasing_officer: "Purchasing Officer",
    approver: "Approver",
    viewer: "Viewer",
    account_manager: "Account Manager",
    ot_approver: "OT Approver",
    ot_viewer: "OT Viewer",
  };
  return (
    roleMap[role] ||
    role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  );
}
