import { describe, it, expect } from "vitest";
import {
  parseDevicePage,
  parseUserInfo,
  findValueAfterLabel,
  findSummaryLine,
  extractSerialNumber,
  extractDeviceModel,
  extractMdn,
  extractIosVersion,
  extractOwnershipType,
  extractUserName,
  extractUserEmail,
  extractAdx,
} from "../content/ivanti/parser";

// Real innerText captured from a MobileIron device details page (iPhone 16, Status: Active).
const PAGE_IPHONE16 = `Ivanti Neurons for MDM Apple iTunes Integration Upgrade Maintenance for NA
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
Ownership
Company Owned`;

// Real innerText from second device (iPhone 12, Status: Retire Pending).
const PAGE_IPHONE12 = `Marcus Falz
|
E40018502@adxuser.com
|
iPhone 12 | Phone #: +16575358128 | Space: Default Space |  Status: Retire Pending | Cancel |  Last Check-in: 1 day 1 hour ago |  Client Last Check-in: 1 day 4 hours ago
 
 
Overview
Configurations
Installed Apps
Available Apps
AppConnect Apps
Policies
Certificates
Logs
Legal Owner
N/A
Device Location
Disabled in RTX - Corporate Privacy
Manufacturer
Apple
Model Number
MGFL3LL/A
Serial Number
DX3HHL4N0DXP
OS/Version
iOS 26.3.1
Ownership
Company Owned
Phone Number
+16575358128`;

describe("Ivanti MobileIron parser", () => {
  describe("findValueAfterLabel", () => {
    it("finds a value on the line after the label", () => {
      expect(findValueAfterLabel(PAGE_IPHONE16, "Serial Number")).toBe("J403103NPY");
    });

    it("returns null when value is N/A", () => {
      expect(findValueAfterLabel(PAGE_IPHONE16, "Legal Owner")).toBeNull();
    });

    it("returns null when label not found", () => {
      expect(findValueAfterLabel(PAGE_IPHONE16, "Nonexistent Field")).toBeNull();
    });

    it("matches case-insensitively", () => {
      expect(findValueAfterLabel(PAGE_IPHONE16, "serial number")).toBe("J403103NPY");
    });
  });

  describe("findSummaryLine", () => {
    it("finds summary bar with Status: Active", () => {
      const line = findSummaryLine(PAGE_IPHONE16);
      expect(line).toContain("iPhone 16");
      expect(line).toContain("Status: Active");
    });

    it("finds summary bar with Status: Retire Pending", () => {
      const line = findSummaryLine(PAGE_IPHONE12);
      expect(line).toContain("iPhone 12");
      expect(line).toContain("Retire Pending");
    });
  });

  describe("individual field extractors", () => {
    it("extracts serial number", () => {
      expect(extractSerialNumber(PAGE_IPHONE16)).toBe("J403103NPY");
    });

    it("extracts device model from summary bar (Active)", () => {
      expect(extractDeviceModel(PAGE_IPHONE16)).toBe("iPhone 16");
    });

    it("extracts device model from summary bar (Retire Pending)", () => {
      expect(extractDeviceModel(PAGE_IPHONE12)).toBe("iPhone 12");
    });

    it("returns null for MDN when Phone # is N/A", () => {
      expect(extractMdn(PAGE_IPHONE16)).toBeNull();
    });

    it("extracts MDN from summary bar", () => {
      expect(extractMdn(PAGE_IPHONE12)).toBe("+16575358128");
    });

    it("extracts iOS version from OS/Version label", () => {
      expect(extractIosVersion(PAGE_IPHONE16)).toBe("iOS 26.3.1");
    });

    it("extracts Corp ownership from 'Company Owned'", () => {
      expect(extractOwnershipType(PAGE_IPHONE16)).toBe("Corp");
    });

    it("extracts BYOD when ownership says BYOD", () => {
      const text = PAGE_IPHONE16.replace("Company Owned", "BYOD");
      expect(extractOwnershipType(text)).toBe("BYOD");
    });

    it("maps 'User Owned' to BYOD", () => {
      const text = PAGE_IPHONE16.replace("Company Owned", "User Owned");
      expect(extractOwnershipType(text)).toBe("BYOD");
    });
  });

  describe("user info extraction", () => {
    it("extracts user name from page header", () => {
      expect(extractUserName(PAGE_IPHONE16)).toBe("Marcus Falz");
    });

    it("extracts user email", () => {
      expect(extractUserEmail(PAGE_IPHONE16)).toBe("E40018502@adxuser.com");
    });

    it("extracts ADX from email prefix", () => {
      expect(extractAdx(PAGE_IPHONE16)).toBe("E40018502");
    });

    it("extracts user info from second device page too", () => {
      expect(extractUserName(PAGE_IPHONE12)).toBe("Marcus Falz");
      expect(extractUserEmail(PAGE_IPHONE12)).toBe("E40018502@adxuser.com");
      expect(extractAdx(PAGE_IPHONE12)).toBe("E40018502");
    });
  });

  describe("parseDevicePage (full integration)", () => {
    it("parses all fields from iPhone 16 page", () => {
      const result = parseDevicePage(PAGE_IPHONE16);
      expect(result.serialNumber).toBe("J403103NPY");
      expect(result.deviceModel).toBe("iPhone 16");
      expect(result.iosVersion).toBe("iOS 26.3.1");
      expect(result.ownershipType).toBe("Corp");
      expect(result.mdn).toBeNull();
    });

    it("parses all fields from iPhone 12 page (Retire Pending status)", () => {
      const result = parseDevicePage(PAGE_IPHONE12);
      expect(result.serialNumber).toBe("DX3HHL4N0DXP");
      expect(result.deviceModel).toBe("iPhone 12");
      expect(result.iosVersion).toBe("iOS 26.3.1");
      expect(result.ownershipType).toBe("Corp");
      expect(result.mdn).toBe("+16575358128");
    });

    it("handles iPad device model", () => {
      const text = PAGE_IPHONE16.replace(
        "iPhone 16 | Phone #: N/A",
        "iPad Pro 12.9 | Phone #: N/A",
      );
      const result = parseDevicePage(text);
      expect(result.deviceModel).toBe("iPad Pro 12.9");
    });

    it("falls back to Model Number if no summary bar match", () => {
      const text = PAGE_IPHONE16.replace(
        /iPhone 16 \| Phone #:.*Client Last Check-in: N\/A/,
        "No summary here",
      );
      const result = parseDevicePage(text);
      expect(result.deviceModel).toBe("MYAP3LL/A");
    });
  });

  describe("parseUserInfo", () => {
    it("returns name and ADX from device page (email is null — comes from ServiceNow)", () => {
      const result = parseUserInfo(PAGE_IPHONE16);
      expect(result.name).toBe("Marcus Falz");
      expect(result.email).toBeNull();
      expect(result.adx).toBe("E40018502");
      expect(result.callback).toBeNull();
      expect(result.issueMessage).toBeNull();
    });
  });
});
