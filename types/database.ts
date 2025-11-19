export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'hr'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          role: 'admin' | 'hr'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin' | 'hr'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      employees: {
        Row: {
          id: string
          employee_id: string
          full_name: string
          rate_per_day: number
          rate_per_hour: number
          is_active: boolean
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          full_name: string
          rate_per_day: number
          rate_per_hour: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          full_name?: string
          rate_per_day?: number
          rate_per_hour?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      weekly_attendance: {
        Row: {
          id: string
          employee_id: string
          week_start_date: string
          week_end_date: string
          attendance_data: Json
          total_regular_hours: number
          total_overtime_hours: number
          total_night_diff_hours: number
          gross_pay: number
          status: 'draft' | 'finalized'
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          week_start_date: string
          week_end_date: string
          attendance_data: Json
          total_regular_hours?: number
          total_overtime_hours?: number
          total_night_diff_hours?: number
          gross_pay?: number
          status?: 'draft' | 'finalized'
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          week_start_date?: string
          week_end_date?: string
          attendance_data?: Json
          total_regular_hours?: number
          total_overtime_hours?: number
          total_night_diff_hours?: number
          gross_pay?: number
          status?: 'draft' | 'finalized'
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      employee_deductions: {
        Row: {
          id: string
          employee_id: string
          vale_amount: number
          uniform_ppe_amount: number
          sss_salary_loan: number
          sss_calamity_loan: number
          pagibig_salary_loan: number
          pagibig_calamity_loan: number
          sss_contribution: number
          philhealth_contribution: number
          pagibig_contribution: number
          withholding_tax: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          vale_amount?: number
          uniform_ppe_amount?: number
          sss_salary_loan?: number
          sss_calamity_loan?: number
          pagibig_salary_loan?: number
          pagibig_calamity_loan?: number
          sss_contribution?: number
          philhealth_contribution?: number
          pagibig_contribution?: number
          withholding_tax?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          vale_amount?: number
          uniform_ppe_amount?: number
          sss_salary_loan?: number
          sss_calamity_loan?: number
          pagibig_salary_loan?: number
          pagibig_calamity_loan?: number
          sss_contribution?: number
          philhealth_contribution?: number
          pagibig_contribution?: number
          withholding_tax?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      payslips: {
        Row: {
          id: string
          employee_id: string
          payslip_number: string
          week_number: number
          week_start_date: string
          week_end_date: string
          earnings_breakdown: Json
          gross_pay: number
          deductions_breakdown: Json
          total_deductions: number
          apply_sss: boolean
          apply_philhealth: boolean
          apply_pagibig: boolean
          sss_amount: number
          philhealth_amount: number
          pagibig_amount: number
          adjustment_amount: number
          adjustment_reason: string | null
          allowance_amount: number
          net_pay: number
          status: 'draft' | 'approved' | 'paid'
          created_at: string
          updated_at: string
          created_by: string | null
          approved_by: string | null
          approved_at: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          payslip_number: string
          week_number: number
          week_start_date: string
          week_end_date: string
          earnings_breakdown: Json
          gross_pay: number
          deductions_breakdown: Json
          total_deductions?: number
          apply_sss?: boolean
          apply_philhealth?: boolean
          apply_pagibig?: boolean
          sss_amount?: number
          philhealth_amount?: number
          pagibig_amount?: number
          adjustment_amount?: number
          adjustment_reason?: string | null
          allowance_amount?: number
          net_pay: number
          status?: 'draft' | 'approved' | 'paid'
          created_at?: string
          updated_at?: string
          created_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          payslip_number?: string
          week_number?: number
          week_start_date?: string
          week_end_date?: string
          earnings_breakdown?: Json
          gross_pay?: number
          deductions_breakdown?: Json
          total_deductions?: number
          apply_sss?: boolean
          apply_philhealth?: boolean
          apply_pagibig?: boolean
          sss_amount?: number
          philhealth_amount?: number
          pagibig_amount?: number
          adjustment_amount?: number
          adjustment_reason?: string | null
          allowance_amount?: number
          net_pay?: number
          status?: 'draft' | 'approved' | 'paid'
          created_at?: string
          updated_at?: string
          created_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
        }
      }
      holidays: {
        Row: {
          id: string
          holiday_date: string
          holiday_name: string
          holiday_type: 'regular' | 'non-working'
          year: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          holiday_date: string
          holiday_name: string
          holiday_type: 'regular' | 'non-working'
          year: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          holiday_date?: string
          holiday_name?: string
          holiday_type?: 'regular' | 'non-working'
          year?: number
          is_active?: boolean
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          table_name: string
          record_id: string | null
          old_data: Json | null
          new_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          table_name: string
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          table_name?: string
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

