"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/format";
import { format } from "date-fns";
import { H1, H2, H3, H4, BodySmall, Caption } from "@/components/ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Icon } from "@/components/ui/phosphor-icon";
import { useUserRole } from "@/lib/hooks/useUserRole";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
}

interface EmployeeLoan {
  id: string;
  employee_id: string;
  loan_type:
    | "company"
    | "sss_calamity"
    | "pagibig_calamity"
    | "sss"
    | "pagibig"
    | "emergency"
    | "other";
  original_balance: number;
  current_balance: number;
  monthly_payment: number;
  total_terms: number;
  remaining_terms: number;
  effectivity_date: string;
  cutoff_assignment: "first" | "second" | "both";
  deduct_bi_monthly: boolean;
  is_active: boolean;
  notes?: string;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
  employee?: Employee;
}

export default function LoansPage() {
  const { isHR, isAdmin, loading: roleLoading } = useUserRole();
  const supabase = createClient();
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedLoanForAudit, setSelectedLoanForAudit] =
    useState<EmployeeLoan | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [criticalChanges, setCriticalChanges] = useState<string[]>([]);
  const [pendingLoanData, setPendingLoanData] = useState<any>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [selectedLoanForHistory, setSelectedLoanForHistory] =
    useState<EmployeeLoan | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: "",
    loan_type: "company" as
      | "company"
      | "sss_calamity"
      | "pagibig_calamity"
      | "sss"
      | "pagibig"
      | "emergency"
      | "other",
    original_balance: "",
    current_balance: "",
    monthly_payment: "",
    total_terms: "",
    remaining_terms: "",
    effectivity_date: "",
    cutoff_assignment: "first" as "first" | "second" | "both",
    deduct_bi_monthly: true,
    notes: "",
  });

  useEffect(() => {
    loadEmployees();
    loadLoans();
  }, []);

  // Auto-calculate monthly payment when original balance or total terms change
  useEffect(() => {
    const originalBalance = parseFloat(formData.original_balance) || 0;
    const totalTerms = parseInt(formData.total_terms) || 0;

    if (originalBalance > 0 && totalTerms > 0) {
      const calculatedMonthlyPayment = originalBalance / totalTerms;
      setFormData((prev) => ({
        ...prev,
        monthly_payment: calculatedMonthlyPayment.toFixed(2),
      }));
    }
  }, [formData.original_balance, formData.total_terms]);

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, last_name, first_name")
        .eq("is_active", true)
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error("Error loading employees:", error);
      toast.error("Failed to load employees");
    }
  }

  async function loadLoans() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        // @ts-ignore - employee_loans table type may not be in generated types
        .from("employee_loans")
        .select(
          `
          *,
          employee:employees(id, employee_id, full_name)
        `
        )
        .order("remaining_terms", { ascending: true })
        .order("created_at", { ascending: false }); // Secondary sort by creation date

      if (error) throw error;
      setLoans(data || []);
    } catch (error: any) {
      console.error("Error loading loans:", error);
      toast.error("Failed to load loans");
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingLoan(null);
    const defaultTerms = calculateDefaultTerms("company");
    setFormData({
      employee_id: "",
      loan_type: "company",
      original_balance: "",
      current_balance: "",
      monthly_payment: "",
      total_terms: defaultTerms.toString(),
      remaining_terms: defaultTerms.toString(),
      effectivity_date: "",
      cutoff_assignment: "first",
      deduct_bi_monthly: true,
      notes: "",
    });
    setShowModal(true);
  }

  function openEditModal(loan: EmployeeLoan) {
    setEditingLoan(loan);
    setFormData({
      employee_id: loan.employee_id,
      loan_type: loan.loan_type,
      original_balance: loan.original_balance.toString(),
      current_balance: loan.current_balance.toString(),
      monthly_payment: loan.monthly_payment.toString(),
      total_terms: loan.total_terms.toString(),
      remaining_terms: loan.remaining_terms.toString(),
      effectivity_date: loan.effectivity_date,
      cutoff_assignment: loan.cutoff_assignment,
      deduct_bi_monthly: loan.deduct_bi_monthly ?? true,
      notes: loan.notes || "",
    });
    setShowModal(true);
  }

  function calculateDefaultTerms(loanType: string): number {
    switch (loanType) {
      case "company":
        return 6;
      case "sss_calamity":
      case "sss":
        return 24;
      case "pagibig_calamity":
      case "pagibig":
        return 12; // Default, user can change to 24 or 36
      case "emergency":
      case "other":
        return 12; // Default flexible terms, user can adjust
      default:
        return 6;
    }
  }

  function handleLoanTypeChange(loanType: string) {
    const defaultTerms = calculateDefaultTerms(loanType);
    const originalBalance = parseFloat(formData.original_balance) || 0;
    const calculatedMonthlyPayment =
      originalBalance > 0 && defaultTerms > 0
        ? originalBalance / defaultTerms
        : 0;

    setFormData({
      ...formData,
      loan_type: loanType as any,
      total_terms: defaultTerms.toString(),
      remaining_terms: formData.remaining_terms || defaultTerms.toString(),
      monthly_payment:
        calculatedMonthlyPayment > 0
          ? calculatedMonthlyPayment.toFixed(2)
          : formData.monthly_payment,
    });
  }

  async function performLoanUpdate(loanData: any) {
    setSubmitting(true);

    try {
      if (!editingLoan) {
        toast.error("No loan selected for update");
        setSubmitting(false);
        return;
      }

      // Get current user for audit tracking
      const { data: userData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !userData.user) {
        console.error("Auth error:", authError);
        toast.error("Authentication error. Please log in again.");
        setSubmitting(false);
        return;
      }

      // Update loan with updated_by for audit trail
      // Only update fields that are allowed to be changed (exclude id, created_by, created_at, is_active)
      const updateData = {
        employee_id: loanData.employee_id,
        loan_type: loanData.loan_type,
        original_balance: parseFloat(loanData.original_balance.toString()),
        current_balance: parseFloat(loanData.current_balance.toString()),
        monthly_payment: parseFloat(loanData.monthly_payment.toString()),
        total_terms: parseInt(loanData.total_terms.toString()),
        remaining_terms: parseInt(loanData.remaining_terms.toString()),
        effectivity_date: loanData.effectivity_date,
        cutoff_assignment: loanData.cutoff_assignment,
        notes: loanData.notes || null,
        updated_by: userData.user.id,
      } as Record<string, unknown>;

      console.log("Updating loan with data:", {
        loanId: editingLoan.id,
        updateData,
        user: userData.user.id,
      });

      // Update loan without select to avoid potential column reference issues
      const { error } = await supabase
        // @ts-ignore - employee_loans table type may not be in generated types
        .from("employee_loans")
        // @ts-ignore - Type inference issue with employee_loans table
        .update(updateData)
        .eq("id", editingLoan.id);

      // Reload loan data separately after successful update
      let data = null;
      if (!error) {
        const { data: updatedLoan } = await supabase
          .from("employee_loans")
          .select("*")
          .eq("id", editingLoan.id)
          .single();
        data = updatedLoan;
      }

      if (error) {
        console.error("Update error details:", {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          updateData,
          updateDataKeys: Object.keys(updateData),
          updateDataValues: Object.values(updateData),
        });

        // Try to provide more helpful error message
        let errorMessage = error.message || "Unknown error";
        if (error.code === "42703") {
          errorMessage = `Column error: ${error.message}. Please check the console for details.`;
        } else if (error.code === "PGRST116") {
          errorMessage =
            "No rows found to update. The loan may have been deleted.";
        } else if (error.code === "23505") {
          errorMessage = "A loan with these details already exists.";
        }

        toast.error(`Failed to update loan: ${errorMessage}`);
        throw error;
      }

      console.log("Loan updated successfully:", data);

      toast.success("Loan updated successfully");
      setShowModal(false);
      setShowConfirmDialog(false);
      setCriticalChanges([]);
      setPendingLoanData(null);
      loadLoans();
    } catch (error: any) {
      console.error("Error updating loan:", error);
      toast.error(
        error.message ||
          "Failed to update loan. Please check the console for details."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e?: React.MouseEvent) {
    // Prevent default form submission if called from button click
    if (e) {
      e.preventDefault();
    }

    setSubmitting(true);

    try {
      console.log("Form submission started", formData);

      // Validation
      if (!formData.employee_id) {
        toast.error("Please select an employee");
        return;
      }
      if (
        !formData.original_balance ||
        parseFloat(formData.original_balance) <= 0
      ) {
        toast.error("Please enter a valid original balance");
        return;
      }
      if (
        !formData.current_balance ||
        parseFloat(formData.current_balance) < 0
      ) {
        toast.error("Please enter a valid current balance");
        return;
      }
      // Validate monthly payment (should be auto-calculated, but check anyway)
      const monthlyPayment = parseFloat(formData.monthly_payment) || 0;
      if (monthlyPayment <= 0) {
        toast.error(
          "Monthly payment must be greater than 0. Please check Original Balance and Total Terms."
        );
        return;
      }

      // Verify calculation is correct (optional check)
      const expectedMonthlyPayment =
        parseFloat(formData.original_balance) / parseInt(formData.total_terms);
      if (Math.abs(monthlyPayment - expectedMonthlyPayment) > 0.01) {
        // Allow slight rounding differences but warn if significantly different
        console.warn(
          "Monthly payment doesn't match calculated value. Using provided value."
        );
      }
      if (!formData.total_terms || parseInt(formData.total_terms) <= 0) {
        toast.error("Please enter valid total terms");
        return;
      }
      const remainingTermsValue = parseInt(formData.remaining_terms);
      if (
        !formData.remaining_terms ||
        isNaN(remainingTermsValue) ||
        remainingTermsValue < 0
      ) {
        toast.error("Remaining terms must be a positive number (0 or greater)");
        return;
      }
      if (!formData.effectivity_date) {
        toast.error("Please select an effectivity date");
        return;
      }

      // Validate terms based on loan type
      const totalTerms = parseInt(formData.total_terms);
      const remainingTerms = parseInt(formData.remaining_terms);

      // Additional validation for remaining terms
      if (isNaN(remainingTerms) || remainingTerms < 0) {
        toast.error("Remaining terms must be a valid positive number");
        return;
      }
      if (isNaN(totalTerms) || totalTerms <= 0) {
        toast.error("Total terms must be a valid positive number");
        return;
      }

      if (formData.loan_type === "company" && totalTerms !== 6) {
        toast.error("Company loan must have 6 months term");
        return;
      }
      if (
        (formData.loan_type === "sss_calamity" ||
          formData.loan_type === "sss") &&
        totalTerms !== 24
      ) {
        toast.error("SSS Loan must have 24 months term");
        return;
      }
      if (
        (formData.loan_type === "pagibig_calamity" ||
          formData.loan_type === "pagibig") &&
        !["12", "24", "36"].includes(totalTerms.toString())
      ) {
        toast.error("Pagibig Loan must have 12, 24, or 36 months term");
        return;
      }
      // Emergency and Other loans have flexible terms (no validation)

      if (remainingTerms > totalTerms) {
        toast.error("Remaining terms cannot exceed total terms");
        return;
      }

      const loanData = {
        employee_id: formData.employee_id,
        loan_type: formData.loan_type,
        original_balance: parseFloat(formData.original_balance),
        current_balance: parseFloat(formData.current_balance),
        monthly_payment: parseFloat(formData.monthly_payment),
        total_terms: totalTerms,
        remaining_terms: remainingTerms,
        effectivity_date: formData.effectivity_date,
        cutoff_assignment: formData.cutoff_assignment,
        deduct_bi_monthly: formData.deduct_bi_monthly,
        notes: formData.notes || null,
        // Don't update is_active during regular edit - it's managed separately via toggle
      };

      if (editingLoan) {
        // Check for critical changes that require confirmation
        const criticalChanges: string[] = [];
        if (
          parseFloat(formData.original_balance) !== editingLoan.original_balance
        ) {
          criticalChanges.push(
            `Original Balance: ${formatCurrency(
              editingLoan.original_balance
            )} → ${formatCurrency(parseFloat(formData.original_balance))}`
          );
        }
        if (
          parseFloat(formData.current_balance) !== editingLoan.current_balance
        ) {
          criticalChanges.push(
            `Current Balance: ${formatCurrency(
              editingLoan.current_balance
            )} → ${formatCurrency(parseFloat(formData.current_balance))}`
          );
        }
        if (parseInt(formData.total_terms) !== editingLoan.total_terms) {
          criticalChanges.push(
            `Total Terms: ${editingLoan.total_terms} → ${formData.total_terms}`
          );
        }
        if (
          parseInt(formData.remaining_terms) !== editingLoan.remaining_terms
        ) {
          criticalChanges.push(
            `Remaining Terms: ${editingLoan.remaining_terms} → ${formData.remaining_terms}`
          );
        }

        // Show confirmation for critical changes
        if (criticalChanges.length > 0) {
          setCriticalChanges(criticalChanges);
          setPendingLoanData(loanData);
          setShowConfirmDialog(true);
          setSubmitting(false); // Reset submitting state while waiting for confirmation
          return; // Wait for user confirmation
        }

        // Proceed with update (no critical changes)
        await performLoanUpdate(loanData);
      } else {
        // Verify authentication before inserting
        const { data: userData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !userData.user) {
          console.error("Auth error:", authError);
          toast.error("Authentication error. Please log in again.");
          return;
        }

        // Verify user role from public.users table
        const { data: userRecord, error: userError } = await supabase
          .from("users")
          .select("id, role, is_active")
          .eq("id", userData.user.id)
          .single();

        if (userError || !userRecord) {
          console.error("User record error:", userError);
          toast.error("Unable to verify user permissions.");
          return;
        }

        console.log("Authenticated user:", userData.user.id);
        console.log("User record:", userRecord);
        console.log("Loan data to insert:", loanData);

        // Check if user has permission
        if (
          !(userRecord as any).is_active ||
          ((userRecord as any).role !== "admin" &&
            (userRecord as any).role !== "hr")
        ) {
          toast.error(
            "You don't have permission to create loans. Only Admin and HR can create loans."
          );
          return;
        }

        const { data: insertData, error } = await supabase
          // @ts-ignore - employee_loans table type may not be in generated types
          .from("employee_loans")
          // @ts-ignore - employee_loans table type may not be in generated types
          .insert({
            ...loanData,
            created_by: userData.user.id,
          })
          .select();

        if (error) {
          console.error("Insert error:", error);
          console.error("Error code:", error.code);
          console.error("Error message:", error.message);
          console.error("Error details:", JSON.stringify(error, null, 2));

          // More specific error messages
          if (
            error.code === "42501" ||
            error.message?.includes("permission denied")
          ) {
            toast.error(
              "Permission denied. Please check your user role and permissions."
            );
          } else {
            toast.error(error.message || "Failed to create loan");
          }
          return;
        }

        console.log("Insert successful:", insertData);
        toast.success("Loan created successfully");
      }

      setShowModal(false);
      loadLoans();
    } catch (error: any) {
      console.error("Error saving loan:", error);
      toast.error(error.message || "Failed to save loan");
    }
  }

  async function toggleLoanStatus(loan: EmployeeLoan) {
    try {
      // Get current user for audit tracking
      const { data: userData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !userData.user) {
        console.error("Auth error:", authError);
        toast.error("Authentication error. Please log in again.");
        return;
      }

      // Update loan status with updated_by for audit trail
      const { error } = await supabase
        // @ts-ignore - employee_loans table type may not be in generated types
        .from("employee_loans")
        // @ts-ignore - employee_loans table type may not be in generated types
        .update({
          is_active: !loan.is_active,
          updated_by: userData.user.id,
        })
        .eq("id", loan.id);

      if (error) throw error;
      toast.success(
        `Loan ${loan.is_active ? "deactivated" : "activated"} successfully`
      );
      loadLoans();
    } catch (error: any) {
      console.error("Error updating loan status:", error);
      toast.error("Failed to update loan status");
    }
  }

  function getLoanTypeLabel(type: string): string {
    switch (type) {
      case "company":
        return "Company Loan";
      case "sss_calamity":
        return "SSS Calamity Loan";
      case "pagibig_calamity":
        return "Pagibig Calamity Loan";
      case "sss":
        return "SSS Loan";
      case "pagibig":
        return "Pag-IBIG Loan";
      case "emergency":
        return "Emergency Loan";
      case "other":
        return "Other Loan";
      default:
        return type;
    }
  }

  async function loadAuditLogs(loanId: string) {
    try {
      setLoadingAudit(true);
      const { data: logsData, error: logsError } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", "employee_loans")
        .eq("record_id", loanId)
        .order("created_at", { ascending: false });

      if (logsError) throw logsError;

      // Fetch user details for each log entry
      const logsWithUsers = await Promise.all(
        (logsData || []).map(async (log: any) => {
          if (log.user_id) {
            const { data: userData } = await supabase
              .from("users")
              .select("id, email, full_name")
              .eq("id", log.user_id)
              .single();
            return { ...log, user: userData };
          }
          return { ...log, user: null };
        })
      );

      setAuditLogs(logsWithUsers);
    } catch (error: any) {
      console.error("Error loading audit logs:", error);
      toast.error("Failed to load audit history");
    } finally {
      setLoadingAudit(false);
    }
  }

  function openAuditModal(loan: EmployeeLoan) {
    setSelectedLoanForAudit(loan);
    setShowAuditModal(true);
    loadAuditLogs(loan.id);
  }

  async function openPaymentHistoryModal(loan: EmployeeLoan) {
    setSelectedLoanForHistory(loan);
    setShowPaymentHistoryModal(true);
    await loadPaymentHistory(loan);
  }

  async function loadPaymentHistory(loan: EmployeeLoan) {
    setLoadingPaymentHistory(true);
    try {
      // Get all payslips for this employee after the loan's effectivity date
      const { data: payslips, error } = await supabase
        .from("payslips")
        .select(
          "id, period_start, period_end, deductions_breakdown, created_at, payslip_number"
        )
        .eq("employee_id", loan.employee_id)
        .gte("period_start", loan.effectivity_date)
        .order("period_start", { ascending: true });

      if (error) throw error;

      const history: any[] = [];
      let runningBalance = parseFloat(loan.original_balance.toString());

      if (payslips) {
        for (const payslip of payslips as any[]) {
          const deductions = payslip.deductions_breakdown as any;

          // Determine cutoff based on period start date
          const periodStart = new Date(payslip.period_start);
          const isFirstCutoff = periodStart.getDate() <= 15;
          const isSecondCutoff = periodStart.getDate() >= 16;

          // Check if this cutoff should have a payment based on loan's cutoff_assignment
          const shouldHavePayment =
            loan.cutoff_assignment === "both" ||
            (loan.cutoff_assignment === "first" && isFirstCutoff) ||
            (loan.cutoff_assignment === "second" && isSecondCutoff);

          if (!shouldHavePayment) continue;

          // Calculate expected payment amount based on deduct_bi_monthly flag
          const deductBiMonthly = loan.deduct_bi_monthly !== false;
          const expectedPayment =
            loan.cutoff_assignment === "both"
              ? (deductBiMonthly 
                  ? parseFloat(loan.monthly_payment.toString()) / 2 
                  : parseFloat(loan.monthly_payment.toString()))
              : (deductBiMonthly
                  ? parseFloat(loan.monthly_payment.toString()) / 2
                  : parseFloat(loan.monthly_payment.toString()));

          let paymentAmount = 0;

          // Extract payment from deductions_breakdown based on loan type
          if (deductions?.weekly) {
            // Check monthly_loans structure (stored in weekly.monthly_loans for 1st cutoff)
            if (deductions.weekly.monthly_loans && isFirstCutoff) {
              const monthlyLoans = deductions.weekly.monthly_loans;
              switch (loan.loan_type) {
                case "company":
                  paymentAmount = parseFloat(
                    (monthlyLoans.companyLoan || 0).toString()
                  );
                  break;
                case "sss":
                  paymentAmount = parseFloat(
                    (monthlyLoans.sssLoan || 0).toString()
                  );
                  break;
                case "pagibig":
                  paymentAmount = parseFloat(
                    (monthlyLoans.pagibigLoan || 0).toString()
                  );
                  break;
                case "emergency":
                  paymentAmount = parseFloat(
                    (monthlyLoans.emergencyLoan || 0).toString()
                  );
                  break;
                case "other":
                  paymentAmount = parseFloat(
                    (monthlyLoans.otherLoan || 0).toString()
                  );
                  break;
              }
            }

            // Check weekly loan structure (for legacy loans)
            if (paymentAmount === 0) {
              switch (loan.loan_type) {
                case "sss_calamity":
                  paymentAmount = parseFloat(
                    (deductions.weekly.sss_calamity || 0).toString()
                  );
                  break;
                case "pagibig_calamity":
                  paymentAmount = parseFloat(
                    (deductions.weekly.pagibig_calamity || 0).toString()
                  );
                  break;
                case "sss":
                  if (!paymentAmount) {
                    paymentAmount = parseFloat(
                      (deductions.weekly.sss_loan || 0).toString()
                    );
                  }
                  break;
                case "pagibig":
                  if (!paymentAmount) {
                    paymentAmount = parseFloat(
                      (deductions.weekly.pagibig_loan || 0).toString()
                    );
                  }
                  break;
              }
            }
          }

          // Only add entry if payment was made
          if (paymentAmount > 0) {
            runningBalance = Math.max(0, runningBalance - paymentAmount);

            history.push({
              payslip_id: payslip.id,
              payslip_number: payslip.payslip_number,
              period_start: payslip.period_start,
              period_end: payslip.period_end,
              payment_amount: paymentAmount,
              expected_payment: expectedPayment,
              running_balance: runningBalance,
              created_at: payslip.created_at,
            });
          }
        }
      }

      setPaymentHistory(history);
    } catch (error: any) {
      console.error("Error loading payment history:", error);
      toast.error("Failed to load payment history");
      setPaymentHistory([]);
    } finally {
      setLoadingPaymentHistory(false);
    }
  }

  function getLoanTypeBadgeColor(type: string): string {
    switch (type) {
      case "company":
        return "bg-blue-100 text-blue-800";
      case "sss_calamity":
        return "bg-green-100 text-green-800";
      case "pagibig_calamity":
        return "bg-purple-100 text-purple-800";
      case "sss":
        return "bg-emerald-100 text-emerald-800";
      case "pagibig":
        return "bg-indigo-100 text-indigo-800";
      case "emergency":
        return "bg-red-100 text-red-800";
      case "other":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  const filteredLoans = loans.filter((loan) => {
    const matchesSearch =
      loan.employee?.full_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      loan.employee?.employee_id
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || loan.loan_type === filterType;
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && loan.is_active) ||
      (filterStatus === "inactive" && !loan.is_active);
    return matchesSearch && matchesType && matchesStatus;
  });

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isHR && !isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">
            You do not have permission to access this page.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <H1>Loan Management</H1>
          <Button onClick={openAddModal}>
            <Icon name="Plus" className="mr-2 h-4 w-4" />
            Add Loan
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Search by employee name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="company">Company Loan</SelectItem>
                    <SelectItem value="sss_calamity">
                      SSS Calamity Loan
                    </SelectItem>
                    <SelectItem value="pagibig_calamity">
                      Pagibig Calamity Loan
                    </SelectItem>
                    <SelectItem value="sss">SSS Loan</SelectItem>
                    <SelectItem value="pagibig">Pag-IBIG Loan</SelectItem>
                    <SelectItem value="emergency">Emergency Loan</SelectItem>
                    <SelectItem value="other">Other Loan</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading loans...
                </div>
              ) : filteredLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No loans found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Loan Type</TableHead>
                        <TableHead>Original Balance</TableHead>
                        <TableHead>Current Balance</TableHead>
                        <TableHead>Monthly Payment</TableHead>
                        <TableHead>Terms</TableHead>
                        <TableHead>Effectivity Date</TableHead>
                        <TableHead>Cutoff</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLoans.map((loan) => (
                        <TableRow key={loan.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {loan.employee?.full_name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {loan.employee?.employee_id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${getLoanTypeBadgeColor(
                                loan.loan_type
                              )} cursor-pointer hover:opacity-80`}
                              onClick={() => openPaymentHistoryModal(loan)}
                            >
                              {getLoanTypeLabel(loan.loan_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatCurrency(loan.original_balance)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(loan.current_balance)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(loan.monthly_payment)}
                          </TableCell>
                          <TableCell>
                            {loan.total_terms - loan.remaining_terms} /{" "}
                            {loan.total_terms}
                          </TableCell>
                          <TableCell>
                            {format(
                              new Date(loan.effectivity_date),
                              "MMM dd, yyyy"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {loan.cutoff_assignment === "first"
                                ? "1st Cutoff"
                                : loan.cutoff_assignment === "second"
                                ? "2nd Cutoff"
                                : "Both"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={loan.is_active ? "default" : "secondary"}
                            >
                              {loan.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(loan)}
                                title="Edit loan"
                              >
                                <Icon name="PencilSimple" className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openAuditModal(loan)}
                                title="View audit history"
                              >
                                <Icon name="Clock" className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Are you sure you want to ${
                                        loan.is_active
                                          ? "deactivate"
                                          : "activate"
                                      } this loan? This action will be logged.`
                                    )
                                  ) {
                                    toggleLoanStatus(loan);
                                  }
                                }}
                                title={
                                  loan.is_active
                                    ? "Deactivate loan"
                                    : "Activate loan"
                                }
                              >
                                <Icon
                                  name={loan.is_active ? "X" : "Check"}
                                  className="h-4 w-4"
                                />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Loan Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingLoan ? "Edit Loan" : "Add New Loan"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="employee_id">Employee *</Label>
                <Select
                  value={formData.employee_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, employee_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => {
                      const nameParts = emp.full_name?.trim().split(/\s+/) || [];
                      const lastName = emp.last_name || (nameParts.length > 0 ? nameParts[nameParts.length - 1] : "");
                      const firstName = emp.first_name || (nameParts.length > 0 ? nameParts[0] : "");
                      const middleParts = nameParts.length > 2 ? nameParts.slice(1, -1) : [];
                      const displayName = lastName && firstName
                        ? `${lastName.toUpperCase()}, ${firstName.toUpperCase()}${middleParts.length > 0 ? " " + middleParts.join(" ").toUpperCase() : ""}`
                        : emp.full_name || "";
                      return (
                        <SelectItem key={emp.id} value={emp.id}>
                          {displayName} ({emp.employee_id})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="loan_type">Loan Type *</Label>
                <Select
                  value={formData.loan_type}
                  onValueChange={handleLoanTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">
                      Company Loan (6 months)
                    </SelectItem>
                    <SelectItem value="sss_calamity">
                      SSS Calamity Loan (24 months)
                    </SelectItem>
                    <SelectItem value="pagibig_calamity">
                      Pagibig Calamity Loan (12/24/36 months)
                    </SelectItem>
                    <SelectItem value="sss">SSS Loan (24 months)</SelectItem>
                    <SelectItem value="pagibig">
                      Pag-IBIG Loan (12/24/36 months)
                    </SelectItem>
                    <SelectItem value="emergency">
                      Emergency Loan (Flexible terms)
                    </SelectItem>
                    <SelectItem value="other">
                      Other Loan (Flexible terms)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="original_balance">Original Balance *</Label>
                  <Input
                    id="original_balance"
                    type="number"
                    step="0.01"
                    value={formData.original_balance}
                    onChange={(e) => {
                      const newOriginalBalance =
                        parseFloat(e.target.value) || 0;
                      const totalTerms = parseInt(formData.total_terms) || 1;
                      const remainingTerms = parseInt(formData.remaining_terms) || 0;
                      const monthlyPayment = parseFloat(formData.monthly_payment) || 0;

                      // Calculate terms paid
                      const termsPaid = totalTerms - remainingTerms;

                      // Recalculate monthly payment based on new original balance (if not manually set)
                      // Only auto-calculate if monthly payment is currently 0 or matches the old calculation
                      const oldOriginalBalance = parseFloat(formData.original_balance) || 0;
                      const expectedMonthlyPayment = oldOriginalBalance > 0 && totalTerms > 0
                        ? oldOriginalBalance / totalTerms
                        : 0;
                      const isAutoCalculated = Math.abs(monthlyPayment - expectedMonthlyPayment) < 0.01 || monthlyPayment === 0;

                      const newMonthlyPayment = isAutoCalculated && newOriginalBalance > 0 && totalTerms > 0
                        ? newOriginalBalance / totalTerms
                        : monthlyPayment; // Keep manual monthly payment if it was set

                      // Recalculate current balance based on new original balance and terms paid
                      // current_balance = original_balance - (monthly_payment * terms_paid)
                      const newCurrentBalance = Math.max(
                        0,
                        newOriginalBalance - (newMonthlyPayment * termsPaid)
                      );

                      setFormData({
                        ...formData,
                        original_balance: e.target.value,
                        current_balance: newCurrentBalance.toFixed(2),
                        monthly_payment: newMonthlyPayment.toFixed(2),
                      });
                    }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="current_balance">Current Balance *</Label>
                  <Input
                    id="current_balance"
                    type="number"
                    step="0.01"
                    value={formData.current_balance}
                    onChange={(e) => {
                      const newCurrentBalance = parseFloat(e.target.value) || 0;
                      const originalBalance = parseFloat(formData.original_balance) || 0;
                      const monthlyPayment = parseFloat(formData.monthly_payment) || 0;
                      const totalTerms = parseInt(formData.total_terms) || 1;

                      // If monthly payment is set, calculate remaining terms from current balance
                      if (monthlyPayment > 0 && originalBalance > 0) {
                        // Calculate how much has been paid
                        const amountPaid = originalBalance - newCurrentBalance;

                        // Calculate terms paid (round to nearest integer)
                        const termsPaid = Math.round(amountPaid / monthlyPayment);

                        // Calculate remaining terms
                        const newRemainingTerms = Math.max(
                          0,
                          Math.min(totalTerms, totalTerms - termsPaid)
                        );

                        setFormData({
                          ...formData,
                          current_balance: e.target.value,
                          remaining_terms: newRemainingTerms.toString(),
                        });
                      } else {
                        // If monthly payment not set yet, just update current balance
                        setFormData({
                          ...formData,
                          current_balance: e.target.value,
                        });
                      }
                    }}
                    placeholder="0.00"
                  />
                  <Caption className="text-xs text-gray-500 mt-1">
                    Auto-calculates Remaining Terms when you set Current Balance
                    <br />
                    Or auto-calculates Current Balance when you set Remaining Terms
                    <br />
                    Formula: Current Balance = Original Balance - (Monthly Payment × Terms Paid)
                  </Caption>
                </div>
              </div>

              <div>
                <Label htmlFor="monthly_payment">
                  Monthly Payment *
                </Label>
                <Input
                  id="monthly_payment"
                  type="number"
                  step="0.01"
                  value={formData.monthly_payment}
                  onChange={(e) => {
                    const newMonthlyPayment = parseFloat(e.target.value) || 0;
                    const originalBalance = parseFloat(formData.original_balance) || 0;
                    const totalTerms = parseInt(formData.total_terms) || 1;
                    const remainingTerms = parseInt(formData.remaining_terms) || 0;

                    // Calculate terms paid
                    const termsPaid = totalTerms - remainingTerms;

                    // Recalculate current balance based on new monthly payment
                    // current_balance = original_balance - (monthly_payment * terms_paid)
                    const newCurrentBalance = Math.max(
                      0,
                      originalBalance - (newMonthlyPayment * termsPaid)
                    );

                    setFormData({
                      ...formData,
                      monthly_payment: e.target.value,
                      current_balance: newCurrentBalance.toFixed(2),
                    });
                  }}
                  placeholder="0.00"
                />
                <Caption className="text-xs text-gray-500 mt-1">
                  Auto-calculated as Original Balance ÷ Total Terms (can be manually adjusted)
                </Caption>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="total_terms">
                    Total Terms * (
                    {formData.loan_type === "company"
                      ? "6"
                      : formData.loan_type === "sss_calamity" ||
                        formData.loan_type === "sss"
                      ? "24"
                      : formData.loan_type === "pagibig_calamity" ||
                        formData.loan_type === "pagibig"
                      ? "12/24/36"
                      : "Flexible"}
                    )
                  </Label>
                  <Input
                    id="total_terms"
                    type="number"
                    min="1"
                    step="1"
                    value={formData.total_terms}
                    onChange={(e) => {
                      const newTotalTerms = parseInt(e.target.value) || 1;
                      const originalBalance =
                        parseFloat(formData.original_balance) || 0;
                      const remainingTerms = parseInt(formData.remaining_terms) || 0;

                      // Recalculate monthly payment when total terms changes
                      const newMonthlyPayment =
                        originalBalance > 0 && newTotalTerms > 0
                          ? originalBalance / newTotalTerms
                          : 0;

                      // Calculate terms paid with new total terms
                      const termsPaid = newTotalTerms - remainingTerms;

                      // Recalculate current balance based on new total terms
                      const newCurrentBalance = Math.max(
                        0,
                        originalBalance - (newMonthlyPayment * termsPaid)
                      );

                      setFormData({
                        ...formData,
                        total_terms: e.target.value,
                        monthly_payment:
                          newMonthlyPayment > 0
                            ? newMonthlyPayment.toFixed(2)
                            : formData.monthly_payment,
                        current_balance: newCurrentBalance.toFixed(2),
                      });
                    }}
                    placeholder="6"
                  />
                </div>
                <div>
                  <Label htmlFor="remaining_terms">Remaining Terms *</Label>
                  <Input
                    id="remaining_terms"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.remaining_terms}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Prevent negative values
                      if (value === "" || parseInt(value) >= 0) {
                        const newRemainingTerms = parseInt(value) || 0;
                        const totalTerms = parseInt(formData.total_terms) || 1;
                        const originalBalance = parseFloat(formData.original_balance) || 0;
                        const monthlyPayment = parseFloat(formData.monthly_payment) || 0;

                        // Calculate terms paid
                        const termsPaid = totalTerms - newRemainingTerms;

                        // Recalculate current balance when remaining terms changes
                        // current_balance = original_balance - (monthly_payment * terms_paid)
                        const newCurrentBalance = Math.max(
                          0,
                          originalBalance - (monthlyPayment * termsPaid)
                        );

                        setFormData({
                          ...formData,
                          remaining_terms: value,
                          current_balance: newCurrentBalance.toFixed(2),
                        });
                      }
                    }}
                    placeholder="6"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="effectivity_date">Effectivity Date *</Label>
                  <Input
                    id="effectivity_date"
                    type="date"
                    value={formData.effectivity_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        effectivity_date: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="cutoff_assignment">Cutoff Assignment *</Label>
                  <Select
                    value={formData.cutoff_assignment}
                    onValueChange={(value: any) =>
                      setFormData({
                        ...formData,
                        cutoff_assignment: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first">1st Cutoff (1-15)</SelectItem>
                      <SelectItem value="second">2nd Cutoff (16-31)</SelectItem>
                      <SelectItem value="both">Both Cutoffs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="deduct_bi_monthly"
                  checked={formData.deduct_bi_monthly}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deduct_bi_monthly: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="deduct_bi_monthly" className="font-normal cursor-pointer">
                  Deduct Bi-Monthly (Divide by 2)
                </Label>
                <Caption className="text-xs text-gray-500 ml-2">
                  If checked, monthly payment is divided by 2 per cutoff (e.g., ₱1,000/month = ₱500 per cutoff).
                  If unchecked, full monthly payment is deducted per cutoff.
                </Caption>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                }}
              >
                {editingLoan ? "Update" : "Create"} Loan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Critical Changes Confirmation Dialog */}
        <AlertDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Critical Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to make critical changes to this loan. This action
                will be logged in the audit trail.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-4">
              <div className="font-semibold text-sm">Changes to be made:</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {criticalChanges.map((change, index) => (
                  <li key={index} className="text-muted-foreground">
                    {change}
                  </li>
                ))}
              </ul>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowConfirmDialog(false);
                  setCriticalChanges([]);
                  setPendingLoanData(null);
                  setSubmitting(false);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (pendingLoanData) {
                    await performLoanUpdate(pendingLoanData);
                  }
                }}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Audit History Modal */}
        <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Audit History - {selectedLoanForAudit?.employee?.full_name}
              </DialogTitle>
            </DialogHeader>
            {loadingAudit ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading audit history...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No audit history found
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  All changes to this loan are logged below. This includes
                  creation, updates, and status changes.
                </div>
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <Card key={log.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold">
                              {log.action === "INSERT"
                                ? "Loan Created"
                                : log.action === "UPDATE"
                                ? "Loan Updated"
                                : "Loan Deleted"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(
                                new Date(log.created_at),
                                "MMM dd, yyyy 'at' hh:mm a"
                              )}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {log.user?.full_name || log.user?.email || "System"}
                          </Badge>
                        </div>
                        {log.action === "UPDATE" && log.old_values && (
                          <div className="mt-3 space-y-2 text-sm">
                            <div className="font-medium text-red-600">
                              Changes Made:
                            </div>
                            {Object.keys(log.new_values || {}).map((key) => {
                              const oldVal = log.old_values[key];
                              const newVal = log.new_values[key];
                              if (oldVal !== newVal) {
                                return (
                                  <div key={key} className="pl-4">
                                    <span className="font-medium">
                                      {key.replace(/_/g, " ").toUpperCase()}:
                                    </span>{" "}
                                    <span className="text-red-600 line-through">
                                      {typeof oldVal === "number"
                                        ? formatCurrency(oldVal)
                                        : String(oldVal || "-")}
                                    </span>{" "}
                                    →{" "}
                                    <span className="text-green-600 font-semibold">
                                      {typeof newVal === "number"
                                        ? formatCurrency(newVal)
                                        : String(newVal || "-")}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        )}
                        {log.action === "INSERT" && (
                          <div className="mt-3 text-sm text-muted-foreground">
                            Loan created with initial values
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAuditModal(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment History Modal */}
        <Dialog
          open={showPaymentHistoryModal}
          onOpenChange={setShowPaymentHistoryModal}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Payment History - {selectedLoanForHistory?.employee?.full_name}
              </DialogTitle>
            </DialogHeader>
            {selectedLoanForHistory && (
              <div className="space-y-4">
                {/* Loan Summary */}
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <BodySmall className="text-muted-foreground">
                          Loan Type
                        </BodySmall>
                        <div className="font-semibold">
                          {getLoanTypeLabel(selectedLoanForHistory.loan_type)}
                        </div>
                      </div>
                      <div>
                        <BodySmall className="text-muted-foreground">
                          Original Balance
                        </BodySmall>
                        <div className="font-semibold">
                          {formatCurrency(
                            selectedLoanForHistory.original_balance
                          )}
                        </div>
                      </div>
                      <div>
                        <BodySmall className="text-muted-foreground">
                          Current Balance
                        </BodySmall>
                        <div className="font-semibold text-green-600">
                          {formatCurrency(
                            selectedLoanForHistory.current_balance
                          )}
                        </div>
                      </div>
                      <div>
                        <BodySmall className="text-muted-foreground">
                          Monthly Payment
                        </BodySmall>
                        <div className="font-semibold">
                          {formatCurrency(
                            selectedLoanForHistory.monthly_payment
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
                      <div>
                        <BodySmall className="text-muted-foreground">
                          Terms Paid
                        </BodySmall>
                        <div className="font-semibold">
                          {selectedLoanForHistory.total_terms -
                            selectedLoanForHistory.remaining_terms}{" "}
                          / {selectedLoanForHistory.total_terms}
                        </div>
                      </div>
                      <div>
                        <BodySmall className="text-muted-foreground">
                          Effectivity Date
                        </BodySmall>
                        <div className="font-semibold">
                          {format(
                            new Date(selectedLoanForHistory.effectivity_date),
                            "MMM dd, yyyy"
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment History Table */}
                {loadingPaymentHistory ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading payment history...
                  </div>
                ) : paymentHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No payment history found. Payments will appear here once
                    payslips are generated.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <H3 className="text-lg">Payment History</H3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Period</TableHead>
                            <TableHead>Payslip #</TableHead>
                            <TableHead className="text-right">
                              Payment Amount
                            </TableHead>
                            <TableHead className="text-right">
                              Running Balance
                            </TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentHistory.map((payment, index) => (
                            <TableRow key={payment.payslip_id || index}>
                              <TableCell>
                                {format(
                                  new Date(payment.period_start),
                                  "MMM dd"
                                )}{" "}
                                -{" "}
                                {format(
                                  new Date(payment.period_end),
                                  "MMM dd, yyyy"
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {payment.payslip_number}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {formatCurrency(payment.payment_amount)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(payment.running_balance)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {format(
                                  new Date(payment.created_at),
                                  "MMM dd, yyyy"
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <BodySmall className="text-muted-foreground">
                        Total Payments: {paymentHistory.length}
                      </BodySmall>
                      <BodySmall className="text-muted-foreground">
                        Total Paid:{" "}
                        <span className="font-semibold text-green-600">
                          {formatCurrency(
                            selectedLoanForHistory.original_balance -
                              selectedLoanForHistory.current_balance
                          )}
                        </span>
                      </BodySmall>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPaymentHistoryModal(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}