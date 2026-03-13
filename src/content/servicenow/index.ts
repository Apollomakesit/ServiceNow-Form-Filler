/**
 * Content script for ServiceNow case pages.
 *
 * Extracts case metadata from:
 *   - Description field (parsed for Name, ADX, Issue, etc.)
 *   - sys_readonly.sys_user.email input (real user email)
 *   - incident.u_callback_number input (callback number)
 *   - Most recent "Additional comments" work note (Issue / Troubleshoot)
 */

import { CaseDetailsSchema, type CaseDetails } from "../../shared/schemas";
import type { ExtensionMessage } from "../../shared/messages";
import { findFieldByLabel, readInputByLabel } from "../helpers";
import { parseDescription } from "./parser";

export { parseDescription };

// ── Selectors (centralized for easy patching) ───────────────────────

const SELECTORS = {
  /** The Description field — ServiceNow uses iframes; try multiple paths. */
  descriptionTextarea: [
    'textarea[aria-label="Description"]',
    "#incident\\.description",
    'textarea[name="description"]',
    'textarea[name="incident.description"]',
  ],
  /** Rendered read-only description block. */
  descriptionReadOnly: [
    '[data-field="description"] .sn-widget-textblock-body',
    '#element\\.incident\\.description .form-control-static',
    '#element\\.incident\\.description .sn-widget-textblock-body',
    '[data-name="incident.description"] .form-control-static',
  ],
  /** Real user email (read-only input). */
  emailInput: [
    "#sys_readonly\\.sys_user\\.email",
    'input[id="sys_readonly.sys_user.email"]',
    "#sys_readonly\\.incident\\.caller_id\\.email",
  ],
  /** Callback number input. */
  callbackInput: [
    "#incident\\.u_callback_number",
    'input[id="incident.u_callback_number"]',
    "#sys_readonly\\.incident\\.u_callback_number",
  ],
  callerInput: [
    "#sys_display\\.incident\\.caller_id",
    'input[id="sys_display.incident.caller_id"]',
    'input[name="sys_display.incident.caller_id"]',
  ],
  shortDescriptionInput: [
    "#incident\\.short_description",
    'input[id="incident.short_description"]',
    'input[name="incident.short_description"]',
  ],
  callerPreviewButton: [
    "#viewr\\.incident\\.caller_id",
    'button[name="viewr.incident.caller_id"]',
  ],
};

// ── DOM extraction ──────────────────────────────────────────────────

/** Try to get a document — either the main document or inside the gsft_main iframe. */
function getDocuments(): Document[] {
  const docs: Document[] = [document];

  const iframes = document.querySelectorAll<HTMLIFrameElement>(
    'iframe[name*="gsft_main"], iframe#gsft_main'
  );
  for (const iframe of iframes) {
    try {
      if (iframe.contentDocument) {
        docs.push(iframe.contentDocument);
      }
    } catch {
      // Cross-origin iframe — can't access
    }
  }
  return docs;
}

function queryInput(docs: Document[], selectors: string[]): string | null {
  for (const doc of docs) {
    for (const sel of selectors) {
      const el = doc.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel);
      if (el?.value?.trim()) return el.value.trim();
    }
  }
  return null;
}

function queryByLabel(docs: Document[], labels: string[]): string | null {
  for (const doc of docs) {
    for (const label of labels) {
      const inputValue = readInputByLabel(doc, label);
      if (inputValue) return inputValue;

      const fieldValue = findFieldByLabel(doc, label);
      if (fieldValue) return fieldValue;
    }
  }
  return null;
}

function normalizeFieldKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesFieldKey(candidate: string, keys: string[]): boolean {
  const normalizedCandidate = normalizeFieldKey(candidate);
  return keys.some((key) => normalizedCandidate.includes(normalizeFieldKey(key)));
}

function getValueFromFormControls(keys: string[]): string | null {
  for (const doc of getDocuments()) {
    const controls = doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select"
    );

    for (const control of controls) {
      if (control instanceof HTMLInputElement && control.type.toLowerCase() === "hidden") {
        continue;
      }

      const identifier = [
        control.id,
        control.name,
        control.getAttribute("aria-label") ?? "",
        control.getAttribute("placeholder") ?? "",
      ]
        .filter(Boolean)
        .join(" ");

      if (!identifier || !matchesFieldKey(identifier, keys)) {
        continue;
      }

      const value =
        control instanceof HTMLSelectElement
          ? control.selectedOptions[0]?.textContent?.trim() ?? control.value.trim()
          : control.value.trim();

      if (value) {
        return value;
      }
    }
  }

  return null;
}

