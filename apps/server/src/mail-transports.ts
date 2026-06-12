import nodemailer, { type SendMailOptions } from "nodemailer";
import type { OutreachSenderAccount } from "@hermills/core";

export type MailTransportProvider = "smtp" | "gmail" | "microsoft-graph" | "zoho" | "mock" | "service-api" | "tencent-cloud-ses" | "aliyun-directmail" | "custom-http";

export interface ApiMailCredential extends Record<string, unknown> {
  token?: string;
  accessToken?: string;
  access_token?: string;
  apiKey?: string;
  api_key?: string;
}

export interface MailTransportSendResult {
  provider: MailTransportProvider;
  channel: OutreachSenderAccount["sendChannel"];
  messageId?: string;
  requestId?: string;
  statusCode?: number;
  accepted?: string[];
}

export interface MailTransportErrorDetail {
  provider?: MailTransportProvider;
  channel?: OutreachSenderAccount["sendChannel"];
  code?: string;
  statusCode?: number;
  statusText?: string;
  requestId?: string;
  responseMessage?: string;
}

export class MailTransportError extends Error {
  readonly detail: MailTransportErrorDetail;

  constructor(message: string, detail: MailTransportErrorDetail = {}) {
    super(message);
    this.name = "MailTransportError";
    this.detail = detail;
  }
}

export function isApiMailSender(sender: OutreachSenderAccount): boolean {
  return normalizeProvider(sender.provider, sender.sendChannel) === "mock" || (sender.sendChannel ?? "smtp") !== "smtp";
}

export function parseApiMailCredential(secret: string | undefined): ApiMailCredential | undefined {
  const trimmed = secret?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const credential = parsed as ApiMailCredential;
        return { ...credential, token: apiCredentialDirectToken(credential) };
      }
    } catch {
      throw new MailTransportError("Mail API credential JSON is invalid.", { code: "invalid_api_credential_json" });
    }
  }
  return { token: trimmed };
}

export async function verifyApiMailTransport(input: {
  sender: OutreachSenderAccount;
  credential?: ApiMailCredential;
}): Promise<MailTransportSendResult> {
  const provider = normalizeProvider(input.sender.provider, input.sender.sendChannel);
  const channel = input.sender.sendChannel ?? "oauth-api";
  if (provider === "mock") {
    return { provider, channel, messageId: "mock-verify" };
  }
  if (channel === "service-api") {
    assertServiceApiCredential(input.sender, input.credential);
    assertImplementedServiceApiProvider(input.sender, provider);
    return { provider: provider === "smtp" ? "service-api" : provider, channel };
  }
  assertSupportedApiProvider(input.sender, provider);
  assertOAuthApiCredential(input.sender, provider, input.credential);
  return { provider, channel };
}

export async function sendApiMail(input: {
  sender: OutreachSenderAccount;
  message: SendMailOptions;
  credential?: ApiMailCredential;
  fetchImpl?: typeof fetch;
}): Promise<MailTransportSendResult> {
  const provider = normalizeProvider(input.sender.provider, input.sender.sendChannel);
  if (provider === "mock") return mockSend(input.sender, input.message);
  const fetchImpl = input.fetchImpl ?? fetch;
  const message = normalizeMessage(input.sender, input.message);
  const channel = input.sender.sendChannel ?? "oauth-api";

  if (channel === "service-api") {
    return sendServiceApi({ sender: input.sender, message, credential: input.credential, fetchImpl, provider });
  }

  assertSupportedApiProvider(input.sender, provider);
  assertOAuthApiCredential(input.sender, provider, input.credential);
  const token = await resolveApiAccessToken({ sender: input.sender, provider, credential: input.credential, fetchImpl });

  if (provider === "gmail") {
    return sendGmail({ sender: input.sender, message, token, fetchImpl });
  }
  if (provider === "microsoft-graph") {
    return sendMicrosoftGraph({ sender: input.sender, message, token, fetchImpl });
  }
  if (provider === "zoho") {
    return sendZoho({ sender: input.sender, message, token, fetchImpl });
  }
  throw new MailTransportError("Unsupported mail API provider.", {
    provider,
    channel: input.sender.sendChannel ?? "oauth-api",
    code: "unsupported_provider"
  });
}

