import { describe, it, expect } from "vitest";
import { mergeToTemplate, formatWorkNotes } from "../shared/formatter";
import type { CaseDetails, DeviceDetails, WorkNotesTemplate } from "../shared/schemas";

describe("mergeToTemplate", () => {
  it("merges full case and device details", () => {
    const caseData: CaseDetails = {
      name: "Jaspal Minhas",
      email: "Jaspal.Minhas@collins.com",
      callback: "6477631081",
      adx: "E10940165",
      issueMessage: "Phone is not turning on",
    };
    const deviceData: DeviceDetails = {
      ownershipType: "Corp",
      deviceModel: "iPhone 12",
      serialNumber: "H4YJ82YB0F00",
      mdn: "+12892188428",
      iosVersion: "26.3.1",
    };

    const result = mergeToTemplate(caseData, deviceData);

    expect(result.name).toBe("Jaspal Minhas");
    expect(result.email).toBe("Jaspal.Minhas@collins.com");
    expect(result.callback).toBe("6477631081");
    expect(result.adx).toBe("E10940165");
    expect(result.corpOrByod).toBe("Corp");
    expect(result.deviceModel).toBe("iPhone 12");
    expect(result.serialNumber).toBe("H4YJ82YB0F00");
    expect(result.mdn).toBe("+12892188428");
    expect(result.iosVersion).toBe("26.3.1");
    expect(result.issueMessage).toBe("Phone is not turning on");
    expect(result.troubleshoot).toBeNull();
    expect(result.escalated).toBeNull();
  });

  it("handles null case and device gracefully", () => {
    const result = mergeToTemplate(null, null);
    expect(result.name).toBeNull();
    expect(result.corpOrByod).toBeNull();
  });
});

describe("formatWorkNotes", () => {
  it("produces exact template format with full data", () => {
    const template: WorkNotesTemplate = {
      name: "Jaspal Minhas",
      email: "Jaspal.Minhas@collins.com",
      callback: "6477631081",
      adx: "E10940165",
      corpOrByod: "Corp",
      deviceModel: "iPhone 12",
      serialNumber: "H4YJ82YB0F00",
      mdn: "+12892188428",
      iosVersion: "26.3.1",
      issueMessage: "Phone is not turning on",
      troubleshoot: "",
      escalated: "Yes/No",
    };

    const output = formatWorkNotes(template);

    expect(output).toBe(
      [
        "Name: Jaspal Minhas",
        "Email: Jaspal.Minhas@collins.com",
        "Callback: 6477631081",
        "ADX: E10940165",
        "Corp/BYOD: Corp",
        "Device Model: iPhone 12",
        "Serial number: H4YJ82YB0F00",
        "MDN: +12892188428",
        "iOS Version: 26.3.1",
        "Issue / Error message: Phone is not turning on",
        "Troubleshoot: ",
        "Escalated: Yes/No",
      ].join("\n")
    );
  });

  it("uses empty strings for null fields", () => {
    const template: WorkNotesTemplate = {
      name: null,
      email: null,
      callback: null,
      adx: null,
      corpOrByod: null,
      deviceModel: null,
      serialNumber: null,
      mdn: null,
      iosVersion: null,
      issueMessage: null,
      troubleshoot: null,
      escalated: null,
    };

    const output = formatWorkNotes(template);

    expect(output).toContain("Name: ");
    expect(output).toContain("Email: ");
    // Verify each line ends with ": " (empty value)
    for (const line of output.split("\n")) {
      expect(line).toMatch(/^.+: $/);
    }
  });
});
