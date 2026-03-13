import type { CaseDetails, DeviceDetails } from "./schemas";

/** All message types flowing between content scripts, background, and popup. */
export type ExtensionMessage =
  | { type: "CASE_CAPTURED"; data: CaseDetails }
  | { type: "DEVICE_CAPTURED"; data: DeviceDetails }
  | { type: "GET_STATUS" }
  | {
      type: "STATUS_RESPONSE";
      caseDetails: CaseDetails | null;
      deviceDetails: DeviceDetails | null;
    }
  | { type: "CLEAR_DATA" };