export async function createSmtpTransporter(input: {
  sender: OutreachSenderAccount;
  password?: string;
}) {
  const host = input.sender.host?.trim();
  if (!host) {
    throw new MailTransportError("SMTP host is required for SMTP sender accounts.", {
      provider: "smtp",
      channel: "smtp",
      code: "missing_smtp_host"
    });
  }
  const port = input.sender.port;
  const secure = input.sender.secure;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    name: "hermills.local",
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    tls: { servername: host },
    authMethod: input.password ? "PLAIN" : undefined,
    auth: input.password ? { user: input.sender.username ?? input.sender.email, pass: input.password } : undefined
  });
}

export function normalizeProvider(value: string | undefined, channel: OutreachSenderAccount["sendChannel"] = "smtp"): MailTransportProvider {
  const normalized = (value ?? "custom").trim().toLowerCase();
  if (["gmail", "google", "google-gmail"].includes(normalized)) return "gmail";
  if (["microsoft", "microsoft-graph", "graph", "outlook", "office365", "office-365"].includes(normalized)) return "microsoft-graph";
  if (["zoho", "zoho-mail", "zohomail"].includes(normalized)) return "zoho";
  if (["tencent", "tencent-exmail", "qq-exmail", "exmail", "tencent-cloud", "tencent-cloud-ses", "qq"].includes(normalized)) return channel === "service-api" ? "tencent-cloud-ses" : "smtp";
  if (["aliyun", "ali", "alibaba", "alibaba-mail", "alimail", "aliyun-mail", "aliyun-directmail", "mxhichina"].includes(normalized)) return channel === "service-api" ? "aliyun-directmail" : "smtp";
  if (["custom-http", "http-api", "custom-service-api"].includes(normalized)) return "custom-http";
  if (normalized === "custom" && channel === "service-api") return "custom-http";
  if (["mock", "test"].includes(normalized)) return "mock";
  return "smtp";
}

type NormalizedMailMessage = {
  from: string;
  fromAddress: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  html?: string;
};

async function sendGmail(input: {
  sender: OutreachSenderAccount;
  message: NormalizedMailMessage;
  token: string;
  fetchImpl: typeof fetch;
}): Promise<MailTransportSendResult> {
  const account = encodeURIComponent(input.sender.oauthApi?.accountId || input.sender.serviceApi?.accountId || "me");
  const url = `https://gmail.googleapis.com/gmail/v1/users/${account}/messages/send`;
  const raw = Buffer.from(buildMimeMessage(input.message), "utf8").toString("base64url");
  const response = await postJson({
    provider: "gmail",
    channel: input.sender.sendChannel ?? "oauth-api",
    fetchImpl: input.fetchImpl,
    url,
    authHeader: `Bearer ${input.token}`,
    body: { raw },
    acceptedStatuses: [200]
  });
  return {
    provider: "gmail",
    channel: input.sender.sendChannel ?? "oauth-api",
    statusCode: response.statusCode,
    requestId: response.requestId,
    messageId: stringFromJson(response.json, ["id", "message.id"]),
    accepted: input.message.to
  };
}

async function sendMicrosoftGraph(input: {
  sender: OutreachSenderAccount;
  message: NormalizedMailMessage;
  token: string;
  fetchImpl: typeof fetch;
}): Promise<MailTransportSendResult> {
  const accountId = input.sender.oauthApi?.accountId || input.sender.serviceApi?.accountId;
  const path = accountId ? `/users/${encodeURIComponent(accountId)}/sendMail` : "/me/sendMail";
  const response = await postJson({
    provider: "microsoft-graph",
    channel: input.sender.sendChannel ?? "oauth-api",
    fetchImpl: input.fetchImpl,
    url: `https://graph.microsoft.com/v1.0${path}`,
    authHeader: `Bearer ${input.token}`,
    body: {
      message: {
        subject: input.message.subject,
        body: {
          contentType: input.message.html ? "HTML" : "Text",
          content: input.message.html || input.message.text
        },
        toRecipients: graphRecipients(input.message.to),
        ccRecipients: graphRecipients(input.message.cc),
        bccRecipients: graphRecipients(input.message.bcc)
      },
      saveToSentItems: true
    },
    acceptedStatuses: [202]
  });
  return {
    provider: "microsoft-graph",
    channel: input.sender.sendChannel ?? "oauth-api",
    statusCode: response.statusCode,
    requestId: response.requestId,
    messageId: response.requestId,
    accepted: input.message.to
  };
}

