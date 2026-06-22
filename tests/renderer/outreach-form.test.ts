import { describe, expect, it } from "vitest";
import {
  getSingleWriteValidation,
  isValidCustomerEmail,
  normalizeCustomerWebsite,
} from "../../apps/renderer/src/lib/outreach-form.js";

describe("outreach form validation", () => {
  it("normalizes pasted customer websites without making users type protocol", () => {
    expect(normalizeCustomerWebsite("spcflooringstore.com")).toBe("https://spcflooringstore.com");
    expect(normalizeCustomerWebsite(" https://example.com/products ")).toBe("https://example.com/products");
    expect(normalizeCustomerWebsite("ftp://legacy.example.com")).toBe("ftp://legacy.example.com");
  });

  it("accepts business email shape and rejects incomplete input", () => {
    expect(isValidCustomerEmail("buyer@company.com")).toBe(true);
    expect(isValidCustomerEmail(" sales+eu@company.co.uk ")).toBe(true);
    expect(isValidCustomerEmail("buyer")).toBe(false);
    expect(isValidCustomerEmail("buyer@company")).toBe(false);
    expect(isValidCustomerEmail("buyer company.com")).toBe(false);
  });

  it("requires valid email and website before single write can start", () => {
    expect(getSingleWriteValidation("", "")).toEqual({
      ready: false,
      emailError: "请输入有效邮箱，例如 buyer@company.com",
      websiteError: "请输入客户官网，例如 https://company.com",
      normalizedWebsite: "",
      disabledHint: "请输入有效邮箱和客户官网后开始分析",
    });

    expect(getSingleWriteValidation("buyer", "company.com")).toMatchObject({
      ready: false,
      emailError: "请输入有效邮箱，例如 buyer@company.com",
      websiteError: "",
      normalizedWebsite: "https://company.com",
    });

    expect(getSingleWriteValidation("buyer@company.com", "company.com")).toEqual({
      ready: true,
      emailError: "",
      websiteError: "",
      normalizedWebsite: "https://company.com",
      disabledHint: "",
    });
  });
});
