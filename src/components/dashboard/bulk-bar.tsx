"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Loader2, Pause, Play, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { inputClass, pill } from "@/components/shared/ui-kit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBulkAction } from "@/hooks/use-links";
import { useTags } from "@/hooks/use-settings";
import { TAG_DOT_CLASSES } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

interface BulkBarProps {
  selected: string[];
  onClear: () => void;
}

/** Floating action bar shown while links are selected. */
export function BulkBar({ selected, onClear }: BulkBarProps) {
  const bulk = useBulkAction();
  const { data: tags } = useTags();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTag, setNewTag] = useState("");
  const count = selected.length;

  async function run(action: string, tag?: string) {
    try {
      const result = await bulk.mutateAsync({ ids: selected, action, tag });
      const verbs: Record<string, string> = {
        delete: "Deleted",
        archive: "Archived",
        unarchive: "Restored",
        disable: "Paused",
        enable: "Resumed",
        addTag: `Tagged "${tag}":`,
        removeTag: `Removed "${tag}" from`,
      };
      toast.success(`${verbs[action]} ${result.affected} link${result.affected === 1 ? "" : "s"}`);
      if (action === "delete") onClear();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk action failed");
    }
  }

  if (count === 0) return null;

  const button =
    "text-card-foreground hover:text-foreground hover:bg-secondary inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors disabled:opacity-50 [&_svg]:size-4";

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
        <div className="border-border bg-popover/95 shadow-soft pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border p-1.5 pl-4 shadow-2xl backdrop-blur-xl">
          <span className="text-foreground mr-1 shrink-0 text-sm font-semibold tabular-nums">
            {count} selected
          </span>
          {bulk.isPending && (
            <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger className={button} disabled={bulk.isPending}>
              <Tag /> Tag
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-56">
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Add tag
              </DropdownMenuLabel>
              <form
                className="px-1.5 pb-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newTag.trim()) {
                    run("addTag", newTag.trim());
                    setNewTag("");
                  }
                }}
              >
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="New or existing tag..."
                  aria-label="Tag name"
                  className={cn(inputClass, "h-8 text-[13px]")}
                />
              </form>
              {tags?.map((tag) => (
                <DropdownMenuItem
                  key={tag.id}
                  className="cursor-pointer gap-2"
                  onClick={() => run("addTag", tag.name)}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      TAG_DOT_CLASSES[tag.color] ?? "bg-zinc-500",
                    )}
                  />
                  {tag.name}
                </DropdownMenuItem>
              ))}
              {!!tags?.length && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-muted-foreground text-xs">
                    Remove tag
                  </DropdownMenuLabel>
                  {tags.map((tag) => (
                    <DropdownMenuItem
                      key={`rm-${tag.id}`}
                      className="text-muted-foreground cursor-pointer gap-2"
                      onClick={() => run("removeTag", tag.name)}
                    >
                      <X className="size-3" /> {tag.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            className={button}
            disabled={bulk.isPending}
            onClick={() => run("disable")}
          >
            <Pause /> Pause
          </button>
          <button
            type="button"
            className={button}
            disabled={bulk.isPending}
            onClick={() => run("enable")}
          >
            <Play /> Resume
          </button>
          <button
            type="button"
            className={button}
            disabled={bulk.isPending}
            onClick={() => run("archive")}
          >
            <Archive /> Archive
          </button>
          <button
            type="button"
            className={button}
            disabled={bulk.isPending}
            onClick={() => run("unarchive")}
          >
            <ArchiveRestore /> Unarchive
          </button>
          <button
            type="button"
            className={cn(
              button,
              "text-destructive hover:text-destructive hover:bg-destructive/10",
            )}
            disabled={bulk.isPending}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 /> Delete
          </button>
          <button
            type="button"
            aria-label="Clear selection"
            className={cn(pill.icon, "ml-1 size-8")}
            onClick={onClear}
          >
            <X />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${count} link${count === 1 ? "" : "s"}?`}
        description="They stop working immediately and their click history is deleted. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => run("delete")}
      />
    </>
  );
}
