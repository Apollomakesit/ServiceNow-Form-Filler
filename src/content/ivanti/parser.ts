/**
 * Pure parsing functions for MobileIron / Ivanti Neurons MDM pages.
 *
 * All functions accept a plain text string (document.body.innerText)
 * and return extracted values.  No DOM access — safe for unit testing.
 */

import type { DeviceDetails } from "../../shared/schemas";

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
 */
export function findSummaryLine(pageText: string): string | null {
  const lines = pageText.split("\n");
  for (const line of lines) {
    if (/Status:\s*(Active|Inactive|Retired)/i.test(line) && line.includes("|")) {
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
    if (/\bCompany\b|\bCorp\b|\bCorporate\b/i.test(ownership)) return "Corp";
    return ownership;
  }

  const devLoc = findValueAfterLabel(pageText, "Device Location");
  if (devLoc) {
    if (/\bBYOD\b/i.test(devLoc)) return "BYOD";
    if (/\bCorp\b|\bCorporate\b/i.test(devLoc)) return "Corp";
  }

  if (/\bBYOD\b/.test(pageText)) return "BYOD";
  if (/\bCompany[- ]Owned\b/i.test(pageText)) return "Corp";

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
