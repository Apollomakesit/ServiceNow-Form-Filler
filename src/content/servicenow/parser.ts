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

  return {
    name: get("name", "caller", "user"),
    email: get("email", "e-mail", "mail"),
    callback: get(
      "callback",
      "callback number",
      "call back number",
      "phone",
      "cb",
      "preferred contact number"
    ),
    adx: get(
      "adx",
      "employee id",
      "emp id",
      "employee",
      "id",
      "user id",
      "uid"
    ),
    issueMessage,
  };
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
