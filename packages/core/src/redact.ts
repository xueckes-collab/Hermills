const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bsk-proj-[A-Za-z0-9_-]{12,}\b/g,
  /\b(license[_-]?key|api[_-]?key|authorization|bearer|token|secret|password)\s*[:=]\s*["']?[^"'\s]+/gi
];

const SECRET_FIELD_PATTERN = /(api[_-]?key|authorization|bearer|token|secret|password|credential)/i;

export function redactSecrets(input: string): string {
  return SECRET_PATTERNS.reduce((value, pattern) => {
    return value.replace(pattern, (match) => {
      const [label] = match.split(/[:=]/);
      return label && SECRET_FIELD_PATTERN.test(label) ? `${label.trim()}: [REDACTED]` : "[REDACTED]";
    });
  }, input);
}

export function previewSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "••••";
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

export function findPlaintextSecretField(value: unknown, currentPath = ""): string | undefined {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findPlaintextSecretField(value[index], `${currentPath}[${index}]`);
      if (match) return match;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (SECRET_FIELD_PATTERN.test(key)) return nextPath;
    const nested = findPlaintextSecretField(entry, nextPath);
    if (nested) return nested;
  }
  return undefined;
}

export function redactStructuredSecrets<T>(value: T): T {
  return redactStructuredValue(value) as T;
}

function redactStructuredValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactStructuredValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SECRET_FIELD_PATTERN.test(key) ? "[REDACTED]" : redactStructuredValue(entry)
    ])
  );
}
