"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  EmptyState,
  inputClass,
  Panel,
  PanelHeader,
  pill,
  TagChip,
} from "@/components/shared/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "@/hooks/use-settings";
import { TAG_DOT_CLASSES } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import type { TagItem } from "@/types";

const COLORS = ["blue", "green", "pink", "amber", "purple", "teal", "red", "gray"];

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Tag color">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className={cn(
            "flex size-6 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110",
            TAG_DOT_CLASSES[color],
            value === color && "ring-foreground/60 ring-2 ring-offset-2 ring-offset-transparent",
          )}
        >
          {value === color && <Check className="size-3 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

function TagRow({ tag }: { tag: TagItem }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [confirm, setConfirm] = useState(false);
  const update = useUpdateTag();
  const remove = useDeleteTag();

  async function save() {
    try {
      await update.mutateAsync({ id: tag.id, name: name.trim(), color });
      setEditing(false);
      toast.success("Tag updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update tag");
    }
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      {editing ? (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            aria-label="Tag name"
            className={cn(inputClass, "h-9 sm:w-56")}
          />
          <ColorPicker value={color} onChange={setColor} />
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              className={cn(pill.primary, pill.small)}
              disabled={!name.trim() || update.isPending}
              onClick={save}
            >
              {update.isPending ? <Loader2 className="animate-spin" /> : <Check />} Save
            </button>
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              onClick={() => setEditing(false)}
            >
              <X /> Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <TagChip name={tag.name} color={tag.color} />
          <Link
            href={`/dashboard?tag=${tag.id}`}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            {tag.linkCount} link{tag.linkCount === 1 ? "" : "s"}
          </Link>
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              aria-label={`Edit ${tag.name}`}
              className={pill.icon}
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </button>
            <button
              type="button"
              aria-label={`Delete ${tag.name}`}
              className={pill.icon}
              onClick={() => setConfirm(true)}
            >
              <Trash2 />
            </button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete the "${tag.name}" tag?`}
        description="The tag is removed from its links. The links themselves are not affected."
        confirmLabel="Delete tag"
        onConfirm={() => remove.mutateAsync(tag.id)}
      />
    </li>
  );
}

export function TagsTab() {
  const { data: tags, isLoading } = useTags();
  const create = useCreateTag();
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await create.mutateAsync({ name: name.trim(), color });
      setName("");
      toast.success("Tag created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create tag");
    }
  }

  return (
    <Panel>
      <PanelHeader
        icon={Tags}
        title="Tags"
        description="Organise links into campaigns, clients or channels, then filter by tag."
      />
      <form onSubmit={add} className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag name"
          maxLength={40}
          aria-label="New tag name"
          className={cn(inputClass, "sm:w-64")}
        />
        <ColorPicker value={color} onChange={setColor} />
        <button
          type="submit"
          className={cn(pill.primary, pill.small, "sm:ml-auto")}
          disabled={!name.trim() || create.isPending}
        >
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add tag
        </button>
      </form>
      {isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : !tags?.length ? (
        <EmptyState
          icon={Tags}
          title="No tags yet"
          description="Create one above, or type tags straight into the link builder."
        />
      ) : (
        <ul className="border-border/60 divide-border/50 divide-y rounded-xl border">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
