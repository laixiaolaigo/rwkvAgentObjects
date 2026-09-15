import type { Locale } from "@/lib/i18n";

export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(asString);

  if (items.some((item) => !item)) {
    throw new Error("String arrays cannot contain blank or non-string values");
  }

  return items.length ? (items as string[]) : undefined;
}

export function localizedString(
  value: unknown,
  locale: Locale,
  field: string
): string | undefined {
  if (value === undefined || value === null) return undefined;
  const item = asRecord(value);
  const en = asString(item.en);
  const zh = asString(item.zh);

  if (!en || !zh) {
    throw new Error(`${field} must contain non-empty en and zh strings`);
  }

  return locale === "en" ? en : zh;
}

export function localizedStringArray(
  value: unknown,
  locale: Locale,
  field: string
): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const item = asRecord(value);

  if (!Array.isArray(item.en) || !Array.isArray(item.zh)) {
    throw new Error(`${field} must contain en and zh arrays`);
  }

  const en = asStringArray(item.en);
  const zh = asStringArray(item.zh);

  return locale === "en" ? en : zh;
}