async function sendZoho(input: {
  sender: OutreachSenderAccount;
  message: NormalizedMailMessage;
  token: string;
  fetchImpl: typeof fetch;
}): Promise<MailTransportSendResult> {
  const accountId = input.sender.oauthApi?.accountId || input.sender.serviceApi?.accountId;
  if (!accountId) {
    throw new MailTransportError("Zoho Mail API requires accountId.", {
      provider: "zoho",
      channel: input.sender.sendChannel ?? "oauth-api",
      code: "missing_zoho_account_id"
    });
  }
  const baseUrl = normalizeApiBaseUrl(
    input.sender.oauthApi?.apiBaseUrl ?? input.sender.serviceApi?.apiBaseUrl ?? input.sender.host,
    "https://mail.zoho.com"
  );
  const response = await postJson({
    provider: "zoho",
    channel: input.sender.sendChannel ?? "oauth-api",
    fetchImpl: input.fetchImpl,
    url: `${baseUrl}/api/accounts/${encodeURIComponent(accountId)}/messages`,
    authHeader: `Zoho-oauthtoken ${input.token}`,
    body: {
      fromAddress: input.message.fromAddress,
      toAddress: input.message.to.join(","),
      ccAddress: input.message.cc.length ? input.message.cc.join(",") : undefined,
      bccAddress: input.message.bcc.length ? input.message.bcc.join(",") : undefined,
      subject: input.message.subject,
      content: input.message.html || input.message.text,
      mailFormat: input.message.html ? "html" : "plaintext"
    },
    acceptedStatuses: [200, 201, 202]
  });
  return {
    provider: "zoho",
    channel: input.sender.sendChannel ?? "oauth-api",
    statusCode: response.statusCode,
    requestId: response.requestId,
    messageId: stringFromJson(response.json, ["data.messageId", "data.id", "messageId", "id"]),
    accepted: input.message.to
  };
}

function mockSend(sender: OutreachSenderAccount, message: SendMailOptions): MailTransportSendResult {
  const normalized = normalizeMessage(sender, message);
  return {
    provider: "mock",
    channel: sender.sendChannel ?? "service-api",
    messageId: `mock-${Date.now()}`,
    accepted: normalized.to
  };
}

function assertSupportedApiProvider(sender: OutreachSenderAccount, provider: MailTransportProvider): void {
  if (provider === "gmail" || provider === "microsoft-graph" || provider === "zoho") return;
  throw new MailTransportError("Unsupported mail API provider.", {
    provider,
    channel: sender.sendChannel ?? "oauth-api",
    code: "unsupported_provider"
  });
}

function assertOAuthApiCredential(
  sender: OutreachSenderAccount,
  provider: MailTransportProvider,
  credential?: ApiMailCredential
): void {
  if (!credentialCanResolveAccessToken(credential)) {
    throw new MailTransportError("Mail API credential needs an access token, API key, or refresh token client credentials.", {
      provider,
      channel: sender.sendChannel ?? "oauth-api",
      code: "missing_api_token"
    });
  }
  if (provider === "zoho" && !(sender.oauthApi?.accountId || sender.serviceApi?.accountId)) {
    throw new MailTransportError("Zoho Mail API requires accountId.", {
      provider,
      channel: sender.sendChannel ?? "oauth-api",
      code: "missing_zoho_account_id"
    });
  }
}

