"use client";

import { useState } from "react";
import { CircleCheck, CircleX, Loader2, Plus, Send, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { CodeBlock, CopyField } from "@/components/settings/code-block";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  EmptyState,
  Field,
  inputClass,
  Panel,
  PanelHeader,
  pill,
} from "@/components/shared/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useCreateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useUpdateWebhook,
  useWebhooks,
} from "@/hooks/use-settings";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WebhookItem } from "@/types";

const EVENTS = [
  { value: "link.created", label: "Link created" },
  { value: "link.updated", label: "Link updated" },
  { value: "link.deleted", label: "Link deleted" },
  { value: "link.clicked", label: "Link clicked" },
];

const VERIFY_SNIPPET = `import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(rawBody, signatureHeader, secret) {
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}`;

function EventPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (events: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {EVENTS.map((event) => {
        const on = value.includes(event.value);
        return (
          <button
            key={event.value}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter((v) => v !== event.value) : [...value, event.value])
            }
            className={cn(
              "h-8 cursor-pointer rounded-full border px-3 text-xs font-medium transition-colors",
              on
                ? "border-primary bg-primary/12 text-primary"
                : "border-border text-card-foreground hover:text-foreground",
            )}
          >
            {event.label}
          </button>
        );
      })}
    </div>
  );
}

function WebhookRow({ hook }: { hook: WebhookItem }) {
  const update = useUpdateWebhook();
  const test = useTestWebhook();
  const remove = useDeleteWebhook();
  const [confirm, setConfirm] = useState(false);
  const healthy = hook.lastStatus !== null && hook.lastStatus < 400 && !hook.lastError;

  return (
    <li className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Switch
          checked={hook.enabled}
          onCheckedChange={(enabled) => update.mutate({ id: hook.id, enabled })}
          aria-label={hook.enabled ? "Disable webhook" : "Enable webhook"}
        />
        <p className="text-foreground min-w-0 flex-1 truncate font-mono text-[13px]">{hook.url}</p>
        <button
          type="button"
          className={cn(pill.secondary, pill.small)}
          disabled={test.isPending}
          onClick={async () => {
            const result = await test.mutateAsync(hook.id).catch(() => null);
            if (result?.ok) toast.success(`Ping delivered (HTTP ${result.status})`);
            else toast.error(result?.error ?? "Ping failed");
          }}
        >
          {test.isPending ? <Loader2 className="animate-spin" /> : <Send />} Test
        </button>
        <button
          type="button"
          aria-label="Delete webhook"
          className={pill.icon}
          onClick={() => setConfirm(true)}
        >
          <Trash2 />
        </button>
      </div>
      <EventPicker
        value={hook.events}
        onChange={(events) => events.length && update.mutate({ id: hook.id, events })}
      />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-muted-foreground mb-1 text-xs">Signing secret</p>
          <CopyField value={hook.secret} masked />
        </div>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {hook.lastTriggeredAt ? (
            <>
              {healthy ? (
                <CircleCheck className="size-3.5 text-green-500" />
              ) : (
                <CircleX className="text-destructive size-3.5" />
              )}
              {healthy ? `HTTP ${hook.lastStatus}` : (hook.lastError ?? `HTTP ${hook.lastStatus}`)}{" "}
              · {timeAgo(hook.lastTriggeredAt)}
            </>
          ) : (
            "Not triggered yet"
          )}
        </p>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this webhook?"
        description="Events stop being delivered to this endpoint."
        confirmLabel="Delete webhook"
        onConfirm={() => remove.mutateAsync(hook.id)}
      />
    </li>
  );
}

export function WebhooksTab() {
  const { data: hooks, isLoading } = useWebhooks();
  const create = useCreateWebhook();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["link.clicked"]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ url: url.trim(), events });
      setUrl("");
      toast.success("Webhook added. Send a test ping to check it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add webhook");
    }
  }

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          icon={Webhook}
          title="Webhooks"
          description="Get an HTTP POST the moment a link is created, edited, deleted or clicked."
        />
        <form onSubmit={add} className="border-border/60 mb-5 space-y-3 rounded-xl border p-4">
          <Field label="Endpoint URL" htmlFor="hook-url">
            <input
              id="hook-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/hooks/linkly"
              className={inputClass}
            />
          </Field>
          <Field label="Events">
            <EventPicker value={events} onChange={setEvents} />
          </Field>
          <div className="flex justify-end">
            <button
              type="submit"
              className={cn(pill.primary, pill.small)}
              disabled={!url.trim() || !events.length || create.isPending}
            >
              {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add webhook
            </button>
          </div>
        </form>
        {isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : !hooks?.length ? (
          <EmptyState
            icon={Webhook}
            title="No webhooks yet"
            description="Connect Slack, Zapier, Make, n8n or your own backend."
          />
        ) : (
          <ul className="border-border/60 divide-border/50 divide-y rounded-xl border">
            {hooks.map((hook) => (
              <WebhookRow key={hook.id} hook={hook} />
            ))}
          </ul>
        )}
      </Panel>
      <Panel>
        <PanelHeader
          title="Verifying deliveries"
          description="Each request carries X-Linkly-Event and X-Linkly-Signature (HMAC-SHA256 of the raw body)."
        />
        <CodeBlock code={VERIFY_SNIPPET} label="Node.js" />
      </Panel>
    </div>
  );
}
