import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { safeFetch } from "@/lib/safe-fetch";
import type { WebhookEvent } from "@/lib/validators";

export { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/validators";

export const webhookSelect = {
  id: true,
  url: true,
  secret: true,
  events: true,
  enabled: true,
  lastStatus: true,
  lastError: true,
  lastTriggeredAt: true,
  createdAt: true,
} as const;

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/** Value of the X-Linkly-Signature header: HMAC-SHA256 of the raw body. */
export function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/** Constant-time check, for receivers (and tests) verifying a delivery. */
export function verifySignature(secret: string, body: string, signature: string): boolean {
  const expected = Buffer.from(signPayload(secret, body));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

interface DeliverableWebhook {
  id: string;
  url: string;
  secret: string;
}

/** POST one event to one endpoint and record the outcome on the webhook row. */
export async function deliverWebhook(
  hook: DeliverableWebhook,
  event: WebhookEvent | "ping",
  data: unknown,
): Promise<{ status: number | null; error: string | null }> {
  const body = JSON.stringify({
    id: `evt_${randomBytes(12).toString("hex")}`,
    event,
    createdAt: new Date().toISOString(),
    data,
  });

  let status: number | null = null;
  let error: string | null = null;
  try {
    const result = await safeFetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `${config.siteName}-Webhooks/1.0`,
        "X-Linkly-Event": event,
        "X-Linkly-Signature": signPayload(hook.secret, body),
      },
      body,
      timeoutMs: 5000,
      maxRedirects: 0,
      maxBytes: 4096,
    });
    status = result.status;
    if (status >= 400) error = `Endpoint responded with HTTP ${status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : "Delivery failed";
  }

  await prisma.webhook
    .update({
      where: { id: hook.id },
      data: { lastStatus: status, lastError: error, lastTriggeredAt: new Date() },
    })
    .catch(() => {});

  return { status, error };
}

/**
 * Fan an event out to the user's enabled webhooks. Call from `after()` so a
 * slow endpoint never delays the response that triggered it.
 */
export async function dispatchWebhooks(
  userId: string | null | undefined,
  event: WebhookEvent,
  data: unknown,
): Promise<void> {
  if (!userId) return;
  try {
    const hooks = await prisma.webhook.findMany({
      where: { userId, enabled: true, events: { has: event } },
      select: { id: true, url: true, secret: true },
    });
    await Promise.allSettled(hooks.map((hook) => deliverWebhook(hook, event, data)));
  } catch (err) {
    console.error(`[webhooks] dispatch of ${event} failed:`, err);
  }
}
