"use client";

import { useState } from "react";
import { ListChecks, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { CreateLinkDialog } from "@/components/dashboard/create-link-dialog";
import { LinkTable } from "@/components/dashboard/link-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLinks, useDeleteLink } from "@/hooks/use-links";

export default function DashboardPage() {
  const [page, setPage] = useState(1);
  const [search] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data } = useLinks(page, search);
  const deleteLink = useDeleteLink();
  const [deleting, setDeleting] = useState(false);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitBulkMode() {
    setBulkMode(false);
    setSelected(new Set());
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      for (const id of selected) {
        await deleteLink.mutateAsync(id);
      }
      toast.success(`Deleted ${selected.size} link${selected.size > 1 ? "s" : ""}`);
      exitBulkMode();
    } catch {
      toast.error("Failed to delete some links");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header row */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-card-foreground text-xl font-bold">
          History{data?.total ? ` (${data.total})` : ""}
        </h1>

        <div className="flex items-center gap-3">
          {bulkMode ? (
            <>
              <span className="text-card-foreground text-sm font-light">
                {selected.size} selected
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={selected.size === 0 || deleting}
                className="bg-destructive shadow-soft hover:bg-destructive/80 flex h-11 items-center gap-2.5 rounded-[48px] px-6 text-[15px] font-bold text-white transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected
              </button>
              <button
                onClick={exitBulkMode}
                className="border-border bg-secondary shadow-soft text-card-foreground hover:bg-secondary/80 flex h-11 items-center gap-2.5 rounded-[48px] border px-6 text-[15px] font-bold transition-colors"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setBulkMode(true)}
                className="border-border bg-secondary shadow-soft text-card-foreground hover:bg-secondary/80 flex h-11 items-center gap-2.5 rounded-[48px] border px-6 text-[15px] font-bold transition-colors"
              >
                <ListChecks className="h-4 w-4" />
                Bulk Edit
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger className="border-border bg-secondary shadow-soft text-card-foreground hover:bg-secondary/80 flex h-11 cursor-pointer items-center gap-2.5 rounded-[48px] border px-6 text-[15px] font-bold transition-colors outline-none">
                  <SlidersHorizontal className="h-4 w-4" />
                  {statusFilter === "all"
                    ? "Filter"
                    : statusFilter === "active"
                      ? "Active"
                      : "Inactive"}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setStatusFilter("all");
                      setPage(1);
                    }}
                    className="cursor-pointer"
                  >
                    All Links
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setStatusFilter("active");
                      setPage(1);
                    }}
                    className="cursor-pointer"
                  >
                    Active Only
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setStatusFilter("inactive");
                      setPage(1);
                    }}
                    className="cursor-pointer"
                  >
                    Inactive Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <CreateLinkDialog />
            </>
          )}
        </div>
      </div>

      {/* Links table */}
      <LinkTable
        page={page}
        search={search}
        statusFilter={statusFilter}
        bulkMode={bulkMode}
        selected={selected}
        onToggleSelect={toggleSelect}
      />

      {data && data.total > 10 && (
        <div className="mt-4 flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="border-border bg-secondary text-card-foreground rounded-[48px]"
          >
            Previous
          </Button>
          <span className="text-card-foreground flex items-center px-3 text-sm">
            Page {page} of {Math.ceil(data.total / 10)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(data.total / 10)}
            onClick={() => setPage((p) => p + 1)}
            className="border-border bg-secondary text-card-foreground rounded-[48px]"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
