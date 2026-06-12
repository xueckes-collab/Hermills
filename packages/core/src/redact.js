const SECRET_PATTERNS = [
    /\bsk-[A-Za-z0-9_-]{12,}\b/g,
    /\bsk-proj-[A-Za-z0-9_-]{12,}\b/g,
    /\b([A-Za-z0-9_.-]*(?:token|secret|password|credential)|license[_-]?key|api[_-]?key|authorization|bearer|oauth[_-]?state|state)\s*[:=]\s*["']?[^"'\s]+/gi
];
const SECRET_FIELD_PATTERN = /(api[_-]?key|authorization|bearer|token|secret|password|credential|oauth[_-]?state)/i;
export function redactSecrets(input) {
    return SECRET_PATTERNS.reduce((value, pattern) => {
        return value.replace(pattern, (match) => {
            const [label] = match.split(/[:=]/);
            return label && SECRET_FIELD_PATTERN.test(label) ? `${label.trim()}: [REDACTED]` : "[REDACTED]";
        });
    }, input);
}
export function previewSecret(secret) {
    if (!secret)
        return "";
    if (secret.length <= 8)
        return "••••";
    return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}
export function findPlaintextSecretField(value, currentPath = "") {
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const match = findPlaintextSecretField(value[index], `${currentPath}[${index}]`);
            if (match)
                return match;
        }
        return undefined;
    }
    if (!value || typeof value !== "object")
        return undefined;
    for (const [key, entry] of Object.entries(value)) {
        const nextPath = currentPath ? `${currentPath}.${key}` : key;
        if (SECRET_FIELD_PATTERN.test(key))
            return nextPath;
        const nested = findPlaintextSecretField(entry, nextPath);
        if (nested)
            return nested;
    }
    return undefined;
}
export function redactStructuredSecrets(value) {
    return redactStructuredValue(value);
}
function redactStructuredValue(value) {
    if (Array.isArray(value))
        return value.map(redactStructuredValue);
    if (!value || typeof value !== "object")
        return value;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
        key,
        SECRET_FIELD_PATTERN.test(key) ? "[REDACTED]" : redactStructuredValue(entry)
    ]));
}
