/**
 * Pure parsing logic for ServiceNow Description field.
 * Separated from the content script so it can be unit-tested without DOM.
 */

import type { CaseDetails } from "../../shared/schemas";

/**
 * Parse a free-text Description block into structured case details.
 * Agents typically write lines like:
 *   Name: John Doe
 *   Email: john@example.com
 *   Callback: 1234567890
 *   ADX: E12345678
 *   Issue / Error message: phone won't turn on
 */
export function parseDescription(text: string): CaseDetails {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const fieldMap = new Map<string, string>();

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      fieldMap.set(match[1].trim().toLowerCase(), match[2].trim());
    }
  }

  const get = (...keys: string[]): string | null => {
    for (const key of keys) {
      const val = fieldMap.get(key.toLowerCase());
      if (val) return val;
    }
    return null;
  };

  // The issue message may span multiple lines after the label, or be a single line
  const issueMessage =
    get(
      "issue / error message",
      "issue/error message",
      "issue",
      "error message",
      "error",
      "issue / error",
      "description",
      "description of the issue",
      "issue description",
      "short description"
    ) ||
    extractMultiLineField(
      lines,
      "issue",
      "issue / error message",
      "issue/error message",
      "description of the issue",
      "issue description"
    );

  const fallback = extractFallbackValues(lines);

  return {
    name: get("name", "caller", "user") ?? fallback.name,
    email: get("email", "e-mail", "mail") ?? fallback.email,
    callback: get(
      "callback",
      "callback number",
      "call back number",
      "phone",
      "cb",
      "preferred contact number"
    ) ?? fallback.callback,
    adx: get(
      "adx",
      "employee id",
      "emp id",
      "employee",
      "id",
      "user id",
      "uid"
    ) ?? fallback.adx,
    issueMessage: issueMessage ?? fallback.issueMessage,
  };
}

function extractFallbackValues(lines: string[]): CaseDetails {
  const nonEmptyLines = lines.filter(Boolean);
  const emailLines = nonEmptyLines.filter((line) => isEmail(line));
  const adxEmail = emailLines.find((line) => /@adxuser\./i.test(line));
  const corpEmail = emailLines.find((line) => !/@adxuser\./i.test(line)) ?? null;
  const adxFromEmail = adxEmail ? adxEmail.split("@")[0].trim() : null;
  const adxLine = nonEmptyLines.find((line) => /^E\d{6,}$/i.test(line)) ?? null;
  const callbackLine = nonEmptyLines.find((line) => looksLikePhone(line)) ?? null;

  const name = nonEmptyLines.find(
    (line) => !isEmail(line) && !looksLikePhone(line) && !/^E\d{6,}$/i.test(line)
  ) ?? null;

  const issueCandidates = nonEmptyLines.filter(
    (line) =>
      line !== name &&
      !isEmail(line) &&
      !looksLikePhone(line) &&
      !/^E\d{6,}$/i.test(line)
  );
  const issueMessage = issueCandidates.length > 0 ? issueCandidates[issueCandidates.length - 1] : null;

  return {
    name,
    email: corpEmail,
    callback: callbackLine,
    adx: adxFromEmail ?? adxLine,
    issueMessage,
  };
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value.trim());
}

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * If the issue text spans multiple lines after a label, grab everything
 * from that label to the next label-like line or end of text.
 */
function extractMultiLineField(lines: string[], ...prefixes: string[]): string | null {
  let capturing = false;
  const collected: string[] = [];

  for (const line of lines) {
    if (!capturing) {
      for (const prefix of prefixes) {
        if (line.toLowerCase().startsWith(prefix.toLowerCase() + ":")) {
          const afterColon = line.slice(line.indexOf(":") + 1).trim();
          if (afterColon) collected.push(afterColon);
          capturing = true;
          break;
        }
      }
    } else {
      // Stop if we hit another "Label:" pattern
      if (/^[A-Za-z][^:]{0,30}:\s/.test(line)) break;
      if (line) collected.push(line);
    }
  }
  return collected.length > 0 ? collected.join(" ") : null;
}
