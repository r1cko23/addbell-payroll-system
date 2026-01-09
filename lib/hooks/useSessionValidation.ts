/**
 * Hook for validating sessions on app startup
 * Prevents stale sessions and handles expiration gracefully
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSessionSafe, isSessionValid, clearSessionCache } from "@/lib/session-utils";

interface UseSessionValidationOptions {
  redirectOnInvalid?: boolean;
  redirectPath?: string;
}

/**
 * Validates session on mount and handles expiration
 */
export function useSessionValidation(options: UseSessionValidationOptions = {}) {
  const { redirectOnInvalid = true, redirectPath = "/login" } = options;
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    async function validateSession() {
      try {
        // Check Supabase session
        const session = await getSessionSafe();
        
        if (!session || !isSessionValid(session)) {
          if (isMounted) {
            setIsValid(false);
            clearSessionCache();
            
            if (redirectOnInvalid) {
              // Sign out to clear any stale cookies
              await supabase.auth.signOut();
              router.push(redirectPath);
            }
          }
          return;
        }

        if (isMounted) {
          setIsValid(true);
        }
      } catch (error) {
        console.error("Session validation error:", error);
        if (isMounted) {
          setIsValid(false);
          if (redirectOnInvalid) {
            router.push(redirectPath);
          }
        }
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    }

    validateSession();

    return () => {
      isMounted = false;
    };
  }, [router, redirectOnInvalid, redirectPath, supabase]);

  return { isValidating, isValid };
}

/**
 * Validates employee session from localStorage
 */
export function useEmployeeSessionValidation() {
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("employee_session");
    
    if (!stored) {
      setIsValid(false);
      setIsValidating(false);
      router.replace("/login?mode=employee");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        id: string;
        employee_id: string;
        full_name: string;
        loginTime: string;
        expiresAt?: number;
      };

      // Check expiration if exists
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        localStorage.removeItem("employee_session");
        setIsValid(false);
        setIsValidating(false);
        router.replace("/login?mode=employee&reason=expired");
        return;
      }

      setIsValid(true);
    } catch (error) {
      console.error("Employee session validation error:", error);
      localStorage.removeItem("employee_session");
      setIsValid(false);
      router.replace("/login?mode=employee");
    } finally {
      setIsValidating(false);
    }
  }, [router]);

  return { isValidating, isValid };
}
