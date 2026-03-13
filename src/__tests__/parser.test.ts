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

  it("handles ServiceNow labels from real incidents", () => {
    const text = `Name: Duane Sept
User ID: E10665543
Asset Tag: usm206531
Preferred Contact Method: Cell / MS Teams
Callback Number: +1 425-210-0421
Short Description: Lost or Stolen phone
Email: DUANE.SEPT@collins.com
Location: Onsite`;

    const result = parseDescription(text);

    expect(result.name).toBe("Duane Sept");
    expect(result.email).toBe("DUANE.SEPT@collins.com");
    expect(result.callback).toBe("+1 425-210-0421");
    expect(result.adx).toBe("E10665543");
    expect(result.issueMessage).toBe("Lost or Stolen phone");
  });

  it("handles description-of-the-issue labels", () => {
    const text = `Name: David Ortegon
Asset Tag: RMDU0043618
Phone: 520-330-7589
Email: david.a.ortegon@rtx.com

Description of the Issue:
The user reported that their company iPhone 13 is experiencing multiple communication issues.
The user has rebooted the phone multiple times, but the issue persists.`;

    const result = parseDescription(text);

    expect(result.name).toBe("David Ortegon");
    expect(result.email).toBe("david.a.ortegon@rtx.com");
    expect(result.callback).toBe("520-330-7589");
    expect(result.issueMessage).toContain("company iPhone 13 is experiencing multiple communication issues");
  });

  it("parses unlabeled description blocks used in ServiceNow", () => {
    const text = `Michael Belanger
E10251700@adxuser.com
Michael.Belanger@collins.com
Enrollment of upgrade device`;

    const result = parseDescription(text);

    expect(result.name).toBe("Michael Belanger");
    expect(result.adx).toBe("E10251700");
    expect(result.email).toBe("Michael.Belanger@collins.com");
    expect(result.issueMessage).toBe("Enrollment of upgrade device");
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
