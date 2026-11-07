/**
 * Pacing for the live click stream (`/api/clicks/stream`).
 *
 * Each poll is one database query, and hosted Postgres plans bill per query.
 * Polling every 2 seconds for as long as the Live tab was open cost about
 * 1,800 queries an hour, enough to use up a free plan's monthly allowance in
 * a few days of leaving the tab open. Instead, poll quickly while clicks are
 * arriving and back off while it is quiet: an idle tab now costs about 240
 * queries an hour, and a click still shows up within 15 seconds.
 */

export const POLL_MIN_MS = 2_000;
export const POLL_MAX_MS = 15_000;

/** Wait before the next poll: reset when clicks arrived, otherwise double up to the cap. */
export function nextPollDelay(currentMs: number, gotClicks: boolean): number {
  if (gotClicks) return POLL_MIN_MS;
  return Math.min(Math.max(currentMs, POLL_MIN_MS) * 2, POLL_MAX_MS);
}

/** Resolves after `ms`, or as soon as `signal` aborts, so a closed stream stops at once. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

/** Where a stream resumes: the browser's Last-Event-ID, else a `since` timestamp, else now. */
export function resumePoint(lastEventId: string | null, since: string | null): Date | null {
  for (const value of [lastEventId, since]) {
    if (value && !Number.isNaN(Date.parse(value))) return new Date(value);
  }
  return null;
}