function assertServiceApiCredential(sender: OutreachSenderAccount, credential?: ApiMailCredential): void {
  const endpoint = serviceApiEndpoint(sender, credential);
  const token = apiCredentialDirectToken(credential);
  const headers = credentialRecordField(credential, "headers");
  if (!token && !Object.keys(headers).length) {
    throw new MailTransportError("Service API credential needs a token, API key, or headers.", {
      provider: normalizeProvider(sender.provider, sender.sendChannel),
      channel: "service-api",
      code: "missing_service_api_credential"
    });
  }
  if (!endpoint) {
    throw new MailTransportError("Service API endpoint is required.", {
      provider: normalizeProvider(sender.provider, sender.sendChannel),
      channel: "service-api",
      code: "missing_service_api_endpoint"
    });
  }
}

async function resolveApiAccessToken(input: {
  sender: OutreachSenderAccount;
  provider: MailTransportProvider;
  credential?: ApiMailCredential;
  fetchImpl: typeof fetch;
}): Promise<string> {
  const direct = apiCredentialDirectToken(input.credential);
  if (direct) return direct;
  const refreshToken = credentialStringField(input.credential, "refreshToken", "refresh_token");
  const clientId = credentialStringField(input.credential, "clientId", "client_id");
  const clientSecret = credentialStringField(input.credential, "clientSecret", "client_secret");
  if (!refreshToken || !clientId || !clientSecret) {
    throw new MailTransportError("OAuth API credential needs an access token, or refreshToken with clientId and clientSecret.", {
      provider: input.provider,
      channel: input.sender.sendChannel ?? "oauth-api",
      code: "missing_oauth_refresh_credential"
    });
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  });
  const scope = credentialStringField(input.credential, "scope", "scopes");
  if (scope && input.provider === "microsoft-graph") params.set("scope", scope);
  const response = await input.fetchImpl(oauthTokenUrl(input.provider, input.credential), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params
  });
  const text = await response.text();
  const json = parseJson(text);
  if (!response.ok) {
    throw new MailTransportError("OAuth token refresh failed.", {
      provider: input.provider,
      channel: input.sender.sendChannel ?? "oauth-api",
      code: extractResponseCode(json) ?? "oauth_refresh_failed",
      statusCode: response.status,
      statusText: response.statusText,
      responseMessage: extractResponseMessage(json, text)
    });
  }
  const accessToken = credentialStringField(json as ApiMailCredential | undefined, "access_token", "accessToken", "token");
  if (!accessToken) {
    throw new MailTransportError("OAuth token refresh did not return an access token.", {
      provider: input.provider,
      channel: input.sender.sendChannel ?? "oauth-api",
      code: "missing_refreshed_access_token"
    });
  }
  return accessToken;
}

function oauthTokenUrl(provider: MailTransportProvider, credential?: ApiMailCredential): string {
  const explicit = credentialStringField(credential, "tokenUrl", "token_url");
  if (explicit) return explicit;
  if (provider === "gmail") return "https://oauth2.googleapis.com/token";
  if (provider === "microsoft-graph") {
    const tenantId = credentialStringField(credential, "tenantId", "tenant_id") || "common";
    return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  }
  if (provider === "zoho") {
    const accountsBaseUrl = normalizeApiBaseUrl(credentialStringField(credential, "accountsBaseUrl", "accounts_base_url"), "https://accounts.zoho.com");
    return `${accountsBaseUrl}/oauth/v2/token`;
  }
  throw new MailTransportError("OAuth token refresh is not supported for this provider.", {
    provider,
    channel: "oauth-api",
    code: "unsupported_oauth_refresh"
  });
}

