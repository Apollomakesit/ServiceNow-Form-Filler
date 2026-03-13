/**
 * Content script for MobileIron / Ivanti Neurons MDM device pages.
 *
 * Target URL pattern: na3.mobileiron.com/index.html#!/devices/detail/...
 *
 * The page is an AngularJS SPA with hash-based routing.  Content is
 * rendered with CSS-styled divs (NOT HTML <table> elements), so we
 * extract data from document.body.innerText which reliably contains
 * label/value pairs on consecutive lines.
 */

import { DeviceDetailsSchema, type DeviceDetails } from "../../shared/schemas";
import type { ExtensionMessage } from "../../shared/messages";
import { parseDevicePage } from "./parser";

// ── Main extraction ─────────────────────────────────────────────────

function extractDeviceDetails(): DeviceDetails {
  const pageText = document.body?.innerText ?? "";
  return parseDevicePage(pageText);
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
