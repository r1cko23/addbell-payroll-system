/**
 * Device Information Utility
 * Parses user agent and detects device, browser, and OS information
 */

export interface DeviceInfo {
  userAgent: string;
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceType: "mobile" | "tablet" | "desktop";
  deviceInfo: string;
}

/**
 * Parse user agent string to extract device information
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();
  let browserName = "Unknown";
  let browserVersion = "Unknown";
  let osName = "Unknown";
  let osVersion = "Unknown";
  let deviceType: "mobile" | "tablet" | "desktop" = "desktop";

  // Detect Browser
  if (ua.includes("edg/")) {
    browserName = "Edge";
    browserVersion = ua.match(/edg\/([\d.]+)/)?.[1] || "Unknown";
  } else if (ua.includes("chrome/") && !ua.includes("edg/")) {
    browserName = "Chrome";
    browserVersion = ua.match(/chrome\/([\d.]+)/)?.[1] || "Unknown";
  } else if (ua.includes("safari/") && !ua.includes("chrome/")) {
    browserName = "Safari";
    browserVersion = ua.match(/safari\/([\d.]+)/)?.[1] || "Unknown";
  } else if (ua.includes("firefox/")) {
    browserName = "Firefox";
    browserVersion = ua.match(/firefox\/([\d.]+)/)?.[1] || "Unknown";
  } else if (ua.includes("opera/") || ua.includes("opr/")) {
    browserName = "Opera";
    browserVersion = ua.match(/(?:opera|opr)\/([\d.]+)/)?.[1] || "Unknown";
  }

  // Detect OS
  if (ua.includes("windows")) {
    osName = "Windows";
    if (ua.includes("windows nt 10.0")) osVersion = "10/11";
    else if (ua.includes("windows nt 6.3")) osVersion = "8.1";
    else if (ua.includes("windows nt 6.2")) osVersion = "8";
    else if (ua.includes("windows nt 6.1")) osVersion = "7";
  } else if (ua.includes("mac os x") || ua.includes("macintosh")) {
    osName = "macOS";
    const match = ua.match(/mac os x ([\d_]+)/);
    if (match) {
      osVersion = match[1].replace(/_/g, ".");
    }
  } else if (ua.includes("android")) {
    osName = "Android";
    const match = ua.match(/android ([\d.]+)/);
    if (match) {
      osVersion = match[1];
    }
    deviceType = ua.includes("tablet") ? "tablet" : "mobile";
  } else if (
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    ua.includes("ipod")
  ) {
    osName = "iOS";
    const match = ua.match(/os ([\d_]+)/);
    if (match) {
      osVersion = match[1].replace(/_/g, ".");
    }
    if (ua.includes("ipad")) {
      deviceType = "tablet";
    } else {
      deviceType = "mobile";
    }
  } else if (ua.includes("linux")) {
    osName = "Linux";
  }

  // Detect device type if not already set
  if (deviceType === "desktop") {
    if (
      ua.includes("mobile") ||
      ua.includes("android") ||
      ua.includes("iphone")
    ) {
      deviceType = "mobile";
    } else if (ua.includes("tablet") || ua.includes("ipad")) {
      deviceType = "tablet";
    }
  }

  // Create device info summary
  const deviceInfo = `${
    deviceType.charAt(0).toUpperCase() + deviceType.slice(1)
  } - ${osName} ${osVersion} - ${browserName} ${browserVersion}`;

  return {
    userAgent,
    browserName,
    browserVersion,
    osName,
    osVersion,
    deviceType,
    deviceInfo,
  };
}

/**
 * Get device information from current browser
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      userAgent: "Server",
      browserName: "Unknown",
      browserVersion: "Unknown",
      osName: "Unknown",
      osVersion: "Unknown",
      deviceType: "desktop",
      deviceInfo: "Server",
    };
  }

  return parseUserAgent(navigator.userAgent);
}

/**
 * Attempt to get MAC address (NOT AVAILABLE IN WEB BROWSERS)
 *
 * ⚠️ IMPORTANT: MAC addresses CANNOT be accessed via standard web browser APIs
 * This is a fundamental browser security/privacy restriction that cannot be bypassed.
 *
 * Why MAC addresses aren't available:
 * - Browsers intentionally block MAC address access for privacy
 * - No JavaScript API exists to retrieve MAC addresses
 * - This is by design and applies to all modern browsers (Chrome, Firefox, Safari, Edge)
 *
 * Alternatives if MAC tracking is required:
 * 1. Browser Extension (Chrome/Firefox) - Can request additional permissions
 * 2. Native Mobile App - Can access device identifiers
 * 3. Server-side Device Fingerprinting - Combine IP, user agent, screen resolution, etc.
 * 4. Network-level Tracking - Capture MAC at router/gateway level
 *
 * Current implementation:
 * - Returns null (MAC addresses will always be NULL in the database)
 * - IP address and device fingerprinting are used instead for device identification
 *
 * @returns Always returns null - MAC addresses cannot be captured via web browsers
 */
export async function getMacAddress(): Promise<string | null> {
  // MAC addresses are fundamentally not accessible via web browser APIs
  // This is a browser security/privacy feature that cannot be bypassed
  // The function exists for API compatibility but will always return null
  return null;
}

