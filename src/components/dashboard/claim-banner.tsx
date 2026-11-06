"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { pill } from "@/components/shared/ui-kit";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "linkly:recent-links";
const DISMISS_KEY = "linkly:claim-dismissed";

interface StoredLink {
  id: string;
  claimToken?: string;
}

function read(): StoredLink[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as StoredLink[];
  } catch {
    return [];
  }
}

/**
 * Offers to adopt links this browser created before signing in. Each link
 * carries a signed claim token from creation, so only its creator can claim it.
 */
export function ClaimBanner() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<StoredLink[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(read().filter((l) => l.claimToken));
  }, []);

  if (pending.length === 0) return null;

  function forget(ids: string[]) {
    try {
      const keep = read().map((l) => (ids.includes(l.id) ? { ...l, claimToken: undefined } : l));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keep));
    } catch {
      // storage unavailable
    }
  }

  async function claim() {
    setBusy(true);
    try {
      const result = await apiFetch<{ claimed: number; ids: string[] }>("/api/links/claim", {
        method: "POST",
        json: { links: pending.map((l) => ({ id: l.id, token: l.claimToken })) },
      });
      forget(pending.map((l) => l.id));
      setPending([]);
      queryClient.invalidateQueries({ queryKey: ["links"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success(
        result.claimed
          ? `Added ${result.claimed} link${result.claimed === 1 ? "" : "s"} to your account`
          : "Those links were already claimed",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not claim links");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-primary/30 bg-primary/8 mb-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
      <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
        <Sparkles className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-semibold">
          You created {pending.length} link{pending.length === 1 ? "" : "s"} before signing in
        </p>
        <p className="text-muted-foreground text-xs">
          Add them to your account to see their analytics and edit them.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className={cn(pill.primary, pill.small)}
          onClick={claim}
          disabled={busy}
        >
          {busy && <Loader2 className="animate-spin" />} Add to my account
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          className={cn(pill.icon, "size-8")}
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // ignore
            }
            setPending([]);
          }}
        >
          <X />
        </button>
      </div>
    </div>
  );
}
