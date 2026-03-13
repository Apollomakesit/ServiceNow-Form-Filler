import type { CaseDetails, DeviceDetails } from "./schemas";

const STORAGE_KEY_CASE = "caseDetails";
const STORAGE_KEY_DEVICE = "deviceDetails";

export async function saveCaseDetails(data: CaseDetails): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_CASE]: data });
}

export async function saveDeviceDetails(data: DeviceDetails): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_DEVICE]: data });
}

export async function loadCaseDetails(): Promise<CaseDetails | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY_CASE);
  return result[STORAGE_KEY_CASE] ?? null;
}

export async function loadDeviceDetails(): Promise<DeviceDetails | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY_DEVICE);
  return result[STORAGE_KEY_DEVICE] ?? null;
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEY_CASE, STORAGE_KEY_DEVICE]);
}
