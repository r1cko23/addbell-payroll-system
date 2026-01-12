/**
 * Centralized Session Management Utility
 * Provides consistent session handling, error management, and rate limit prevention
 */

import { createClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";

// Rate limit tracking
let lastAuthCall = 0;
const MIN_AUTH_CALL_INTERVAL = 1000; // Minimum 1 second between auth calls
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

// Session cache to prevent redundant calls
let cachedSession: Session | null = null;
let sessionCacheTimestamp = 0;
const SESSION_CACHE_TTL = 30000; // 30 seconds cache

/**
 * Get current session with caching and rate limit protection
 * Returns null if rate limited or session invalid
 */
export async function getSessionSafe(): Promise<Session | null> {
  const now = Date.now();

  // Check if we're rate limited
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    const timeSinceLastCall = now - lastAuthCall;
    if (timeSinceLastCall < MIN_AUTH_CALL_INTERVAL * 5) {
      console.warn("Rate limit protection: Skipping auth call");
      return cachedSession; // Return cached session if available
    }
    // Reset after cooldown period
    consecutiveFailures = 0;
  }

  // Check cache first
  if (cachedSession && now - sessionCacheTimestamp < SESSION_CACHE_TTL) {
    return cachedSession;
  }

  // Enforce minimum interval between calls
  const timeSinceLastCall = now - lastAuthCall;
  if (timeSinceLastCall < MIN_AUTH_CALL_INTERVAL) {
    return cachedSession; // Return cached if too soon
  }

  lastAuthCall = now;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      // Check for rate limit errors
      if (
        error.message?.includes("rate limit") ||
        error.message?.includes("429") ||
        error.status === 429
      ) {
        consecutiveFailures++;
        console.warn("Rate limit detected, using cached session");
        return cachedSession;
      }
      throw error;
    }

    // Success - reset failure counter and update cache
    consecutiveFailures = 0;
    cachedSession = data.session;
    sessionCacheTimestamp = now;
    return data.session;
  } catch (error: any) {
    consecutiveFailures++;
    console.error("Session check error:", error?.message || error);
    return cachedSession; // Return cached session on error
  }
}

/**
 * Get current user with caching and rate limit protection
 */
export async function getUserSafe() {
  const now = Date.now();

  // Check if we're rate limited
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    const timeSinceLastCall = now - lastAuthCall;
    if (timeSinceLastCall < MIN_AUTH_CALL_INTERVAL * 5) {
      console.warn("Rate limit protection: Skipping getUser call");
      return null;
    }
    consecutiveFailures = 0;
  }

  // Enforce minimum interval between calls
  const timeSinceLastCall = now - lastAuthCall;
  if (timeSinceLastCall < MIN_AUTH_CALL_INTERVAL) {
    return null; // Too soon, skip
  }

  lastAuthCall = now;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      if (
        error.message?.includes("rate limit") ||
        error.message?.includes("429") ||
        error.status === 429
      ) {
        consecutiveFailures++;
        return null;
      }
      throw error;
    }

    consecutiveFailures = 0;
    return data.user;
  } catch (error: any) {
    consecutiveFailures++;
    console.error("getUser error:", error?.message || error);
    return null;
  }
}

/**
 * Refresh session safely with rate limit protection
 */
export async function refreshSessionSafe(): Promise<Session | null> {
  const now = Date.now();

  // Don't refresh if we're rate limited
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    const timeSinceLastCall = now - lastAuthCall;
    if (timeSinceLastCall < MIN_AUTH_CALL_INTERVAL * 10) {
      console.warn("Rate limit protection: Skipping refresh");
      return cachedSession;
    }
    consecutiveFailures = 0;
  }

  // Enforce minimum interval
  const timeSinceLastCall = now - lastAuthCall;
  if (timeSinceLastCall < MIN_AUTH_CALL_INTERVAL * 2) {
    return cachedSession; // Too soon to refresh
  }

  lastAuthCall = now;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      // Handle rate limit errors
      if (
        error.message?.includes("rate limit") ||
        error.message?.includes("429") ||
        error.status === 429
      ) {
        consecutiveFailures++;
        return cachedSession;
      }

      // Handle refresh token not found/expired errors
      // This happens when refresh token has expired (30 days) or was revoked
      if (
        error.code === "refresh_token_not_found" ||
        error.message?.includes("refresh_token_not_found") ||
        error.message?.includes("Refresh Token Not Found") ||
        error.message?.includes("Invalid Refresh Token")
      ) {
        console.warn("Refresh token expired or not found - clearing session cache");
        // Clear cached session since refresh token is invalid
        cachedSession = null;
        sessionCacheTimestamp = 0;
        // Don't increment failure counter for expired tokens - this is expected
        return null;
      }

      // For other errors, log and return cached session if available
      console.error("Refresh session error:", error?.message || error, {
        code: error.code,
        status: error.status,
      });
      return cachedSession;
    }

    consecutiveFailures = 0;
    cachedSession = data.session;
    sessionCacheTimestamp = now;
    return data.session;
  } catch (error: any) {
    // Handle refresh token errors in catch block as well
    if (
      error?.code === "refresh_token_not_found" ||
      error?.message?.includes("refresh_token_not_found") ||
      error?.message?.includes("Refresh Token Not Found")
    ) {
      console.warn("Refresh token expired or not found - clearing session cache");
      cachedSession = null;
      sessionCacheTimestamp = 0;
      return null;
    }

    consecutiveFailures++;
    console.error("Refresh session error:", error?.message || error);
    return cachedSession;
  }
}

/**
 * Clear session cache (useful on logout)
 */
export function clearSessionCache() {
  cachedSession = null;
  sessionCacheTimestamp = 0;
  consecutiveFailures = 0;
  lastAuthCall = 0;
}

/**
 * Check if session is valid (not expired)
 */
export function isSessionValid(session: Session | null): boolean {
  if (!session) return false;

  const expiresAt = session.expires_at;
  if (!expiresAt) return true; // No expiration set

  const now = Math.floor(Date.now() / 1000);
  return expiresAt > now;
}

/**
 * Get time until session expires (in seconds)
 */
export function getSessionTimeRemaining(session: Session | null): number {
  if (!session || !session.expires_at) return Infinity;

  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, session.expires_at - now);
}