/**
 * Pure parsing functions for MobileIron / Ivanti Neurons MDM pages.
 *
 * All functions accept a plain text string (document.body.innerText)
 * and return extracted values.  No DOM access — safe for unit testing.
 */

import type { CaseDetails, DeviceDetails } from "../../shared/schemas";

/**
 * Find a label that occupies an entire line, then return the next
 * non-empty, non-"N/A" line as its value.
 */
export function findValueAfterLabel(pageText: string, ...labels: string[]): string | null {
  const lines = pageText.split("\n").map((l) => l.trim());
  for (const label of labels) {
    const labelLower = label.toLowerCase();
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].toLowerCase() === labelLower) {
        const val = lines[i + 1];
        if (val && val.toLowerCase() !== "n/a" && val !== "") {
          return val;
        }
      }
    }
  }
  return null;
}

/**
 * Locate the pipe-delimited summary bar line.
 * e.g. "iPhone 16 | Phone #: N/A | Space: Default Space | Status: Active | ..."
 * Also matches "Status: Retire Pending", "Status: Inactive", etc.
 */
export function findSummaryLine(pageText: string): string | null {
  const lines = pageText.split("\n");
  for (const line of lines) {
    if (/Status:\s*\S+/i.test(line) && line.includes("|") && /Phone\s*#/i.test(line)) {
      return line;
    }
  }
  return null;
}

export function extractSerialNumber(pageText: string): string | null {
  return findValueAfterLabel(pageText, "Serial Number");
}

export function extractDeviceModel(pageText: string): string | null {
  const summary = findSummaryLine(pageText);
  if (summary) {
    const m = summary.match(/\b(iPhone\s+[^|]+?)(?:\s*\|)/i)
      ?? summary.match(/\b(iPad\s+[^|]+?)(?:\s*\|)/i);
    if (m?.[1]) return m[1].trim();
  }
  return findValueAfterLabel(pageText, "Model Number", "Model Name", "Device Model");
}

export function extractMdn(pageText: string): string | null {
  const summary = findSummaryLine(pageText);
  if (summary) {
    const m = summary.match(/Phone\s*#\s*:\s*([+()\-\d\s]{7,})/i);
    if (m?.[1]) return m[1].replace(/\s+/g, "").trim();
  }
  return findValueAfterLabel(pageText, "Phone Number", "MDN", "Mobile Number");
}

export function extractIosVersion(pageText: string): string | null {
  const fromLabel = findValueAfterLabel(
    pageText,
    "OS/Version",
    "OS Version",
    "iOS Version",
    "Operating System Version",
    "Software Version",
  );
  if (fromLabel) return fromLabel;

  const m = pageText.match(/(?:iOS|OS)\s*(?:\/Version)?\s*:?\s*(\d+(?:\.\d+)+)/i);
  return m?.[1] ?? null;
}

export function extractOwnershipType(pageText: string): string | null {
  const ownership = findValueAfterLabel(pageText, "Ownership", "Ownership Type", "Device Ownership");
  if (ownership) {
    if (/\bBYOD\b/i.test(ownership)) return "BYOD";
    if (/\bUser\s+Owned\b/i.test(ownership)) return "BYOD";
    if (/\bCompany\b|\bCorp\b|\bCorporate\b/i.test(ownership)) return "Corp";
    return ownership;
  }

  const devLoc = findValueAfterLabel(pageText, "Device Location");
  if (devLoc) {
    if (/\bBYOD\b/i.test(devLoc)) return "BYOD";
    if (/\bCorp\b|\bCorporate\b/i.test(devLoc)) return "Corp";
  }

  if (/\bBYOD\b/.test(pageText)) return "BYOD";
  if (/\bUser[- ]Owned\b/i.test(pageText)) return "BYOD";
  if (/\bCompany[- ]Owned\b/i.test(pageText)) return "Corp";

  return null;
}

// ── User info extraction ────────────────────────────────────────────
// The device detail page shows user info near the top in this pattern:
//   Marcus Falz
//   |
//   E40018502@adxuser.com
//   |
//   iPhone 16 | Phone #: ...

/**
 * Extract the user's name from the page header area.
 * The name appears just before the first "|" separator and the email line.
 */
export function extractUserName(pageText: string): string | null {
  const lines = pageText.split("\n").map((l) => l.trim());
  // Find the email line, then the name is 2 lines before it (name / | / email)
  for (let i = 2; i < lines.length; i++) {
    if (/@\w+\.\w+/.test(lines[i]) && lines[i - 1] === "|") {
      const name = lines[i - 2];
      if (name && name !== "|" && name.length > 1 && !name.includes("@")) {
        return name;
      }
    }
  }
  return null;
}

/**
 * Extract email from the page header area.
 * Appears as a line like "E40018502@adxuser.com" near the top.
 */
export function extractUserEmail(pageText: string): string | null {
  const lines = pageText.split("\n").map((l) => l.trim());
  for (const line of lines) {
    // Match email-like pattern early in the page (before the detail table)
    const m = line.match(/^([\w.+-]+@[\w.-]+\.\w{2,})$/);
    if (m) return m[1];
  }
  return null;
}

/**
 * Extract ADX/employee ID from the email prefix.
 * E.g. "E40018502@adxuser.com" → "E40018502"
 * Matches patterns like E followed by digits.
 */
export function extractAdx(pageText: string): string | null {
  const email = extractUserEmail(pageText);
  if (email) {
    const m = email.match(/^(E\d+)@/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

/**
 * Parse all device details from a MobileIron page's full inner text.
 */
export function parseDevicePage(pageText: string): DeviceDetails {
  return {
    ownershipType: extractOwnershipType(pageText),
    deviceModel: extractDeviceModel(pageText),
    serialNumber: extractSerialNumber(pageText),
    mdn: extractMdn(pageText),
    iosVersion: extractIosVersion(pageText),
  };
}

/**
 * Parse user info (name, ADX) from a MobileIron device page.
 * Returns a partial CaseDetails with only the fields available from Ivanti.
 * Note: email comes from ServiceNow (sys_readonly.sys_user.email), not Ivanti.
 */
export function parseUserInfo(pageText: string): CaseDetails {
  return {
    name: extractUserName(pageText),
    email: null,
    callback: null,
    adx: extractAdx(pageText),
    issueMessage: null,
  };
}