async function sendServiceApi(input: {
  sender: OutreachSenderAccount;
  message: NormalizedMailMessage;
  credential?: ApiMailCredential;
  fetchImpl: typeof fetch;
  provider: MailTransportProvider;
}): Promise<MailTransportSendResult> {
  assertServiceApiCredential(input.sender, input.credential);
  assertImplementedServiceApiProvider(input.sender, input.provider);
  const endpoint = serviceApiEndpoint(input.sender, input.credential)!;
  const headers: Record<string, string> = {
    "accept": "application/json",
    "content-type": "application/json",
    ...credentialRecordField(input.credential, "headers")
  };
  const token = apiCredentialDirectToken(input.credential);
  if (token && !Object.keys(headers).some((key) => key.toLowerCase() === "authorization")) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await input.fetchImpl(endpoint, {
    method: credentialStringField(input.credential, "method") || "POST",
    headers,
    body: JSON.stringify(dropUndefined({
      provider: input.sender.provider,
      from: input.message.fromAddress,
      fromName: input.sender.fromName,
      to: input.message.to,
      cc: input.message.cc,
      bcc: input.message.bcc,
      subject: input.message.subject,
      text: input.message.text,
      html: input.message.html
    }))
  });
  const text = await response.text();
  const json = parseJson(text);
  const requestId = response.headers.get("request-id")
    ?? response.headers.get("x-request-id")
    ?? undefined;
  if (!response.ok) {
    throw new MailTransportError("Service API send failed.", {
      provider: input.provider === "smtp" ? "service-api" : input.provider,
      channel: "service-api",
      statusCode: response.status,
      statusText: response.statusText,
      requestId,
      code: extractResponseCode(json),
      responseMessage: extractResponseMessage(json, text)
    });
  }
  return {
    provider: input.provider === "smtp" ? "service-api" : input.provider,
    channel: "service-api",
    statusCode: response.status,
    requestId,
    messageId: stringFromJson(json, ["id", "messageId", "message.id", "data.id", "data.messageId"]),
    accepted: input.message.to
  };
}

function assertImplementedServiceApiProvider(sender: OutreachSenderAccount, provider: MailTransportProvider): void {
  void sender;
  void provider;
}

function serviceApiEndpoint(sender: OutreachSenderAccount, credential?: ApiMailCredential): string {
  const provider = normalizeProvider(sender.provider, sender.sendChannel);
  const endpoint = sender.serviceApi?.apiBaseUrl
    || credentialStringField(credential, "endpoint", "url", "apiBaseUrl", "api_base_url")
    || defaultServiceApiEndpoint(provider);
  return normalizeApiBaseUrl(
    endpoint,
    ""
  );
}

function defaultServiceApiEndpoint(provider: MailTransportProvider): string {
  void provider;
  return "";
}

function credentialCanResolveAccessToken(credential?: ApiMailCredential): boolean {
  if (apiCredentialDirectToken(credential)) return true;
  return Boolean(
    credentialStringField(credential, "refreshToken", "refresh_token")
    && credentialStringField(credential, "clientId", "client_id")
    && credentialStringField(credential, "clientSecret", "client_secret")
  );
}

function apiCredentialDirectToken(credential?: ApiMailCredential): string {
  return credentialStringField(credential, "accessToken", "access_token", "token", "apiKey", "api_key");
}

function credentialStringField(record: ApiMailCredential | undefined, ...keys: string[]): string {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value.join(" ").trim();
  }
  return "";
}

function credentialRecordField(record: ApiMailCredential | undefined, key: string): Record<string, string> {
  const value = record?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1].trim()))
    .map(([name, headerValue]) => [name, headerValue.trim()]));
}

function normalizeMessage(sender: OutreachSenderAccount, message: SendMailOptions): NormalizedMailMessage {
  const to = normalizeAddresses(message.to);
  if (!to.length) {
    throw new MailTransportError("Mail recipient is missing.", {
      provider: normalizeProvider(sender.provider, sender.sendChannel),
      channel: sender.sendChannel ?? "smtp",
      code: "missing_recipient"
    });
  }
  const html = contentToString(message.html);
  const text = contentToString(message.text) || (html ? stripHtml(html) : "");
  return {
    from: contentToString(message.from) || sender.email,
    fromAddress: extractAddress(contentToString(message.from) || sender.email) || sender.email,
    to,
    cc: normalizeAddresses(message.cc),
    bcc: normalizeAddresses(message.bcc),
    subject: sanitizeHeader(contentToString(message.subject) || "(no subject)"),
    text,
    html
  };
}

