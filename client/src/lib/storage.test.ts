// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { SummaryRecord } from "../types";
import { STORAGE_KEY, deleteRecord, loadRecords, saveRecord } from "./storage";

function makeRecord(id: string): SummaryRecord {
  return {
    id,
    createdAt: new Date().toISOString(),
    inputText: `Input text for record ${id}`,
    summary: { keyDiscussionPoints: [], decisionsMade: [], actionItems: [] },
  };
}

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadRecords returns [] on empty storage", () => {
    expect(loadRecords()).toEqual([]);
  });

  it("saveRecord then loadRecords returns an array containing the saved record", () => {
    const record = makeRecord("1");
    saveRecord(record);
    expect(loadRecords()).toEqual([record]);
  });

  it("deleteRecord removes only the targeted record, leaving the other", () => {
    const recordA = makeRecord("a");
    const recordB = makeRecord("b");
    saveRecord(recordA);
    saveRecord(recordB);

    deleteRecord(recordA.id);

    const remaining = loadRecords();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(recordB.id);
  });

  it("loadRecords returns [] for corrupted data instead of throwing", () => {
    localStorage.setItem(STORAGE_KEY, "not valid json");

    expect(() => loadRecords()).not.toThrow();
    expect(loadRecords()).toEqual([]);
  });
});
