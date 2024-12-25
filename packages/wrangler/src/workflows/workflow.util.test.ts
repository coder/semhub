import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentWindowTimestamp } from "./workflow.util";

describe("getCurrentWindowTimestamp", () => {
  let originalDateNow: () => number;

  beforeEach(() => {
    originalDateNow = Date.now;
  });

  afterEach(() => {
    global.Date.now = originalDateNow;
  });

  it("should return consistent timestamps within the same window", () => {
    const fixedTime = 1677666000000;
    const tenMinutesInMs = 10 * 60 * 1000;
    global.Date.now = vi.fn(() => fixedTime);

    const timestamp1 = getCurrentWindowTimestamp(tenMinutesInMs);
    const timestamp2 = getCurrentWindowTimestamp(tenMinutesInMs);

    expect(timestamp1).toBe(timestamp2);
    expect(timestamp1).toBe(1677666000000);
  });

  it("should return different timestamps for different windows", () => {
    const tenMinutesInMs = 10 * 60 * 1000;
    global.Date.now = vi.fn(() => 1677666000000);
    const timestamp1 = getCurrentWindowTimestamp(tenMinutesInMs);

    global.Date.now = vi.fn(() => 1677666000000 + tenMinutesInMs + 1000);
    const timestamp2 = getCurrentWindowTimestamp(tenMinutesInMs);

    expect(timestamp1).not.toBe(timestamp2);
  });

  it("should round down to the nearest window", () => {
    const windowSize = 5 * 60 * 1000; // 5 minutes
    const baseTime = 1677666000000;
    const threeMinutesInMs = 3 * 60 * 1000;
    global.Date.now = vi.fn(() => baseTime + threeMinutesInMs);

    const timestamp = getCurrentWindowTimestamp(windowSize);

    expect(timestamp).toBe(baseTime);
  });

  it("should work with different window sizes", () => {
    const baseTime = 1677666000000;
    global.Date.now = vi.fn(() => baseTime + 45000); // 45 seconds past

    expect(getCurrentWindowTimestamp(60000)).toBe(baseTime); // 1 minute window
    expect(getCurrentWindowTimestamp(30000)).toBe(baseTime + 30000); // 30 second window
    expect(getCurrentWindowTimestamp(15000)).toBe(baseTime + 45000); // 15 second window
  });
});
