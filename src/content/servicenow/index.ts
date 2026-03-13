/**
 * Content script for ServiceNow case pages.
 *
 * Extracts case metadata from the Description field and visible form fields.
 * The Description field typically contains agent-entered details like:
 *   Name, Email/ADX, Callback, Employee ID, and the issue description.
 *
 * Extraction strategy:
 *   1. Look for the Description textarea/field on the case page.
 *   2. Parse its contents using line-by-line label:value patterns.
 *   3. Fall back to reading individual form fields by label.
 */

import { CaseDetailsSchema } from "../../shared/schemas";
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
};

// ── DOM extraction ──────────────────────────────────────────────────

function getDescriptionText(): string | null {
  // Try textarea selectors
  for (const sel of SELECTORS.descriptionTextarea) {
    const el = document.querySelector<HTMLTextAreaElement>(sel);
    if (el?.value?.trim()) return el.value.trim();
  }

  // Try read-only rendered blocks
  for (const sel of SELECTORS.descriptionReadOnly) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }

  // ServiceNow sometimes renders inside an iframe
  const iframes = document.querySelectorAll<HTMLIFrameElement>(
    'iframe[name*="gsft_main"], iframe#gsft_main'
  );
  for (const iframe of iframes) {
    try {
      const doc = iframe.contentDocument;
      if (!doc) continue;
      for (const sel of SELECTORS.descriptionTextarea) {
        const el = doc.querySelector<HTMLTextAreaElement>(sel);
        if (el?.value?.trim()) return el.value.trim();
      }
      for (const sel of SELECTORS.descriptionReadOnly) {
        const el = doc.querySelector(sel);
        if (el?.textContent?.trim()) return el.textContent.trim();
      }
    } catch {
      // Cross-origin iframe — can't access
    }
  }
  return null;
}

// ── Capture + send ──────────────────────────────────────────────────

function captureCaseDetails(): CaseDetails | null {
  const descText = getDescriptionText();
  if (!descText) return null;

  const parsed = parseDescription(descText);
  const result = CaseDetailsSchema.safeParse(parsed);
  return result.success ? result.data : null;
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
