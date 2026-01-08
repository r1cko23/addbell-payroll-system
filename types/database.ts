export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: "admin" | "hr" | "approver" | "viewer";
          is_active: boolean;
          can_access_salary: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          role: "admin" | "hr" | "approver" | "viewer";
          is_active?: boolean;
          can_access_salary?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: "admin" | "hr" | "approver" | "viewer";
          is_active?: boolean;
          can_access_salary?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      employees: {
        Row: {
          id: string;
          employee_id: string;
          full_name: string;
          first_name: string | null;
          last_name: string | null;
          middle_initial: string | null;
          assigned_hotel: string | null;
          employee_type: "office-based" | "client-based" | null;
          address: string | null;
          birth_date: string | null;
          gender: "male" | "female" | null;
          hire_date: string | null;
          tin_number: string | null;
          sss_number: string | null;
          philhealth_number: string | null;
          pagibig_number: string | null;
          hmo_provider: string | null;
          sil_credits: number | null;
          maternity_credits: number | null;
          paternity_credits: number | null;
          is_active: boolean;
          portal_password: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          job_level: string | null;
          monthly_rate: number | null;
          per_day: number | null;
          overtime_group_id: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          full_name: string;
          first_name?: string | null;
          last_name?: string | null;
          middle_initial?: string | null;
          assigned_hotel?: string | null;
          employee_type?: "office-based" | "client-based" | null;
          address?: string | null;
          birth_date?: string | null;
          gender?: "male" | "female" | null;
          hire_date?: string | null;
          tin_number?: string | null;
          sss_number?: string | null;
          philhealth_number?: string | null;
          pagibig_number?: string | null;
          hmo_provider?: string | null;
          sil_credits?: number | null;
          maternity_credits?: number | null;
          paternity_credits?: number | null;
          is_active?: boolean;
          portal_password?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string;
          full_name?: string;
          first_name?: string | null;
          last_name?: string | null;
          middle_initial?: string | null;
          assigned_hotel?: string | null;
          employee_type?: "office-based" | "client-based" | null;
          address?: string | null;
          birth_date?: string | null;
          gender?: "male" | "female" | null;
          hire_date?: string | null;
          tin_number?: string | null;
          sss_number?: string | null;
          philhealth_number?: string | null;
          pagibig_number?: string | null;
          hmo_provider?: string | null;
          sil_credits?: number | null;
          maternity_credits?: number | null;
          paternity_credits?: number | null;
          is_active?: boolean;
          portal_password?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          job_level?: string | null;
          monthly_rate?: number | null;
          per_day?: number | null;
          overtime_group_id?: string | null;
        };
      };
      overtime_groups: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          approver_id: string | null;
          viewer_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          approver_id?: string | null;
          viewer_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          approver_id?: string | null;
          viewer_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      employee_location_assignments: {
        Row: {
          id: string;
          employee_id: string;
          location_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          location_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          location_id?: string;
          created_at?: string;
        };
      };
      weekly_attendance: {
        Row: {
          id: string;
          employee_id: string;
          week_start_date: string;
          week_end_date: string;
          attendance_data: Json;
          total_regular_hours: number;
          total_overtime_hours: number;
          total_night_diff_hours: number;
          gross_pay: number;
          status: "draft" | "finalized";
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          week_start_date: string;
          week_end_date: string;
          attendance_data: Json;
          total_regular_hours?: number;
          total_overtime_hours?: number;
          total_night_diff_hours?: number;
          gross_pay?: number;
          status?: "draft" | "finalized";
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string;
          week_start_date?: string;
          week_end_date?: string;
          attendance_data?: Json;
          total_regular_hours?: number;
          total_overtime_hours?: number;
          total_night_diff_hours?: number;
          gross_pay?: number;
          status?: "draft" | "finalized";
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      employee_deductions: {
        Row: {
          id: string;
          employee_id: string;
          vale_amount: number;
          sss_salary_loan: number;
          sss_calamity_loan: number;
          pagibig_salary_loan: number;
          pagibig_calamity_loan: number;
          sss_contribution: number;
          philhealth_contribution: number;
          pagibig_contribution: number;
          withholding_tax: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          vale_amount?: number;
          sss_salary_loan?: number;
          sss_calamity_loan?: number;
          pagibig_salary_loan?: number;
          pagibig_calamity_loan?: number;
          sss_contribution?: number;
          philhealth_contribution?: number;
          pagibig_contribution?: number;
          withholding_tax?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          vale_amount?: number;
          sss_salary_loan?: number;
          sss_calamity_loan?: number;
          pagibig_salary_loan?: number;
          pagibig_calamity_loan?: number;
          sss_contribution?: number;
          philhealth_contribution?: number;
          pagibig_contribution?: number;
          withholding_tax?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      payslips: {
        Row: {
          id: string;
          employee_id: string;
          payslip_number: string;
          week_number: number;
          period_start: string;
          period_end: string;
          period_type: "weekly" | "bimonthly";
          earnings_breakdown: Json;
          gross_pay: number;
          deductions_breakdown: Json;
          total_deductions: number;
          apply_sss: boolean;
          apply_philhealth: boolean;
          apply_pagibig: boolean;
          sss_amount: number;
          philhealth_amount: number;
          pagibig_amount: number;
          adjustment_amount: number;
          adjustment_reason: string | null;
          allowance_amount: number;
          net_pay: number;
          status: "draft" | "paid";
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          payslip_number: string;
          week_number: number;
          period_start: string;
          period_end: string;
          period_type?: "weekly" | "bimonthly";
          earnings_breakdown: Json;
          gross_pay: number;
          deductions_breakdown: Json;
          total_deductions?: number;
          apply_sss?: boolean;
          apply_philhealth?: boolean;
          apply_pagibig?: boolean;
          sss_amount?: number;
          philhealth_amount?: number;
          pagibig_amount?: number;
          adjustment_amount?: number;
          adjustment_reason?: string | null;
          allowance_amount?: number;
          net_pay: number;
          status?: "draft" | "paid";
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string;
          payslip_number?: string;
          week_number?: number;
          period_start?: string;
          period_end?: string;
          period_type?: "weekly" | "bimonthly";
          earnings_breakdown?: Json;
          gross_pay?: number;
          deductions_breakdown?: Json;
          total_deductions?: number;
          apply_sss?: boolean;
          apply_philhealth?: boolean;
          apply_pagibig?: boolean;
          sss_amount?: number;
          philhealth_amount?: number;
          pagibig_amount?: number;
          adjustment_amount?: number;
          adjustment_reason?: string | null;
          allowance_amount?: number;
          net_pay?: number;
          status?: "draft" | "paid";
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      holidays: {
        Row: {
          id: string;
          holiday_date: string;
          holiday_name: string;
          holiday_type: "regular" | "non-working";
          year: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          holiday_date: string;
          holiday_name: string;
          holiday_type: "regular" | "non-working";
          year: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          holiday_date?: string;
          holiday_name?: string;
          holiday_type?: "regular" | "non-working";
          year?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          table_name: string;
          record_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          table_name?: string;
          record_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
      };
      time_clock_entries: {
        Row: {
          id: string;
          employee_id: string;
          clock_in_time: string;
          clock_in_location: string | null;
          clock_in_ip: string | null;
          clock_in_device: string | null;
          clock_in_photo: string | null;
          clock_out_time: string | null;
          clock_out_location: string | null;
          clock_out_ip: string | null;
          clock_out_device: string | null;
          clock_out_photo: string | null;
          total_hours: number | null;
          regular_hours: number | null;
          overtime_hours: number | null;
          total_night_diff_hours: number | null;
          status:
            | "clocked_in"
            | "clocked_out"
            | "approved"
            | "rejected"
            | "auto_approved"
            | "pending";
          employee_notes: string | null;
          hr_notes: string | null;
          is_manual_entry: boolean;
          break_start_time: string | null;
          break_end_time: string | null;
          total_break_minutes: number;
          created_at: string;
          updated_at: string;
          approved_by: string | null;
          approved_at: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          clock_in_time: string;
          clock_in_location?: string | null;
          clock_in_ip?: string | null;
          clock_in_device?: string | null;
          clock_in_photo?: string | null;
          clock_out_time?: string | null;
          clock_out_location?: string | null;
          clock_out_ip?: string | null;
          clock_out_device?: string | null;
          clock_out_photo?: string | null;
          total_hours?: number | null;
          regular_hours?: number | null;
          overtime_hours?: number | null;
          total_night_diff_hours?: number | null;
          status?:
            | "clocked_in"
            | "clocked_out"
            | "approved"
            | "rejected"
            | "auto_approved"
            | "pending";
          employee_notes?: string | null;
          hr_notes?: string | null;
          is_manual_entry?: boolean;
          break_start_time?: string | null;
          break_end_time?: string | null;
          total_break_minutes?: number;
          created_at?: string;
          updated_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string;
          clock_in_time?: string;
          clock_in_location?: string | null;
          clock_in_ip?: string | null;
          clock_in_device?: string | null;
          clock_in_photo?: string | null;
          clock_out_time?: string | null;
          clock_out_location?: string | null;
          clock_out_ip?: string | null;
          clock_out_device?: string | null;
          clock_out_photo?: string | null;
          total_hours?: number | null;
          regular_hours?: number | null;
          overtime_hours?: number | null;
          total_night_diff_hours?: number | null;
          status?:
            | "clocked_in"
            | "clocked_out"
            | "approved"
            | "rejected"
            | "auto_approved"
            | "pending";
          employee_notes?: string | null;
          hr_notes?: string | null;
          is_manual_entry?: boolean;
          break_start_time?: string | null;
          break_end_time?: string | null;
          total_break_minutes?: number;
          created_at?: string;
          updated_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
        };
      };
      employee_schedules: {
        Row: {
          id: string;
          employee_id: string;
          day_of_week: number;
          shift_start_time: string;
          shift_end_time: string;
          break_duration_minutes: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          day_of_week: number;
          shift_start_time: string;
          shift_end_time: string;
          break_duration_minutes?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          day_of_week?: number;
          shift_start_time?: string;
          shift_end_time?: string;
          break_duration_minutes?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      overtime_requests: {
        Row: {
          id: string;
          employee_id: string;
          account_manager_id: string | null;
          ot_date: string;
          end_date: string | null;
          start_time: string;
          end_time: string;
          total_hours: number;
          reason: string | null;
          attachment_url: string | null;
          status: "pending" | "approved" | "rejected";
          created_at: string;
          updated_at: string;
          approved_at: string | null;
          approved_by: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          account_manager_id?: string | null;
          ot_date: string;
          end_date?: string | null;
          start_time: string;
          end_time: string;
          total_hours: number;
          reason?: string | null;
          attachment_url?: string | null;
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
          updated_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string;
          account_manager_id?: string | null;
          ot_date?: string;
          end_date?: string | null;
          start_time?: string;
          end_time?: string;
          total_hours?: number;
          reason?: string | null;
          attachment_url?: string | null;
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
          updated_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
        };
      };
      overtime_documents: {
        Row: {
          id: string;
          overtime_request_id: string;
          employee_id: string;
          file_name: string;
          file_type: string | null;
          file_size: number | null;
          file_base64: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          overtime_request_id: string;
          employee_id: string;
          file_name: string;
          file_type?: string | null;
          file_size?: number | null;
          file_base64: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          overtime_request_id?: string;
          employee_id?: string;
          file_name?: string;
          file_type?: string | null;
          file_size?: number | null;
          file_base64?: string;
          created_at?: string;
        };
      };
      office_locations: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          latitude: number;
          longitude: number;
          radius_meters: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          latitude: number;
          longitude: number;
          radius_meters?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          latitude?: number;
          longitude?: number;
          radius_meters?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      employee_week_schedules: {
        Row: {
          id: string;
          employee_id: string;
          week_start: string;
          schedule_date: string;
          start_time: string | null;
          end_time: string | null;
          tasks: string | null;
          day_off: boolean;
          location_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          week_start: string;
          schedule_date: string;
          start_time?: string | null;
          end_time?: string | null;
          tasks?: string | null;
          day_off?: boolean;
          location_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          week_start?: string;
          schedule_date?: string;
          start_time?: string | null;
          end_time?: string | null;
          tasks?: string | null;
          day_off?: boolean;
          location_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_location_allowed: {
        Args: {
          p_latitude: number;
          p_longitude: number;
        };
        Returns: {
          is_allowed: boolean;
          nearest_location_id: string | null;
          nearest_location_name: string | null;
          distance_meters: number | null;
          error_message: string | null;
        }[];
      };
      calculate_distance: {
        Args: {
          lat1: number;
          lon1: number;
          lat2: number;
          lon2: number;
        };
        Returns: number;
      };
      create_overtime_request: {
        Args: {
          p_employee_id: string;
          p_ot_date: string;
          p_start_time: string;
          p_end_time: string;
          p_total_hours: number;
          p_reason?: string | null;
          p_end_date?: string | null;
        };
        Returns: {
          id: string;
          employee_id: string;
          account_manager_id: string | null;
          ot_date: string;
          end_date: string | null;
          start_time: string;
          end_time: string;
          total_hours: number;
          reason: string | null;
          attachment_url: string | null;
          status: "pending" | "approved" | "rejected";
          created_at: string;
          updated_at: string;
          approved_at: string | null;
          approved_by: string | null;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}