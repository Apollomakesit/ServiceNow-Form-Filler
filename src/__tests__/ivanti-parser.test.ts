import { describe, it, expect } from "vitest";
import {
  parseDevicePage,
  findValueAfterLabel,
  findSummaryLine,
  extractSerialNumber,
  extractDeviceModel,
  extractMdn,
  extractIosVersion,
  extractOwnershipType,
} from "../content/ivanti/parser";

// Real innerText captured from a MobileIron device details page.
// Sensitive values replaced with fictional data matching the format.
const REAL_PAGE_TEXT = `Ivanti Neurons for MDM Apple iTunes Integration Upgrade Maintenance for NA
From Wed, 18 Mar 2026 07:30:00 AM to Wed, 18 Mar 2026 09:30:00 AM. Learn more
Subscribe
Users
Devices
Apps
Content
Admin
Account
Collapse
← Back to list
Devices / Devices / Details
Marcus Falz
|
E40018502@adxuser.com
|
iPhone 16 | Phone #: N/A | Space: Default Space |  Status: Active |  Last Check-in: 31 minutes 50 seconds ago |  Client Last Check-in: N/A
 
 
Overview
Configurations
Installed Apps
Available Apps
AppConnect Apps
Policies
Certificates
Logs
General
Legal Owner
N/A
Device Location
Disabled in RTX - Corporate Privacy
Manufacturer
Apple
Wi-Fi MAC Address
4c:cd:b6:91:d7:1d
Wi-Fi MAC Address for inventory
N/A
Minimum Required Wi-Fi Security Level
Not Set
System Update Status
N/A
IP Address
N/A
Public IP Address
N/A
Network Tethered
Yes
Model Number
MYAP3LL/A
Serial Number
J403103NPY
Alternative Serial Number
N/A
Uptime
N/A
Storage Usage
Internal:
86.57 GB available of 128.00 GB
OS/Version
iOS 26.3.1
OS Build Version
23D8133
Pending OS Version
N/A
Pending OS Build Version
N/A
Beta Enrollment
N/A
Supplemental Build Version
23D8133
Supplemental OS/Version Extra
N/A
Build ID
N/A
Apple Silicon Device
No
System Update
N/A
Android AOSP Enabled
No
Zebra Patch Version
N/A
Firmware Version
N/A
Device Source
CLOUD
Multi-User Mode
No
Time Zone
America/Los_Angeles
Last Known Device Unlock Passcode
N/A
Settings
Device Name
iPhone
Device Identifier
00008140-000864663678801C
Device GUID
478034d8-b56d-4add-9919-e045cd65a068
Automated Device Enrollment Enabled
Yes
Automated Device Enrollment Enrolled
Yes
User Enrollment Enrolled
No
Registered Managed Apple ID
N/A
 Paired Devices
Language
N/A
MDM Device Identifier
00008140-000864663678801C
Device Client ID
J403103NPY
Enrollment Specific ID
N/A
Client App Version
N/A
Client App Bundle ID
N/A
Client Registered
No
EAS Device Identifiers
1C59KOEE915ND5RS3HCF3P0Q70
Activation Lock Bypass Code
60QR3-FVF03-WH4J-6P77-LE0A-R5G4
Ownership
Company Owned
Activation Lock Enabled
No
Apple Declarative Management Enabled
Yes
iTunes Account Active
Yes
Device Location Service Enabled
No
Quarantined
No
Sentry Blocked
No
Access Blocked
No
Compliance Action Blocked
No
APNS Capable
Yes
Last backup to iCloud
iCloud backup disabled by administrator
 Supervised Mode
Yes
Passcode Lock Grace Period
0
Mobile Threat Defense
MTD Activation Status
N/A
Anti Phishing native status
N/A
Anti Phishing VPN status
N/A
Windows Information Protection
WIP
OFF
App Locker Configured
No
EDP Mandatory Settings
Not Set
Telephony
Device Service Subscriptions
IMSI
N/A
Home MCC
311
Home MNC
480
Current Country Name
United States
Home Country Name
United States
Cellular Technology
GSM
Roaming
OFF
Data Roaming
Voice Roaming
MEID
N/A`;

