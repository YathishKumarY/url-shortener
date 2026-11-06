"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  Copy,
  CopyPlus,
  Eye,
  ExternalLink,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  QrCode,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { QrDialog } from "@/components/dashboard/qr-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { pill } from "@/components/shared/ui-kit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteLink, useDuplicateLink, useUpdateLink } from "@/hooks/use-links";
import { copyToClipboard } from "@/lib/utils";
import type { LinkItem } from "@/types";

export function LinkActionsMenu({ link, onDeleted }: { link: LinkItem; onDeleted?: () => void }) {
  const router = useRouter();
  const [qrOpen, setQrOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const updateLink = useUpdateLink();
  const deleteLink = useDeleteLink();
  const duplicateLink = useDuplicateLink();

  async function toggle(field: "disabled" | "archived") {
    const next = !link[field];
    try {
      await updateLink.mutateAsync({ id: link.id, [field]: next });
      const labels = {
        disabled: next ? "Link paused - visitors will see a notice" : "Link resumed",
        archived: next ? "Link archived" : "Link restored from archive",
      };
      toast.success(labels[field]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function duplicate() {
    try {
      const copy = await duplicateLink.mutateAsync(link.id);
      toast.success("Link duplicated", {
        description: copy.displayUrl,
        action: {
          label: "Edit",
          onClick: () => router.push(`/dashboard/links/${copy.id}?tab=settings`),
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate");
    }
  }

  const item = "cursor-pointer gap-2";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Actions for ${link.displayUrl}`} className={pill.icon}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            className={item}
            onClick={async () => {
              await copyToClipboard(link.shortUrl);
              toast.success("Copied to clipboard");
            }}
          >
            <Copy className="size-4" /> Copy short link
          </DropdownMenuItem>
          <DropdownMenuItem
            className={item}
            onClick={() => window.open(link.shortUrl, "_blank", "noopener")}
          >
            <ExternalLink className="size-4" /> Open short link
          </DropdownMenuItem>
          <DropdownMenuItem className={item} onClick={() => setQrOpen(true)}>
            <QrCode className="size-4" /> QR code
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={item}
            onClick={() => router.push(`/dashboard/links/${link.id}?tab=settings`)}
          >
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className={item}
            onClick={() => router.push(`/dashboard/links/${link.id}`)}
          >
            <BarChart3 className="size-4" /> Analytics
          </DropdownMenuItem>
          <DropdownMenuItem className={item} onClick={duplicate}>
            <CopyPlus className="size-4" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            className={item}
            onClick={() => window.open(`${link.shortUrl}+`, "_blank", "noopener")}
          >
            <Eye className="size-4" /> Preview page
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={item}
            onClick={() => toggle("disabled")}
            disabled={link.banned}
          >
            {link.disabled ? <Play className="size-4" /> : <Pause className="size-4" />}
            {link.disabled ? "Resume link" : "Pause link"}
          </DropdownMenuItem>
          <DropdownMenuItem className={item} onClick={() => toggle("archived")}>
            {link.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {link.archived ? "Unarchive" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={`${item} text-destructive`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <QrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        linkId={link.id}
        shortCode={link.shortCode}
        domain={link.domain}
        displayUrl={link.displayUrl}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this link?"
        description={
          <>
            <span className="text-foreground font-medium">{link.displayUrl}</span> will stop working
            immediately and its {link.clickCount} recorded clicks will be deleted. This cannot be
            undone.
          </>
        }
        confirmLabel="Delete link"
        onConfirm={async () => {
          try {
            await deleteLink.mutateAsync(link.id);
            toast.success("Link deleted");
            onDeleted?.();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete link");
            throw err;
          }
        }}
      />
    </>
  );
}
