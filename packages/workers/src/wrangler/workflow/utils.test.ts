import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateSyncWorkflowId } from "./utils";

describe("generateSyncWorkflowId", () => {
  let originalDateNow: () => number;

  beforeEach(() => {
    // Store the original Date.now function
    originalDateNow = Date.now;
  });

  afterEach(() => {
    // Restore the original Date.now function after each test
    global.Date.now = originalDateNow;
  });

  it("should generate consistent IDs within the same 10-minute window", () => {
    // Mock Date.now to return a fixed timestamp
    const fixedTime = 1677666000000; // Some arbitrary timestamp
    global.Date.now = vi.fn(() => fixedTime);

    const id1 = generateSyncWorkflowId();
    const id2 = generateSyncWorkflowId();

    expect(id1).toBe(id2);
    expect(id1).toBe(`sync-${1677666000000}`);
  });

  it("should generate different IDs for different 10-minute windows", () => {
    // First timestamp
    global.Date.now = vi.fn(() => 1677666000000);
    const id1 = generateSyncWorkflowId();

    // Move time forward by 11 minutes (660000ms)
    global.Date.now = vi.fn(() => 1677666000000 + 660000);
    const id2 = generateSyncWorkflowId();

    expect(id1).not.toBe(id2);
  });

  it("should round down to the nearest 10-minute window", () => {
    // Set time to 5 minutes past the hour
    const fiveMinutesInMs = 5 * 60 * 1000;
    const baseTime = 1677666000000;
    global.Date.now = vi.fn(() => baseTime + fiveMinutesInMs);

    const id = generateSyncWorkflowId();

    // Should round down to the base time
    expect(id).toBe(`sync-${baseTime}`);
  });
});