describe("Ivanti MobileIron parser", () => {
  describe("findValueAfterLabel", () => {
    it("finds a value on the line after the label", () => {
      expect(findValueAfterLabel(REAL_PAGE_TEXT, "Serial Number")).toBe("J403103NPY");
    });

    it("returns null when value is N/A", () => {
      expect(findValueAfterLabel(REAL_PAGE_TEXT, "Legal Owner")).toBeNull();
    });

    it("returns null when label not found", () => {
      expect(findValueAfterLabel(REAL_PAGE_TEXT, "Nonexistent Field")).toBeNull();
    });

    it("matches case-insensitively", () => {
      expect(findValueAfterLabel(REAL_PAGE_TEXT, "serial number")).toBe("J403103NPY");
    });
  });

  describe("findSummaryLine", () => {
    it("finds the pipe-delimited summary bar", () => {
      const line = findSummaryLine(REAL_PAGE_TEXT);
      expect(line).toContain("iPhone 16");
      expect(line).toContain("Status: Active");
    });
  });

  describe("individual field extractors", () => {
    it("extracts serial number", () => {
      expect(extractSerialNumber(REAL_PAGE_TEXT)).toBe("J403103NPY");
    });

    it("extracts device model from summary bar", () => {
      expect(extractDeviceModel(REAL_PAGE_TEXT)).toBe("iPhone 16");
    });

    it("returns null for MDN when Phone # is N/A", () => {
      expect(extractMdn(REAL_PAGE_TEXT)).toBeNull();
    });

    it("extracts MDN when a real phone number is present", () => {
      const text = REAL_PAGE_TEXT.replace("Phone #: N/A", "Phone #: +12125551234");
      expect(extractMdn(text)).toBe("+12125551234");
    });

    it("extracts iOS version from OS/Version label", () => {
      expect(extractIosVersion(REAL_PAGE_TEXT)).toBe("iOS 26.3.1");
    });

    it("extracts Corp ownership from 'Company Owned'", () => {
      expect(extractOwnershipType(REAL_PAGE_TEXT)).toBe("Corp");
    });

    it("extracts BYOD when ownership says BYOD", () => {
      const text = REAL_PAGE_TEXT.replace("Company Owned", "BYOD");
      expect(extractOwnershipType(text)).toBe("BYOD");
    });
  });

  describe("parseDevicePage (full integration)", () => {
    it("parses all available fields from a real page", () => {
      const result = parseDevicePage(REAL_PAGE_TEXT);
      expect(result.serialNumber).toBe("J403103NPY");
      expect(result.deviceModel).toBe("iPhone 16");
      expect(result.iosVersion).toBe("iOS 26.3.1");
      expect(result.ownershipType).toBe("Corp");
      // MDN is N/A on this page
      expect(result.mdn).toBeNull();
    });

    it("parses a page with a real phone number", () => {
      const text = REAL_PAGE_TEXT.replace("Phone #: N/A", "Phone #: +18005551234");
      const result = parseDevicePage(text);
      expect(result.mdn).toBe("+18005551234");
    });

    it("handles iPad device model", () => {
      const text = REAL_PAGE_TEXT.replace(
        "iPhone 16 | Phone #: N/A",
        "iPad Pro 12.9 | Phone #: N/A",
      );
      const result = parseDevicePage(text);
      expect(result.deviceModel).toBe("iPad Pro 12.9");
    });

    it("falls back to Model Number if no summary bar match", () => {
      // Remove the summary bar line entirely
      const text = REAL_PAGE_TEXT.replace(
        /iPhone 16 \| Phone #:.*Client Last Check-in: N\/A/,
        "No summary here",
      );
      const result = parseDevicePage(text);
      expect(result.deviceModel).toBe("MYAP3LL/A");
    });
  });
});
