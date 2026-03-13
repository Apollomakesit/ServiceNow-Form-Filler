import type { ExtensionMessage } from "../shared/messages";
import {
  saveCaseDetails,
  saveDeviceDetails,
  loadCaseDetails,
  loadDeviceDetails,
  clearAll,
} from "../shared/storage";

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case "CASE_CAPTURED":
        saveCaseDetails(message.data).then(() => sendResponse({ ok: true }));
        return true; // async response

      case "DEVICE_CAPTURED":
        saveDeviceDetails(message.data).then(() => sendResponse({ ok: true }));
        return true;

      case "GET_STATUS":
        Promise.all([loadCaseDetails(), loadDeviceDetails()]).then(
          ([caseDetails, deviceDetails]) => {
            sendResponse({ type: "STATUS_RESPONSE", caseDetails, deviceDetails });
          }
        );
        return true;

      case "CLEAR_DATA":
        clearAll().then(() => sendResponse({ ok: true }));
        return true;
    }
  }
);