function getPageTexts(): string[] {
  return getDocuments()
    .map((doc) => doc.body?.innerText?.trim() ?? "")
    .filter(Boolean);
}

function findValueAfterLabelInText(text: string, labels: string[]): string | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!labels.some((label) => line.toLowerCase() === label.toLowerCase())) {
      continue;
    }

    for (let valueIndex = index + 1; valueIndex < lines.length; valueIndex += 1) {
      const candidate = lines[valueIndex];
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function findDescriptionBlockInText(text: string): string | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const descriptionIndex = lines.findIndex((line) => line.toLowerCase() === "description");
  if (descriptionIndex === -1) {
    return null;
  }

  const stopLabels = new Set([
    "notes",
    "related records",
    "resolution information",
    "governance",
    "transcript",
    "work notes",
    "additional comments",
    "related search results",
    "related search",
    "knowledge articles",
  ]);

  const collected: string[] = [];
  for (let index = descriptionIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      if (collected.length > 0) {
        break;
      }
      continue;
    }

    if (stopLabels.has(line.toLowerCase())) {
      break;
    }

    collected.push(line);
  }

  return collected.length > 0 ? collected.join("\n") : null;
}

function getDescriptionTextFromPageText(): string | null {
  for (const pageText of getPageTexts()) {
    const description = findDescriptionBlockInText(pageText);
    if (description) {
      return description;
    }
  }

  return null;
}

function getFieldFromPageText(labels: string[]): string | null {
  for (const pageText of getPageTexts()) {
    const value = findValueAfterLabelInText(pageText, labels);
    if (value) {
      return value;
    }
  }

  return null;
}

