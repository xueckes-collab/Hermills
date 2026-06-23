import { describe, expect, it } from "vitest";
import { letterRowsToCsv } from "../../apps/renderer/src/outreach-import.js";

describe("letterRowsToCsv", () => {
  it("keeps email-first pasted rows aligned with the placeholder format", () => {
    const csv = letterRowsToCsv("buyer@example.com, https://example.com, John Smith");

    expect(csv).toBe([
      "company,email,website,contactName",
      "Example,buyer@example.com,https://example.com,John Smith"
    ].join("\n"));
  });
});
