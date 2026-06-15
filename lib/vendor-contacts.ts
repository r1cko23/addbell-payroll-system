import {
  dedupePhoneEntries,
  expandPhilippinePhoneEntries,
} from "@/lib/philippine-phone";

function splitLegacyContactValues(value: string): string[] {
  return expandPhilippinePhoneEntries(value);
}

function collectRawContactValues(
  values: string[] | null | undefined,
  fallback: string | null | undefined
): string[] {
  if (values?.length) {
    return values.map((entry) => entry.trim()).filter(Boolean);
  }
  if (!fallback?.trim()) return [];
  const parts = splitLegacyContactValues(fallback);
  return parts.length > 0 ? parts : [fallback.trim()];
}

function isEmailLikeValue(value: string): boolean {
  return value.includes("@");
}

export function partitionVendorContactDisplay(record: {
  phones?: string[] | null;
  phone?: string | null;
  emails?: string[] | null;
  email?: string | null;
}): { phones: string[]; emails: string[] } {
  const candidates = [
    ...collectRawContactValues(record.phones, record.phone),
    ...collectRawContactValues(record.emails, record.email),
  ];

  const phones: string[] = [];
  const emails: string[] = [];

  for (const entry of candidates) {
    if (isEmailLikeValue(entry)) {
      const normalized = entry.trim().toLowerCase();
      if (!emails.includes(normalized)) emails.push(normalized);
      continue;
    }

    for (const phoneEntry of expandPhilippinePhoneEntries(entry)) {
      const trimmed = phoneEntry.trim();
      if (!trimmed) continue;
      if (!phones.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
        phones.push(trimmed);
      }
    }
  }

  return { phones: dedupePhoneEntries(phones), emails };
}

export function coalesceVendorPhones(
  phones: string[] | null | undefined,
  phone: string | null | undefined
): string[] {
  return partitionVendorContactDisplay({ phones, phone }).phones;
}

export function coalesceVendorEmails(
  emails: string[] | null | undefined,
  email: string | null | undefined
): string[] {
  return partitionVendorContactDisplay({ emails, email }).emails;
}

export function primaryVendorPhone(
  phones: string[] | null | undefined,
  phone: string | null | undefined
): string {
  return coalesceVendorPhones(phones, phone)[0] ?? "";
}

export function primaryVendorEmail(
  emails: string[] | null | undefined,
  email: string | null | undefined
): string {
  return coalesceVendorEmails(emails, email)[0] ?? "";
}

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function recordMatchesContactSearch(
  phones: string[] | null | undefined,
  phone: string | null | undefined,
  emails: string[] | null | undefined,
  email: string | null | undefined,
  search: string
): boolean {
  const normalizedSearch = search.toLowerCase();
  const { phones: phoneList, emails: emailList } = partitionVendorContactDisplay({
    phones,
    phone,
    emails,
    email,
  });
  return (
    phoneList.some((entry) => entry.includes(search)) ||
    emailList.some((entry) => entry.toLowerCase().includes(normalizedSearch))
  );
}
