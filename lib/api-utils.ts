/**
 * API Utilities for consistent response handling and caching
 *
 * Best practices implemented:
 * - Consistent error response format
 * - Cache-Control headers for appropriate routes
 * - Request timing for performance monitoring
 * - Type-safe response helpers
 */

import { NextResponse } from "next/server";

/**
 * Standard API error response
 */
export interface ApiError {
  error: string;
  code?: string;
  details?: string;
}

/**
 * Create a success response with optional caching
 */
export function successResponse<T>(
  data: T,
  options?: {
    /** Cache duration in seconds (default: no cache) */
    cache?: number;
    /** Whether to allow stale content while revalidating */
    staleWhileRevalidate?: number;
    /** Status code (default: 200) */
    status?: number;
  }
) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Add cache headers if specified
  if (options?.cache) {
    const cacheControl = [
      `max-age=${options.cache}`,
      options.staleWhileRevalidate
        ? `stale-while-revalidate=${options.staleWhileRevalidate}`
        : null,
    ]
      .filter(Boolean)
      .join(", ");

    headers["Cache-Control"] = cacheControl;
  } else {
    // Default: no caching for dynamic data
    headers["Cache-Control"] = "no-store, must-revalidate";
  }

  return NextResponse.json(data, {
    status: options?.status ?? 200,
    headers,
  });
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  options?: {
    status?: number;
    code?: string;
    details?: string;
  }
) {
  const error: ApiError = {
    error: message,
  };

  if (options?.code) error.code = options.code;
  if (options?.details) error.details = options.details;

  return NextResponse.json(error, {
    status: options?.status ?? 500,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorizedResponse(message = "Unauthorized") {
  return errorResponse(message, { status: 401, code: "UNAUTHORIZED" });
}

/**
 * Create a 403 Forbidden response
 */
export function forbiddenResponse(message = "Forbidden") {
  return errorResponse(message, { status: 403, code: "FORBIDDEN" });
}

/**
 * Create a 404 Not Found response
 */
export function notFoundResponse(message = "Not found") {
  return errorResponse(message, { status: 404, code: "NOT_FOUND" });
}

/**
 * Create a 400 Bad Request response
 */
export function badRequestResponse(message: string, details?: string) {
  return errorResponse(message, { status: 400, code: "BAD_REQUEST", details });
}

/**
 * Measure and log API response time
 */
export function withTiming<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  routeName: string
): T {
  return (async (...args: Parameters<T>) => {
    const start = performance.now();
    try {
      const result = await fn(...args);
      const duration = performance.now() - start;
      if (duration > 1000) {
        console.warn(`[SLOW API] ${routeName} took ${duration.toFixed(2)}ms`);
      }
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(
        `[API ERROR] ${routeName} failed after ${duration.toFixed(2)}ms`,
        error
      );
      throw error;
    }
  }) as T;
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields<T extends object>(
  body: T,
  requiredFields: (keyof T)[]
): { valid: true } | { valid: false; missingFields: string[] } {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (
      body[field] === undefined ||
      body[field] === null ||
      body[field] === ""
    ) {
      missingFields.push(String(field));
    }
  }

  if (missingFields.length > 0) {
    return { valid: false, missingFields };
  }

  return { valid: true };
}

