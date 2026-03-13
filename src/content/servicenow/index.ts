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
import { parseDescription } from "./parser";

export { parseDescription };

// ── Selectors (centralized for easy patching) ───────────────────────

const SELECTORS = {
  /** The Description field — ServiceNow uses iframes; try multiple paths. */
  descriptionTextarea: [
    'textarea[aria-label="Description"]',
    "#incident\\.description",
    'textarea[name="description"]',
  ],
  /** Rendered read-only description block. */
  descriptionReadOnly: [
    '[data-field="description"] .sn-widget-textblock-body',
    '[id*="description"] .form-control-static',
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
      const el = doc.querySelector<HTMLInputElement>(sel);
      if (el?.value?.trim()) return el.value.trim();
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
  return null;
}

function getEmailFromDom(): string | null {
  return queryInput(getDocuments(), SELECTORS.emailInput);
}

function getCallbackFromDom(): string | null {
  return queryInput(getDocuments(), SELECTORS.callbackInput);
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

function captureCaseDetails(): CaseDetails | null {
  const descText = getDescriptionText();
  const parsed = descText ? parseDescription(descText) : {
    name: null, email: null, callback: null, adx: null, issueMessage: null,
  };

  // Override email from the real ServiceNow email field
  const domEmail = getEmailFromDom();
  if (domEmail) parsed.email = domEmail;

  // Override callback from the ServiceNow callback field
  const domCallback = getCallbackFromDom();
  if (domCallback) parsed.callback = domCallback;

  // Extract issue/troubleshoot from most recent work note comment
  const latestComment = getLatestAdditionalComment();
  if (latestComment) {
    const issueFromComment = extractFieldFromComment(latestComment, "issue", "issue / error message", "issue/error message", "error message");
    if (issueFromComment && !parsed.issueMessage) {
      parsed.issueMessage = issueFromComment;
    }
  }

  const result = CaseDetailsSchema.safeParse(parsed);
  return result.success ? result.data : null;
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

  btn.addEventListener("click", () => {
    const data = captureCaseDetails();
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
