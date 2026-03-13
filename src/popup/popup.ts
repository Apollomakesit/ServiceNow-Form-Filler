import type { ExtensionMessage } from "../shared/messages";
import { mergeToTemplate, formatWorkNotes } from "../shared/formatter";
import type { CaseDetails, DeviceDetails } from "../shared/schemas";

// ── DOM refs ────────────────────────────────────────────────────────

const statusCase = document.getElementById("status-case")!;
const statusDevice = document.getElementById("status-device")!;
const preview = document.getElementById("preview") as HTMLTextAreaElement;
const btnCopy = document.getElementById("btn-copy") as HTMLButtonElement;
const btnClear = document.getElementById("btn-clear") as HTMLButtonElement;
const feedback = document.getElementById("feedback")!;
const buildVersion = document.getElementById("build-version")!;

// ── State ───────────────────────────────────────────────────────────

let currentCase: CaseDetails | null = null;
let currentDevice: DeviceDetails | null = null;

// ── Helpers ─────────────────────────────────────────────────────────

function updateUI(): void {
  // Status badges
  if (currentCase) {
    statusCase.textContent = "ServiceNow: ✓ Captured";
    statusCase.className = "badge badge-ok";
  } else {
    statusCase.textContent = "ServiceNow: —";
    statusCase.className = "badge badge-pending";
  }

  if (currentDevice) {
    statusDevice.textContent = "Ivanti: ✓ Captured";
    statusDevice.className = "badge badge-ok";
  } else {
    statusDevice.textContent = "Ivanti: —";
    statusDevice.className = "badge badge-pending";
  }

  // Preview
  const template = mergeToTemplate(currentCase, currentDevice);
  const text = formatWorkNotes(template);
  preview.value = text;

  // Copy button
  btnCopy.disabled = !currentCase && !currentDevice;
}

function showFeedback(msg: string, type: "success" | "error" = "success"): void {
  feedback.textContent = msg;
  feedback.className = `feedback feedback-${type}`;
  setTimeout(() => {
    feedback.textContent = "";
    feedback.className = "feedback";
  }, 2500);
}

function loadBuildVersion(): void {
  const manifest = chrome.runtime.getManifest();
  const versionLabel = manifest.version_name
    ? `${manifest.version} (${manifest.version_name})`
    : manifest.version;

  buildVersion.textContent = `Version: ${versionLabel}`;
}

// ── Load current state from background ──────────────────────────────

function loadStatus(): void {
  const msg: ExtensionMessage = { type: "GET_STATUS" };
  chrome.runtime.sendMessage(msg, (response) => {
    if (response?.caseDetails) currentCase = response.caseDetails;
    if (response?.deviceDetails) currentDevice = response.deviceDetails;
    updateUI();
  });
}

// ── Event handlers ──────────────────────────────────────────────────

btnCopy.addEventListener("click", async () => {
  const text = preview.value;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    showFeedback("Copied to clipboard!");
  } catch {
    // Fallback: select the text
    preview.select();
    document.execCommand("copy");
    showFeedback("Copied to clipboard!");
  }
});

btnClear.addEventListener("click", () => {
  const msg: ExtensionMessage = { type: "CLEAR_DATA" };
  chrome.runtime.sendMessage(msg, () => {
    currentCase = null;
    currentDevice = null;
    updateUI();
    showFeedback("Data cleared");
  });
});

// ── Init ────────────────────────────────────────────────────────────

loadBuildVersion();
loadStatus();
