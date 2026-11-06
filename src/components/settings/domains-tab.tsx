"use client";

import { useState } from "react";
import { BadgeCheck, Clock, Globe, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CopyField } from "@/components/settings/code-block";
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
import {
  useCreateDomain,
  useDeleteDomain,
  useDomains,
  useUpdateDomain,
  useVerifyDomain,
} from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import type { DomainItem } from "@/types";

function DomainCard({ domain }: { domain: DomainItem }) {
  const verify = useVerifyDomain();
  const update = useUpdateDomain();
  const remove = useDeleteDomain();
  const [root, setRoot] = useState(domain.rootRedirect ?? "");
  const [notFound, setNotFound] = useState(domain.notFoundRedirect ?? "");
  const [confirm, setConfirm] = useState(false);
  const dirty =
    root !== (domain.rootRedirect ?? "") || notFound !== (domain.notFoundRedirect ?? "");

  return (
    <li className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Globe className="text-muted-foreground size-5" />
        <p className="text-foreground min-w-0 flex-1 truncate text-[15px] font-semibold">
          {domain.hostname}
        </p>
        {domain.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/12 px-2.5 py-1 text-xs font-semibold text-green-700 dark:text-green-400">
            <BadgeCheck className="size-3.5" /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Clock className="size-3.5" /> Pending DNS
          </span>
        )}
        <span className="text-muted-foreground text-xs">{domain.linkCount} links</span>
        <button
          type="button"
          aria-label={`Remove ${domain.hostname}`}
          className={pill.icon}
          onClick={() => setConfirm(true)}
        >
          <Trash2 />
        </button>
      </div>

      {!domain.verified && (
        <div className="border-border/60 space-y-3 rounded-xl border p-3">
          <p className="text-card-foreground text-sm">
            Add these two DNS records at your DNS provider, then verify:
          </p>
          {[domain.dns.routing, domain.dns.verification].map((record) => (
            <div
              key={record.type}
              className="grid gap-2 sm:grid-cols-[70px_1fr_1fr] sm:items-center"
            >
              <span className="bg-secondary text-foreground w-fit rounded-md px-2 py-1 font-mono text-xs font-semibold">
                {record.type}
              </span>
              <CopyField value={record.name} />
              <CopyField value={record.value} />
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              DNS changes can take a few minutes to propagate.
            </p>
            <button
              type="button"
              className={cn(pill.primary, pill.small)}
              disabled={verify.isPending}
              onClick={async () => {
                const result = await verify
                  .mutateAsync(domain.id)
                  .catch((err: Error) => ({ verified: false, message: err.message }));
                if (result.verified) toast.success(`${domain.hostname} is verified`);
                else toast.error(result.message);
              }}
            >
              {verify.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Verify now
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Root redirect" hint={`Where ${domain.hostname}/ sends visitors.`}>
          <input
            value={root}
            onChange={(e) => setRoot(e.target.value)}
            placeholder="https://yourcompany.com"
            className={inputClass}
          />
        </Field>
        <Field label="Not-found redirect" hint="Where unknown short codes go.">
          <input
            value={notFound}
            onChange={(e) => setNotFound(e.target.value)}
            placeholder="https://yourcompany.com/404"
            className={inputClass}
          />
        </Field>
      </div>
      {dirty && (
        <div className="flex justify-end">
          <button
            type="button"
            className={cn(pill.primary, pill.small)}
            disabled={update.isPending}
            onClick={async () => {
              try {
                await update.mutateAsync({
                  id: domain.id,
                  rootRedirect: root.trim() || null,
                  notFoundRedirect: notFound.trim() || null,
                });
                toast.success("Domain settings saved");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not save");
              }
            }}
          >
            {update.isPending && <Loader2 className="animate-spin" />} Save
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Remove ${domain.hostname}?`}
        description={
          domain.linkCount
            ? `Its ${domain.linkCount} link${domain.linkCount === 1 ? "" : "s"} will be deleted and stop working.`
            : "No links use this domain yet."
        }
        confirmLabel="Remove domain"
        onConfirm={() => remove.mutateAsync(domain.id)}
      />
    </li>
  );
}

export function DomainsTab() {
  const { data: domains, isLoading } = useDomains();
  const create = useCreateDomain();
  const [hostname, setHostname] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync(hostname.trim());
      setHostname("");
      toast.success("Domain added. Now add the DNS records.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add domain");
    }
  }

  return (
    <Panel>
      <PanelHeader
        icon={Globe}
        title="Custom domains"
        description="Branded short links like go.yourcompany.com/launch build trust and get more clicks."
      />
      <form onSubmit={add} className="mb-5 flex flex-col gap-2 sm:flex-row">
        <input
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="go.yourcompany.com"
          aria-label="Domain"
          className={inputClass}
        />
        <button
          type="submit"
          className={cn(pill.primary, "shrink-0")}
          disabled={!hostname.trim() || create.isPending}
        >
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add domain
        </button>
      </form>
      {isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : !domains?.length ? (
        <EmptyState
          icon={Globe}
          title="No custom domains"
          description="Use a subdomain you control, point it at this server, and verify it with a TXT record."
        />
      ) : (
        <ul className="border-border/60 divide-border/50 divide-y rounded-xl border">
          {domains.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
