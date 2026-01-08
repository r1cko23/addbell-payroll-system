import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface UseEmployeeDataOptions {
  employeeId: string | null;
  enabled?: boolean;
}

/**
 * Shared hook for fetching employee leave credits with caching
 * Prevents duplicate API calls across multiple components
 */
export function useEmployeeLeaveCredits({
  employeeId,
  enabled = true,
}: UseEmployeeDataOptions) {
  const supabase = createClient();
  const [silCredits, setSilCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<{
    [key: string]: { data: number; timestamp: number };
  }>({});
  const CACHE_DURATION = 60000; // 1 minute cache

  const fetchCredits = useCallback(async () => {
    if (!employeeId || !enabled) {
      setLoading(false);
      return;
    }

    // Check cache first
    const cached = cacheRef.current[employeeId];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSilCredits(cached.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase.rpc(
        "get_employee_leave_credits",
        {
          p_employee_uuid: employeeId,
        } as any
      );

      if (fetchError) {
        throw fetchError;
      }

      const creditsData = data as Array<{
        sil_credits: number | null;
      }> | null;

      const credits =
        creditsData && creditsData.length > 0
          ? Number(creditsData[0].sil_credits ?? 0)
          : 0;

      // Update cache
      cacheRef.current[employeeId] = {
        data: credits,
        timestamp: Date.now(),
      };

      setSilCredits(credits);
      setError(null);
    } catch (err) {
      console.error("Error fetching SIL credits:", err);
      setError(err as Error);
      setSilCredits(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, enabled, supabase]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  return { silCredits, loading, error, refetch: fetchCredits };
}

/**
 * Shared hook for fetching holidays with caching
 */
export function useHolidays(startDate: string, endDate: string) {
  const supabase = createClient();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<{
    [key: string]: { data: any[]; timestamp: number };
  }>({});
  const CACHE_DURATION = 300000; // 5 minutes cache for holidays

  useEffect(() => {
    const cacheKey = `${startDate}-${endDate}`;
    const cached = cacheRef.current[cacheKey];

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setHolidays(cached.data);
      setLoading(false);
      return;
    }

    const fetchHolidays = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("holidays")
          .select("holiday_date, name, is_regular")
          .gte("holiday_date", startDate)
          .lte("holiday_date", endDate)
          .eq("is_active", true); // Only fetch active holidays

        if (error) throw error;

        // Normalize holidays to ensure consistent date format
        const { normalizeHolidays } = await import("@/utils/holidays");
        const formattedHolidays = normalizeHolidays(
          (data || []).map((h: any) => ({
            date: h.holiday_date,
            name: h.name,
            type: h.is_regular ? "regular" : "non-working",
          }))
        );

        cacheRef.current[cacheKey] = {
          data: formattedHolidays,
          timestamp: Date.now(),
        };

        setHolidays(formattedHolidays);
      } catch (err) {
        console.error("Error fetching holidays:", err);
        setHolidays([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHolidays();
  }, [startDate, endDate, supabase]);

  return { holidays, loading };
}