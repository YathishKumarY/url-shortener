"use client";

import { useId, useState } from "react";
import { Info, Loader2, Plus, ShieldBan, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, RowsSkeleton } from "@/components/admin/admin-shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  EmptyState,
  Field,
  Panel,
  PanelHeader,
  inputClass,
  pill,
} from "@/components/shared/ui-kit";
import {
  useAddBlockedDomain,
  useBlockedDomains,
  useDeleteBlockedDomain,
  type BlockedDomain,
} from "@/hooks/use-admin";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BlocklistTab() {
  const domainId = useId();
  const reasonId = useId();
  const [domain, setDomain] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<BlockedDomain | null>(null);

  const { data, isLoading, isError, error: loadError, refetch } = useBlockedDomains();
  const add = useAddBlockedDomain();
  const remove = useDeleteBlockedDomain();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!domain.trim()) {
      setError("Enter a domain to block");
      return;
    }
    try {
      const created = await add.mutateAsync({
        domain: domain.trim(),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      toast.success(`${created.domain} is now blocked`);
      setDomain("");
      setReason("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not block this domain";
      setError(message);
      if (!(err instanceof ApiError)) toast.error(message);
    }
  }

  async function unblock(item: BlockedDomain) {
    try {
      await remove.mutateAsync(item.id);
      toast.success(`${item.domain} was removed from the blocklist`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <Panel>
        <PanelHeader
          icon={ShieldBan}
          title="Block a domain"
          description="Stop new links from pointing at it"
        />
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Domain" htmlFor={domainId} error={error}>
            <input
              id={domainId}
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                if (error) setError(null);
              }}
              placeholder="example.com"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={!!error}
              className={inputClass}
            />
          </Field>
          <Field label="Reason (optional)" htmlFor={reasonId}>
            <input
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Known phishing host"
              maxLength={200}
              className={inputClass}
            />
          </Field>
          <button type="submit" className={cn(pill.primary, "w-full")} disabled={add.isPending}>
            {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Block domain
          </button>
        </form>
        <p className="text-muted-foreground bg-secondary/50 mt-4 flex gap-2 rounded-xl p-3 text-xs leading-relaxed">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Blocking stops new links and edits to this domain and its subdomains. Existing links are
            not affected; ban them from the Links tab.
          </span>
        </p>
      </Panel>

      <div>
        {isLoading ? (
          <RowsSkeleton rows={4} />
        ) : isError || !data ? (
          <ErrorState message={loadError?.message} onRetry={() => refetch()} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={ShieldBan}
            title="No blocked domains"
            description="Domains you block will be listed here."
          />
        ) : (
          <ul className="space-y-2">
            {data.map((item) => (
              <li key={item.id}>
                <Panel className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-semibold">{item.domain}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {item.reason ? `${item.reason} - ` : ""}
                      <span className="tabular-nums">Added {formatDate(item.createdAt)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className={cn(pill.icon, "hover:text-destructive")}
                    aria-label={`Unblock ${item.domain}`}
                    title="Remove from blocklist"
                    onClick={() => setPending(item)}
                  >
                    <Trash2 />
                  </button>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        title="Remove from blocklist?"
        description={
          pending
            ? `People will be able to create links to ${pending.domain} and its subdomains again.`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={() => (pending ? unblock(pending) : undefined)}
      />
    </div>
  );
}
