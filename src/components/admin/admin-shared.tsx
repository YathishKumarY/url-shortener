"use client";

import { useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, TriangleAlert, X } from "lucide-react";
import { Field, inputClass, pill } from "@/components/shared/ui-kit";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Returns `value` after it has stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Page state that snaps back to 1 whenever `key` (search/filter) changes, without an effect. */
export function usePage(key: string): [number, (page: number) => void] {
  const [state, setState] = useState({ key, page: 1 });
  const page = state.key === key ? state.page : 1;
  return [page, (next) => setState({ key, page: next })];
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:max-w-sm", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(inputClass, "pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  noun,
  onPageChange,
  fetching,
}: {
  page: number;
  totalPages: number;
  total: number;
  noun: string;
  onPageChange: (page: number) => void;
  fetching?: boolean;
}) {
  return (
    <div className="mt-4 flex min-h-9 flex-wrap items-center justify-between gap-3">
      <p
        className="text-muted-foreground flex items-center gap-2 text-[13px] tabular-nums"
        aria-live="polite"
      >
        {formatNumber(total)} {noun}
        {fetching && <Loader2 className="size-3.5 animate-spin" aria-label="Loading" />}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={pill.icon}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </button>
          <span className="text-card-foreground min-w-20 text-center text-[13px] tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className={pill.icon}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border px-6 py-12 text-center",
        className,
      )}
    >
      <div className="bg-destructive/12 text-destructive mb-3 flex size-11 items-center justify-center rounded-2xl">
        <TriangleAlert className="size-5" />
      </div>
      <p className="text-foreground text-base font-semibold">Something went wrong</p>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        {message ?? "The data could not be loaded."}
      </p>
      {onRetry && (
        <button type="button" className={cn(pill.secondary, pill.small, "mt-4")} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function RowsSkeleton({ rows = 6, tall = false }: { rows?: number; tall?: boolean }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={cn(
            "border-border/60 bg-card/50 flex items-center gap-3 rounded-2xl border px-4",
            tall ? "h-28" : "h-[72px]",
          )}
        >
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="hidden h-6 w-16 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Dialog asking for a ban reason before blocking a link. */
export function BanLinkDialog({
  open,
  onOpenChange,
  target,
  defaultReason = "Violation of terms",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: string;
  defaultReason?: string;
  onConfirm: (reason: string) => Promise<unknown> | unknown;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {/* Mounted only while open, so the reason resets each time. */}
        <BanForm
          target={target}
          defaultReason={defaultReason}
          busy={busy}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (reason) => {
            setBusy(true);
            try {
              await onConfirm(reason);
              onOpenChange(false);
            } finally {
              setBusy(false);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function BanForm({
  target,
  defaultReason,
  busy,
  onCancel,
  onSubmit,
}: {
  target: string;
  defaultReason: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState(defaultReason);
  const inputId = useId();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(reason.trim() || defaultReason);
      }}
      className="grid gap-4"
    >
      <div>
        <DialogTitle className="text-foreground text-base font-semibold">
          Ban this link?
        </DialogTitle>
        <DialogDescription className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          <span className="text-card-foreground font-medium break-all">{target}</span> will stop
          redirecting and show a blocked page. Open reports for this link are resolved.
        </DialogDescription>
      </div>
      <Field label="Reason" htmlFor={inputId} hint="Recorded with the ban.">
        <input
          id={inputId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          className={inputClass}
          autoFocus
        />
      </Field>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={cn(pill.secondary, pill.small)}
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button type="submit" className={cn(pill.danger, pill.small)} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Ban link
        </button>
      </div>
    </form>
  );
}
