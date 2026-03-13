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

import { DeviceDetailsSchema, CaseDetailsSchema, type DeviceDetails, type CaseDetails } from "../../shared/schemas";
import type { ExtensionMessage } from "../../shared/messages";
import { loadCaseDetails } from "../../shared/storage";
import { parseDevicePage, parseUserInfo } from "./parser";

// ── Main extraction ─────────────────────────────────────────────────

function extractDeviceDetails(): DeviceDetails {
  const pageText = document.body?.innerText ?? "";
  return parseDevicePage(pageText);
}

function extractUserDetails(): CaseDetails {
  const pageText = document.body?.innerText ?? "";
  return parseUserInfo(pageText);
}

// ── Capture + send ──────────────────────────────────────────────────

function captureDeviceDetails(): DeviceDetails | null {
  const raw = extractDeviceDetails();
  const result = DeviceDetailsSchema.safeParse(raw);
  return result.success ? result.data : null;
}

function captureUserDetails(): CaseDetails | null {
  const raw = extractUserDetails();
  const result = CaseDetailsSchema.safeParse(raw);
  return result.success ? result.data : null;
}

function sendToBackground(deviceData: DeviceDetails, userData: CaseDetails | null): void {
  const deviceMsg: ExtensionMessage = { type: "DEVICE_CAPTURED", data: deviceData };
  chrome.runtime.sendMessage(deviceMsg);

  if (userData && (userData.name || userData.email || userData.adx)) {
    const caseMsg: ExtensionMessage = { type: "CASE_CAPTURED", data: userData };
    chrome.runtime.sendMessage(caseMsg);
  }
}

// ── Diagnostic string for the button tooltip ────────────────────────

function diagString(data: DeviceDetails, userData: CaseDetails | null): string {
  const deviceEntries = Object.entries(data);
  const userEntries: [string, string | null][] = userData
    ? [["name", userData.name], ["adx", userData.adx]]
    : [];
  const allEntries = [...userEntries, ...deviceEntries];
  const found = allEntries.filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`);
  const missing = allEntries.filter(([, v]) => v === null).map(([k]) => k);
  let msg = "";
  if (found.length) msg += "Found: " + found.join(", ");
  if (missing.length) msg += (msg ? "\n" : "") + "Missing: " + missing.join(", ");
  return msg;
}

// ── Inject capture button (draggable + auto-copy) ───────────────────

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
    cursor: "grab",
    fontSize: "13px",
    fontFamily: "system-ui, sans-serif",
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    userSelect: "none",
  });

  // ── Drag logic ──────────────────────────────────────────────────
  let isDragging = false;
  let wasDragged = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let btnStartX = 0;
  let btnStartY = 0;

  const DRAG_THRESHOLD = 5; // px — ignore tiny moves as clicks

  btn.addEventListener("mousedown", (e: MouseEvent) => {
    isDragging = true;
    wasDragged = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = btn.getBoundingClientRect();
    btnStartX = rect.left;
    btnStartY = rect.top;
    btn.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      wasDragged = true;
    }
    // Remove bottom/right anchoring; use top/left for free positioning
    btn.style.bottom = "auto";
    btn.style.right = "auto";
    btn.style.left = `${btnStartX + dx}px`;
    btn.style.top = `${btnStartY + dy}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      btn.style.cursor = "grab";
    }
  });

  // ── Capture click (only fires if not dragged) ─────────────────
  btn.addEventListener("click", async () => {
    if (wasDragged) return; // was a drag, not a click

    const data = captureDeviceDetails();
    const userData = captureUserDetails();
    if (data) {
      sendToBackground(data, userData);

      // Load previously saved ServiceNow case details and merge with Ivanti user data
      const storedCase = await loadCaseDetails();
      const mergedCase: CaseDetails = {
        name: userData?.name ?? storedCase?.name ?? null,
        email: storedCase?.email ?? userData?.email ?? null,
        callback: storedCase?.callback ?? null,
        adx: userData?.adx ?? storedCase?.adx ?? null,
        issueMessage: storedCase?.issueMessage ?? null,
      };

      // Auto-copy formatted work notes to clipboard
      const { mergeToTemplate, formatWorkNotes } = await import("../../shared/formatter");
      const merged = mergeToTemplate(mergedCase, data);
      const workNotesText = formatWorkNotes(merged);
      try {
        await navigator.clipboard.writeText(workNotesText);
      } catch {
        // Clipboard may be unavailable — data is still sent to background
      }

      const deviceEntries = Object.entries(data);
      const userFields: [string, string | null][] = userData
        ? [["name", userData.name], ["adx", userData.adx]]
        : [];
      const allEntries = [...userFields, ...deviceEntries];
      const found = allEntries.filter(([, v]) => v !== null);
      const missing = allEntries.filter(([, v]) => v === null);
      const total = allEntries.length;

      if (missing.length === 0) {
        btn.textContent = `✅ Captured & Copied (${found.length}/${total})`;
        btn.style.backgroundColor = "#107c10";
      } else {
        btn.textContent = `⚠️ Captured & Copied (${found.length}/${total} fields)`;
        btn.style.backgroundColor = "#ff8c00";
      }
      btn.title = diagString(data, userData);
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
