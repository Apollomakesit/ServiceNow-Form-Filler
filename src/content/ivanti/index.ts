/**
 * Content script for Ivanti Neurons MDM device pages.
 *
 * Extracts device attributes from the currently selected device view.
 *
 * Extraction strategy:
 *   1. Look for definition lists or labeled value blocks containing known labels.
 *   2. Fall back to table rows or card-style layouts.
 *   3. Use MutationObserver to handle SPA navigation/rendering delays.
 */

import { DeviceDetailsSchema, type DeviceDetails } from "../../shared/schemas";
import type { ExtensionMessage } from "../../shared/messages";
import { findFieldByLabel, readDefinitionListValue } from "../helpers";

// ── Selectors & label mappings (centralized) ────────────────────────

const LABELS = {
  ownershipType: [
    "ownership",
    "ownership type",
    "corp/byod",
    "corporate/byod",
    "device ownership",
    "managed by",
  ],
  deviceModel: [
    "model",
    "device model",
    "model name",
    "model number",
    "product name",
  ],
  serialNumber: [
    "serial number",
    "serial",
    "serial no",
    "serial #",
    "device serial",
  ],
  mdn: [
    "mdn",
    "phone number",
    "mobile number",
    "cellular number",
    "tel",
    "telephone",
    "line number",
  ],
  iosVersion: [
    "os version",
    "ios version",
    "operating system version",
    "software version",
    "os",
    "system version",
  ],
};

// ── Extraction logic ────────────────────────────────────────────────

function tryExtract(labels: string[]): string | null {
  for (const label of labels) {
    // Strategy 1: definition lists
    const dlVal = readDefinitionListValue(document, label);
    if (dlVal) return dlVal;

    // Strategy 2: generic label→value traversal
    const fieldVal = findFieldByLabel(document, label);
    if (fieldVal) return fieldVal;

    // Strategy 3: table rows where first cell is the label
    const rows = document.querySelectorAll("tr");
    for (const row of rows) {
      const cells = row.querySelectorAll("td, th");
      if (cells.length >= 2) {
        if (cells[0].textContent?.trim().toLowerCase() === label.toLowerCase()) {
          const val = cells[1].textContent?.trim();
          if (val) return val;
        }
      }
    }

    // Strategy 4: aria-label or data-attribute on value elements
    const byAria = document.querySelector(`[aria-label="${label}" i]`);
    if (byAria?.textContent?.trim()) return byAria.textContent.trim();
  }
  return null;
}

function extractDeviceDetails(): DeviceDetails {
  return {
    ownershipType: tryExtract(LABELS.ownershipType),
    deviceModel: tryExtract(LABELS.deviceModel),
    serialNumber: tryExtract(LABELS.serialNumber),
    mdn: tryExtract(LABELS.mdn),
    iosVersion: tryExtract(LABELS.iosVersion),
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
      // Show which fields were found vs missing
      const found = Object.entries(data).filter(([, v]) => v !== null);
      const missing = Object.entries(data).filter(([, v]) => v === null);

      if (missing.length === 0) {
        btn.textContent = "✅ Device Captured";
        btn.style.backgroundColor = "#107c10";
      } else {
        btn.textContent = `⚠️ Captured (${found.length}/5 fields)`;
        btn.style.backgroundColor = "#ff8c00";
      }
      setTimeout(() => {
        btn.textContent = "📱 Capture Device Details";
        btn.style.backgroundColor = "#0078d4";
      }, 3000);
    } else {
      btn.textContent = "⚠️ No Device Data Found";
      btn.style.backgroundColor = "#d83b01";
      setTimeout(() => {
        btn.textContent = "📱 Capture Device Details";
        btn.style.backgroundColor = "#0078d4";
      }, 2000);
    }
  });

  document.body.appendChild(btn);
}

// ── Init ────────────────────────────────────────────────────────────

injectCaptureButton();
