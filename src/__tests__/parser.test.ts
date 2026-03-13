import { describe, it, expect } from "vitest";
import { parseDescription } from "../content/servicenow/parser";

describe("parseDescription", () => {
  it("parses a full example Description field", () => {
    const text = `Name: Jaspal Minhas
Email: Jaspal.Minhas@collins.com
Callback: 6477631081
ADX: E10940165
Issue / Error message: The user called in because his company phone is no longer turning on`;

    const result = parseDescription(text);

    expect(result.name).toBe("Jaspal Minhas");
    expect(result.email).toBe("Jaspal.Minhas@collins.com");
    expect(result.callback).toBe("6477631081");
    expect(result.adx).toBe("E10940165");
    expect(result.issueMessage).toBe(
      "The user called in because his company phone is no longer turning on"
    );
  });

  it("handles alternative label names", () => {
    const text = `Caller: John Doe
E-mail: john@example.com
CB: 5551234567
Employee ID: E99999999
Error message: Cannot activate device`;

    const result = parseDescription(text);

    expect(result.name).toBe("John Doe");
    expect(result.email).toBe("john@example.com");
    expect(result.callback).toBe("5551234567");
    expect(result.adx).toBe("E99999999");
    expect(result.issueMessage).toBe("Cannot activate device");
  });

  it("returns null for missing fields", () => {
    const text = `Name: Jane Smith
Issue / Error message: Screen is cracked`;

    const result = parseDescription(text);

    expect(result.name).toBe("Jane Smith");
    expect(result.email).toBeNull();
    expect(result.callback).toBeNull();
    expect(result.adx).toBeNull();
    expect(result.issueMessage).toBe("Screen is cracked");
  });

  it("handles empty input", () => {
    const result = parseDescription("");
    expect(result.name).toBeNull();
    expect(result.email).toBeNull();
    expect(result.callback).toBeNull();
    expect(result.adx).toBeNull();
    expect(result.issueMessage).toBeNull();
  });

  it("handles multi-line issue messages", () => {
    const text = `Name: Test User
ADX: E12345678
Issue: The phone keeps restarting
After the latest update was installed
The battery also drains fast
Callback: 1112223333`;

    const result = parseDescription(text);

    expect(result.name).toBe("Test User");
    expect(result.adx).toBe("E12345678");
    expect(result.callback).toBe("1112223333");
    // The issue should capture everything until the next label
    expect(result.issueMessage).toContain("The phone keeps restarting");
  });
});
