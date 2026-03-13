/**
 * Content script for MobileIron / Ivanti Neurons MDM device pages.
 *
 * Target URL pattern: na3.mobileiron.com/index.html#!/devices/detail/...
 *
 * The page is an AngularJS SPA with hash-based routing.
 * Content is rendered asynchronously after the shell loads, so
 * extraction must wait for real data to appear in the DOM.
 *
 * Known page structure (from live screenshot):
 *   - Header/summary bar: "iPhone 12 | Phone #: +1... | Space: ... | Status: Active | ..."
 *   - Table under "General" tab with label→value rows:
 *       Serial Number    H4YJ82YB0F00
 *       Model Number     MGHN3VC/A
 *       Manufacturer     Apple
 *       Device Location  Disabled in RTX - BYOD Privacy
 *   - iOS/OS version may appear further down the page or on a different tab.
 */

import { DeviceDetailsSchema, type DeviceDetails } from "../../shared/schemas";
import type { ExtensionMessage } from "../../shared/messages";

// ── Page text helper ────────────────────────────────────────────────

function getPageText(): string {
  return document.body?.innerText ?? "";
}

// ── Table extraction (primary strategy for MobileIron) ──────────────
// MobileIron renders device details in <table> rows where the first
// cell is the label and the second cell is the value.

function findTableValue(...labelVariants: string[]): string | null {
  const rows = document.querySelectorAll("tr");
  for (const row of rows) {
    const cells = row.querySelectorAll("td, th");
    if (cells.length < 2) continue;
    const cellText = cells[0].textContent?.trim().toLowerCase() ?? "";
    for (const label of labelVariants) {
      if (cellText === label.toLowerCase()) {
        const val = cells[1].textContent?.trim();
        if (val && val.toLowerCase() !== "n/a") return val;
      }
    }
  }
  return null;
}

// ── Summary / header bar extraction ─────────────────────────────────
// MobileIron shows a pipe-delimited summary line near the top:
// "iPhone 12 | Phone #: +12892188428 | Space: Default Space | ..."

function matchPageText(regex: RegExp): string | null {
  const text = getPageText();
  const match = text.match(regex);
  return match?.[1]?.trim() || null;
}

// ── Per-field extractors tailored to MobileIron layout ──────────────

function extractSerialNumber(): string | null {
  return findTableValue("serial number", "serial", "serial no", "serial #", "device serial");
}

function extractModelNumber(): string | null {
  return findTableValue("model number", "model", "model name", "device model", "product name");
}

function extractDeviceModel(): string | null {
  // Prefer the friendly name like "iPhone 12" from the summary bar
  const fromSummary = matchPageText(/\b(iPhone\s+[\w\s]+?)(?:\s*\||$)/i)
    ?? matchPageText(/\b(iPad\s+[\w\s]+?)(?:\s*\||$)/i);
  if (fromSummary) return fromSummary.trim();

  // Fall back to the table "Model Number" which may be a code like MGHN3VC/A
  return extractModelNumber();
}

