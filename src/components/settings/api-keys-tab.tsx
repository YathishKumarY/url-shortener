"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/hooks/use-settings";
import { formatDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApiKeyItem } from "@/types";

function useOrigin() {
  const [origin, setOrigin] = useState("https://your-linkly.app");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);
  return origin;
}

function CreateKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [created, setCreated] = useState<ApiKeyItem | null>(null);
  const create = useCreateApiKey();
  const origin = useOrigin();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setCreated(
        await create.mutateAsync({
          name: name.trim(),
          expiresInDays: expiry ? Number(expiry) : null,
        }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create key");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setName("");
          setExpiry("");
          setCreated(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{created ? "Copy your new API key" : "Create an API key"}</DialogTitle>
          <DialogDescription>
            {created
              ? "This is the only time the full key is shown. Store it somewhere safe."
              : "Keys act as you: they can create, edit and delete your links."}
          </DialogDescription>
        </DialogHeader>
        {created?.key ? (
          <div className="space-y-4">
            <CopyField value={created.key} />
            <CodeBlock
              label="Try it"
              code={`curl -X POST ${origin}/api/v1/links \\\n  -H "Authorization: Bearer ${created.key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "https://example.com"}'`}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className={cn(pill.primary, pill.small)}
                onClick={() => onOpenChange(false)}
              >
                I saved it
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field
              label="Name"
              htmlFor="key-name"
              hint="Something to recognise it by, like 'Zapier' or 'CLI'."
            >
              <input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
                className={inputClass}
              />
            </Field>
            <Field label="Expires" htmlFor="key-expiry">
              <select
                id="key-expiry"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className={inputClass}
              >
                <option value="">Never</option>
                <option value="7">In 7 days</option>
                <option value="30">In 30 days</option>
                <option value="90">In 90 days</option>
                <option value="365">In 1 year</option>
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={cn(pill.secondary, pill.small)}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={cn(pill.primary, pill.small)}
                disabled={!name.trim() || create.isPending}
              >
                {create.isPending && <Loader2 className="animate-spin" />} Create key
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeysTab() {
  const { data: keys, isLoading } = useApiKeys();
  const remove = useDeleteApiKey();
  const [open, setOpen] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyItem | null>(null);
  const origin = useOrigin();

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          icon={KeyRound}
          title="API keys"
          description="Automate link creation from scripts, CI, Zapier or the browser extension."
          action={
            <button
              type="button"
              className={cn(pill.primary, pill.small)}
              onClick={() => setOpen(true)}
            >
              <Plus /> New key
            </button>
          }
        />
        {isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : !keys?.length ? (
          <EmptyState
            icon={KeyRound}
            title="No API keys"
            description="Create a key to use the REST API."
          />
        ) : (
          <ul className="border-border/60 divide-border/50 divide-y rounded-xl border">
            {keys.map((key) => {
              const expired = key.expiresAt && new Date(key.expiresAt) <= new Date();
              return (
                <li key={key.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                    <KeyRound className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-semibold">
                      {key.name}
                      {expired && (
                        <span className="text-destructive ml-2 text-xs font-medium">Expired</span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      <code className="font-mono">{key.prefix}…</code> · created{" "}
                      {formatDate(key.createdAt)} ·{" "}
                      {key.lastUsedAt ? `used ${timeAgo(key.lastUsedAt)}` : "never used"}
                      {key.expiresAt && !expired && ` · expires ${formatDate(key.expiresAt)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={cn(pill.secondary, pill.small)}
                    onClick={() => setRevoking(key)}
                  >
                    <Trash2 /> Revoke
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          icon={ShieldAlert}
          title="Quick start"
          description="Full reference in the API docs."
          action={
            <a href="/docs" target="_blank" className={cn(pill.secondary, pill.small)}>
              Open docs
            </a>
          }
        />
        <div className="space-y-3">
          <CodeBlock
            label="Shorten in one line (plain text response)"
            code={`curl "${origin}/api/v1/shorten?url=https://example.com&format=simple" \\\n  -H "Authorization: Bearer lk_your_key"`}
          />
          <CodeBlock
            label="JavaScript"
            code={`const res = await fetch("${origin}/api/v1/links", {\n  method: "POST",\n  headers: {\n    Authorization: "Bearer " + process.env.LINKLY_API_KEY,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({ url: "https://example.com", tags: ["api"], maxClicks: 100 }),\n});\nconst { shortUrl } = await res.json();`}
          />
        </div>
      </Panel>

      <CreateKeyDialog open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(next) => !next && setRevoking(null)}
        title={`Revoke "${revoking?.name}"?`}
        description="Anything using this key stops working immediately."
        confirmLabel="Revoke key"
        onConfirm={async () => {
          if (revoking) await remove.mutateAsync(revoking.id);
          toast.success("Key revoked");
        }}
      />
    </div>
  );
}