function graphRecipients(addresses: string[]) {
  return addresses.map((address) => ({ emailAddress: { address } }));
}

function buildMimeMessage(message: NormalizedMailMessage): string {
  const headers = [
    `From: ${encodeAddressHeader(message.from)}`,
    `To: ${message.to.join(", ")}`,
    message.cc.length ? `Cc: ${message.cc.join(", ")}` : undefined,
    `Subject: ${encodeMimeHeader(message.subject)}`,
    "MIME-Version: 1.0"
  ].filter((line): line is string => Boolean(line));

  if (message.html) {
    const boundary = `hermills-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      message.text,
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      message.html,
      `--${boundary}--`,
      ""
    ].join("\r\n");
  }

  return [
    ...headers,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    message.text
  ].join("\r\n");
}

type JsonPostResponse = {
  statusCode: number;
  requestId?: string;
  json?: unknown;
  text: string;
};

async function postJson(input: {
  provider: MailTransportProvider;
  channel: OutreachSenderAccount["sendChannel"];
  fetchImpl: typeof fetch;
  url: string;
  authHeader: string;
  body: unknown;
  acceptedStatuses: number[];
}): Promise<JsonPostResponse> {
  const response = await input.fetchImpl(input.url, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "authorization": input.authHeader,
      "content-type": "application/json"
    },
    body: JSON.stringify(dropUndefined(input.body))
  });
  const text = await response.text();
  const json = parseJson(text);
  const requestId = response.headers.get("request-id")
    ?? response.headers.get("x-ms-request-id")
    ?? response.headers.get("x-request-id")
    ?? undefined;
  if (!input.acceptedStatuses.includes(response.status)) {
    const responseMessage = extractResponseMessage(json, text);
    throw new MailTransportError(
      `${input.provider} send failed with HTTP ${response.status}.`,
      {
        provider: input.provider,
        channel: input.channel,
        statusCode: response.status,
        statusText: response.statusText,
        requestId,
        code: extractResponseCode(json),
        responseMessage
      }
    );
  }
  return { statusCode: response.status, requestId, json, text };
}

function normalizeApiBaseUrl(host: string | undefined, fallback: string): string {
  const value = host?.trim();
  if (!value) return fallback;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

function normalizeAddresses(value: SendMailOptions["to"]): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((item) => {
    if (!item) return [];
    if (typeof item === "string") return splitAddressList(item).map((part) => extractAddress(part) ?? part.trim()).filter(Boolean);
    if (typeof item === "object" && "address" in item && typeof item.address === "string") return [item.address];
    return [String(item)].map((part) => extractAddress(part) ?? part.trim()).filter(Boolean);
  });
}

function splitAddressList(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function extractAddress(value: string): string | undefined {
  return value.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1]
    ?? value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function contentToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value);
}

function encodeAddressHeader(value: string): string {
  const address = extractAddress(value);
  if (!address) return sanitizeHeader(value);
  const name = value.replace(/<[^<>]+>/, "").trim().replace(/^"|"$/g, "");
  return name ? `${encodeMimeHeader(name)} <${address}>` : address;
}

function encodeMimeHeader(value: string): string {
  const clean = sanitizeHeader(value);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function stripHtml(value: string): string {
  return value.replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dropUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropUndefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, dropUndefined(entry)])
    );
  }
  return value;
}

function parseJson(text: string): unknown {
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function stringFromJson(json: unknown, paths: string[]): string | undefined {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (current && typeof current === "object" && key in current) return (current as Record<string, unknown>)[key];
      return undefined;
    }, json);
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function extractResponseCode(json: unknown): string | undefined {
  return stringFromJson(json, ["error.code", "data.errorCode", "code", "errorCode"]);
}

function extractResponseMessage(json: unknown, text: string): string | undefined {
  return stringFromJson(json, ["error.message", "data.message", "message", "error"])
    ?? (text.trim() ? text.trim().slice(0, 500) : undefined);
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}
