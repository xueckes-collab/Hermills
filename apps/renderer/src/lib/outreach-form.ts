const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const DOMAIN_PATTERN = /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i;

export type SingleWriteValidation = {
  ready: boolean;
  emailError: string;
  websiteError: string;
  normalizedWebsite: string;
  disabledHint: string;
};

export function normalizeCustomerWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (HAS_PROTOCOL_PATTERN.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isValidCustomerEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidCustomerWebsite(value: string): boolean {
  const normalized = normalizeCustomerWebsite(value);
  if (!normalized) return false;
  return DOMAIN_PATTERN.test(normalized);
}

export function getSingleWriteValidation(email: string, website: string): SingleWriteValidation {
  const normalizedWebsite = normalizeCustomerWebsite(website);
  const emailReady = isValidCustomerEmail(email);
  const websiteReady = isValidCustomerWebsite(website);
  const emailError = emailReady ? "" : "请输入有效邮箱，例如 buyer@company.com";
  const websiteError = websiteReady ? "" : "请输入客户官网，例如 https://company.com";

  return {
    ready: emailReady && websiteReady,
    emailError,
    websiteError,
    normalizedWebsite,
    disabledHint: emailReady && websiteReady ? "" : "请输入有效邮箱和客户官网后开始分析",
  };
}
