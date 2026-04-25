"use client";

import { useState } from "react";
import { Loader2, Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateLink } from "@/hooks/use-links";
import { copyToClipboard } from "@/lib/utils";

interface FieldErrors {
  url?: string;
  customAlias?: string;
  expiresAt?: string;
}

const ALIAS_REGEX = /^[a-zA-Z0-9_-]+$/;

export function CreateLinkDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const createLink = useCreateLink();

  function validate(): boolean {
    const errors: FieldErrors = {};
    const trimmedUrl = url.trim();
    const trimmedAlias = customAlias.trim();

    if (!trimmedUrl) {
      errors.url = "URL is required";
    } else {
      try {
        const parsed = new URL(trimmedUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          errors.url = "Only http and https URLs are allowed";
        }
      } catch {
        errors.url = "Please enter a valid URL (e.g. https://example.com)";
      }
      if (trimmedUrl.length > 2048) {
        errors.url = "URL must be under 2048 characters";
      }
    }

    if (trimmedAlias) {
      if (!ALIAS_REGEX.test(trimmedAlias)) {
        errors.customAlias = "Only letters, numbers, hyphens, and underscores allowed";
      } else if (trimmedAlias.length < 3) {
        errors.customAlias = "Alias must be at least 3 characters";
      } else if (trimmedAlias.length > 30) {
        errors.customAlias = "Alias must be under 30 characters";
      }
    }

    if (expiresAt) {
      const expiryDate = new Date(expiresAt);
      if (isNaN(expiryDate.getTime())) {
        errors.expiresAt = "Invalid date";
      } else if (expiryDate <= new Date()) {
        errors.expiresAt = "Expiration date must be in the future";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function clearFieldError(field: keyof FieldErrors) {
    if (fieldErrors[field]) {
      setFieldErrors((p) => ({ ...p, [field]: undefined }));
    }
  }

  function resetForm() {
    setUrl("");
    setCustomAlias("");
    setExpiresAt("");
    setFieldErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    try {
      const data: { url: string; customAlias?: string; expiresAt?: string } = {
        url: url.trim(),
      };
      if (customAlias.trim()) data.customAlias = customAlias.trim();
      if (expiresAt) data.expiresAt = new Date(expiresAt).toISOString();

      const link = await createLink.mutateAsync(data);
      const shortUrl = `${window.location.origin}/${link.shortCode}`;
      await copyToClipboard(shortUrl);
      toast.success("Link created & copied!");
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create link");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger className="bg-primary shadow-blue hover:bg-primary/90 inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-[48px] px-6 text-[15px] font-bold text-white">
        <Plus className="mr-2 h-4 w-4" />
        New Link
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Link</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 pt-2">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-sm">Destination URL</label>
            <div className="relative">
              <Link2 className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="url"
                placeholder="https://example.com/very-long-url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  clearFieldError("url");
                }}
                className={`border-border bg-input h-11 rounded-lg pl-9 ${fieldErrors.url ? "border-destructive" : ""}`}
              />
            </div>
            {fieldErrors.url && <p className="text-destructive mt-1 text-xs">{fieldErrors.url}</p>}
          </div>

          <div>
            <label className="text-muted-foreground mb-1.5 block text-sm">
              Custom Alias (optional)
            </label>
            <Input
              placeholder="my-custom-link"
              value={customAlias}
              onChange={(e) => {
                setCustomAlias(e.target.value);
                clearFieldError("customAlias");
              }}
              className={`border-border bg-input h-11 rounded-lg ${fieldErrors.customAlias ? "border-destructive" : ""}`}
            />
            {fieldErrors.customAlias ? (
              <p className="text-destructive mt-1 text-xs">{fieldErrors.customAlias}</p>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs">
                3-30 characters: letters, numbers, hyphens, underscores
              </p>
            )}
          </div>

          <div>
            <label className="text-muted-foreground mb-1.5 block text-sm">
              Expiration Date (optional)
            </label>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => {
                setExpiresAt(e.target.value);
                clearFieldError("expiresAt");
              }}
              min={new Date().toISOString().slice(0, 16)}
              className={`border-border bg-input h-11 rounded-lg ${fieldErrors.expiresAt ? "border-destructive" : ""}`}
            />
            {fieldErrors.expiresAt && (
              <p className="text-destructive mt-1 text-xs">{fieldErrors.expiresAt}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <DialogClose className="border-border text-foreground hover:bg-accent inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border bg-transparent px-4 text-sm font-medium">
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={createLink.isPending}
              className="bg-primary text-primary-foreground rounded-lg"
            >
              {createLink.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Link
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
