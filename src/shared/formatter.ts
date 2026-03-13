import type { CaseDetails, DeviceDetails, WorkNotesTemplate } from "./schemas";

/** Merge case + device into a single template object. */
export function mergeToTemplate(
  caseDetails: CaseDetails | null,
  deviceDetails: DeviceDetails | null
): WorkNotesTemplate {
  return {
    name: caseDetails?.name ?? null,
    email: caseDetails?.email ?? null,
    callback: caseDetails?.callback ?? null,
    adx: caseDetails?.adx ?? null,
    corpOrByod: deviceDetails?.ownershipType ?? null,
    deviceModel: deviceDetails?.deviceModel ?? null,
    serialNumber: deviceDetails?.serialNumber ?? null,
    mdn: deviceDetails?.mdn ?? null,
    iosVersion: deviceDetails?.iosVersion ?? null,
    issueMessage: caseDetails?.issueMessage ?? null,
    troubleshoot: null,
    escalated: null,
  };
}

/** Format the final Work Notes text — blank string for any missing value. */
export function formatWorkNotes(template: WorkNotesTemplate): string {
  const val = (v: string | null): string => v?.trim() || "";

  return [
    `Name: ${val(template.name)}`,
    `Email: ${val(template.email)}`,
    `Callback: ${val(template.callback)}`,
    `ADX: ${val(template.adx)}`,
    `Corp/BYOD: ${val(template.corpOrByod)}`,
    `Device Model: ${val(template.deviceModel)}`,
    `Serial number: ${val(template.serialNumber)}`,
    `MDN: ${val(template.mdn)}`,
    `iOS Version: ${val(template.iosVersion)}`,
    `Issue / Error message: ${val(template.issueMessage)}`,
    `Troubleshoot: ${val(template.troubleshoot)}`,
    `Escalated: ${val(template.escalated)}`,
  ].join("\n");
}
