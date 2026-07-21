import type { SummaryRecord } from "../types";

export const STORAGE_KEY = "mns:v1:summaries";

export function loadRecords(): SummaryRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecord(record: SummaryRecord): SummaryRecord[] {
  const records = [record, ...loadRecords()];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  return records;
}

export function deleteRecord(id: string): SummaryRecord[] {
  const records = loadRecords().filter((record) => record.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  return records;
}
