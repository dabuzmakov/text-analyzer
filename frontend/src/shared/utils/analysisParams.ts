export function normalizePositiveIntegerString(value: string) {
  const trimmedValue = value.trim()

  if (!/^\d+$/.test(trimmedValue)) {
    return null
  }

  const parsedValue = Number(trimmedValue)

  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
    return null
  }

  return String(parsedValue)
}

export function sanitizePositiveIntegerInput(value: unknown, fallback: string) {
  const normalizedValue = normalizePositiveIntegerString(String(value ?? ''))
  return normalizedValue ?? fallback
}

export function toPositiveInteger(value: string, fallback: number) {
  const normalizedValue = normalizePositiveIntegerString(value)

  if (normalizedValue === null) {
    return fallback
  }

  return Number(normalizedValue)
}
