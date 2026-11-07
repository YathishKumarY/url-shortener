import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { nextPollDelay, POLL_MIN_MS, resumePoint, sleep } from "@/lib/live-stream";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;
/**
 * Close after a while; EventSource reconnects on its own with Last-Event-ID.
 * Kept under Vercel's 300-second function limit: at exactly 5 minutes the
 * platform killed the stream first and logged a timeout error every time.
 */
const MAX_STREAM_MS = 270_000;

const clickSelect = {
  id: true,
  timestamp: true,
  referrer: true,
  referrerHost: true,
  browser: true,
  os: true,
  device: true,
  country: true,
  city: true,
  source: true,
  isBot: true,
  link: { select: { id: true, shortCode: true, domain: true, originalUrl: true, title: true } },
} as const;

function where(userId: string, linkId: string | null, includeBots: boolean, after?: Date) {
  return {
    link: { userId },
    ...(linkId ? { linkId } : {}),
    ...(includeBots ? {} : { isBot: false }),
    ...(after ? { timestamp: { gt: after } } : {}),
  };
}

/**
 * Live click feed. With `Accept: text/event-stream` this is a Server-Sent
 * Events stream (one `click` event per visit); otherwise it returns the
 * latest 50 clicks as JSON.
 */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get("linkId");
  const includeBots = searchParams.get("includeBots") === "true";

  if (!(request.headers.get("accept") ?? "").includes("text/event-stream")) {
    try {
      const clicks = await prisma.click.findMany({
        where: where(userId, linkId, includeBots),
        select: clickSelect,
        orderBy: { timestamp: "desc" },
        take: 50,
      });
      return NextResponse.json(clicks);
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch click stream. Please try again." },
        { status: 500 },
      );
    }
  }

  // EventSource sends Last-Event-ID when it reconnects by itself; the page
  // passes `since` when it reopens the stream after the tab was hidden.
  const resumeFrom = resumePoint(request.headers.get("last-event-id"), searchParams.get("since"));
  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let cursor = resumeFrom ?? new Date();
      let lastBeat = Date.now();
      let delay = POLL_MIN_MS;
      let closed = false;
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by the runtime
        }
      };
      request.signal.addEventListener("abort", close);

      send(`retry: 3000\n: connected\n\n`);
      while (!closed && Date.now() - startedAt < MAX_STREAM_MS) {
        try {
          const clicks = await prisma.click.findMany({
            where: where(userId, linkId, includeBots, cursor),
            select: clickSelect,
            orderBy: { timestamp: "asc" },
            take: 100,
          });
          for (const click of clicks) {
            send(
              `id: ${click.timestamp.toISOString()}\nevent: click\ndata: ${JSON.stringify(click)}\n\n`,
            );
            cursor = click.timestamp;
          }
          delay = nextPollDelay(delay, clicks.length > 0);
          if (Date.now() - lastBeat > HEARTBEAT_MS) {
            send(`: heartbeat\n\n`);
            lastBeat = Date.now();
          }
        } catch (err) {
          console.error("[stream] poll failed:", err);
          delay = nextPollDelay(delay, false);
        }
        await sleep(Math.min(delay, MAX_STREAM_MS - (Date.now() - startedAt)), request.signal);
      }
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