function getDescriptionText(): string | null {
  for (const doc of getDocuments()) {
    for (const sel of SELECTORS.descriptionTextarea) {
      const el = doc.querySelector<HTMLTextAreaElement>(sel);
      if (el?.value?.trim()) return el.value.trim();
    }
    for (const sel of SELECTORS.descriptionReadOnly) {
      const el = doc.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
  }

  const controlValue = getValueFromFormControls(["incident description", "description"]);
  if (controlValue) {
    return controlValue;
  }

  return getDescriptionTextFromPageText();
}

function hasAnyCaseDetails(data: CaseDetails): boolean {
  return Object.values(data).some((value) => typeof value === "string" && value.trim().length > 0);
}

function getCallerNameFromDom(): string | null {
  return (
    queryInput(getDocuments(), SELECTORS.callerInput) ??
    queryByLabel(getDocuments(), ["Caller", "Name"]) ??
    getValueFromFormControls(["caller id", "caller"]) ??
    getFieldFromPageText(["Caller", "Name"])
  );
}

function getShortDescriptionFromDom(): string | null {
  return (
    queryInput(getDocuments(), SELECTORS.shortDescriptionInput) ??
    queryByLabel(getDocuments(), ["Short description"]) ??
    getValueFromFormControls(["short description"]) ??
    getFieldFromPageText(["Short description"])
  );
}

function getEmailFromVisibleDom(): string | null {
  return (
    queryInput(getDocuments(), SELECTORS.emailInput) ??
    queryByLabel(getDocuments(), ["Email"]) ??
    getValueFromFormControls(["email", "caller email"]) ??
    getFieldFromPageText(["Email"])
  );
}

function getCallbackFromVisibleDom(): string | null {
  return (
    queryInput(getDocuments(), SELECTORS.callbackInput) ??
    queryByLabel(getDocuments(), ["Callback Number", "Business phone", "Mobile phone", "Phone"]) ??
    getValueFromFormControls(["callback number", "callback", "business phone", "mobile phone", "phone"]) ??
    getFieldFromPageText(["Callback Number", "Business phone", "Mobile phone", "Phone"])
  );
}

function getAdxFromVisibleDom(): string | null {
  return (
    queryByLabel(getDocuments(), ["User ID", "Employee number", "Workday ID"]) ??
    getValueFromFormControls(["user id", "employee number", "workday id", "adx"]) ??
    getFieldFromPageText(["User ID", "Employee number", "Workday ID"])
  );
}

async function openCallerPreview(): Promise<void> {
  if (getEmailFromVisibleDom()) {
    return;
  }

  for (const selector of SELECTORS.callerPreviewButton) {
    const button = document.querySelector<HTMLButtonElement>(selector);
    if (!button) continue;

    button.click();
    await new Promise((resolve) => window.setTimeout(resolve, 600));

    if (getEmailFromVisibleDom()) {
      return;
    }
  }
}

/**
 * Extract the most recent "Additional comments" work note text.
 * ServiceNow renders work notes/comments in sn-card-component elements
 * inside the activity stream.
 */
function getLatestAdditionalComment(): string | null {
  for (const doc of getDocuments()) {
    // Try to find journal entries — ServiceNow uses various structures
    const cards = doc.querySelectorAll(
      '.sn-widget-textblock-body_formatted, .sn-card-component .sn-widget-textblock-body, [id*="journal"] .sn-widget-textblock-body'
    );
    // The first matching card is typically the most recent
    for (const card of cards) {
      const text = card.textContent?.trim();
      if (text) return text;
    }

    // Fallback: try activity stream entries
    const activityEntries = doc.querySelectorAll(
      '.activities-form .sn-card-component-content, .sn-activity-stream .sn-card-component'
    );
    for (const entry of activityEntries) {
      const label = entry.querySelector('.sn-card-component-header, .sn-card-component_header');
      if (label?.textContent?.toLowerCase().includes('additional comment')) {
        const body = entry.querySelector('.sn-widget-textblock-body, .sn-widget-textblock-body_formatted');
        if (body?.textContent?.trim()) return body.textContent.trim();
      }
    }
  }
  return null;
}

// ── Capture + send ──────────────────────────────────────────────────

async function captureCaseDetails(): Promise<CaseDetails | null> {
  const descText = getDescriptionText();
  const parsed = descText ? parseDescription(descText) : {
    name: null, email: null, callback: null, adx: null, issueMessage: null,
  };

  if (!parsed.name) {
    parsed.name = getCallerNameFromDom();
  }

  if (!parsed.issueMessage) {
    parsed.issueMessage = getShortDescriptionFromDom();
  }

  if (!parsed.email || !parsed.adx) {
    await openCallerPreview();
  }

  // Override email from the real ServiceNow email field
  const domEmail = getEmailFromVisibleDom();
  if (domEmail) parsed.email = domEmail;

  // Override callback from the ServiceNow callback field
  const domCallback = getCallbackFromVisibleDom();
  if (domCallback) parsed.callback = domCallback;

  if (!parsed.adx) {
    parsed.adx = getAdxFromVisibleDom();
  }

  // Extract issue/troubleshoot from most recent work note comment
  const latestComment = getLatestAdditionalComment();
  if (latestComment) {
    const issueFromComment = extractFieldFromComment(latestComment, "issue", "issue / error message", "issue/error message", "error message");
    if (issueFromComment && !parsed.issueMessage) {
      parsed.issueMessage = issueFromComment;
    }
  }

  const result = CaseDetailsSchema.safeParse(parsed);
  if (!result.success || !hasAnyCaseDetails(result.data)) {
    return null;
  }

  return result.data;
}

/**
 * Extract a labeled field value from a work note comment text.
 * Work notes often contain lines like:
 *   Issue / Error message: phone won't turn on
 *   Troubleshoot: restarted device
 */
function extractFieldFromComment(commentText: string, ...labelPrefixes: string[]): string | null {
  const lines = commentText.split(/\r?\n/).map(l => l.trim());
  for (const line of lines) {
    for (const prefix of labelPrefixes) {
      if (line.toLowerCase().startsWith(prefix.toLowerCase() + ":")) {
        const value = line.slice(line.indexOf(":") + 1).trim();
        if (value) return value;
      }
    }
  }
  return null;
}

function sendToBackground(data: CaseDetails): void {
  const msg: ExtensionMessage = { type: "CASE_CAPTURED", data };
  chrome.runtime.sendMessage(msg);
}

// ── Inject a small capture button on the page ───────────────────────

function injectCaptureButton(): void {
  if (document.getElementById("snff-capture-btn")) return;

  const btn = document.createElement("button");
  btn.id = "snff-capture-btn";
  btn.textContent = "📋 Capture Case Details";
  btn.title = "Extract case info for Work Notes template";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "999999",
    padding: "10px 16px",
    backgroundColor: "#0078d4",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontFamily: "system-ui, sans-serif",
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
  });

  btn.addEventListener("click", async () => {
    const data = await captureCaseDetails();
    if (data) {
      sendToBackground(data);
      btn.textContent = "✅ Case Captured";
      btn.style.backgroundColor = "#107c10";
      setTimeout(() => {
        btn.textContent = "📋 Capture Case Details";
        btn.style.backgroundColor = "#0078d4";
      }, 2000);
    } else {
      btn.textContent = "⚠️ No Description Found";
      btn.style.backgroundColor = "#d83b01";
      setTimeout(() => {
        btn.textContent = "📋 Capture Case Details";
        btn.style.backgroundColor = "#0078d4";
      }, 2000);
    }
  });

  document.body.appendChild(btn);
}

// ── Init ────────────────────────────────────────────────────────────

injectCaptureButton();