function extractMdn(): string | null {
  // MobileIron shows "Phone #: +12892188428" in the summary bar
  const fromSummary = matchPageText(/Phone\s*#\s*:?\s*([+()\-\d\s]{7,})/i);
  if (fromSummary) return fromSummary.replace(/\s+/g, "").trim();

  // Also try table labels
  return findTableValue("mdn", "phone number", "phone #", "mobile number",
    "cellular number", "telephone", "line number");
}

function extractIosVersion(): string | null {
  // Try table labels first
  const fromTable = findTableValue("os version", "ios version",
    "operating system version", "software version", "system version", "os");
  if (fromTable) return fromTable;

  // Try matching version-like text from the page
  const fromText = matchPageText(
    /(?:iOS|OS)\s*(?:Version)?\s*:?\s*(\d+(?:\.\d+)+)/i
  );
  return fromText;
}

function extractOwnershipType(): string | null {
  // Try direct table labels
  const fromTable = findTableValue("ownership", "ownership type",
    "corp/byod", "device ownership", "managed by");
  if (fromTable) {
    if (/\bBYOD\b/i.test(fromTable)) return "BYOD";
    if (/\bCorp\b|\bCorporate\b/i.test(fromTable)) return "Corp";
    return fromTable;
  }

  // MobileIron's "Device Location" field often contains BYOD or Corp hints
  // e.g. "Disabled in RTX - BYOD Privacy"
  const deviceLocation = findTableValue("device location");
  if (deviceLocation) {
    if (/\bBYOD\b/i.test(deviceLocation)) return "BYOD";
    if (/\bCorp\b|\bCorporate\b/i.test(deviceLocation)) return "Corp";
  }

  // Last resort: scan full page text
  const text = getPageText();
  if (/\bBYOD\b/.test(text)) return "BYOD";
  if (/\bCorporate\b|company[- ]owned/i.test(text)) return "Corp";

  return null;
}

// ── Main extraction ─────────────────────────────────────────────────

function extractDeviceDetails(): DeviceDetails {
  return {
    ownershipType: extractOwnershipType(),
    deviceModel: extractDeviceModel(),
    serialNumber: extractSerialNumber(),
    mdn: extractMdn(),
    iosVersion: extractIosVersion(),
  };
}

// ── Capture + send ──────────────────────────────────────────────────

function captureDeviceDetails(): DeviceDetails | null {
  const raw = extractDeviceDetails();
  const result = DeviceDetailsSchema.safeParse(raw);
  return result.success ? result.data : null;
}

function sendToBackground(data: DeviceDetails): void {
  const msg: ExtensionMessage = { type: "DEVICE_CAPTURED", data };
  chrome.runtime.sendMessage(msg);
}

// ── Diagnostic string for the button tooltip ────────────────────────

function diagString(data: DeviceDetails): string {
  const entries = Object.entries(data);
  const found = entries.filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`);
  const missing = entries.filter(([, v]) => v === null).map(([k]) => k);
  let msg = "";
  if (found.length) msg += "Found: " + found.join(", ");
  if (missing.length) msg += (msg ? "\n" : "") + "Missing: " + missing.join(", ");
  return msg;
}

// ── Inject capture button ───────────────────────────────────────────

function injectCaptureButton(): void {
  if (document.getElementById("snff-ivanti-btn")) return;

  const btn = document.createElement("button");
  btn.id = "snff-ivanti-btn";
  btn.textContent = "📱 Capture Device Details";
  btn.title = "Extract device info for Work Notes template";
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
    const data = captureDeviceDetails();
    if (data) {
      sendToBackground(data);
      const found = Object.entries(data).filter(([, v]) => v !== null);
      const missing = Object.entries(data).filter(([, v]) => v === null);

      if (missing.length === 0) {
        btn.textContent = "✅ Device Captured (5/5)";
        btn.style.backgroundColor = "#107c10";
      } else {
        btn.textContent = `⚠️ Captured (${found.length}/5 fields)`;
        btn.style.backgroundColor = "#ff8c00";
      }
      btn.title = diagString(data);
      setTimeout(() => {
        btn.textContent = "📱 Capture Device Details";
        btn.style.backgroundColor = "#0078d4";
        btn.title = "Extract device info for Work Notes template";
      }, 4000);
    } else {
      btn.textContent = "⚠️ No Device Data Found";
      btn.style.backgroundColor = "#d83b01";
      btn.title = "The extension could not find any device fields on this page.";
      setTimeout(() => {
        btn.textContent = "📱 Capture Device Details";
        btn.style.backgroundColor = "#0078d4";
        btn.title = "Extract device info for Work Notes template";
      }, 3000);
    }
  });

  document.body.appendChild(btn);
}

// ── Init with SPA-aware retry ───────────────────────────────────────
// MobileIron is an AngularJS SPA. The shell HTML loads first, then
// Angular bootstraps and asynchronously renders the device detail view.
// We need to wait for `document.body` and keep re-injecting the button
// after Angular route changes destroy and recreate DOM nodes.

function init(): void {
  function tryInject(): void {
    if (document.body) {
      injectCaptureButton();
      startObserver();
    } else {
      // Body not ready yet (very unlikely at document_idle, but safe)
      setTimeout(tryInject, 200);
    }
  }

  function startObserver(): void {
    const observer = new MutationObserver(() => {
      if (!document.getElementById("snff-ivanti-btn")) {
        injectCaptureButton();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  tryInject();
}

// Run on script load
init();
