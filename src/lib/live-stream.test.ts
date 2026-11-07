import { describe, expect, it, vi } from "vitest";
import { nextPollDelay, POLL_MAX_MS, POLL_MIN_MS, resumePoint, sleep } from "@/lib/live-stream";

describe("nextPollDelay", () => {
  it("backs off while nothing arrives, up to the cap", () => {
    const delays: number[] = [];
    let delay = POLL_MIN_MS;
    for (let i = 0; i < 5; i++) {
      delay = nextPollDelay(delay, false);
      delays.push(delay);
    }
    expect(delays).toEqual([4_000, 8_000, POLL_MAX_MS, POLL_MAX_MS, POLL_MAX_MS]);
  });

  it("goes back to the fast pace as soon as a click arrives", () => {
    expect(nextPollDelay(POLL_MAX_MS, true)).toBe(POLL_MIN_MS);
  });

  it("keeps an idle hour to a few hundred queries", () => {
    let delay = POLL_MIN_MS;
    let elapsed = 0;
    let queries = 0;
    while (elapsed < 60 * 60_000) {
      queries++;
      delay = nextPollDelay(delay, false);
      elapsed += delay;
    }
    expect(queries).toBeLessThan(250);
  });
});

describe("resumePoint", () => {
  it("prefers the browser's Last-Event-ID", () => {
    expect(resumePoint("2026-11-07T10:00:00.000Z", "2026-11-01T00:00:00.000Z")?.toISOString()).toBe(
      "2026-11-07T10:00:00.000Z",
    );
  });

  it("falls back to the since parameter, and ignores junk", () => {
    expect(resumePoint(null, "2026-11-01T00:00:00.000Z")?.toISOString()).toBe(
      "2026-11-01T00:00:00.000Z",
    );
    expect(resumePoint("garbage", "also garbage")).toBeNull();
    expect(resumePoint(null, null)).toBeNull();
  });
});

describe("sleep", () => {
  it("resolves early when the stream is aborted", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let done = false;
    const pending = sleep(15_000, controller.signal).then(() => {
      done = true;
    });
    controller.abort();
    await pending;
    expect(done).toBe(true);
    vi.useRealTimers();
  });

  it("resolves immediately for an already aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleep(60_000, controller.signal)).resolves.toBeUndefined();
  });
});
